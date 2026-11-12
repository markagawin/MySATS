import React, { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useAppData } from '../AppDataContext';
import type { Trade } from '../types';
import { formatSats } from '../format';
import TradeForm from '../components/TradeForm';
import Toast from '../components/Toast';
import { Card, Screen } from '../components/ui';

const VERB: Record<Trade['type'], string> = { buy: 'Bought', sell: 'Sold', receive: 'Received', send: 'Sent' };

export default function LogScreen() {
  const { addTrade, deleteTrade } = useAppData();
  const scrollRef = useRef<ScrollView>(null);
  const [toast, setToast] = useState<{ message: string; trade: Trade } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, trade: Trade) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, trade });
    timer.current = setTimeout(() => setToast(null), 4000);
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen title="Log" scrollRef={scrollRef}>
        <Card>
          <TradeForm
            onSubmit={(t) => {
              const saved = addTrade(t);
              showToast(`${VERB[saved.type]} ${formatSats(saved.sats)}`, saved);
              scrollRef.current?.scrollTo({ y: 0, animated: true });
            }}
          />
        </Card>
      </Screen>
      <Toast
        visible={!!toast}
        message={toast?.message ?? ''}
        onUndo={() => {
          if (toast) deleteTrade(toast.trade.id);
          setToast(null);
        }}
      />
    </View>
  );
}
