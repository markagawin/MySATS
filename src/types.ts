export type TradeType = 'buy' | 'sell' | 'receive' | 'send';

export interface Trade {
  id: string;
  type: TradeType;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /** Integer satoshis moved in this trade (always positive; `type` gives the direction). */
  sats: number;
  /**
   * Pesos for this trade, before fees.
   * buy: what you paid for the BTC · sell: what you sold it for ·
   * receive: what it cost you (0 for a gift) · send: unused (0).
   */
  amountPhp: number;
  /** Exchange fee in pesos. Added to a buy's cost, taken off a sell's proceeds. */
  feePhp: number;
  /** Where it happened: Coins.ph, GCash GCrypto, PDAX, a cold wallet… */
  source: string;
  note?: string;
  /** Epoch ms; tie-breaker for same-day trades so order stays stable. */
  createdAt: number;
}

export type AmountUnit = 'sats' | 'btc';

export interface Settings {
  unit: AmountUnit;
  showUsd: boolean;
  /** Pre-filled fee % in the calculator. */
  defaultFeePct: number;
  sources: string[];
}

export interface PriceQuote {
  php: number;
  usd: number;
  change24hPct: number;
  /** Epoch ms when this quote was fetched. */
  fetchedAt: number;
}

export interface PricePoint {
  /** Epoch ms. */
  t: number;
  php: number;
}

export interface BackupData {
  app: 'MySATS';
  version: 1;
  exportedAt: string;
  trades: Trade[];
  settings: Settings;
}
