import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@valuta/email_report_prefs_v1';

export type ReportFormat = 'pdf' | 'csv';
export type ReportFrequency = 'once' | 'weekly' | 'monthly';

export interface EmailReportPrefs {
  email: string;
  format: ReportFormat;
  frequency: ReportFrequency;
  enabled: boolean;
  configuredAt: string | null;
}

export const DEFAULT_EMAIL_PREFS: EmailReportPrefs = {
  email: '',
  format: 'pdf',
  frequency: 'monthly',
  enabled: false,
  configuredAt: null,
};

export async function loadEmailReportPrefs(): Promise<EmailReportPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_EMAIL_PREFS };
    return { ...DEFAULT_EMAIL_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_EMAIL_PREFS };
  }
}

export async function saveEmailReportPrefs(prefs: EmailReportPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // non-critical
  }
}
