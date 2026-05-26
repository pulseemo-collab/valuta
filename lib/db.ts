import { supabase } from '@/lib/supabase';
import { convertToALL } from '@/constants/currencies';
import type { Expense, Budget, Currency, CategoryId } from '@/types';
import type { DbExpense, DbBudget } from '@/types/supabase';

// The Supabase generic type inference requires an exactly-matching schema shape.
// We cast to `any` at query boundaries and rely on our local Db* interfaces for
// type safety in return values.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ── Expenses ────────────────────────────────────────────────────────────────

function dbExpenseToLocal(row: DbExpense): Expense {
  return {
    id: row.id,
    amount: row.amount,
    currency: row.currency as Currency,
    category: row.category as CategoryId,
    note: row.note,
    date: row.date,
    convertedALL: convertToALL(row.amount, row.currency as Currency),
    ...(row.mode ? { mode: row.mode as import('@/types').AppMode } : {}),
  };
}

export async function fetchExpenses(userId: string): Promise<Expense[]> {
  if (__DEV__) console.log('[DB] fetchExpenses → userId:', userId);
  const { data, error } = await db
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) {
    console.error('[DB] fetchExpenses FAILED:', error.code, '|', error.message, '|', error.details);
    throw error;
  }
  if (__DEV__) console.log('[DB] fetchExpenses OK —', data?.length ?? 0, 'rows');
  return ((data ?? []) as DbExpense[]).map(dbExpenseToLocal);
}

export async function insertExpense(userId: string, expense: Expense): Promise<void> {
  // ── Session verification ───────────────────────────────────────────────────
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session;
  const sessionUserId = session?.user?.id ?? null;
  const tokenExpiry = session?.expires_at ?? null;
  const tokenExpired = tokenExpiry !== null ? Date.now() / 1000 > tokenExpiry : null;
  const sessionCheck = {
    passedUserId: userId,
    sessionUserId,
    userIdMatch: sessionUserId === userId,
    hasSession: !!session,
    tokenExpired,
    expiresAt: tokenExpiry ? new Date(tokenExpiry * 1000).toISOString() : null,
  };
  if (__DEV__) console.log('[DB] insertExpense — auth check:', JSON.stringify(sessionCheck));

  const payload = {
    id: expense.id,
    user_id: userId,
    amount: expense.amount,
    currency: expense.currency,
    category: expense.category,
    note: expense.note ?? '',
    date: expense.date,
    mode: expense.mode ?? null,
  };
  if (__DEV__) console.log('[DB] insertExpense — payload:', JSON.stringify(payload, null, 2));

  const { data, error } = await db.from('expenses').insert(payload).select('id').single();
  if (error) {
    // NOTE: JSON.stringify(error) silently drops .message because Error.message is
    // non-enumerable. Always extract fields explicitly.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = error as any;
    const errInfo = {
      message: e.message ?? null,
      code: e.code ?? null,
      details: e.details ?? null,
      hint: e.hint ?? null,
      status: e.status ?? null,
    };
    console.error('[DB] insertExpense FAILED — error:', JSON.stringify(errInfo, null, 2));
    console.error('[DB] insertExpense FAILED — payload:', JSON.stringify(payload, null, 2));
    console.error('[DB] insertExpense FAILED — session check:', JSON.stringify(sessionCheck, null, 2));
    // Attach structured debug info so the UI layer can surface it
    e.__debugInfo = { errInfo, payload, sessionCheck };
    throw error;
  }
  if (__DEV__) console.log('[DB] insertExpense OK — id:', data?.id ?? expense.id);
}

export async function removeExpense(id: string): Promise<void> {
  if (__DEV__) console.log('[DB] removeExpense → id:', id);
  const { error } = await db.from('expenses').delete().eq('id', id);
  if (error) {
    console.error('[DB] removeExpense FAILED:', error.code, '|', error.message);
    throw error;
  }
  if (__DEV__) console.log('[DB] removeExpense OK');
}

// ── Budgets ─────────────────────────────────────────────────────────────────

function dbBudgetToLocal(row: DbBudget): Budget {
  return {
    monthly: row.monthly,
    currency: row.currency as Currency,
  };
}

export async function fetchBudget(userId: string): Promise<Budget | null> {
  const { data, error } = await db
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data ? dbBudgetToLocal(data as DbBudget) : null;
}

export async function upsertBudget(userId: string, budget: Budget): Promise<void> {
  const { error } = await db.from('budgets').upsert(
    {
      user_id: userId,
      monthly: budget.monthly,
      currency: budget.currency,
    },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
}

