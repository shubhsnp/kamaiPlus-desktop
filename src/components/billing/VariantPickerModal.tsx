'use client';

import React, { useEffect, useState } from 'react';
import { Layers, X } from 'lucide-react';
import { Product } from '@/types';
import { formatINR } from '@/lib/utils';
import { getVariantChildren } from '@/lib/products/variants';
import { tr } from '@/lib/i18n/core';
import { useFeatureSwitches } from '@/lib/features/featureSwitches';
import { countsStockAtCounter } from '@/lib/billing/stockRule';

interface VariantPickerModalProps {
  parent: Product;
  /** Units already in this bill per product id, so stock shown is what is left. */
  inCart: (productId: string) => number;
  onPick: (variant: Product) => void;
  onClose: () => void;
}

/**
 * POS: tapping a product that has variants asks which size / colour (the Android
 * `_pickVariant` sheet). Number keys 1–9 pick quickly; out-of-stock variants are
 * shown but cannot be chosen.
 */
export function VariantPickerModal({ parent, inCart, onPick, onClose }: VariantPickerModalProps) {
  const [variants, setVariants] = useState<Product[] | null>(null);

  useEffect(() => {
    let alive = true;
    getVariantChildren(parent.id).then((v) => alive && setVariants(v)).catch(() => alive && setVariants([]));
    return () => {
      alive = false;
    };
  }, [parent.id]);

  const stockOn = useFeatureSwitches().stock_counting;
  // Stock counting off: every size can be picked, no stock shown (v4.119.0, AU-30).
  const available = (v: Product) => (!countsStockAtCounter(v, stockOn) ? Infinity : Math.max(0, Number(v.current_stock || 0) - inCart(v.id)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      const n = Number(e.key);
      if (variants && n >= 1 && n <= 9 && variants[n - 1] && available(variants[n - 1]) > 0) {
        e.preventDefault();
        onPick(variants[n - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-black text-slate-900 truncate">{parent.name}</h3>
            <p className="text-[11px] text-slate-500">{tr('Select size / colour to add · keys 1–9')}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer" aria-label={tr('Close')}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto space-y-2">
          {variants === null ? (
            <p className="py-6 text-center text-xs text-slate-400">{tr('Loading…')}</p>
          ) : variants.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">{tr('No variants yet. Add sizes / colours in Products.')}</p>
          ) : (
            variants.map((v, i) => {
              const left = available(v);
              const out = left <= 0;
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={out}
                  onClick={() => onPick(v)}
                  className={`w-full px-3 py-2.5 rounded-xl border flex items-center gap-3 text-left ${out ? 'bg-slate-50 border-slate-200 cursor-not-allowed' : 'bg-white border-indigo-200 hover:border-indigo-500 hover:bg-indigo-50/40 cursor-pointer'}`}
                >
                  <span className="text-[10px] font-mono text-slate-400 w-3">{i < 9 ? i + 1 : ''}</span>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-black min-w-[44px] text-center ${out ? 'bg-slate-200 text-slate-400' : 'bg-indigo-50 text-indigo-700'}`}>
                    {v.variant_label || v.size || `V${i + 1}`}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-xs font-bold truncate ${out ? 'text-slate-400' : 'text-slate-900'}`}>{v.name}</span>
                    <span className={`block text-[11px] font-semibold ${out ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {out ? tr('Out of stock') : !stockOn ? '' : v.is_unlimited_stock ? tr('In stock') : `${left} ${v.unit || 'units'} left`}
                    </span>
                  </span>
                  <span className={`font-mono font-black text-sm ${out ? 'text-slate-400' : 'text-slate-900'}`}>{formatINR(v.selling_price)}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
