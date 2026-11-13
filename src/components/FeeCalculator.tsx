import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppData } from '../AppDataContext';
import { AppTheme } from '../theme';
import { feeBreakdown } from '../logic/fees.ts';
import { formatBtc, formatPct, formatPeso, formatPesoWhole, parseNumberInput } from '../format';
import { Card, Field, Label, useStyles } from './ui';

interface Props {
  amountPhp: number;
  buyPricePhp: number;
  feePct: number;
  /** Platform whose fee is in use, if picked from a chip. */
  feeSource: string | null;
  /** Use a platform's saved fee (from the comparison list). */
  onPickPlatform: (source: string, feePct: number) => void;
}

/** Where every peso goes in fees when you buy, and sell, plus a side-by-side of saved platform fees. */
export default function FeeCalculator({ amountPhp, buyPricePhp, feePct, feeSource, onPickPlatform }: Props) {
  const s = useStyles(createStyles);
  const { settings } = useAppData();
  const [sellText, setSellText] = useState('');

  const sellPrice = sellText.trim() === '' ? buyPricePhp : parseNumberInput(sellText);
  const b = feeBreakdown(amountPhp, feePct, buyPricePhp, sellPrice);
  const sameSellPrice = sellText.trim() === '';

  const platforms = Object.entries(settings.sourceFees)
    .filter(([name]) => settings.sources.includes(name))
    .map(([name, pct]) => ({ name, pct, b: feeBreakdown(amountPhp, pct, buyPricePhp) }))
    .sort((x, y) => x.pct - y.pct);

  if (!(amountPhp > 0) || !(buyPricePhp > 0)) {
    return (
      <Card>
        <Text style={s.muted}>Enter an amount and a buy price above to see where your money goes in fees.</Text>
      </Card>
    );
  }

  return (
    <>
      {b ? (
        <>
          <Card>
            <Label style={{ marginBottom: 8 }}>
              When you buy{feeSource ? ` on ${feeSource}` : ''}
            </Label>
            <Row s={s} label="You pay" value={formatPeso(b.amountPhp)} />
            <Row s={s} label={`Fee (${formatPct(feePct, false)})`} value={`−${formatPeso(b.buyFeePhp)}`} valueStyle={b.buyFeePhp > 0 ? s.neg : undefined} />
            <Row s={s} label="Becomes bitcoin" value={formatPeso(b.investedPhp)} strong />
            <Row s={s} label="You get" value={formatBtc(b.sats)} />
          </Card>

          <Card>
            <Label style={{ marginBottom: 8 }}>When you sell</Label>
            <Field
              label="Sell price per BTC"
              prefix="₱"
              numeric
              decimals={0}
              value={sellText}
              onChangeText={setSellText}
              hint={sameSellPrice ? `Empty = sell right away at ${formatPesoWhole(buyPricePhp)}.` : undefined}
              testID="fees-sell"
            />
            <Row s={s} label="Your bitcoin is worth" value={formatPeso(b.sellGrossPhp)} />
            <Row s={s} label={`Fee (${formatPct(feePct, false)})`} value={`−${formatPeso(b.sellFeePhp)}`} valueStyle={b.sellFeePhp > 0 ? s.neg : undefined} />
            <Row s={s} label="You get back" value={formatPeso(b.receivePhp)} strong />
          </Card>

          <Card style={b.totalFeesPhp > 0 ? s.warnCard : undefined}>
            <Label>Total fees, buying and selling</Label>
            <Text style={[s.big, b.totalFeesPhp > 0 && s.neg]} testID="fees-total">
              {formatPeso(b.totalFeesPhp)}
            </Text>
            <Text style={s.muted}>{formatPct(b.totalFeesPct, false)} of the {formatPeso(b.amountPhp)} you put in</Text>
            <View style={s.divider} />
            <Label>Just to cover fees, BTC must rise</Label>
            <Text style={s.big} testID="fees-rise">
              {formatPct(b.riseToCoverPct)}
            </Text>
            <Text style={s.muted}>
              To {formatPesoWhole(b.breakEvenPricePhp)} from {formatPesoWhole(buyPricePhp)}. Below that, selling loses money even
              though the price went up.
            </Text>
          </Card>
        </>
      ) : (
        <Card>
          <Text style={s.muted}>Check the fee and prices above.</Text>
        </Card>
      )}

      <Card>
        <Label style={{ marginBottom: 4 }}>Compare platforms for {formatPeso(amountPhp)}</Label>
        {platforms.length === 0 ? (
          <Text style={s.muted}>
            No platform fees saved yet. Tap a platform under "Where you buy" above to measure its fee, and it'll show up
            here.
          </Text>
        ) : (
          <>
            <View style={[s.compareRow, s.compareHead]}>
              <Text style={[s.small, s.muted, { flex: 1 }]}>Platform</Text>
              <Text style={[s.small, s.muted, s.colFees]}>Buy + sell fees</Text>
              <Text style={[s.small, s.muted, s.colRise]}>Rise to even</Text>
            </View>
            {platforms.map((p) => (
              <TouchableOpacity
                key={p.name}
                onPress={() => onPickPlatform(p.name, p.pct)}
                accessibilityRole="button"
                accessibilityHint="Uses this platform's fee above"
                style={[s.compareRow, feeSource === p.name && s.compareActive]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.value}>{p.name}</Text>
                  <Text style={[s.small, s.muted]}>{p.pct}%</Text>
                </View>
                <Text style={[s.value, s.colFees, s.neg]}>{p.b ? formatPeso(p.b.totalFeesPhp) : '—'}</Text>
                <Text style={[s.value, s.colRise]}>{p.b ? formatPct(p.b.riseToCoverPct) : '—'}</Text>
              </TouchableOpacity>
            ))}
            <Text style={[s.small, s.muted, { marginTop: 8 }]}>
              Selling right away at the same price. Tap a platform to use its fee.
            </Text>
          </>
        )}
      </Card>
    </>
  );
}

function Row({
  s,
  label,
  value,
  valueStyle,
  strong,
}: {
  s: ReturnType<typeof createStyles>;
  label: string;
  value: string;
  valueStyle?: object;
  strong?: boolean;
}) {
  return (
    <View style={s.row}>
      <Text style={s.muted}>{label}</Text>
      <Text style={[strong ? s.valueStrong : s.value, valueStyle]}>{value}</Text>
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5, gap: 8 },
    value: { fontSize: 14, fontWeight: '700', color: theme.text },
    valueStrong: { fontSize: 16, fontWeight: '800', color: theme.text },
    big: { fontSize: 24, fontWeight: '800', color: theme.text, marginVertical: 4 },
    muted: { color: theme.textMuted, fontSize: 14, lineHeight: 20, flexShrink: 1 },
    small: { fontSize: 12.5, lineHeight: 17 },
    neg: { color: theme.danger },
    divider: { height: 1, backgroundColor: theme.border, marginVertical: 14 },
    warnCard: { backgroundColor: theme.dangerSurface, borderColor: theme.danger },
    compareRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 6,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      borderRadius: 8,
    },
    compareHead: { borderTopWidth: 0, paddingVertical: 4 },
    compareActive: { backgroundColor: theme.primarySurface },
    colFees: { width: 104, textAlign: 'right' },
    colRise: { width: 84, textAlign: 'right' },
  });
