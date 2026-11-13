import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppData } from '../AppDataContext';
import { AppTheme } from '../theme';
import { measureFee, roundTripPct } from '../logic/fees.ts';
import { formatPct, formatPesoWhole, parseNumberInput, relativeTime } from '../format';
import { Button, Field, Label, LinkButton, Segmented, useStyles } from './ui';

type Method = 'measure' | 'type';

interface Props {
  /** Platform being measured; null hides the popup. */
  source: string | null;
  onClose: () => void;
  /** Called after saving, with the fee % now stored for this platform. */
  onSaved?: (feePct: number) => void;
}

export default function MeasureFeeModal({ source, onClose, onSaved }: Props) {
  const s = useStyles(createStyles);
  const { quote, refreshQuote, quoteLoading, settings, updateSettings } = useAppData();
  const [method, setMethod] = useState<Method>('measure');
  const [amountText, setAmountText] = useState('1,000');
  const [btcText, setBtcText] = useState('');
  const [typedText, setTypedText] = useState('');

  // Fresh form, and a fresh market price, each time the popup opens for a platform.
  useEffect(() => {
    if (!source) return;
    setMethod('measure');
    setAmountText('1,000');
    setBtcText('');
    const saved = settings.sourceFees[source];
    setTypedText(saved != null ? String(saved) : '');
    refreshQuote();
  }, [source]);

  if (!source) return null;

  const amount = parseNumberInput(amountText);
  const btc = parseNumberInput(btcText);
  const result = quote && btcText.trim() !== '' ? measureFee(amount, btc, quote.php) : null;
  const typed = typedText.trim() === '' ? NaN : Number(typedText);
  const typedValid = Number.isFinite(typed) && typed >= 0 && typed < 100;
  const saved = settings.sourceFees[source];

  const save = (pct: number) => {
    const rounded = Math.round(pct * 100) / 100;
    updateSettings({ sourceFees: { ...settings.sourceFees, [source]: rounded } });
    onSaved?.(rounded);
    onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={s.header}>
              <Text style={s.title}>{source} fee</Text>
              <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button">
                <Text style={s.close}>Close</Text>
              </TouchableOpacity>
            </View>
            {saved != null ? <Text style={[s.muted, { marginBottom: 10 }]}>Saved now: {saved}%</Text> : null}

            <Segmented<Method>
              options={[
                { value: 'measure', label: 'Measure it' },
                { value: 'type', label: 'I know it' },
              ]}
              value={method}
              onChange={setMethod}
            />

            {method === 'measure' ? (
              <>
                <Text style={s.steps}>
                  1. In {source}, start buying bitcoin for the amount below. Don't confirm.{'\n'}
                  2. Type the BTC it says you'll get. MySATS compares it with the market price.
                </Text>
                <Field label="Amount in the buy screen" prefix="₱" numeric value={amountText} onChangeText={setAmountText} />
                <Field
                  label="BTC it says you'll get"
                  suffix="BTC"
                  numeric
                  decimals={9}
                  value={btcText}
                  onChangeText={setBtcText}
                  placeholder="0.000216"
                  testID="measure-btc"
                />
                <View style={s.marketRow}>
                  <Text style={s.muted}>
                    Market price {quote ? formatPesoWhole(quote.php) : '—'}
                    {quote ? ` · ${relativeTime(quote.fetchedAt)}` : ''}
                  </Text>
                  <LinkButton label={quoteLoading ? 'Updating…' : 'Update'} onPress={refreshQuote} />
                </View>

                {result && result.kind !== 'invalid' ? (
                  <View style={[s.result, result.kind !== 'ok' && s.resultWarn]}>
                    {result.kind === 'ok' ? (
                      <>
                        <Label>{source} charges about</Label>
                        <Text style={s.big} testID="measure-fee">
                          {formatPct(result.measurement.feePct, false)}
                        </Text>
                        <Text style={s.muted}>
                          You pay {formatPesoWhole(result.measurement.effectivePricePhp)} per BTC vs the market's{' '}
                          {formatPesoWhole(quote!.php)}. Buying and selling back would cost about{' '}
                          {formatPct(roundTripPct(result.measurement.feePct), false)}.
                        </Text>
                      </>
                    ) : result.kind === 'better-than-market' ? (
                      <Text style={s.warn}>
                        That's more BTC than the market price gives, so something's off. Check the numbers, tap Update
                        for a fresh market price, and try again.
                      </Text>
                    ) : (
                      <Text style={s.warn}>
                        That works out to {formatPct(result.measurement.feePct, false)}, which is very unlikely. Check the
                        BTC amount for a missing zero.
                      </Text>
                    )}
                  </View>
                ) : null}

                <Button
                  label={result?.kind === 'ok' ? `Save ${formatPct(result.measurement.feePct, false)} for ${source}` : 'Save'}
                  onPress={() => {
                    if (result?.kind === 'ok') save(result.measurement.feePct);
                  }}
                  variant={result?.kind === 'ok' ? 'primary' : 'secondary'}
                  style={{ marginTop: 14 }}
                  testID="measure-save"
                />
                <Text style={[s.muted, s.small, { marginTop: 10 }]}>
                  Prices move every few seconds, so measure quickly and treat the result as an estimate. Measuring once in a
                  while keeps it accurate.
                </Text>
              </>
            ) : (
              <>
                <Field
                  label={`${source}'s fee`}
                  suffix="%"
                  numeric
                  value={typedText}
                  onChangeText={setTypedText}
                  placeholder="0.5"
                  error={typedText.trim() !== '' && !typedValid ? 'Enter a fee between 0 and 99.99%.' : null}
                  hint="Use this when the platform shows a fee, like PDAX or Coins.ph spot trading."
                />
                <Button
                  label="Save"
                  onPress={() => {
                    if (typedValid) save(typed);
                  }}
                  variant={typedValid ? 'primary' : 'secondary'}
                />
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(20,17,13,0.45)', justifyContent: 'center', padding: 16 },
    sheet: { backgroundColor: theme.card, borderRadius: 16, padding: 18, maxWidth: 520, width: '100%', alignSelf: 'center', maxHeight: '92%' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    title: { fontSize: 18, fontWeight: '800', color: theme.text },
    close: { fontSize: 15, fontWeight: '700', color: theme.primary },
    steps: { fontSize: 14, color: theme.text, lineHeight: 21, marginBottom: 12 },
    marketRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: -4 },
    result: { backgroundColor: theme.surfaceMuted, borderRadius: 12, padding: 14, marginTop: 12 },
    resultWarn: { backgroundColor: theme.dangerSurface },
    big: { fontSize: 26, fontWeight: '800', color: theme.text, marginVertical: 4 },
    muted: { color: theme.textMuted, fontSize: 14, lineHeight: 20, flexShrink: 1 },
    small: { fontSize: 12.5, lineHeight: 18 },
    warn: { color: theme.danger, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  });
