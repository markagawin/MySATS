import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Trade } from '../types';
import type { NewTrade } from '../AppDataContext';
import { AppTheme } from '../theme';
import TradeForm from './TradeForm';
import ConfirmModal from './ConfirmModal';
import { Button, useStyles } from './ui';

interface Props {
  trade: Trade | null;
  onClose: () => void;
  onSave: (t: Trade) => void;
  onDelete: (t: Trade) => void;
}

export default function EditTradeModal({ trade, onClose, onSave, onDelete }: Props) {
  const s = useStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [confirming, setConfirming] = useState(false);

  return (
    <Modal visible={!!trade} animationType="slide" onRequestClose={onClose}>
      <View style={[s.wrap, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <Text style={s.title}>Edit transaction</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button">
            <Text style={s.close}>Close</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {trade && (
            <TradeForm
              key={trade.id}
              initial={trade}
              submitLabel="Save changes"
              onSubmit={(t: NewTrade) => onSave({ ...trade, ...t })}
              footer={<Button label="Delete transaction" variant="danger" onPress={() => setConfirming(true)} style={{ marginTop: 10 }} />}
            />
          )}
        </ScrollView>
      </View>
      <ConfirmModal
        visible={confirming}
        title="Delete this transaction?"
        message="Your totals will be recalculated without it."
        confirmLabel="Delete"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          if (trade) onDelete(trade);
        }}
      />
    </Modal>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    wrap: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    title: { fontSize: 18, fontWeight: '800', color: theme.text },
    close: { fontSize: 15, fontWeight: '700', color: theme.primary },
    content: { padding: 16, paddingBottom: 40, maxWidth: 560, width: '100%', alignSelf: 'center' },
  });
