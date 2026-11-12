import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
  LinkingOptions,
  NavigationContainer,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, Text, View } from 'react-native';

import { AppDataProvider, useAppData } from './src/AppDataContext';
import DashboardScreen from './src/screens/DashboardScreen';
import LogScreen from './src/screens/LogScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import CalculatorScreen from './src/screens/CalculatorScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import UpdateBanner from './src/components/UpdateBanner';
import { ThemeProvider, useIsDarkTheme, useTheme } from './src/theme';

// Same GitHub Pages subpath handling as MyDEL: treat the first path segment as the hosting
// prefix (e.g. /MySATS/) unless it's one of the app's own routes, so deep links and
// home-screen shortcuts land on the right tab both locally and when deployed.
const ROUTES = ['Dashboard', 'Log', 'History', 'Calculator', 'Settings'];
const BASE_PATH = (() => {
  if (typeof window === 'undefined' || !window.location) return '';
  const first = window.location.pathname.split('/').filter(Boolean)[0];
  return first && !ROUTES.includes(first) ? `${first}/` : '';
})();

const linking: LinkingOptions<ReactNavigation.RootParamList> = {
  prefixes: [],
  config: {
    screens: Object.fromEntries(ROUTES.map((r) => [r, `${BASE_PATH}${r}`])),
  },
};

const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, string> = {
  Dashboard: '🏠',
  Log: '➕',
  History: '📜',
  Calculator: '🧮',
  Settings: '⚙️',
};

function AppInner() {
  const theme = useTheme();
  const isDark = useIsDarkTheme();
  const { loading } = useAppData();

  const base = isDark ? NavigationDarkTheme : NavigationDefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: theme.background,
      card: theme.card,
      text: theme.text,
      border: theme.border,
      primary: theme.primary,
    },
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return (
    <>
      <NavigationContainer theme={navigationTheme} linking={linking} documentTitle={{ formatter: (_, route) => `MySATS · ${route?.name ?? ''}` }}>
        <Tab.Navigator
          backBehavior="history"
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: theme.primary,
            tabBarInactiveTintColor: theme.textMuted,
            tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.border },
            tabBarLabelStyle: { fontWeight: '600' },
            tabBarIcon: ({ focused }) => (
              <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{TAB_ICONS[route.name]}</Text>
            ),
          })}
        >
          <Tab.Screen name="Dashboard" component={DashboardScreen} />
          <Tab.Screen name="Log" component={LogScreen} />
          <Tab.Screen name="History" component={HistoryScreen} />
          <Tab.Screen name="Calculator" component={CalculatorScreen} />
          <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
      <UpdateBanner />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppDataProvider>
            <AppInner />
          </AppDataProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
