import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { useStore } from '@/lib/store';
import {
  loadNotifPrefs,
  saveNotifPrefs,
  type NotificationPrefs,
  DEFAULT_PREFS,
} from '@/lib/notificationPrefs';
import { computePendingNotifications, type PendingNotification } from '@/lib/notificationEngine';

interface NotifContextValue {
  prefs: NotificationPrefs;
  prefsReady: boolean;
  updatePrefs: (partial: Partial<NotificationPrefs>) => Promise<void>;
  currentBanner: PendingNotification | null;
  dismissBanner: () => void;
}

const NotifContext = createContext<NotifContextValue>({
  prefs: DEFAULT_PREFS,
  prefsReady: false,
  updatePrefs: async () => {},
  currentBanner: null,
  dismissBanner: () => {},
});

// IDs dismissed in the current app session — survives tab navigation but not app restart
const dismissedIds = new Set<string>();

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { state } = useStore();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [prefsReady, setPrefsReady] = useState(false);
  const [currentBanner, setCurrentBanner] = useState<PendingNotification | null>(null);

  // Stable refs so callbacks never need to be recreated
  const expensesRef = useRef(state.expenses);
  const budgetRef = useRef(state.budget);
  const prefsRef = useRef(prefs);
  const bannerIdRef = useRef<string | null>(null);
  const prefsReadyRef = useRef(false);

  useEffect(() => { expensesRef.current = state.expenses; }, [state.expenses]);
  useEffect(() => { budgetRef.current = state.budget; }, [state.budget]);
  useEffect(() => { prefsRef.current = prefs; }, [prefs]);

  const applyCheck = useCallback((p: NotificationPrefs) => {
    if (!prefsReadyRef.current) return;
    const pending = computePendingNotifications(expensesRef.current, budgetRef.current, p);
    const next = pending.find((n) => !dismissedIds.has(n.id)) ?? null;
    if (next?.id !== bannerIdRef.current) {
      bannerIdRef.current = next?.id ?? null;
      setCurrentBanner(next);
    }
  }, []);

  // Load prefs once on mount
  useEffect(() => {
    loadNotifPrefs().then((p) => {
      prefsRef.current = p;
      setPrefs(p);
      prefsReadyRef.current = true;
      setPrefsReady(true);
      applyCheck(p);
    });
  }, [applyCheck]);

  // Re-check whenever expenses, budget, or prefs change
  useEffect(() => {
    if (!prefsReady) return;
    applyCheck(prefsRef.current);
  }, [state.expenses, state.budget, prefs, prefsReady, applyCheck]);

  // Re-check when app returns to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') applyCheck(prefsRef.current);
    });
    return () => sub.remove();
  }, [applyCheck]);

  const dismissBanner = useCallback(() => {
    if (bannerIdRef.current) {
      dismissedIds.add(bannerIdRef.current);
      bannerIdRef.current = null;
      setCurrentBanner(null);
    }
  }, []);

  const updatePrefs = useCallback(async (partial: Partial<NotificationPrefs>) => {
    const next = { ...prefsRef.current, ...partial };
    prefsRef.current = next;
    setPrefs(next);
    prefsReadyRef.current = true;
    await saveNotifPrefs(next);
    applyCheck(next);
  }, [applyCheck]);

  return (
    <NotifContext.Provider value={{ prefs, prefsReady, updatePrefs, currentBanner, dismissBanner }}>
      {children}
    </NotifContext.Provider>
  );
}

export const useNotifContext = () => useContext(NotifContext);
