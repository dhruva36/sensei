"use client";

import { useSyncExternalStore } from "react";

const KEY = "sensei.trips";
const EVENT = "sensei:trips";

export type RecentTrip = {
  id: string;
  name: string;
  joinCode: string;
  currency: string;
  lastOpened: number; // epoch ms
};

function read(): RecentTrip[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentTrip[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function write(trips: RecentTrip[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(trips));
  // storage events don't fire in the same tab, so notify listeners ourselves.
  window.dispatchEvent(new Event(EVENT));
}

/** Upsert a trip into this device's list and mark it most-recently opened. */
export function rememberTrip(
  trip: Omit<RecentTrip, "lastOpened">,
  now: number = Date.now(),
): void {
  const others = read().filter((t) => t.id !== trip.id);
  write([{ ...trip, lastOpened: now }, ...others]);
}

/** Remove a trip from this device's list (does not delete it from Supabase). */
export function forgetTrip(id: string): void {
  write(read().filter((t) => t.id !== id));
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

const EMPTY: RecentTrip[] = [];

function getSnapshot(): RecentTrip[] {
  return read();
}

// useSyncExternalStore caches by reference; sort in a stable way and only on read.
let cache: { raw: string; sorted: RecentTrip[] } | null = null;
function getSorted(): RecentTrip[] {
  if (typeof window === "undefined") return EMPTY;
  const raw = window.localStorage.getItem(KEY) ?? "";
  if (cache && cache.raw === raw) return cache.sorted;
  const sorted = [...getSnapshot()].sort((a, b) => b.lastOpened - a.lastOpened);
  cache = { raw, sorted };
  return sorted;
}

/** React hook: this device's trips, most-recently-opened first. */
export function useRecentTrips(): RecentTrip[] {
  return useSyncExternalStore(subscribe, getSorted, () => EMPTY);
}
