// Bitcoin amounts are always integer satoshis and peso amounts are converted to integer
// centavos before any arithmetic, so results never pick up floating-point drift like
// 0.1 + 0.2 = 0.30000000000000004. Only the final value is turned back into pesos.

export const SATS_PER_BTC = 100_000_000;

/** Pesos → integer centavos (₱12.345 → 1235). */
export function toCentavos(php: number): number {
  return Math.round(php * 100);
}

/** Integer centavos → pesos. */
export function fromCentavos(centavos: number): number {
  return centavos / 100;
}

/** Round a peso amount to the nearest centavo. */
export function roundPhp(php: number): number {
  return fromCentavos(toCentavos(php));
}

export function btcToSats(btc: number): number {
  return Math.round(btc * SATS_PER_BTC);
}

export function satsToBtc(sats: number): number {
  return sats / SATS_PER_BTC;
}

/**
 * How many whole sats a peso amount buys at a given BTC price. Rounds DOWN, the way an
 * exchange credits you: you never receive a fraction of a satoshi.
 */
export function phpToSats(php: number, pricePhpPerBtc: number): number {
  if (!(php > 0) || !(pricePhpPerBtc > 0)) return 0;
  // centavos × 1e6 / price  ==  (centavos / 100) × 1e8 / price, kept in integers as long as possible.
  return Math.floor((toCentavos(php) * 1_000_000) / pricePhpPerBtc);
}

/** Peso value of some sats at a given BTC price, rounded to the nearest centavo. */
export function satsToPhp(sats: number, pricePhpPerBtc: number): number {
  if (!(sats > 0) || !(pricePhpPerBtc > 0)) return 0;
  // sats × price / 1e8 pesos  ==  sats × price / 1e6 centavos.
  return fromCentavos(Math.round((sats * pricePhpPerBtc) / 1_000_000));
}
