"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Member, SplitType, Transaction } from "@/lib/types";
import { computeOwed, type SplitPart } from "@/lib/splits";
import { formatMoney, fromCents } from "@/lib/money";
import { addTransaction, updateTransaction } from "@/app/actions";
import {
  Button,
  ErrorText,
  Input,
  Label,
  Select,
  Spinner,
  cn,
} from "@/components/ui";

const TABS: { key: SplitType; label: string }[] = [
  { key: "equal", label: "Equal" },
  { key: "amount", label: "Amounts" },
  { key: "share", label: "Shares" },
];

export default function ExpenseForm({
  eventId,
  members,
  currency,
  defaultPayerId,
  expense,
  onClose,
  onSaved,
}: {
  eventId: string;
  members: Member[];
  currency: string;
  defaultPayerId: string;
  /** When provided, the form edits this expense instead of creating a new one. */
  expense?: Transaction | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = expense != null;

  const [description, setDescription] = useState(expense?.description ?? "");
  const [amount, setAmount] = useState(
    expense ? String(expense.amount) : "",
  );
  const [paidBy, setPaidBy] = useState(expense?.paid_by ?? defaultPayerId);
  const [splitType, setSplitType] = useState<SplitType>(
    expense?.split_type ?? "equal",
  );
  const [selected, setSelected] = useState<Set<string>>(() =>
    expense
      ? new Set(expense.splits.map((s) => s.member_id))
      : new Set(members.map((m) => m.id)),
  );
  // For amount/share modes, seed the per-member weights from the saved splits.
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    expense && expense.split_type === "amount"
      ? Object.fromEntries(expense.splits.map((s) => [s.member_id, String(s.weight)]))
      : {},
  );
  const [shares, setShares] = useState<Record<string, string>>(() =>
    expense && expense.split_type === "share"
      ? Object.fromEntries(expense.splits.map((s) => [s.member_id, String(s.weight)]))
      : {},
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Close on Escape; restore focus to whatever was focused before the modal opened.
  useEffect(() => {
    const prevActive = document.activeElement as HTMLElement | null;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prevActive?.focus?.();
    };
  }, [onClose]);

  const amountNum = parseFloat(amount) || 0;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedMembers = members.filter((m) => selected.has(m.id));

  // Build split parts for the current mode (used for both preview and submit).
  const parts: SplitPart[] = selectedMembers.map((m) => {
    let weight = 1;
    if (splitType === "amount") weight = parseFloat(amounts[m.id] ?? "") || 0;
    else if (splitType === "share") weight = parseFloat(shares[m.id] ?? "") || 0;
    return { memberId: m.id, weight };
  });

  // Live preview of who owes what, plus any validation message.
  const preview: { owed: Record<string, number>; error: string | null } = (() => {
    if (amountNum <= 0 || parts.length === 0) {
      return { owed: {}, error: null };
    }
    try {
      const result = computeOwed(amountNum, splitType, parts);
      return {
        owed: Object.fromEntries(
          result.map((o) => [o.memberId, fromCents(o.owedCents)]),
        ),
        error: null,
      };
    } catch (e) {
      return { owed: {}, error: (e as Error).message };
    }
  })();

  const customSum =
    splitType === "amount"
      ? selectedMembers.reduce(
          (s, m) => s + (parseFloat(amounts[m.id] ?? "") || 0),
          0,
        )
      : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!description.trim()) return setError("Add a description.");
    if (amountNum <= 0) return setError("Enter an amount greater than zero.");
    if (!paidBy) return setError("Choose who paid.");
    if (parts.length === 0) return setError("Select at least one person.");
    if (preview.error) return setError(preview.error);

    setPending(true);
    const payload = {
      description,
      amount: amountNum,
      paidBy,
      splitType,
      parts,
    };
    const res = isEdit
      ? await updateTransaction(eventId, expense.id, payload)
      : await addTransaction(eventId, payload);
    if (res.ok) {
      onSaved();
    } else {
      setError(res.error);
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[color-mix(in_srgb,var(--ink)_45%,transparent)] p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="expense-form-title"
        className="animate-fade-in flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h2
            id="expense-form-title"
            className="text-lg font-semibold tracking-tight"
          >
            {isEdit ? "Edit expense" : "Add expense"}
          </h2>
          <button
            onClick={onClose}
            className="pressable rounded-lg p-1.5 text-[var(--text-faint)] hover:bg-[var(--surface-2)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={submit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4"
        >
          <div>
            <Label htmlFor="desc">Description</Label>
            <Input
              id="desc"
              autoFocus
              maxLength={120}
              placeholder="Dinner, taxi, hotel…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="amt">Amount ({currency})</Label>
              <Input
                id="amt"
                inputMode="decimal"
                maxLength={12}
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="tnum"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="payer">Paid by</Label>
              <Select
                id="payer"
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Split type segmented control */}
          <div>
            <Label>Split</Label>
            <div className="flex gap-1 rounded-xl bg-[var(--surface-2)] p-1">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setSplitType(tab.key)}
                  className={cn(
                    "pressable flex-1 rounded-lg py-2 text-sm font-medium transition-colors duration-[var(--dur-2)]",
                    splitType === tab.key
                      ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                      : "text-[var(--text-dim)] hover:text-[var(--text)]",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Participants */}
          <div className="space-y-1.5">
            {members.map((m) => {
              const isSel = selected.has(m.id);
              const owed = preview.owed[m.id];
              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                    isSel
                      ? "border-[color-mix(in_srgb,var(--accent)_35%,transparent)] bg-[var(--accent-dim)]"
                      : "border-[var(--border)] bg-[var(--surface)]",
                  )}
                >
                  <label className="flex flex-1 cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggle(m.id)}
                      className="h-4 w-4 rounded border-[var(--border-strong)] accent-[var(--accent)]"
                    />
                    <span className="text-sm font-medium text-[var(--text)]">
                      {m.name}
                    </span>
                  </label>

                  {isSel && splitType === "equal" ? (
                    <span className="tnum text-sm text-[var(--text-dim)]">
                      {owed != null ? formatMoney(owed, currency) : "—"}
                    </span>
                  ) : null}

                  {isSel && splitType === "amount" ? (
                    <input
                      inputMode="decimal"
                      maxLength={12}
                      placeholder="0.00"
                      value={amounts[m.id] ?? ""}
                      onChange={(e) =>
                        setAmounts((p) => ({ ...p, [m.id]: e.target.value }))
                      }
                      className="tnum h-9 w-24 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-right text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-4 focus:ring-[var(--accent-dim)]"
                    />
                  ) : null}

                  {isSel && splitType === "share" ? (
                    <div className="flex items-center gap-2">
                      <input
                        inputMode="decimal"
                        maxLength={6}
                        placeholder="1"
                        value={shares[m.id] ?? ""}
                        onChange={(e) =>
                          setShares((p) => ({ ...p, [m.id]: e.target.value }))
                        }
                        className="tnum h-9 w-16 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-right text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-4 focus:ring-[var(--accent-dim)]"
                      />
                      <span className="tnum w-16 text-right text-sm text-[var(--text-dim)]">
                        {owed != null ? formatMoney(owed, currency) : "—"}
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Validation hints */}
          {splitType === "amount" && amountNum > 0 ? (
            <p
              className={cn(
                "text-center text-sm",
                Math.abs(customSum - amountNum) < 0.005
                  ? "text-[var(--pos)]"
                  : "text-[var(--gold)]",
              )}
            >
              <span className="tnum">{formatMoney(customSum, currency)}</span> of{" "}
              <span className="tnum">{formatMoney(amountNum, currency)}</span>{" "}
              assigned
              {Math.abs(customSum - amountNum) >= 0.005
                ? ` · ${formatMoney(amountNum - customSum, currency)} left`
                : " ✓"}
            </p>
          ) : null}

          {splitType === "equal" ? (
            <p className="text-center text-xs text-[var(--text-faint)]">
              Split equally between {selectedMembers.length} selected.
            </p>
          ) : null}

          <ErrorText>{error}</ErrorText>

          <div className="sticky bottom-0 -mx-5 mt-auto flex gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-5 pb-1 pt-3">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={pending}>
              {pending ? <Spinner /> : null}
              {isEdit ? "Save changes" : "Save expense"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
