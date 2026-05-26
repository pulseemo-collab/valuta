import type { Category, BusinessCategoryId } from '@/types';

export const BUSINESS_CATEGORIES: Category[] = [
  {
    id: 'furnitor' as BusinessCategoryId,
    name: 'Furnitorë',
    icon: 'cube-outline',
    color: '#6366F1',
    bgColor: 'rgba(99,102,241,0.15)',
  },
  {
    id: 'inventar' as BusinessCategoryId,
    name: 'Inventar',
    icon: 'layers-outline',
    color: '#8B5CF6',
    bgColor: 'rgba(139,92,246,0.15)',
  },
  {
    id: 'marketing_biz' as BusinessCategoryId,
    name: 'Marketing',
    icon: 'megaphone-outline',
    color: '#EC4899',
    bgColor: 'rgba(236,72,153,0.15)',
  },
  {
    id: 'zyre' as BusinessCategoryId,
    name: 'Zyrë',
    icon: 'business-outline',
    color: '#06B6D4',
    bgColor: 'rgba(6,182,212,0.15)',
  },
  {
    id: 'transport_biz' as BusinessCategoryId,
    name: 'Transport',
    icon: 'car-sport-outline',
    color: '#3B82F6',
    bgColor: 'rgba(59,130,246,0.15)',
  },
  {
    id: 'punonjes' as BusinessCategoryId,
    name: 'Punonjës',
    icon: 'people-outline',
    color: '#10B981',
    bgColor: 'rgba(16,185,129,0.15)',
  },
  {
    id: 'taksa' as BusinessCategoryId,
    name: 'Taksa',
    icon: 'calculator-outline',
    color: '#F59E0B',
    bgColor: 'rgba(245,158,11,0.15)',
  },
  {
    id: 'sherbime' as BusinessCategoryId,
    name: 'Shërbime',
    icon: 'construct-outline',
    color: '#F97316',
    bgColor: 'rgba(249,115,22,0.15)',
  },
];

export const getBusinessCategoryById = (id: BusinessCategoryId): Category =>
  BUSINESS_CATEGORIES.find((c) => c.id === id) ?? BUSINESS_CATEGORIES[7];
