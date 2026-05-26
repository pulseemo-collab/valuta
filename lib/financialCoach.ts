// AI Financial Coach — rule-based engine (local-first, AI-ready).
// No API keys here. Future AI calls go to a Supabase Edge Function via aiService.ts.

import type { Expense, Budget } from '@/types';
import {
  getCategoryTotals,
  getTotalALL,
  isThisMonth,
  getMonthComparison,
} from '@/lib/utils';
import type { BudgetAdvisory } from '@/lib/budgetAdvisor';
import type { RecurringPattern } from '@/lib/detectRecurring';

export type AdviceType =
  | 'saving_tip'
  | 'warning'
  | 'trend'
  | 'recurring_payment'
  | 'budget_suggestion';

export interface AdviceCard {
  id: string;
  type: AdviceType;
  icon: string;
  text: string;
  /** Higher = shown first. */
  priority: number;
  /** 'local' always for now. Future: 'ai' when returned from the backend. */
  source: 'local' | 'ai';
}

// ── Internal helpers ──────────────────────────────────────────────────────────

const CAT_NAMES: Record<string, string> = {
  ushqim: 'Ushqim',
  transport: 'Transport',
  faturat: 'Faturat',
  shopping: 'Shopping',
  shendet: 'Shëndet',
  argetime: 'Argëtim',
  biznes: 'Biznes',
  tjera: 'Të tjera',
};

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate financial advice cards from local expense data.
 *
 * Signature is intentionally AI-ready: all context is explicit so an async
 * wrapper can later call the backend and merge/replace cards without changing
 * the call sites.
 */
export function generateAdviceCards(
  expenses: Expense[],
  budget: Budget,
  recurringPatterns: RecurringPattern[],
  _budgetAdvisory: BudgetAdvisory,
): AdviceCard[] {
  if (expenses.length === 0) return [];

  const cards: AdviceCard[] = [];

  const thisMonthExp = expenses.filter((e) => isThisMonth(e.date));
  const thisMonthTotal = getTotalALL(thisMonthExp);
  const catTotals = getCategoryTotals(thisMonthExp);
  const monthComp = getMonthComparison(expenses);

  const now = new Date();
  const daysElapsed = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  // ── 1. Budget status ──────────────────────────────────────────────────────

  if (budget.monthly > 0 && thisMonthTotal > 0) {
    const pct = (thisMonthTotal / budget.monthly) * 100;

    if (pct >= 100) {
      cards.push({
        id: 'budget_exceeded',
        type: 'warning',
        icon: 'alert-circle-outline',
        text: 'Ke tejkaluar buxhetin mujor. Shqyrto shpenzimet tua.',
        priority: 100,
        source: 'local',
      });
    } else if (pct >= 80) {
      cards.push({
        id: 'budget_near',
        type: 'warning',
        icon: 'warning-outline',
        text: `Je pranë limitit të buxhetit mujor — ${pct.toFixed(0)}% shpenzuar.`,
        priority: 90,
        source: 'local',
      });
    } else if (pct >= 60 && daysElapsed < daysInMonth / 2) {
      cards.push({
        id: 'budget_pace',
        type: 'warning',
        icon: 'trending-up-outline',
        text: 'Ritmi aktual i shpenzimeve mund të tejkalojë buxhetin këtë muaj.',
        priority: 80,
        source: 'local',
      });
    } else if (pct < 50 && daysElapsed >= 15) {
      cards.push({
        id: 'budget_healthy',
        type: 'saving_tip',
        icon: 'shield-checkmark-outline',
        text: `Buxheti nën kontroll — ke shpenzuar vetëm ${pct.toFixed(0)}% deri tani. Vazhdo kështu!`,
        priority: 40,
        source: 'local',
      });
    }
  }

  // ── 2. Month-over-month trend ─────────────────────────────────────────────

  if (monthComp.lastMonth > 0 && thisMonthTotal > 0) {
    if (monthComp.direction === 'up' && monthComp.pctChange >= 15) {
      cards.push({
        id: 'spending_up',
        type: 'trend',
        icon: 'trending-up-outline',
        text: `Shpenzimet janë rritur me ${monthComp.pctChange.toFixed(0)}% krahasuar me muajin e kaluar.`,
        priority: 75,
        source: 'local',
      });
    } else if (monthComp.direction === 'down' && Math.abs(monthComp.pctChange) >= 10) {
      cards.push({
        id: 'spending_down',
        type: 'saving_tip',
        icon: 'trending-down-outline',
        text: `Ke ulur shpenzimet me ${Math.abs(monthComp.pctChange).toFixed(0)}% krahasuar me muajin e kaluar. Vazhdoje kështu!`,
        priority: 60,
        source: 'local',
      });
    }
  }

  // ── 3. Top spending category this month ───────────────────────────────────

  if (catTotals.length > 0 && thisMonthExp.length >= 2) {
    const top = catTotals[0];
    const catName = CAT_NAMES[top.category] ?? top.category;
    cards.push({
      id: 'top_category',
      type: 'trend',
      icon: 'grid-outline',
      text: `Shpenzimet për ${catName} janë më të lartat këtë muaj.`,
      priority: 70,
      source: 'local',
    });
  }

  // ── 4. Recurring payments ─────────────────────────────────────────────────

  const reliableRecurring = recurringPatterns.filter((p) => p.confidence !== 'low');
  if (reliableRecurring.length >= 2) {
    cards.push({
      id: 'recurring_multiple',
      type: 'recurring_payment',
      icon: 'repeat-outline',
      text: `Ke ${reliableRecurring.length} pagesa që duken periodike — kontrolloji ato.`,
      priority: 65,
      source: 'local',
    });
  } else if (reliableRecurring.length === 1) {
    const r = reliableRecurring[0];
    cards.push({
      id: 'recurring_single',
      type: 'recurring_payment',
      icon: 'repeat-outline',
      text: `"${r.name}" duket si pagesë periodike.`,
      priority: 55,
      source: 'local',
    });
  }

  // ── 5. Limit suggestion for top category ──────────────────────────────────

  if (catTotals.length > 0 && thisMonthExp.length >= 3) {
    const top = catTotals[0];
    const catName = CAT_NAMES[top.category] ?? top.category;
    cards.push({
      id: 'limit_suggestion',
      type: 'budget_suggestion',
      icon: 'options-outline',
      text: `Mund të ulësh shpenzimet duke vendosur limit për kategorinë ${catName}.`,
      priority: 50,
      source: 'local',
    });
  }

  return cards
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 4);
}
