'use client';

import React from 'react';
import { tr } from '@/lib/i18n/core';
import { FOOD_TYPES, FoodType } from '@/lib/restaurant/dish';
import { FoodMark } from '@/components/restaurant/FoodMark';

/** Product form, Restaurant mode (v4.138.0): Veg / Egg / Non-veg; tap the chosen one again to clear it. */
export function FoodTypePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const label: Record<FoodType, string> = { veg: tr('Veg'), egg: tr('Egg'), nonveg: tr('Non-veg') };
  return (
    <div data-food-type-picker>
      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{tr('Veg / Non-veg')}</label>
      <div className="grid grid-cols-3 gap-2">
        {FOOD_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange(value === t ? '' : t)}
            aria-pressed={value === t}
            data-food-type={t}
            className={`h-10 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
              value === t ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
            }`}
          >
            <FoodMark type={t} />
            {label[t]}
          </button>
        ))}
      </div>
    </div>
  );
}
