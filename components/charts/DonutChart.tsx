import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { C } from '@/constants/colors';

interface DonutSlice {
  value: number;
  color: string;
  label: string;
}

interface DonutChartProps {
  data: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, start: number, end: number): string {
  if (Math.abs(end - start) >= 360) {
    end = start + 359.99;
  }
  const s = polarToCartesian(cx, cy, r, end);
  const e = polarToCartesian(cx, cy, r, start);
  const large = end - start > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`;
}

export function DonutChart({
  data,
  size = 180,
  thickness = 26,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2;
  const total = data.reduce((s, d) => s + d.value, 0);

  const GAP_DEGREES = 3;
  let currentAngle = -90;
  const slices = data.map((slice) => {
    const angle = total > 0 ? (slice.value / total) * 360 : 0;
    const start = currentAngle + (angle > GAP_DEGREES * 2 ? GAP_DEGREES / 2 : 0);
    const end = currentAngle + angle - (angle > GAP_DEGREES * 2 ? GAP_DEGREES / 2 : 0);
    currentAngle = currentAngle + angle;
    return { ...slice, start, end, angle };
  });

  const maxValue = total > 0 ? Math.max(...data.map((d) => d.value)) : 1;

  return (
    <View style={styles.container}>
      <View style={styles.chart}>
        <Svg width={size} height={size}>
          {/* Track circle */}
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={C.elevated}
            strokeWidth={thickness}
            fill="none"
            strokeOpacity={0.7}
          />
          {/* Inner track glow ring */}
          <Circle
            cx={cx}
            cy={cy}
            r={r - thickness / 2 - 2}
            stroke={C.border}
            strokeWidth={1}
            fill="none"
            strokeOpacity={0.4}
          />
          {slices.map((slice, i) => {
            if (slice.angle < 1) return null;
            return (
              <Path
                key={i}
                d={describeArc(cx, cy, r, slice.start, slice.end)}
                stroke={slice.color}
                strokeWidth={thickness}
                fill="none"
                strokeLinecap="round"
              />
            );
          })}
        </Svg>

        {(centerLabel || centerValue) && (
          <View style={styles.center}>
            {centerValue && <Text style={styles.centerValue}>{centerValue}</Text>}
            {centerLabel && <Text style={styles.centerLabel}>{centerLabel}</Text>}
          </View>
        )}
      </View>

      <View style={styles.legend}>
        {data.map((item, i) => {
          const pct = total > 0 ? (item.value / total) * 100 : 0;
          const barWidth = total > 0 ? (item.value / maxValue) * 100 : 0;
          return (
            <View key={i} style={styles.legendItem}>
              <View style={styles.legendTop}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={styles.legendLabel} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={[styles.legendValue, { color: item.color }]}>
                  {pct.toFixed(0)}%
                </Text>
              </View>
              <View style={styles.legendBar}>
                <View
                  style={[
                    styles.legendBarFill,
                    { width: `${barWidth}%` as any, backgroundColor: item.color + 'CC' },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  chart: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  center: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  centerValue: {
    fontSize: 15,
    fontWeight: '800',
    color: C.text,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  centerLabel: {
    fontSize: 10,
    color: C.textMuted,
    textAlign: 'center',
    marginTop: 3,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  legend: {
    flex: 1,
    gap: 10,
  },
  legendItem: {
    gap: 4,
  },
  legendTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 2,
    flexShrink: 0,
  },
  legendLabel: {
    flex: 1,
    fontSize: 12,
    color: C.textSub,
    fontWeight: '500',
  },
  legendValue: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 0,
  },
  legendBar: {
    height: 3,
    backgroundColor: C.elevated,
    borderRadius: 2,
    overflow: 'hidden',
    marginLeft: 14,
  },
  legendBarFill: {
    height: '100%',
    borderRadius: 2,
  },
});
