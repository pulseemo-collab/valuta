// Receipt OCR service.
// On web: uses Tesseract.js (client-side) via webOcr.web.ts.
// On native: calls the Supabase Edge Function 'scan-receipt'.
// Never holds any API keys.

import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { parseExpense, type ParsedExpense } from '@/lib/parseExpense';
import { parseReceiptText } from '@/lib/receiptParser';
import { runWebOcr, type OcrProgressEvent } from '@/lib/webOcr';
import type { Currency, CategoryId } from '@/types';

// ── Public types ──────────────────────────────────────────────────────────────

export type ScanSource = 'camera' | 'gallery';
export type ScanStatus = 'idle' | 'picking' | 'scanning' | 'done' | 'error';
export type { OcrProgressEvent };

export interface ReceiptScanResult {
  rawText: string;
  parsed: ParsedExpense;
  merchantName: string;
  items: string[];
  summary: string;
  uncertainAmount: boolean;
  itemsConfidence: boolean;
  /** 0–1 overall OCR confidence. */
  overallConfidence: number;
  source: 'ai' | 'fallback';
  errorMessage?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EDGE_FN = 'scan-receipt';
const TIMEOUT_MS = 15_000;

const VALID_CURRENCIES: readonly Currency[] = ['ALL', 'EUR', 'USD'];
const VALID_CATEGORIES: readonly CategoryId[] = [
  'ushqim', 'transport', 'faturat', 'shopping',
  'shendet', 'argetime', 'biznes', 'tjera',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

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
      setTimeout(() => reject(new Error('scan_timeout')), ms)
    ),
  ]);
}

function blankParsed(): ParsedExpense {
  return {
    amount: null, currency: 'ALL', category: 'tjera', note: '',
    date: localDateStr(), detectedAmount: false, detectedCurrency: false,
    detectedCategory: false, detectedDate: false, confidence: 0,
  };
}

function fallback(rawText = '', msg?: string): ReceiptScanResult {
  return {
    rawText,
    parsed: blankParsed(),
    merchantName: '',
    items: [],
    summary: '',
    uncertainAmount: false,
    itemsConfidence: false,
    overallConfidence: 0,
    source: 'fallback',
    errorMessage: msg,
  };
}

// ── Image picking ─────────────────────────────────────────────────────────────

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  quality: 0.85,
  base64: true,
  allowsEditing: false,
};

export async function requestScanPermission(source: ScanSource): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  if (source === 'camera') {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  }
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

export async function pickImage(source: ScanSource): Promise<string | null> {
  const granted = await requestScanPermission(source);
  if (!granted) return null;

  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync(PICKER_OPTIONS)
    : await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);

  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;

  // Web: expo-image-picker returns a data-URL in uri; extract the payload.
  if (Platform.OS === 'web' && typeof asset.uri === 'string' && asset.uri.startsWith('data:')) {
    return asset.uri.split(',')[1] ?? null;
  }

  return asset.base64 ?? null;
}

// ── OCR ───────────────────────────────────────────────────────────────────────

/**
 * Scan a receipt image.
 *
 * - On web: runs Tesseract.js locally (no server needed).
 * - On native: calls the Supabase 'scan-receipt' Edge Function.
 *
 * The optional `onProgress` callback receives incremental progress (0-100).
 * Never throws — always returns a usable result.
 */
export async function scanReceipt(
  base64Image: string,
  onProgress?: (e: OcrProgressEvent) => void
): Promise<ReceiptScanResult> {
  if (!base64Image) return fallback('', 'Imazhi nuk u ngarkua.');

  // ── Web: use Tesseract.js client-side OCR ──────────────────────────────────
  if (Platform.OS === 'web') {
    return scanReceiptWeb(base64Image, onProgress);
  }

  // ── Native: call Supabase Edge Function ───────────────────────────────────
  return scanReceiptEdge(base64Image);
}

// ── Web OCR path ──────────────────────────────────────────────────────────────

