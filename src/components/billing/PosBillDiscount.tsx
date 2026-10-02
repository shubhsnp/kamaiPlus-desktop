'use client';

import React from 'react';
import { Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';

/** Bill-level discount on the counter (moved out of app/billing/page.tsx, v4.93.0 — same box). */
export function PosBillDiscount({
  type,
  value,
  onTypeChange,
  onValueChange,
}: {
  type: 'flat' | 'percentage';
  value: string;
  onTypeChange: (t: 'flat' | 'percentage') => void;
  onValueChange: (v: string) => void;
}) {
  return (
    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5" data-pos-bill-discount>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
          <Tag className="w-3.5 h-3.5 text-emerald-600" />
          <span>{tr('Bill Discount')}</span>
        </span>
        <div className="flex items-center p-0.5 bg-slate-200/80 rounded-lg">
          {(['flat', 'percentage'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTypeChange(t)}
              className={cn(
                'px-2 py-0.5 rounded text-[10.5px] font-bold transition-all cursor-pointer',
                type === t ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              {t === 'flat' ? tr('₹ Flat') : tr('% Percent')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="number"
            step="any"
            min="0"
            max={type === 'percentage' ? 100 : undefined}
            placeholder={type === 'percentage' ? tr('e.g. 5 or 10%') : tr('e.g. 50')}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            className="w-full bg-white border border-slate-300 text-slate-900 text-xs rounded-lg pl-6 pr-2 py-1.5 focus:outline-none focus:border-slate-900 font-mono font-bold"
          />
          <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">{type === 'percentage' ? '%' : '₹'}</span>
        </div>
        {value && (
          <button
            type="button"
            onClick={() => onValueChange('')}
            className="text-[11px] text-rose-600 font-bold hover:text-rose-700 px-1.5 py-1 cursor-pointer"
          >
            {tr('Clear')}
          </button>
        )}
      </div>

      {type === 'percentage' && (
        <div className="flex items-center gap-1 pt-0.5">
          {['5', '10', '15', '20'].map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => onValueChange(pct)}
              className={cn(
                'px-2 py-0.5 rounded text-[10.5px] font-bold transition-all border cursor-pointer',
                value === pct ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              )}
            >
              {pct}%
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
