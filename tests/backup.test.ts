import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBackup } from '../src/logic/backup.ts';

const goodTrade = { id: 'a', type: 'buy', date: '2026-10-01', sats: 1_250_000, amountPhp: 60_000, feePhp: 0, source: 'Coins.ph', createdAt: 1 };
const backup = (over: Record<string, unknown> = {}) => ({
  app: 'MySATS',
  version: 1,
  exportedAt: '2026-11-12T00:00:00.000Z',
  trades: [goodTrade],
  settings: { unit: 'btc', showUsd: true, defaultFeePct: 0.5, sources: ['Coins.ph'] },
  ...over,
});

test('accepts a valid backup and keeps its settings', () => {
  const r = parseBackup(backup());
  assert.ok('data' in r);
  assert.equal(r.data.trades.length, 1);
  assert.deepEqual(r.data.settings, { unit: 'btc', showUsd: true, defaultFeePct: 0.5, sources: ['Coins.ph'] });
});

test('rejects files from other apps (e.g. a MyDEL backup)', () => {
  const r = parseBackup({ transactions: [] });
  assert.ok('error' in r && /isn't a MySATS backup/.test(r.error));
});

test('rejects a newer backup version', () => {
  const r = parseBackup(backup({ version: 2 }));
  assert.ok('error' in r && /newer version/.test(r.error));
});

test('names the damaged transaction', () => {
  const r = parseBackup(backup({ trades: [goodTrade, { ...goodTrade, sats: 1.5 }] }));
  assert.ok('error' in r);
  assert.equal(r.error, 'Transaction #2 in that backup is damaged.');
});

test('rejects negative amounts and unknown trade types', () => {
  assert.ok('error' in parseBackup(backup({ trades: [{ ...goodTrade, amountPhp: -1 }] })));
  assert.ok('error' in parseBackup(backup({ trades: [{ ...goodTrade, type: 'steal' }] })));
});

test('drops invalid settings instead of importing them', () => {
  const r = parseBackup(backup({ settings: { unit: 'pesos', defaultFeePct: 500, sources: 'oops' } }));
  assert.ok('data' in r);
  assert.deepEqual(r.data.settings, {});
});
