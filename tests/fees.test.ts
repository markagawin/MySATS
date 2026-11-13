import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feeBreakdown, measureFee, roundTripPct } from '../src/logic/fees.ts';
import { calculateInvestment } from '../src/logic/calculator.ts';

test('a quote 2.5% short of market BTC measures as a 2.5% fee', () => {
  // ₱1,000 at a ₱4,500,000 market price buys 0.000222222 BTC; the app offers 2.5% less.
  const quoted = (1_000 / 4_500_000) * 0.975;
  const r = measureFee(1_000, quoted, 4_500_000);
  assert.equal(r.kind, 'ok');
  if (r.kind !== 'ok') return;
  assert.equal(r.measurement.feePct, 2.5);
  assert.equal(r.measurement.effectivePricePhp, 4_615_385);
});

test('the measured fee reproduces the quote in the calculator', () => {
  const quoted = 0.000216;
  const r = measureFee(1_000, quoted, 4_500_000);
  assert.equal(r.kind, 'ok');
  if (r.kind !== 'ok') return;
  const calc = calculateInvestment({ amountPhp: 1_000, buyPricePhp: 4_500_000, targetPricePhp: 4_500_000, feePct: r.measurement.feePct });
  // 0.000216 BTC = 21,600 sats.
  assert.ok(calc && Math.abs(calc.sats - 21_600) <= 1, `sats ${calc?.sats}`);
});

test('more BTC than the market gives is flagged, not saved as a negative fee', () => {
  assert.equal(measureFee(1_000, 0.00023, 4_500_000).kind, 'better-than-market');
});

test('a missing zero in the BTC amount is flagged as implausible', () => {
  // Should be 0.000216; typed 0.00016.
  const r = measureFee(1_000, 0.00016, 4_500_000);
  assert.equal(r.kind, 'implausible');
});

test('empty or zero inputs are invalid', () => {
  assert.equal(measureFee(0, 0.0002, 4_500_000).kind, 'invalid');
  assert.equal(measureFee(1_000, NaN, 4_500_000).kind, 'invalid');
  assert.equal(measureFee(1_000, 0.0002, 0).kind, 'invalid');
});

test('fee breakdown for ₱10,000 at 2.5% and ₱4.5M, sold right away', () => {
  const b = feeBreakdown(10_000, 2.5, 4_500_000)!;
  assert.equal(b.buyFeePhp, 250);
  assert.equal(b.investedPhp, 9_750);
  assert.equal(b.sats, 216_666);
  assert.equal(b.sellGrossPhp, 9_749.97);
  assert.equal(b.sellFeePhp, 243.75);
  assert.equal(b.receivePhp, 9_506.22);
  assert.equal(b.totalFeesPhp, 493.75);
  assert.equal(b.totalFeesPct.toFixed(2), '4.94');
  assert.equal(b.breakEvenPricePhp, 4_733_743);
  assert.equal(b.riseToCoverPct.toFixed(2), '5.19');
});

test('fee breakdown with no fee loses only sub-sat rounding and needs ~0% rise', () => {
  const b = feeBreakdown(10_000, 0, 4_500_000)!;
  assert.equal(b.totalFeesPhp, 0);
  assert.ok(b.riseToCoverPct >= 0 && b.riseToCoverPct < 0.001);
});

test('fee breakdown at a higher sell price charges the sell fee on the bigger amount', () => {
  const b = feeBreakdown(10_000, 2.5, 4_500_000, 5_400_000)!;
  assert.equal(b.sellGrossPhp, 11_699.96);
  assert.equal(b.sellFeePhp, 292.5);
});

test('fee breakdown is null for invalid input', () => {
  assert.equal(feeBreakdown(0, 2.5, 4_500_000), null);
  assert.equal(feeBreakdown(10_000, 100, 4_500_000), null);
  assert.equal(feeBreakdown(10_000, 2.5, NaN), null);
});

test('round trip compounds the fee on both sides', () => {
  assert.equal(roundTripPct(0).toFixed(2), '0.00');
  assert.equal(roundTripPct(3.5).toFixed(2), '6.88');
});
