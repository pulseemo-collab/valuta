import type { Currency } from '@/types';

export interface GoalPreset {
  title: string;
  icon: string;
  color: string;
  bgColor: string;
  suggestedAmount: number;
  currency: Currency;
}

export const GOAL_PRESETS: GoalPreset[] = [
  {
    title: 'Telefon i ri',
    icon: 'phone-portrait-outline',
    color: '#3B82F6',
    bgColor: 'rgba(59,130,246,0.15)',
    suggestedAmount: 80000,
    currency: 'ALL',
  },
  {
    title: 'Pushime',
    icon: 'airplane-outline',
    color: '#10B981',
    bgColor: 'rgba(16,185,129,0.15)',
    suggestedAmount: 200000,
    currency: 'ALL',
  },
  {
    title: 'Fond emergjence',
    icon: 'shield-checkmark-outline',
    color: '#F59E0B',
    bgColor: 'rgba(245,158,11,0.15)',
    suggestedAmount: 300000,
    currency: 'ALL',
  },
  {
    title: 'Makinë',
    icon: 'car-outline',
    color: '#8B5CF6',
    bgColor: 'rgba(139,92,246,0.15)',
    suggestedAmount: 2000000,
    currency: 'ALL',
  },
  {
    title: 'Investim biznesi',
    icon: 'briefcase-outline',
    color: '#06B6D4',
    bgColor: 'rgba(6,182,212,0.15)',
    suggestedAmount: 500000,
    currency: 'ALL',
  },
  {
    title: 'Banesë',
    icon: 'home-outline',
    color: '#EF4444',
    bgColor: 'rgba(239,68,68,0.15)',
    suggestedAmount: 5000000,
    currency: 'ALL',
  },
  {
    title: 'Arsimim',
    icon: 'school-outline',
    color: '#EC4899',
    bgColor: 'rgba(236,72,153,0.15)',
    suggestedAmount: 150000,
    currency: 'ALL',
  },
  {
    title: 'Pajisje',
    icon: 'laptop-outline',
    color: '#64748B',
    bgColor: 'rgba(100,116,139,0.15)',
    suggestedAmount: 120000,
    currency: 'ALL',
  },
];
