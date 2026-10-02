'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Receipt,
  RotateCcw,
  Download,
  Trash2,
  FileText,
  MoreHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { tr } from '@/lib/i18n/core';

interface TransactionHeaderActionsProps {
  filteredCount: number;
  totalSalesCount: number;
  onOpenSalesReturn: () => void;
  onExportCSV: () => void;
  onExportTallyXML: () => void;
  onBulkDownloadInvoices?: () => void;
  onOpenClearHistory: () => void;
}

export const TransactionHeaderActions: React.FC<TransactionHeaderActionsProps> = ({
  filteredCount,
  totalSalesCount,
  onOpenSalesReturn,
  onExportCSV,
  onExportTallyXML,
  onBulkDownloadInvoices,
  onOpenClearHistory,
}) => {
  // v4.93.0: "delete all bills" sat as a red icon right next to the exports — one slip away.
  // It now lives in the "⋯" menu (the confirm window behind it is unchanged). The menu is
  // fixed-positioned: the button row scrolls sideways on a narrow window and would clip it.
  const [menuAt, setMenuAt] = useState<{ top: number; right: number } | null>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuAt) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      if (e.type === 'mousedown' && moreRef.current?.contains(e.target as Node)) return;
      setMenuAt(null);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', close);
      window.removeEventListener('resize', close);
    };
  }, [menuAt]);

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs">
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
          <Receipt className="w-5 h-5 text-slate-800 dark:text-slate-200 shrink-0" />
          <span>{tr('Transactions')}</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {tr('Audit history, reprint thermal bills, customer khata credit tracking, and 1-click Tally export.')}
        </p>
      </div>

      {/* Action Buttons Row */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap overflow-x-auto pb-0.5 lg:pb-0">
        {/* Sales Return */}
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenSalesReturn}
          className="text-xs font-bold gap-1.5 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-900 dark:text-amber-200 cursor-pointer whitespace-nowrap shrink-0 rounded-xl"
        >
          <RotateCcw className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
          <span>{tr('Sales Return')}</span>
        </Button>

        {/* Export CSV */}
        <Button
          variant="outline"
          size="sm"
          onClick={onExportCSV}
          className="text-xs font-bold gap-1.5 whitespace-nowrap shrink-0 rounded-xl border-slate-200 dark:border-slate-700"
          disabled={filteredCount === 0}
        >
          <Download className="w-3.5 h-3.5" />
          <span>{tr('Export CSV')}</span>
        </Button>

        {/* Bulk Invoices PDF */}
        {onBulkDownloadInvoices && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBulkDownloadInvoices}
            className="text-xs font-bold gap-1.5 whitespace-nowrap shrink-0 rounded-xl border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-50 text-slate-800"
            disabled={filteredCount === 0}
            title={tr('Download continuous consolidated PDF of all filtered invoices')}
          >
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            <span>{tr('Bulk Invoices PDF')}</span>
          </Button>
        )}

        {/* Tally Prime XML — an export like the others (it was the loud yellow button; the
            counter's everyday work is search and returns, not Tally). */}
        <Button
          variant="outline"
          size="sm"
          onClick={onExportTallyXML}
          className="text-xs font-bold gap-1.5 whitespace-nowrap shrink-0 rounded-xl border-slate-200 dark:border-slate-700"
          disabled={filteredCount === 0}
        >
          <Download className="w-3.5 h-3.5" />
          <span>{tr('Tally Prime XML')}</span>
        </Button>

        {/* More: Delete / reset all history */}
        {totalSalesCount > 0 && (
          <div ref={moreRef} className="shrink-0" data-transactions-more>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                if (menuAt) return setMenuAt(null);
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setMenuAt({ top: r.bottom + 4, right: window.innerWidth - r.right });
              }}
              aria-expanded={Boolean(menuAt)}
              aria-label={tr('More')}
              title={tr('More')}
              className="text-xs font-bold px-2.5 shrink-0 rounded-xl border-slate-200 dark:border-slate-700"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
            {menuAt && (
              <div className="fixed z-50 w-64 rounded-xl border border-slate-200 bg-white shadow-xl p-1" style={{ top: menuAt.top, right: menuAt.right }} role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuAt(null);
                    onOpenClearHistory();
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                  data-transactions-clear-history
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{tr('Delete / Reset All Transaction History')}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
