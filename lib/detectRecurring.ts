import type { Expense, Currency, CategoryId } from '@/types';
import type { InsightMessage } from '@/lib/utils';
import { formatInPreferred } from '@/lib/utils';
import { convertToALL } from '@/constants/currencies';

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'irregular';
export type RecurringConfidence = 'high' | 'medium' | 'low';

export interface RecurringPattern {
  key: string;
  name: string;
  category: CategoryId;
  frequency: RecurringFrequency;
  avgAmount: number;
  currency: Currency;
  occurrences: number;
  lastDate: string;            // YYYY-MM-DD
  nextExpected: string | null; // YYYY-MM-DD
  isSubscription: boolean;
  confidence: RecurringConfidence;
}

// ── Known subscription service identifiers ────────────────────────────────────
const SUBSCRIPTION_KEYWORDS = [
  'netflix', 'spotify', 'youtube', 'prime', 'amazon', 'hbo', 'disney',
  'apple', 'icloud', 'google', 'microsoft', 'adobe', 'dropbox',
  'claude', 'chatgpt', 'openai', 'canva', 'figma', 'notion',
  'gym', 'palestër', 'palestere',
  'abonim', 'abonament',
];

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  daily: 'Çdo ditë',
  weekly: 'Çdo javë',
  monthly: 'Çdo muaj',
  irregular: 'Shpesh',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeNote(note: string): string {
  return note
    .toLowerCase()
    .replace(/[^a-zëçàáâãäåèéêëîïôõöùúûüñß\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length > 1) // drop single-char fragments
    .slice(0, 2)
    .join(' ');
}

// Returns a grouping key or empty string (skip expense) if note is too vague.
export function getExpenseKey(e: Expense): string {
  const normalized = normalizeNote(e.note);
  if (normalized.length < 2) return '';
  return `${e.category}::${normalized}`;
}

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function classifyFrequency(medGap: number): RecurringFrequency {
  if (medGap <= 3) return 'daily';
  if (medGap >= 5 && medGap <= 10) return 'weekly';
  if (medGap >= 24 && medGap <= 37) return 'monthly';
  return 'irregular';
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate.slice(0, 10));
  d.setDate(d.getDate() + days);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

// ── Core detector ─────────────────────────────────────────────────────────────

export function detectRecurring(expenses: Expense[]): RecurringPattern[] {
  if (expenses.length < 2) return [];

  // Group by category + normalized-note key
  const groups = new Map<string, Expense[]>();
  for (const e of expenses) {
    const key = getExpenseKey(e);
    if (!key) continue;
    const g = groups.get(key) ?? [];
    g.push(e);
    groups.set(key, g);
  }

  const patterns: RecurringPattern[] = [];

  for (const [key, exps] of groups) {
    if (exps.length < 2) continue;

    // Sort chronologically
    const sorted = [...exps].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Gaps between consecutive occurrences (in days)
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const ms =
        new Date(sorted[i].date).getTime() - new Date(sorted[i - 1].date).getTime();
      gaps.push(Math.max(1, Math.round(ms / 86_400_000)));
    }

    const medGap = median(gaps);
    const frequency = classifyFrequency(medGap);

    // Two occurrences with irregular spacing is too weak — skip
    if (frequency === 'irregular' && exps.length < 3) continue;

    // Amount analysis — focus on dominant currency (most recent)
    const dominantCurrency = sorted[sorted.length - 1].currency;
    const sameCurrAmounts = sorted
      .filter((e) => e.currency === dominantCurrency)
      .map((e) => e.amount);
    const medAmount = median(sameCurrAmounts);

    // Amount consistency: each value within ±30% of median
    const consistent =
      medAmount > 0 &&
      sameCurrAmounts.every((a) => Math.abs(a - medAmount) / medAmount <= 0.3);

    // Best display name — most frequent non-empty note value
    const noteCount = new Map<string, number>();
    for (const e of sorted) {
      if (e.note) noteCount.set(e.note, (noteCount.get(e.note) ?? 0) + 1);
    }
    const name =
      [...noteCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
      key.split('::')[1];

    // Subscription detection: keyword match OR inferred (monthly + consistent amount + bill/entertainment category)
    const nameLow = name.toLowerCase();
    const keywordMatch = SUBSCRIPTION_KEYWORDS.some((kw) => nameLow.includes(kw));
    const inferredSub =
      !keywordMatch &&
      frequency === 'monthly' &&
      consistent &&
      (exps[0].category === 'faturat' || exps[0].category === 'argetime');
    const isSubscription = keywordMatch || inferredSub;

    // Confidence tier
    let confidence: RecurringConfidence;
    if (exps.length >= 3 && frequency !== 'irregular' && consistent) {
      confidence = 'high';
    } else if (
      exps.length >= 3 ||
      (exps.length === 2 && consistent && frequency !== 'irregular')
    ) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    const lastDate = sorted[sorted.length - 1].date.slice(0, 10);
    const nextExpected =
      frequency !== 'irregular' ? addDays(lastDate, Math.round(medGap)) : null;

    patterns.push({
      key,
      name,
      category: exps[0].category,
      frequency,
      avgAmount: medAmount,
      currency: dominantCurrency,
      occurrences: exps.length,
      lastDate,
      nextExpected,
      isSubscription,
      confidence,
    });
  }

  // Sort: confidence desc → frequency priority → occurrences desc
  const confScore: Record<RecurringConfidence, number> = { high: 3, medium: 2, low: 1 };
  const freqScore: Record<RecurringFrequency, number> = {
    monthly: 4, weekly: 3, daily: 2, irregular: 1,
  };
  return patterns.sort((a, b) => {
    const cd = confScore[b.confidence] - confScore[a.confidence];
    if (cd !== 0) return cd;
    const fd = freqScore[b.frequency] - freqScore[a.frequency];
    if (fd !== 0) return fd;
    return b.occurrences - a.occurrences;
  });
}

// ── Utility exports ───────────────────────────────────────────────────────────

export function getFrequencyLabel(f: RecurringFrequency, lang = 'sq'): string {
  if (lang === 'en') {
    const EN: Record<RecurringFrequency, string> = {
      daily: 'Every day', weekly: 'Every week', monthly: 'Every month', irregular: 'Often',
    };
    return EN[f];
  }
  return FREQUENCY_LABELS[f];
}

export function getNextLabel(nextExpected: string | null, lang = 'sq'): string {
  if (!nextExpected) return '';
  const diffDays = Math.round(
    (new Date(nextExpected).getTime() - Date.now()) / 86_400_000
  );
  if (lang === 'en') {
    if (diffDays < -1) return 'Overdue';
    if (diffDays < 0) return 'Yesterday';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays <= 6) return `In ${diffDays} days`;
    if (diffDays <= 30) return `In ${Math.ceil(diffDays / 7)} weeks`;
    return nextExpected;
  }
  if (diffDays < -1) return 'E vonuar';
  if (diffDays < 0) return 'Dje';
  if (diffDays === 0) return 'Sot';
  if (diffDays === 1) return 'Nesër';
  if (diffDays <= 6) return `Pas ${diffDays} ditësh`;
  if (diffDays <= 30) return `Pas ${Math.ceil(diffDays / 7)} javësh`;
  return nextExpected;
}

