import React, { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useAppData } from '../AppDataContext';
import { AppTheme, useTheme } from '../theme';
import { SATS_PER_BTC } from '../logic/units.ts';
import {
  buildScenarios,
  calculateInvestment,
  calculateWithHoldings,
  Holdings,
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
import LookBack from '../components/LookBack';
import MeasureFeeModal from '../components/MeasureFeeModal';

type Mode = 'invest' | 'needed' | 'lookback';

export default function CalculatorScreen() {
  const s = useStyles(createStyles);
  const theme = useTheme();
  const { quote, settings, portfolio } = useAppData();
  const livePrice = quote ? Math.round(quote.php) : NaN;

  const [mode, setMode] = useState<Mode>('invest');
  const [amountText, setAmountText] = useState('');
  const [buyText, setBuyText] = useState(quote ? numberToInput(livePrice, 0) : '');
  const [buyTouched, setBuyTouched] = useState(false);
  const [targetText, setTargetText] = useState('');
  const [targetTouched, setTargetTouched] = useState(false);
  const [feeText, setFeeText] = useState(settings.defaultFeePct ? String(settings.defaultFeePct) : '');
  const [goalText, setGoalText] = useState('');
  /** Platform whose saved fee is in the fee box (null when typed by hand). */
  const [feeSource, setFeeSource] = useState<string | null>(null);
  const [measuring, setMeasuring] = useState<string | null>(null);
  const [includeHoldings, setIncludeHoldings] = useState(false);
  /** Type holdings by hand even though the Log has some. */
  const [typeHoldings, setTypeHoldings] = useState(false);
  const [holdCostText, setHoldCostText] = useState('');
  const [holdBtcText, setHoldBtcText] = useState('');

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

  // --- Bitcoin you already have (from the Log, or typed in) ---
  const logged = portfolio.holdingsSats > 0;
  const holdBtc = parseNumberInput(holdBtcText);
  const holdCost = parseNumberInput(holdCostText);
  const holdings: Holdings | null = !includeHoldings
    ? null
    : logged && !typeHoldings
      ? { sats: portfolio.holdingsSats, costPhp: portfolio.costBasisPhp }
      : holdBtc > 0 && holdCost >= 0
        ? { sats: Math.round(holdBtc * SATS_PER_BTC), costPhp: holdCost }
        : null;
  const combined =
    holdings && !feeError
      ? calculateWithHoldings({ amountPhp: amount > 0 ? amount : 0, buyPricePhp: buy, targetPricePhp: target, feePct: fee }, holdings)
      : null;
  const scenarioRows: { label: string; targetPricePhp: number; worthPhp: number; gainPhp: number }[] = holdings
    ? buy > 0 && !feeError
      ? SCENARIO_MULTIPLIERS.flatMap(({ label, multiplier }) => {
          const targetPricePhp = Math.round(buy * multiplier);
          const r = calculateWithHoldings(
            { amountPhp: amount > 0 ? amount : 0, buyPricePhp: buy, targetPricePhp, feePct: fee },
            holdings
          );
          return r ? [{ label, targetPricePhp, worthPhp: r.worthPhp, gainPhp: r.gainPhp }] : [];
        })
      : []
    : scenarios.map((sc) => ({ label: sc.label, targetPricePhp: sc.targetPricePhp, worthPhp: sc.result.worthPhp, gainPhp: sc.result.gainPhp }));

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
          { value: 'lookback', label: 'Look back' },
        ]}
        value={mode}
        onChange={setMode}
      />

      {mode === 'lookback' ? (
        <LookBack
          onUseInCalculator={(amountPhp, buyPricePhp) => {
            setAmountText(numberToInput(amountPhp));
            setBuyText(numberToInput(buyPricePhp, 0));
            setBuyTouched(true);
            if (quote) {
              setTargetText(numberToInput(Math.round(quote.php), 0));
              setTargetTouched(true);
            }
            setMode('invest');
          }}
        />
      ) : (
      <>
      <Card>
        <Field
          label={includeHoldings && mode === 'invest' ? 'Amount to add' : 'Amount to invest'}
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
          onChangeText={(t) => {
            setFeeText(t);
            setFeeSource(null);
          }}
          placeholder="0"
          error={feeError}
          hint="Charged when you buy and again when you sell."
        />
        <Text style={s.chipCaption}>Where you buy</Text>
        <ChipRow>
          {settings.sources.map((src) => {
            const saved = settings.sourceFees[src];
            return (
              <Chip
                key={src}
                label={saved != null ? `${src} ${saved}%` : src}
                active={feeSource === src}
                onPress={() => {
                  // A saved fee fills in straight away; tapping the selected platform again re-measures it.
                  if (saved != null && feeSource !== src) {
                    setFeeText(String(saved));
                    setFeeSource(src);
                  } else {
                    setMeasuring(src);
                  }
                }}
              />
            );
          })}
        </ChipRow>
        <Text style={[s.small, s.muted, { marginTop: 6, marginBottom: 4 }]}>
          Tap a platform to use its fee. No fee saved yet? Tapping it lets you measure it from a buy quote.
        </Text>

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
            <View style={s.divider} />
            <Label>
              {targetTouched ? `In pesos if you sell at ${formatPesoWhole(target)}` : 'In pesos if you sell at the same price'}
            </Label>
            <Text style={s.big} testID="calc-get-php">
              {formatPeso(result.worthPhp)}
            </Text>
            <Text style={[s.muted, gainStyle(result.gainPhp)]}>
              {formatSignedPeso(result.gainPhp)} ({formatPct(result.gainPct)})
              {result.buyFeePhp > 0 ? ' · after fees' : ''}
            </Text>
          </View>
        ) : null}
      </Card>

      {mode === 'invest' ? (
        <>
          <Card>
            <View style={s.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.switchLabel}>Include the bitcoin I already have</Text>
                <Text style={[s.small, s.muted]}>See what everything together is worth at the target price.</Text>
              </View>
              <Switch
                value={includeHoldings}
                onValueChange={setIncludeHoldings}
                trackColor={{ true: theme.primary, false: theme.disabled }}
                accessibilityLabel="Include the bitcoin I already have"
              />
            </View>
            {includeHoldings ? (
              logged && !typeHoldings ? (
                <View style={s.highlight}>
                  <Label>From your Log</Label>
                  <Text style={s.resultValue}>{formatBtc(portfolio.holdingsSats)}</Text>
                  <Text style={s.muted}>Cost {formatPeso(portfolio.costBasisPhp)}</Text>
                  <View style={{ marginTop: 8 }}>
                    <LinkButton label="Type different numbers" onPress={() => setTypeHoldings(true)} />
                  </View>
                </View>
              ) : (
                <View style={{ marginTop: 12 }}>
                  <Field
                    label="Total cost"
                    prefix="₱"
                    numeric
                    value={holdCostText}
                    onChangeText={setHoldCostText}
                    placeholder="39,999.99"
                    testID="calc-hold-cost"
                  />
                  <Field
                    label="Bitcoin you have"
                    suffix="BTC"
                    numeric
                    decimals={9}
                    value={holdBtcText}
                    onChangeText={setHoldBtcText}
                    placeholder="0.007002941"
                    hint={
                      logged
                        ? undefined
                        : 'From your exchange app. Log your buys in the Log tab and this fills in by itself.'
                    }
                    testID="calc-hold-btc"
                  />
                  {logged ? <LinkButton label="Use my Log instead" onPress={() => setTypeHoldings(false)} /> : null}
                </View>
              )
            ) : null}
          </Card>

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

            {combined ? (
              <View style={[s.result, combined.gainPhp > 0 ? s.resultUp : combined.gainPhp < 0 ? s.resultDown : null]}>
                <Label style={{ marginBottom: 8 }}>
                  {combined.newSats > 0 ? 'What you have + this buy' : 'What you have'}, at {formatPesoWhole(target)}
                </Label>
                <View style={s.rowBetween}>
                  <Text style={s.muted}>Bitcoin</Text>
                  <Text style={s.resultValue}>{formatBtc(combined.totalSats)}</Text>
                </View>
                <View style={[s.rowBetween, { marginTop: 6 }]}>
                  <Text style={s.muted}>Total put in</Text>
                  <Text style={s.resultValue}>{formatPeso(combined.totalCostPhp)}</Text>
                </View>
                <View style={[s.rowBetween, { marginTop: 6 }]}>
                  <Text style={s.muted}>All of it worth</Text>
                  <Text style={s.resultValue} testID="calc-combined-worth">
                    {formatPeso(combined.worthPhp)}
                  </Text>
                </View>
                <View style={[s.rowBetween, { marginTop: 6 }]}>
                  <Text style={s.muted}>{combined.gainPhp < 0 ? 'Loss' : 'Gain'}</Text>
                  <Text style={[s.resultValue, gainStyle(combined.gainPhp)]} testID="calc-combined-gain">
                    {formatSignedPeso(combined.gainPhp)} ({formatPct(combined.gainPct)})
                  </Text>
                </View>
                <View style={[s.rowBetween, { marginTop: 6 }]}>
                  <Text style={s.muted}>Break-even price</Text>
                  <Text style={s.resultValue}>{formatPesoWhole(combined.breakEvenPricePhp)}</Text>
                </View>
                {fee > 0 ? <Text style={[s.small, s.muted, { marginTop: 6 }]}>After fees.</Text> : null}
              </View>
            ) : includeHoldings ? (
              <Text style={[s.muted, { marginTop: 14 }]}>Enter your total cost and bitcoin to include them.</Text>
            ) : result ? (
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

          {scenarioRows.length > 0 ? (
            <Card>
              <Label style={{ marginBottom: 6 }}>
                {holdings ? 'If the price moves (everything together)' : 'If the price moves'}
              </Label>
              {scenarioRows.map((row) => (
                <View key={row.label} style={s.scenarioRow}>
                  <Text style={s.scenarioPrice}>
                    {formatPesoWhole(row.targetPricePhp)} <Text style={s.muted}>{row.label}</Text>
                  </Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.scenarioWorth}>{formatPeso(row.worthPhp)}</Text>
                    <Text style={[s.scenarioGain, gainStyle(row.gainPhp)]}>{formatSignedPeso(row.gainPhp)}</Text>
                  </View>
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
      </>
      )}

      <Text style={[s.small, s.muted, { textAlign: 'center' }]}>
        Estimates only. Sats are rounded down to whole sats, like an exchange does.
      </Text>
      <MeasureFeeModal
        source={measuring}
        onClose={() => setMeasuring(null)}
        onSaved={(pct) => {
          setFeeText(String(pct));
          setFeeSource(measuring);
        }}
      />
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
    scenarioWorth: { fontSize: 14, fontWeight: '800', color: theme.text },
    scenarioGain: { fontSize: 12.5, fontWeight: '700', marginTop: 2 },
    divider: { height: 1, backgroundColor: theme.border, marginVertical: 12 },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    switchLabel: { fontSize: 15, fontWeight: '700', color: theme.text, marginBottom: 2 },
    chipCaption: { fontSize: 13, color: theme.textMuted, fontWeight: '600', marginTop: -4, marginBottom: 6 },
    muted: { color: theme.textMuted, fontSize: 14 },
    small: { fontSize: 12.5 },
    pos: { color: theme.success },
    neg: { color: theme.danger },
    neutral: { color: theme.text },
  });
