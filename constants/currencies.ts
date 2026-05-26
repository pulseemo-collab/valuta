import type { Currency } from '@/types';

export interface CurrencyInfo {
  code: Currency;
  name: string;
  symbol: string;
  toALL: number;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'ALL', name: 'Lekë Shqiptare', symbol: 'L', toALL: 1 },
  { code: 'EUR', name: 'Euro', symbol: '€', toALL: 100 },
  { code: 'USD', name: 'Dollar Amerikan', symbol: '$', toALL: 93 },
];

export const getCurrencyInfo = (code: Currency): CurrencyInfo =>
  CURRENCIES.find((c) => c.code === code)!;

export const convertToALL = (amount: number, currency: Currency): number => {
  const info = getCurrencyInfo(currency);
  return amount * info.toALL;
};

export const convertFromALL = (amountALL: number, currency: Currency): number => {
  const info = getCurrencyInfo(currency);
  return amountALL / info.toALL;
};
