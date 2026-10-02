'use client';

import React from 'react';
import { Store, Warehouse } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import type { PriceMode } from '@/lib/billing/priceMode';

/**
 * Retail / Wholesale for the bill on the counter (v4.87.0) — shown with Settings → Features →
 * "Wholesale price" on. Switching moves the cart's items to that price (lib/billing/priceMode.ts).
 */
export function PosPriceModeToggle({ mode, onChange, compact = false }: { mode: PriceMode; onChange: (mode: PriceMode) => void; compact?: boolean }) {
  // compact (v4.93.0): a small switch in the bill's header row instead of a full-width row.
  const btn = compact
    ? 'h-6 px-2 rounded text-[10.5px] font-black flex items-center justify-center gap-1 cursor-pointer transition-colors'
    : 'flex-1 h-8 px-2.5 rounded-md text-[11px] font-black flex items-center justify-center gap-1.5 cursor-pointer transition-colors';
  return (
    <div className={cn('flex items-center rounded-lg bg-slate-100 border border-slate-200', compact ? 'gap-0.5 p-0.5' : 'gap-1 p-1')} role="radiogroup" aria-label={tr('Price for this bill')} data-price-mode={mode}>
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'retail'}
        onClick={() => onChange('retail')}
        className={cn(btn, mode === 'retail' ? 'bg-white text-slate-900 shadow-xs border border-slate-300' : 'text-slate-500 hover:text-slate-800')}
        data-price-mode-retail
      >
        <Store className="w-3.5 h-3.5" /> {tr('Retail')}
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'wholesale'}
        onClick={() => onChange('wholesale')}
        className={cn(btn, mode === 'wholesale' ? 'bg-violet-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800')}
        data-price-mode-wholesale
      >
        <Warehouse className="w-3.5 h-3.5" /> {tr('Wholesale')}
      </button>
    </div>
  );
}
