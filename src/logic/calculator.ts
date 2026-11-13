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

/** Bitcoin you already own: from the Log, or typed in from an exchange app. */
export interface Holdings {
  sats: number;
  /** What you paid for it in total. */
  costPhp: number;
}

export interface CombinedResult {
  existingSats: number;
  /** Sats from the new buy (0 when you're only valuing what you have). */
  newSats: number;
  totalSats: number;
  /** Existing cost + new amount. */
  totalCostPhp: number;
  /** Everything sold at the target price, after the sell fee. */
  worthPhp: number;
  gainPhp: number;
  gainPct: number;
  /** BTC price at which selling everything gets back exactly what you put in (fees included). */
  breakEvenPricePhp: number;
}

/**
 * "I already have this much bitcoin. If I add ₱X at the buy price, what is ALL of it worth at
 * the target price?" The amount may be 0 to value only what you have. The sell fee applies to
 * everything sold; the buy fee only to the new pesos. Null when inputs are invalid.
 */
export function calculateWithHoldings(input: InvestInput, holdings: Holdings): CombinedResult | null {
  const { sats: existingSats, costPhp } = holdings;
  if (!(Number.isInteger(existingSats) && existingSats > 0) || !(costPhp >= 0) || !Number.isFinite(costPhp)) return null;
  if (!(input.targetPricePhp > 0) || !Number.isFinite(input.targetPricePhp) || !(input.feePct >= 0 && input.feePct < 100)) {
    return null;
  }

  const adding = input.amountPhp > 0;
  const newPart = adding ? calculateInvestment(input) : null;
  if (adding && !newPart) return null;

  const existingGrossC = toCentavos(satsToPhp(existingSats, input.targetPricePhp));
  const existingWorthC = existingGrossC - Math.round((existingGrossC * input.feePct) / 100);
  const worthC = existingWorthC + (newPart ? toCentavos(newPart.worthPhp) : 0);
  const totalCostC = toCentavos(costPhp) + (newPart ? toCentavos(newPart.amountPhp) : 0);
  const totalSats = existingSats + (newPart?.sats ?? 0);
  const gainC = worthC - totalCostC;

  return {
    existingSats,
    newSats: newPart?.sats ?? 0,
    totalSats,
    totalCostPhp: fromCentavos(totalCostC),
    worthPhp: fromCentavos(worthC),
    gainPhp: fromCentavos(gainC),
    gainPct: totalCostC > 0 ? (gainC / totalCostC) * 100 : 0,
    breakEvenPricePhp: Math.ceil((fromCentavos(totalCostC) * SATS_PER_BTC) / (totalSats * (1 - input.feePct / 100))),
  };
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
