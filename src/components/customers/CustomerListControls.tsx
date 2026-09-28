'use client';

import React, { useState } from 'react';
import { FileSpreadsheet, FileText, LayoutGrid, List, RefreshCw } from 'lucide-react';
import { Customer } from '@/types';
import { cn } from '@/lib/utils';
import { getDesktopApi } from '@/lib/desktop/desktopBridge';
import { customerListHtmlBody, customerSheetRows, CustomerSort, CustomerView } from '@/lib/customers/customerDirectory';
import { showAlert } from '@/lib/ui/dialogs';
import { msg, tr } from '@/lib/i18n/core';

const SORTS: { id: CustomerSort; label: string }[] = [
  { id: 'due', label: msg('Most udhar first') },
  { id: 'name', label: msg('Name A–Z') },
  { id: 'spent', label: msg('Most bought') },
  { id: 'recent', label: msg('Latest visit') },
];

const today = () => new Date().toISOString().slice(0, 10);

interface CustomerListControlsProps {
  /** The list exactly as shown (search, filter and sort applied) — that is what gets exported. */
  customers: Customer[];
  view: CustomerView;
  onViewChange: (v: CustomerView) => void;
  sort: CustomerSort;
  onSortChange: (s: CustomerSort) => void;
  shopName: string;
  /** e.g. "All customers", "Udhar due" — printed on the PDF. */
  filterLabel: string;
}

/** Grid / list, sort order, and export of the shown list to Excel or PDF (v4.78.0). */
export function CustomerListControls({ customers, view, onViewChange, sort, onSortChange, shopName, filterLabel }: CustomerListControlsProps) {
  const [busy, setBusy] = useState<'' | 'excel' | 'pdf'>('');
  const [saved, setSaved] = useState<{ path?: string } | null>(null);

  const exportExcel = async () => {
    setBusy('excel');
    try {
      const XLSX = await import('xlsx');
      const sheet = XLSX.utils.aoa_to_sheet(customerSheetRows(customers));
      sheet['!cols'] = [28, 14, 24, 32, 18, 10, 12, 10, 16, 8, 12, 12, 12, 12].map((wch) => ({ wch }));
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, 'Customers');
      XLSX.writeFile(book, `Customers_${today()}.xlsx`);
    } catch (err: any) {
      showAlert(tr('Could not export: {error}', { error: err?.message || '' }));
    } finally {
      setBusy('');
    }
  };

  const exportPdf = async () => {
    setBusy('pdf');
    setSaved(null);
    try {
      const { buildPrintHtml, FLOWING_A4_CSS, saveHtmlAsPdf } = await import('@/lib/print/printDocument');
      const body = customerListHtmlBody(customers, { shopName, view: filterLabel, printedOn: new Date().toLocaleString('en-IN') });
      const res = await saveHtmlAsPdf(buildPrintHtml(body, 'Customer List', 'a4', FLOWING_A4_CSS), `Customers_${today()}.pdf`, 'Reports');
      if (!res.ok) showAlert(tr('Could not export: {error}', { error: res.error || '' }));
      else if (res.method === 'desktop') setSaved({ path: res.path });
    } finally {
      setBusy('');
    }
  };

  const desktop = getDesktopApi();
  const btn = 'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-bold cursor-pointer disabled:opacity-50';

  return (
    <div className="flex flex-wrap items-center justify-between gap-2" data-customer-controls>
      <div className="flex items-center gap-2">
        <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
          {([['grid', LayoutGrid, msg('Grid')], ['list', List, msg('List')]] as [CustomerView, typeof List, string][]).map(([id, Icon, label]) => (
            <button key={id} type="button" onClick={() => onViewChange(id)} className={cn('inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-bold cursor-pointer', view === id ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs' : 'text-slate-500')} data-customer-view={id}>
              <Icon className="w-3.5 h-3.5" /> {tr(label)}
            </button>
          ))}
        </div>
        <select value={sort} onChange={(e) => onSortChange(e.target.value as CustomerSort)} className="h-8 px-2 rounded-lg border border-slate-300 bg-white dark:bg-slate-900 text-xs font-bold" data-customer-sort>
          {SORTS.map((s) => <option key={s.id} value={s.id}>{tr(s.label)}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-1.5">
        {saved?.path && desktop && (
          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-800" data-customer-pdf-saved>
            {tr('PDF saved')}
            <button type="button" onClick={() => desktop.openPath(saved.path!)} className="px-2 py-0.5 rounded bg-white border border-emerald-300 cursor-pointer">{tr('Open')}</button>
            <button type="button" onClick={() => desktop.showItemInFolder(saved.path!)} className="px-2 py-0.5 rounded bg-white border border-emerald-300 cursor-pointer">{tr('Show in folder')}</button>
          </span>
        )}
        <button type="button" disabled={Boolean(busy) || customers.length === 0} onClick={() => void exportExcel()} className={`${btn} border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100`} data-customer-export-excel>
          {busy === 'excel' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />} {tr('Excel')}
        </button>
        <button type="button" disabled={Boolean(busy) || customers.length === 0} onClick={() => void exportPdf()} className={`${btn} border-slate-300 bg-white hover:bg-slate-50`} data-customer-export-pdf>
          {busy === 'pdf' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />} {tr('PDF')}
        </button>
      </div>
    </div>
  );
}
