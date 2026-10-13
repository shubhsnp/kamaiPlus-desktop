'use client';

import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ReceiptText } from 'lucide-react';
import { db } from '@/lib/db';
import { formatINR } from '@/lib/utils';
import { paymentMethodLabel, tr } from '@/lib/i18n/core';
import type { Sale } from '@/types';

/**
 * A restaurant bill is one whose note is its table / token ("Table T4", "Takeaway TA-07", "Delivery DL-02",
 * v4.161.0 "Token TK-04 · Dine-in" — settle.ts). Delivery bills were left out of Today's bills before v4.161.0.
 */
export const isRestaurantBill = (s: Pick<Sale, 'notes' | 'status'>): boolean =>
  s.status !== 'draft' && /^(Table|Takeaway|Delivery|Token) /.test(s.notes || '');

const startOfToday = (): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

/**
 * Today's paid bills on the Tables screen (v4.107.0): tap one to open it again — print it, save the
 * PDF or send it on WhatsApp, the same bill window as the counter's.
 */
export function RecentBills({ onOpen }: { onOpen: (sale: Sale) => void }) {
  const bills = useLiveQuery(async () => {
    const today = await db.sales.where('created_at').aboveOrEqual(startOfToday()).reverse().toArray();
    return today.filter(isRestaurantBill);
  }, []);
  if (!bills || bills.length === 0) return null;
  const total = bills.reduce((n, s) => n + (s.grand_total || 0), 0);

  return (
    <section aria-label={tr("Today's bills")} data-recent-bills>
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-500">{tr("Today's bills")}</h2>
        <span className="text-[11px] font-bold text-slate-500">{bills.length === 1 ? tr('1 bill') : tr('{count} bills', { count: bills.length })} · <span className="font-mono text-slate-800">{formatINR(total)}</span></span>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
        {bills.slice(0, 12).map((s) => (
          <button key={s.id} type="button" onClick={() => onOpen(s)} data-recent-bill={s.invoice_number}
            title={tr('Open the bill: print, PDF or WhatsApp')}
            className="shrink-0 w-[184px] text-left rounded-2xl border border-slate-200 bg-white hover:border-emerald-500 hover:bg-emerald-50/40 p-3 cursor-pointer transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-black text-slate-500"><ReceiptText className="w-3.5 h-3.5" />#{s.invoice_number}</span>
              <span className="text-[10.5px] font-bold text-slate-400">{new Date(s.created_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-1">
              <span className="text-xs font-bold text-slate-800 truncate">{s.customer_name}</span>
              {(s.staff_name || (s.created_by && s.created_by !== 'owner' && s.created_by !== 'system')) && (
                <span className="shrink-0 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-1 py-0.5">
                  👤 {s.staff_name || s.created_by}
                </span>
              )}
            </div>
            <div className="mt-1 flex items-end justify-between gap-2">
              <span className="text-base font-black font-mono text-slate-900">{formatINR(s.grand_total)}</span>
              <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5">{paymentMethodLabel(s.payment_method)}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
