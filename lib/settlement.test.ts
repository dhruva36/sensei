import { describe, it, expect } from "vitest";
import { computeOwed } from "./splits";
import { computeBalances, minimizeTransfers, settle } from "./settlement";
import { distributeCents } from "./money";
import type { Settlement, Transaction } from "./types";

function txn(partial: Partial<Transaction> & Pick<Transaction, "amount" | "paid_by" | "split_type" | "splits">): Transaction {
  return {
    id: "t",
    trip_id: "trip",
    description: "x",
    created_at: "",
    ...partial,
  } as Transaction;
}

function settlement(
  from: string,
  to: string,
  amount: number,
): Settlement {
  return {
    id: `${from}-${to}-${amount}`,
    trip_id: "trip",
    from_member: from,
    to_member: to,
    amount,
    note: null,
    created_at: "",
  };
}

// Alice pays 90 for an equal dinner among a, b, c -> a:+60, b:-30, c:-30.
const dinner = txn({
  amount: 90,
  paid_by: "a",
  split_type: "equal",
  splits: [
    { id: "1", transaction_id: "t", member_id: "a", weight: 1 },
    { id: "2", transaction_id: "t", member_id: "b", weight: 1 },
    { id: "3", transaction_id: "t", member_id: "c", weight: 1 },
  ],
});

