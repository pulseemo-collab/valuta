import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useStore } from '@/lib/store';
import { C } from '@/constants/colors';
import type { AppMode, UserPlan } from '@/types';

const PRO_COLOR = '#A78BFA';
const PRO_DARK = '#7C3AED';
const PRO_BG = 'rgba(167,139,250,0.10)';
const PRO_BORDER = 'rgba(167,139,250,0.24)';

const PERSONAL_FEATURES = [
  'Gjurro shpenzimet ditore',
  'Buxhete mujore',
  'Raporte & statistika',
  'Njohuri inteligjente (AI)',
  'Skanim i faturave',
  'Hyrje me zë',
];

const BUSINESS_FEATURES = [
  'Shpenzime biznesi',
  'Gjurmim furnitorësh & inventari',
  'Raporte biznesi',
  'Strukturë gati për taksa/eksport',
  'Bazë për funksione ekipi',
  'Kategori profesionale',
];

const PRO_FEATURES = [
  'Personal Mode + Business Mode',
  'Kalo lirshëm midis mënyrave',
  'Të gjitha funksionet personale',
  'Të gjitha funksionet e biznesit',
  'Prioritet mbështetje',
  'Funksione ekskluzive Pro',
];

interface PlanCardProps {
  title: string;
  tagline: string;
  icon: keyof typeof Ionicons.glyphMap;
  accentColor: string;
  accentBg: string;
  accentBorder: string;
  accentDark: string;
  glowColors: string[];
  features: string[];
  priceMonthly: string;
  priceYearly: string;
  ctaLabel: string;
  recommended?: boolean;
  recommendedLabel?: string;
  isSelecting: boolean;
  onPress: () => void;
}

function PlanCard({
  title,
  tagline,
  icon,
  accentColor,
  accentBg,
  accentBorder,
  accentDark,
  glowColors,
  features,
  priceMonthly,
  priceYearly,
  ctaLabel,
  recommended,
  recommendedLabel = 'Rekomanduar',
  isSelecting,
  onPress,
}: PlanCardProps) {
  return (
    <View style={[styles.card, { borderColor: accentBorder }]}>
      <LinearGradient
        colors={glowColors}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      {/* Top shimmer */}
      <View style={[styles.cardShimmer, { backgroundColor: accentBorder }]} />

      {recommended && (
        <View style={[styles.badge, { backgroundColor: accentBg, borderColor: accentBorder }]}>
          <View style={[styles.badgeDot, { backgroundColor: accentColor }]} />
          <Text style={[styles.badgeText, { color: accentColor }]}>{recommendedLabel}</Text>
        </View>
      )}

      {/* Icon + heading */}
      <View style={styles.cardHead}>
        <View style={[styles.cardIconWrap, { backgroundColor: accentBg, borderColor: accentBorder }]}>
          <Ionicons name={icon} size={26} color={accentColor} />
        </View>
        <View style={styles.cardHeadText}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardTagline}>{tagline}</Text>
        </View>
      </View>

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: accentBorder }]} />

      {/* Features */}
      <View style={styles.features}>
        {features.map((feat) => (
          <View key={feat} style={styles.featRow}>
            <View style={[styles.featCheck, { backgroundColor: accentBg, borderColor: accentBorder }]}>
              <Ionicons name="checkmark" size={11} color={accentColor} />
            </View>
            <Text style={styles.featText}>{feat}</Text>
          </View>
        ))}
      </View>

      {/* Pricing */}
      <View style={[styles.pricing, { borderColor: accentBorder }]}>
        <LinearGradient
          colors={[`${accentBorder}55`, 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <Text style={[styles.priceMain, { color: accentColor }]}>{priceMonthly}</Text>
        <Text style={styles.priceSub}>{priceYearly}</Text>
      </View>

      {/* CTA */}
      <Pressable
        style={({ pressed }) => [styles.cta, pressed && { opacity: 0.82 }]}
        onPress={onPress}
        disabled={isSelecting}
        accessibilityRole="button"
        accessibilityLabel={ctaLabel}
      >
        <LinearGradient
          colors={[accentColor, accentDark]}
          style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
        {isSelecting ? (
          <ActivityIndicator size="small" color={C.white} />
        ) : (
          <>
            <Text style={styles.ctaText}>{ctaLabel}</Text>
            <Ionicons name="arrow-forward" size={16} color={C.white} />
          </>
        )}
      </Pressable>
    </View>
  );
}

