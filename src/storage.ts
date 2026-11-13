import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PricePoint, PriceQuote, Settings, Trade } from './types';

const TRADES_KEY = '@mysats/trades';
const SETTINGS_KEY = '@mysats/settings';
const THEME_PREFERENCE_KEY = '@mysats/themePreference';
const QUOTE_KEY = '@mysats/quote';
// v2: the 365-day history keeps all daily points (v1 thinned it to 120, too coarse for date lookups).
const historyKey = (days: number) => `@mysats/history/v2/${days}`;

export const DEFAULT_SOURCES = ['Coins.ph', 'GCash GCrypto', 'PDAX', 'Maya', 'Binance', 'Cold wallet'];

export const DEFAULT_SETTINGS: Settings = {
  unit: 'sats',
  showUsd: false,
  defaultFeePct: 0,
  sources: DEFAULT_SOURCES,
  sourceFees: {},
};

async function loadJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function saveJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function loadTrades(): Promise<Trade[]> {
  const trades = await loadJson<Trade[]>(TRADES_KEY);
  return Array.isArray(trades) ? trades : [];
}

export const saveTrades = (trades: Trade[]) => saveJson(TRADES_KEY, trades);

export async function loadSettings(): Promise<Settings> {
  const stored = await loadJson<Partial<Settings>>(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
}

export const saveSettings = (settings: Settings) => saveJson(SETTINGS_KEY, settings);

export const loadThemePreference = () => AsyncStorage.getItem(THEME_PREFERENCE_KEY);
export const saveThemePreference = (pref: string) => AsyncStorage.setItem(THEME_PREFERENCE_KEY, pref);

export const loadCachedQuote = () => loadJson<PriceQuote>(QUOTE_KEY);
export const saveCachedQuote = (quote: PriceQuote) => saveJson(QUOTE_KEY, quote);

export interface CachedHistory {
  fetchedAt: number;
  points: PricePoint[];
}

export const loadCachedHistory = (days: number) => loadJson<CachedHistory>(historyKey(days));
export const saveCachedHistory = (days: number, value: CachedHistory) => saveJson(historyKey(days), value);

/** Removes trades and settings. Theme and cached prices are kept. */
export async function clearUserData(): Promise<void> {
  await AsyncStorage.multiRemove([TRADES_KEY, SETTINGS_KEY]);
}
