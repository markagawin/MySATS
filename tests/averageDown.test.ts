import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addNeededForBreakEven, afterBuyingMore } from '../src/logic/averageDown.ts';

// The Maya portfolio from the user's screenshot, valued at a round ₱4,500,000.
const maya = { heldBtc: 0.007002941, costPhp: 39_999.99, pricePhp: 4_500_000 };

test('adding nothing keeps the current average', () => {
  const r = afterBuyingMore(maya, 0)!;
  assert.equal(r.avgPricePhp, 5_711_884);
  assert.equal(r.unrealizedPhp, -8_486.76);
});

test('adding ₱40,000 at ₱4.5M lowers the break-even to about ₱5.03M', () => {
  const r = afterBuyingMore(maya, 40_000)!;
  assert.equal(r.totalCostPhp, 79_999.99);
  assert.equal(r.avgPricePhp, 5_034_033);
  assert.equal(r.riseNeededPct.toFixed(2), '11.87');
  // The peso loss is the same right after buying: buying doesn't recover it.
  assert.equal(r.unrealizedPhp, -8_486.76);
});

test('the more you add, the closer the average gets to today price, never below it', () => {
  const a = afterBuyingMore(maya, 10_000)!.avgPricePhp;
  const b = afterBuyingMore(maya, 100_000)!.avgPricePhp;
  const c = afterBuyingMore(maya, 10_000_000)!.avgPricePhp;
  assert.ok(a > b && b > c && c > maya.pricePhp, `${a} > ${b} > ${c} > ${maya.pricePhp}`);
});

test('amount needed to break even at ₱5,000,000 actually gets you there', () => {
  const need = addNeededForBreakEven(maya, 5_000_000);
  assert.equal(need.kind, 'amount');
  const add = (need as { addPhp: number }).addPhp;
  assert.equal(add, 44_868);
  assert.ok(afterBuyingMore(maya, add)!.avgPricePhp <= 5_000_000);
  assert.ok(afterBuyingMore(maya, add - 50)!.avgPricePhp > 5_000_000);
});

test('a target at or below today price is unreachable; at or above your average needs nothing', () => {
  assert.deepEqual(addNeededForBreakEven(maya, 4_500_000), { kind: 'unreachable' });
  assert.deepEqual(addNeededForBreakEven(maya, 4_000_000), { kind: 'unreachable' });
  assert.deepEqual(addNeededForBreakEven(maya, 5_711_884), { kind: 'already' });
  assert.deepEqual(addNeededForBreakEven(maya, 6_000_000), { kind: 'already' });
});

test('invalid inputs never produce NaN', () => {
  assert.equal(afterBuyingMore({ ...maya, heldBtc: 0 }, 1_000), null);
  assert.equal(afterBuyingMore(maya, -1), null);
  assert.equal(afterBuyingMore(maya, NaN), null);
  assert.deepEqual(addNeededForBreakEven(maya, NaN), { kind: 'invalid' });
  assert.deepEqual(addNeededForBreakEven({ ...maya, pricePhp: 0 }, 5_000_000), { kind: 'invalid' });
});
