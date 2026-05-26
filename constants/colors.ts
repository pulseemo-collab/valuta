export const C = {
  // Backgrounds — layered depth system (bg → surface → card → elevated → floating)
  bg: '#060B18',
  surface: '#0B1120',
  card: '#0F1B2D',
  elevated: '#142236',
  floating: '#1A2B42',

  // Borders
  border: '#1E2D45',
  borderLight: '#243652',
  borderGlass: 'rgba(255,255,255,0.06)',
  borderGlassLight: 'rgba(255,255,255,0.10)',
  borderGlassStrong: 'rgba(255,255,255,0.16)',

  // Primary — emerald
  primary: '#10B981',
  primaryLight: '#34D399',
  primaryDark: '#059669',
  primaryBg: 'rgba(16,185,129,0.10)',
  primaryBgStrong: 'rgba(16,185,129,0.18)',
  primaryBgSubtle: 'rgba(16,185,129,0.06)',
  primaryBorder: 'rgba(16,185,129,0.24)',
  primaryGlow: 'rgba(16,185,129,0.35)',

  // Accent — blue
  accent: '#3B82F6',
  accentLight: '#60A5FA',
  accentDark: '#2563EB',
  accentBg: 'rgba(59,130,246,0.10)',
  accentBgSubtle: 'rgba(59,130,246,0.06)',
  accentBorder: 'rgba(59,130,246,0.24)',
  accentGlow: 'rgba(59,130,246,0.30)',

  // Text hierarchy
  text: '#F1F5F9',
  textSub: '#94A3B8',
  textMuted: '#4E6484',
  textFaint: '#2D4060',

  // Semantic
  success: '#10B981',
  warning: '#F59E0B',
  warningBg: 'rgba(245,158,11,0.10)',
  warningBgSubtle: 'rgba(245,158,11,0.06)',
  warningBorder: 'rgba(245,158,11,0.24)',
  warningGlow: 'rgba(245,158,11,0.25)',
  danger: '#EF4444',
  dangerBg: 'rgba(239,68,68,0.10)',
  dangerBgSubtle: 'rgba(239,68,68,0.06)',
  dangerBorder: 'rgba(239,68,68,0.24)',
  dangerGlow: 'rgba(239,68,68,0.25)',

  // Utility
  overlay: 'rgba(0,0,0,0.72)',
  overlayStrong: 'rgba(0,0,0,0.86)',
  white: '#FFFFFF',
} as const;

export const GRADIENTS = {
  primary: ['#10B981', '#059669'] as string[],
  primaryShine: ['#34D399', '#10B981', '#059669'] as string[],
  accent: ['#3B82F6', '#1D4ED8'] as string[],
  bg: ['#0B1120', '#060B18'] as string[],
  card: ['#1A2B42', '#0F1B2D'] as string[],
  hero: ['#0E2A46', '#060B18'] as string[],
  heroRich: ['#0F3050', '#0A1F36', '#060B18'] as string[],
  emeraldBlue: ['#10B981', '#3B82F6'] as string[],
  emeraldBlueDeep: ['#059669', '#1D4ED8'] as string[],
  surface: ['#142236', '#0B1120'] as string[],
  glassShine: ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.02)'] as string[],
  primaryFaint: ['rgba(16,185,129,0.16)', 'rgba(16,185,129,0)'] as string[],
  accentFaint: ['rgba(59,130,246,0.16)', 'rgba(59,130,246,0)'] as string[],
};
