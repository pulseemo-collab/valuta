import React, { createContext, useContext, useReducer, useEffect, useRef, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppState, AppAction, Currency, Expense, Budget, AppMode, UserPlan, Subscription, RecurringSettings, FinancialGoal, AppTheme, AppLanguage } from '@/types';
import { convertToALL } from '@/constants/currencies';
import { initRates } from '@/lib/exchangeRates';
import { generateId } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { fetchExpenses, insertExpense, removeExpense, fetchBudget, upsertBudget } from '@/lib/db';

const STORAGE_KEY = 'valuta_state';

const DEFAULT_BUDGET: Budget = { monthly: 0, currency: 'ALL' };

const DEFAULT_RECURRING_SETTINGS: RecurringSettings = {
  autoCreateOnDetect: true,
  reminderEnabled: false,
  reminderDaysBefore: 2,
};

const initialState: AppState = {
  expenses: [],
  budget: DEFAULT_BUDGET,
  preferredCurrency: 'ALL',
  hasOnboarded: false,
  isLoggedIn: false,
  authInitialized: false,
  supabaseUserId: null,
  userEmail: null,
  userName: null,
  syncing: false,
  saveError: null,
  mode: 'personal',
  modeSelected: false,
  plan: 'personal',
  subscriptions: [],
  recurringSettings: DEFAULT_RECURRING_SETTINGS,
  goals: [],
  theme: 'dark',
  language: 'sq',
  lastSyncTime: null,
};

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'ADD_EXPENSE': {
      const expense: Expense = {
        ...action.payload,
        convertedALL: convertToALL(action.payload.amount, action.payload.currency),
      };
      return { ...state, expenses: [expense, ...state.expenses] };
    }
    case 'DELETE_EXPENSE':
      return { ...state, expenses: state.expenses.filter((e) => e.id !== action.payload) };
    case 'SET_BUDGET':
      return { ...state, budget: action.payload };
    case 'SET_CURRENCY':
      return { ...state, preferredCurrency: action.payload };
    case 'SET_MODE':
      return { ...state, mode: action.payload };
    case 'SET_MODE_SELECTED':
      return { ...state, modeSelected: true };
    case 'SET_PLAN':
      return { ...state, plan: action.payload };
    case 'SET_ONBOARDED':
      return { ...state, hasOnboarded: true };
    case 'SET_LOGGED_IN':
      return { ...state, isLoggedIn: action.payload };
    case 'SET_AUTH_INITIALIZED':
      return { ...state, authInitialized: true };
    case 'SET_SUPABASE_USER':
      return { ...state, supabaseUserId: action.payload };
    case 'SET_USER_EMAIL':
      return { ...state, userEmail: action.payload };
    case 'SET_USER_NAME':
      return { ...state, userName: action.payload };
    case 'SET_SYNCING':
      return { ...state, syncing: action.payload };
    case 'CLEAR_USER_DATA':
      return { ...state, expenses: [], budget: DEFAULT_BUDGET, userName: null, saveError: null };
    case 'SET_SAVE_ERROR':
      return { ...state, saveError: action.payload };
    case 'ADD_SUBSCRIPTION':
      return { ...state, subscriptions: [action.payload, ...state.subscriptions] };
    case 'REMOVE_SUBSCRIPTION':
      return { ...state, subscriptions: state.subscriptions.filter((s) => s.id !== action.payload) };
    case 'TOGGLE_SUBSCRIPTION':
      return {
        ...state,
        subscriptions: state.subscriptions.map((s) =>
          s.id === action.payload ? { ...s, isActive: !s.isActive } : s
        ),
      };
    case 'SET_RECURRING_SETTINGS':
      return {
        ...state,
        recurringSettings: { ...state.recurringSettings, ...action.payload },
      };
    case 'ADD_GOAL':
      return { ...state, goals: [action.payload, ...state.goals] };
    case 'UPDATE_GOAL':
      return {
        ...state,
        goals: state.goals.map((g) =>
          g.id === action.payload.id ? { ...g, ...action.payload.updates } : g
        ),
      };
    case 'REMOVE_GOAL':
      return { ...state, goals: state.goals.filter((g) => g.id !== action.payload) };
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    case 'SET_LANGUAGE':
      return { ...state, language: action.payload };
    case 'SET_LAST_SYNC_TIME':
      return { ...state, lastSyncTime: action.payload };
    case 'HYDRATE': {
      const merged = { ...state, ...action.payload };
      // Backward compat: existing users have no plan in storage — derive from mode
      if (!merged.plan && merged.mode) {
        merged.plan = merged.mode as UserPlan;
      }
      if (!merged.recurringSettings) {
        merged.recurringSettings = DEFAULT_RECURRING_SETTINGS;
      }
      if (!merged.subscriptions) {
        merged.subscriptions = [];
      }
      if (!merged.goals) {
        merged.goals = [];
      }
      if (!merged.theme) {
        merged.theme = 'dark';
      }
      if (!merged.language) {
        merged.language = 'sq';
      }
      if (merged.lastSyncTime === undefined) {
        merged.lastSyncTime = null;
      }
      return merged;
    }
    default:
      return state;
  }
}