// ── Insight generation ────────────────────────────────────────────────────────

export function getRecurringInsights(
  patterns: RecurringPattern[],
  preferred: Currency = 'ALL',
  lang = 'sq'
): InsightMessage[] {
  if (patterns.length === 0) return [];

  const en = lang === 'en';
  const insights: InsightMessage[] = [];

  // 1. Monthly subscriptions summary
  const subs = patterns.filter(
    (p) => p.isSubscription && p.frequency === 'monthly' && p.confidence !== 'low'
  );
  if (subs.length >= 2) {
    // Approximate total in ALL using fixed rates
    const total = subs.reduce((sum, p) => {
      const rate = p.currency === 'EUR' ? 108 : p.currency === 'USD' ? 100 : 1;
      return sum + p.avgAmount * rate;
    }, 0);
    insights.push({
      icon: 'repeat-outline',
      text: en
        ? `${subs.length} active monthly subscriptions — ≈ ${formatInPreferred(Math.round(total), preferred)}/month.`
        : `${subs.length} abonime mujore aktive — ≈ ${formatInPreferred(Math.round(total), preferred)}/muaj.`,
      type: 'info',
    });
  } else if (subs.length === 1) {
    const s = subs[0];
    insights.push({
      icon: 'repeat-outline',
      text: en
        ? `${s.name} — monthly subscription ≈ ${formatInPreferred(convertToALL(s.avgAmount, s.currency), preferred)}.`
        : `${s.name} — abonim mujor ≈ ${formatInPreferred(convertToALL(s.avgAmount, s.currency), preferred)}.`,
      type: 'info',
    });
  }

  // 2. High-frequency habit (daily/weekly with ≥4 occurrences)
  const habit = patterns.find(
    (p) =>
      (p.frequency === 'daily' || p.frequency === 'weekly') &&
      p.occurrences >= 4 &&
      p.confidence !== 'low'
  );
  if (habit) {
    const label = en
      ? (habit.frequency === 'daily' ? 'every day' : 'every week')
      : (habit.frequency === 'daily' ? 'çdo ditë' : 'çdo javë');
    const timesLabel = en ? 'times' : 'herë';
    const eachLabel = en ? 'each' : 'herë';
    insights.push({
      icon: 'time-outline',
      text: `"${habit.name}" — ${habit.occurrences} ${timesLabel}, ${label}. ≈ ${formatInPreferred(convertToALL(habit.avgAmount, habit.currency), preferred)}/${eachLabel}.`,
      type: 'neutral',
    });
  }

  // 3. If no subs were found but there are monthly patterns — mention the top one
  if (subs.length === 0 && !habit) {
    const top = patterns.find((p) => p.frequency === 'monthly' && p.confidence !== 'low');
    if (top) {
      insights.push({
        icon: 'calendar-outline',
        text: en
          ? `"${top.name}" appears monthly — ${top.occurrences} times recorded.`
          : `"${top.name}" del çdo muaj — ${top.occurrences} herë të regjistruara.`,
        type: 'neutral',
      });
    }
  }

  return insights.slice(0, 2);
}
