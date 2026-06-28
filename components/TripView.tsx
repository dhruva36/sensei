"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Copy,
  Plus,
  Receipt,
  Trash2,
  UserPlus,
  Wallet,
  Users,
} from "lucide-react";
import type { Balance, Member, Transaction, Transfer, Trip } from "@/lib/types";
import { formatMoney } from "@/lib/money";
import { useUsername } from "@/lib/identity";
import {
  addMember,
  deleteTransaction,
  removeMember,
} from "@/app/actions";
import {
  Button,
  Card,
  ErrorText,
  Input,
  SectionTitle,
  Spinner,
} from "@/components/ui";
import ExpenseForm from "@/components/ExpenseForm";

const SPLIT_LABEL: Record<Transaction["split_type"], string> = {
  equal: "split equally",
  amount: "custom amounts",
  share: "by shares",
};

export default function TripView({
  trip,
  members,
  transactions,
  balances,
  transfers,
}: {
  trip: Trip;
  members: Member[];
  transactions: Transaction[];
  balances: Balance[];
  transfers: Transfer[];
}) {
  const router = useRouter();
  const [username] = useUsername();
  const [showExpense, setShowExpense] = useState(false);

  const nameById = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m.name])),
    [members],
  );

  const currentMember = useMemo(
    () =>
      members.find(
        (m) => m.name.toLowerCase() === username.trim().toLowerCase(),
      ) ?? null,
    [members, username],
  );

  // If this device has a username but isn't yet a member (joined via code),
  // add them automatically.
  useEffect(() => {
    if (username.trim() && !currentMember) {
      addMember(trip.id, username).then((res) => {
        if (res.ok) router.refresh();
      });
    }
  }, [username, currentMember, trip.id, router]);

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 py-6">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> All trips
      </Link>

      <TripHeader trip={trip} memberCount={members.length} />

      {username.trim() ? (
        <p className="mb-5 mt-3 text-sm text-slate-500">
          Acting as{" "}
          <span className="font-semibold text-slate-800">{username}</span>
        </p>
      ) : (
        <Card className="mb-5 mt-3 border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          You haven&apos;t set a name.{" "}
          <Link href="/" className="font-semibold underline">
            Set one
          </Link>{" "}
          to join in.
        </Card>
      )}

      <BalancesCard
        balances={balances}
        transfers={transfers}
        nameById={nameById}
        currency={trip.currency}
        currentMemberId={currentMember?.id ?? null}
      />

      <div className="mt-6">
        <SectionTitle
          title="Expenses"
          subtitle={`${transactions.length} total`}
          action={
            <Button
              size="sm"
              onClick={() => setShowExpense(true)}
              disabled={members.length === 0}
            >
              <Plus className="h-4 w-4" /> Add
            </Button>
          }
        />
        <ExpenseList
          transactions={transactions}
          nameById={nameById}
          currency={trip.currency}
          tripId={trip.id}
        />
      </div>

      <div className="mt-6">
        <SectionTitle title="Members" subtitle={`${members.length} people`} />
        <MembersCard
          members={members}
          tripId={trip.id}
          currentMemberId={currentMember?.id ?? null}
        />
      </div>

      {showExpense ? (
        <ExpenseForm
          tripId={trip.id}
          members={members}
          currency={trip.currency}
          defaultPayerId={currentMember?.id ?? members[0]?.id ?? ""}
          onClose={() => setShowExpense(false)}
          onSaved={() => {
            setShowExpense(false);
            router.refresh();
          }}
        />
      ) : null}
    </main>
  );
}

function TripHeader({ trip, memberCount }: { trip: Trip; memberCount: number }) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  function copy(kind: "code" | "link") {
    const text =
      kind === "code"
        ? trip.join_code
        : `${window.location.origin}/j/${trip.join_code}`;
    navigator.clipboard?.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <Card className="overflow-hidden">
      <div className="bg-indigo-600 px-5 py-4 text-white">
        <h1 className="text-xl font-bold">{trip.name}</h1>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-indigo-100">
          <Users className="h-3.5 w-3.5" /> {memberCount} members · {trip.currency}
        </p>
      </div>
      <div className="flex items-center justify-between gap-2 px-5 py-3">
        <div>
          <p className="text-xs text-slate-400">Join code</p>
          <p className="font-mono text-lg font-semibold tracking-widest text-slate-900">
            {trip.join_code}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => copy("code")}>
            {copied === "code" ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            Code
          </Button>
          <Button size="sm" variant="secondary" onClick={() => copy("link")}>
            {copied === "link" ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            Link
          </Button>
        </div>
      </div>
    </Card>
  );
}

