import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePortfolio, holdingsAsOf, valuePortfolio } from '../src/logic/portfolio.ts';
import type { Trade, TradeType } from '../src/types.ts';

let seq = 0;
function trade(type: TradeType, date: string, sats: number, amountPhp = 0, feePhp = 0): Trade {
  seq += 1;
  return { id: `t${seq}`, type, date, sats, amountPhp, feePhp, source: 'Test', createdAt: seq };
}

test('empty portfolio is all zeros', () => {
  const p = computePortfolio([]);
  assert.equal(p.holdingsSats, 0);
  assert.equal(p.avgCostPhpPerBtc, 0);
  assert.equal(p.costBasisPhp, 0);
});

test('two buys average their cost, fees included', () => {
  const p = computePortfolio([
    trade('buy', '2026-01-01', 1_000_000, 40_000, 100),
    trade('buy', '2026-02-01', 1_000_000, 60_000, 100),
  ]);
  assert.equal(p.holdingsSats, 2_000_000);
  assert.equal(p.costBasisPhp, 100_200);
  assert.equal(p.totalInvestedPhp, 100_200);
  assert.equal(p.avgCostPhpPerBtc, 5_010_000);
});

test('a partial sell realizes profit against average cost and keeps the average unchanged', () => {
  const p = computePortfolio([
    trade('buy', '2026-01-01', 2_000_000, 100_000),
    trade('sell', '2026-03-01', 500_000, 40_000, 200),
  ]);
  assert.equal(p.holdingsSats, 1_500_000);
  assert.equal(p.costBasisPhp, 75_000);
  assert.equal(p.realizedPhp, 14_800); // 40,000 − 200 fee − 25,000 cost
  assert.equal(p.avgCostPhpPerBtc, 5_000_000);
});

test('trades are replayed by date, not by the order they were logged', () => {
  const sell = trade('sell', '2026-03-01', 500_000, 40_000);
  const buy = trade('buy', '2026-01-01', 1_000_000, 50_000);
  const p = computePortfolio([sell, buy]);
  assert.deepEqual(p.oversoldTradeIds, []);
  assert.equal(p.holdingsSats, 500_000);
});

test('selling more than you hold is capped and flagged', () => {
  const buy = trade('buy', '2026-01-01', 100_000, 6_000);
  const sell = trade('sell', '2026-02-01', 200_000, 14_000);
  const p = computePortfolio([buy, sell]);
  assert.equal(p.holdingsSats, 0);
  assert.deepEqual(p.oversoldTradeIds, [sell.id]);
  assert.equal(p.realizedPhp, 1_000); // half the sell was covered: 7,000 − 6,000
});

test('a gift received has zero cost; a send removes sats with no profit or loss', () => {
  const p = computePortfolio([
    trade('buy', '2026-01-01', 1_000_000, 50_000),
    trade('receive', '2026-01-05', 1_000_000, 0),
    trade('send', '2026-01-10', 500_000),
  ]);
  assert.equal(p.holdingsSats, 1_500_000);
  assert.equal(p.costBasisPhp, 37_500);
  assert.equal(p.realizedPhp, 0);
  assert.equal(p.avgCostPhpPerBtc, 2_500_000);
});

test('valuation at a live price', () => {
  const p = computePortfolio([trade('buy', '2026-01-01', 1_250_000, 60_000)]);
  const v = valuePortfolio(p, 6_000_000);
  assert.equal(v.valuePhp, 75_000);
  assert.equal(v.unrealizedPhp, 15_000);
  assert.equal(v.unrealizedPct, 25);
});

test('unrealized % is null when everything was a gift', () => {
  const p = computePortfolio([trade('receive', '2026-01-01', 1_000, 0)]);
  assert.equal(valuePortfolio(p, 6_000_000).unrealizedPct, null);
});

test('holdingsAsOf ignores later trades and the trade being edited', () => {
  const b1 = trade('buy', '2026-01-01', 1_000, 60);
  const b2 = trade('buy', '2026-05-01', 2_000, 120);
  assert.equal(holdingsAsOf([b1, b2], '2026-03-01'), 1_000);
  assert.equal(holdingsAsOf([b1, b2], '2026-06-01', b1.id), 2_000);
});
