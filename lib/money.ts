/** Money is handled in integer cents internally to avoid floating-point drift. */

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Split `totalCents` across the given `weights`, returning an integer-cent array
 * that sums EXACTLY to `totalCents`. Leftover cents from rounding are handed to
 * the entries with the largest fractional remainder (largest-remainder method),
 * so no cent is ever lost or invented.
 */
export function distributeCents(totalCents: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];

  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);

  const raw = weights.map((w) => (totalCents * w) / sum);
  const floors = raw.map((r) => Math.floor(r));
  const distributed = floors.reduce((a, b) => a + b, 0);
  let remainder = totalCents - distributed;

  const result = floors.slice();
  const byFraction = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);

  for (let k = 0; remainder > 0 && k < n; k++, remainder--) {
    result[byFraction[k].i] += 1;
  }
  return result;
}

export function formatMoney(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    // Unknown currency code — fall back to a plain fixed-decimal string.
    return `${currency} ${amount.toFixed(2)}`;
  }
}
