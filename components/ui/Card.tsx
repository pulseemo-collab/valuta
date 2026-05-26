import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { C } from '@/constants/colors';

interface CardProps {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  elevated?: boolean;
  glass?: boolean;
  glow?: boolean;
  noPad?: boolean;
}

export function Card({ children, style, elevated = false, glass = false, glow = false, noPad = false }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        elevated && styles.elevated,
        glass && styles.glass,
        glow && styles.glow,
        noPad && styles.noPad,
        style,
      ]}
    >
      {/* Inner top-edge highlight simulates glass/light reflection */}
      <View
        style={[
          styles.topEdge,
          elevated && styles.topEdgeElevated,
          glass && styles.topEdgeGlass,
          glow && styles.topEdgeGlow,
        ]}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
    position: 'relative',
  },
  elevated: {
    backgroundColor: C.elevated,
    borderColor: C.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 14,
  },
  glass: {
    backgroundColor: 'rgba(11,17,32,0.80)',
    borderColor: C.borderGlassLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.55,
    shadowRadius: 32,
    elevation: 20,
  },
  glow: {
    borderColor: C.primaryBorder,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.26,
    shadowRadius: 18,
    elevation: 8,
  },
  noPad: {
    padding: 0,
  },
  topEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  topEdgeElevated: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  topEdgeGlass: {
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  topEdgeGlow: {
    backgroundColor: 'rgba(16,185,129,0.30)',
  },
});
