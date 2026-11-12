import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { NewTrade, useAppData } from '../AppDataContext';
import type { Trade, TradeType } from '../types';
import { computePortfolio, holdingsAsOf } from '../logic/portfolio.ts';
import { phpToSats, satsToPhp, SATS_PER_BTC } from '../logic/units.ts';
import {
  formatBtc,
  formatPeso,
  formatSats,
  isValidIsoDate,
  numberToInput,
  parseNumberInput,
  todayIso,
  yesterdayIso,
} from '../format';
import { useTheme } from '../theme';
import { Button, Chip, ChipRow, Field, LinkButton, Segmented } from './ui';

const TYPE_OPTIONS: { value: TradeType; label: string }[] = [
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
  { value: 'receive', label: 'Receive' },
  { value: 'send', label: 'Send' },
];

const SUBMIT_LABEL: Record<TradeType, string> = {
  buy: 'Log buy',
  sell: 'Log sell',
  receive: 'Log receive',
  send: 'Log send',
};

type Errors = Partial<Record<'amount' | 'price' | 'sats' | 'fee' | 'date' | 'source', string>>;

interface Props {
  initial?: Trade;
  submitLabel?: string;
  onSubmit: (t: NewTrade) => void;
  footer?: React.ReactNode;
}

export default function TradeForm({ initial, submitLabel, onSubmit, footer }: Props) {
  const theme = useTheme();
  const { quote, trades, settings } = useAppData();
  const lastSource = trades.length ? trades[trades.length - 1].source : settings.sources[0] ?? '';

  const [type, setType] = useState<TradeType>(initial?.type ?? 'buy');
  const [amountText, setAmountText] = useState(initial && initial.amountPhp ? numberToInput(initial.amountPhp) : '');
  const [priceText, setPriceText] = useState(() => {
    if (initial && (initial.type === 'buy' || initial.type === 'sell') && initial.sats > 0) {
      return numberToInput(Math.round((initial.amountPhp * SATS_PER_BTC) / initial.sats), 0);
    }
    return quote ? numberToInput(Math.round(quote.php), 0) : '';
  });
  const [priceTouched, setPriceTouched] = useState(!!initial);
  // Editing keeps the exact sats you logged; a new buy/sell works them out from ₱ ÷ price.
  const [satsManual, setSatsManual] = useState(!!initial);
  const [satsText, setSatsText] = useState(initial ? numberToInput(initial.sats, 0) : '');
  const [feeText, setFeeText] = useState(initial && initial.feePhp ? numberToInput(initial.feePhp) : '');
  const [source, setSource] = useState(initial?.source ?? lastSource);
  const [date, setDate] = useState(initial?.date ?? todayIso());
  const [note, setNote] = useState(initial?.note ?? '');
  const [errors, setErrors] = useState<Errors>({});

  // The live price can arrive after the form opens; fill it in unless you've typed your own.
  useEffect(() => {
    if (!priceTouched && quote) setPriceText(numberToInput(Math.round(quote.php), 0));
  }, [quote, priceTouched]);

  const isTrade = type === 'buy' || type === 'sell';
  const amount = parseNumberInput(amountText);
  const price = parseNumberInput(priceText);
  const fee = feeText.trim() === '' ? 0 : parseNumberInput(feeText);
  const autoSats = isTrade ? phpToSats(amount, price) : 0;
  const sats = isTrade && !satsManual ? autoSats : parseNumberInput(satsText);
  const satsDisplay = isTrade && !satsManual ? (autoSats > 0 ? numberToInput(autoSats, 0) : '') : satsText;

  const available = useMemo(
    () => (isValidIsoDate(date) ? holdingsAsOf(trades, date, initial?.id) : 0),
    [trades, date, initial?.id]
  );

  const clearError = (key: keyof Errors) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  const useAll = () => {
    setSatsManual(true);
    setSatsText(numberToInput(available, 0));
    if (type === 'sell' && price > 0) setAmountText(numberToInput(satsToPhp(available, price)));
    clearError('sats');
  };

  const submit = () => {
    const e: Errors = {};
    if (!isValidIsoDate(date)) e.date = 'Use the format YYYY-MM-DD, e.g. 2026-11-12.';
    else if (date > todayIso()) e.date = "That date is in the future.";
    if (!source.trim()) e.source = 'Choose or type where this happened.';

    if (isTrade) {
      if (!(amount > 0)) e.amount = 'Enter how many pesos.';
      if (!satsManual && !(price > 0)) e.price = 'Enter the BTC price.';
      if (!(fee >= 0)) e.fee = 'Fee must be 0 or more.';
      else if (type === 'sell' && amount > 0 && fee >= amount) e.fee = 'Fee is larger than what you sold for.';
    }
    if (!e.amount && !e.price && !(Number.isInteger(sats) && sats > 0)) {
      e.sats = isTrade ? 'That amount is too small to buy a single sat.' : 'Enter how many sats.';
    }
    if (!e.sats && !e.date && (type === 'sell' || type === 'send')) {
      if (sats > available) {
        e.sats = `You only had ${formatSats(available)} on that date.`;
      } else {
        // A sell dated in the past can still break a later sell that relied on those sats.
        const candidate: Trade = {
          id: initial?.id ?? '__new__',
          type,
          date,
          sats,
          amountPhp: 0,
          feePhp: 0,
          source,
          createdAt: initial?.createdAt ?? Number.MAX_SAFE_INTEGER,
        };
        const others = trades.filter((t) => t.id !== initial?.id);
        if (computePortfolio([...others, candidate]).oversoldTradeIds.length > 0) {
          e.sats = 'This would leave a later sell or send without enough sats.';
        }
      }
    }

    setErrors(e);
    if (Object.values(e).some(Boolean)) return;

    onSubmit({
      type,
      date,
      sats,
      amountPhp: type === 'send' ? 0 : amount > 0 ? amount : 0,
      feePhp: isTrade && fee > 0 ? fee : 0,
      source: source.trim(),
      note: note.trim() || undefined,
    });

    if (!initial) {
      setAmountText('');
      setSatsText('');
      setSatsManual(false);
      setFeeText('');
      setNote('');
    }
  };

  const sourceChips = Array.from(new Set([...settings.sources, ...(source && !settings.sources.includes(source) ? [source] : [])]));

  return (
    <View>
      <Segmented
        options={TYPE_OPTIONS}
        value={type}
        onChange={(t) => {
          setType(t);
          setErrors({});
          if (t === 'receive' || t === 'send') setSatsManual(true);
          else if (!initial) setSatsManual(false);
        }}
      />

      {isTrade && (
        <>
          <Field
            label={type === 'buy' ? 'Amount you paid' : 'Amount you sold for'}
            prefix="₱"
            numeric
            value={amountText}
            onChangeText={(t) => {
              setAmountText(t);
              clearError('amount');
            }}
            placeholder="5,000.00"
            error={errors.amount}
            hint="Before fees"
            testID="trade-amount"
          />
          <Field
            label="Price per BTC"
            prefix="₱"
            numeric
            decimals={0}
            value={priceText}
            onChangeText={(t) => {
              setPriceText(t);
              setPriceTouched(true);
              clearError('price');
            }}
            placeholder="6,000,000"
            error={errors.price}
            right={
              quote ? (
                <LinkButton
                  label="Use live price"
                  onPress={() => {
                    setPriceText(numberToInput(Math.round(quote.php), 0));
                    setPriceTouched(false);
                  }}
                />
              ) : null
            }
          />
        </>
      )}

      <Field
        label={type === 'buy' || type === 'receive' ? 'Bitcoin received' : 'Bitcoin ' + (type === 'sell' ? 'sold' : 'sent')}
        suffix="sats"
        numeric
        decimals={0}
        value={satsDisplay}
        onChangeText={(t) => {
          setSatsManual(true);
          setSatsText(t);
          clearError('sats');
        }}
        placeholder="83,333"
        error={errors.sats}
        hint={
          sats > 0
            ? `${formatBtc(sats)}${isTrade && !satsManual ? ' · worked out from ₱ and price' : ''}`
            : type === 'send'
              ? 'Moving coins between your own wallets? Log only the network fee here.'
              : undefined
        }
        right={
          isTrade && satsManual ? (
            <LinkButton label="Work it out" onPress={() => setSatsManual(false)} />
          ) : (type === 'sell' || type === 'send') && available > 0 ? (
            <LinkButton label={`Use all (${formatSats(available)})`} onPress={useAll} />
          ) : null
        }
        testID="trade-sats"
      />

      {isTrade && (
        <Field
          label="Exchange fee (optional)"
          prefix="₱"
          numeric
          value={feeText}
          onChangeText={(t) => {
            setFeeText(t);
            clearError('fee');
          }}
          placeholder="0.00"
          error={errors.fee}
          hint={
            amount > 0 && fee > 0
              ? type === 'buy'
                ? `Total cost ${formatPeso(amount + fee)}`
                : `You receive ${formatPeso(amount - fee)}`
              : undefined
          }
        />
      )}

      {type === 'receive' && (
        <Field
          label="What it cost you (optional)"
          prefix="₱"
          numeric
          value={amountText}
          onChangeText={setAmountText}
          placeholder="0.00"
          hint="Leave empty for a gift or reward."
        />
      )}

      <Text style={{ fontSize: 13, color: theme.textMuted, fontWeight: '600', marginBottom: 6 }}>Where</Text>
      <ChipRow>
        {sourceChips.map((s) => (
          <Chip
            key={s}
            label={s}
            active={s === source}
            onPress={() => {
              setSource(s);
              clearError('source');
            }}
          />
        ))}
      </ChipRow>
      <View style={{ height: 8 }} />
      <Field
        label="Or type another"
        value={source}
        onChangeText={(t) => {
          setSource(t);
          clearError('source');
        }}
        placeholder="Coins.ph"
        error={errors.source}
      />

      <Field
        label="Date"
        value={date}
        onChangeText={(t) => {
          setDate(t);
          clearError('date');
        }}
        placeholder="2026-11-12"
        keyboardType="numbers-and-punctuation"
        error={errors.date}
        right={
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <LinkButton label="Today" onPress={() => setDate(todayIso())} />
            <LinkButton label="Yesterday" onPress={() => setDate(yesterdayIso())} />
          </View>
        }
      />

      <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="Weekly DCA" />

      <Button label={submitLabel ?? SUBMIT_LABEL[type]} onPress={submit} testID="trade-submit" />
      {footer}
    </View>
  );
}
