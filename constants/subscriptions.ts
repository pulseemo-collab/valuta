import type { CategoryId, Currency } from '@/types';

export interface SubscriptionPreset {
  name: string;
  icon: string;
  color: string;
  bgColor: string;
  categoryId: CategoryId;
  defaultAmount: number;
  defaultCurrency: Currency;
}

export const SUBSCRIPTION_PRESETS: SubscriptionPreset[] = [
  {
    name: 'Netflix',
    icon: 'play-circle-outline',
    color: '#E50914',
    bgColor: 'rgba(229,9,20,0.12)',
    categoryId: 'argetime',
    defaultAmount: 15,
    defaultCurrency: 'EUR',
  },
  {
    name: 'Spotify',
    icon: 'musical-notes-outline',
    color: '#1DB954',
    bgColor: 'rgba(29,185,84,0.12)',
    categoryId: 'argetime',
    defaultAmount: 10,
    defaultCurrency: 'EUR',
  },
  {
    name: 'YouTube Premium',
    icon: 'logo-youtube',
    color: '#FF0000',
    bgColor: 'rgba(255,0,0,0.12)',
    categoryId: 'argetime',
    defaultAmount: 12,
    defaultCurrency: 'EUR',
  },
  {
    name: 'Amazon Prime',
    icon: 'cart-outline',
    color: '#FF9900',
    bgColor: 'rgba(255,153,0,0.12)',
    categoryId: 'shopping',
    defaultAmount: 8,
    defaultCurrency: 'EUR',
  },
  {
    name: 'Apple iCloud',
    icon: 'cloud-outline',
    color: '#007AFF',
    bgColor: 'rgba(0,122,255,0.12)',
    categoryId: 'tjera',
    defaultAmount: 3,
    defaultCurrency: 'EUR',
  },
  {
    name: 'Google One',
    icon: 'logo-google',
    color: '#4285F4',
    bgColor: 'rgba(66,133,244,0.12)',
    categoryId: 'tjera',
    defaultAmount: 3,
    defaultCurrency: 'EUR',
  },
  {
    name: 'Palestër / Gym',
    icon: 'barbell-outline',
    color: '#F59E0B',
    bgColor: 'rgba(245,158,11,0.12)',
    categoryId: 'shendet',
    defaultAmount: 2500,
    defaultCurrency: 'ALL',
  },
  {
    name: 'Internet',
    icon: 'wifi-outline',
    color: '#3B82F6',
    bgColor: 'rgba(59,130,246,0.12)',
    categoryId: 'faturat',
    defaultAmount: 2000,
    defaultCurrency: 'ALL',
  },
  {
    name: 'Disney+',
    icon: 'tv-outline',
    color: '#0063E5',
    bgColor: 'rgba(0,99,229,0.12)',
    categoryId: 'argetime',
    defaultAmount: 11,
    defaultCurrency: 'EUR',
  },
  {
    name: 'HBO Max',
    icon: 'film-outline',
    color: '#5C2B9D',
    bgColor: 'rgba(92,43,157,0.12)',
    categoryId: 'argetime',
    defaultAmount: 15,
    defaultCurrency: 'EUR',
  },
  {
    name: 'Microsoft 365',
    icon: 'grid-outline',
    color: '#D73A2B',
    bgColor: 'rgba(215,58,43,0.12)',
    categoryId: 'tjera',
    defaultAmount: 12,
    defaultCurrency: 'EUR',
  },
  {
    name: 'Canva Pro',
    icon: 'color-palette-outline',
    color: '#7D2AE7',
    bgColor: 'rgba(125,42,231,0.12)',
    categoryId: 'tjera',
    defaultAmount: 15,
    defaultCurrency: 'EUR',
  },
];

export const RECURRING_SUBSCRIPTION_KEYWORDS = [
  'netflix', 'spotify', 'youtube', 'prime', 'amazon', 'hbo', 'disney',
  'apple', 'icloud', 'google', 'microsoft', 'adobe', 'dropbox',
  'claude', 'chatgpt', 'openai', 'canva', 'figma', 'notion',
  'gym', 'palestër', 'palestere',
  'abonim', 'abonament', 'internet', 'wifi', 'broadband',
];
