'use client';

import React from 'react';
import { Tag } from 'lucide-react';
import type { Category } from '@/types';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';

/** The POS category chips above the product grid (moved out of app/billing/page.tsx, v4.92.0 — same markup). */
export function PosCategoryTabs({
  categories,
  categoryCounts,
  selectedCategory,
  onSelect,
  totalProductCount,
}: {
  categories: Category[];
  categoryCounts: Record<string, number>;
  selectedCategory: string;
  onSelect: (id: string) => void;
  totalProductCount: number;
}) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 flex-shrink-0 scrollbar-none">
      <button
        onClick={() => onSelect('all')}
        className={cn(
          'px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5',
          selectedCategory === 'all'
            ? 'bg-slate-900 text-white shadow-xs'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        )}
      >
        <span>{tr('All Items')}</span>
        <span className={cn(
          "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold",
          selectedCategory === 'all' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
        )}>
          {totalProductCount}
        </span>
      </button>
      {categories.map((cat) => {
        const count = categoryCounts[cat.id] || 0;
        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 cursor-pointer transition-all',
              selectedCategory === cat.id
                ? 'bg-slate-900 text-white font-bold shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            )}
          >
            <Tag className="w-3 h-3 text-slate-400" />
            <span>{cat.name}</span>
            <span className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold",
              selectedCategory === cat.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
            )}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
