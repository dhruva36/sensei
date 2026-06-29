"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase/server";
import { getEventByCode } from "@/lib/data";
import { generateJoinCode, normalizeJoinCode } from "@/lib/joinCode";
import { computeOwed, type SplitPart } from "@/lib/splits";
import type { Member, SplitType } from "@/lib/types";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

const UNIQUE_VIOLATION = "23505";

/** Create an event and add the creator as its first member. */
export async function createEvent(input: {
  name: string;
  currency: string;
  creatorName: string;
}): Promise<ActionResult<{ eventId: string; joinCode: string }>> {
  const name = input.name.trim();
  const creatorName = input.creatorName.trim();
  const currency = (input.currency || "USD").trim().toUpperCase();

  if (!name) return { ok: false, error: "Please enter an event name." };
  if (!creatorName) return { ok: false, error: "Please set your name first." };

  const supabase = getSupabase();

  // Retry a few times in the (very unlikely) event of a join-code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const joinCode = generateJoinCode();
    const { data, error } = await supabase
      .from("events")
      .insert({ name, join_code: joinCode, currency })
      .select("id, join_code")
      .single();

    if (error) {
      if (error.code === UNIQUE_VIOLATION) continue;
      return { ok: false, error: error.message };
    }

    const eventId = data.id as string;
    const memberRes = await addMember(eventId, creatorName);
    if (!memberRes.ok) return memberRes;

    return { ok: true, data: { eventId, joinCode: data.join_code as string } };
  }

  return { ok: false, error: "Could not generate a unique join code. Try again." };
}

/** Rename an event. */
export async function renameEvent(
  eventId: string,
  rawName: string,
): Promise<ActionResult> {
  const name = rawName.trim();
  if (!name) return { ok: false, error: "Please enter an event name." };

  const supabase = getSupabase();
  const { error } = await supabase
    .from("events")
    .update({ name })
    .eq("id", eventId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/events/${eventId}`);
  return { ok: true };
}

/** Delete an event and everything in it (cascades to members/expenses/payments). */
export async function deleteEvent(eventId: string): Promise<ActionResult> {
  const supabase = getSupabase();
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  return { ok: true };
}

/** Look up an event by its join code (used by the Join flow). */
export async function joinEventByCode(
  code: string,
): Promise<ActionResult<{ eventId: string }>> {
  const normalized = normalizeJoinCode(code);
  if (!normalized) return { ok: false, error: "Please enter a join code." };

  const event = await getEventByCode(normalized);
  if (!event) return { ok: false, error: "No event found for that code." };

  return { ok: true, data: { eventId: event.id } };
}

/** Add a member to an event. Idempotent: returns the existing member by name. */
export async function addMember(
  eventId: string,
  rawName: string,
): Promise<ActionResult<Member>> {
  const name = rawName.trim();
  if (!name) return { ok: false, error: "Please enter a name." };

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("members")
    .insert({ event_id: eventId, name })
    .select("*")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      // Already a member — fetch and return them (case-insensitive match).
      const { data: existing } = await supabase
        .from("members")
        .select("*")
        .eq("event_id", eventId)
        .ilike("name", name)
        .maybeSingle();
      if (existing) {
        revalidatePath(`/events/${eventId}`);
        return { ok: true, data: existing as Member };
      }
    }
    return { ok: false, error: error.message };
  }

  revalidatePath(`/events/${eventId}`);
  return { ok: true, data: data as Member };
}

export async function removeMember(
  eventId: string,
  memberId: string,
): Promise<ActionResult> {
  const supabase = getSupabase();

  // Block removal if the member is tied to any expense (as payer or participant).
  const { count: paidCount } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("paid_by", memberId);
  const { count: splitCount } = await supabase
    .from("transaction_splits")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId);

  if ((paidCount ?? 0) > 0 || (splitCount ?? 0) > 0) {
    return {
      ok: false,
      error: "This member is part of existing expenses. Delete those first.",
    };
  }

  // Also block removal if they appear in any recorded payment — the delete
  // cascade would silently erase that settlement history.
  const { count: payFrom } = await supabase
    .from("settlements")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("from_member", memberId);
  const { count: payTo } = await supabase
    .from("settlements")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("to_member", memberId);

  if ((payFrom ?? 0) > 0 || (payTo ?? 0) > 0) {
    return {
      ok: false,
      error: "This member has recorded payments. Delete those first.",
    };
  }

  const { error } = await supabase
    .from("members")
    .delete()
    .eq("id", memberId)
    .eq("event_id", eventId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/events/${eventId}`);
  return { ok: true };
}

