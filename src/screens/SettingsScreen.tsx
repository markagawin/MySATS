import React, { useRef, useState } from 'react';
import { Modal, Platform, Share, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAppData } from '../AppDataContext';
import { AppTheme, ThemePreference, useTheme, useThemePreference } from '../theme';
import type { AmountUnit, BackupData } from '../types';
import { parseBackup } from '../logic/backup.ts';
import { todayIso } from '../format';
import ConfirmModal from '../components/ConfirmModal';
import Toast from '../components/Toast';
import MeasureFeeModal from '../components/MeasureFeeModal';
import { noWebOutline } from '../webInputStyle';
import { Button, Card, Chip, ChipRow, Field, Label, Screen, SectionTitle, Segmented, useStyles } from '../components/ui';

export default function SettingsScreen() {
  const s = useStyles(createStyles);
  const theme = useTheme();
  const { preference, setPreference } = useThemePreference();
  const { settings, updateSettings, exportBackup, importBackup, clearAll, trades } = useAppData();

  const [feeText, setFeeText] = useState(settings.defaultFeePct ? String(settings.defaultFeePct) : '');
  const [newSource, setNewSource] = useState('');
  const [pending, setPending] = useState<BackupData | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [measuring, setMeasuring] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (m: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(m);
    timer.current = setTimeout(() => setToast(null), 3000);
  };

  const feeValue = feeText.trim() === '' ? 0 : Number(feeText);
  const feeError = Number.isFinite(feeValue) && feeValue >= 0 && feeValue < 100 ? null : 'Enter a fee between 0 and 99.99%.';

  const addSource = () => {
    const name = newSource.trim();
    if (!name || settings.sources.some((x) => x.toLowerCase() === name.toLowerCase())) return;
    updateSettings({ sources: [...settings.sources, name] });
    setNewSource('');
  };

  const handleBackupText = (text: string) => {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      setImportError("That isn't a valid backup file.");
      return;
    }
    const parsed = parseBackup(json);
    if ('error' in parsed) {
      setImportError(parsed.error);
      return;
    }
    setImportError(null);
    setPasteOpen(false);
    setPending(parsed.data);
  };

  const backUp = async () => {
    const json = JSON.stringify(exportBackup(), null, 2);
    if (Platform.OS === 'web') {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mysats-backup-${todayIso()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('Backup downloaded');
    } else {
      await Share.share({ message: json, title: 'MySATS backup' });
    }
  };

  const pickImport = () => {
    setImportError(null);
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        handleBackupText(await file.text());
      };
      input.click();
    } else {
      setPasteText('');
      setPasteOpen(true);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen title="Settings">
        <SectionTitle>Display</SectionTitle>
        <Card>
          <Label style={{ marginBottom: 8 }}>Theme</Label>
          <Segmented<ThemePreference>
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            value={preference}
            onChange={setPreference}
          />
          <Label style={{ marginBottom: 8 }}>Show bitcoin amounts in</Label>
          <Segmented<AmountUnit>
            options={[
              { value: 'sats', label: 'Sats' },
              { value: 'btc', label: 'BTC' },
            ]}
            value={settings.unit}
            onChange={(unit) => updateSettings({ unit })}
          />
          <View style={s.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.switchLabel}>Also show the price in USD</Text>
              <Text style={s.muted}>Pesos stay the main currency.</Text>
            </View>
            <Switch
              value={settings.showUsd}
              onValueChange={(showUsd) => updateSettings({ showUsd })}
              trackColor={{ true: theme.primary, false: theme.disabled }}
              accessibilityLabel="Also show the price in USD"
            />
          </View>
        </Card>

        <SectionTitle>Calculator</SectionTitle>
        <Card>
          <Field
            label="Default exchange fee"
            suffix="%"
            numeric
            value={feeText}
            onChangeText={(t) => {
              setFeeText(t);
              const v = t.trim() === '' ? 0 : Number(t);
              if (Number.isFinite(v) && v >= 0 && v < 100) updateSettings({ defaultFeePct: v });
            }}
            placeholder="0"
            error={feeError}
            hint="Pre-filled in the calculator. Check your exchange's fee page for the exact rate."
          />
        </Card>

        <SectionTitle>Where you buy and keep bitcoin</SectionTitle>
        <Card>
          {settings.sources.map((src) => {
            const fee = settings.sourceFees[src];
            return (
              <View key={src} style={s.sourceRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.switchLabel}>{src}</Text>
                  <Text style={s.muted}>{fee != null ? `Fee ${fee}%` : 'No fee saved'}</Text>
                </View>
                <TouchableOpacity onPress={() => setMeasuring(src)} hitSlop={8} accessibilityRole="button">
                  <Text style={s.link}>{fee != null ? 'Change fee' : 'Set fee'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    const { [src]: _removed, ...rest } = settings.sourceFees;
                    updateSettings({ sources: settings.sources.filter((x) => x !== src), sourceFees: rest });
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${src}`}
                  style={{ marginLeft: 16 }}
                >
                  <Text style={s.remove}>×</Text>
                </TouchableOpacity>
              </View>
            );
          })}
          <Text style={[s.muted, { marginTop: 10, marginBottom: 12, fontSize: 12.5, lineHeight: 18 }]}>
            Maya, GCash and Coins.ph don't show a separate fee; it's built into their price. "Set fee" measures it from a
            buy quote.
          </Text>
          <Field label="Add a place" value={newSource} onChangeText={setNewSource} placeholder="Bybit" />
          <Button label="Add" variant="secondary" onPress={addSource} />
        </Card>

        <SectionTitle>Your data</SectionTitle>
        <Card>
          <Text style={[s.muted, { marginBottom: 12, lineHeight: 20 }]}>
            Everything stays on this device. There's no account and MySATS never asks for keys or seed phrases. Back up
            regularly so you don't lose your {trades.length} transaction{trades.length === 1 ? '' : 's'}.
          </Text>
          <Button label="Back up data" onPress={backUp} />
          <View style={{ height: 10 }} />
          <Button label="Import a backup" variant="secondary" onPress={pickImport} />
          {importError && !pasteOpen ? <Text style={s.error}>{importError}</Text> : null}
          <View style={{ height: 10 }} />
          <Button label="Delete all data" variant="danger" onPress={() => setConfirmClear(true)} />
        </Card>

        <Text style={[s.muted, { textAlign: 'center', marginTop: 8 }]}>MySATS 1.0 · Prices from CoinGecko · Estimates only</Text>
      </Screen>

      <Modal visible={pasteOpen} transparent animationType="fade" onRequestClose={() => setPasteOpen(false)}>
        <View style={s.backdrop}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Paste your backup</Text>
            <TextInput
              style={[s.paste, noWebOutline]}
              multiline
              value={pasteText}
              onChangeText={setPasteText}
              placeholder='{"app": "MySATS", ...}'
              placeholderTextColor={theme.textMuted}
            />
            {importError ? <Text style={s.error}>{importError}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <Button label="Cancel" variant="secondary" onPress={() => setPasteOpen(false)} style={{ flex: 1 }} />
              <Button label="Import" onPress={() => handleBackupText(pasteText)} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={!!pending}
        title="Replace your data with this backup?"
        message={
          pending
            ? `The backup has ${pending.trades.length} transaction${pending.trades.length === 1 ? '' : 's'}. Your current ${trades.length} will be replaced.`
            : undefined
        }
        confirmLabel="Replace"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) {
            importBackup(pending);
            setFeeText(pending.settings.defaultFeePct ? String(pending.settings.defaultFeePct) : '');
          }
          setPending(null);
          showToast('Backup imported');
        }}
      />
      <ConfirmModal
        visible={confirmClear}
        title="Delete all your data?"
        message="This removes every transaction and resets settings on this device. It can't be undone unless you have a backup."
        confirmLabel="Delete everything"
        onCancel={() => setConfirmClear(false)}
        onConfirm={async () => {
          setConfirmClear(false);
          await clearAll();
          setFeeText('');
          showToast('All data deleted');
        }}
      />
      <MeasureFeeModal source={measuring} onClose={() => setMeasuring(null)} onSaved={(pct) => showToast(`Fee saved: ${pct}%`)} />
      <Toast visible={!!toast} message={toast ?? ''} />
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    muted: { color: theme.textMuted, fontSize: 13.5 },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    switchLabel: { fontSize: 15, fontWeight: '600', color: theme.text },
    sourceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
    link: { color: theme.primary, fontWeight: '700', fontSize: 14 },
    remove: { color: theme.textMuted, fontSize: 20, fontWeight: '700' },
    error: { color: theme.danger, fontSize: 13, marginTop: 8, fontWeight: '600' },
    backdrop: { flex: 1, backgroundColor: 'rgba(20,17,13,0.45)', justifyContent: 'center', padding: 24 },
    sheet: { backgroundColor: theme.card, borderRadius: 16, padding: 18, maxWidth: 520, width: '100%', alignSelf: 'center' },
    sheetTitle: { fontSize: 17, fontWeight: '800', color: theme.text, marginBottom: 10 },
    paste: {
      minHeight: 160,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 10,
      color: theme.text,
      fontSize: 13,
      textAlignVertical: 'top',
    },
  });
