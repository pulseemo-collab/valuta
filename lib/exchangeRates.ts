import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Currency } from '@/types';

const CACHE_KEY = 'valuta_exchange_rates_v2';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

/**
 * Fallback rates: how many ALL equals 1 unit of the currency.
 * Used when the live fetch fails or before the first fetch completes.
 */
export const FALLBACK_RATES: Record<Currency, number> = {
  ALL: 1,
  EUR: 118,
  USD: 108,
};

interface RateCache {
  rates: Partial<Record<Currency, number>>;
  fetchedAt: number;
}

// In-memory singleton — starts with fallback, updated by initRates().
const _live: Record<Currency, number> = { ...FALLBACK_RATES };

/** Returns how many ALL equals 1 unit of the given currency (sync). */
export function getRate(currency: Currency): number {
  return _live[currency] ?? FALLBACK_RATES[currency] ?? 1;
}

async function fetchLive(): Promise<Partial<Record<Currency, number>> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/EUR', {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      result?: string;
      rates?: Record<string, number>;
    };
    if (data.result !== 'success' || !data.rates) return null;
    const allPerEur = data.rates['ALL'];
    const usdPerEur = data.rates['USD'];
    if (!allPerEur || !usdPerEur) return null;
    return {
      ALL: 1,
      EUR: allPerEur,
      // USD toALL = (ALL per EUR) ÷ (USD per EUR)
      USD: allPerEur / usdPerEur,
    };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Call once on app start. Loads cached rates from AsyncStorage (12h TTL),
 * then attempts a live fetch if the cache is stale. Falls back silently to
 * FALLBACK_RATES on any error. Never throws.
 */
export async function initRates(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const cached: RateCache = JSON.parse(raw);
      const age = Date.now() - cached.fetchedAt;
      if (age < CACHE_TTL_MS) {
        Object.assign(_live, FALLBACK_RATES, cached.rates);
        return;
      }
    }
  } catch {}

  const live = await fetchLive();
  if (live) {
    Object.assign(_live, FALLBACK_RATES, live);
    try {
      const cache: RateCache = { rates: live, fetchedAt: Date.now() };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {}
  }
  // If fetch failed, _live keeps its FALLBACK_RATES values set at module load.
}
