import '../global.css';
import React, { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, Text, ActivityIndicator, Animated, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppProvider, useStore } from '@/lib/store';
import { ThemeProvider, useIsLight } from '@/lib/ThemeContext';
import {
  getBiometricStatus,
  loadBiometricEnabled,
  authenticateAsync,
  type BiometricStatus,
} from '@/lib/biometricAuth';
import { C, GRADIENTS } from '@/constants/colors';

// URL polyfill is only needed on native — web already has a native URL API
// and loading it during Expo Router SSR crashes with "window is not defined"
if (Platform.OS !== 'web') {
  try {
    require('react-native-url-polyfill/auto');
  } catch (e) {
    console.warn('[Valuta] URL polyfill load failed:', e);
  }
}

// ── Root error boundary ───────────────────────────────────────────────────────
// Catches any render-time exception so the app shows a recoverable error screen
// instead of a blank crash on Android.
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  state = { hasError: false, error: '' };

  static getDerivedStateFromError(err: Error) {
    return { hasError: true, error: err?.message ?? 'Gabim i panjohur.' };
  }

  componentDidCatch(err: Error, info: React.ErrorInfo) {
    console.error('[Valuta] RootErrorBoundary caught:', err?.message, info?.componentStack?.slice(0, 400));
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#060B18', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Text style={{ fontSize: 36, fontWeight: '800', color: '#10B981', marginBottom: 20 }}>V</Text>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 8 }}>Diçka shkoi keq</Text>
          <Text style={{ color: 'rgba(148,163,184,0.65)', fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
            {this.state.error}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function ThemedStatusBar() {
  const isLight = useIsLight();
  return <StatusBar style={isLight ? 'dark' : 'light'} backgroundColor={isLight ? '#F8FAFC' : '#060B18'} />;
}

// ── Biometric gate ────────────────────────────────────────────────────────────

interface BiometricGateProps {
  status: BiometricStatus;
  onUnlock: () => void;
}

function BiometricGate({ status, onUnlock }: BiometricGateProps) {
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState(false);

  const typeIcon: keyof typeof Ionicons.glyphMap =
    status.type === 'face' ? 'scan-outline' : 'finger-print-outline';

  const typeLabel =
    status.type === 'face'
      ? 'Face ID / Njohje fytyre'
      : status.type === 'iris'
      ? 'Njohja e irisit'
      : 'Gjurma e gishtit';

  const handleBiometric = async () => {
    setAuthenticating(true);
    setError(false);
    const ok = await authenticateAsync('Konfirmo identitetin tënd');
    setAuthenticating(false);
    if (ok) {
      onUnlock();
    } else {
      setError(true);
    }
  };

  // Auto-trigger on mount
  useEffect(() => {
    handleBiometric();
  }, []);

  return (
    <LinearGradient colors={GRADIENTS.hero} style={bioGate.root}>
      <SafeAreaView style={bioGate.safe} edges={['top', 'bottom']}>
        <View style={bioGate.inner}>
          <LinearGradient
            colors={GRADIENTS.emeraldBlue}
            style={bioGate.logoBox}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={bioGate.logoLetter}>V</Text>
          </LinearGradient>

          <Text style={bioGate.title}>Mirë se vjen</Text>
          <Text style={bioGate.subtitle}>Konfirmo identitetin për të vazhduar</Text>

          <View style={bioGate.iconWrap}>
            <Ionicons name={typeIcon} size={52} color={C.primary} />
          </View>

          <Text style={bioGate.typeLabel}>{typeLabel}</Text>

          {error && (
            <View style={bioGate.errorBox}>
              <Ionicons name="alert-circle-outline" size={15} color={C.danger} />
              <Text style={bioGate.errorText}>Verifikimi dështoi. Provo sërish.</Text>
            </View>
          )}

          <TouchableOpacity
            style={[bioGate.btn, authenticating && { opacity: 0.65 }]}
            onPress={handleBiometric}
            activeOpacity={0.8}
            disabled={authenticating}
          >
            <LinearGradient colors={GRADIENTS.primary} style={bioGate.btnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              {authenticating
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name={typeIcon} size={20} color="#fff" />}
              <Text style={bioGate.btnText}>
                {authenticating ? 'Duke verifikuar...' : 'Hyr me biometrikë'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const bioGate = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  inner: { width: '100%', maxWidth: 340, paddingHorizontal: 28, alignItems: 'center', gap: 16 },
  logoBox: {
    width: 64, height: 64, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45, shadowRadius: 14, elevation: 8,
  },
  logoLetter: { fontSize: 32, fontWeight: '800', color: '#fff' },
  title: { fontSize: 26, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: C.textSub, textAlign: 'center' },
  iconWrap: {
    width: 100, height: 100, borderRadius: 30,
    backgroundColor: C.primaryBg, borderWidth: 1.5, borderColor: C.primaryBorder,
    justifyContent: 'center', alignItems: 'center', marginVertical: 8,
  },
  typeLabel: { fontSize: 15, fontWeight: '600', color: C.textSub },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.dangerBgSubtle, borderRadius: 10,
    borderWidth: 1, borderColor: C.dangerBorder, padding: 12,
    width: '100%',
  },
  errorText: { flex: 1, fontSize: 13, color: C.danger, lineHeight: 18 },
  btn: { width: '100%', borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  btnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16,
  },
  btnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

// ── Auth Guard ────────────────────────────────────────────────────────────────

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { state } = useStore();
  const segments = useSegments();
  const router = useRouter();

  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioStatus, setBioStatus] = useState<BiometricStatus | null>(null);
  const [bioUnlocked, setBioUnlocked] = useState(false);
  const bioChecked = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web' || bioChecked.current) return;
    bioChecked.current = true;
    Promise.all([loadBiometricEnabled(), getBiometricStatus()]).then(([enabled, status]) => {
      setBioEnabled(enabled);
      setBioStatus(status);
    });
  }, []);

  useEffect(() => {
    if (!state.authInitialized) return;

    const inAuth = segments[0] === '(auth)';
    const currentScreen = segments[1] as string | undefined;
    const onPlanScreen = inAuth && currentScreen === 'zgjidhplanin';

    if (!state.hasOnboarded) {
      // Must complete onboarding before anything else
      if (!inAuth || currentScreen !== 'onboarding') {
        router.replace('/(auth)/onboarding');
      }
    } else if (!state.isLoggedIn) {
      if (!inAuth) {
        // Outside auth stack entirely — redirect to the right gate
        router.replace(
          state.modeSelected ? '/(auth)/login' : ('/(auth)/zgjidhplanin' as any)
        );
      } else if (
        !state.modeSelected &&
        (currentScreen === 'login' || currentScreen === 'register')
      ) {
        // Can't reach login/register without picking a plan first
        router.replace('/(auth)/zgjidhplanin' as any);
      }
      // Otherwise: free navigation within the auth stack (onboarding ↔ plan ↔ login ↔ register)
    } else if (!state.modeSelected) {
      // Logged in but no plan chosen (backwards-compat for existing sessions)
      if (!onPlanScreen) {
        router.replace('/(auth)/zgjidhplanin' as any);
      }
    } else if (state.isLoggedIn && inAuth) {
      // Fully authenticated — leave the auth stack
      router.replace('/(app)/(tabs)');
    }
  }, [state.authInitialized, state.hasOnboarded, state.isLoggedIn, state.modeSelected, segments]);

  if (!state.authInitialized) {
    return <SplashScreen />;
  }

  // Biometric gate: show when logged in, biometric enabled, hardware available, and not yet unlocked
  const needsBioGate =
    Platform.OS !== 'web' &&
    state.isLoggedIn &&
    state.modeSelected &&
    bioEnabled &&
    !bioUnlocked &&
    bioStatus !== null &&
    bioStatus.hasHardware &&
    bioStatus.isEnrolled;

  return (
    <>
      {children}
      {needsBioGate && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}>
          <BiometricGate status={bioStatus!} onUnlock={() => setBioUnlocked(true)} />
        </View>
      )}
    </>
  );
}

