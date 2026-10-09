'use client';

import React, { useMemo } from 'react';
import { CalendarClock } from 'lucide-react';
import type { Product } from '@/types';
import { tr } from '@/lib/i18n/core';
import { useFeatureSwitches } from '@/lib/features/featureSwitches';
import { expiryState, formatExpiry } from '@/lib/products/expiry';

/**
 * Inventory: medicines past their expiry or expiring within 90 days (v4.126.0, AU-22). Shown only
 * when the shop keeps batch / expiry (pharmacy), and only when there is something to act on.
 */
export function ExpiryAlertsCard({ products }: { products: Product[] }) {
  const on = useFeatureSwitches().product_batch_expiry;
  const rows = useMemo(() => {
    if (!on) return [];
    const now = new Date();
    return products
      .map((p) => ({ p, state: expiryState(p.expiry_date, now) }))
      .filter((r) => r.state === 'expired' || r.state === 'soon')
      .sort((a, b) => String(a.p.expiry_date).localeCompare(String(b.p.expiry_date)));
  }, [on, products]);
  if (!on || rows.length === 0) return null;
  const expired = rows.filter((r) => r.state === 'expired').length;
  return (
    <div className="bg-white border border-amber-200 rounded-2xl p-4 shadow-sm" data-expiry-alerts>
      <div className="flex items-center gap-2 mb-2">
        <CalendarClock className="w-4 h-4 text-amber-600" />
        <h3 className="text-sm font-black text-slate-900">{tr('Medicines expired or expiring in 90 days')}</h3>
        <span className="ml-auto text-[11px] font-bold text-rose-700">{expired > 0 ? tr('{n} expired', { n: expired }) : ''}</span>
      </div>
      <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
        {rows.map(({ p, state }) => (
          <div key={p.id} className="flex items-center gap-3 py-1.5 text-xs">
            <span className="flex-1 min-w-0 truncate font-semibold text-slate-800">{p.name}</span>
            {p.batch_number && <span className="font-mono text-slate-500">{tr('Batch {batch}', { batch: p.batch_number })}</span>}
            <span className={`font-mono font-bold ${state === 'expired' ? 'text-rose-700' : 'text-amber-700'}`}>
              {state === 'expired' ? tr('Expired') : tr('Expiring soon')} · {formatExpiry(p.expiry_date)}
            </span>
            <span className="font-mono text-slate-500 w-12 text-right">{p.is_unlimited_stock ? '∞' : p.current_stock}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
