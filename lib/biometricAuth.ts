import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREF_KEY = '@valuta/biometric_enabled_v1';

export type BiometricType = 'fingerprint' | 'face' | 'iris' | 'none';

export interface BiometricStatus {
  hasHardware: boolean;
  isEnrolled: boolean;
  type: BiometricType;
  supportedTypes: BiometricType[];
}

export async function getBiometricStatus(): Promise<BiometricStatus> {
  try {
    const [hasHardware, isEnrolled, rawTypes] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);

    // Map enum values to our type strings
    const supportedTypes: BiometricType[] = rawTypes.map((t) => {
      if (t === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) return 'face';
      if (t === LocalAuthentication.AuthenticationType.IRIS) return 'iris';
      return 'fingerprint';
    });

    // On Android, hasHardwareAsync uses BiometricManager.canAuthenticate() which
    // can return false when hardware exists but nothing is enrolled. Use
    // supportedAuthenticationTypesAsync() as a fallback — it queries PackageManager
    // feature flags and reflects actual hardware regardless of enrollment state.
    const effectiveHasHardware = hasHardware || supportedTypes.length > 0;

    if (__DEV__) {
      console.log('[Biometric] hasHardware:', hasHardware);
      console.log('[Biometric] isEnrolled:', isEnrolled);
      console.log('[Biometric] rawTypes:', rawTypes);
      console.log('[Biometric] supportedTypes:', supportedTypes);
      console.log('[Biometric] effectiveHasHardware:', effectiveHasHardware);
    }

    if (!effectiveHasHardware) {
      return { hasHardware: false, isEnrolled: false, type: 'none', supportedTypes: [] };
    }

    // Primary type: face takes precedence over iris, then fingerprint
    let type: BiometricType = 'fingerprint';
    if (supportedTypes.includes('face')) type = 'face';
    else if (supportedTypes.includes('iris')) type = 'iris';
    else if (supportedTypes.length === 0) type = 'none';

    return { hasHardware: true, isEnrolled, type, supportedTypes };
  } catch (e) {
    if (__DEV__) console.warn('[Biometric] Detection error:', e);
    return { hasHardware: false, isEnrolled: false, type: 'none', supportedTypes: [] };
  }
}

export async function authenticateAsync(promptMessage: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: '',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}

export async function loadBiometricEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(PREF_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function saveBiometricEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(PREF_KEY, enabled ? 'true' : 'false');
  } catch {}
}
