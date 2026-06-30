"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Copy,
  Pencil,
  Plus,
  Receipt,
  Route,
  Settings,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import type {
  Balance,
  Member,
  Settlement,
  Transaction,
  Transfer,
  Event,
} from "@/lib/types";
import { formatMoney } from "@/lib/money";
import { useUsername } from "@/lib/identity";
import { forgetEvent, rememberEvent } from "@/lib/recentEvents";
import {
  addMember,
  deleteSettlement,
  deleteTransaction,
  deleteEvent,
  recordSettlement,
  removeMember,
  renameEvent,
} from "@/app/actions";
import {
  Button,
  Card,
  ErrorText,
  Input,
  Label,
  SectionTitle,
  Spinner,
} from "@/components/ui";
import { AnimatedNumber, Stagger, StaggerItem } from "@/components/motion";
import ExpenseForm from "@/components/ExpenseForm";
import ConfirmDialog from "@/components/ConfirmDialog";
import UndoToast from "@/components/UndoToast";
import { useUndoableDelete } from "@/components/useUndoableDelete";

const SPLIT_LABEL: Record<Transaction["split_type"], string> = {
  equal: "split equally",
  amount: "custom amounts",
  share: "by shares",
};

export default function EventView({
  event,
  members,
  transactions,
  settlements,
  balances,
  transfers,
}: {
  event: Event;
  members: Member[];
  transactions: Transaction[];
  settlements: Settlement[];
  balances: Balance[];
  transfers: Transfer[];
}) {
  const router = useRouter();
  const [username] = useUsername();
  const [showExpense, setShowExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Transaction | null>(null);
  const expenseModalOpen = showExpense || editingExpense !== null;

  // Undo-on-delete for expenses and payments (single toast region for both).
  const undo = useUndoableDelete(router);

  const nameById = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m.name])),
    [members],
  );

  // Hide optimistically-deleted rows while their undo toast is showing.
  const visibleTransactions = useMemo(
    () => transactions.filter((t) => !undo.hiddenIds.has(t.id)),
    [transactions, undo.hiddenIds],
  );
  const visibleSettlements = useMemo(
    () => settlements.filter((s) => !undo.hiddenIds.has(s.id)),
    [settlements, undo.hiddenIds],
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

  // Remember this event on the device so it shows up in "Your events" on the home
  // page — lets anyone reopen the event and add expenses whenever they like.
  useEffect(() => {
    rememberEvent({
      id: event.id,
      name: event.name,
      joinCode: event.join_code,
      currency: event.currency,
    });
  }, [event.id, event.name, event.join_code, event.currency]);

  // If this device has a username but isn't yet a member (joined via code),
  // add them automatically.
  useEffect(() => {
    if (username.trim() && !currentMember) {
      addMember(event.id, username).then((res) => {
        if (res.ok) router.refresh();
      });
    }
  }, [username, currentMember, event.id, router]);

  // Light polling so everyone sees others' changes without a manual refresh.
  // Only runs while the tab is visible and no expense modal is open (to avoid
  // refreshing mid-edit), keeping it cheap and unobtrusive.
  useEffect(() => {
    if (expenseModalOpen) return;
    let timer: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (timer == null) timer = setInterval(() => router.refresh(), 8000);
    }
    function stop() {
      if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
    }
    function onVisibility() {
      if (document.visibilityState === "visible") start();
      else stop();
    }

    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [expenseModalOpen, router]);

  return (
    <div className="mx-auto w-full max-w-2xl px-5 pb-16 pt-6">
      <Link
        href="/"
        className="pressable mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
      >
        <ArrowLeft className="h-4 w-4" /> All events
      </Link>

      <EventHeader event={event} memberCount={members.length} />

      <Stagger className="mt-3 grid grid-cols-2 gap-3">
        <StaggerItem>
          <Card className="p-4">
            <AnimatedNumber
              value={totalSpent}
              format={(n) => formatMoney(n, event.currency)}
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
          eventId={event.id}
          balances={balances}
          transfers={transfers}
          nameById={nameById}
          currency={event.currency}
          currentMemberId={currentMember?.id ?? null}
        />
      </div>

      {visibleSettlements.length > 0 ? (
        <div className="mt-5">
          <PaymentsCard
            eventId={event.id}
            settlements={visibleSettlements}
            nameById={nameById}
            currency={event.currency}
            onDeleteRequest={undo.request}
          />
        </div>
      ) : null}

      <div className="mt-6">
        <SectionTitle
          title="Expenses"
          subtitle={`${visibleTransactions.length} total`}
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
          transactions={visibleTransactions}
          nameById={nameById}
          currency={event.currency}
          eventId={event.id}
          onEdit={(t) => setEditingExpense(t)}
          onDeleteRequest={undo.request}
        />
      </div>

      <div className="mt-6">
        <SectionTitle title="Members" subtitle={`${members.length} people`} />
        <MembersCard
          members={members}
          eventId={event.id}
          currentMemberId={currentMember?.id ?? null}
        />
      </div>

      {expenseModalOpen ? (
        <ExpenseForm
          key={editingExpense?.id ?? "new"}
          eventId={event.id}
          members={members}
          currency={event.currency}
          defaultPayerId={currentMember?.id ?? members[0]?.id ?? ""}
          expense={editingExpense}
          onClose={() => {
            setShowExpense(false);
            setEditingExpense(null);
          }}
          onSaved={() => {
            setShowExpense(false);
            setEditingExpense(null);
            router.refresh();
          }}
        />
      ) : null}

      <UndoToast toasts={undo.toasts} onUndo={undo.undo} />
    </div>
  );
}

