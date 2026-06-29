"use client";

import { useSyncExternalStore } from "react";

const KEY = "sensei.events";
const EVENT = "sensei:events";

export type RecentEvent = {
  id: string;
  name: string;
  joinCode: string;
  currency: string;
  lastOpened: number; // epoch ms
};

function read(): RecentEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentEvent[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function write(events: RecentEvent[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(events));
  // storage events don't fire in the same tab, so notify listeners ourselves.
  window.dispatchEvent(new Event(EVENT));
}

/** Upsert an event into this device's list and mark it most-recently opened. */
export function rememberEvent(
  event: Omit<RecentEvent, "lastOpened">,
  now: number = Date.now(),
): void {
  const others = read().filter((t) => t.id !== event.id);
  write([{ ...event, lastOpened: now }, ...others]);
}

/** Remove an event from this device's list (does not delete it from Supabase). */
export function forgetEvent(id: string): void {
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

const EMPTY: RecentEvent[] = [];

function getSnapshot(): RecentEvent[] {
  return read();
}

// useSyncExternalStore caches by reference; sort in a stable way and only on read.
let cache: { raw: string; sorted: RecentEvent[] } | null = null;
function getSorted(): RecentEvent[] {
  if (typeof window === "undefined") return EMPTY;
  const raw = window.localStorage.getItem(KEY) ?? "";
  if (cache && cache.raw === raw) return cache.sorted;
  const sorted = [...getSnapshot()].sort((a, b) => b.lastOpened - a.lastOpened);
  cache = { raw, sorted };
  return sorted;
}

/** React hook: this device's events, most-recently-opened first. */
export function useRecentEvents(): RecentEvent[] {
  return useSyncExternalStore(subscribe, getSorted, () => EMPTY);
}
