import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import type { BackupData, PricePoint, PriceQuote, Settings, Trade } from './types';
import { computePortfolio, Portfolio, Valuation, valuePortfolio } from './logic/portfolio.ts';
import { fetchHistory, fetchQuote } from './logic/price.ts';
import {
  clearUserData,
  DEFAULT_SETTINGS,
  loadCachedHistory,
  loadCachedQuote,
  loadSettings,
  loadTrades,
  saveCachedHistory,
  saveCachedQuote,
  saveSettings,
  saveTrades,
} from './storage';
import { generateId } from './uuid';

const QUOTE_REFRESH_MS = 60_000;
const HISTORY_MAX_AGE_MS = 60 * 60_000;

export type NewTrade = Omit<Trade, 'id' | 'createdAt'>;

interface HistoryState {
  points: PricePoint[];
  fetchedAt: number;
  loading: boolean;
  error: string | null;
}

interface AppDataValue {
  loading: boolean;
  trades: Trade[];
  settings: Settings;
  portfolio: Portfolio;
  /** Null until any price (live or cached) is known. */
  valuation: Valuation | null;
  quote: PriceQuote | null;
  quoteLoading: boolean;
  /** Set when the latest refresh failed; `quote` may still hold an older cached price. */
  quoteError: string | null;
  refreshQuote: () => Promise<void>;
  history: Record<number, HistoryState | undefined>;
  loadHistory: (days: number, force?: boolean) => Promise<void>;
  addTrade: (t: NewTrade) => Trade;
  updateTrade: (t: Trade) => void;
  deleteTrade: (id: string) => Trade | undefined;
  restoreTrade: (t: Trade) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  exportBackup: () => BackupData;
  importBackup: (data: BackupData) => void;
  clearAll: () => Promise<void>;
}

const AppDataContext = createContext<AppDataValue | undefined>(undefined);

function errorMessage(e: unknown): string {
  if (e instanceof Error) {
    if (e.name === 'AbortError') return 'The price service took too long to respond.';
    if (/fetch|network/i.test(e.message)) return "You're offline or the price service is unreachable.";
    return e.message;
  }
  return 'Something went wrong getting the price.';
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [quote, setQuote] = useState<PriceQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<number, HistoryState | undefined>>({});
  const quoteInFlight = useRef(false);
  const historyRef = useRef(history);
  historyRef.current = history;

  useEffect(() => {
    (async () => {
      const [t, s, q] = await Promise.all([loadTrades(), loadSettings(), loadCachedQuote()]);
      setTrades(t);
      setSettings(s);
      if (q) setQuote(q);
      setLoading(false);
    })();
  }, []);

  const refreshQuote = useCallback(async () => {
    if (quoteInFlight.current) return;
    quoteInFlight.current = true;
    setQuoteLoading(true);
    try {
      const q = await fetchQuote();
      setQuote(q);
      setQuoteError(null);
      saveCachedQuote(q);
    } catch (e) {
      setQuoteError(errorMessage(e));
    } finally {
      quoteInFlight.current = false;
      setQuoteLoading(false);
    }
  }, []);

  // Refresh on start, every minute while the app is in front, and when it comes back to the front.
  useEffect(() => {
    if (loading) return;
    refreshQuote();
    const timer = setInterval(() => {
      const visible = Platform.OS !== 'web' || typeof document === 'undefined' || document.visibilityState === 'visible';
      if (visible && AppState.currentState !== 'background') refreshQuote();
    }, QUOTE_REFRESH_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshQuote();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [loading, refreshQuote]);

  const loadHistory = useCallback(async (days: number, force = false) => {
    const current = historyRef.current[days];
    if (current?.loading) return;
    if (!force && current && Date.now() - current.fetchedAt < HISTORY_MAX_AGE_MS && current.points.length > 1) return;

    let cached = current;
    if (!cached) {
      const stored = await loadCachedHistory(days);
      if (stored) {
        cached = { points: stored.points, fetchedAt: stored.fetchedAt, loading: false, error: null };
        if (!force && Date.now() - stored.fetchedAt < HISTORY_MAX_AGE_MS) {
          setHistory((h) => ({ ...h, [days]: cached }));
          return;
        }
      }
    }

    setHistory((h) => ({ ...h, [days]: { points: cached?.points ?? [], fetchedAt: cached?.fetchedAt ?? 0, loading: true, error: null } }));
    try {
      const points = await fetchHistory(days);
      const fetchedAt = Date.now();
      setHistory((h) => ({ ...h, [days]: { points, fetchedAt, loading: false, error: null } }));
      saveCachedHistory(days, { points, fetchedAt });
    } catch (e) {
      setHistory((h) => ({
        ...h,
        [days]: { points: cached?.points ?? [], fetchedAt: cached?.fetchedAt ?? 0, loading: false, error: errorMessage(e) },
      }));
    }
  }, []);

  const commitTrades = useCallback((updater: (prev: Trade[]) => Trade[]) => {
    setTrades((prev) => {
      const next = updater(prev);
      saveTrades(next);
      return next;
    });
  }, []);

  const addTrade = useCallback(
    (t: NewTrade) => {
      const trade: Trade = { ...t, id: generateId(), createdAt: Date.now() };
      commitTrades((prev) => [...prev, trade]);
      return trade;
    },
    [commitTrades]
  );

  const updateTrade = useCallback(
    (t: Trade) => commitTrades((prev) => prev.map((x) => (x.id === t.id ? t : x))),
    [commitTrades]
  );

  const tradesRef = useRef(trades);
  tradesRef.current = trades;

  const deleteTrade = useCallback(
    (id: string) => {
      const removed = tradesRef.current.find((t) => t.id === id);
      commitTrades((prev) => prev.filter((t) => t.id !== id));
      return removed;
    },
    [commitTrades]
  );

  const restoreTrade = useCallback(
    (t: Trade) => commitTrades((prev) => (prev.some((x) => x.id === t.id) ? prev : [...prev, t])),
    [commitTrades]
  );

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const exportBackup = useCallback(
    (): BackupData => ({ app: 'MySATS', version: 1, exportedAt: new Date().toISOString(), trades, settings }),
    [trades, settings]
  );

  const importBackup = useCallback(
    (data: BackupData) => {
      commitTrades(() => data.trades);
      const next = { ...DEFAULT_SETTINGS, ...data.settings };
      setSettings(next);
      saveSettings(next);
    },
    [commitTrades]
  );

  const clearAll = useCallback(async () => {
    await clearUserData();
    setTrades([]);
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const portfolio = useMemo(() => computePortfolio(trades), [trades]);
  const valuation = useMemo(() => (quote ? valuePortfolio(portfolio, quote.php) : null), [portfolio, quote]);

  const value: AppDataValue = {
    loading,
    trades,
    settings,
    portfolio,
    valuation,
    quote,
    quoteLoading,
    quoteError,
    refreshQuote,
    history,
    loadHistory,
    addTrade,
    updateTrade,
    deleteTrade,
    restoreTrade,
    updateSettings,
    exportBackup,
    importBackup,
    clearAll,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
