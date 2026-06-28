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
  Users,
} from "lucide-react";
import type { Balance, Member, Transaction, Transfer, Trip } from "@/lib/types";
import { formatMoney } from "@/lib/money";
import { useUsername } from "@/lib/identity";
import { addMember, deleteTransaction, removeMember } from "@/app/actions";
import {
  Button,
  Card,
  ErrorText,
  Input,
  SectionTitle,
  Spinner,
} from "@/components/ui";
import { AnimatedNumber, Stagger, StaggerItem } from "@/components/motion";
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

  const totalSpent = useMemo(
    () => transactions.reduce((s, t) => s + t.amount, 0),
    [transactions],
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
    <div className="mx-auto w-full max-w-2xl px-5 pb-16 pt-6">
      <Link
        href="/"
        className="pressable mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
      >
        <ArrowLeft className="h-4 w-4" /> All trips
      </Link>

      <TripHeader trip={trip} memberCount={members.length} />

      <Stagger className="mt-3 grid grid-cols-2 gap-3">
        <StaggerItem>
          <Card className="p-4">
            <AnimatedNumber
              value={totalSpent}
              format={(n) => formatMoney(n, trip.currency)}
              className="text-2xl font-semibold"
            />
            <div className="mt-1 text-sm text-[var(--text-dim)]">Total spent</div>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="p-4">
            <AnimatedNumber
              value={transactions.length}
              format={(n) => Math.round(n).toString()}
              className="text-2xl font-semibold"
            />
            <div className="mt-1 text-sm text-[var(--text-dim)]">Expenses</div>
          </Card>
        </StaggerItem>
      </Stagger>

      {username.trim() ? (
        <p className="mb-1 mt-4 text-sm text-[var(--text-dim)]">
          Acting as{" "}
          <span className="font-semibold text-[var(--text)]">{username}</span>
        </p>
      ) : (
        <Card className="mb-1 mt-4 border-[color-mix(in_srgb,var(--gold)_40%,transparent)] bg-[color-mix(in_srgb,var(--gold)_10%,var(--surface))] p-3 text-sm text-[var(--text)]">
          You haven&apos;t set a name.{" "}
          <Link href="/" className="font-semibold underline">
            Set one
          </Link>{" "}
          to join in.
        </Card>
      )}

      <div className="mt-5">
        <BalancesCard
          balances={balances}
          transfers={transfers}
          nameById={nameById}
          currency={trip.currency}
          currentMemberId={currentMember?.id ?? null}
        />
      </div>

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
    </div>
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
      <div className="bg-[var(--ink)] px-5 py-4">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--surface)]">
          {trip.name}
        </h1>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-[color-mix(in_srgb,var(--surface)_70%,transparent)]">
          <Users className="h-3.5 w-3.5" /> {memberCount} members · {trip.currency}
        </p>
      </div>
      <div className="flex items-center justify-between gap-2 px-5 py-3">
        <div>
          <p className="text-xs text-[var(--text-faint)]">Join code</p>
          <p className="tnum text-lg font-semibold tracking-widest text-[var(--text)]">
            {trip.join_code}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => copy("code")}>
            {copied === "code" ? (
              <Check className="h-4 w-4 text-[var(--pos)]" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            Code
          </Button>
          <Button size="sm" variant="secondary" onClick={() => copy("link")}>
            {copied === "link" ? (
              <Check className="h-4 w-4 text-[var(--pos)]" />
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
      <h2 className="mb-3 text-xl font-semibold tracking-tight">Settle up</h2>

      {transfers.length === 0 ? (
        <p className="rounded-xl bg-[color-mix(in_srgb,var(--pos)_10%,var(--surface))] px-4 py-6 text-center text-sm font-medium text-[var(--pos)]">
          All settled up — nobody owes anything.
        </p>
      ) : (
        <ul className="space-y-2">
          {transfers.map((t, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] px-4 py-3 text-sm"
            >
              <span className="text-[var(--text-dim)]">
                <span className="font-semibold text-[var(--text)]">
                  {nameById[t.from] ?? "?"}
                </span>{" "}
                pays{" "}
                <span className="font-semibold text-[var(--text)]">
                  {nameById[t.to] ?? "?"}
                </span>
              </span>
              <span className="tnum font-semibold text-[var(--accent)]">
                {formatMoney(t.amount, currency)}
              </span>
            </li>
          ))}
          <li className="pt-1 text-center text-xs text-[var(--text-faint)]">
            Minimum {transfers.length} payment{transfers.length > 1 ? "s" : ""} to
            settle everyone.
          </li>
        </ul>
      )}

      {nonZero.length > 0 ? (
        <div className="mt-4 border-t border-[var(--border)] pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
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
                  <span className="text-[var(--text-dim)]">
                    {nameById[b.memberId] ?? "?"}
                    {b.memberId === currentMemberId ? (
                      <span className="ml-1 text-xs text-[var(--text-faint)]">
                        (you)
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={
                      owed
                        ? "tnum text-[var(--pos)]"
                        : "tnum text-[var(--neg)]"
                    }
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
        <Receipt className="h-8 w-8 text-[var(--text-faint)]" />
        <p className="text-sm text-[var(--text-dim)]">No expenses yet.</p>
        <p className="text-xs text-[var(--text-faint)]">
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
    <Card className="divide-y divide-[var(--border)]">
      {transactions.map((t) => (
        <div
          key={t.id}
          className="flex items-center justify-between gap-3 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="truncate font-medium text-[var(--text)]">
              {t.description}
            </p>
            <p className="truncate text-xs text-[var(--text-dim)]">
              {nameById[t.paid_by] ?? "?"} paid · {SPLIT_LABEL[t.split_type]} ·{" "}
              {t.splits.length} people
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="tnum font-semibold text-[var(--text)]">
              {formatMoney(t.amount, currency)}
            </span>
            <button
              aria-label="Delete expense"
              onClick={() => onDelete(t.id)}
              disabled={pending && deletingId === t.id}
              className="pressable rounded-lg p-1.5 text-[var(--text-faint)] transition-colors hover:bg-[color-mix(in_srgb,var(--neg)_10%,transparent)] hover:text-[var(--neg)] disabled:opacity-50"
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
            className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] px-3 py-2"
          >
            <span className="flex items-center gap-2.5 text-sm text-[var(--text)]">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--ink)] text-xs font-semibold text-[var(--gold)]">
                {m.name.slice(0, 2).toUpperCase()}
              </span>
              {m.name}
              {m.id === currentMemberId ? (
                <span className="text-xs text-[var(--text-faint)]">(you)</span>
              ) : null}
            </span>
            <button
              aria-label={`Remove ${m.name}`}
              onClick={() => remove(m.id)}
              disabled={pending}
              className="pressable rounded-lg p-1.5 text-[var(--text-faint)] transition-colors hover:bg-[color-mix(in_srgb,var(--neg)_10%,transparent)] hover:text-[var(--neg)] disabled:opacity-50"
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
