import type { Currency } from '@/types';
import { getRate } from '@/lib/exchangeRates';

export interface CurrencyInfo {
  code: Currency;
  name: string;
  symbol: string;
  toALL: number;
}

// Display metadata only — `toALL` is always resolved via getRate() at call time.
const CURRENCY_META: Omit<CurrencyInfo, 'toALL'>[] = [
  { code: 'ALL', name: 'Lekë Shqiptare', symbol: 'L' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'USD', name: 'Dollar Amerikan', symbol: '$' },
];

/** Static array for UI pickers — toALL reflects the current in-memory rate. */
export const CURRENCIES: CurrencyInfo[] = CURRENCY_META.map((m) => ({
  ...m,
  get toALL() {
    return getRate(m.code);
  },
}));

/** Returns currency metadata including the current live-or-fallback rate. */
export function getCurrencyInfo(code: Currency): CurrencyInfo {
  const meta = CURRENCY_META.find((m) => m.code === code)!;
  return { ...meta, toALL: getRate(code) };
}

/** Converts an amount in the given currency to ALL using the current rate. */
export const convertToALL = (amount: number, currency: Currency): number =>
  amount * getRate(currency);

/** Converts an ALL amount to the given currency using the current rate. */
export const convertFromALL = (amountALL: number, currency: Currency): number =>
  amountALL / getRate(currency);
