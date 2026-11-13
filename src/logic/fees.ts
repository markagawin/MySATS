// Apps like Maya, GCash GCrypto and Coins.ph Convert don't charge a separate fee: their cut
// is built into the price they quote (the "spread"), and they don't publish it. It can be
// measured from a buy quote: compare the BTC the app offers for ₱X with what ₱X buys at the
// market price. Expressed the way the calculator applies fees (you get fee% less BTC).

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

/** Round-trip cost of buying and selling the same BTC (fee applied on both sides). */
export function roundTripPct(feePct: number): number {
  const f = feePct / 100;
  return (1 - (1 - f) * (1 - f)) * 100;
}