interface StoreContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  addExpense: (expense: Omit<Expense, 'id' | 'convertedALL'>) => Promise<{ cloudSaved: boolean; debugError?: string }>;
  deleteExpense: (id: string) => void;
  setBudget: (budget: Budget) => void;
  setCurrency: (currency: Currency) => void;
  setMode: (mode: AppMode) => void;
  setModeSelected: () => void;
  setPlan: (plan: UserPlan) => void;
  setOnboarded: () => void;
  setLoggedIn: (value: boolean) => void;
  clearSaveError: () => void;
  retrySync: () => void;
  addSubscription: (sub: Subscription) => void;
  removeSubscription: (id: string) => void;
  toggleSubscription: (id: string) => void;
  updateRecurringSettings: (settings: Partial<RecurringSettings>) => void;
  addGoal: (goal: FinancialGoal) => void;
  updateGoal: (id: string, updates: Partial<FinancialGoal>) => void;
  removeGoal: (id: string) => void;
  setTheme: (theme: AppTheme) => void;
  setLanguage: (lang: AppLanguage) => void;
  syncNow: () => Promise<void>;
  setUserName: (name: string) => void;
}

const StoreContext = createContext<StoreContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const hydrated = useRef(false);
  const userIdRef = useRef<string | null>(null);
  const syncingRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Fetch exchange rates on mount (best-effort, never throws) ──────────────
  useEffect(() => {
    initRates().catch(() => {});
  }, []);

  // ── Load from AsyncStorage on mount ────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        hydrated.current = true;

        if (!raw) return;

        const saved = JSON.parse(raw) as Partial<AppState>;

        if (Array.isArray(saved.expenses)) {
          saved.expenses = saved.expenses.map((e) => ({
            ...e,
            convertedALL: convertToALL(e.amount, e.currency),
          }));
        }

        // Never restore runtime-only fields — auth state is always from Supabase
        delete saved.supabaseUserId;
        delete saved.syncing;
        delete saved.isLoggedIn;
        delete saved.authInitialized;
        delete saved.userEmail;
        delete saved.userName;
        delete saved.saveError;

        dispatch({ type: 'HYDRATE', payload: saved });
      })
      .catch(() => {
        hydrated.current = true;
      });
  }, []);

  // ── Persist state to AsyncStorage on every change ──────────────────────────
  useEffect(() => {
    if (!hydrated.current) return;
    const {
      supabaseUserId: _uid,
      syncing: _sync,
      isLoggedIn: _li,
      authInitialized: _ai,
      userEmail: _ue,
      userName: _un,
      saveError: _se,
      ...persistable
    } = state;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persistable)).catch(() => {});
  }, [state]);

  // ── Supabase auth listener ─────────────────────────────────────────────────
  useEffect(() => {
    let sub: { unsubscribe: () => void } | null = null;
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        try {
          const userId = session?.user?.id ?? null;
          const email = session?.user?.email ?? null;
          const name = (session?.user?.user_metadata?.display_name as string | undefined) ?? null;

          if (__DEV__) console.log('[Store] Auth event:', event, '| userId:', userId ? userId.slice(0, 8) + '…' : 'null');

          userIdRef.current = userId;
          dispatch({ type: 'SET_SUPABASE_USER', payload: userId });
          dispatch({ type: 'SET_USER_EMAIL', payload: email });
          dispatch({ type: 'SET_USER_NAME', payload: name });
          dispatch({ type: 'SET_LOGGED_IN', payload: !!userId });

          if (event === 'INITIAL_SESSION') {
            dispatch({ type: 'SET_AUTH_INITIALIZED' });
            if (userId) handleUserSignIn(userId);
          } else if (event === 'SIGNED_IN') {
            if (userId) handleUserSignIn(userId);
          } else if (event === 'SIGNED_OUT') {
            dispatch({ type: 'CLEAR_USER_DATA' });
          }
        } catch (callbackErr) {
          console.error('[Store] Auth callback error:', callbackErr);
          dispatch({ type: 'SET_AUTH_INITIALIZED' });
        }
      });
      sub = subscription;
    } catch (err) {
      console.error('[Store] Supabase auth listener setup failed:', err);
      // Ensure the app can render past the splash screen even with no auth
      dispatch({ type: 'SET_AUTH_INITIALIZED' });
    }

    return () => { sub?.unsubscribe(); };
  }, []);

  async function handleUserSignIn(userId: string) {
    if (syncingRef.current) return;
    syncingRef.current = true;
    dispatch({ type: 'SET_SYNCING', payload: true });

    try {
      const [expenses, budget] = await Promise.all([
        fetchExpenses(userId),
        fetchBudget(userId),
      ]);

      if (__DEV__) console.log('[Store] handleUserSignIn — cloud expenses:', expenses.length, '| local expenses:', stateRef.current.expenses.length);

      // Only replace local expenses with cloud data when cloud has data.
      // If cloud returns empty but local cache has expenses, keep local — this
      // prevents a prior failed INSERT from wiping locally-visible expenses.
      const localCount = stateRef.current.expenses.length;
      const shouldReplaceExpenses = expenses.length > 0 || localCount === 0;

      // Recompute convertedALL using current rates (Supabase rows may lack it).
      const recomputedExpenses = expenses.map((e) => ({
        ...e,
        convertedALL: convertToALL(e.amount, e.currency),
      }));

      dispatch({
        type: 'HYDRATE',
        payload: {
          ...(shouldReplaceExpenses ? { expenses: recomputedExpenses } : {}),
          ...(budget ? { budget } : {}),
        },
      });
      dispatch({ type: 'SET_LAST_SYNC_TIME', payload: new Date().toISOString() });
    } catch (err) {
      console.error('[Store] handleUserSignIn failed:', err);
      dispatch({ type: 'SET_SAVE_ERROR', payload: 'Nuk u ngarkuan të dhënat. Kontrollo lidhjen.' });
    } finally {
      syncingRef.current = false;
      dispatch({ type: 'SET_SYNCING', payload: false });
    }
  }

  // ── Store actions ───────────────────────────────────────────────────────────
  const addExpense = async (expense: Omit<Expense, 'id' | 'convertedALL'>): Promise<{ cloudSaved: boolean; debugError?: string }> => {
    const full: Expense = {
      ...expense,
      id: generateId(),
      convertedALL: convertToALL(expense.amount, expense.currency),
    };

    dispatch({ type: 'ADD_EXPENSE', payload: full });

    const uid = userIdRef.current;
    if (uid) {
      try {
        await insertExpense(uid, full);
        return { cloudSaved: true };
      } catch (err: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const e = err as any;
        const dbg = e?.__debugInfo as {
          errInfo: Record<string, unknown>;
          payload: Record<string, unknown>;
          sessionCheck: Record<string, unknown>;
        } | undefined;
        const debugError = dbg
          ? [
              dbg.errInfo.code    ? `code:    ${String(dbg.errInfo.code)}`    : null,
              dbg.errInfo.message ? `message: ${String(dbg.errInfo.message)}` : null,
              dbg.errInfo.hint    ? `hint:    ${String(dbg.errInfo.hint)}`    : null,
              dbg.errInfo.details ? `details: ${String(dbg.errInfo.details)}` : null,
              dbg.errInfo.status  ? `status:  ${String(dbg.errInfo.status)}`  : null,
              '---',
              `user_id match: ${String(dbg.sessionCheck.userIdMatch)}`,
              `token expired: ${String(dbg.sessionCheck.tokenExpired)}`,
              `date sent:     ${String(dbg.payload.date)}`,
              `currency:      ${String(dbg.payload.currency)}`,
              `category:      ${String(dbg.payload.category)}`,
            ].filter(Boolean).join('\n')
          : (e?.message ?? 'Unknown error');
        console.error('[Store] addExpense cloud save failed:\n', debugError);
        dispatch({ type: 'SET_SAVE_ERROR', payload: 'Shpenzimi nuk u ruajt në cloud.' });
        return { cloudSaved: false, debugError };
      }
    } else {
      const debugError = 'No authenticated userId — user is not logged in (userIdRef is null)';
      console.warn('[Store] addExpense:', debugError);
      dispatch({ type: 'SET_SAVE_ERROR', payload: 'Shpenzimi nuk u ruajt: nuk je i kyçur.' });
      return { cloudSaved: false, debugError };
    }
  };

  const deleteExpense = (id: string) => {
    dispatch({ type: 'DELETE_EXPENSE', payload: id });

    const uid = userIdRef.current;
    if (uid) {
      removeExpense(id).catch((err) => {
        console.error('[Store] removeExpense failed:', err);
        dispatch({ type: 'SET_SAVE_ERROR', payload: 'Fshirja nuk u krye në cloud.' });
      });
    }
  };

  const setBudget = (budget: Budget) => {
    dispatch({ type: 'SET_BUDGET', payload: budget });

    const uid = userIdRef.current;
    if (uid) {
      upsertBudget(uid, budget).catch((err) => {
        console.error('[Store] upsertBudget failed:', err);
        dispatch({ type: 'SET_SAVE_ERROR', payload: 'Buxheti nuk u ruajt në cloud.' });
      });
    }
  };

  const setCurrency = (currency: Currency) => dispatch({ type: 'SET_CURRENCY', payload: currency });
  const setMode = (mode: AppMode) => dispatch({ type: 'SET_MODE', payload: mode });
  const setModeSelected = () => dispatch({ type: 'SET_MODE_SELECTED' });
  const setPlan = (plan: UserPlan) => dispatch({ type: 'SET_PLAN', payload: plan });
  const setOnboarded = () => dispatch({ type: 'SET_ONBOARDED' });
  const setLoggedIn = (value: boolean) => dispatch({ type: 'SET_LOGGED_IN', payload: value });
  const clearSaveError = () => dispatch({ type: 'SET_SAVE_ERROR', payload: null });
  const addSubscription = (sub: Subscription) => dispatch({ type: 'ADD_SUBSCRIPTION', payload: sub });
  const removeSubscription = (id: string) => dispatch({ type: 'REMOVE_SUBSCRIPTION', payload: id });
  const toggleSubscription = (id: string) => dispatch({ type: 'TOGGLE_SUBSCRIPTION', payload: id });
  const updateRecurringSettings = (settings: Partial<RecurringSettings>) =>
    dispatch({ type: 'SET_RECURRING_SETTINGS', payload: settings });
  const addGoal = (goal: FinancialGoal) => dispatch({ type: 'ADD_GOAL', payload: goal });
  const updateGoal = (id: string, updates: Partial<FinancialGoal>) =>
    dispatch({ type: 'UPDATE_GOAL', payload: { id, updates } });
  const removeGoal = (id: string) => dispatch({ type: 'REMOVE_GOAL', payload: id });
  const setTheme = (theme: AppTheme) => dispatch({ type: 'SET_THEME', payload: theme });
  const setLanguage = (lang: AppLanguage) => dispatch({ type: 'SET_LANGUAGE', payload: lang });
  const setUserName = (name: string) => dispatch({ type: 'SET_USER_NAME', payload: name });

  const syncNow = async (): Promise<void> => {
    const uid = userIdRef.current;
    if (!uid) throw new Error('Nuk je i kyçur.');
    await handleUserSignIn(uid);
  };

  const retrySync = () => {
    const uid = userIdRef.current;
    dispatch({ type: 'SET_SAVE_ERROR', payload: null });
    if (uid) handleUserSignIn(uid);
  };

  return (
    <StoreContext.Provider
      value={{ state, dispatch, addExpense, deleteExpense, setBudget, setCurrency, setMode, setModeSelected, setPlan, setOnboarded, setLoggedIn, clearSaveError, retrySync, addSubscription, removeSubscription, toggleSubscription, updateRecurringSettings, addGoal, updateGoal, removeGoal, setTheme, setLanguage, syncNow, setUserName }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreContextType {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within AppProvider');
  return ctx;
}
