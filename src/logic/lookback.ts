import type { PricePoint } from '../types.ts';

// Answers "what did I buy at?" from CoinGecko's daily price history: one ₱ price per day,
// taken at 00:00 UTC (8:00 AM Philippine time). The free API only covers the past 365 days.

export const LOOKBACK_DAYS = 365;

/** UTC calendar date (YYYY-MM-DD) of a point, which is also its Philippine date at 8 AM. */
export function pointDate(p: PricePoint): string {
  return new Date(p.t).toISOString().slice(0, 10);
}

export type PriceOnDate =
  | { kind: 'found'; date: string; pricePhp: number }
  | { kind: 'too-old'; earliest: string }
  | { kind: 'future' }
  | { kind: 'no-data' };

/** The daily BTC price for a date. Uses the first point of that day, so "today" means this morning's price. */
export function priceOnDate(points: PricePoint[], isoDate: string): PriceOnDate {
  if (points.length === 0) return { kind: 'no-data' };
  const earliest = pointDate(points[0]);
  const latest = pointDate(points[points.length - 1]);
  if (isoDate < earliest) return { kind: 'too-old', earliest };
  if (isoDate > latest) return { kind: 'future' };
  // Exact day, or the closest earlier day if CoinGecko skipped one.
  let best: PricePoint | null = null;
  for (const p of points) {
    const d = pointDate(p);
    if (d > isoDate) break;
    if (!best || pointDate(best) !== d) best = p;
  }
  return best ? { kind: 'found', date: pointDate(best), pricePhp: Math.round(best.php) } : { kind: 'no-data' };
}

/**
 * The BTC price you must have bought at, given what you put in and how much you're down
 * now. Value today = amount − loss, and value scales with price, so
 * buy price = today's price × amount ÷ value today. Null when the inputs can't be right
 * (nothing invested, or a loss as big as the whole amount).
 */
export function impliedBuyPrice(amountPhp: number, lossPhp: number, currentPricePhp: number): number | null {
  if (!(amountPhp > 0) || !(lossPhp >= 0) || !(currentPricePhp > 0)) return null;
  const valueNow = amountPhp - lossPhp;
  if (!(valueNow > 0)) return null;
  return Math.round((currentPricePhp * amountPhp) / valueNow);
}

/**
 * Exact average buy price from what an exchange app shows under "My portfolio":
 * total cost ÷ bitcoin held (e.g. Maya: ₱39,999.99 for 0.007002941 BTC ≈ ₱5,711,884).
 * Null when either is missing or zero.
 */
export function averageBuyPrice(totalCostPhp: number, btcHeld: number): number | null {
  if (!(totalCostPhp > 0) || !(btcHeld > 0) || !Number.isFinite(totalCostPhp) || !Number.isFinite(btcHeld)) return null;
  return Math.round(totalCostPhp / btcHeld);
}

export interface PriceRange {
  from: string;
  to: string;
  lowPhp: number;
  highPhp: number;
}

/**
 * Stretches of days when BTC traded within ±tolerancePct of a price, newest first. Days next
 * to each other are merged into one range ("Oct 2 – Oct 9").
 */
export function datesNearPrice(points: PricePoint[], targetPhp: number, tolerancePct = 2, limit = 5): PriceRange[] {
  if (!(targetPhp > 0)) return [];
  const lo = targetPhp * (1 - tolerancePct / 100);
  const hi = targetPhp * (1 + tolerancePct / 100);

  // One price per calendar day (first point of the day).
  const daily: { date: string; php: number }[] = [];
  for (const p of points) {
    const date = pointDate(p);
    if (daily.length && daily[daily.length - 1].date === date) continue;
    daily.push({ date, php: p.php });
  }

  const ranges: PriceRange[] = [];
  let current: PriceRange | null = null;
  let prevIndex = -2;
  daily.forEach((d, i) => {
    if (d.php < lo || d.php > hi) return;
    if (current && i === prevIndex + 1) {
      current.to = d.date;
      current.lowPhp = Math.min(current.lowPhp, Math.round(d.php));
      current.highPhp = Math.max(current.highPhp, Math.round(d.php));
    } else {
      current = { from: d.date, to: d.date, lowPhp: Math.round(d.php), highPhp: Math.round(d.php) };
      ranges.push(current);
    }
    prevIndex = i;
  });
  return ranges.reverse().slice(0, limit);
}

/** Highest daily price in the history, for context ("BTC peaked at ₱X on …"). */
export function highestPoint(points: PricePoint[]): { date: string; pricePhp: number } | null {
  if (points.length === 0) return null;
  const top = points.reduce((a, b) => (b.php > a.php ? b : a));
  return { date: pointDate(top), pricePhp: Math.round(top.php) };
}

/** % BTC has to rise from today's price to get back to the buy price (negative if already above). */
export function riseNeededPct(buyPricePhp: number, currentPricePhp: number): number {
  return ((buyPricePhp - currentPricePhp) / currentPricePhp) * 100;
}
