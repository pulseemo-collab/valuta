export type Currency = 'ALL' | 'EUR' | 'USD';

export type RecurringFrequency = 'weekly' | 'monthly' | 'yearly';

export type PersonalCategoryId =
  | 'ushqim'
  | 'transport'
  | 'faturat'
  | 'shopping'
  | 'shendet'
  | 'argetime'
  | 'biznes'
  | 'tjera';

export type BusinessCategoryId =
  | 'furnitor'
  | 'inventar'
  | 'marketing_biz'
  | 'zyre'
  | 'transport_biz'
  | 'punonjes'
  | 'taksa'
  | 'sherbime';

export type CategoryId = PersonalCategoryId | BusinessCategoryId;

export interface Subscription {
  id: string;
  name: string;
  icon: string;
  color: string;
  bgColor: string;
  amount: number;
  currency: Currency;
  frequency: RecurringFrequency;
  startDate: string;
  nextPaymentDate: string;
  isActive: boolean;
  categoryId: CategoryId;
}

export interface RecurringSettings {
  autoCreateOnDetect: boolean;
  reminderEnabled: boolean;
  reminderDaysBefore: number;
}

export type AppMode = 'personal' | 'business';

export interface FinancialGoal {
  id: string;
  title: string;
  icon: string;
  color: string;
  bgColor: string;
  targetAmount: number;
  savedAmount: number;
  currency: Currency;
  deadline?: string; // YYYY-MM-DD
  mode: AppMode;
  createdAt: string;
  completedAt?: string;
}

export type UserPlan = 'personal' | 'business' | 'pro';

export interface Category {
  id: CategoryId;
  name: string;
  icon: string;
  color: string;
  bgColor: string;
}

export interface Expense {
  id: string;
  amount: number;
  currency: Currency;
  category: CategoryId;
  note: string;
  date: string;
  convertedALL?: number;
  mode?: AppMode; // undefined = personal (backward compat)
}

export interface Budget {
  monthly: number;
  currency: Currency;
}

export interface AppState {
  expenses: Expense[];
  budget: Budget;
  preferredCurrency: Currency;
  hasOnboarded: boolean;
  isLoggedIn: boolean;
  authInitialized: boolean;
  supabaseUserId: string | null;
  userEmail: string | null;
  userName: string | null;
  syncing: boolean;
  saveError: string | null;
  mode: AppMode;
  modeSelected: boolean;
  plan: UserPlan;
  subscriptions: Subscription[];
  recurringSettings: RecurringSettings;
  goals: FinancialGoal[];
}

export type AppAction =
  | { type: 'ADD_EXPENSE'; payload: Expense }
  | { type: 'DELETE_EXPENSE'; payload: string }
  | { type: 'SET_BUDGET'; payload: Budget }
  | { type: 'SET_CURRENCY'; payload: Currency }
  | { type: 'SET_MODE'; payload: AppMode }
  | { type: 'SET_MODE_SELECTED' }
  | { type: 'SET_PLAN'; payload: UserPlan }
  | { type: 'SET_ONBOARDED' }
  | { type: 'SET_LOGGED_IN'; payload: boolean }
  | { type: 'SET_AUTH_INITIALIZED' }
  | { type: 'SET_SUPABASE_USER'; payload: string | null }
  | { type: 'SET_USER_EMAIL'; payload: string | null }
  | { type: 'SET_USER_NAME'; payload: string | null }
  | { type: 'SET_SYNCING'; payload: boolean }
  | { type: 'CLEAR_USER_DATA' }
  | { type: 'SET_SAVE_ERROR'; payload: string | null }
  | { type: 'HYDRATE'; payload: Partial<AppState> }
  | { type: 'ADD_SUBSCRIPTION'; payload: Subscription }
  | { type: 'REMOVE_SUBSCRIPTION'; payload: string }
  | { type: 'TOGGLE_SUBSCRIPTION'; payload: string }
  | { type: 'SET_RECURRING_SETTINGS'; payload: Partial<RecurringSettings> }
  | { type: 'ADD_GOAL'; payload: FinancialGoal }
  | { type: 'UPDATE_GOAL'; payload: { id: string; updates: Partial<FinancialGoal> } }
  | { type: 'REMOVE_GOAL'; payload: string };