function SplashScreen() {
  const pulse = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.6, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#060B18',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 20,
      }}
    >
      <Animated.View
        style={{
          opacity: pulse,
          width: 76,
          height: 76,
          borderRadius: 22,
          backgroundColor: '#0d2419',
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 1.5,
          borderColor: 'rgba(16,185,129,0.35)',
          shadowColor: '#10B981',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.3,
          shadowRadius: 16,
          elevation: 8,
        }}
      >
        <Text
          style={{
            fontSize: 36,
            fontWeight: '800',
            color: '#10B981',
            letterSpacing: -1,
          }}
        >
          V
        </Text>
      </Animated.View>
      <ActivityIndicator size="small" color="#10B981" />
      <Text
        style={{
          fontSize: 13,
          color: 'rgba(148,163,184,0.55)',
          fontWeight: '500',
          letterSpacing: 0.3,
        }}
      >
        Duke u ngarkuar...
      </Text>
    </View>
  );
}

export default function RootLayout() {
  return (
    <RootErrorBoundary>
      <SafeAreaProvider>
        <AppProvider>
          <ThemeProvider>
            <AuthGuard>
              <ThemedStatusBar />
              <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(app)" />
              </Stack>
            </AuthGuard>
          </ThemeProvider>
        </AppProvider>
      </SafeAreaProvider>
    </RootErrorBoundary>
  );
}
