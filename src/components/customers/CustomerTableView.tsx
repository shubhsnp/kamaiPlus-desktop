'use client';

import React from 'react';
import Link from 'next/link';
import { BookOpen, Edit3, Star } from 'lucide-react';
import { Customer } from '@/types';
import { cn, formatINR } from '@/lib/utils';
import { balanceKind, shortDate } from '@/lib/customers/customerDirectory';
import { msg, tr } from '@/lib/i18n/core';
import { WhatsAppButton } from '@/components/whatsapp/WhatsAppButton';
import { useFeatureSwitches } from '@/lib/features/featureSwitches';

const TYPE_LABEL: Record<string, string> = { new: msg('New'), regular: msg('Regular'), inactive: msg('Inactive'), credit: msg('Credit') };

/** Customer Directory as a list (v4.78.0): one row per customer, sortable columns shown by the page's sort. */
export function CustomerTableView({ customers, onEditCustomer }: { customers: Customer[]; onEditCustomer: (c: Customer) => void }) {
  const khataOn = useFeatureSwitches().khata; // Settings → Features: no "Khata" link when switched off
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-x-auto" data-customer-table>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/60 text-[10.5px] uppercase tracking-wide text-slate-500 border-b border-slate-200 dark:border-slate-800">
            <th className="text-left px-3 py-2.5 font-black">{tr('Customer')}</th>
            <th className="text-left px-3 py-2.5 font-black">{tr('Mobile')}</th>
            <th className="text-left px-3 py-2.5 font-black">{tr('Type')}</th>
            <th className="text-right px-3 py-2.5 font-black">{tr('Balance')}</th>
            <th className="text-right px-3 py-2.5 font-black">{tr('Total bought')}</th>
            <th className="text-right px-3 py-2.5 font-black">{tr('Visits')}</th>
            <th className="text-left px-3 py-2.5 font-black">{tr('Last visit')}</th>
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {customers.map((c) => {
            const kind = balanceKind(c);
            return (
              <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40" data-customer-row>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center font-black text-[11px] shrink-0',
                      c.customer_type === 'vip' ? 'bg-amber-100 text-amber-900' : kind === 'Udhar' ? 'bg-rose-100 text-rose-900' : 'bg-sky-100 text-sky-900')}>
                      {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-bold text-slate-900 dark:text-slate-100 truncate max-w-[16rem]">{c.name}</span>
                      {c.gstin && <span className="block text-[10px] font-mono text-indigo-600 truncate">GSTIN {c.gstin}</span>}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">{c.phone || '—'}</td>
                <td className="px-3 py-2">
                  {c.customer_type === 'vip' ? (
                    <span className="inline-flex items-center gap-0.5 px-1.5 rounded bg-amber-100 text-amber-900 font-black text-[10px]"><Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />VIP</span>
                  ) : (
                    <span className="text-slate-500">{tr(TYPE_LABEL[c.customer_type] || TYPE_LABEL.regular)}</span>
                  )}
                </td>
                <td className={cn('px-3 py-2 text-right font-mono font-black whitespace-nowrap', kind === 'Udhar' ? 'text-rose-600' : kind === 'Advance' ? 'text-emerald-600' : 'text-slate-400')}>
                  {kind === 'Udhar' ? tr('{v1} (Udhar)', { v1: formatINR(c.current_balance) }) : kind === 'Advance' ? tr('{v1} (Advance)', { v1: formatINR(Math.abs(c.current_balance)) }) : '—'}
                </td>
                <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatINR(c.total_spent || 0)}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">{c.total_visits || 0}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">{shortDate(c.last_visit_date) || '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    {c.phone && <WhatsAppButton variant="icon" request={{ kind: 'customer', customerId: c.id }} />}
                    {khataOn && <Link href={`/khata?search=${encodeURIComponent(c.phone || c.name)}`} className="inline-flex items-center gap-1 h-7 px-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 font-bold text-[11px] hover:bg-amber-100" title={tr('Khata')}>
                      <BookOpen className="w-3 h-3" /> {tr('Khata')}
                    </Link>}
                    <button type="button" onClick={() => onEditCustomer(c)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer" title={tr('Edit Customer Profile')}>
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
