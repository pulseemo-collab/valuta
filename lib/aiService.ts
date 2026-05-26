// AI service layer — app side.
// All calls go to a Supabase Edge Function; the OpenAI API key lives there as a secret.
// This module never holds any API key.

import { supabase } from '@/lib/supabase';
import { parseExpense, type ParsedExpense } from '@/lib/parseExpense';
import type { Currency, CategoryId } from '@/types';

// ── Public types ──────────────────────────────────────────────────────────────

export type AiParseSource = 'ai' | 'local';
export type AiParseStatus = 'idle' | 'loading' | 'success' | 'failed';

/**
 * Confidence below this threshold means the local parser couldn't reliably
 * extract key fields (primarily the amount), so AI is worth the round-trip.
 * Value of 0.5 means: trigger AI whenever amount was not detected locally.
 */
export const AI_CONFIDENCE_THRESHOLD = 0.5;

/**
 * Returns true when the local parse result has low enough confidence that
 * sending the text to the AI backend is worthwhile.
 */
export function needsAI(localResult: ParsedExpense): boolean {
  return localResult.confidence < AI_CONFIDENCE_THRESHOLD;
}

export interface AiParseResult extends ParsedExpense {
  source: AiParseSource;
  /** 0–1 confidence from the AI model. 0 = local fallback, no AI confidence. */
  aiConfidence: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FUNCTION_NAME = 'ai-parse-expense';
const TIMEOUT_MS = 9000;

const VALID_CURRENCIES: Currency[] = ['ALL', 'EUR', 'USD'];
const VALID_CATEGORIES: CategoryId[] = [
  // Personal
  'ushqim', 'transport', 'faturat', 'shopping',
  'shendet', 'argetime', 'biznes', 'tjera',
  // Business
  'furnitor', 'inventar', 'marketing_biz', 'zyre',
  'transport_biz', 'punonjes', 'taksa', 'sherbime',
];

// ── Internal helpers ──────────────────────────────────────────────────────────

function localDateStr(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('ai_timeout')), ms)
    ),
  ]);
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Parse a natural-language expense string using the AI backend.
 * Falls back silently to the local regex parser if the AI is unavailable,
 * not configured, or returns an error.
 *
 * Never throws — always returns a usable result.
 */
export async function parseExpenseWithAI(text: string): Promise<AiParseResult> {
  const localFallback = (): AiParseResult => ({
    ...parseExpense(text),
    source: 'local',
    aiConfidence: 0,
  });

  if (!text.trim()) return localFallback();

  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke(FUNCTION_NAME, { body: { text } }),
      TIMEOUT_MS
    );

    // Edge function returned an HTTP error or Supabase-level error
    if (error) {
      if (__DEV__) console.warn('[aiService] Edge function error:', error.message);
      return localFallback();
    }

    // Edge function signalled a known non-AI-result condition (e.g. not configured)
    if (data?.error) {
      if (__DEV__) console.warn('[aiService] AI not available:', data.error);
      return localFallback();
    }

    const r = data?.result as Record<string, unknown> | undefined;
    if (!r) {
      if (__DEV__) console.warn('[aiService] Empty result from edge function');
      return localFallback();
    }

    // Validate + coerce each field
    const amount =
      typeof r.amount === 'number' && r.amount > 0 && isFinite(r.amount) ? r.amount : null;

    const currency: Currency = VALID_CURRENCIES.includes(r.currency as Currency)
      ? (r.currency as Currency)
      : 'ALL';

    const category: CategoryId = VALID_CATEGORIES.includes(r.category as CategoryId)
      ? (r.category as CategoryId)
      : 'tjera';

    const note = typeof r.note === 'string' ? r.note.trim() : '';

    const date =
      typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date)
        ? r.date
        : localDateStr();

    const aiConfidence =
      typeof r.confidence === 'number' ? Math.min(1, Math.max(0, r.confidence)) : 0.7;

    return {
      amount,
      currency,
      category,
      note,
      date,
      detectedAmount: amount !== null,
      detectedCurrency: true,
      detectedCategory: true,
      detectedDate: date !== localDateStr(),
      // Local-parser-style confidence derived from what the AI actually extracted.
      confidence: (amount !== null ? 0.5 : 0) + 0.35 + 0.15,
      source: 'ai',
      aiConfidence,
    };
  } catch (err) {
    if (__DEV__) console.warn('[aiService] Parse failed, using local fallback:', err);
    return localFallback();
  }
}
