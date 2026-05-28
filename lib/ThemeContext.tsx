import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { useStore } from '@/lib/store';
import { C } from '@/constants/colors';
import type { AppTheme } from '@/types';

// ── Light palette ─────────────────────────────────────────────────────────────
export const LIGHT_C = {
  bg: '#F8FAFC',
  surface: '#F1F5F9',
  card: '#FFFFFF',
  elevated: '#E2E8F0',
  floating: '#CBD5E1',
  border: '#CBD5E1',
  borderLight: '#E2E8F0',
  borderGlass: 'rgba(0,0,0,0.04)',
  borderGlassLight: 'rgba(0,0,0,0.06)',
  borderGlassStrong: 'rgba(0,0,0,0.10)',
  primary: '#10B981',
  primaryLight: '#059669',
  primaryDark: '#047857',
  primaryBg: 'rgba(16,185,129,0.10)',
  primaryBgStrong: 'rgba(16,185,129,0.16)',
  primaryBgSubtle: 'rgba(16,185,129,0.07)',
  primaryBorder: 'rgba(16,185,129,0.30)',
  primaryGlow: 'rgba(16,185,129,0.18)',
  accent: '#3B82F6',
  accentLight: '#2563EB',
  accentDark: '#1D4ED8',
  accentBg: 'rgba(59,130,246,0.10)',
  accentBgSubtle: 'rgba(59,130,246,0.07)',
  accentBorder: 'rgba(59,130,246,0.26)',
  accentGlow: 'rgba(59,130,246,0.14)',
  text: '#0F172A',
  textSub: '#334155',
  textMuted: '#64748B',
  textFaint: '#94A3B8',
  success: '#10B981',
  warning: '#D97706',
  warningBg: 'rgba(217,119,6,0.10)',
  warningBgSubtle: 'rgba(217,119,6,0.07)',
  warningBorder: 'rgba(217,119,6,0.26)',
  warningGlow: 'rgba(217,119,6,0.16)',
  danger: '#DC2626',
  dangerBg: 'rgba(220,38,38,0.10)',
  dangerBgSubtle: 'rgba(220,38,38,0.07)',
  dangerBorder: 'rgba(220,38,38,0.26)',
  dangerGlow: 'rgba(220,38,38,0.16)',
  overlay: 'rgba(0,0,0,0.40)',
  overlayStrong: 'rgba(0,0,0,0.60)',
  white: '#FFFFFF',
} as const;

// ColorPalette is the shape both palettes satisfy
export type ColorPalette = { [K in keyof typeof C]: string };

const ThemeCtx = createContext<ColorPalette>(C as unknown as ColorPalette);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { state } = useStore();
  const systemScheme = useColorScheme();

  const resolved: AppTheme =
    state.theme === 'system'
      ? systemScheme === 'light'
        ? 'light'
        : 'dark'
      : state.theme;

  const colors: ColorPalette =
    resolved === 'light'
      ? (LIGHT_C as unknown as ColorPalette)
      : (C as unknown as ColorPalette);

  return <ThemeCtx.Provider value={colors}>{children}</ThemeCtx.Provider>;
}

export function useThemeColors(): ColorPalette {
  return useContext(ThemeCtx);
}

export function useIsLight(): boolean {
  const { state } = useStore();
  const systemScheme = useColorScheme();
  if (state.theme === 'system') return systemScheme === 'light';
  return state.theme === 'light';
}