async function scanReceiptWeb(
  base64Image: string,
  onProgress?: (e: OcrProgressEvent) => void
): Promise<ReceiptScanResult> {
  try {
    const { text, confidence } = await runWebOcr(base64Image, onProgress);

    const rawText = text.trim();

    if (!rawText) {
      return fallback('', 'Nuk u gjet tekst në imazh.');
    }

    const { parsed, merchantName, items, summary, uncertainAmount, itemsConfidence } = parseReceiptText(rawText);
    const overallConfidence = Math.min(1, confidence / 100);

    if (__DEV__) console.log('[receiptScanner] Web OCR raw text:', rawText);

    return {
      rawText,
      parsed,
      merchantName,
      items,
      summary,
      uncertainAmount,
      itemsConfidence,
      overallConfidence,
      source: 'ai',
    };
  } catch (err: any) {
    if (__DEV__) console.warn('[receiptScanner] Web OCR failed:', err?.message);
    return fallback('', 'Gabim gjatë skanimit.');
  }
}

// ── Native / Edge Function path ────────────────────────────────────────────────

async function scanReceiptEdge(base64Image: string): Promise<ReceiptScanResult> {
  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke(EDGE_FN, { body: { image: base64Image } }),
      TIMEOUT_MS
    );

    if (error) {
      if (__DEV__) console.warn('[receiptScanner] Edge error:', error.message);
      return fallback();
    }
    if (data?.error) {
      if (__DEV__) console.warn('[receiptScanner] Scan unavailable:', data.error);
      return fallback();
    }

    const rawText: string = typeof data?.text === 'string' ? data.text.trim() : '';
    const merchantName: string = typeof data?.merchant === 'string' ? data.merchant.trim() : '';
    const aiConf: number =
      typeof data?.confidence === 'number' ? Math.min(1, Math.max(0, data.confidence)) : 0;

    // Run local receipt parser for items/summary extraction even when AI provides structured data.
    const localResult = rawText ? parseReceiptText(rawText) : null;
    const items = localResult?.items ?? [];
    const itemsConfidence = localResult?.itemsConfidence ?? false;
    const effectiveMerchant = merchantName || localResult?.merchantName || '';
    const summary = effectiveMerchant && items.length > 0
      ? `Faturë nga ${effectiveMerchant}: ${items.slice(0, 4).map(n => n.toLowerCase()).join(', ')}`
      : effectiveMerchant ? `Faturë nga ${effectiveMerchant}` : (localResult?.summary ?? '');

    const parsed: ParsedExpense = rawText ? parseExpense(rawText) : blankParsed();

    const aiHasAmount = typeof data?.amount === 'number' && data.amount > 0;
    if (aiHasAmount) {
      parsed.amount = data.amount; parsed.detectedAmount = true;
    }
    if (VALID_CURRENCIES.includes(data?.currency as Currency)) {
      parsed.currency = data.currency as Currency; parsed.detectedCurrency = true;
    }
    if (VALID_CATEGORIES.includes(data?.category as CategoryId)) {
      parsed.category = data.category as CategoryId; parsed.detectedCategory = true;
    }
    if (typeof data?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
      parsed.date = data.date; parsed.detectedDate = true;
    }
    if (summary) parsed.note = summary;
    else if (effectiveMerchant) parsed.note = effectiveMerchant;

    const uncertainAmount = !aiHasAmount;
    if (__DEV__) console.log('[receiptScanner] Edge raw text:', rawText);

    return { rawText, parsed, merchantName: effectiveMerchant, items, summary, uncertainAmount, itemsConfidence, overallConfidence: aiConf, source: 'ai' };
  } catch (err: any) {
    if (__DEV__) console.warn('[receiptScanner] Edge failed:', err?.message);
    return fallback();
  }
}

// ── UI helpers ────────────────────────────────────────────────────────────────

export function countDetectedFields(result: ReceiptScanResult): number {
  const p = result.parsed;
  return (
    (p.detectedAmount ? 1 : 0) +
    (p.detectedCurrency ? 1 : 0) +
    (p.detectedCategory ? 1 : 0) +
    (p.detectedDate ? 1 : 0) +
    (result.merchantName ? 1 : 0)
  );
}
