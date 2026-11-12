import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildScenarios, calculateInvestment, priceNeededForGain } from '../src/logic/calculator.ts';

const SAMPLE_PRICE = 6_000_000;

test('₱50,000 at ₱6M, target ₱7.5M, no fee → 833,333 sats worth ₱62,499.98', () => {
  const r = calculateInvestment({ amountPhp: 50_000, buyPricePhp: SAMPLE_PRICE, targetPricePhp: 7_500_000, feePct: 0 });
  assert.ok(r);
  assert.equal(r.sats, 833_333);
  assert.equal(r.worthPhp, 62_499.98);
  assert.equal(r.gainPhp, 12_499.98);
  assert.equal(r.gainPct.toFixed(2), '25.00');
});

test('target equal to buy price with no fee loses at most sub-sat rounding', () => {
  const r = calculateInvestment({ amountPhp: 50_000, buyPricePhp: SAMPLE_PRICE, targetPricePhp: SAMPLE_PRICE, feePct: 0 });
  assert.ok(r);
  assert.ok(r.gainPhp <= 0 && r.gainPhp > -0.1, `gain was ${r.gainPhp}`);
});

test('0.5% fee on an unchanged price is about a 1% loss (fee paid buying and selling)', () => {
  const r = calculateInvestment({ amountPhp: 50_000, buyPricePhp: SAMPLE_PRICE, targetPricePhp: SAMPLE_PRICE, feePct: 0.5 });
  assert.ok(r);
  assert.equal(r.buyFeePhp, 250);
  assert.equal(r.investedPhp, 49_750);
  assert.equal(r.sats, 829_166);
  assert.equal(r.grossWorthPhp, 49_749.96);
  assert.equal(r.sellFeePhp, 248.75);
  assert.equal(r.worthPhp, 49_501.21);
  assert.equal(r.gainPhp, -498.79);
});

test('₱10,000,000 does not drift', () => {
  const r = calculateInvestment({ amountPhp: 10_000_000, buyPricePhp: SAMPLE_PRICE, targetPricePhp: SAMPLE_PRICE, feePct: 0 });
  assert.ok(r);
  assert.equal(r.sats, 166_666_666);
  assert.equal(r.worthPhp, 9_999_999.96);
});

test('centavo amounts are not hurt by floating point (₱0.29 at ₱1/BTC)', () => {
  const r = calculateInvestment({ amountPhp: 0.29, buyPricePhp: 1, targetPricePhp: 1, feePct: 0 });
  assert.ok(r);
  assert.equal(r.sats, 29_000_000);
});

test('missing or invalid inputs return null instead of NaN or Infinity', () => {
  const base = { amountPhp: 50_000, buyPricePhp: SAMPLE_PRICE, targetPricePhp: SAMPLE_PRICE, feePct: 0 };
  assert.equal(calculateInvestment({ ...base, amountPhp: 0 }), null);
  assert.equal(calculateInvestment({ ...base, amountPhp: NaN }), null);
  assert.equal(calculateInvestment({ ...base, buyPricePhp: 0 }), null);
  assert.equal(calculateInvestment({ ...base, targetPricePhp: -1 }), null);
  assert.equal(calculateInvestment({ ...base, feePct: 100 }), null);
  assert.equal(calculateInvestment({ ...base, feePct: -1 }), null);
  assert.equal(calculateInvestment({ ...base, buyPricePhp: Infinity }), null);
});

test('price needed to earn ₱20,000 on ₱50,000 is just over ₱8.4M', () => {
  const p = priceNeededForGain(50_000, 20_000, SAMPLE_PRICE, 0);
  assert.equal(p, 8_400_004);
  const check = calculateInvestment({ amountPhp: 50_000, buyPricePhp: SAMPLE_PRICE, targetPricePhp: p!, feePct: 0 });
  assert.ok(check && check.gainPhp >= 20_000);
});

test('price needed accounts for fees and is always enough', () => {
  const p = priceNeededForGain(50_000, 20_000, SAMPLE_PRICE, 0.5);
  assert.ok(p);
  const check = calculateInvestment({ amountPhp: 50_000, buyPricePhp: SAMPLE_PRICE, targetPricePhp: p, feePct: 0.5 });
  assert.ok(check && check.gainPhp >= 20_000, `gain was ${check?.gainPhp}`);
  const oneLess = calculateInvestment({ amountPhp: 50_000, buyPricePhp: SAMPLE_PRICE, targetPricePhp: p - 2, feePct: 0.5 });
  assert.ok(oneLess && oneLess.gainPhp < 20_000);
});

test('price needed is null when the amount cannot buy a single sat', () => {
  assert.equal(priceNeededForGain(0.01, 100, 100_000_000_000, 0), null);
});

test('scenario table matches the plan', () => {
  const rows = buildScenarios(50_000, SAMPLE_PRICE, 0);
  assert.deepEqual(
    rows.map((r) => [r.label, r.targetPricePhp, r.result.gainPhp]),
    [
      ['−20%', 4_800_000, -10_000.02],
      ['−10%', 5_400_000, -5_000.02],
      ['+10%', 6_600_000, 4_999.98],
      ['+25%', 7_500_000, 12_499.98],
      ['+50%', 9_000_000, 24_999.97],
      ['2×', 12_000_000, 49_999.96],
    ]
  );
});
