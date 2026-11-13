import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAppData } from '../AppDataContext';
import { AppTheme, useTheme } from '../theme';
import {
  averageBuyPrice,
  datesNearPrice,
  highestPoint,
  impliedBuyPrice,
  LOOKBACK_DAYS,
  priceOnDate,
  riseNeededPct,
} from '../logic/lookback.ts';
import { calculateInvestment } from '../logic/calculator.ts';
import {
  formatDate,
  formatDayShort,
  formatPct,
  formatPeso,
  formatPesoShort,
  formatPesoWhole,
  formatSats,
  formatSignedPeso,
  isValidIsoDate,
  parseNumberInput,
  todayIso,
} from '../format';
import { Button, Card, Field, Label, LinkButton, Segmented, useStyles } from './ui';

type Known = 'btc' | 'loss' | 'date';

interface Props {
  /** Opens "If I invest" with this amount and buy price, and today's price as the target. */
  onUseInCalculator: (amountPhp: number, buyPricePhp: number) => void;
}

export default function LookBack({ onUseInCalculator }: Props) {
  const s = useStyles(createStyles);
  const theme = useTheme();
  const { quote, history, loadHistory } = useAppData();
  const year = history[LOOKBACK_DAYS];
  const points = year?.points ?? [];

  const [known, setKnown] = useState<Known>('btc');
  const [amountText, setAmountText] = useState('');
  const [lossText, setLossText] = useState('');
  const [btcText, setBtcText] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    loadHistory(LOOKBACK_DAYS);
  }, [loadHistory]);

  const amount = parseNumberInput(amountText);
  const loss = parseNumberInput(lossText);
  const btc = parseNumberInput(btcText);
  const now = quote?.php ?? NaN;

  // --- Work out the buy price from whichever thing you know ---
  let buyPrice: number | null = null;
  let dateError: string | null = null;
  let lossError: string | null = null;
  let btcError: string | null = null;
  let foundDate: string | null = null;

  if (known === 'btc') {
    if (btcText.trim() !== '' && !(btc > 0)) btcError = 'Enter the bitcoin amount, e.g. 0.007002941.';
    else buyPrice = averageBuyPrice(amount, btc);
  } else if (known === 'date') {
    if (date.trim() !== '') {
      if (!isValidIsoDate(date)) dateError = 'Use the format YYYY-MM-DD, e.g. 2026-06-15.';
      else if (date > todayIso()) dateError = 'That date is in the future.';
      else if (points.length > 1) {
        const r = priceOnDate(points, date);
        if (r.kind === 'found') {
          buyPrice = r.pricePhp;
          foundDate = r.date;
        } else if (r.kind === 'too-old') {
          dateError = `Free price history only goes back to ${formatDate(r.earliest)}. Check that buy in your exchange's transaction history.`;
        }
      }
    }
  } else if (lossText.trim() !== '' && amount > 0) {
    if (!(loss >= 0)) lossError = 'Enter how much you are down, e.g. 8,000.';
    else if (loss >= amount) lossError = "The loss can't be as big as what you put in.";
    else buyPrice = impliedBuyPrice(amount, loss, now);
  }

  const ranges = known !== 'date' && buyPrice ? datesNearPrice(points, buyPrice, 2) : [];
  const peak = highestPoint(points);
  const position =
    buyPrice && amount > 0 && now > 0
      ? calculateInvestment({ amountPhp: amount, buyPricePhp: buyPrice, targetPricePhp: Math.round(now), feePct: 0 })
      : null;
  // With "My BTC" the exact holding is known, so value it directly instead of re-deriving sats.
  const exactValue = known === 'btc' && btc > 0 && now > 0 ? Math.round(btc * now * 100) / 100 : null;

  const historyState =
    !year || (year.loading && points.length < 2) ? 'loading' : points.length < 2 ? 'error' : 'ready';

  return (
    <>
      <Card>
        <Label style={{ marginBottom: 8 }}>What do you remember?</Label>
        <Segmented<Known>
          options={[
            { value: 'btc', label: 'My BTC' },
            { value: 'loss', label: 'My loss' },
            { value: 'date', label: 'Buy date' },
          ]}
          value={known}
          onChange={setKnown}
        />
        <Field
          label={
            known === 'btc' ? 'Total cost' : known === 'loss' ? 'Amount you put in' : 'Amount you put in (optional)'
          }
          prefix="₱"
          numeric
          value={amountText}
          onChangeText={setAmountText}
          placeholder={known === 'btc' ? '39,999.99' : '50,000.00'}
          hint={known === 'btc' ? 'Shown as "Total cost" under My Portfolio in Maya.' : undefined}
          testID="lookback-amount"
        />
        {known === 'btc' ? (
          <Field
            label="Bitcoin you have"
            suffix="BTC"
            numeric
            decimals={9}
            value={btcText}
            onChangeText={setBtcText}
            placeholder="0.007002941"
            error={btcError}
            hint="The BTC amount under your portfolio value, e.g. 0.007002941 BTC."
            testID="lookback-btc"
          />
        ) : known === 'loss' ? (
          <Field
            label="How much you're down now"
            prefix="₱"
            numeric
            value={lossText}
            onChangeText={setLossText}
            placeholder="8,000.00"
            error={lossError}
            hint="The loss your exchange app shows today."
            testID="lookback-loss"
          />
        ) : (
          <Field
            label="Date you bought"
            value={date}
            onChangeText={setDate}
            placeholder="2026-06-15"
            keyboardType="numbers-and-punctuation"
            error={dateError}
            hint="Any day in the past year."
            testID="lookback-date"
          />
        )}
      </Card>

      {historyState === 'loading' ? (
        <Card style={s.center}>
          <ActivityIndicator color={theme.primary} />
          <Text style={[s.muted, { marginTop: 8 }]}>Loading a year of bitcoin prices…</Text>
        </Card>
      ) : historyState === 'error' ? (
        <Card style={s.center}>
          <Text style={[s.muted, { textAlign: 'center', marginBottom: 8 }]}>
            {year?.error ?? "Couldn't load past prices."}
          </Text>
          <LinkButton label="Try again" onPress={() => loadHistory(LOOKBACK_DAYS, true)} />
        </Card>
      ) : buyPrice ? (
        <Card>
          <Label>
            {known === 'date' && foundDate
              ? `BTC price on ${formatDate(foundDate)}`
              : known === 'btc'
                ? 'Your average buy price'
                : 'You bought at about'}
          </Label>
          <Text style={s.big} testID="lookback-buy-price">
            {formatPesoWhole(buyPrice)}
          </Text>
          <Text style={[s.muted, s.small]}>
            {known === 'date'
              ? "CoinGecko's price at 8:00 AM that day. Your exchange's price may be a little different."
              : known === 'btc'
                ? 'Total cost ÷ bitcoin you have, so it already includes any fees or spread you paid.'
                : `Worked out from your loss and today's price of ${formatPesoWhole(now)}. Fees can make it slightly off.`}
          </Text>

          {known !== 'date' ? (
            <View style={s.section}>
              <Label style={{ marginBottom: 6 }}>When BTC was around that price</Label>
              {ranges.length > 0 ? (
                ranges.map((r) => (
                  <View key={r.from} style={s.rangeRow}>
                    <Text style={s.rangeDate}>
                      {r.from === r.to ? formatDate(r.from) : `${formatDayShort(r.from)} – ${formatDate(r.to)}`}
                    </Text>
                    <Text style={s.muted}>
                      {r.lowPhp === r.highPhp
                        ? formatPesoShort(r.lowPhp)
                        : `${formatPesoShort(r.lowPhp)}–${formatPesoShort(r.highPhp)}`}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={s.muted}>
                  BTC wasn't within 2% of that price in the past year. You may have bought more than a year ago, or fees
                  made your loss bigger than the price drop alone.
                </Text>
              )}
            </View>
          ) : null}

          <View style={s.section}>
            <View style={s.rowBetween}>
              <Text style={s.muted}>Today's price</Text>
              <Text style={s.value}>{now > 0 ? formatPesoWhole(now) : '—'}</Text>
            </View>
            {now > 0 ? (
              buyPrice > now ? (
                <View style={[s.rowBetween, { marginTop: 8 }]}>
                  <Text style={s.muted}>To break even, BTC must reach</Text>
                  <Text style={s.value}>
                    {formatPesoWhole(buyPrice)} <Text style={s.neg}>({formatPct(riseNeededPct(buyPrice, now))})</Text>
                  </Text>
                </View>
              ) : (
                <Text style={[s.pos, { marginTop: 8, fontWeight: '700' }]}>Today's price is above that, so you're in profit.</Text>
              )
            ) : null}
          </View>

          {position ? (() => {
            const worth = exactValue ?? position.worthPhp;
            const gain = Math.round((worth - amount) * 100) / 100;
            return (
              <View style={s.section}>
                {known !== 'btc' ? (
                  <View style={[s.rowBetween, { marginBottom: 8 }]}>
                    <Text style={s.muted}>You got about</Text>
                    <Text style={s.value}>{formatSats(position.sats)}</Text>
                  </View>
                ) : null}
                <View style={s.rowBetween}>
                  <Text style={s.muted}>Worth today</Text>
                  <Text style={s.value}>{formatPeso(worth)}</Text>
                </View>
                <View style={[s.rowBetween, { marginTop: 8 }]}>
                  <Text style={s.muted}>{gain < 0 ? 'Loss' : 'Gain'}</Text>
                  <Text style={[s.value, gain < 0 ? s.neg : s.pos]}>
                    {formatSignedPeso(gain)} ({formatPct((gain / amount) * 100)})
                  </Text>
                </View>
                <Text style={[s.muted, s.small, { marginTop: 8 }]}>
                  At CoinGecko's price. Your exchange app uses its own price, so its numbers can differ slightly.
                </Text>
              </View>
            );
          })() : null}

          {amount > 0 ? (
            <Button
              label="Try other prices in the calculator"
              variant="secondary"
              onPress={() => onUseInCalculator(amount, buyPrice!)}
              style={{ marginTop: 14 }}
            />
          ) : null}
        </Card>
      ) : null}

      {historyState === 'ready' && peak ? (
        <Text style={[s.muted, s.small, { textAlign: 'center', marginBottom: 8 }]}>
          Highest price in the past year: {formatPesoWhole(peak.pricePhp)} on {formatDate(peak.date)}.
        </Text>
      ) : null}
    </>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    center: { alignItems: 'center', paddingVertical: 24 },
    big: { fontSize: 26, fontWeight: '800', color: theme.text, marginTop: 4, marginBottom: 4 },
    section: { borderTopWidth: 1, borderTopColor: theme.border, marginTop: 14, paddingTop: 12 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
    rangeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    rangeDate: { fontSize: 14, fontWeight: '700', color: theme.text },
    value: { fontSize: 14, fontWeight: '800', color: theme.text },
    muted: { color: theme.textMuted, fontSize: 14 },
    small: { fontSize: 12.5, lineHeight: 18 },
    pos: { color: theme.success },
    neg: { color: theme.danger },
  });
