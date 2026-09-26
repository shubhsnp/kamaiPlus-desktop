'use client';

import React from 'react';
import { cn, formatINR } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';

// Memoized Product Card to prevent re-rendering the entire 200-item grid on every cart update
export const PosProductCard = React.memo(({
  p,
  idx,
  inCartQuantity,
  availableStock,
  stockNum,
  isOutOfStock,
  isLowStock,
  isHighlighted,
  variants,
  onAdd
}: {
  p: any;
  idx: number;
  inCartQuantity: number;
  availableStock: number;
  stockNum: number;
  isOutOfStock: boolean;
  isLowStock: boolean;
  isHighlighted: boolean;
  /** Set for a parent with sizes / colours: how many, and the cheapest price. */
  variants?: { count: number; minPricePaise: number };
  onAdd: (p: any) => void;
}) => {
  return (
    <button
      type="button"
      onClick={() => onAdd(p)}
      className={cn(
        'p-2.5 rounded-xl border text-left flex flex-col justify-between relative transition-all min-h-[105px] sm:min-h-[110px] h-full',
        isOutOfStock
          ? 'border-rose-300/80 bg-rose-50/40 opacity-70 hover:border-rose-400 cursor-not-allowed select-none'
          : isHighlighted
          ? 'cursor-pointer bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500 shadow-md scale-[1.01]'
          : inCartQuantity > 0 && !isOutOfStock
          ? 'cursor-pointer bg-amber-50/40 border-amber-400 ring-1.5 ring-amber-400/50 shadow-2xs active:scale-[0.98]'
          : 'cursor-pointer bg-white hover:border-slate-400 hover:shadow-2xs border-slate-200 shadow-2xs active:scale-[0.98]'
      )}
    >
      {isOutOfStock ? (
        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-rose-600 text-white text-[9px] font-black uppercase tracking-wider shadow-xs">
          {tr('Out of Stock')}
        </div>
      ) : isHighlighted ? (
        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[9px] font-black font-mono shadow-xs">
          {tr('↵ Enter')}
        </div>
      ) : inCartQuantity > 0 ? (
        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.2 rounded-md bg-amber-400 text-slate-950 text-[9px] font-black shadow-xs">
          {inCartQuantity} {tr('in cart')}
        </div>
      ) : null}

      <div className="pr-12">
        <span className="text-[9px] uppercase font-extrabold tracking-wider block leading-tight text-slate-400">
          {p.category_name || tr('Item')}
        </span>
        <h4 className={cn(
          "text-xs sm:text-sm font-bold line-clamp-2 mt-0.5 leading-snug",
          isOutOfStock ? "text-slate-500 line-through" : "text-slate-900"
        )}>
          {p.name}
        </h4>
      </div>

      <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-baseline justify-between gap-1">
        <div className="truncate">
          {variants && <span className="text-[10px] text-slate-500 font-medium mr-0.5">{tr('from')}</span>}
          <span className={cn(
            "text-xs sm:text-sm font-black font-mono",
            isOutOfStock ? "text-slate-400 line-through" : "text-slate-900"
          )}>
            {formatINR(variants ? variants.minPricePaise : p.selling_price)}
          </span>
          {!variants && <span className="text-[10px] text-slate-500 font-medium ml-0.5">/{p.unit}</span>}
        </div>
        {variants ? (
          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 bg-indigo-100 text-indigo-700">
            {variants.count} {tr('Variants ▾')}
          </span>
        ) : (
        <span className={cn(
          "text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-md shrink-0 flex items-center gap-1",
          isOutOfStock ? "bg-rose-100 text-rose-700" : isLowStock ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
        )}>
          {p.is_unlimited_stock ? '∞' : stockNum}
        </span>
        )}
      </div>
    </button>
  );
});
PosProductCard.displayName = 'PosProductCard';
