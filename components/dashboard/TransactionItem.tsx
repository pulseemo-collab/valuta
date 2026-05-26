import React from 'react';
import { View, Text, StyleSheet, Animated, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Expense } from '@/types';
import { getCategoryById } from '@/constants/categories';
import { formatCurrency, formatTime } from '@/lib/utils';
import { C } from '@/constants/colors';

interface TransactionItemProps {
  expense: Expense;
  onPress?: () => void;
  onDelete?: () => void;
  showDate?: boolean;
  isRecurring?: boolean;
}

export function TransactionItem({ expense, onPress, showDate = false, isRecurring = false }: TransactionItemProps) {
  const category = getCategoryById(expense.category);
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.984,
      useNativeDriver: true,
      overshootClamping: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 280,
      friction: 18,
    }).start();
  };

  const time = formatTime(expense.date);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        style={({ pressed, hovered }: any) => [
          styles.container,
          Platform.OS === 'web' && hovered && styles.containerHovered,
          pressed && styles.pressed,
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {/* Category color accent stripe */}
        <View style={[styles.accentBar, { backgroundColor: category.color }]} />

        <View style={[styles.iconWrap, { backgroundColor: category.bgColor, borderColor: category.color + '30' }]}>
          <Ionicons name={category.icon as any} size={18} color={category.color} />
        </View>

        <View style={styles.details}>
          <Text style={styles.note} numberOfLines={1}>
            {expense.note || category.name}
          </Text>
          <View style={styles.meta}>
            <View style={[styles.categoryPill, { backgroundColor: category.color + '16', borderColor: category.color + '28' }]}>
              <Text style={[styles.categoryLabel, { color: category.color }]}>
                {category.name}
              </Text>
            </View>
            {time !== '—' && (
              <>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.time}>{time}</Text>
              </>
            )}
            {isRecurring && (
              <>
                <Text style={styles.metaDot}>·</Text>
                <View style={styles.recurBadge}>
                  <Ionicons name="repeat-outline" size={9} color={C.accent} />
                  <Text style={styles.recurBadgeText}>Periodike</Text>
                </View>
              </>
            )}
            {expense.mode === 'business' && (
              <>
                <Text style={styles.metaDot}>·</Text>
                <View style={styles.bizBadge}>
                  <Ionicons name="briefcase-outline" size={9} color={C.accentLight} />
                  <Text style={styles.bizBadgeText}>BIZ</Text>
                </View>
              </>
            )}
          </View>
        </View>

        <View style={styles.right}>
          <Text style={styles.amount}>
            −{formatCurrency(expense.amount, expense.currency)}
          </Text>
          {expense.convertedALL != null && expense.currency !== 'ALL' && (
            <Text style={styles.converted}>
              ≈ {Math.round(expense.convertedALL).toLocaleString('sq-AL')} L
            </Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingLeft: 14,
    paddingRight: 14,
    gap: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  containerHovered: {
    backgroundColor: C.elevated,
  },
  pressed: {
    opacity: 0.8,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderRadius: 2,
    opacity: 0.7,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    borderWidth: 1,
  },
  details: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  note: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
    letterSpacing: -0.15,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'nowrap',
  },
  categoryPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  metaDot: {
    fontSize: 11,
    color: C.textFaint,
    lineHeight: 14,
  },
  time: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: '400',
  },
  right: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 2,
  },
  amount: {
    fontSize: 15,
    fontWeight: '800',
    color: C.danger,
    letterSpacing: -0.5,
  },
  converted: {
    fontSize: 10,
    color: C.textMuted,
    fontWeight: '400',
  },
  recurBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    backgroundColor: C.accentBgSubtle,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  recurBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: C.accent,
    letterSpacing: 0.3,
  },
  bizBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    backgroundColor: C.accentBgSubtle,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  bizBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: C.accentLight,
    letterSpacing: 0.5,
  },
});
