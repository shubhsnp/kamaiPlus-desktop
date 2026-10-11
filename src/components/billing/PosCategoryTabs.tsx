'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, PlusCircle, Tag } from 'lucide-react';
import type { Category } from '@/types';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import { categoryLabel } from '@/lib/products/defaultCategory';

/**
 * The POS category chips above the product grid (moved out of app/billing/page.tsx, v4.92.0).
 * v4.93.0 — one row that wraps instead of a side-scroll strip (a mouse wheel cannot scroll
 * sideways, and the strip showed a scrollbar), like Products (v4.81.0): "All categories (N)"
 * opens every row, and the picked category always sits right after "All Items".
 */
export function PosCategoryTabs({
  categories,
  categoryCounts,
  selectedCategory,
  onSelect,
  totalProductCount,
  onCustomItem,
}: {
  categories: Category[];
  categoryCounts: Record<string, number>;
  selectedCategory: string;
  onSelect: (id: string) => void;
  totalProductCount: number;
  /** v4.159.0: opens the Custom Item window (a line that is not in the item list) — same as the phone. */
  onCustomItem?: () => void;
}) {
  // v4.157.0 (PC = phone, Android P-06): a category with no items is not a chip ("Atta, Rice & Dal 0" in a
  // retail shop); the picked one always stays. Until the counts arrive every category shows.
  const countsLoaded = Object.keys(categoryCounts).length > 0;
  const shown = countsLoaded ? categories.filter((c) => (categoryCounts[c.id] || 0) > 0 || c.id === selectedCategory) : categories;
  const [showAll, setShowAll] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const measure = () => setOverflow(el.scrollHeight > el.clientHeight + 2);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [shown.length, showAll]);

  const picked = shown.find((c) => c.id === selectedCategory);
  const ordered = picked ? [picked, ...shown.filter((c) => c.id !== picked.id)] : shown;

  const chip = (active: boolean) =>
    cn(
      'px-3 py-1.5 rounded-lg text-xs whitespace-nowrap flex items-center gap-1.5 cursor-pointer transition-all',
      active ? 'bg-slate-900 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200'
    );
  const count = (active: boolean) =>
    cn('text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold', active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600');

  return (
    <div className="flex items-start gap-1.5 flex-shrink-0" data-pos-category-tabs>
      <div ref={rowRef} className={cn('flex flex-1 min-w-0 flex-wrap items-center gap-1.5 select-none', !showAll && 'max-h-[30px] overflow-hidden')}>
        {onCustomItem && (
          <button type="button" onClick={onCustomItem} data-pos-custom-item className="px-3 py-1.5 rounded-lg text-xs whitespace-nowrap flex items-center gap-1.5 cursor-pointer font-bold border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100">
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{tr('Custom Item')}</span>
          </button>
        )}
        <button onClick={() => onSelect('all')} className={cn(chip(selectedCategory === 'all'), 'font-bold')}>
          <span>{tr('All Items')}</span>
          <span className={count(selectedCategory === 'all')}>{totalProductCount}</span>
        </button>
        {ordered.map((cat) => (
          <button key={cat.id} onClick={() => onSelect(cat.id)} className={chip(selectedCategory === cat.id)}>
            <Tag className="w-3 h-3 text-slate-400" />
            <span>{categoryLabel(cat.name)}</span>
            <span className={count(selectedCategory === cat.id)}>{categoryCounts[cat.id] || 0}</span>
          </button>
        ))}
      </div>

      {(overflow || showAll) && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setShowAll((v) => !v)}
          className="px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1 cursor-pointer border border-slate-200 text-slate-700 hover:bg-slate-100"
          aria-expanded={showAll}
          data-pos-category-more
        >
          {showAll ? (
            <>
              <span>{tr('Show less')}</span>
              <ChevronUp className="w-3.5 h-3.5" />
            </>
          ) : (
            <>
              <span>{tr('All categories ({count})', { count: shown.length })}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
