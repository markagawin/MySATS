import type { Trade } from '../types.ts';
import { fromCentavos, satsToPhp, SATS_PER_BTC, toCentavos } from './units.ts';

export interface Portfolio {
  holdingsSats: number;
  /** Remaining cost basis of the sats you still hold (average-cost method). */
  costBasisPhp: number;
  /** ₱ per 1 BTC you paid on average for what you still hold. 0 when you hold nothing. */
  avgCostPhpPerBtc: number;
  /** Every peso spent on buys, fees included. */
  totalInvestedPhp: number;
  /** Profit or loss already locked in by sells. */
  realizedPhp: number;
  /** IDs of sells/sends that tried to remove more sats than you held at the time. */
  oversoldTradeIds: string[];
}

/** Oldest first; same-day trades in the order they were logged. */
export function sortTradesChronologically(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) =>
    a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1
  );
}

/**
 * Replays every trade in date order using the average-cost method:
 * - buy: adds sats; cost basis grows by price paid + fee.
 * - receive: adds sats; cost basis grows by what you say it cost (0 for a gift).
 * - sell: removes sats and the matching share of cost basis; proceeds − fee − that cost is realized profit.
 * - send: removes sats and the matching share of cost basis, with no profit or loss (a gift, a payment,
 *   or a network fee when moving coins between your own wallets).
 * A sell or send larger than your holdings at that moment is capped at what you held and flagged.
 */
export function computePortfolio(trades: Trade[]): Portfolio {
  let sats = 0;
  let costC = 0;
  let investedC = 0;
  let realizedC = 0;
  const oversoldTradeIds: string[] = [];

  for (const t of sortTradesChronologically(trades)) {
    const amountC = toCentavos(t.amountPhp || 0);
    const feeC = toCentavos(t.feePhp || 0);

    if (t.type === 'buy') {
      sats += t.sats;
      costC += amountC + feeC;
      investedC += amountC + feeC;
    } else if (t.type === 'receive') {
      sats += t.sats;
      costC += amountC + feeC;
    } else {
      let removed = t.sats;
      if (removed > sats) {
        oversoldTradeIds.push(t.id);
        removed = sats;
      }
      const costRemovedC = sats > 0 ? Math.round((costC * removed) / sats) : 0;
      if (t.type === 'sell') {
        // If the sell was capped, scale proceeds down to the part that was actually covered.
        const coveredFraction = t.sats > 0 ? removed / t.sats : 0;
        const proceedsC = Math.round((amountC - feeC) * coveredFraction);
        realizedC += proceedsC - costRemovedC;
      }
      sats -= removed;
      costC -= costRemovedC;
    }
  }

  return {
    holdingsSats: sats,
    costBasisPhp: fromCentavos(costC),
    avgCostPhpPerBtc: sats > 0 ? Math.round((fromCentavos(costC) * SATS_PER_BTC) / sats) : 0,
    totalInvestedPhp: fromCentavos(investedC),
    realizedPhp: fromCentavos(realizedC),
    oversoldTradeIds,
  };
}

export interface Valuation {
  valuePhp: number;
  unrealizedPhp: number;
  /** Unrealized gain as % of remaining cost basis; null when cost basis is 0 (e.g. only gifts). */
  unrealizedPct: number | null;
}

export function valuePortfolio(p: Portfolio, pricePhpPerBtc: number): Valuation {
  const valuePhp = satsToPhp(p.holdingsSats, pricePhpPerBtc);
  const unrealizedC = toCentavos(valuePhp) - toCentavos(p.costBasisPhp);
  return {
    valuePhp,
    unrealizedPhp: fromCentavos(unrealizedC),
    unrealizedPct: p.costBasisPhp > 0 ? (fromCentavos(unrealizedC) / p.costBasisPhp) * 100 : null,
  };
}

/** Sats available to sell or send as of `date`, counting only trades on or before it (excluding `ignoreId`, for edits). */
export function holdingsAsOf(trades: Trade[], date: string, ignoreId?: string): number {
  const relevant = trades.filter((t) => t.id !== ignoreId && t.date <= date);
  return computePortfolio(relevant).holdingsSats;
}
