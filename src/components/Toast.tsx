import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { AppTheme, useTheme } from '../theme';

interface Props {
  visible: boolean;
  message: string;
  onUndo?: () => void;
}

export default function Toast({ visible, message, onUndo }: Props) {
  const theme = useTheme();
  const styles = useRef(createStyles(theme)).current;
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: visible ? 0 : -80,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible]);

  return (
    <Animated.View
      style={[styles.wrap, { transform: [{ translateY }], opacity, pointerEvents: 'box-none' }]}
    >
      <Text style={styles.icon}>✓</Text>
      <Text style={styles.text} numberOfLines={2}>
        {message}
      </Text>
      {visible && onUndo && (
        <TouchableOpacity onPress={onUndo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.undoText}>Undo</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      top: 12,
      left: 20,
      right: 20,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.successSurface,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: theme.success,
      zIndex: 999,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 6,
    },
    icon: { fontSize: 16, fontWeight: '800', color: theme.success, marginRight: 8 },
    text: { fontSize: 13.5, fontWeight: '700', color: theme.success, flex: 1 },
    undoText: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.success,
      textDecorationLine: 'underline',
      marginLeft: 10,
    },
  });
