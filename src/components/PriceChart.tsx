import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';
import { useAppData } from '../AppDataContext';
import { useTheme } from '../theme';
import { formatPct, formatPesoShort } from '../format';
import { Card, Chip, ChipRow, Label, LinkButton } from './ui';

const RANGES = [
  { days: 30, label: '30D' },
  { days: 90, label: '90D' },
  { days: 365, label: '1Y' },
];
const HEIGHT = 120;

export default function PriceChart() {
  const theme = useTheme();
  const { history, loadHistory } = useAppData();
  const [days, setDays] = useState(30);
  const [width, setWidth] = useState(0);
  const state = history[days];

  useEffect(() => {
    loadHistory(days);
  }, [days, loadHistory]);

  const points = state?.points ?? [];
  const hasData = points.length > 1;
  let body: React.ReactNode;

  if (hasData && width > 0) {
    const prices = points.map((p) => p.php);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const span = max - min || 1;
    const first = points[0].php;
    const last = points[points.length - 1].php;
    const up = last >= first;
    const color = up ? theme.success : theme.danger;
    const coords = points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * width;
        const y = 6 + (1 - (p.php - min) / span) * (HEIGHT - 12);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    body = (
      <>
        <View style={styles.legend}>
          <Text style={[styles.change, { color }]}>{formatPct(((last - first) / first) * 100)}</Text>
          <Text style={[styles.range, { color: theme.textMuted }]}>
            Low {formatPesoShort(min)} · High {formatPesoShort(max)}
          </Text>
        </View>
        <Svg width={width} height={HEIGHT} accessibilityLabel={`Bitcoin price over ${days} days`}>
          <Line x1={0} x2={width} y1={HEIGHT - 1} y2={HEIGHT - 1} stroke={theme.border} strokeWidth={1} />
          <Polyline points={coords} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        </Svg>
      </>
    );
  } else if (hasData) {
    // Data is ready but the chart hasn't measured its width yet; keep the space, say nothing.
    body = <View style={{ height: HEIGHT }} />;
  } else if (state?.loading || !state) {
    body = (
      <View style={[styles.placeholder, { height: HEIGHT }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  } else {
    body = (
      <View style={[styles.placeholder, { height: HEIGHT }]}>
        <Text style={{ color: theme.textMuted, textAlign: 'center', marginBottom: 8 }}>
          {state.error ?? 'No price history yet.'}
        </Text>
        <LinkButton label="Try again" onPress={() => loadHistory(days, true)} />
      </View>
    );
  }

  return (
    <Card>
      <View style={styles.header}>
        <Label>Price in ₱</Label>
        <ChipRow>
          {RANGES.map((r) => (
            <Chip key={r.days} label={r.label} active={r.days === days} onPress={() => setDays(r.days)} />
          ))}
        </ChipRow>
      </View>
      <View onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}>{body}</View>
      {hasData && state?.error ? (
        <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 6 }}>Showing saved chart. {state.error}</Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  legend: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  change: { fontSize: 15, fontWeight: '800' },
  range: { fontSize: 12 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
});
