import { test } from 'node:test';
import assert from 'node:assert/strict';
import { measureFee, roundTripPct } from '../src/logic/fees.ts';
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

test('round trip compounds the fee on both sides', () => {
  assert.equal(roundTripPct(0).toFixed(2), '0.00');
  assert.equal(roundTripPct(3.5).toFixed(2), '6.88');
});
