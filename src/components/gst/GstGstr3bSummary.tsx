'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { ProfitMask } from '@/components/privacy/ProfitMask';
import type { Gstr3bSummary } from '@/lib/gst/gstr3b';
import { formatINR } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';

/**
 * GSTR-3B tab of the GST screen (v4.101.0, K-D22): the outward-tax tables of the monthly
 * return, from the same bills and credit notes as GSTR-1. Input tax credit comes from GSTR-2B
 * on the portal; e-invoice and e-way bill are not in the app.
 */
export function GstGstr3bSummary({ summary }: { summary: Gstr3bSummary }) {
  const o = summary.outwardTaxable;
  const row = (label: string, cells: (number | null)[], strong = false) => (
    <tr className={strong ? 'font-black' : ''}>
      <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{label}</td>
      {cells.map((c, i) => (
        <td key={i} className="py-2 pl-3 text-right font-mono">{c === null ? '—' : <ProfitMask value={formatINR(c)} />}</td>
      ))}
    </tr>
  );
  return (
    <Card className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xs space-y-3" data-gst-3b>
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">{tr('GSTR-3B: tax on your sales')}</h3>
        <span className="text-xs font-mono text-slate-400">{tr('{count} bills', { count: summary.bills })}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10.5px] uppercase tracking-wide text-slate-500">
              <th className="text-left font-bold pb-2">{tr('Table')}</th>
              <th className="text-right font-bold pb-2 pl-3">{tr('Taxable value')}</th>
              <th className="text-right font-bold pb-2 pl-3">IGST</th>
              <th className="text-right font-bold pb-2 pl-3">CGST</th>
              <th className="text-right font-bold pb-2 pl-3">SGST</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {row(tr('3.1 (a) Outward taxable supplies'), [o.taxable, o.igst, o.cgst, o.sgst], true)}
            {row(tr('3.1 (c) Nil rated and exempted'), [summary.nilExempt, null, null, null])}
            {row(tr('Tax payable before input tax credit'), [null, o.igst, o.cgst, o.sgst], true)}
          </tbody>
        </table>
      </div>
      {summary.creditNotes.count > 0 && (
        <p className="text-[11px] text-slate-500">
          {tr('Includes {count} credit notes (goods returned this period): taxable −{taxable}, tax −{tax}.', { count: summary.creditNotes.count, taxable: formatINR(summary.creditNotes.taxable), tax: formatINR(summary.creditNotes.tax) })}
        </p>
      )}
      <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
        {tr('Input tax credit (table 4) is not worked out here: take it from GSTR-2B on the GST portal, which fills it for you. Check the figures with your CA before filing.')}
      </p>
    </Card>
  );
}
