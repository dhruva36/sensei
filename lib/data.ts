import "server-only";

import { getSupabase } from "./supabase/server";
import { normalizeJoinCode } from "./joinCode";
import type { Member, Settlement, Transaction, Event } from "./types";

/**
 * Postgres `numeric` columns come back from PostgREST as strings. Coerce the
 * money/weight fields to numbers at the data boundary so the rest of the app
 * works with plain numbers.
 */
function normalizeTransaction(row: Record<string, unknown>): Transaction {
  const splits = ((row.splits as Record<string, unknown>[]) ?? []).map((s) => ({
    id: s.id as string,
    transaction_id: s.transaction_id as string,
    member_id: s.member_id as string,
    weight: Number(s.weight),
  }));
  return {
    id: row.id as string,
    event_id: row.event_id as string,
    description: row.description as string,
    amount: Number(row.amount),
    paid_by: row.paid_by as string,
    split_type: row.split_type as Transaction["split_type"],
    created_at: row.created_at as string,
    splits,
  };
}

export async function getEvent(eventId: string): Promise<Event | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Event) ?? null;
}

export async function getEventByCode(code: string): Promise<Event | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("join_code", normalizeJoinCode(code))
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Event) ?? null;
}

export async function getMembers(eventId: string): Promise<Member[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as Member[]) ?? [];
}

export async function getTransactions(eventId: string): Promise<Transaction[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("transactions")
    .select("*, splits:transaction_splits(*)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data as Record<string, unknown>[]) ?? []).map(normalizeTransaction);
}

export async function getSettlements(eventId: string): Promise<Settlement[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("settlements")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) {
    // The settlements table is an additive migration. If it hasn't been applied
    // yet, degrade gracefully (no payments) instead of breaking the whole event.
    if (error.code === "PGRST205" || error.code === "42P01") return [];
    throw new Error(error.message);
  }
  // numeric(12,2) comes back as a string from PostgREST — coerce to a number.
  return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
    id: r.id as string,
    event_id: r.event_id as string,
    from_member: r.from_member as string,
    to_member: r.to_member as string,
    amount: Number(r.amount),
    note: (r.note as string | null) ?? null,
    created_at: r.created_at as string,
  }));
}

export type FullEvent = {
  event: Event;
  members: Member[];
  transactions: Transaction[];
  settlements: Settlement[];
};

export async function getFullEvent(eventId: string): Promise<FullEvent | null> {
  const event = await getEvent(eventId);
  if (!event) return null;
  const [members, transactions, settlements] = await Promise.all([
    getMembers(eventId),
    getTransactions(eventId),
    getSettlements(eventId),
  ]);
  return { event, members, transactions, settlements };
}
