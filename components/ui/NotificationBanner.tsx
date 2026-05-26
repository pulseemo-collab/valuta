import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '@/constants/colors';
import type { PendingNotification } from '@/lib/notificationEngine';

interface Props {
  notification: PendingNotification | null;
  onDismiss: () => void;
}

const SEVERITY_STYLE = {
  critical: {
    bg: C.dangerBgSubtle,
    border: C.dangerBorder,
    iconBg: 'rgba(239,68,68,0.14)',
    iconColor: C.danger,
    titleColor: C.danger,
  },
  warning: {
    bg: C.warningBgSubtle,
    border: C.warningBorder,
    iconBg: 'rgba(245,158,11,0.14)',
    iconColor: C.warning,
    titleColor: C.warning,
  },
  info: {
    bg: C.accentBgSubtle,
    border: C.accentBorder,
    iconBg: 'rgba(59,130,246,0.14)',
    iconColor: C.accentLight,
    titleColor: C.accentLight,
  },
} as const;

const AUTO_DISMISS_MS = 7000;

export function NotificationBanner({ notification, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevIdRef = useRef<string | null>(null);
  // Keep a snapshot of the last notification so it stays visible during dismiss
  const [displayNotif, setDisplayNotif] = useState<PendingNotification | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (notification) {
      setDisplayNotif(notification);

      if (notification.id !== prevIdRef.current) {
        prevIdRef.current = notification.id;
        slideY.stopAnimation();
        slideY.setValue(-120);
        opacity.setValue(0);
        Animated.parallel([
          Animated.spring(slideY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 18,
            stiffness: 220,
            mass: 0.85,
          }),
          Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        ]).start();
      }

      timerRef.current = setTimeout(onDismiss, AUTO_DISMISS_MS);
    } else if (prevIdRef.current !== null) {
      // Fade out, then clear snapshot
      prevIdRef.current = null;
      Animated.parallel([
        Animated.timing(slideY, { toValue: -100, duration: 220, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setDisplayNotif(null);
      });
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [notification?.id]);

  if (!displayNotif) return null;

  const severity = SEVERITY_STYLE[displayNotif.severity] ?? SEVERITY_STYLE.info;
  const topPad = Math.max(insets.top, Platform.OS === 'web' ? 16 : 8) + 8;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: topPad,
          backgroundColor: severity.bg,
          borderColor: severity.border,
          opacity,
          transform: [{ translateY: slideY }],
        },
      ]}
      pointerEvents={notification ? 'auto' : 'none'}
    >
      <View style={[styles.iconWrap, { backgroundColor: severity.iconBg, borderColor: severity.border }]}>
        <Ionicons name={displayNotif.icon as any} size={15} color={severity.iconColor} />
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: severity.titleColor }]} numberOfLines={1}>
          {displayNotif.title}
        </Text>
        <Text style={styles.body} numberOfLines={2}>
          {displayNotif.body}
        </Text>
      </View>
      <TouchableOpacity
        onPress={onDismiss}
        hitSlop={{ top: 10, right: 10, bottom: 10, left: 6 }}
      >
        <Ionicons name="close" size={15} color={severity.iconColor} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.30,
    shadowRadius: 14,
    elevation: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  textWrap: { flex: 1 },
  title: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  body: {
    fontSize: 12,
    color: C.textSub,
    marginTop: 2,
    lineHeight: 16,
    textAlign: 'center',
  },
});
