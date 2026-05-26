import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFS_KEY = '@valuta/notif_prefs_v1';

export interface NotificationPrefs {
  enabled: boolean;
  budgetWarnings: boolean;
  inactivityReminders: boolean;
  inactivityDays: number;
  dailyReminders: boolean;
}

export const DEFAULT_PREFS: NotificationPrefs = {
  enabled: true,
  budgetWarnings: true,
  inactivityReminders: true,
  inactivityDays: 3,
  dailyReminders: false,
};

export async function loadNotifPrefs(): Promise<NotificationPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export async function saveNotifPrefs(prefs: NotificationPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // silently fail — non-critical persistence
  }
}
