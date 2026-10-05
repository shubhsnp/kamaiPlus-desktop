'use client';

import React from 'react';
import type { CreditNoteRecord } from '@/lib/gst/gstr1Generator';
import { ProfitMask } from '@/components/privacy/ProfitMask';
import { formatINR } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';

/**
 * GSTR-1 table 9B on the GST screen (v4.101.0, K-D04): goods returned in this period by
 * registered (GSTIN) buyers, one row per credit note and GST rate. The bills they came from
 * stay in table 4 as issued; B2C returns lower the B2C rows instead.
 */
export function GstCreditNotes({ notes }: { notes: CreditNoteRecord[] }) {
  if (notes.length === 0) return null;
  return (
    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2" data-gst-credit-notes>
      <h4 className="text-xs font-black text-slate-900 dark:text-slate-100">{tr('Table 9B: Credit notes (returns by GSTIN buyers)')}</h4>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {notes.map((n, idx) => (
          <div key={`${n.note_number}-${n.tax_rate}-${idx}`} className="py-2 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">{n.customer_name || tr('B2B Client')}</span>
                <span className="px-1.5 rounded text-[10.5px] font-black uppercase bg-rose-50 text-rose-700 border border-rose-200">{n.customer_gstin}</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 truncate font-mono">
                {tr('Credit note {note} • {date} • against {invoice}', { note: n.note_number, date: n.note_date, invoice: n.invoice_number })}
              </div>
            </div>
            <div className="text-right shrink-0 font-mono">
              <div className="text-xs font-black text-rose-700">
                −<ProfitMask value={formatINR(n.taxable_value)} />
              </div>
              <div className="text-[10px] text-rose-600">
                {tr('Tax:')} −{formatINR(n.cgst_amount + n.sgst_amount + n.igst_amount)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
