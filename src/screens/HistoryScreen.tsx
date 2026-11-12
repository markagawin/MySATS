import React, { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppData } from '../AppDataContext';
import type { Trade, TradeType } from '../types';
import { AppTheme } from '../theme';
import { sortTradesChronologically } from '../logic/portfolio.ts';
import { SATS_PER_BTC } from '../logic/units.ts';
import { formatAmount, formatDayShort, formatMonth, formatPeso, formatPesoShort } from '../format';
import EditTradeModal from '../components/EditTradeModal';
import Toast from '../components/Toast';
import { Card, Chip, ChipRow, Screen, useStyles } from '../components/ui';

type Filter = 'all' | TradeType;
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
  { value: 'receive', label: 'Receive' },
  { value: 'send', label: 'Send' },
];
const TYPE_LABEL: Record<TradeType, string> = { buy: 'Buy', sell: 'Sell', receive: 'Receive', send: 'Send' };

export default function HistoryScreen() {
  const s = useStyles(createStyles);
  const { trades, settings, portfolio, updateTrade, deleteTrade, restoreTrade } = useAppData();
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<Trade | null>(null);
  const [toast, setToast] = useState<{ message: string; trade?: Trade } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, trade?: Trade) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, trade });
    timer.current = setTimeout(() => setToast(null), 4000);
  };

  const sections = useMemo(() => {
    const visible = sortTradesChronologically(trades)
      .reverse()
      .filter((t) => filter === 'all' || t.type === filter);
    const groups: { month: string; items: Trade[] }[] = [];
    for (const t of visible) {
      const month = t.date.slice(0, 7);
      const last = groups[groups.length - 1];
      if (last && last.month === month) last.items.push(t);
      else groups.push({ month, items: [t] });
    }
    return groups;
  }, [trades, filter]);

  const oversold = new Set(portfolio.oversoldTradeIds);

  return (
    <View style={{ flex: 1 }}>
      <Screen title="History">
        <ChipRow>
          {FILTERS.map((f) => (
            <Chip key={f.value} label={f.label} active={filter === f.value} onPress={() => setFilter(f.value)} />
          ))}
        </ChipRow>
        <View style={{ height: 12 }} />

        {sections.length === 0 ? (
          <Card>
            <Text style={s.empty}>
              {trades.length === 0 ? 'Transactions you log will show up here.' : 'No transactions of this type yet.'}
            </Text>
          </Card>
        ) : (
          sections.map((sec) => (
            <View key={sec.month}>
              <Text style={s.month}>{formatMonth(sec.month)}</Text>
              {sec.items.map((t) => {
                const incoming = t.type === 'buy' || t.type === 'receive';
                const pricePerBtc = (t.type === 'buy' || t.type === 'sell') && t.sats > 0 ? (t.amountPhp * SATS_PER_BTC) / t.sats : 0;
                const bad = oversold.has(t.id);
                return (
                  <TouchableOpacity key={t.id} onPress={() => setEditing(t)} accessibilityRole="button" accessibilityHint="Opens the transaction to edit">
                    <Card style={[s.row, bad && s.rowBad]}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={s.rowTitle} numberOfLines={1}>
                          {TYPE_LABEL[t.type]} · {t.source}
                        </Text>
                        <Text style={s.rowSub} numberOfLines={1}>
                          {formatDayShort(t.date)}
                          {pricePerBtc ? ` · ${formatPesoShort(pricePerBtc)}/BTC` : ''}
                          {t.note ? ` · ${t.note}` : ''}
                        </Text>
                        {bad ? <Text style={s.badText}>More than you held at the time</Text> : null}
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[s.rowAmount, incoming ? s.pos : s.neg]}>
                          {incoming ? '+' : '−'}
                          {formatAmount(t.sats, settings.unit)}
                        </Text>
                        <Text style={s.rowSub}>{t.type === 'send' ? 'transfer' : formatPeso(t.amountPhp)}</Text>
                      </View>
                    </Card>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))
        )}
      </Screen>

      <EditTradeModal
        trade={editing}
        onClose={() => setEditing(null)}
        onSave={(t) => {
          updateTrade(t);
          setEditing(null);
          showToast('Changes saved');
        }}
        onDelete={(t) => {
          const removed = deleteTrade(t.id);
          setEditing(null);
          showToast('Transaction deleted', removed);
        }}
      />
      <Toast
        visible={!!toast}
        message={toast?.message ?? ''}
        onUndo={
          toast?.trade
            ? () => {
                restoreTrade(toast.trade!);
                setToast(null);
              }
            : undefined
        }
      />
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    month: { fontSize: 13, fontWeight: '700', color: theme.textMuted, marginBottom: 8, marginTop: 4 },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, marginBottom: 8 },
    rowBad: { borderColor: theme.danger, backgroundColor: theme.dangerSurface },
    rowTitle: { fontSize: 15, fontWeight: '700', color: theme.text },
    rowSub: { fontSize: 12.5, color: theme.textMuted, marginTop: 2 },
    rowAmount: { fontSize: 14, fontWeight: '800' },
    badText: { fontSize: 12, color: theme.danger, fontWeight: '700', marginTop: 4 },
    pos: { color: theme.success },
    neg: { color: theme.danger },
    empty: { color: theme.textMuted, fontSize: 14, textAlign: 'center' },
  });
