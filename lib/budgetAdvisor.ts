import type { Expense, CategoryId, Budget } from '@/types';
import { getTotalALL, getCategoryTotals, formatCurrency } from '@/lib/utils';

export type RiskLevel = 'safe' | 'caution' | 'danger';

export interface BudgetSuggestion {
  amount: number;
  basis: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface CategoryRisk {
  category: CategoryId;
  currentMonthTotal: number;
  avgMonthlyTotal: number;
  pctChange: number;          // projected vs historical avg (%)
  trend: 'rising' | 'stable' | 'falling';
  riskLevel: 'high' | 'medium' | 'none';
  projectedMonthly: number;   // at current daily pace
}

export interface BudgetForecast {
  projectedMonthly: number;
  projectedOverrun: number;   // positive = over budget
  daysElapsed: number;
  daysRemaining: number;
  daysInMonth: number;
  safeDaily: number;          // max spend/day to stay under budget
  burnRate: number;           // current daily average (ALL)
  riskLevel: RiskLevel;
  pctBudgetUsed: number;
}

export interface BudgetWarning {
  icon: string;
  text: string;
  severity: 'critical' | 'warning' | 'info';
  category?: CategoryId;
}

export interface BudgetAdvisory {
  suggestion: BudgetSuggestion | null;
  forecast: BudgetForecast | null;
  categoryRisks: CategoryRisk[];
  warnings: BudgetWarning[];
}

// ── Internal helpers ──────────────────────────────────────────────────────────

const CATEGORY_NAMES_AL: Record<string, string> = {
  ushqim: 'Ushqim', transport: 'Transport', faturat: 'Faturat', shopping: 'Shopping',
  shendet: 'Shëndet', argetime: 'Argëtim', biznes: 'Biznes', tjera: 'Të tjera',
};

function getMonthExpenses(expenses: Expense[], monthsBack: number): Expense[] {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  const y = d.getFullYear();
  const m = d.getMonth();
  return expenses.filter((e) => {
    const ed = new Date(e.date);
    return ed.getFullYear() === y && ed.getMonth() === m;
  });
}

function roundToNearestK(n: number, k = 5000): number {
  return Math.round(n / k) * k;
}

// ── Main function ─────────────────────────────────────────────────────────────

export function getBudgetAdvisory(
  expenses: Expense[],
  budget: Budget
): BudgetAdvisory {
  const now = new Date();
  const daysElapsed = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = Math.max(daysInMonth - daysElapsed, 0);

  const thisMonthExps = getMonthExpenses(expenses, 0);
  const currentSpend = getTotalALL(thisMonthExps);
  const burnRate = daysElapsed > 0 ? currentSpend / daysElapsed : 0;
  const projectedMonthly = burnRate * daysInMonth;

  // ── Forecast ──────────────────────────────────────────────────────────────
  let forecast: BudgetForecast | null = null;

  if (budget.monthly > 0 && currentSpend > 0) {
    const projectedOverrun = projectedMonthly - budget.monthly;
    const safeDaily =
      daysRemaining > 0
        ? Math.max(0, (budget.monthly - currentSpend) / daysRemaining)
        : 0;
    const pctBudgetUsed = (currentSpend / budget.monthly) * 100;

    let riskLevel: RiskLevel = 'safe';
    if (currentSpend > budget.monthly || projectedOverrun > 0) {
      riskLevel = 'danger';
    } else if (pctBudgetUsed >= 75 || projectedOverrun > -budget.monthly * 0.08) {
      riskLevel = 'caution';
    }

    forecast = {
      projectedMonthly,
      projectedOverrun,
      daysElapsed,
      daysRemaining,
      daysInMonth,
      safeDaily,
      burnRate,
      riskLevel,
      pctBudgetUsed,
    };
  }

  // ── Budget suggestion ─────────────────────────────────────────────────────
  let suggestion: BudgetSuggestion | null = null;

  const historicalTotals: number[] = [];
  for (let i = 1; i <= 3; i++) {
    const mExps = getMonthExpenses(expenses, i);
    if (mExps.length >= 2) {
      historicalTotals.push(getTotalALL(mExps));
    }
  }

  if (historicalTotals.length >= 1) {
    const avg = historicalTotals.reduce((a, b) => a + b, 0) / historicalTotals.length;
    const rawSuggested = avg * 1.10;
    const suggested = roundToNearestK(rawSuggested, rawSuggested > 20000 ? 5000 : 1000);

    const tooSimilar =
      budget.monthly > 0 &&
      Math.abs(suggested - budget.monthly) / budget.monthly < 0.12;

    if (!tooSimilar && suggested > 0) {
      const n = historicalTotals.length;
      suggestion = {
        amount: suggested,
        basis:
          n >= 3
            ? `Bazuar në mesataren e 3 muajve të fundit (≈ ${formatCurrency(Math.round(avg), 'ALL')}/muaj)`
            : n === 2
            ? `Bazuar në mesataren e 2 muajve të fundit`
            : `Bazuar në muajin e kaluar`,
        confidence: n >= 3 ? 'high' : n === 2 ? 'medium' : 'low',
      };
    }
  }

  // ── Category risks ────────────────────────────────────────────────────────
  const categoryRisks: CategoryRisk[] = [];
  const thisCatTotals = getCategoryTotals(thisMonthExps);

  for (const item of thisCatTotals) {
    const catId = item.category as CategoryId;

    // Historical monthly average for this category
    const catHistory: number[] = [];
    for (let i = 1; i <= 3; i++) {
      const mExps = getMonthExpenses(expenses, i);
      const catExps = mExps.filter((e) => e.category === catId);
      if (catExps.length > 0) catHistory.push(getTotalALL(catExps));
    }
    const avgMonthlyTotal =
      catHistory.length > 0
        ? catHistory.reduce((a, b) => a + b, 0) / catHistory.length
        : 0;

    // Projected monthly for this category at current pace
    const projectedMonthly =
      daysElapsed > 0 ? (item.total / daysElapsed) * daysInMonth : item.total;

    // % change vs historical average
    const pctChange =
      avgMonthlyTotal > 0
        ? ((projectedMonthly - avgMonthlyTotal) / avgMonthlyTotal) * 100
        : 0;

    let riskLevel: 'high' | 'medium' | 'none' = 'none';
    if (avgMonthlyTotal > 0) {
      if (pctChange > 45) riskLevel = 'high';
      else if (pctChange > 22) riskLevel = 'medium';
    }

    const trend: 'rising' | 'stable' | 'falling' =
      pctChange > 15 ? 'rising' : pctChange < -15 ? 'falling' : 'stable';

    categoryRisks.push({
      category: catId,
      currentMonthTotal: item.total,
      avgMonthlyTotal,
      pctChange,
      trend,
      riskLevel,
      projectedMonthly,
    });
  }

  // Sort: high risk first, then by amount
  categoryRisks.sort((a, b) => {
    const rs = { high: 2, medium: 1, none: 0 };
    const d = rs[b.riskLevel] - rs[a.riskLevel];
    return d !== 0 ? d : b.currentMonthTotal - a.currentMonthTotal;
  });

  // ── Warnings ──────────────────────────────────────────────────────────────
  const warnings: BudgetWarning[] = [];

  if (forecast) {
    // 1. Projection overrun
    if (forecast.projectedOverrun > 0 && forecast.pctBudgetUsed < 100) {
      warnings.push({
        icon: 'trending-up-outline',
        text: `Me këtë ritëm do tejkalosh buxhetin me ${formatCurrency(Math.round(forecast.projectedOverrun), 'ALL')}.`,
        severity: 'critical',
      });
    }

    // 2. Early burn (≤ 15 days in, already past 65%)
    if (daysElapsed <= 15 && forecast.pctBudgetUsed > 65) {
      warnings.push({
        icon: 'flash-outline',
        text: `Ke shpenzuar ${forecast.pctBudgetUsed.toFixed(0)}% të buxhetit brenda ${daysElapsed} ditëve të para!`,
        severity: 'critical',
      });
    }

    // 3. Safe daily guide (only when relevant)
    if (forecast.safeDaily > 0 && daysRemaining >= 3 && forecast.riskLevel !== 'safe') {
      warnings.push({
        icon: 'shield-checkmark-outline',
        text: `Shpenzo maks ${formatCurrency(Math.round(forecast.safeDaily), 'ALL')}/ditë për të mbetur brenda buxhetit.`,
        severity: 'info',
      });
    }
  }

  // 4. Category-level spike warnings
  for (const risk of categoryRisks) {
    if (risk.riskLevel === 'none') continue;
    const catName = CATEGORY_NAMES_AL[risk.category] ?? risk.category;
    if (risk.riskLevel === 'high') {
      warnings.push({
        icon: 'alert-circle-outline',
        text: `Shpenzimet për ${catName} janë rritur me ${Math.round(risk.pctChange)}% krahasuar me historikun.`,
        severity: 'warning',
        category: risk.category,
      });
    } else if (risk.riskLevel === 'medium') {
      warnings.push({
        icon: 'arrow-up-circle-outline',
        text: `${catName}: ritëm mbi normën (+${Math.round(risk.pctChange)}% krahasuar me mesataren).`,
        severity: 'info',
        category: risk.category,
      });
    }
  }

  return { suggestion, forecast, categoryRisks, warnings };
}

// ── Insight message adapter (for Dashboard / Raporte) ─────────────────────────
// Returns InsightMessage-shaped objects so existing UI code can render them.

export function getBudgetInsights(
  advisory: BudgetAdvisory
): { icon: string; text: string; type: 'warning' | 'positive' | 'neutral' | 'info' }[] {
  const out: { icon: string; text: string; type: 'warning' | 'positive' | 'neutral' | 'info' }[] = [];

  for (const w of advisory.warnings.slice(0, 2)) {
    out.push({
      icon: w.icon,
      text: w.text,
      type: w.severity === 'critical' || w.severity === 'warning' ? 'warning' : 'info',
    });
  }

  // Positive signal: well within budget and projection comfortable
  if (advisory.forecast) {
    const f = advisory.forecast;
    if (f.riskLevel === 'safe' && f.pctBudgetUsed < 50 && f.daysElapsed >= 10) {
      out.push({
        icon: 'shield-checkmark-outline',
        text: `Buxheti nën kontroll — ${f.pctBudgetUsed.toFixed(0)}% shpenzuar, parashikohet ${formatCurrency(Math.round(f.projectedMonthly), 'ALL')}.`,
        type: 'positive',
      });
    }
  }

  return out.slice(0, 2);
}
