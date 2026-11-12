import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppData } from '../AppDataContext';
import { AppTheme } from '../theme';
import {
  buildScenarios,
  calculateInvestment,
  priceNeededForGain,
  SCENARIO_MULTIPLIERS,
} from '../logic/calculator.ts';
import {
  formatBtc,
  formatPct,
  formatPeso,
  formatPesoWhole,
  formatSats,
  formatSignedPeso,
  numberToInput,
  parseNumberInput,
} from '../format';
import { Card, Chip, ChipRow, Field, Label, LinkButton, Screen, Segmented, useStyles } from '../components/ui';

type Mode = 'invest' | 'needed';

export default function CalculatorScreen() {
  const s = useStyles(createStyles);
  const { quote, settings } = useAppData();
  const livePrice = quote ? Math.round(quote.php) : NaN;

  const [mode, setMode] = useState<Mode>('invest');
  const [amountText, setAmountText] = useState('');
  const [buyText, setBuyText] = useState(quote ? numberToInput(livePrice, 0) : '');
  const [buyTouched, setBuyTouched] = useState(false);
  const [targetText, setTargetText] = useState('');
  const [targetTouched, setTargetTouched] = useState(false);
  const [feeText, setFeeText] = useState(settings.defaultFeePct ? String(settings.defaultFeePct) : '');
  const [goalText, setGoalText] = useState('');

  // Keep following the live price until you type your own buy price.
  useEffect(() => {
    if (!buyTouched && quote) setBuyText(numberToInput(Math.round(quote.php), 0));
  }, [quote, buyTouched]);

  const amount = parseNumberInput(amountText);
  const buy = parseNumberInput(buyText);
  // Until you set a target, it mirrors the buy price, so the result reads "no change".
  const target = targetTouched ? parseNumberInput(targetText) : buy;
  const fee = feeText.trim() === '' ? 0 : parseNumberInput(feeText);
  const goal = parseNumberInput(goalText);

  const feeError = !(fee >= 0 && fee < 100) ? 'Enter a fee between 0 and 99.99%.' : null;
  const result = calculateInvestment({ amountPhp: amount, buyPricePhp: buy, targetPricePhp: target, feePct: fee });
  const scenarios = amount > 0 && buy > 0 && !feeError ? buildScenarios(amount, buy, fee) : [];
  const needed = mode === 'needed' && !feeError ? priceNeededForGain(amount, goal, buy, fee) : null;
  const neededBase = mode === 'needed' ? calculateInvestment({ amountPhp: amount, buyPricePhp: buy, targetPricePhp: buy, feePct: fee }) : null;

  const setTargetMultiplier = (m: number) => {
    if (!(buy > 0)) return;
    setTargetText(numberToInput(Math.round(buy * m), 0));
    setTargetTouched(true);
  };

  const gainStyle = (n: number) => (n > 0 ? s.pos : n < 0 ? s.neg : s.neutral);

  return (
    <Screen title="Calculator">
      <Segmented
        options={[
          { value: 'invest', label: 'If I invest' },
          { value: 'needed', label: 'Price needed' },
        ]}
        value={mode}
        onChange={setMode}
      />

      <Card>
        <Field
          label="Amount to invest"
          prefix="₱"
          numeric
          value={amountText}
          onChangeText={setAmountText}
          placeholder="50,000.00"
          testID="calc-amount"
        />
        <Field
          label="Buy price per BTC"
          prefix="₱"
          numeric
          decimals={0}
          value={buyText}
          onChangeText={(t) => {
            setBuyText(t);
            setBuyTouched(true);
          }}
          placeholder={quote ? numberToInput(livePrice, 0) : '6,000,000'}
          hint={!buyTouched && quote ? "Today's live price" : buyTouched ? 'Your own price' : 'Waiting for the live price…'}
          right={quote && buyTouched ? <LinkButton label="Use live price" onPress={() => setBuyTouched(false)} /> : null}
          testID="calc-buy"
        />
        <Field
          label="Exchange fee (optional)"
          suffix="%"
          numeric
          value={feeText}
          onChangeText={setFeeText}
          placeholder="0"
          error={feeError}
          hint="Charged when you buy and again when you sell."
        />

        {mode === 'invest' && result ? (
          <View style={s.highlight}>
            <Label>You'll get</Label>
            <Text style={s.big} testID="calc-btc">
              {formatBtc(result.sats)}
            </Text>
            <Text style={s.muted}>
              {formatSats(result.sats)}
              {result.buyFeePhp > 0 ? ` · after a ${formatPeso(result.buyFeePhp)} fee` : ''}
            </Text>
          </View>
        ) : null}
      </Card>

      {mode === 'invest' ? (
        <>
          <Card>
            <Field
              label="Target price per BTC"
              prefix="₱"
              numeric
              decimals={0}
              value={targetTouched ? targetText : buyText}
              onChangeText={(t) => {
                setTargetText(t);
                setTargetTouched(true);
              }}
              placeholder="7,500,000"
              right={targetTouched ? <LinkButton label="Reset" onPress={() => setTargetTouched(false)} /> : null}
              testID="calc-target"
            />
            <ChipRow>
              {SCENARIO_MULTIPLIERS.map((m) => (
                <Chip
                  key={m.label}
                  label={m.label}
                  active={buy > 0 && Math.round(buy * m.multiplier) === target}
                  onPress={() => setTargetMultiplier(m.multiplier)}
                />
              ))}
            </ChipRow>

            {result ? (
              <View style={[s.result, result.gainPhp > 0 ? s.resultUp : result.gainPhp < 0 ? s.resultDown : null]}>
                <View style={s.rowBetween}>
                  <Text style={s.muted}>Worth</Text>
                  <Text style={s.resultValue} testID="calc-worth">
                    {formatPeso(result.worthPhp)}
                  </Text>
                </View>
                <View style={[s.rowBetween, { marginTop: 6 }]}>
                  <Text style={s.muted}>{result.gainPhp < 0 ? 'Loss' : 'Gain'}</Text>
                  <Text style={[s.resultValue, gainStyle(result.gainPhp)]} testID="calc-gain">
                    {formatSignedPeso(result.gainPhp)} ({formatPct(result.gainPct)})
                  </Text>
                </View>
                {result.sellFeePhp > 0 ? (
                  <Text style={[s.small, s.muted, { marginTop: 6 }]}>After a {formatPeso(result.sellFeePhp)} fee when selling.</Text>
                ) : null}
              </View>
            ) : (
              <Text style={[s.muted, { marginTop: 14 }]}>Enter an amount and prices to see your result.</Text>
            )}
          </Card>

          {scenarios.length > 0 ? (
            <Card>
              <Label style={{ marginBottom: 6 }}>If the price moves</Label>
              {scenarios.map((sc) => (
                <View key={sc.label} style={s.scenarioRow}>
                  <Text style={s.scenarioPrice}>
                    {formatPesoWhole(sc.targetPricePhp)} <Text style={s.muted}>{sc.label}</Text>
                  </Text>
                  <Text style={[s.scenarioGain, gainStyle(sc.result.gainPhp)]}>{formatSignedPeso(sc.result.gainPhp)}</Text>
                </View>
              ))}
            </Card>
          ) : null}
        </>
      ) : (
        <Card>
          <Field
            label="I want to earn"
            prefix="₱"
            numeric
            value={goalText}
            onChangeText={setGoalText}
            placeholder="20,000.00"
            testID="calc-goal"
          />
          {needed && neededBase && buy > 0 ? (
            <View style={[s.result, s.resultUp]}>
              <Label>BTC needs to reach</Label>
              <Text style={s.big} testID="calc-needed">
                {formatPesoWhole(needed)}
              </Text>
              <Text style={s.muted}>
                {formatPct(((needed - buy) / buy) * 100)} from your buy price · you'd hold {formatSats(neededBase.sats)}
              </Text>
            </View>
          ) : amount > 0 && buy > 0 && goal >= 0 && neededBase && neededBase.sats === 0 ? (
            <Text style={[s.muted, { marginTop: 6 }]}>That amount is too small to buy a single sat.</Text>
          ) : (
            <Text style={[s.muted, { marginTop: 6 }]}>Enter an amount, a buy price and how much you want to earn.</Text>
          )}
        </Card>
      )}

      <Text style={[s.small, s.muted, { textAlign: 'center' }]}>
        Estimates only. Sats are rounded down to whole sats, like an exchange does.
      </Text>
    </Screen>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    highlight: { backgroundColor: theme.surfaceMuted, borderRadius: 12, padding: 14, marginTop: 4 },
    big: { fontSize: 24, fontWeight: '800', color: theme.text, marginTop: 4, marginBottom: 2 },
    result: { borderRadius: 12, padding: 14, marginTop: 14, backgroundColor: theme.surfaceMuted },
    resultUp: { backgroundColor: theme.successSurface },
    resultDown: { backgroundColor: theme.dangerSurface },
    resultValue: { fontSize: 17, fontWeight: '800', color: theme.text },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
    scenarioRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    scenarioPrice: { fontSize: 14, fontWeight: '700', color: theme.text },
    scenarioGain: { fontSize: 14, fontWeight: '800' },
    muted: { color: theme.textMuted, fontSize: 14 },
    small: { fontSize: 12.5 },
    pos: { color: theme.success },
    neg: { color: theme.danger },
    neutral: { color: theme.text },
  });
