import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C } from '@/constants/colors';

interface StatCardProps {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  trend?: { value: string; positive: boolean };
  highlight?: boolean;
  delay?: number;
  large?: boolean;
}

export function StatCard({
  label,
  value,
  icon,
  iconColor,
  iconBg,
  trend,
  highlight = false,
  delay = 0,
  large = false,
}: StatCardProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  const scaleAnim = useRef(new Animated.Value(0.94)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay,
        tension: 100,
        friction: 13,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        delay,
        tension: 100,
        friction: 13,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.card,
        highlight && styles.highlight,
        large && styles.cardLarge,
        { opacity: fadeAnim, transform: [{ translateY }, { scale: scaleAnim }] },
      ]}
    >
      <View style={[styles.topEdge, highlight && styles.topEdgeHighlight]} pointerEvents="none" />

      {highlight && (
        <>
          <LinearGradient
            colors={['rgba(16,185,129,0.15)', 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.glowOrb} />
        </>
      )}

      <View style={[styles.header, large && styles.headerLarge]}>
        <View style={[styles.iconWrap, { backgroundColor: iconBg, borderColor: iconColor + '30' }, large && styles.iconWrapLarge]}>
          <Ionicons name={icon} size={large ? 22 : 17} color={iconColor} />
        </View>
        {trend && (
          <View style={[styles.trend, { backgroundColor: trend.positive ? C.primaryBg : C.dangerBg }]}>
            <Ionicons
              name={trend.positive ? 'trending-up' : 'trending-down'}
              size={10}
              color={trend.positive ? C.primary : C.danger}
            />
            <Text style={[styles.trendText, { color: trend.positive ? C.primary : C.danger }]}>
              {trend.value}
            </Text>
          </View>
        )}
      </View>

      <Text style={[styles.value, large && styles.valueLarge]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.label, large && styles.labelLarge]}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    minWidth: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
    position: 'relative',
  },
  highlight: {
    borderColor: C.primaryBorder,
    shadowColor: C.primary,
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 8,
  },
  topEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  topEdgeHighlight: {
    backgroundColor: 'rgba(16,185,129,0.32)',
  },
  glowOrb: {
    position: 'absolute',
    top: -24,
    right: -24,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.primaryGlow,
    opacity: 0.22,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  trend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  trendText: {
    fontSize: 10,
    fontWeight: '700',
  },
  value: {
    fontSize: 18,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.6,
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  cardLarge: {
    padding: 20,
    borderRadius: 22,
  },
  headerLarge: {
    marginBottom: 18,
  },
  iconWrapLarge: {
    width: 46,
    height: 46,
    borderRadius: 14,
  },
  valueLarge: {
    fontSize: 22,
    letterSpacing: -0.8,
  },
  labelLarge: {
    fontSize: 12,
    marginTop: 2,
  },
});
