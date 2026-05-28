import type { Expense, Budget, Currency } from '@/types';
import { getTotalALL, formatInPreferred } from '@/lib/utils';
import type { NotificationPrefs } from '@/lib/notificationPrefs';

export type NotificationKind =
  | 'inactivity'
  | 'budget_overrun'
  | 'budget_danger'
  | 'budget_caution';

export type NotificationSeverity = 'critical' | 'warning' | 'info';

export interface PendingNotification {
  id: string;
  kind: NotificationKind;
  icon: string;
  title: string;
  body: string;
  severity: NotificationSeverity;
}

function daysSince(dateStr: string): number {
  const then = new Date(dateStr);
  const now = new Date();
  const thenDay = Date.UTC(then.getFullYear(), then.getMonth(), then.getDate());
  const nowDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((nowDay - thenDay) / 86_400_000);
}

export function computePendingNotifications(
  expenses: Expense[],
  budget: Budget,
  prefs: NotificationPrefs,
  preferred: Currency = 'ALL'
): PendingNotification[] {
  if (!prefs.enabled) return [];

  const result: PendingNotification[] = [];

  // ── Budget warnings ────────────────────────────────────────────────────────
  if (prefs.budgetWarnings && budget.monthly > 0 && expenses.length > 0) {
    const now = new Date();
    const daysElapsed = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const thisMonth = expenses.filter((e) => {
      const d = new Date(e.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });

    const currentSpend = getTotalALL(thisMonth);
    const pctUsed = (currentSpend / budget.monthly) * 100;

    if (currentSpend > budget.monthly) {
      result.push({
        id: 'budget_overrun',
        kind: 'budget_overrun',
        icon: 'alert-circle-outline',
        title: 'Buxheti u tejkalua!',
        body: 'Ke tejkaluar buxhetin mujor. Shpenzo me kujdes.',
        severity: 'critical',
      });
    } else if (daysElapsed >= 2) {
      const burnRate = currentSpend / daysElapsed;
      const projected = burnRate * daysInMonth;
      const projectedOverrun = projected - budget.monthly;

      if (projectedOverrun > 0 && pctUsed >= 40) {
        result.push({
          id: 'budget_danger',
          kind: 'budget_danger',
          icon: 'trending-up-outline',
          title: 'Je pranë limitit!',
          body: `Me këtë ritëm do tejkalosh buxhetin me ${formatInPreferred(Math.round(projectedOverrun), preferred)}.`,
          severity: 'warning',
        });
      } else if (pctUsed >= 80) {
        result.push({
          id: `budget_caution_${Math.floor(pctUsed)}`,
          kind: 'budget_caution',
          icon: 'warning-outline',
          title: 'Buxheti po mbaron',
          body: `Ke shpenzuar ${pctUsed.toFixed(0)}% të buxhetit mujor.`,
          severity: 'warning',
        });
      }
    }
  }

  // ── Inactivity reminder ────────────────────────────────────────────────────
  if (prefs.inactivityReminders && expenses.length > 0) {
    const sorted = [...expenses].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const lastDate = sorted[0]?.date;
    if (lastDate) {
      const days = daysSince(lastDate);
      if (days >= prefs.inactivityDays) {
        result.push({
          id: `inactivity_${days}d`,
          kind: 'inactivity',
          icon: 'time-outline',
          title: 'Mos harro të regjistrosh',
          body:
            days === 1
              ? 'Nuk ke regjistruar shpenzime sot.'
              : `Kanë kaluar ${days} ditë pa regjistruar shpenzime.`,
          severity: 'info',
        });
      }
    }
  }

  return result;
}
