import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppTheme } from '../theme';
import { addNeededForBreakEven, afterBuyingMore, Position } from '../logic/averageDown.ts';
import { formatPct, formatPeso, formatPesoWhole, formatSignedPeso, numberToInput, parseNumberInput } from '../format';
import { Card, Chip, ChipRow, Field, Label, useStyles } from './ui';

const QUICK_ADDS = [10_000, 20_000, 40_000, 80_000];

/** "If I buy ₱X more now" and "how much to add for a break-even of ₱Y", for a position at a loss. */
export default function AverageDown({ position }: { position: Position }) {
  const s = useStyles(createStyles);
  const [addText, setAddText] = useState('');
  const [targetText, setTargetText] = useState('');

  const add = parseNumberInput(addText);
  const target = parseNumberInput(targetText);
  const now = afterBuyingMore(position, 0);
  const after = add > 0 ? afterBuyingMore(position, add) : null;
  const need = targetText.trim() !== '' ? addNeededForBreakEven(position, target) : null;
  const needResult = need?.kind === 'amount' ? afterBuyingMore(position, need.addPhp) : null;
  if (!now) return null;

  return (
    <Card>
      <Label style={{ marginBottom: 10 }}>Buying more at today's price</Label>
      <Field
        label="Amount to add"
        prefix="₱"
        numeric
        value={addText}
        onChangeText={setAddText}
        placeholder="20,000.00"
        testID="avgdown-add"
      />
      <ChipRow>
        {QUICK_ADDS.map((a) => (
          <Chip key={a} label={`₱${a / 1000}K`} active={add === a} onPress={() => setAddText(numberToInput(a))} />
        ))}
      </ChipRow>

      {after ? (
        <View style={s.result}>
          <Row label="New break-even price" value={formatPesoWhole(after.avgPricePhp)} was={formatPesoWhole(now.avgPricePhp)} />
          <Row
            label="BTC must rise"
            value={formatPct(after.riseNeededPct)}
            was={formatPct(now.riseNeededPct)}
            valueStyle={s.neg}
          />
          <Row label="Total money in BTC" value={formatPeso(after.totalCostPhp)} />
          <Row label="Bitcoin you'd have" value={`${after.totalBtc.toFixed(8)} BTC`} />
          <Row label="Still down right after buying" value={formatSignedPeso(after.unrealizedPhp)} valueStyle={s.neg} />
        </View>
      ) : null}

      <View style={s.divider} />

      <Field
        label="Break-even price you want"
        prefix="₱"
        numeric
        decimals={0}
        value={targetText}
        onChangeText={setTargetText}
        hint={`Between today's ${formatPesoWhole(position.pricePhp)} and your ${formatPesoWhole(now.avgPricePhp)}.`}
        testID="avgdown-target"
      />
      {need?.kind === 'amount' && needResult ? (
        <View style={s.result}>
          <Text style={s.muted}>You'd need to add about</Text>
          <Text style={s.big} testID="avgdown-needed">
            {formatPeso(need.addPhp)}
          </Text>
          <Text style={s.muted}>
            {formatPeso(needResult.totalCostPhp)} in BTC in total. BTC would then need to rise{' '}
            {formatPct(needResult.riseNeededPct)} instead of {formatPct(now.riseNeededPct)}.
          </Text>
        </View>
      ) : need?.kind === 'already' ? (
        <Text style={[s.muted, { marginTop: 4 }]}>Your break-even is already at or below that price, so there's nothing to add.</Text>
      ) : need?.kind === 'unreachable' ? (
        <Text style={[s.warn, { marginTop: 4 }]}>
          Buying at today's price ({formatPesoWhole(position.pricePhp)}) can bring your break-even close to it, but never to or
          below it. Try a price above {formatPesoWhole(position.pricePhp)}.
        </Text>
      ) : null}

      <Text style={[s.muted, s.small, { marginTop: 14 }]}>
        Buying more lowers the price BTC has to reach, but it doesn't erase the loss: you're still down the same amount
        right after buying, and if BTC keeps falling you lose on a bigger amount. Exchange fees and spread aren't included.
      </Text>
    </Card>
  );

  function Row({ label, value, was, valueStyle }: { label: string; value: string; was?: string; valueStyle?: object }) {
    return (
      <View style={s.row}>
        <Text style={s.muted}>{label}</Text>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[s.value, valueStyle]}>{value}</Text>
          {was ? <Text style={[s.muted, s.small]}>was {was}</Text> : null}
        </View>
      </View>
    );
  }
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    result: { backgroundColor: theme.surfaceMuted, borderRadius: 12, padding: 14, marginTop: 12 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 5, gap: 8 },
    divider: { height: 1, backgroundColor: theme.border, marginVertical: 16 },
    big: { fontSize: 24, fontWeight: '800', color: theme.text, marginVertical: 4 },
    value: { fontSize: 14, fontWeight: '800', color: theme.text },
    muted: { color: theme.textMuted, fontSize: 14, flexShrink: 1 },
    small: { fontSize: 12.5, lineHeight: 18 },
    neg: { color: theme.danger },
    warn: { color: theme.danger, fontSize: 14, fontWeight: '600' },
  });
