import React, { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppTheme, useTheme } from '../theme';

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = true,
  onConfirm,
  onCancel,
}: Props) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={() => {}} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, destructive && styles.confirmButtonDestructive]}
              onPress={onConfirm}
            >
              <Text style={styles.confirmButtonText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,17,13,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: { backgroundColor: theme.card, borderRadius: 16, padding: 20 },
  title: { fontSize: 16, fontWeight: '700', color: theme.text, marginBottom: 8 },
  message: { fontSize: 13.5, color: theme.textMuted, marginBottom: 18, lineHeight: 19 },
  buttonRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelButton: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10 },
  cancelButtonText: { color: theme.textMuted, fontWeight: '700', fontSize: 14 },
  confirmButton: {
    backgroundColor: theme.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  confirmButtonDestructive: { backgroundColor: theme.danger },
  confirmButtonText: { color: theme.onPrimary, fontWeight: '700', fontSize: 14 },
});
