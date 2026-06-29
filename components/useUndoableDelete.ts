"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type UndoToastEntry = { id: string; label: string };

/**
 * Delayed-commit "undo" for deletes. Calling `request` optimistically hides the
 * row (via `hiddenIds`) and shows a toast; the real delete (`commit`) only runs
 * when the toast times out. `undo` cancels it before then, so no server call
 * ever happens and the data is never mutated.
 *
 * If the component unmounts before a timer fires, the delete simply doesn't
 * commit — the safe direction for a low-stakes app.
 */
export function useUndoableDelete(
  router: { refresh: () => void },
  timeoutMs = 5000,
) {
  const [pending, setPending] = useState<UndoToastEntry[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const commits = useRef<Map<string, () => Promise<unknown>>>(new Map());

  const request = useCallback(
    (id: string, label: string, commit: () => Promise<unknown>) => {
      // Replace any in-flight timer for the same id (e.g. delete → undo → delete).
      const existing = timers.current.get(id);
      if (existing) clearTimeout(existing);

      commits.current.set(id, commit);
      setPending((p) => [...p.filter((e) => e.id !== id), { id, label }]);

      const timer = setTimeout(async () => {
        timers.current.delete(id);
        const fn = commits.current.get(id);
        commits.current.delete(id);
        setPending((p) => p.filter((e) => e.id !== id));
        try {
          await fn?.();
        } finally {
          router.refresh();
        }
      }, timeoutMs);
      timers.current.set(id, timer);
    },
    [router, timeoutMs],
  );

  const undo = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    commits.current.delete(id);
    setPending((p) => p.filter((e) => e.id !== id));
  }, []);

  // Clear any outstanding timers on unmount (uncommitted deletes are dropped).
  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const timer of map.values()) clearTimeout(timer);
      map.clear();
    };
  }, []);

  const hiddenIds = useMemo(
    () => new Set(pending.map((e) => e.id)),
    [pending],
  );

  return { hiddenIds, toasts: pending, request, undo };
}
