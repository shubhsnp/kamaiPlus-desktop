'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, Download, FileSpreadsheet, Info } from 'lucide-react';
import { db } from '@/lib/db';
import { Business } from '@/types';
import { gstPeriodRange, GSTPeriodPreset } from '@/lib/gst/gstr1Json';
import { generateTallyPrimeXML } from '@/lib/tally/tallyXmlGenerator';
import { generateCASalesRegisterCSV } from '@/lib/tally/caExcelGenerator';
import { showAlert } from '@/lib/ui/dialogs';
import { useFeatureSwitches } from '@/lib/features/featureSwitches';
import { msg, tr } from '@/lib/i18n/core';

type ExportPeriod = GSTPeriodPreset | 'all';

const PERIODS: { id: ExportPeriod; label: string }[] = [
  { id: 'this_month', label: msg('This month') },
  { id: 'last_month', label: msg('Last month') },
  { id: 'q1', label: msg('Q1 (Apr–Jun)') },
  { id: 'q2', label: msg('Q2 (Jul–Sep)') },
  { id: 'q3', label: msg('Q3 (Oct–Dec)') },
  { id: 'q4', label: msg('Q4 (Jan–Mar)') },
  { id: 'all_year', label: msg('This financial year') },
  { id: 'all', label: msg('All bills') },
];

const ymd = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

function download(text: string, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Tally Prime XML and the CA sales register for a chosen period (v4.78.0 — before, every
 * bill ever made went into one file). Both use the same figures as the GSTR-1 file.
 */
export function AccountingExportsCard({ business }: { business?: Business | null }) {
  const switches = useFeatureSwitches();
  const [period, setPeriod] = useState<ExportPeriod>('this_month');
  const range = useMemo(() => (period === 'all' ? null : gstPeriodRange(period)), [period]);
  const periodName = range ? `${ymd(range.start)}-${ymd(range.end)}` : 'All';
  const billCount = useLiveQuery(
    () => (range ? db.sales.where('created_at').between(range.start.toISOString(), range.end.toISOString(), true, true).count() : db.sales.count()),
    [period]
  ) ?? 0;

  const load = async () => {
    const [sales, customers, returns] = await Promise.all([
      range ? db.sales.where('created_at').between(range.start.toISOString(), range.end.toISOString(), true, true).toArray() : db.sales.toArray(),
      db.customers.toArray(),
      db.sales_returns.toArray(),
    ]);
    // Goods returned in the period from bills of an earlier one: their credit notes need the bill.
    const known = new Set(sales.map((s) => s.id));
    const missing = Array.from(new Set(returns.filter((r) => !range || (r.created_at >= range.start.toISOString() && r.created_at <= range.end.toISOString())).map((r) => r.original_sale_id).filter((id) => !known.has(id))));
    const originals = (missing.length ? await db.sales.bulkGet(missing) : []).filter((s): s is NonNullable<typeof s> => Boolean(s));
    return { sales, customers, returns, originals };
  };

  const exportTally = async () => {
    const data = await load();
    const { xml, filename, count } = generateTallyPrimeXML({ business, ...data, periodName, range: range ? { start: range.start, end: range.end } : undefined });
    if (!count) return showAlert(tr('No bills to export in this period.'));
    download(xml, 'application/xml;charset=utf-8', filename);
  };

  const exportCa = async () => {
    const data = await load();
    const { csv, filename, count } = generateCASalesRegisterCSV({ business, ...data, periodName });
    if (!count) return showAlert(tr('No bills to export in this period.'));
    download(csv, 'text/csv;charset=utf-8', filename);
  };

  return (
    <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-3" data-accounting-exports>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs">
          <span className="font-bold text-slate-700">{tr('Period')}</span>
          <select value={period} onChange={(e) => setPeriod(e.target.value as ExportPeriod)} className="h-8 px-2 rounded-lg border border-slate-300 bg-white font-bold" data-export-period>
            {PERIODS.map((p) => <option key={p.id} value={p.id}>{tr(p.label)}</option>)}
          </select>
        </label>
        <span className="text-[11px] text-slate-500 font-mono">
          {range ? `${range.start.toLocaleDateString('en-IN')} – ${range.end.toLocaleDateString('en-IN')}` : tr('All bills')} • {tr('{count} bills', { count: billCount })}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="p-3 rounded-xl border border-amber-300/80 bg-amber-50/60 space-y-2">
          <div>
            <h3 className="text-xs font-black text-slate-900">{tr('Tally Prime XML')}</h3>
            <p className="text-[10.5px] text-slate-600">{tr('Sales vouchers: cash / UPI-card / udhar, CGST + SGST or IGST. Balanced to the paisa.')}</p>
          </div>
          <button type="button" disabled={!billCount} onClick={() => void exportTally()} className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer disabled:opacity-40" data-export-tally>
            <Download className="w-3.5 h-3.5 text-amber-400" /> {tr('Export Tally XML')}
          </button>
          <p className="flex gap-1 text-[10px] text-slate-600">
            <Info className="w-3 h-3 shrink-0 mt-0.5" />
            {tr('In Tally Prime: Import → Masters, then Import → Transactions — choose this file both times.')}
          </p>
        </div>
        <div className="p-3 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-2">
          <div>
            <h3 className="text-xs font-black text-slate-900">{tr('CA Master Sales Register')}</h3>
            <p className="text-[10.5px] text-slate-600">{tr('One row per bill: buyer GSTIN, place of supply, taxable value, GST, returns and payment — opens in Excel.')}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" disabled={!billCount} onClick={() => void exportCa()} className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer disabled:opacity-40" data-export-ca>
              <FileSpreadsheet className="w-3.5 h-3.5" /> {tr('Export CSV')}
            </button>
            {switches.gst_reports && <Link href="/gst-reports" className="flex-1 inline-flex items-center justify-center gap-1 h-8 rounded-lg border border-indigo-200 text-indigo-900 hover:bg-indigo-50 font-bold text-xs">
              {tr('GSTR-1 Hub')} <ArrowRight className="w-3 h-3" />
            </Link>}
          </div>
        </div>
      </div>
    </div>
  );
}
