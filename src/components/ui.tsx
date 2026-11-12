import React, { useMemo } from 'react';
import {
  KeyboardTypeOptions,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTheme, useTheme } from '../theme';
import { noWebOutline } from '../webInputStyle';
import { formatNumberInput } from '../format';

export function useStyles<T>(factory: (theme: AppTheme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [theme]);
}

/** Scrollable page with a large title, respecting the notch. */
export function Screen({
  title,
  right,
  children,
  scrollRef,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  scrollRef?: React.Ref<ScrollView>;
}) {
  const insets = useSafeAreaInsets();
  const s = useStyles(createStyles);
  return (
    <View style={s.screen}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[s.screenContent, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.header}>
          <Text style={s.title} accessibilityRole="header">
            {title}
          </Text>
          {right}
        </View>
        {children}
      </ScrollView>
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useStyles(createStyles);
  return <View style={[s.card, style]}>{children}</View>;
}

export function Label({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const s = useStyles(createStyles);
  return <Text style={[s.label, style]}>{children}</Text>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const s = useStyles(createStyles);
  return <Text style={s.sectionTitle}>{children}</Text>;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  testID,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  testID?: string;
}) {
  const s = useStyles(createStyles);
  return (
    <View style={s.segmented} accessibilityRole="tablist" testID={testID}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <TouchableOpacity
            key={o.value}
            style={[s.segment, active && s.segmentActive]}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[s.segmentText, active && s.segmentTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
  onRemove,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
}) {
  const s = useStyles(createStyles);
  return (
    <TouchableOpacity
      style={[s.chip, active && s.chipActive]}
      onPress={onPress}
      disabled={!onPress && !onRemove}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
    >
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
      {onRemove && (
        <TouchableOpacity onPress={onRemove} hitSlop={8} accessibilityLabel={`Remove ${label}`}>
          <Text style={[s.chipText, { marginLeft: 6 }]}>×</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{children}</View>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const s = useStyles(createStyles);
  return (
    <TouchableOpacity
      style={[s.button, variant === 'secondary' && s.buttonSecondary, variant === 'danger' && s.buttonDanger, style]}
      onPress={onPress}
      accessibilityRole="button"
      testID={testID}
    >
      <Text
        style={[s.buttonText, variant === 'secondary' && s.buttonTextSecondary, variant === 'danger' && s.buttonTextDanger]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  const s = useStyles(createStyles);
  return (
    <TouchableOpacity onPress={onPress} hitSlop={8} accessibilityRole="button">
      <Text style={s.link}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Labelled text field. `numeric` adds thousands separators as you type. */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  prefix,
  suffix,
  right,
  numeric,
  decimals = 2,
  error,
  hint,
  keyboardType,
  multiline,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  right?: React.ReactNode;
  numeric?: boolean;
  decimals?: number;
  error?: string | null;
  hint?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  testID?: string;
}) {
  const s = useStyles(createStyles);
  const theme = useTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={s.fieldLabelRow}>
        <Text style={s.label}>{label}</Text>
        {right}
      </View>
      <View style={[s.inputWrap, !!error && { borderColor: theme.danger }]}>
        {prefix ? <Text style={s.affix}>{prefix}</Text> : null}
        <TextInput
          style={[s.input, noWebOutline, multiline && { minHeight: 60, textAlignVertical: 'top' }]}
          value={value}
          onChangeText={(t) => onChangeText(numeric ? formatNumberInput(t, decimals) : t)}
          placeholder={placeholder}
          placeholderTextColor={theme.textMuted}
          keyboardType={keyboardType ?? (numeric ? (decimals > 0 ? 'decimal-pad' : 'number-pad') : 'default')}
          inputMode={numeric ? (decimals > 0 ? 'decimal' : 'numeric') : undefined}
          multiline={multiline}
          accessibilityLabel={label}
          testID={testID}
        />
        {suffix ? <Text style={s.affix}>{suffix}</Text> : null}
      </View>
      {error ? <Text style={s.error}>{error}</Text> : hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Row({ label, value, valueStyle }: { label: string; value: string; valueStyle?: StyleProp<TextStyle> }) {
  const s = useStyles(createStyles);
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, valueStyle]}>{value}</Text>
    </View>
  );
}

export const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    screenContent: { paddingHorizontal: 16, paddingBottom: 32, maxWidth: 560, width: '100%', alignSelf: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    title: { fontSize: 26, fontWeight: '800', color: theme.text },
    card: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    label: { fontSize: 13, color: theme.textMuted, fontWeight: '600' },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: 8,
      marginBottom: 8,
    },
    segmented: { flexDirection: 'row', backgroundColor: theme.surfaceMuted, borderRadius: 12, padding: 4, marginBottom: 14 },
    segment: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
    segmentActive: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
    segmentText: { fontSize: 14, fontWeight: '600', color: theme.textMuted },
    segmentTextActive: { color: theme.text, fontWeight: '700' },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      borderRadius: 999,
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    chipActive: { backgroundColor: theme.primarySurface, borderColor: theme.primary },
    chipText: { fontSize: 13, color: theme.text, fontWeight: '600' },
    chipTextActive: { color: theme.primary },
    button: { backgroundColor: theme.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    buttonSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.border },
    buttonDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.danger },
    buttonText: { color: theme.onPrimary, fontWeight: '800', fontSize: 15 },
    buttonTextSecondary: { color: theme.text },
    buttonTextDanger: { color: theme.danger },
    link: { color: theme.primary, fontWeight: '700', fontSize: 13 },
    fieldLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      backgroundColor: theme.card,
      paddingHorizontal: 12,
    },
    affix: { fontSize: 16, color: theme.textMuted, fontWeight: '600' },
    input: { flex: 1, fontSize: 16, color: theme.text, paddingVertical: 11, paddingHorizontal: 6, minWidth: 0 },
    error: { color: theme.danger, fontSize: 12.5, marginTop: 5, fontWeight: '600' },
    hint: { color: theme.textMuted, fontSize: 12.5, marginTop: 5 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
    rowLabel: { fontSize: 14, color: theme.textMuted },
    rowValue: { fontSize: 14, color: theme.text, fontWeight: '700' },
  });
