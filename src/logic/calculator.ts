import { fromCentavos, phpToSats, satsToPhp, SATS_PER_BTC, toCentavos } from './units.ts';

export interface InvestInput {
  /** Pesos you put in, before fees. */
  amountPhp: number;
  /** BTC price you buy at (₱ per 1 BTC). */
  buyPricePhp: number;
  /** BTC price you imagine selling at (₱ per 1 BTC). */
  targetPricePhp: number;
  /** Exchange fee %, charged once when buying and once when selling. 0 for none. */
  feePct: number;
}

export interface InvestResult {
  amountPhp: number;
  buyFeePhp: number;
  /** Pesos that actually went into bitcoin after the buy fee. */
  investedPhp: number;
  sats: number;
  /** Value of the sats at the target price, before the sell fee. */
  grossWorthPhp: number;
  sellFeePhp: number;
  /** What you'd walk away with after the sell fee. */
  worthPhp: number;
  gainPhp: number;
  gainPct: number;
}

function isValidInput(input: InvestInput): boolean {
  return (
    input.amountPhp > 0 &&
    input.buyPricePhp > 0 &&
    input.targetPricePhp > 0 &&
    input.feePct >= 0 &&
    input.feePct < 100 &&
    Number.isFinite(input.amountPhp) &&
    Number.isFinite(input.buyPricePhp) &&
    Number.isFinite(input.targetPricePhp)
  );
}

/** "If I put ₱X in at price A, what do I get, and what is it worth at price B?" Null when any input is missing or invalid. */
export function calculateInvestment(input: InvestInput): InvestResult | null {
  if (!isValidInput(input)) return null;

  const amountC = toCentavos(input.amountPhp);
  const buyFeeC = Math.round((amountC * input.feePct) / 100);
  const investedC = amountC - buyFeeC;
  const sats = phpToSats(fromCentavos(investedC), input.buyPricePhp);

  const grossC = toCentavos(satsToPhp(sats, input.targetPricePhp));
  const sellFeeC = Math.round((grossC * input.feePct) / 100);
  const worthC = grossC - sellFeeC;
  const gainC = worthC - amountC;

  return {
    amountPhp: fromCentavos(amountC),
    buyFeePhp: fromCentavos(buyFeeC),
    investedPhp: fromCentavos(investedC),
    sats,
    grossWorthPhp: fromCentavos(grossC),
    sellFeePhp: fromCentavos(sellFeeC),
    worthPhp: fromCentavos(worthC),
    gainPhp: fromCentavos(gainC),
    gainPct: (gainC / amountC) * 100,
  };
}

/**
 * "What BTC price do I need to earn ₱goal on top of my ₱amount?" Rounded UP to the next
 * whole peso, so hitting that price is always enough. Null when inputs are invalid or the
 * amount is too small to buy a single sat.
 */
export function priceNeededForGain(
  amountPhp: number,
  goalPhp: number,
  buyPricePhp: number,
  feePct: number
): number | null {
  if (!(goalPhp >= 0) || !Number.isFinite(goalPhp)) return null;
  const base = calculateInvestment({ amountPhp, buyPricePhp, targetPricePhp: buyPricePhp, feePct });
  if (!base || base.sats === 0) return null;
  const neededWorthPhp = amountPhp + goalPhp;
  const neededGrossPhp = neededWorthPhp / (1 - feePct / 100);
  return Math.ceil((neededGrossPhp * SATS_PER_BTC) / base.sats);
}

export interface Scenario {
  label: string;
  /** Target price ÷ buy price, e.g. 1.25 for +25%. */
  multiplier: number;
  targetPricePhp: number;
  result: InvestResult;
}

export const SCENARIO_MULTIPLIERS: { label: string; multiplier: number }[] = [
  { label: '−20%', multiplier: 0.8 },
  { label: '−10%', multiplier: 0.9 },
  { label: '+10%', multiplier: 1.1 },
  { label: '+25%', multiplier: 1.25 },
  { label: '+50%', multiplier: 1.5 },
  { label: '2×', multiplier: 2 },
];

/** The same investment evaluated at a fixed set of target prices around the buy price. */
export function buildScenarios(
  amountPhp: number,
  buyPricePhp: number,
  feePct: number,
  multipliers = SCENARIO_MULTIPLIERS
): Scenario[] {
  const out: Scenario[] = [];
  for (const { label, multiplier } of multipliers) {
    const targetPricePhp = Math.round(buyPricePhp * multiplier);
    const result = calculateInvestment({ amountPhp, buyPricePhp, targetPricePhp, feePct });
    if (result) out.push({ label, multiplier, targetPricePhp, result });
  }
  return out;
}