function BalancesCard({
  balances,
  transfers,
  nameById,
  currency,
  currentMemberId,
}: {
  balances: Balance[];
  transfers: Transfer[];
  nameById: Record<string, string>;
  currency: string;
  currentMemberId: string | null;
}) {
  const nonZero = balances.filter((b) => Math.abs(b.amount) >= 0.005);

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <Wallet className="h-4 w-4 text-indigo-600" />
        <h2 className="font-semibold text-slate-900">Settle up</h2>
      </div>

      {transfers.length === 0 ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-6 text-center text-sm font-medium text-emerald-700">
          🎉 All settled up — nobody owes anything.
        </p>
      ) : (
        <ul className="space-y-2">
          {transfers.map((t, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm"
            >
              <span className="text-slate-700">
                <span className="font-semibold text-slate-900">
                  {nameById[t.from] ?? "?"}
                </span>{" "}
                pays{" "}
                <span className="font-semibold text-slate-900">
                  {nameById[t.to] ?? "?"}
                </span>
              </span>
              <span className="font-semibold text-indigo-600">
                {formatMoney(t.amount, currency)}
              </span>
            </li>
          ))}
          <li className="pt-1 text-center text-xs text-slate-400">
            Minimum {transfers.length} payment{transfers.length > 1 ? "s" : ""} to
            settle everyone.
          </li>
        </ul>
      )}

      {nonZero.length > 0 ? (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Balances
          </p>
          <ul className="space-y-1.5">
            {nonZero.map((b) => {
              const owed = b.amount > 0;
              return (
                <li
                  key={b.memberId}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-slate-700">
                    {nameById[b.memberId] ?? "?"}
                    {b.memberId === currentMemberId ? (
                      <span className="ml-1 text-xs text-slate-400">(you)</span>
                    ) : null}
                  </span>
                  <span
                    className={owed ? "text-emerald-600" : "text-red-500"}
                    title={owed ? "gets back" : "owes"}
                  >
                    {owed ? "+" : "−"}
                    {formatMoney(Math.abs(b.amount), currency)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

function ExpenseList({
  transactions,
  nameById,
  currency,
  tripId,
}: {
  transactions: Transaction[];
  nameById: Record<string, string>;
  currency: string;
  tripId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (transactions.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 px-5 py-10 text-center">
        <Receipt className="h-8 w-8 text-slate-300" />
        <p className="text-sm text-slate-500">No expenses yet.</p>
        <p className="text-xs text-slate-400">
          Add the first one to start tracking.
        </p>
      </Card>
    );
  }

  function onDelete(id: string) {
    setDeletingId(id);
    startTransition(async () => {
      await deleteTransaction(tripId, id);
      setDeletingId(null);
      router.refresh();
    });
  }

  return (
    <Card className="divide-y divide-slate-100">
      {transactions.map((t) => (
        <div
          key={t.id}
          className="flex items-center justify-between gap-3 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">
              {t.description}
            </p>
            <p className="truncate text-xs text-slate-500">
              {nameById[t.paid_by] ?? "?"} paid · {SPLIT_LABEL[t.split_type]} ·{" "}
              {t.splits.length} people
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900">
              {formatMoney(t.amount, currency)}
            </span>
            <button
              aria-label="Delete expense"
              onClick={() => onDelete(t.id)}
              disabled={pending && deletingId === t.id}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
            >
              {pending && deletingId === t.id ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      ))}
    </Card>
  );
}

function MembersCard({
  members,
  tripId,
  currentMemberId,
}: {
  members: Member[];
  tripId: string;
  currentMemberId: string | null;
}) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const name = newName;
    startTransition(async () => {
      const res = await addMember(tripId, name);
      if (res.ok) {
        setNewName("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await removeMember(tripId, id);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <Card className="p-4">
      <ul className="mb-3 space-y-1.5">
        {members.map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"
          >
            <span className="flex items-center gap-2.5 text-sm text-slate-800">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                {m.name.slice(0, 2).toUpperCase()}
              </span>
              {m.name}
              {m.id === currentMemberId ? (
                <span className="text-xs text-slate-400">(you)</span>
              ) : null}
            </span>
            <button
              aria-label={`Remove ${m.name}`}
              onClick={() => remove(m.id)}
              disabled={pending}
              className="rounded-lg p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="flex gap-2">
        <Input
          placeholder="Add a member"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Button
          type="submit"
          variant="secondary"
          disabled={pending || !newName.trim()}
        >
          <UserPlus className="h-4 w-4" /> Add
        </Button>
      </form>
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}
