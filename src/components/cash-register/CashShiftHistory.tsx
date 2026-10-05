'use client';

import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { History } from 'lucide-react';
import { db } from '@/lib/db';
import { Card } from '@/components/ui/Card';
import { formatINR } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import type { CashRegister } from '@/types';

/** How many closed shifts the list shows. */
export const SHIFT_HISTORY_LIMIT = 30;

/** "Exact", "₹20 short" or "₹15 extra" for a closed shift (difference = counted − expected). */
export function shiftDifferenceLabel(differencePaise: number | undefined): { text: string; tone: 'ok' | 'short' | 'extra' } {
  const d = Math.round(differencePaise || 0);
  if (d === 0) return { text: tr('Exact'), tone: 'ok' };
  return d < 0 ? { text: tr('{amount} short', { amount: formatINR(-d) }), tone: 'short' } : { text: tr('{amount} extra', { amount: formatINR(d) }), tone: 'extra' };
}

/**
 * Past drawer shifts on the Cash Register (v4.102.0, tracker K-D02): the last closed shifts with
 * the opening float, cash expected and counted, and whether it matched. Before, a closed shift
 * could not be seen again.
 */
export function CashShiftHistory() {
  const shifts = useLiveQuery(
    async () => (await db.cash_registers.where('status').equals('closed').toArray())
      .sort((a, b) => (b.closed_at || b.opened_at).localeCompare(a.closed_at || a.opened_at))
      .slice(0, SHIFT_HISTORY_LIMIT),
    []
  ) || [];
  if (shifts.length === 0) return null;
  const when = (s: CashRegister) => {
    const d = new Date(s.closed_at || s.opened_at);
    return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}, ${new Date(s.opened_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} – ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
  };
  return (
    <Card className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xs space-y-3" data-cash-shift-history>
      <div className="flex items-center gap-2">
        <History className="w-4 h-4 text-slate-500" />
        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">{tr('Past shifts')}</h3>
        <span className="text-[11px] text-slate-400">{tr('last {count}', { count: shifts.length })}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10.5px] uppercase tracking-wide text-slate-500 text-right">
              <th className="text-left font-bold pb-2">{tr('Shift')}</th>
              <th className="font-bold pb-2 pl-3">{tr('Opening Float')}</th>
              <th className="font-bold pb-2 pl-3">{tr('Expected Cash')}</th>
              <th className="font-bold pb-2 pl-3">{tr('Counted')}</th>
              <th className="font-bold pb-2 pl-3">{tr('Difference')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
            {shifts.map((s) => {
              const diff = shiftDifferenceLabel(s.difference);
              return (
                <tr key={s.id} className="text-right">
                  <td className="py-2 text-left font-sans text-slate-700 dark:text-slate-300">{when(s)}</td>
                  <td className="py-2 pl-3">{formatINR(s.opening_cash || 0)}</td>
                  <td className="py-2 pl-3">{formatINR(s.expected_closing_cash || 0)}</td>
                  <td className="py-2 pl-3">{s.actual_closing_cash == null ? '—' : formatINR(s.actual_closing_cash)}</td>
                  <td className={`py-2 pl-3 font-bold ${diff.tone === 'ok' ? 'text-emerald-700' : diff.tone === 'short' ? 'text-rose-700' : 'text-amber-700'}`}>{diff.text}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
