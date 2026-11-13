import { test } from 'node:test';
import assert from 'node:assert/strict';
import { averageBuyPrice, datesNearPrice, highestPoint, impliedBuyPrice, priceOnDate, riseNeededPct } from '../src/logic/lookback.ts';
import type { PricePoint } from '../src/types.ts';

const DAY = 86_400_000;
const start = Date.UTC(2026, 9, 1); // 2026-10-01 00:00 UTC
const series = (prices: number[]): PricePoint[] => prices.map((php, i) => ({ t: start + i * DAY, php }));

test('looks up the price on an exact day', () => {
  const pts = series([5_000_000, 5_100_000, 5_200_000]);
  assert.deepEqual(priceOnDate(pts, '2026-10-02'), { kind: 'found', date: '2026-10-02', pricePhp: 5_100_000 });
});

test('uses the first point of the day, not the latest live point', () => {
  const pts = [...series([5_000_000]), { t: start + 5 * 3_600_000, php: 9_999_999 }];
  assert.deepEqual(priceOnDate(pts, '2026-10-01'), { kind: 'found', date: '2026-10-01', pricePhp: 5_000_000 });
});

test('falls back to the closest earlier day when a day is missing', () => {
  const pts = [{ t: start, php: 5_000_000 }, { t: start + 2 * DAY, php: 5_200_000 }];
  assert.deepEqual(priceOnDate(pts, '2026-10-02'), { kind: 'found', date: '2026-10-01', pricePhp: 5_000_000 });
});

test('dates outside the history are explained, not guessed', () => {
  const pts = series([5_000_000, 5_100_000]);
  assert.deepEqual(priceOnDate(pts, '2025-01-01'), { kind: 'too-old', earliest: '2026-10-01' });
  assert.deepEqual(priceOnDate(pts, '2027-01-01'), { kind: 'future' });
  assert.deepEqual(priceOnDate([], '2026-10-01'), { kind: 'no-data' });
});

test('works out the buy price from amount and loss', () => {
  // ₱50,000 now worth ₱42,000 at ₱4,200,000 → bought at ₱5,000,000.
  assert.equal(impliedBuyPrice(50_000, 8_000, 4_200_000), 5_000_000);
  assert.equal(impliedBuyPrice(50_000, 0, 4_200_000), 4_200_000);
});

test('average buy price from total cost and BTC held (Maya portfolio numbers)', () => {
  const price = averageBuyPrice(39_999.99, 0.007002941);
  assert.equal(price, 5_711_884);
  // Cross-check: Maya's value today = BTC held × price shown (₱31,571.88 at ₱4,508,374.41).
  assert.equal(Math.round(0.007002941 * 4_508_374.41 * 100) / 100, 31_571.88);
  // And the loss method agrees when fed Maya's own price.
  assert.ok(Math.abs(impliedBuyPrice(39_999.99, 8_428.11, 4_508_374.41)! - price!) <= 1);
  assert.equal(averageBuyPrice(0, 0.007), null);
  assert.equal(averageBuyPrice(40_000, 0), null);
});

test('impossible losses return null', () => {
  assert.equal(impliedBuyPrice(50_000, 50_000, 4_200_000), null);
  assert.equal(impliedBuyPrice(50_000, 60_000, 4_200_000), null);
  assert.equal(impliedBuyPrice(0, 1_000, 4_200_000), null);
  assert.equal(impliedBuyPrice(50_000, -1, 4_200_000), null);
  assert.equal(impliedBuyPrice(NaN, 1_000, 4_200_000), null);
});

test('finds when BTC was near a price, merging neighbouring days, newest first', () => {
  const pts = series([5_000_000, 5_050_000, 4_000_000, 4_100_000, 4_990_000, 6_000_000]);
  assert.deepEqual(datesNearPrice(pts, 5_000_000, 2), [
    { from: '2026-10-05', to: '2026-10-05', lowPhp: 4_990_000, highPhp: 4_990_000 },
    { from: '2026-10-01', to: '2026-10-02', lowPhp: 5_000_000, highPhp: 5_050_000 },
  ]);
});

test('no matches gives an empty list', () => {
  assert.deepEqual(datesNearPrice(series([4_000_000, 4_100_000]), 5_000_000), []);
  assert.deepEqual(datesNearPrice(series([4_000_000]), NaN), []);
});

test('limits the number of ranges', () => {
  const alternating = series(Array.from({ length: 20 }, (_, i) => (i % 2 ? 5_000_000 : 1)));
  assert.equal(datesNearPrice(alternating, 5_000_000, 2, 3).length, 3);
});

test('highest point and rise needed', () => {
  const pts = series([5_000_000, 5_870_830, 4_600_000]);
  assert.deepEqual(highestPoint(pts), { date: '2026-10-02', pricePhp: 5_870_830 });
  assert.equal(riseNeededPct(5_000_000, 4_000_000), 25);
});