export async function addTransaction(
  eventId: string,
  input: {
    description: string;
    amount: number;
    paidBy: string;
    splitType: SplitType;
    parts: SplitPart[];
  },
): Promise<ActionResult> {
  const description = input.description.trim();
  if (!description) return { ok: false, error: "Please add a description." };
  if (!(input.amount > 0))
    return { ok: false, error: "Amount must be greater than zero." };
  if (!input.paidBy) return { ok: false, error: "Choose who paid." };
  if (input.parts.length === 0)
    return { ok: false, error: "Select at least one person to split with." };

  // Validate the split up front so we never persist an inconsistent expense.
  try {
    computeOwed(input.amount, input.splitType, input.parts);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const supabase = getSupabase();
  const { data: txn, error: txnErr } = await supabase
    .from("transactions")
    .insert({
      event_id: eventId,
      description,
      amount: input.amount,
      paid_by: input.paidBy,
      split_type: input.splitType,
    })
    .select("id")
    .single();
  if (txnErr) return { ok: false, error: txnErr.message };

  const rows = input.parts.map((p) => ({
    transaction_id: txn.id,
    member_id: p.memberId,
    weight: p.weight,
  }));
  const { error: splitErr } = await supabase
    .from("transaction_splits")
    .insert(rows);
  if (splitErr) {
    // Roll back the orphaned transaction.
    await supabase.from("transactions").delete().eq("id", txn.id);
    return { ok: false, error: splitErr.message };
  }

  revalidatePath(`/events/${eventId}`);
  return { ok: true };
}

export async function updateTransaction(
  eventId: string,
  transactionId: string,
  input: {
    description: string;
    amount: number;
    paidBy: string;
    splitType: SplitType;
    parts: SplitPart[];
  },
): Promise<ActionResult> {
  const description = input.description.trim();
  if (!description) return { ok: false, error: "Please add a description." };
  if (!(input.amount > 0))
    return { ok: false, error: "Amount must be greater than zero." };
  if (!input.paidBy) return { ok: false, error: "Choose who paid." };
  if (input.parts.length === 0)
    return { ok: false, error: "Select at least one person to split with." };

  // Validate the split up front so we never persist an inconsistent expense.
  try {
    computeOwed(input.amount, input.splitType, input.parts);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const supabase = getSupabase();
  const { error: txnErr } = await supabase
    .from("transactions")
    .update({
      description,
      amount: input.amount,
      paid_by: input.paidBy,
      split_type: input.splitType,
    })
    .eq("id", transactionId)
    .eq("event_id", eventId);
  if (txnErr) return { ok: false, error: txnErr.message };

  // Replace the splits wholesale (delete + reinsert) to match the new shape.
  const { error: delErr } = await supabase
    .from("transaction_splits")
    .delete()
    .eq("transaction_id", transactionId);
  if (delErr) return { ok: false, error: delErr.message };

  const rows = input.parts.map((p) => ({
    transaction_id: transactionId,
    member_id: p.memberId,
    weight: p.weight,
  }));
  const { error: splitErr } = await supabase
    .from("transaction_splits")
    .insert(rows);
  if (splitErr) return { ok: false, error: splitErr.message };

  revalidatePath(`/events/${eventId}`);
  return { ok: true };
}

export async function deleteTransaction(
  eventId: string,
  transactionId: string,
): Promise<ActionResult> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", transactionId)
    .eq("event_id", eventId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/events/${eventId}`);
  return { ok: true };
}

/** Record that one member actually paid another to settle up. */
export async function recordSettlement(
  eventId: string,
  input: {
    fromMemberId: string;
    toMemberId: string;
    amount: number;
    note?: string;
  },
): Promise<ActionResult> {
  if (!input.fromMemberId || !input.toMemberId)
    return { ok: false, error: "Choose who paid whom." };
  if (input.fromMemberId === input.toMemberId)
    return { ok: false, error: "A payment needs two different people." };
  if (!(input.amount > 0))
    return { ok: false, error: "Amount must be greater than zero." };

  const supabase = getSupabase();
  const { error } = await supabase.from("settlements").insert({
    event_id: eventId,
    from_member: input.fromMemberId,
    to_member: input.toMemberId,
    amount: input.amount,
    note: input.note?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/events/${eventId}`);
  return { ok: true };
}

export async function deleteSettlement(
  eventId: string,
  settlementId: string,
): Promise<ActionResult> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("settlements")
    .delete()
    .eq("id", settlementId)
    .eq("event_id", eventId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/events/${eventId}`);
  return { ok: true };
}
