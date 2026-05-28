import React, { ReactNode, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Platform,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors, type ColorPalette } from '@/lib/ThemeContext';

interface ScreenWrapperProps {
  children: ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  padded?: boolean;
}

export function ScreenWrapper({
  children,
  scroll = true,
  style,
  contentStyle,
  padded = true,
}: ScreenWrapperProps) {
  const C = useThemeColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const maxWidth = isWeb ? Math.min(width, 900) : '100%';

  const inner = (
    <View
      style={[
        styles.inner,
        padded && styles.padded,
        { width: isWeb ? maxWidth : '100%', alignSelf: 'center' },
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  const wrapper = scroll ? (
    <ScrollView
      style={[styles.scroll, style]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {inner}
    </ScrollView>
  ) : (
    <View style={[styles.scroll, style]}>{inner}</View>
  );

  if (Platform.OS === 'web') {
    return <View style={[styles.root, style]}>{wrapper}</View>;
  }

  return (
    <SafeAreaView style={[styles.root, style]} edges={['top']}>
      {wrapper}
    </SafeAreaView>
  );
}

function makeStyles(C: ColorPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { flex: 1 },
    scrollContent: { flexGrow: 1 },
    inner: { flex: 1 },
    padded: { paddingHorizontal: 20 },
  });
}
