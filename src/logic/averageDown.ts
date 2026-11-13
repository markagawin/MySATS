// "Averaging down": buying more at today's (lower) price to bring the average buy price
// down, so BTC needs to rise less before the whole position is back to even. It does not
// remove the current peso loss; it only changes how far the price has to recover.

export interface Position {
  /** Bitcoin you hold now (may have more than 8 decimals, as Maya shows 9). */
  heldBtc: number;
  /** Everything you paid for it, in pesos. */
  costPhp: number;
  /** Today's BTC price, ₱ per 1 BTC. */
  pricePhp: number;
}

export interface AfterBuying {
  addPhp: number;
  totalBtc: number;
  totalCostPhp: number;
  /** New average buy price = your break-even price. */
  avgPricePhp: number;
  /** % BTC must rise from today's price to reach the new break-even. */
  riseNeededPct: number;
  /** Peso gain/loss right after buying: unchanged by the purchase (ignoring fees). */
  unrealizedPhp: number;
}

function valid(p: Position): boolean {
  return p.heldBtc > 0 && p.costPhp > 0 && p.pricePhp > 0 && [p.heldBtc, p.costPhp, p.pricePhp].every(Number.isFinite);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The position after buying ₱addPhp more at today's price. Null for invalid input. */
export function afterBuyingMore(p: Position, addPhp: number): AfterBuying | null {
  if (!valid(p) || !(addPhp >= 0) || !Number.isFinite(addPhp)) return null;
  const totalBtc = p.heldBtc + addPhp / p.pricePhp;
  const totalCostPhp = p.costPhp + addPhp;
  const avgPricePhp = Math.round(totalCostPhp / totalBtc);
  return {
    addPhp: round2(addPhp),
    totalBtc,
    totalCostPhp: round2(totalCostPhp),
    avgPricePhp,
    riseNeededPct: ((avgPricePhp - p.pricePhp) / p.pricePhp) * 100,
    unrealizedPhp: round2(totalBtc * p.pricePhp - totalCostPhp),
  };
}

export type AddNeeded =
  | { kind: 'amount'; addPhp: number }
  /** Your break-even is already at or below that price; nothing to add. */
  | { kind: 'already' }
  /** At or below today's price: buying at today's price can never pull the average that low. */
  | { kind: 'unreachable' }
  | { kind: 'invalid' };

/**
 * How much to buy at today's price so the average buy price becomes `targetAvgPhp`.
 * Solves (cost + A) / (held + A / price) = target  →  A = (target·held − cost) / (1 − target/price).
 * Rounded UP to the next peso so the average lands at or below the target.
 */
export function addNeededForBreakEven(p: Position, targetAvgPhp: number): AddNeeded {
  if (!valid(p) || !(targetAvgPhp > 0) || !Number.isFinite(targetAvgPhp)) return { kind: 'invalid' };
  // Compare with the average as the app displays it (whole pesos), so typing the shown
  // break-even back in says "already there" instead of "add ₱1".
  const currentAvg = Math.round(p.costPhp / p.heldBtc);
  if (targetAvgPhp >= currentAvg) return { kind: 'already' };
  if (targetAvgPhp <= p.pricePhp) return { kind: 'unreachable' };
  const add = (targetAvgPhp * p.heldBtc - p.costPhp) / (1 - targetAvgPhp / p.pricePhp);
  return { kind: 'amount', addPhp: Math.ceil(add) };
}
