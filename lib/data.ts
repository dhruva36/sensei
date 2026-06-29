import "server-only";

import { getSupabase } from "./supabase/server";
import { normalizeJoinCode } from "./joinCode";
import type { Member, Settlement, Transaction, Trip } from "./types";

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
    trip_id: row.trip_id as string,
    description: row.description as string,
    amount: Number(row.amount),
    paid_by: row.paid_by as string,
    split_type: row.split_type as Transaction["split_type"],
    created_at: row.created_at as string,
    splits,
  };
}

export async function getTrip(tripId: string): Promise<Trip | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Trip) ?? null;
}

export async function getTripByCode(code: string): Promise<Trip | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .eq("join_code", normalizeJoinCode(code))
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Trip) ?? null;
}

export async function getMembers(tripId: string): Promise<Member[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as Member[]) ?? [];
}

export async function getTransactions(tripId: string): Promise<Transaction[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("transactions")
    .select("*, splits:transaction_splits(*)")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data as Record<string, unknown>[]) ?? []).map(normalizeTransaction);
}

export async function getSettlements(tripId: string): Promise<Settlement[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("settlements")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });
  if (error) {
    // The settlements table is an additive migration. If it hasn't been applied
    // yet, degrade gracefully (no payments) instead of breaking the whole trip.
    if (error.code === "PGRST205" || error.code === "42P01") return [];
    throw new Error(error.message);
  }
  // numeric(12,2) comes back as a string from PostgREST — coerce to a number.
  return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
    id: r.id as string,
    trip_id: r.trip_id as string,
    from_member: r.from_member as string,
    to_member: r.to_member as string,
    amount: Number(r.amount),
    note: (r.note as string | null) ?? null,
    created_at: r.created_at as string,
  }));
}

export type FullTrip = {
  trip: Trip;
  members: Member[];
  transactions: Transaction[];
  settlements: Settlement[];
};

export async function getFullTrip(tripId: string): Promise<FullTrip | null> {
  const trip = await getTrip(tripId);
  if (!trip) return null;
  const [members, transactions, settlements] = await Promise.all([
    getMembers(tripId),
    getTransactions(tripId),
    getSettlements(tripId),
  ]);
  return { trip, members, transactions, settlements };
}