export default function ZgjidhPlanin() {
  const { state, setPlan, setMode, setModeSelected } = useStore();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 720;

  const [selecting, setSelecting] = useState<UserPlan | null>(null);

  const handleSelect = (plan: UserPlan) => {
    if (selecting) return;
    setSelecting(plan);
    setPlan(plan);
    const mode: AppMode = plan === 'business' ? 'business' : 'personal';
    setMode(mode);
    setModeSelected();
    const isLoggedIn = state.isLoggedIn;
    setTimeout(() => {
      if (isLoggedIn) {
        router.replace('/(app)/(tabs)');
      } else {
        router.replace('/(auth)/login');
      }
    }, 200);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Ambient glows */}
      <View style={styles.glowGreen} pointerEvents="none" />
      <View style={styles.glowBlue} pointerEvents="none" />
      <View style={styles.glowPurple} pointerEvents="none" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          isWide && styles.scrollWide,
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoMark}>
            <Text style={styles.logoText}>V</Text>
          </View>
          <Text style={styles.title}>Zgjidh Planin Tënd</Text>
          <Text style={styles.subtitle}>
            Personalizoni përvojën tuaj me Valuta.{'\n'}
            Zgjidhni planin që i përshtatet nevojave tuaja.
          </Text>
        </View>

        {/* Plan cards */}
        <View style={[styles.grid, isWide && styles.gridWide]}>
          <PlanCard
            title="Personal"
            tagline="Për individë dhe financa personale"
            icon="person-outline"
            accentColor={C.primary}
            accentBg={C.primaryBg}
            accentBorder={C.primaryBorder}
            accentDark={C.primaryDark}
            glowColors={[
              'rgba(16,185,129,0.09)',
              'rgba(16,185,129,0.03)',
              'rgba(6,11,24,0)',
            ]}
            features={PERSONAL_FEATURES}
            priceMonthly="299 Lekë / muaj"
            priceYearly="ose 1,990 Lekë / vit"
            ctaLabel="Zgjidh Personal"
            isSelecting={selecting === 'personal'}
            onPress={() => handleSelect('personal')}
          />

          <PlanCard
            title="Biznes"
            tagline="Për biznese, dyqane, kaffe & freelancer"
            icon="briefcase-outline"
            accentColor={C.accentLight}
            accentBg={C.accentBg}
            accentBorder={C.accentBorder}
            accentDark={C.accentDark}
            glowColors={[
              'rgba(59,130,246,0.12)',
              'rgba(59,130,246,0.04)',
              'rgba(6,11,24,0)',
            ]}
            features={BUSINESS_FEATURES}
            priceMonthly="2,990 Lekë / muaj"
            priceYearly="ose 29€ / muaj (vjetor)"
            ctaLabel="Zgjidh Biznes"
            isSelecting={selecting === 'business'}
            onPress={() => handleSelect('business')}
          />

          <PlanCard
            title="Valuta Pro"
            tagline="Aksesi i plotë — Personal + Biznes"
            icon="star-outline"
            accentColor={PRO_COLOR}
            accentBg={PRO_BG}
            accentBorder={PRO_BORDER}
            accentDark={PRO_DARK}
            glowColors={[
              'rgba(167,139,250,0.12)',
              'rgba(167,139,250,0.05)',
              'rgba(6,11,24,0)',
            ]}
            features={PRO_FEATURES}
            priceMonthly="3,990 Lekë / muaj"
            priceYearly="ose 39€ / muaj (vjetor)"
            ctaLabel="Zgjidh Valuta Pro"
            recommended
            recommendedLabel="Më i rekomanduar"
            isSelecting={selecting === 'pro'}
            onPress={() => handleSelect('pro')}
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Ionicons name="information-circle-outline" size={14} color={C.textMuted} />
          <Text style={styles.footerText}>
            Mund ta ndryshosh më vonë te Cilësimet.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  glowGreen: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(16,185,129,0.055)',
    top: 60,
    left: -100,
  },
  glowBlue: {
    position: 'absolute',
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: 'rgba(59,130,246,0.045)',
    top: 220,
    right: -120,
  },
  glowPurple: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(167,139,250,0.04)',
    top: 500,
    left: -80,
  },

  scroll: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 52,
    gap: 32,
    alignItems: 'center',
  },
  scrollWide: {
    paddingHorizontal: 40,
    paddingTop: 48,
    maxWidth: 1100,
    alignSelf: 'center',
    width: '100%',
  },

  // ── Header ──────────────────────────────────────────────────
  header: {
    alignItems: 'center',
    gap: 14,
    maxWidth: 480,
    width: '100%',
  },
  logoMark: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: C.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.primaryBorder,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 10,
  },
  logoText: {
    fontSize: 30,
    fontWeight: '800',
    color: C.primary,
    letterSpacing: -1,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: C.textSub,
    textAlign: 'center',
    lineHeight: 23,
    letterSpacing: -0.1,
  },

  // ── Grid ────────────────────────────────────────────────────
  grid: {
    width: '100%',
    flexDirection: 'column',
    gap: 16,
  },
  gridWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },

  // ── Card ────────────────────────────────────────────────────
  card: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1.5,
    backgroundColor: C.card,
    padding: 24,
    gap: 20,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 24,
    elevation: 12,
  },
  cardShimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    opacity: 0.55,
  },

  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  cardIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  cardHeadText: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
    paddingTop: 4,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.5,
  },
  cardTagline: {
    fontSize: 12,
    color: C.textSub,
    lineHeight: 17,
  },

  divider: {
    height: 1,
    opacity: 0.35,
    marginHorizontal: -2,
  },

  features: { gap: 12, flexGrow: 1 },
  featRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featCheck: {
    width: 23,
    height: 23,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  featText: {
    fontSize: 13,
    color: C.textSub,
    flex: 1,
    lineHeight: 18,
    fontWeight: '500',
  },

  pricing: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    gap: 5,
    overflow: 'hidden',
    position: 'relative',
  },
  priceMain: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  priceSub: {
    fontSize: 12,
    color: C.textMuted,
    fontWeight: '500',
  },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 52,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '800',
    color: C.white,
    letterSpacing: -0.2,
  },

  // ── Footer ──────────────────────────────────────────────────
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  footerText: {
    fontSize: 13,
    color: C.textMuted,
    fontWeight: '500',
  },
});
