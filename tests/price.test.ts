import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarketChart, parseSimplePrice } from '../src/logic/price.ts';
import { phpToSats, satsToPhp } from '../src/logic/units.ts';

test('parses a CoinGecko simple price response', () => {
  const q = parseSimplePrice({ bitcoin: { php: 6_000_000, usd: 103_000, php_24h_change: 2.41 } }, 123);
  assert.deepEqual(q, { php: 6_000_000, usd: 103_000, change24hPct: 2.41, fetchedAt: 123 });
});

test('rejects malformed price responses', () => {
  assert.equal(parseSimplePrice(null, 0), null);
  assert.equal(parseSimplePrice({}, 0), null);
  assert.equal(parseSimplePrice({ bitcoin: { php: 'abc' } }, 0), null);
  assert.equal(parseSimplePrice({ bitcoin: { php: 0 } }, 0), null);
  assert.equal(parseSimplePrice({ status: { error_code: 429 } }, 0), null);
});

test('missing USD and 24h change default to 0 instead of NaN', () => {
  const q = parseSimplePrice({ bitcoin: { php: 6_000_000 } }, 0);
  assert.equal(q?.usd, 0);
  assert.equal(q?.change24hPct, 0);
});

test('market chart is thinned to maxPoints and keeps first and last', () => {
  const prices = Array.from({ length: 1000 }, (_, i) => [i * 1000, 5_000_000 + i]);
  const pts = parseMarketChart({ prices }, 50);
  assert.equal(pts.length, 50);
  assert.equal(pts[0].php, 5_000_000);
  assert.equal(pts[49].php, 5_000_999);
});

test('market chart skips bad entries', () => {
  const pts = parseMarketChart({ prices: [[1, 100], 'x', [2], [3, -5], [4, 200]] });
  assert.deepEqual(pts, [{ t: 1, php: 100 }, { t: 4, php: 200 }]);
});

test('unit helpers never return NaN for empty input', () => {
  assert.equal(phpToSats(0, 6_000_000), 0);
  assert.equal(phpToSats(100, 0), 0);
  assert.equal(satsToPhp(0, 6_000_000), 0);
  assert.equal(satsToPhp(NaN, 6_000_000), 0);
});
