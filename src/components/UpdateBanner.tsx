import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTheme, useTheme } from '../theme';

export default function UpdateBanner() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handler = () => setAvailable(true);
    window.addEventListener('mysats:update-available', handler);
    return () => window.removeEventListener('mysats:update-available', handler);
  }, []);

  if (Platform.OS !== 'web' || !available) return null;

  const styles = createStyles(theme);
  return (
    <TouchableOpacity
      style={[styles.banner, { paddingTop: insets.top + 10 }]}
      onPress={() => window.location.reload()}
    >
      <Text style={styles.text}>New version available — tap to refresh</Text>
    </TouchableOpacity>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    banner: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.primary,
      paddingBottom: 10,
      paddingHorizontal: 16,
      alignItems: 'center',
      zIndex: 1000,
    },
    text: { color: theme.onPrimary, fontWeight: '700', fontSize: 13 },
  });
