"use client";

import { Undo2 } from "lucide-react";
import type { UndoToastEntry } from "@/components/useUndoableDelete";

/** Bottom-centered, stacked "Deleted · Undo" toasts. */
export default function UndoToast({
  toasts,
  onUndo,
}: {
  toasts: UndoToastEntry[];
  onUndo: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="undo-toast pointer-events-auto flex items-center gap-4 rounded-full border border-[color-mix(in_srgb,var(--surface)_18%,transparent)] bg-[var(--ink)] py-2.5 pl-4 pr-2.5 text-sm text-[var(--surface)] shadow-xl"
        >
          <span>{t.label}</span>
          <button
            onClick={() => onUndo(t.id)}
            className="pressable inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold text-[var(--gold)] transition-colors hover:bg-[color-mix(in_srgb,var(--surface)_12%,transparent)]"
          >
            <Undo2 className="h-3.5 w-3.5" /> Undo
          </button>
        </div>
      ))}
    </div>
  );
}
