'use client';

import React, { useMemo, useState } from 'react';
import { ImportPlan, ImportRow } from '@/lib/import/catalogImport';
import { cn, formatINR } from '@/lib/utils';
import { msg, tr } from '@/lib/i18n/core';

type Tab = 'new' | 'updated' | 'same' | 'skipped';
const TABS: { id: Tab; label: string; tone: string }[] = [
  { id: 'new', label: msg('New items'), tone: 'bg-emerald-100 text-emerald-800' },
  { id: 'updated', label: msg('Updated'), tone: 'bg-sky-100 text-sky-800' },
  { id: 'same', label: msg('No change'), tone: 'bg-slate-100 text-slate-700' },
  { id: 'skipped', label: msg('Skipped'), tone: 'bg-rose-100 text-rose-800' },
];
const SHOW = 150;

/** Step 3 of the Excel import: what will be added, changed, left alone or skipped — before anything is saved. */
export function ImportPreview({ plan }: { plan: ImportPlan }) {
  const counts: Record<Tab, number> = { new: plan.creates.length, updated: plan.updates.length, same: plan.unchanged.length, skipped: plan.skipped.length };
  const [tab, setTab] = useState<Tab>(() => (TABS.find((t) => counts[t.id] > 0)?.id || 'new'));

  const lines = useMemo(() => {
    if (tab === 'updated') {
      return plan.updates.map((u) => ({ row: u.row, before: u.product.selling_price, barcode: u.product.barcode || u.row.barcode, note: u.changes.map((c) => tr(c)).join(', ') }));
    }
    const rows: ImportRow[] = tab === 'new' ? plan.creates : tab === 'same' ? plan.unchanged : plan.skipped;
    return rows.map((row) => ({ row, before: undefined as number | undefined, barcode: row.barcode, note: row.skip ? tr(row.skip) : '' }));
  }, [plan, tab]);

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-black border cursor-pointer',
              tab === t.id ? 'border-slate-900 ring-1 ring-slate-900' : 'border-transparent',
              t.tone
            )}
          >
            {tr(t.label)} · <span data-import-count={t.id}>{counts[t.id]}</span>
          </button>
        ))}
      </div>

      <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-[42vh] overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold sticky top-0">
            <tr>
              <th className="p-2 w-14">{tr('Row')}</th>
              <th className="p-2">{tr('Item name')}</th>
              <th className="p-2">{tr('Category')}</th>
              <th className="p-2 text-right">{tr('Price')}</th>
              <th className="p-2">{tr('Barcode')}</th>
              {(tab === 'updated' || tab === 'skipped') && <th className="p-2">{tab === 'updated' ? tr('Changes') : tr('Why')}</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.slice(0, SHOW).map(({ row, before, barcode, note }) => (
              <tr key={row.rowNumber} className="hover:bg-slate-50">
                <td className="p-2 font-mono text-slate-400">{row.rowNumber}</td>
                <td className="p-2 font-bold text-slate-900">{row.name || '—'}</td>
                <td className="p-2 text-slate-600">{row.category || tr('General')}</td>
                <td className="p-2 text-right font-mono whitespace-nowrap">
                  {before !== undefined && before !== row.pricePaise && <span className="text-slate-400 line-through mr-1">{formatINR(before)}</span>}
                  {row.pricePaise !== null ? <span className="font-bold text-slate-900">{formatINR(row.pricePaise)}</span> : '—'}
                </td>
                <td className="p-2 font-mono text-slate-500">{barcode || (tab === 'new' ? <span className="text-emerald-700">{tr('new code')}</span> : '—')}</td>
                {(tab === 'updated' || tab === 'skipped') && <td className="p-2 text-slate-600">{note}</td>}
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400">{tr('Nothing here.')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {lines.length > SHOW && (
        <p className="text-[11px] text-slate-400 text-center">{tr('Showing the first {shown} of {total}.', { shown: SHOW, total: lines.length })}</p>
      )}
    </div>
  );
}
