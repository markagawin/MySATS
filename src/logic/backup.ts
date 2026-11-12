import type { BackupData, Settings, Trade, TradeType } from '../types.ts';

const TRADE_TYPES: TradeType[] = ['buy', 'sell', 'receive', 'send'];

function isTrade(x: unknown): x is Trade {
  const t = x as Trade;
  return (
    !!t &&
    typeof t.id === 'string' &&
    TRADE_TYPES.includes(t.type) &&
    typeof t.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(t.date) &&
    Number.isInteger(t.sats) &&
    t.sats > 0 &&
    typeof t.amountPhp === 'number' &&
    t.amountPhp >= 0 &&
    typeof t.feePhp === 'number' &&
    t.feePhp >= 0 &&
    typeof t.source === 'string'
  );
}

/**
 * Validates a parsed backup file. Returns the cleaned data, or an error message that says
 * what's wrong in plain words. Never trusts the file's shape.
 */
export function parseBackup(json: unknown): { data: BackupData } | { error: string } {
  const b = json as Partial<BackupData> | null;
  if (!b || typeof b !== 'object') return { error: "That file isn't a MySATS backup." };
  if (b.app !== 'MySATS') return { error: "That file isn't a MySATS backup." };
  if (b.version !== 1) return { error: 'That backup is from a newer version of MySATS.' };
  if (!Array.isArray(b.trades)) return { error: 'That backup has no transactions list.' };
  const bad = b.trades.findIndex((t) => !isTrade(t));
  if (bad !== -1) return { error: `Transaction #${bad + 1} in that backup is damaged.` };

  const s = (b.settings ?? {}) as Partial<Settings>;
  const settings: Partial<Settings> = {};
  if (s.unit === 'sats' || s.unit === 'btc') settings.unit = s.unit;
  if (typeof s.showUsd === 'boolean') settings.showUsd = s.showUsd;
  if (typeof s.defaultFeePct === 'number' && s.defaultFeePct >= 0 && s.defaultFeePct < 100) settings.defaultFeePct = s.defaultFeePct;
  if (Array.isArray(s.sources) && s.sources.every((x) => typeof x === 'string')) settings.sources = s.sources;

  return {
    data: {
      app: 'MySATS',
      version: 1,
      exportedAt: typeof b.exportedAt === 'string' ? b.exportedAt : '',
      trades: b.trades.map((t) => ({ ...t, createdAt: typeof t.createdAt === 'number' ? t.createdAt : 0 })),
      settings: settings as Settings,
    },
  };
}
