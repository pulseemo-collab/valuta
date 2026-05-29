// Web stub — biometric auth is only available on native devices.
export type BiometricType = 'fingerprint' | 'face' | 'iris' | 'none';

export interface BiometricStatus {
  hasHardware: boolean;
  isEnrolled: boolean;
  type: BiometricType;
  supportedTypes: BiometricType[];
}

export async function getBiometricStatus(): Promise<BiometricStatus> {
  return { hasHardware: false, isEnrolled: false, type: 'none', supportedTypes: [] };
}

export async function authenticateAsync(_promptMessage: string): Promise<boolean> {
  return false;
}

export async function loadBiometricEnabled(): Promise<boolean> {
  return false;
}

export async function saveBiometricEnabled(_enabled: boolean): Promise<void> {}
