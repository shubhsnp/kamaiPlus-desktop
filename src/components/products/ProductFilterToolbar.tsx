'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Search,
  X,
  AlertTriangle,
  LayoutGrid,
  Table as TableIcon,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Category } from '@/types';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import { categoryLabel } from '@/lib/products/defaultCategory';

interface ProductFilterToolbarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  categories: Category[];
  selectedCategory: string;
  onSelectCategory: (val: string) => void;
  showLowStockOnly: boolean;
  onToggleLowStock: (val: boolean) => void;
  showExpiringOnly?: boolean;
  onToggleExpiringOnly?: (val: boolean) => void;
  viewMode?: 'table' | 'cards';
  onViewModeChange?: (mode: 'table' | 'cards') => void;
}

export const ProductFilterToolbar: React.FC<ProductFilterToolbarProps> = ({
  searchQuery,
  onSearchChange,
  categories,
  selectedCategory,
  onSelectCategory,
  showLowStockOnly,
  onToggleLowStock,
  viewMode = 'table',
  onViewModeChange,
}) => {
  // Category chips (v4.81.0): one row that wraps instead of a side-scroll strip — a mouse
  // wheel cannot scroll sideways, so a shop with 50 sections never reached most of them.
  // "All categories (N)" opens every row; the picked category always sits right after "All Items".
  const [showAllCats, setShowAllCats] = useState(false);
  const [chipsOverflow, setChipsOverflow] = useState(false);
  const chipsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = chipsRef.current;
    if (!el) return;
    const measure = () => setChipsOverflow(el.scrollHeight > el.clientHeight + 2);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [categories.length, showAllCats]);

  const picked = categories.find((c) => c.id === selectedCategory);
  const orderedCategories = picked ? [picked, ...categories.filter((c) => c.id !== picked.id)] : categories;

  return (
    <div className="flex flex-col gap-2.5 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs">
      <div className="flex items-center gap-2">
        {/* Search input */}
        <div className="relative flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder={tr('Search by product name, barcode, HSN, size, color...')}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Low Stock Toggle */}
        <button
          type="button"
          onClick={() => onToggleLowStock(!showLowStockOnly)}
          className={cn(
            "px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0",
            showLowStockOnly
              ? "bg-rose-600 text-white shadow-2xs"
              : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
          )}
        >
          <AlertTriangle className={cn("w-3.5 h-3.5", showLowStockOnly ? "text-white" : "text-rose-500")} />
          <span className="hidden sm:inline">{tr('Low Stock')}</span>
        </button>

        {/* Desktop View Switcher: Excel Table vs Cards */}
        {onViewModeChange && (
          <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700 shrink-0">
            <button
              type="button"
              onClick={() => onViewModeChange('table')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer",
                viewMode === 'table'
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
              )}
              title={tr('Dense Excel-Style Table View')}
            >
              <TableIcon className="w-3.5 h-3.5 text-emerald-600" />
              <span>{tr('Excel Table')}</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('cards')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer",
                viewMode === 'cards'
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
              )}
              title={tr('Cards Grid View')}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-indigo-600" />
              <span>{tr('Cards')}</span>
            </button>
          </div>
        )}
      </div>

      {/* 1-Tap Category Chips */}
      <div className="flex items-start gap-1.5">
        <div
          ref={chipsRef}
          className={cn("flex flex-1 min-w-0 flex-wrap items-center gap-1.5 select-none", !showAllCats && "max-h-[30px] overflow-hidden")}
          data-product-category-chips
        >
          <button
            type="button"
            onClick={() => onSelectCategory('all')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap",
              selectedCategory === 'all'
                ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 shadow-2xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            )}
          >
            {tr('All Items')}
          </button>

          {orderedCategories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelectCategory(c.id)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap",
                selectedCategory === c.id
                  ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 shadow-2xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              )}
            >
              {categoryLabel(c.name)}
            </button>
          ))}
        </div>

        {(chipsOverflow || showAllCats) && (
          <button
            type="button"
            onClick={() => setShowAllCats((v) => !v)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1 cursor-pointer border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-expanded={showAllCats}
            data-product-category-more
          >
            {showAllCats ? (
              <>
                <span>{tr('Show less')}</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <span>{tr('All categories ({count})', { count: categories.length })}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
