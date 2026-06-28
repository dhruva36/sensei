"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { Member, SplitType } from "@/lib/types";
import { computeOwed, type SplitPart } from "@/lib/splits";
import { formatMoney, fromCents } from "@/lib/money";
import { addTransaction } from "@/app/actions";
import { Button, ErrorText, Input, Label, Spinner, cn } from "@/components/ui";

const TABS: { key: SplitType; label: string }[] = [
  { key: "equal", label: "Equal" },
  { key: "amount", label: "Amounts" },
  { key: "share", label: "Shares" },
];

export default function ExpenseForm({
  tripId,
  members,
  currency,
  defaultPayerId,
  onClose,
  onSaved,
}: {
  tripId: string;
  members: Member[];
  currency: string;
  defaultPayerId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(defaultPayerId);
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(members.map((m) => m.id)),
  );
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [shares, setShares] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
  // Cheap to recompute each render, so no memoization needed.
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
    const res = await addTransaction(tripId, {
      description,
      amount: amountNum,
      paidBy,
      splitType,
      parts,
    });
    if (res.ok) {
      onSaved();
    } else {
      setError(res.error);
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="animate-fade-in flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Add expense</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
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
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="payer">Paid by</Label>
              <select
                id="payer"
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Split type tabs */}
          <div>
            <Label>Split</Label>
            <div className="flex rounded-xl bg-slate-100 p-1">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setSplitType(tab.key)}
                  className={cn(
                    "flex-1 rounded-lg py-2 text-sm font-medium transition",
                    splitType === tab.key
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-700",
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
                    "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition",
                    isSel
                      ? "border-indigo-200 bg-indigo-50/40"
                      : "border-slate-200 bg-white",
                  )}
                >
                  <label className="flex flex-1 cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggle(m.id)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-slate-800">
                      {m.name}
                    </span>
                  </label>

                  {isSel && splitType === "equal" ? (
                    <span className="text-sm text-slate-500">
                      {owed != null ? formatMoney(owed, currency) : "—"}
                    </span>
                  ) : null}

                  {isSel && splitType === "amount" ? (
                    <input
                      inputMode="decimal"
                      placeholder="0.00"
                      value={amounts[m.id] ?? ""}
                      onChange={(e) =>
                        setAmounts((p) => ({ ...p, [m.id]: e.target.value }))
                      }
                      className="h-9 w-24 rounded-lg border border-slate-200 px-2.5 text-right text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  ) : null}

                  {isSel && splitType === "share" ? (
                    <div className="flex items-center gap-2">
                      <input
                        inputMode="decimal"
                        placeholder="1"
                        value={shares[m.id] ?? ""}
                        onChange={(e) =>
                          setShares((p) => ({ ...p, [m.id]: e.target.value }))
                        }
                        className="h-9 w-16 rounded-lg border border-slate-200 px-2.5 text-right text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                      <span className="w-16 text-right text-sm text-slate-500">
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
                  ? "text-emerald-600"
                  : "text-amber-600",
              )}
            >
              {formatMoney(customSum, currency)} of{" "}
              {formatMoney(amountNum, currency)} assigned
              {Math.abs(customSum - amountNum) >= 0.005
                ? ` · ${formatMoney(amountNum - customSum, currency)} left`
                : " ✓"}
            </p>
          ) : null}

          {splitType === "equal" ? (
            <p className="text-center text-xs text-slate-400">
              Split equally between {selectedMembers.length} selected.
            </p>
          ) : null}

          <ErrorText>{error}</ErrorText>

          <div className="sticky bottom-0 -mx-5 mt-auto flex gap-3 border-t border-slate-100 bg-white px-5 pb-1 pt-3">
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
              Save expense
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
