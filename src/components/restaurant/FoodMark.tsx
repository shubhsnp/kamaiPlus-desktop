'use client';

import React from 'react';
import { tr } from '@/lib/i18n/core';
import type { FoodType } from '@/lib/restaurant/dish';

/**
 * The veg / egg / non-veg mark Indian menus use (v4.138.0): a square with a dot (veg, green), a dot
 * (egg, amber) or a triangle (non-veg, brown — the FSSAI mark). Nothing for a dish without a type.
 */
export function FoodMark({ type, size = 14, className = '' }: { type: FoodType | null; size?: number; className?: string }) {
  if (!type) return null;
  const color = type === 'veg' ? '#15803d' : type === 'egg' ? '#d97706' : '#7c2d12';
  const label = type === 'veg' ? tr('Veg') : type === 'egg' ? tr('Egg') : tr('Non-veg');
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      role="img"
      aria-label={label}
      data-food-mark={type}
      className={`shrink-0 ${className}`}
    >
      <title>{label}</title>
      <rect x="0.75" y="0.75" width="12.5" height="12.5" rx="1.5" fill="#fff" stroke={color} strokeWidth="1.5" />
      {type === 'nonveg' ? <path d="M7 3.2 L10.6 10 H3.4 Z" fill={color} /> : <circle cx="7" cy="7" r="3.2" fill={color} />}
    </svg>
  );
}
