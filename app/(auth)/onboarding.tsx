import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  NativeScrollEvent,
  NativeSyntheticEvent,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';
import { C, GRADIENTS } from '@/constants/colors';

const SLIDES = [
  {
    icon: 'wallet',
    iconColor: C.primary,
    iconBg: C.primaryBg,
    title: 'Menaxho\nFinancat Tua',
    desc: 'Shto shpenzimet, ndiq buxhetin dhe merr kontrollin e plotë mbi financat e tua personale.',
    gradient: GRADIENTS.hero,
  },
  {
    icon: 'bar-chart',
    iconColor: C.accentLight,
    iconBg: C.accentBg,
    title: 'Analiza\ntë Detajuara',
    desc: 'Vizualizo shpenzimet javore dhe mujore. Zbulo ku po shkon paratë tua me raporte të qarta.',
    gradient: GRADIENTS.hero,
  },
  {
    icon: 'shield-checkmark',
    iconColor: '#F59E0B',
    iconBg: 'rgba(245,158,11,0.12)',
    title: 'E Sigurt\ndhe Lokale',
    desc: 'Të dhënat ruhen vetëm në pajisjen tënde. Valuta është projektuar për përdoruesin shqiptar.',
    gradient: GRADIENTS.hero,
  },
];

// SafeAreaView in onboarding has paddingHorizontal: 24 on each side, so the
// visible slider area is SW - 48. Use that as the slide width so pagingEnabled
// snaps correctly and slide content fills the available area exactly.
const SLIDE_PADDING = 48;

export default function Onboarding() {
  const { width: SW } = useWindowDimensions();
  const slideWidth = SW - SLIDE_PADDING;
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const router = useRouter();
  const { setOnboarded } = useStore();

  const goNext = () => {
    if (page < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: slideWidth * (page + 1), animated: true });
      setPage(page + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = () => {
    setOnboarded();
    router.replace('/(auth)/zgjidhplanin' as any);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / slideWidth);
    setPage(idx);
  };

  const slide = SLIDES[page];

  return (
    <LinearGradient colors={[C.surface, C.bg]} style={styles.root} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <LinearGradient colors={GRADIENTS.emeraldBlue} style={styles.logoBox} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={styles.logoLetter}>V</Text>
            </LinearGradient>
            <Text style={styles.logoText}>Valuta</Text>
          </View>
          <TouchableOpacity onPress={handleFinish}>
            <Text style={styles.skip}>Kalo</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll}
          scrollEventThrottle={16}
          style={styles.slider}
        >
          {SLIDES.map((s, i) => (
            <View key={i} style={[styles.slide, { width: slideWidth }]}>
              <View style={[styles.iconCircle, { backgroundColor: s.iconBg }]}>
                <View style={styles.iconInner}>
                  <Ionicons name={s.icon as any} size={52} color={s.iconColor} />
                </View>
                <View style={[styles.iconGlow, { backgroundColor: s.iconColor + '20' }]} />
              </View>
              <Text style={styles.slideTitle}>{s.title}</Text>
              <Text style={styles.slideDesc}>{s.desc}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === page && styles.dotActive]}
            />
          ))}
        </View>

        <View style={styles.actions}>
          <Button onPress={goNext} size="lg" fullWidth>
            {page < SLIDES.length - 1 ? 'Vazhdo' : 'Fillo Tani'}
          </Button>
          {page === SLIDES.length - 1 && (
            <View style={styles.authRow}>
              <Text style={styles.authText}>Ke llogari? </Text>
              <TouchableOpacity onPress={() => { setOnboarded(); router.replace('/(auth)/zgjidhplanin' as any); }}>
                <Text style={styles.authLink}>Hyr</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 24 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 24,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoLetter: { fontSize: 20, fontWeight: '800', color: C.white },
  logoText: { fontSize: 20, fontWeight: '700', color: C.text, letterSpacing: -0.4 },
  skip: { fontSize: 14, color: C.textMuted, fontWeight: '500' },
  slider: { flex: 1 },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 24,
  },
  iconCircle: {
    width: 130,
    height: 130,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  iconInner: { zIndex: 1 },
  iconGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -35,
    left: -35,
  },
  slideTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: C.text,
    textAlign: 'center',
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  slideDesc: {
    fontSize: 15,
    color: C.textSub,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 20,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.border,
  },
  dotActive: {
    width: 24,
    borderRadius: 3,
    backgroundColor: C.primary,
  },
  actions: { paddingBottom: 16, gap: 14 },
  authRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  authText: { fontSize: 14, color: C.textMuted },
  authLink: { fontSize: 14, color: C.primary, fontWeight: '600' },
});
