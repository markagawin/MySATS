import type { PricePoint, PriceQuote } from '../types.ts';

// CoinGecko's public API: free, no key, CORS-enabled, and it quotes BTC directly in PHP.
const API = 'https://api.coingecko.com/api/v3';
export const SIMPLE_PRICE_URL = `${API}/simple/price?ids=bitcoin&vs_currencies=php,usd&include_24hr_change=true`;
export const marketChartUrl = (days: number) =>
  `${API}/coins/bitcoin/market_chart?vs_currency=php&days=${days}`;

/** Turns CoinGecko's /simple/price response into a quote, or null if it isn't the shape we expect. */
export function parseSimplePrice(json: unknown, now: number): PriceQuote | null {
  const btc = (json as { bitcoin?: Record<string, unknown> } | null)?.bitcoin;
  if (!btc) return null;
  const php = Number(btc.php);
  const usd = Number(btc.usd);
  const change = Number(btc.php_24h_change);
  if (!(php > 0)) return null;
  return {
    php,
    usd: usd > 0 ? usd : 0,
    change24hPct: Number.isFinite(change) ? change : 0,
    fetchedAt: now,
  };
}

/**
 * Turns /market_chart into evenly thinned points (a phone-width chart can't show thousands),
 * always keeping the newest point. Invalid entries are skipped.
 */
export function parseMarketChart(json: unknown, maxPoints = 120): PricePoint[] {
  const raw = (json as { prices?: unknown } | null)?.prices;
  if (!Array.isArray(raw)) return [];
  const points: PricePoint[] = [];
  for (const entry of raw) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const t = Number(entry[0]);
    const php = Number(entry[1]);
    if (Number.isFinite(t) && php > 0) points.push({ t, php });
  }
  if (points.length <= maxPoints) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  const out: PricePoint[] = [];
  for (let i = 0; i < maxPoints; i++) out.push(points[Math.round(i * step)]);
  return out;
}

async function getJson(url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(res.status === 429 ? 'Too many price requests. Try again in a minute.' : `Price service returned ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchQuote(timeoutMs = 10_000): Promise<PriceQuote> {
  const quote = parseSimplePrice(await getJson(SIMPLE_PRICE_URL, timeoutMs), Date.now());
  if (!quote) throw new Error('Unexpected response from the price service');
  return quote;
}

export async function fetchHistory(days: number, timeoutMs = 15_000): Promise<PricePoint[]> {
  const points = parseMarketChart(await getJson(marketChartUrl(days), timeoutMs));
  if (points.length < 2) throw new Error('No price history available');
  return points;
}