function EventHeader({ event, memberCount }: { event: Event; memberCount: number }) {
  const router = useRouter();
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [name, setName] = useState(event.name);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  function copy(kind: "code" | "link") {
    const text =
      kind === "code"
        ? event.join_code
        : `${window.location.origin}/j/${event.join_code}`;
    navigator.clipboard?.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  }

  function saveName(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim() === event.name) return setSettingsOpen(false);
    startTransition(async () => {
      const res = await renameEvent(event.id, name);
      if (res.ok) {
        setSettingsOpen(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function remove() {
    setConfirmDelete(false);
    startTransition(async () => {
      const res = await deleteEvent(event.id);
      if (res.ok) {
        forgetEvent(event.id);
        router.push("/");
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 bg-[var(--ink)] px-5 py-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-[var(--surface)]">
            {event.name}
          </h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-[color-mix(in_srgb,var(--surface)_70%,transparent)]">
            <Users className="h-3.5 w-3.5" /> {memberCount} members ·{" "}
            {event.currency}
          </p>
        </div>
        <button
          aria-label="Event settings"
          aria-expanded={settingsOpen}
          onClick={() => {
            setName(event.name);
            setError(null);
            setSettingsOpen((v) => !v);
          }}
          className="pressable shrink-0 rounded-lg p-2 text-[color-mix(in_srgb,var(--surface)_70%,transparent)] transition-colors hover:bg-[color-mix(in_srgb,var(--surface)_12%,transparent)] hover:text-[var(--surface)]"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>

      {settingsOpen ? (
        <div className="border-b border-[var(--border)] bg-[var(--surface-2)] px-5 py-4">
          <form onSubmit={saveName} className="flex flex-col gap-2">
            <Label htmlFor="event-name">Event name</Label>
            <div className="flex gap-2">
              <Input
                id="event-name"
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Button type="submit" disabled={pending || !name.trim()}>
                {pending ? <Spinner /> : null}
                Save
              </Button>
            </div>
          </form>
          <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-4">
            <span className="text-sm text-[var(--text-dim)]">
              Delete this event for everyone
            </span>
            <Button
              size="sm"
              variant="danger"
              disabled={pending}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
          <ErrorText>{error}</ErrorText>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 px-5 py-3">
        <div>
          <p className="text-xs text-[var(--text-faint)]">Join code</p>
          <p className="tnum text-lg font-semibold tracking-widest text-[var(--text)]">
            {event.join_code}
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

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete "${event.name}"?`}
        message="This permanently removes the event and all its expenses and payments for everyone. This can't be undone."
        confirmLabel="Delete event"
        pending={pending}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </Card>
  );
}

function BalancesCard({
  eventId,
  balances,
  transfers,
  nameById,
  currency,
  currentMemberId,
}: {
  eventId: string;
  balances: Balance[];
  transfers: Transfer[];
  nameById: Record<string, string>;
  currency: string;
  currentMemberId: string | null;
}) {
  const router = useRouter();
  const nonZero = balances.filter((b) => Math.abs(b.amount) >= 0.005);
  const [pending, startTransition] = useTransition();
  const [confirmTransfer, setConfirmTransfer] = useState<Transfer | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Your own net position, surfaced as a headline so the first thing you see is
  // what this settles to for you.
  const myBalance = currentMemberId
    ? balances.find((b) => b.memberId === currentMemberId)?.amount ?? 0
    : 0;
  const myOwed = myBalance > 0.005;
  const myOwes = myBalance < -0.005;

  function markPaid(t: Transfer) {
    setConfirmTransfer(null);
    setError(null);
    startTransition(async () => {
      const res = await recordSettlement(eventId, {
        fromMemberId: t.from,
        toMemberId: t.to,
        amount: t.amount,
      });
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <Card className="border-[color-mix(in_srgb,var(--accent)_24%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_6%,var(--surface))] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Route className="h-[18px] w-[18px] text-[var(--accent)]" />
          Settle up
        </h2>
        {myOwed || myOwes ? (
          <div className="text-right">
            <div className="text-[11px] leading-tight text-[var(--text-dim)]">
              {myOwed ? "You get back" : "You owe"}
            </div>
            <div
              className={
                myOwed
                  ? "tnum text-lg font-semibold text-[var(--pos)]"
                  : "tnum text-lg font-semibold text-[var(--neg)]"
              }
            >
              {myOwed ? "+" : "−"}
              {formatMoney(Math.abs(myBalance), currency)}
            </div>
          </div>
        ) : null}
      </div>

      {transfers.length === 0 ? (
        <p className="rounded-xl bg-[color-mix(in_srgb,var(--pos)_10%,var(--surface))] px-4 py-6 text-center text-sm font-medium text-[var(--pos)]">
          All settled up — nobody owes anything.
        </p>
      ) : (
        <ul className="space-y-2">
          {transfers.map((t, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm"
            >
              <span className="min-w-0 text-[var(--text-dim)]">
                <span className="font-semibold text-[var(--text)]">
                  {nameById[t.from] ?? "?"}
                </span>{" "}
                pays{" "}
                <span className="font-semibold text-[var(--text)]">
                  {nameById[t.to] ?? "?"}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="tnum font-semibold text-[var(--accent)]">
                  {formatMoney(t.amount, currency)}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => setConfirmTransfer(t)}
                  className="whitespace-nowrap border-[var(--accent)] bg-[var(--accent)] text-white hover:border-[color-mix(in_srgb,var(--accent)_88%,black)] hover:bg-[color-mix(in_srgb,var(--accent)_88%,black)]"
                >
                  <Check className="h-4 w-4" /> Mark paid
                </Button>
              </span>
            </li>
          ))}
          <li className="pt-1 text-center text-xs text-[var(--text-faint)]">
            Minimum {transfers.length} payment{transfers.length > 1 ? "s" : ""} to
            settle everyone.
          </li>
        </ul>
      )}

      <ErrorText>{error}</ErrorText>

      <ConfirmDialog
        open={confirmTransfer !== null}
        title="Record this payment?"
        message={
          confirmTransfer
            ? `${nameById[confirmTransfer.from] ?? "?"} paid ${nameById[confirmTransfer.to] ?? "?"} ${formatMoney(confirmTransfer.amount, currency)}. This updates everyone's balances.`
            : undefined
        }
        confirmLabel="Record payment"
        cancelLabel="Cancel"
        pending={pending}
        onConfirm={() => confirmTransfer && markPaid(confirmTransfer)}
        onCancel={() => setConfirmTransfer(null)}
      />

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

function PaymentsCard({
  eventId,
  settlements,
  nameById,
  currency,
  onDeleteRequest,
}: {
  eventId: string;
  settlements: Settlement[];
  nameById: Record<string, string>;
  currency: string;
  onDeleteRequest: (
    id: string,
    label: string,
    commit: () => Promise<unknown>,
  ) => void;
}) {
  return (
    <Card className="p-5">
      <h2 className="mb-3 text-xl font-semibold tracking-tight">Payments</h2>
      <ul className="space-y-2">
        {settlements.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-2)] px-4 py-3 text-sm"
          >
            <span className="min-w-0 text-[var(--text-dim)]">
              <span className="font-semibold text-[var(--text)]">
                {nameById[s.from_member] ?? "?"}
              </span>{" "}
              paid{" "}
              <span className="font-semibold text-[var(--text)]">
                {nameById[s.to_member] ?? "?"}
              </span>
              {s.note ? (
                <span className="block truncate text-xs text-[var(--text-faint)]">
                  {s.note}
                </span>
              ) : null}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="tnum font-semibold text-[var(--pos)]">
                {formatMoney(s.amount, currency)}
              </span>
              <button
                aria-label="Delete payment"
                onClick={() =>
                  onDeleteRequest(s.id, "Payment deleted", () =>
                    deleteSettlement(eventId, s.id),
                  )
                }
                className="pressable rounded-lg p-1.5 text-[var(--text-faint)] transition-colors hover:bg-[color-mix(in_srgb,var(--neg)_10%,transparent)] hover:text-[var(--neg)]"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ExpenseList({
  transactions,
  nameById,
  currency,
  eventId,
  onEdit,
  onDeleteRequest,
}: {
  transactions: Transaction[];
  nameById: Record<string, string>;
  currency: string;
  eventId: string;
  onEdit: (t: Transaction) => void;
  onDeleteRequest: (
    id: string,
    label: string,
    commit: () => Promise<unknown>,
  ) => void;
}) {
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
          <div className="flex items-center gap-1">
            <span className="tnum mr-1 font-semibold text-[var(--text)]">
              {formatMoney(t.amount, currency)}
            </span>
            <button
              aria-label="Edit expense"
              onClick={() => onEdit(t)}
              className="pressable rounded-lg p-1.5 text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              aria-label="Delete expense"
              onClick={() =>
                onDeleteRequest(t.id, "Expense deleted", () =>
                  deleteTransaction(eventId, t.id),
                )
              }
              className="pressable rounded-lg p-1.5 text-[var(--text-faint)] transition-colors hover:bg-[color-mix(in_srgb,var(--neg)_10%,transparent)] hover:text-[var(--neg)]"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </Card>
  );
}

function MembersCard({
  members,
  eventId,
  currentMemberId,
}: {
  members: Member[];
  eventId: string;
  currentMemberId: string | null;
}) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const confirmMember = members.find((m) => m.id === confirmId) ?? null;

  function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const name = newName;
    startTransition(async () => {
      const res = await addMember(eventId, name);
      if (res.ok) {
        setNewName("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function remove(id: string) {
    setConfirmId(null);
    setError(null);
    startTransition(async () => {
      const res = await removeMember(eventId, id);
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
              onClick={() => setConfirmId(m.id)}
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
          maxLength={40}
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
      <ConfirmDialog
        open={confirmMember !== null}
        title={confirmMember ? `Remove ${confirmMember.name}?` : "Remove member?"}
        message="They'll be removed from this event. Members tied to existing expenses can't be removed."
        confirmLabel="Remove"
        onConfirm={() => confirmId && remove(confirmId)}
        onCancel={() => setConfirmId(null)}
      />
    </Card>
  );
}
