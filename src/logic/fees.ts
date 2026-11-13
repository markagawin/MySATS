// Apps like Maya, GCash GCrypto and Coins.ph Convert don't charge a separate fee: their cut
// is built into the price they quote (the "spread"), and they don't publish it. It can be
// measured from a buy quote: compare the BTC the app offers for ₱X with what ₱X buys at the
// market price. Expressed the way the calculator applies fees (you get fee% less BTC).

import { calculateInvestment, priceNeededForGain } from './calculator.ts';

export interface FeeMeasurement {
  /** Fee as the calculator uses it: % of your pesos that doesn't become bitcoin. */
  feePct: number;
  /** The price you're effectively paying per BTC on that platform. */
  effectivePricePhp: number;
  /** BTC the same pesos would buy at the market price. */
  marketBtc: number;
}

export type MeasureResult =
  | { kind: 'ok'; measurement: FeeMeasurement }
  /** The quote gives more BTC than the market price would: numbers mistyped or the price moved. */
  | { kind: 'better-than-market'; measurement: FeeMeasurement }
  /** Over 20%: almost certainly a typo (e.g. a missing zero in the BTC amount). */
  | { kind: 'implausible'; measurement: FeeMeasurement }
  | { kind: 'invalid' };

export const MAX_PLAUSIBLE_FEE_PCT = 20;

export function measureFee(amountPhp: number, quotedBtc: number, marketPricePhp: number): MeasureResult {
  if (![amountPhp, quotedBtc, marketPricePhp].every((n) => Number.isFinite(n) && n > 0)) return { kind: 'invalid' };
  const marketBtc = amountPhp / marketPricePhp;
  const feePct = (1 - quotedBtc / marketBtc) * 100;
  const measurement: FeeMeasurement = {
    feePct: Math.round(feePct * 100) / 100,
    effectivePricePhp: Math.round(amountPhp / quotedBtc),
    marketBtc,
  };
  if (feePct < 0) return { kind: 'better-than-market', measurement };
  if (feePct > MAX_PLAUSIBLE_FEE_PCT) return { kind: 'implausible', measurement };
  return { kind: 'ok', measurement };
}

export interface FeeBreakdown {
  amountPhp: number;
  buyFeePhp: number;
  /** Pesos that actually became bitcoin. */
  investedPhp: number;
  sats: number;
  /** Selling the same sats at the sell price. */
  sellGrossPhp: number;
  sellFeePhp: number;
  /** What lands in your wallet after selling. */
  receivePhp: number;
  totalFeesPhp: number;
  /** Total fees as % of the amount. */
  totalFeesPct: number;
  /** BTC price where selling gives back exactly the amount (fees covered). */
  breakEvenPricePhp: number;
  /** % the price must rise from the buy price just to cover fees. */
  riseToCoverPct: number;
}

/** Where every peso goes when you buy, and sell at `sellPricePhp` (defaults to the buy price). */
export function feeBreakdown(
  amountPhp: number,
  feePct: number,
  buyPricePhp: number,
  sellPricePhp = buyPricePhp
): FeeBreakdown | null {
  const r = calculateInvestment({ amountPhp, buyPricePhp, targetPricePhp: sellPricePhp, feePct });
  const breakEven = priceNeededForGain(amountPhp, 0, buyPricePhp, feePct);
  if (!r || breakEven == null) return null;
  const totalFeesPhp = Math.round((r.buyFeePhp + r.sellFeePhp) * 100) / 100;
  return {
    amountPhp: r.amountPhp,
    buyFeePhp: r.buyFeePhp,
    investedPhp: r.investedPhp,
    sats: r.sats,
    sellGrossPhp: r.grossWorthPhp,
    sellFeePhp: r.sellFeePhp,
    receivePhp: r.worthPhp,
    totalFeesPhp,
    totalFeesPct: (totalFeesPhp / r.amountPhp) * 100,
    breakEvenPricePhp: breakEven,
    riseToCoverPct: ((breakEven - buyPricePhp) / buyPricePhp) * 100,
  };
}

/** Round-trip cost of buying and selling the same BTC (fee applied on both sides). */
export function roundTripPct(feePct: number): number {
  const f = feePct / 100;
  return (1 - (1 - f) * (1 - f)) * 100;
}
