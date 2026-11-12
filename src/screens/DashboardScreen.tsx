import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppData } from '../AppDataContext';
import { AppTheme } from '../theme';
import {
  formatAmount,
  formatAmountAlt,
  formatPct,
  formatPeso,
  formatPesoWhole,
  formatSignedPeso,
  formatUsd,
  relativeTime,
} from '../format';
import PriceChart from '../components/PriceChart';
import { Button, Card, Label, LinkButton, Screen, useStyles } from '../components/ui';

/** Re-renders every 30s so "Updated 1 min ago" stays true. */
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export default function DashboardScreen() {
  const s = useStyles(createStyles);
  const navigation = useNavigation<any>();
  const now = useNow();
  const { quote, quoteLoading, quoteError, refreshQuote, portfolio, valuation, settings, trades } = useAppData();

  const gainColor = (n: number | null | undefined) => (n == null || n === 0 ? s.neutral : n > 0 ? s.pos : s.neg);

  return (
    <Screen
      title="MySATS"
      right={
        <TouchableOpacity onPress={refreshQuote} accessibilityLabel="Refresh price" hitSlop={10} style={s.refresh}>
          {quoteLoading ? <ActivityIndicator size="small" /> : <Text style={s.refreshIcon}>↻</Text>}
        </TouchableOpacity>
      }
    >
      <Card>
        <Label>₿ Bitcoin price</Label>
        {quote ? (
          <>
            <Text style={s.price} testID="live-price">
              {formatPesoWhole(quote.php)}
            </Text>
            <View style={s.priceMeta}>
              <Text style={[s.change, gainColor(quote.change24hPct)]}>{formatPct(quote.change24hPct)} today</Text>
              {settings.showUsd && quote.usd > 0 ? <Text style={s.muted}>{formatUsd(quote.usd)}</Text> : null}
            </View>
            <Text style={[s.small, quoteError ? s.warn : s.muted]}>
              {quoteError
                ? `Couldn't refresh. Showing the price from ${relativeTime(quote.fetchedAt, now)}.`
                : `Updated ${relativeTime(quote.fetchedAt, now)} · CoinGecko`}
            </Text>
          </>
        ) : quoteError ? (
          <View style={{ marginTop: 8 }}>
            <Text style={[s.small, s.warn, { marginBottom: 8 }]}>{quoteError}</Text>
            <LinkButton label="Try again" onPress={refreshQuote} />
          </View>
        ) : (
          <Text style={[s.price, s.muted]}>Loading…</Text>
        )}
      </Card>

      {trades.length === 0 ? (
        <Card>
          <Text style={s.emptyTitle}>Start tracking your bitcoin</Text>
          <Text style={[s.muted, { marginBottom: 14, lineHeight: 20 }]}>
            Log what you've bought on Coins.ph, GCash, PDAX or anywhere else. MySATS adds it up and shows your profit
            in pesos.
          </Text>
          <Button label="Log your first buy" onPress={() => navigation.navigate('Log')} />
        </Card>
      ) : (
        <>
          <Card>
            <Label>Your holdings</Label>
            <Text style={s.holdingValue} testID="holdings-value">
              {valuation ? formatPeso(valuation.valuePhp) : '—'}
            </Text>
            <Text style={s.muted}>
              {formatAmount(portfolio.holdingsSats, settings.unit)} · {formatAmountAlt(portfolio.holdingsSats, settings.unit)}
            </Text>
          </Card>

          <View style={s.grid}>
            <Card style={s.tile}>
              <Label>Cost of holdings</Label>
              <Text style={s.tileValue}>{formatPeso(portfolio.costBasisPhp)}</Text>
            </Card>
            <Card style={s.tile}>
              <Label>Profit / loss</Label>
              <Text style={[s.tileValue, gainColor(valuation?.unrealizedPhp)]} testID="unrealized">
                {valuation ? formatSignedPeso(valuation.unrealizedPhp) : '—'}
              </Text>
            </Card>
            <Card style={s.tile}>
              <Label>Average buy price</Label>
              <Text style={s.tileValue}>{portfolio.avgCostPhpPerBtc ? formatPesoWhole(portfolio.avgCostPhpPerBtc) : '—'}</Text>
            </Card>
            <Card style={s.tile}>
              <Label>Return</Label>
              <Text style={[s.tileValue, gainColor(valuation?.unrealizedPct)]}>
                {valuation?.unrealizedPct != null ? formatPct(valuation.unrealizedPct) : '—'}
              </Text>
            </Card>
          </View>

          {portfolio.avgCostPhpPerBtc > 0 && quote ? (
            <Text style={[s.small, s.muted, { marginBottom: 12, marginTop: -2 }]}>
              Break-even price is {formatPesoWhole(portfolio.avgCostPhpPerBtc)} per BTC, which is{' '}
              {formatPct(((portfolio.avgCostPhpPerBtc - quote.php) / quote.php) * 100)} from today's price.
            </Text>
          ) : null}

          {portfolio.realizedPhp !== 0 || portfolio.totalInvestedPhp > 0 ? (
            <Card>
              <View style={s.rowBetween}>
                <Text style={s.muted}>Total spent on buys</Text>
                <Text style={s.rowValue}>{formatPeso(portfolio.totalInvestedPhp)}</Text>
              </View>
              {portfolio.realizedPhp !== 0 ? (
                <View style={[s.rowBetween, { marginTop: 8 }]}>
                  <Text style={s.muted}>Profit already taken (sells)</Text>
                  <Text style={[s.rowValue, gainColor(portfolio.realizedPhp)]}>{formatSignedPeso(portfolio.realizedPhp)}</Text>
                </View>
              ) : null}
            </Card>
          ) : null}

          {portfolio.oversoldTradeIds.length > 0 ? (
            <Card style={s.warnCard}>
              <Text style={[s.warn, { fontWeight: '700' }]}>
                {portfolio.oversoldTradeIds.length === 1 ? 'One sell or send' : `${portfolio.oversoldTradeIds.length} sells or sends`} use
                more sats than you had at the time. Check History; totals assume you sold only what you held.
              </Text>
            </Card>
          ) : null}
        </>
      )}

      <PriceChart />
      <Text style={[s.small, s.muted, { textAlign: 'center' }]}>Estimates only, based on CoinGecko prices.</Text>
    </Screen>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    refresh: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
    refreshIcon: { fontSize: 20, color: theme.primary, fontWeight: '700' },
    price: { fontSize: 32, fontWeight: '800', color: theme.text, marginTop: 4 },
    priceMeta: { flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 2, marginBottom: 6 },
    change: { fontSize: 15, fontWeight: '700' },
    holdingValue: { fontSize: 28, fontWeight: '800', color: theme.text, marginTop: 4, marginBottom: 2 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    tile: { width: '48.5%', padding: 14 },
    tileValue: { fontSize: 17, fontWeight: '800', color: theme.text, marginTop: 6 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    rowValue: { fontSize: 14, fontWeight: '700', color: theme.text },
    emptyTitle: { fontSize: 18, fontWeight: '800', color: theme.text, marginBottom: 6 },
    muted: { color: theme.textMuted, fontSize: 14 },
    small: { fontSize: 12.5 },
    pos: { color: theme.success },
    neg: { color: theme.danger },
    neutral: { color: theme.text },
    warn: { color: theme.danger },
    warnCard: { backgroundColor: theme.dangerSurface, borderColor: theme.danger },
  });
