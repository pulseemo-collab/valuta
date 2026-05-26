import React, { useEffect, useRef } from 'react';
import { Animated, View, ViewStyle } from 'react-native';
import { C } from '@/constants/colors';

export function SkeletonBox({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
}: {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}) {
  const anim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.75, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.35, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: C.elevated },
        { opacity: anim },
        style,
      ]}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <View style={{ gap: 18 }}>
      <SkeletonBox height={174} borderRadius={22} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[0, 1, 2].map((i) => (
          <SkeletonBox key={i} height={80} borderRadius={16} style={{ flex: 1 }} />
        ))}
      </View>
      <SkeletonBox height={116} borderRadius={20} />
      <SkeletonBox height={148} borderRadius={18} />
    </View>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <View style={{ gap: 16 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <SkeletonBox width={40} height={40} borderRadius={12} />
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonBox height={12} borderRadius={6} width="55%" />
            <SkeletonBox height={10} borderRadius={6} width="30%" />
          </View>
          <SkeletonBox width={56} height={14} borderRadius={6} />
        </View>
      ))}
    </View>
  );
}

export function CardSkeleton({ height = 120 }: { height?: number }) {
  return <SkeletonBox height={height} borderRadius={20} />;
}
