import '../global.css';
import React, { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, Text, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useStore } from '@/lib/store';
import { ThemeProvider, useIsLight } from '@/lib/ThemeContext';

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

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { state } = useStore();
  const segments = useSegments();
  const router = useRouter();

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

  return <>{children}</>;
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
