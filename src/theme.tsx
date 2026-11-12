import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { loadThemePreference, saveThemePreference } from './storage';

// Same structure as MyDEL's theme, recoloured around bitcoin orange. `primary` is dark enough
// in light mode for white text on buttons; in dark mode buttons use dark text on bright orange.
const lightColors = {
  primary: '#B35900',
  primaryLight: '#F7931A',
  primarySurface: '#FFF1DF',
  onPrimary: '#FFFFFF',
  background: '#FBF7F2',
  card: '#FFFFFF',
  border: '#EDE5DA',
  text: '#1F1A14',
  textMuted: '#6E665C',
  danger: '#DC2626',
  success: '#059669',
  surfaceMuted: '#F4EDE3',
  disabled: '#D4C8B8',
  dangerSurface: '#FCEBEB',
  successSurface: '#E6F7F0',
};

const darkColors: typeof lightColors = {
  primary: '#F7931A',
  primaryLight: '#FFB04D',
  primarySurface: '#3A2A14',
  onPrimary: '#1A1206',
  background: '#14110D',
  card: '#1F1B16',
  border: '#342D25',
  text: '#F2EDE6',
  textMuted: '#A89E91',
  danger: '#F87171',
  success: '#34D399',
  surfaceMuted: '#1A1612',
  disabled: '#4A4136',
  dangerSurface: '#3A2020',
  successSurface: '#1A2E24',
};

export type AppTheme = typeof lightColors;
export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeContextValue {
  theme: AppTheme;
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    (async () => {
      const stored = await loadThemePreference();
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreferenceState(stored);
      }
    })();
  }, []);

  const setPreference = (pref: ThemePreference) => {
    setPreferenceState(pref);
    saveThemePreference(pref);
  };

  const isDark = preference === 'system' ? systemScheme === 'dark' : preference === 'dark';

  // On web, html/body have no theme awareness of their own; keep any uncovered sliver
  // (e.g. iOS standalone PWA safe area) matching the app instead of stark white.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const bg = isDark ? darkColors.background : lightColors.background;
    document.documentElement.style.backgroundColor = bg;
    document.body.style.backgroundColor = bg;
  }, [isDark]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: isDark ? darkColors : lightColors, isDark, preference, setPreference }),
    [isDark, preference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export function useTheme(): AppTheme {
  return useThemeContext().theme;
}

export function useIsDarkTheme(): boolean {
  return useThemeContext().isDark;
}

export function useThemePreference() {
  const { preference, setPreference } = useThemeContext();
  return { preference, setPreference };
}
