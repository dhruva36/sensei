import type { Balance, Transaction, Transfer } from "./types";
import { computeOwed } from "./splits";
import { fromCents } from "./money";

/**
 * Net balance per member, in integer cents.
 * Positive = the group owes this member (they fronted more than their share).
 * Negative = this member owes the group.
 *
 * Every member id passed in appears in the result (even with a zero balance),
 * so the UI can render everyone.
 */
export function computeBalances(
  transactions: Transaction[],
  memberIds: string[],
): Balance[] {
  const cents = new Map<string, number>();
  for (const id of memberIds) cents.set(id, 0);

  for (const txn of transactions) {
    const parts = txn.splits.map((s) => ({
      memberId: s.member_id,
      weight: s.weight,
    }));
    const owed = computeOwed(txn.amount, txn.split_type, parts);

    // The payer fronted the whole amount.
    const owedSum = owed.reduce((a, o) => a + o.owedCents, 0);
    cents.set(txn.paid_by, (cents.get(txn.paid_by) ?? 0) + owedSum);

    // Each participant owes their share.
    for (const o of owed) {
      cents.set(o.memberId, (cents.get(o.memberId) ?? 0) - o.owedCents);
    }
  }

  return memberIds.map((id) => ({
    memberId: id,
    amount: fromCents(cents.get(id) ?? 0),
  }));
}

/**
 * Compute a near-minimal set of transfers that settles all balances.
 *
 * Uses the well-known greedy "largest creditor pays off largest debtor"
 * heuristic: repeatedly match the member owed the most with the member who owes
 * the most, transferring min(credit, debt) between them. Finding the provably
 * minimal number of transfers is NP-hard (it reduces to subset-sum), but this
 * greedy approach is what Splitwise-style apps use and is optimal or near-optimal
 * in practice. Works entirely in integer cents to avoid drift.
 */
export function minimizeTransfers(balances: Balance[]): Transfer[] {
  const creditors = balances
    .map((b) => ({ id: b.memberId, cents: Math.round(b.amount * 100) }))
    .filter((b) => b.cents > 0);
  const debtors = balances
    .map((b) => ({ id: b.memberId, cents: -Math.round(b.amount * 100) }))
    .filter((b) => b.cents > 0);

  const transfers: Transfer[] = [];

  // Always settle the largest amounts first.
  creditors.sort((a, b) => b.cents - a.cents);
  debtors.sort((a, b) => b.cents - a.cents);

  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const credit = creditors[ci];
    const debt = debtors[di];
    const amount = Math.min(credit.cents, debt.cents);

    if (amount > 0) {
      transfers.push({ from: debt.id, to: credit.id, amount: fromCents(amount) });
    }

    credit.cents -= amount;
    debt.cents -= amount;

    if (credit.cents === 0) ci++;
    if (debt.cents === 0) di++;
  }

  return transfers;
}

/** Convenience: balances + settlement in one call. */
export function settle(transactions: Transaction[], memberIds: string[]) {
  const balances = computeBalances(transactions, memberIds);
  const transfers = minimizeTransfers(balances);
  return { balances, transfers };
}
