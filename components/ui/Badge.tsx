import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { C } from '@/constants/colors';

interface BadgeProps {
  children: ReactNode;
  color?: string;
  bgColor?: string;
  size?: 'sm' | 'md';
  style?: ViewStyle;
  dot?: boolean;
}

export function Badge({
  children,
  color = C.primary,
  bgColor = C.primaryBg,
  size = 'md',
  style,
  dot = false,
}: BadgeProps) {
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bgColor, borderColor: color + '33' },
        size === 'sm' && styles.sm,
        style,
      ]}
    >
      {dot && <View style={[styles.dot, { backgroundColor: color }]} />}
      <Text style={[styles.text, { color }, size === 'sm' && styles.textSm]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
    alignSelf: 'flex-start',
  },
  sm: { paddingVertical: 2, paddingHorizontal: 8 },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  textSm: { fontSize: 11 },
});
