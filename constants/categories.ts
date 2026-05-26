import type { Category, CategoryId } from '@/types';
import { BUSINESS_CATEGORIES } from '@/constants/businessCategories';

export const CATEGORIES: Category[] = [
  {
    id: 'ushqim',
    name: 'Ushqim',
    icon: 'restaurant-outline',
    color: '#F97316',
    bgColor: 'rgba(249,115,22,0.15)',
  },
  {
    id: 'transport',
    name: 'Transport',
    icon: 'car-outline',
    color: '#3B82F6',
    bgColor: 'rgba(59,130,246,0.15)',
  },
  {
    id: 'faturat',
    name: 'Faturat',
    icon: 'receipt-outline',
    color: '#8B5CF6',
    bgColor: 'rgba(139,92,246,0.15)',
  },
  {
    id: 'shopping',
    name: 'Shopping',
    icon: 'bag-outline',
    color: '#EC4899',
    bgColor: 'rgba(236,72,153,0.15)',
  },
  {
    id: 'shendet',
    name: 'Shëndet',
    icon: 'medical-outline',
    color: '#10B981',
    bgColor: 'rgba(16,185,129,0.15)',
  },
  {
    id: 'argetime',
    name: 'Argëtim',
    icon: 'game-controller-outline',
    color: '#F59E0B',
    bgColor: 'rgba(245,158,11,0.15)',
  },
  {
    id: 'biznes',
    name: 'Biznes',
    icon: 'briefcase-outline',
    color: '#06B6D4',
    bgColor: 'rgba(6,182,212,0.15)',
  },
  {
    id: 'tjera',
    name: 'Të tjera',
    icon: 'ellipsis-horizontal-outline',
    color: '#94A3B8',
    bgColor: 'rgba(148,163,184,0.15)',
  },
];

export const getCategoryById = (id: CategoryId): Category =>
  [...CATEGORIES, ...BUSINESS_CATEGORIES].find((c) => c.id === id) ?? CATEGORIES[7];
