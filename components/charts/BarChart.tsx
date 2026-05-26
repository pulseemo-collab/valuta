import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Svg, { Rect, G, Line, Text as SvgText, Defs, LinearGradient as SvgGradient, Stop, Circle } from 'react-native-svg';
import { C } from '@/constants/colors';

interface DataPoint {
  label: string;
  value: number;
}

interface BarChartProps {
  data: DataPoint[];
  height?: number;
  barColor?: string;
  barColorEnd?: string;
  formatValue?: (v: number) => string;
  activeIndex?: number;
}

export function BarChart({
  data,
  height = 200,
  barColor = C.primary,
  barColorEnd = C.primaryDark,
  formatValue,
  activeIndex,
}: BarChartProps) {
  const BAR_WIDTH = 34;
  const SPACING = 14;
  const PADDING_TOP = 32;   // extra room for value labels above bars
  const LABEL_HEIGHT = 24;
  const chartHeight = height - LABEL_HEIGHT - PADDING_TOP;
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const totalWidth = data.length * (BAR_WIDTH + SPACING) + SPACING;

  const formatShort = (v: number) =>
    v >= 1_000_000
      ? `${(v / 1_000_000).toFixed(1)}M`
      : v >= 1000
      ? `${(v / 1000).toFixed(0)}k`
      : `${Math.round(v)}`;

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={totalWidth} height={height}>
          <Defs>
            <SvgGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={barColor} stopOpacity="1" />
              <Stop offset="100%" stopColor={barColorEnd} stopOpacity="0.75" />
            </SvgGradient>
            <SvgGradient id="barGradActive" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={C.accentLight} stopOpacity="1" />
              <Stop offset="100%" stopColor={C.accent} stopOpacity="0.80" />
            </SvgGradient>
            <SvgGradient id="barGradBg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={C.elevated} stopOpacity="0.55" />
              <Stop offset="100%" stopColor={C.elevated} stopOpacity="0.18" />
            </SvgGradient>
          </Defs>

          {/* Horizontal grid lines */}
          {[0.25, 0.5, 0.75, 1].map((frac) => (
            <Line
              key={frac}
              x1={0}
              y1={PADDING_TOP + chartHeight * (1 - frac)}
              x2={totalWidth}
              y2={PADDING_TOP + chartHeight * (1 - frac)}
              stroke={C.border}
              strokeWidth={1}
              strokeDasharray="4,6"
              strokeOpacity={0.5}
            />
          ))}

          {data.map((item, i) => {
            const barH = Math.max((item.value / maxValue) * chartHeight, item.value > 0 ? 6 : 0);
            const x = i * (BAR_WIDTH + SPACING) + SPACING;
            const y = PADDING_TOP + chartHeight - barH;
            const isActive = i === activeIndex;
            const isDimmed = activeIndex !== undefined && !isActive;
            const cx = x + BAR_WIDTH / 2;

            return (
              <G key={i}>
                {/* Background track */}
                <Rect
                  x={x}
                  y={PADDING_TOP}
                  width={BAR_WIDTH}
                  height={chartHeight}
                  fill="url(#barGradBg)"
                  rx={8}
                  opacity={isDimmed ? 0.35 : 0.55}
                />

                {/* Data bar */}
                <Rect
                  x={x}
                  y={y}
                  width={BAR_WIDTH}
                  height={barH}
                  fill={isActive ? 'url(#barGradActive)' : 'url(#barGrad)'}
                  rx={8}
                  opacity={isDimmed ? 0.30 : 1}
                />

                {/* Top cap shine for active bar */}
                {isActive && barH > 10 && (
                  <Rect
                    x={x + 4}
                    y={y + 2}
                    width={BAR_WIDTH - 8}
                    height={6}
                    fill="rgba(255,255,255,0.20)"
                    rx={4}
                  />
                )}

                {/* Top glow dot for active */}
                {isActive && barH > 8 && (
                  <Circle
                    cx={cx}
                    cy={y}
                    r={BAR_WIDTH / 2 - 2}
                    fill={C.accentLight}
                    opacity={0.14}
                  />
                )}

                {/* Value label above bar */}
                {item.value > 0 && (
                  <SvgText
                    x={cx}
                    y={y - 6}
                    textAnchor="middle"
                    fill={isActive ? C.accentLight : isDimmed ? C.textFaint : C.textMuted}
                    fontSize={9}
                    fontWeight={isActive ? '700' : '500'}
                  >
                    {formatShort(item.value)}
                  </SvgText>
                )}

                {/* Day label */}
                <SvgText
                  x={cx}
                  y={height - 6}
                  textAnchor="middle"
                  fill={isActive ? C.primary : C.textMuted}
                  fontSize={10}
                  fontWeight={isActive ? '700' : '500'}
                >
                  {item.label}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </ScrollView>

      {formatValue && maxValue > 0 && (
        <View style={styles.yAxis}>
          {[maxValue, maxValue * 0.5, 0].map((v, i) => (
            <Text key={i} style={styles.yLabel}>
              {formatValue(v)}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  yAxis: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 24,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    pointerEvents: 'none',
  },
  yLabel: {
    fontSize: 9,
    color: C.textMuted,
    fontWeight: '500',
  },
});
