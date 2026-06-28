"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "sensei.username";
const EVENT = "sensei:username";

export function getUsername(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(KEY) ?? "";
}

export function setUsername(name: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, name.trim());
  // storage events don't fire in the same tab, so notify listeners ourselves.
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/** React hook for the device's username, backed by localStorage. */
export function useUsername(): [string, (name: string) => void] {
  const name = useSyncExternalStore(
    subscribe,
    getUsername,
    () => "", // server snapshot
  );
  const update = useCallback((next: string) => setUsername(next), []);
  return [name, update];
}
