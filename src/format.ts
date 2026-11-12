import type { AmountUnit } from './types';
import { SATS_PER_BTC } from './logic/units.ts';

const groupThousands = (intPart: string) => intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** ₱1,234,567.89 (negative: -₱1,234.00). */
export function formatPeso(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const [intPart, decPart] = Math.abs(amount).toFixed(2).split('.');
  return `${sign}₱${groupThousands(intPart)}.${decPart}`;
}

/** Whole pesos, no decimals: ₱6,000,000. For BTC prices, where centavos are noise. */
export function formatPesoWhole(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}₱${groupThousands(String(Math.round(Math.abs(amount))))}`;
}

/** ₱6.0M / ₱850K, for tight spaces like history rows. */
export function formatPesoShort(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}₱${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
  if (abs >= 10_000) return `${sign}₱${Math.round(abs / 1000)}K`;
  return formatPesoWhole(amount);
}

/** +₱12,499.98 / -₱10,000.02 / ₱0.00 */
export function formatSignedPeso(amount: number): string {
  return amount > 0 ? `+${formatPeso(amount)}` : formatPeso(amount);
}

export function formatSats(sats: number): string {
  return `${groupThousands(String(Math.trunc(sats)))} sats`;
}

/** Built from the integer, so 833,333 sats is exactly "0.00833333 BTC", never 0.008333329999. */
export function formatBtc(sats: number): string {
  const sign = sats < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(sats));
  const whole = Math.floor(abs / SATS_PER_BTC);
  const frac = String(abs % SATS_PER_BTC).padStart(8, '0');
  return `${sign}${groupThousands(String(whole))}.${frac} BTC`;
}

export function formatAmount(sats: number, unit: AmountUnit): string {
  return unit === 'btc' ? formatBtc(sats) : formatSats(sats);
}

/** The amount in the unit you didn't pick, for a secondary line. */
export function formatAmountAlt(sats: number, unit: AmountUnit): string {
  return unit === 'btc' ? formatSats(sats) : formatBtc(sats);
}

export function formatPct(pct: number, signed = true): string {
  const s = `${Math.abs(pct).toFixed(2)}%`;
  // Anything that rounds to 0.00% shows no sign, never "-0.00%".
  if (!signed || s === '0.00%') return s;
  return pct > 0 ? `+${s}` : pct < 0 ? `-${s}` : s;
}

export function formatUsd(amount: number): string {
  return `$${groupThousands(String(Math.round(amount)))}`;
}

/** "50,000.5" → 50000.5; empty or junk → NaN. */
export function parseNumberInput(text: string): number {
  const cleaned = text.replace(/[₱,\s]/g, '');
  if (cleaned === '' || cleaned === '.') return NaN;
  return /^\d*\.?\d*$/.test(cleaned) ? Number(cleaned) : NaN;
}

/**
 * Keeps a numeric text field readable while typing: digits only, one dot, at most
 * `decimals` decimals, and thousands separators in the integer part.
 */
export function formatNumberInput(text: string, decimals = 2): string {
  let cleaned = text.replace(/[^\d.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
  }
  if (decimals === 0) cleaned = cleaned.replace('.', '');
  let [intPart, decPart] = cleaned.split('.');
  intPart = intPart.replace(/^0+(?=\d)/, '');
  const grouped = groupThousands(intPart);
  if (decPart === undefined) return grouped;
  return `${grouped === '' ? '0' : grouped}.${decPart.slice(0, decimals)}`;
}

/** A number as it should appear pre-filled in an input (no trailing .00). */
export function numberToInput(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return '';
  const fixed = Number(n.toFixed(decimals)).toString();
  return formatNumberInput(fixed, decimals);
}

export function relativeTime(fromMs: number, nowMs = Date.now()): string {
  const s = Math.max(0, Math.round((nowMs - fromMs) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Local date as YYYY-MM-DD. */
export function toIsoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export const todayIso = () => toIsoDate(new Date());

export function yesterdayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toIsoDate(d);
}

/** True for a real calendar date in YYYY-MM-DD form (rejects 2026-02-30). */
export function isValidIsoDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
}

/** "2026-11-12" → "Nov 12, 2026" */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** "2026-11-12" → "Nov 12" */
export function formatDayShort(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

/** "2026-11" → "November 2026" */
export function formatMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}
