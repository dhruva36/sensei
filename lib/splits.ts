import type { SplitType } from "./types";
import { distributeCents, toCents } from "./money";

export type SplitPart = {
  memberId: string;
  /**
   * Meaning depends on `splitType`:
   *   equal  -> ignored (everyone listed shares equally)
   *   amount -> the exact money this member owes (same unit as `amount`)
   *   share  -> relative weight / percentage
   */
  weight: number;
};

export type OwedResult = {
  memberId: string;
  owedCents: number;
};

/**
 * Given an expense total, its split type, and the participating members,
 * return how much each member owes — in integer cents, summing exactly to the
 * total (for equal/share). Throws on invalid input so callers can surface a
 * clear error.
 */
export function computeOwed(
  amount: number,
  splitType: SplitType,
  parts: SplitPart[],
): OwedResult[] {
  if (parts.length === 0) {
    throw new Error("An expense must be split between at least one member.");
  }

  const totalCents = toCents(amount);
  if (totalCents <= 0) {
    throw new Error("Expense amount must be greater than zero.");
  }

  switch (splitType) {
    case "equal": {
      const cents = distributeCents(
        totalCents,
        parts.map(() => 1),
      );
      return parts.map((p, i) => ({ memberId: p.memberId, owedCents: cents[i] }));
    }

    case "share": {
      const weights = parts.map((p) => p.weight);
      if (weights.some((w) => w < 0)) {
        throw new Error("Shares cannot be negative.");
      }
      if (weights.reduce((a, b) => a + b, 0) <= 0) {
        throw new Error("At least one member must have a positive share.");
      }
      const cents = distributeCents(totalCents, weights);
      return parts.map((p, i) => ({ memberId: p.memberId, owedCents: cents[i] }));
    }

    case "amount": {
      const cents = parts.map((p) => toCents(p.weight));
      if (cents.some((c) => c < 0)) {
        throw new Error("Custom amounts cannot be negative.");
      }
      const sum = cents.reduce((a, b) => a + b, 0);
      if (sum !== totalCents) {
        throw new Error(
          `Custom amounts must add up to the total (${(totalCents / 100).toFixed(
            2,
          )}). They currently add up to ${(sum / 100).toFixed(2)}.`,
        );
      }
      return parts.map((p, i) => ({ memberId: p.memberId, owedCents: cents[i] }));
    }

    default: {
      const _exhaustive: never = splitType;
      throw new Error(`Unknown split type: ${_exhaustive}`);
    }
  }
}
