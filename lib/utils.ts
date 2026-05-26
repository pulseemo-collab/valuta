import type { Currency, Expense, FinancialGoal } from '@/types';
import { getCurrencyInfo, convertToALL } from '@/constants/currencies';

export function formatCurrency(amount: number, currency: Currency): string {
  const info = getCurrencyInfo(currency);
  if (currency === 'ALL') {
    return `${Math.round(amount).toLocaleString('sq-AL')} ${info.symbol}`;
  }
  return `${info.symbol}${amount.toFixed(2)}`;
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('sq-AL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateShort(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('sq-AL', { day: 'numeric', month: 'short' });
}

export function formatTime(isoString: string): string {
  // Date-only strings ("YYYY-MM-DD") have no meaningful time component — skip display.
  // Full ISO strings include a 'T' and carry actual time info.
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoString)) return '—';
  const date = new Date(isoString);
  return date.toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit' });
}

export function isToday(isoString: string): boolean {
  const date = new Date(isoString);
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

export function isThisWeek(isoString: string): boolean {
  const date = new Date(isoString);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  return date >= startOfWeek;
}

export function isThisMonth(isoString: string): boolean {
  const date = new Date(isoString);
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

export function getTotalALL(expenses: Expense[]): number {
  return expenses.reduce((sum, e) => sum + (e.convertedALL ?? convertToALL(e.amount, e.currency)), 0);
}

export function getTodayTotal(expenses: Expense[]): number {
  return getTotalALL(expenses.filter((e) => isToday(e.date)));
}

export function getWeekTotal(expenses: Expense[]): number {
  return getTotalALL(expenses.filter((e) => isThisWeek(e.date)));
}

export function getMonthTotal(expenses: Expense[]): number {
  return getTotalALL(expenses.filter((e) => isThisMonth(e.date)));
}

export function groupByDate(expenses: Expense[]): Record<string, Expense[]> {
  const groups: Record<string, Expense[]> = {};
  const sorted = [...expenses].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  for (const expense of sorted) {
    const date = new Date(expense.date);
    const key = date.toDateString();
    if (!groups[key]) groups[key] = [];
    groups[key].push(expense);
  }
  return groups;
}

export function getCategoryTotals(
  expenses: Expense[]
): { category: string; total: number; percent: number }[] {
  const totals: Record<string, number> = {};
  for (const e of expenses) {
    const total = e.convertedALL ?? convertToALL(e.amount, e.currency);
    totals[e.category] = (totals[e.category] ?? 0) + total;
  }
  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
  return Object.entries(totals)
    .map(([category, total]) => ({
      category,
      total,
      percent: grandTotal > 0 ? (total / grandTotal) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export function getWeeklyData(
  expenses: Expense[]
): { label: string; value: number }[] {
  const days = ['Die', 'Hën', 'Mar', 'Mër', 'Enj', 'Pre', 'Sht'];
  const result = days.map((label, idx) => {
    const date = new Date();
    date.setDate(date.getDate() - (date.getDay() - idx));
    const dayExpenses = expenses.filter((e) => {
      const d = new Date(e.date);
      return d.toDateString() === date.toDateString();
    });
    return { label, value: getTotalALL(dayExpenses) };
  });
  return result;
}

export function getMonthlyData(
  expenses: Expense[]
): { label: string; value: number }[] {
  const months = ['Jan', 'Shk', 'Mar', 'Pri', 'Maj', 'Qer', 'Kor', 'Gus', 'Sht', 'Tet', 'Nën', 'Dhj'];
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const month = (now.getMonth() - 5 + i + 12) % 12;
    const year = now.getFullYear() - (now.getMonth() - 5 + i < 0 ? 1 : 0);
    const monthExpenses = expenses.filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });
    return { label: months[month], value: getTotalALL(monthExpenses) };
  });
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function computeNextPaymentDate(
  startDate: string,
  frequency: import('@/types').RecurringFrequency
): string {
  const start = new Date(startDate.slice(0, 10));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let next = new Date(start);
  const bump = () => {
    if (frequency === 'weekly') next.setDate(next.getDate() + 7);
    else if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
    else next.setFullYear(next.getFullYear() + 1);
  };

  while (next <= today) bump();

  return [
    next.getFullYear(),
    String(next.getMonth() + 1).padStart(2, '0'),
    String(next.getDate()).padStart(2, '0'),
  ].join('-');
}

export function getSubscriptionMonthlyTotal(
  subscriptions: import('@/types').Subscription[]
): number {
  return subscriptions
    .filter((s) => s.isActive)
    .reduce((sum, s) => {
      const rate = s.currency === 'EUR' ? 108 : s.currency === 'USD' ? 100 : 1;
      const inAll = s.amount * rate;
      if (s.frequency === 'weekly') return sum + inAll * 4.33;
      if (s.frequency === 'yearly') return sum + inAll / 12;
      return sum + inAll;
    }, 0);
}

export function computeGoalProgress(goal: FinancialGoal): {
  pct: number;
  remainingALL: number;
  targetALL: number;
  savedALL: number;
  isComplete: boolean;
} {
  const rate = goal.currency === 'EUR' ? 108 : goal.currency === 'USD' ? 100 : 1;
  const targetALL = goal.targetAmount * rate;
  const savedALL = goal.savedAmount * rate;
  const pct = targetALL > 0 ? Math.min((savedALL / targetALL) * 100, 100) : 0;
  return {
    pct,
    remainingALL: Math.max(targetALL - savedALL, 0),
    targetALL,
    savedALL,
    isComplete: savedALL >= targetALL,
  };
}

export function estimateGoalMonths(
  goal: FinancialGoal,
  monthlySavingsRate: number
): number | null {
  if (monthlySavingsRate <= 0) return null;
  const { remainingALL } = computeGoalProgress(goal);
  if (remainingALL <= 0) return 0;
  return Math.ceil(remainingALL / monthlySavingsRate);
}

export function getGoalInsights(
  goals: FinancialGoal[],
  monthlySavingsRate: number
): InsightMessage[] {
  const activeGoals = goals.filter((g) => !g.completedAt);
  if (activeGoals.length === 0) return [];

  const insights: InsightMessage[] = [];

  if (activeGoals.length > 0) {
    insights.push({
      icon: 'flag-outline',
      text: `Ke ${activeGoals.length} qëllim${activeGoals.length !== 1 ? 'e' : ''} financiar${activeGoals.length !== 1 ? 'e' : ''} aktiv${activeGoals.length !== 1 ? 'e' : ''}`,
      type: 'info',
    });
  }

  const sorted = [...activeGoals].sort(
    (a, b) => b.savedAmount / b.targetAmount - a.savedAmount / a.targetAmount
  );
  const top = sorted[0];
  const topPct = Math.min((top.savedAmount / top.targetAmount) * 100, 100);
  if (topPct > 0) {
    insights.push({
      icon: 'trophy-outline',
      text: `'${top.title}' është ${topPct.toFixed(0)}% arritur`,
      type: 'positive',
    });
  } else if (monthlySavingsRate > 0) {
    const months = estimateGoalMonths(top, monthlySavingsRate);
    if (months !== null && months > 0) {
      insights.push({
        icon: 'trophy-outline',
        text: `'${top.title}': ~${months} muaj deri në arritje`,
        type: 'neutral',
      });
    }
  }

  return insights.slice(0, 2);
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Mirëmëngjes';
  if (hour < 17) return 'Mirëdita';
  return 'Mirëmbrëma';
}

// ── Analytics & Insights ────────────────────────────────────────────────────

export interface InsightMessage {
  icon: string;
  text: string;
  type: 'warning' | 'positive' | 'neutral' | 'info';
}

export function getLastMonthExpenses(expenses: Expense[]): Expense[] {
  const now = new Date();
  const lm = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const ly = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  return expenses.filter((e) => {
    const d = new Date(e.date);
    return d.getMonth() === lm && d.getFullYear() === ly;
  });
}

export function getLastWeekExpenses(expenses: Expense[]): Expense[] {
  const now = new Date();
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() - now.getDay());
  startOfThisWeek.setHours(0, 0, 0, 0);
  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
  return expenses.filter((e) => {
    const d = new Date(e.date);
    return d >= startOfLastWeek && d < startOfThisWeek;
  });
}

export function getMonthComparison(expenses: Expense[]): {
  thisMonth: number;
  lastMonth: number;
  pctChange: number;
  direction: 'up' | 'down' | 'same';
} {
  const thisMonth = getTotalALL(expenses.filter((e) => isThisMonth(e.date)));
  const lastMonth = getTotalALL(getLastMonthExpenses(expenses));
  const pctChange = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;
  return {
    thisMonth,
    lastMonth,
    pctChange,
    direction: pctChange > 1 ? 'up' : pctChange < -1 ? 'down' : 'same',
  };
}

export function getWeekComparison(expenses: Expense[]): {
  thisWeek: number;
  lastWeek: number;
  pctChange: number;
  direction: 'up' | 'down' | 'same';
} {
  const thisWeek = getTotalALL(expenses.filter((e) => isThisWeek(e.date)));
  const lastWeek = getTotalALL(getLastWeekExpenses(expenses));
  const pctChange = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : 0;
  return {
    thisWeek,
    lastWeek,
    pctChange,
    direction: pctChange > 1 ? 'up' : pctChange < -1 ? 'down' : 'same',
  };
}

export function getTopCategoryThisMonth(expenses: Expense[]): {
  category: string;
  total: number;
  percent: number;
} | null {
  const monthExpenses = expenses.filter((e) => isThisMonth(e.date));
  const totals = getCategoryTotals(monthExpenses);
  return totals.length > 0 ? totals[0] : null;
}

const CATEGORY_NAMES_AL: Record<string, string> = {
  ushqim: 'Ushqim', transport: 'Transport', faturat: 'Faturat', shopping: 'Shopping',
  shendet: 'Shëndet', argetime: 'Argëtim', biznes: 'Biznes', tjera: 'Të tjera',
};

export function getInsights(
  expenses: Expense[],
  budget: { monthly: number }
): InsightMessage[] {
  if (expenses.length === 0) return [];

  const insights: InsightMessage[] = [];
  const now = new Date();
  const daysElapsed = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const thisMonthExpenses = expenses.filter((e) => isThisMonth(e.date));
  const thisMonthTotal = getTotalALL(thisMonthExpenses);
  const lastMonthTotal = getTotalALL(getLastMonthExpenses(expenses));
  const thisWeekTotal = getTotalALL(expenses.filter((e) => isThisWeek(e.date)));
  const lastWeekTotal = getTotalALL(getLastWeekExpenses(expenses));
  const todayTotal = getTodayTotal(expenses);
  const thisMonthCount = thisMonthExpenses.length;
  const topCat = getTopCategoryThisMonth(expenses);

  // 1. Budget warnings (highest priority)
  if (budget.monthly > 0 && thisMonthTotal > 0) {
    const pct = (thisMonthTotal / budget.monthly) * 100;
    if (pct > 100) {
      insights.push({
        icon: 'alert-circle-outline',
        text: `Ke tejkaluar buxhetin me ${formatCurrency(Math.round(thisMonthTotal - budget.monthly), 'ALL')}.`,
        type: 'warning',
      });
    } else if (pct >= 80) {
      insights.push({
        icon: 'warning-outline',
        text: `Je te ${pct.toFixed(0)}% e buxhetit — vetëm ${formatCurrency(Math.round(budget.monthly - thisMonthTotal), 'ALL')} mbeten.`,
        type: 'warning',
      });
    } else if (pct < 50 && daysElapsed >= 15) {
      insights.push({
        icon: 'checkmark-circle-outline',
        text: `Mirë! Ke shpenzuar vetëm ${pct.toFixed(0)}% të buxhetit në gjysmën e muajit.`,
        type: 'positive',
      });
    }
  }

  // 2. Month-over-month change
  if (lastMonthTotal > 0 && thisMonthTotal > 0) {
    const pct = ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100;
    if (Math.abs(pct) >= 5) {
      const up = pct > 0;
      insights.push({
        icon: up ? 'trending-up-outline' : 'trending-down-outline',
        text: up
          ? `Shpenzimet u rritën me ${pct.toFixed(0)}% krahasuar me muajin e kaluar.`
          : `Shpenzimet u ulën me ${Math.abs(pct).toFixed(0)}% krahasuar me muajin e kaluar.`,
        type: up ? 'warning' : 'positive',
      });
    }
  }

  // 3. Top category this month
  if (topCat && thisMonthCount >= 3) {
    const catName = CATEGORY_NAMES_AL[topCat.category] ?? topCat.category;
    insights.push({
      icon: 'grid-outline',
      text: `${catName} është kategoria kryesore me ${topCat.percent.toFixed(0)}% të shpenzimeve të muajit.`,
      type: 'neutral',
    });
  }

  // 4. Week-over-week change
  if (lastWeekTotal > 0 && thisWeekTotal > 0) {
    const pct = ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100;
    if (Math.abs(pct) >= 10) {
      const up = pct > 0;
      insights.push({
        icon: up ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline',
        text: up
          ? `Kjo javë ke shpenzuar ${pct.toFixed(0)}% më shumë se java e kaluar.`
          : `Kjo javë ke shpenzuar ${Math.abs(pct).toFixed(0)}% më pak se java e kaluar.`,
        type: up ? 'warning' : 'positive',
      });
    }
  }

  // 5. Daily average this month
  if (daysElapsed > 0 && thisMonthTotal > 0) {
    const avgDaily = thisMonthTotal / daysElapsed;
    insights.push({
      icon: 'analytics-outline',
      text: `Mesatarja ditore është ${formatCurrency(Math.round(avgDaily), 'ALL')}/ditë këtë muaj.`,
      type: 'info',
    });
  }

  // 6. Today's spending (only when notable — >20% of month total in one day)
  if (todayTotal > 0 && thisMonthTotal > 0 && (todayTotal / thisMonthTotal) >= 0.2) {
    insights.push({
      icon: 'today-outline',
      text: `Sot ke shpenzuar ${formatCurrency(Math.round(todayTotal), 'ALL')} — ${((todayTotal / thisMonthTotal) * 100).toFixed(0)}% e totalit të muajit.`,
      type: 'info',
    });
  }

  // 7. Budget projection (after 7+ days of data)
  if (budget.monthly > 0 && daysElapsed >= 7 && thisMonthTotal > 0) {
    const avgDaily = thisMonthTotal / daysElapsed;
    const projected = avgDaily * daysInMonth;
    const projPct = (projected / budget.monthly) * 100;
    const currentPct = (thisMonthTotal / budget.monthly) * 100;
    if (projPct >= 110 && currentPct < 80) {
      insights.push({
        icon: 'calculator-outline',
        text: `Me ritmin aktual, parashikohen ${formatCurrency(Math.round(projected), 'ALL')} këtë muaj — ${projPct.toFixed(0)}% e buxhetit.`,
        type: 'warning',
      });
    }
  }

  return insights;
}
