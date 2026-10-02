'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Flame } from 'lucide-react';
import type { Customer, Sale } from '@/types';
import { formatINRCompact } from '@/lib/utils';
import { formatCartQty } from '@/lib/billing/unitQuantity';
import { tr } from '@/lib/i18n/core';
import { topDebtors, topItemsToday } from '@/lib/dashboard/todayInsights';

/**
 * Home "Today at a glance" (v4.93.0): the items that sold most today and the customers who owe
 * the most — Home used to list the same screens three times and no shop facts at all.
 * Nothing sold and no udhar (a new shop): nothing shows.
 */
export function TodayInsights({ sales, debtors, khataOn }: { sales: Sale[]; debtors: Customer[]; khataOn: boolean }) {
  const items = useMemo(() => topItemsToday(sales), [sales]);
  const owing = useMemo(() => (khataOn ? topDebtors(debtors) : []), [debtors, khataOn]);
  if (items.length === 0 && owing.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 sm:gap-3" data-home-insights>
      {items.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-3.5 shadow-2xs" data-home-top-items>
          <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
            <Flame className="w-3.5 h-3.5 text-orange-500" />
            {tr('Top items today')}
          </div>
          <ol className="space-y-1.5">
            {items.map((it, i) => (
              <li key={it.productId || it.name} className="flex items-center gap-2 text-xs">
                <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 font-black flex items-center justify-center shrink-0">{i + 1}</span>
                <span className="flex-1 min-w-0 truncate font-semibold text-slate-900" title={it.name}>{it.name}</span>
                <span className="text-slate-500 font-mono shrink-0">{formatCartQty(it.quantity)} {it.unit}</span>
                <span className="w-20 text-right font-black font-mono text-slate-900 shrink-0">{formatINRCompact(it.amountPaise)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {owing.length > 0 && (
        <Link href="/khata" className="group rounded-2xl border border-slate-200 bg-white p-3 sm:p-3.5 shadow-2xs hover:border-rose-300 transition block" data-home-top-udhar>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-700">
              <BookOpen className="w-3.5 h-3.5 text-rose-500" />
              {tr('Highest udhar')}
            </div>
            <span className="text-rose-700 text-[11px] font-bold inline-flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              {tr('Khata')} <ArrowRight className="w-3 h-3" />
            </span>
          </div>
          <ol className="space-y-1.5">
            {owing.map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-xs">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-amber-400 font-black flex items-center justify-center shrink-0">{(c.name || '?').charAt(0).toUpperCase()}</span>
                <span className="flex-1 min-w-0 truncate font-semibold text-slate-900">{c.name}</span>
                <span className="text-slate-500 font-mono shrink-0">{c.phone || ''}</span>
                <span className="w-20 text-right font-black font-mono text-rose-600 shrink-0">{formatINRCompact(c.current_balance)}</span>
              </li>
            ))}
          </ol>
        </Link>
      )}
    </div>
  );
}