describe("distributeCents", () => {
  it("splits evenly with no remainder", () => {
    expect(distributeCents(900, [1, 1, 1])).toEqual([300, 300, 300]);
  });

  it("hands leftover cents to largest remainders, summing exactly", () => {
    // 1000 / 3 = 333.33 each -> [334, 333, 333]
    const r = distributeCents(1000, [1, 1, 1]);
    expect(r.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(r.filter((c) => c === 334).length).toBe(1);
  });

  it("respects weights", () => {
    expect(distributeCents(1000, [1, 3])).toEqual([250, 750]);
  });
});

describe("computeOwed", () => {
  it("equal split sums to total", () => {
    const r = computeOwed(100, "equal", [
      { memberId: "a", weight: 1 },
      { memberId: "b", weight: 1 },
      { memberId: "c", weight: 1 },
    ]);
    expect(r.reduce((s, o) => s + o.owedCents, 0)).toBe(10000);
  });

  it("share split is proportional", () => {
    const r = computeOwed(120, "share", [
      { memberId: "a", weight: 1 },
      { memberId: "b", weight: 2 },
    ]);
    expect(r).toEqual([
      { memberId: "a", owedCents: 4000 },
      { memberId: "b", owedCents: 8000 },
    ]);
  });

  it("amount split must equal the total", () => {
    expect(() =>
      computeOwed(100, "amount", [
        { memberId: "a", weight: 60 },
        { memberId: "b", weight: 30 },
      ]),
    ).toThrow();

    const ok = computeOwed(100, "amount", [
      { memberId: "a", weight: 60 },
      { memberId: "b", weight: 40 },
    ]);
    expect(ok).toEqual([
      { memberId: "a", owedCents: 6000 },
      { memberId: "b", owedCents: 4000 },
    ]);
  });
});

describe("computeBalances", () => {
  it("3 friends, one pays for an equal dinner", () => {
    // Alice pays 90 for a dinner split equally among a, b, c.
    const transactions = [
      txn({
        amount: 90,
        paid_by: "a",
        split_type: "equal",
        splits: [
          { id: "1", transaction_id: "t", member_id: "a", weight: 1 },
          { id: "2", transaction_id: "t", member_id: "b", weight: 1 },
          { id: "3", transaction_id: "t", member_id: "c", weight: 1 },
        ],
      }),
    ];
    const balances = computeBalances(transactions, ["a", "b", "c"]);
    const byId = Object.fromEntries(balances.map((b) => [b.memberId, b.amount]));
    // Alice fronted 90, owed 30 -> +60. b and c owe 30 each.
    expect(byId.a).toBeCloseTo(60);
    expect(byId.b).toBeCloseTo(-30);
    expect(byId.c).toBeCloseTo(-30);
    // Balances always net to zero.
    expect(balances.reduce((s, b) => s + b.amount, 0)).toBeCloseTo(0);
  });
});

describe("minimizeTransfers", () => {
  it("already settled -> no transfers", () => {
    const balances = [
      { memberId: "a", amount: 0 },
      { memberId: "b", amount: 0 },
    ];
    expect(minimizeTransfers(balances)).toEqual([]);
  });

  it("simple two-party debt", () => {
    const balances = [
      { memberId: "a", amount: 60 },
      { memberId: "b", amount: -30 },
      { memberId: "c", amount: -30 },
    ];
    const transfers = minimizeTransfers(balances);
    expect(transfers.length).toBe(2);
    // both b and c pay a
    expect(transfers.every((t) => t.to === "a")).toBe(true);
    expect(transfers.reduce((s, t) => s + t.amount, 0)).toBeCloseTo(60);
  });

  it("collapses chains into fewer transfers", () => {
    // a owes 10, b is even (paid then owed), c is owed 10 -> 1 transfer, not 2.
    const balances = [
      { memberId: "a", amount: -10 },
      { memberId: "b", amount: 0 },
      { memberId: "c", amount: 10 },
    ];
    const transfers = minimizeTransfers(balances);
    expect(transfers).toEqual([{ from: "a", to: "c", amount: 10 }]);
  });
});

describe("recorded settlements", () => {
  const ids = ["a", "b", "c"];

  it("a full payment of a suggested transfer zeroes both parties", () => {
    // b owes a 30; record b -> a 30.
    const { balances, transfers } = settle([dinner], ids, [
      settlement("b", "a", 30),
    ]);
    const byId = Object.fromEntries(balances.map((x) => [x.memberId, x.amount]));
    expect(byId.b).toBeCloseTo(0);
    expect(byId.a).toBeCloseTo(30); // a still owed 30 by c
    expect(byId.c).toBeCloseTo(-30);
    // Only c -> a remains.
    expect(transfers).toEqual([{ from: "c", to: "a", amount: 30 }]);
  });

  it("paying everyone off leaves nothing outstanding", () => {
    const { transfers } = settle([dinner], ids, [
      settlement("b", "a", 30),
      settlement("c", "a", 30),
    ]);
    expect(transfers).toEqual([]);
  });

  it("a partial payment leaves the residual transfer", () => {
    // b owes a 30; pay only 10 -> b still owes 20.
    const { balances } = settle([dinner], ids, [settlement("b", "a", 10)]);
    const byId = Object.fromEntries(balances.map((x) => [x.memberId, x.amount]));
    expect(byId.b).toBeCloseTo(-20);
    expect(byId.a).toBeCloseTo(50); // owed 60, received 10
  });

  it("over-payment flips the sign (payer becomes a creditor)", () => {
    // b owes a 30 but pays 50 -> b is now owed 20; a was owed 60, nets to 10.
    const { balances } = settle([dinner], ids, [settlement("b", "a", 50)]);
    const byId = Object.fromEntries(balances.map((x) => [x.memberId, x.amount]));
    expect(byId.b).toBeCloseTo(20);
    expect(byId.a).toBeCloseTo(10);
    expect(byId.c).toBeCloseTo(-30);
    // Net stays zero.
    expect(balances.reduce((s, x) => s + x.amount, 0)).toBeCloseTo(0);
  });
});

describe("settle end-to-end", () => {
  it("transfers exactly clear all balances", () => {
    const transactions = [
      txn({
        amount: 60,
        paid_by: "a",
        split_type: "equal",
        splits: [
          { id: "1", transaction_id: "t", member_id: "a", weight: 1 },
          { id: "2", transaction_id: "t", member_id: "b", weight: 1 },
          { id: "3", transaction_id: "t", member_id: "c", weight: 1 },
        ],
      }),
      txn({
        amount: 30,
        paid_by: "b",
        split_type: "share",
        splits: [
          { id: "4", transaction_id: "t2", member_id: "a", weight: 1 },
          { id: "5", transaction_id: "t2", member_id: "c", weight: 2 },
        ],
      }),
    ];
    const ids = ["a", "b", "c"];
    const { balances, transfers } = settle(transactions, ids);

    // Apply the transfers and confirm everyone ends at zero.
    const net = new Map(balances.map((b) => [b.memberId, b.amount]));
    for (const t of transfers) {
      net.set(t.from, (net.get(t.from) ?? 0) + t.amount);
      net.set(t.to, (net.get(t.to) ?? 0) - t.amount);
    }
    for (const id of ids) {
      expect(net.get(id) ?? 0).toBeCloseTo(0);
    }
  });
});
