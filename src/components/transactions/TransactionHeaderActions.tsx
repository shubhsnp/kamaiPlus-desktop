'use client';

import React from 'react';
import { 
  Receipt, 
  RotateCcw, 
  Download, 
  Trash2,
  FileText
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

        {/* Tally Prime XML */}
        <Button
          size="sm"
          onClick={onExportTallyXML}
          className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs gap-1.5 shadow-2xs cursor-pointer whitespace-nowrap shrink-0 rounded-xl"
          disabled={filteredCount === 0}
        >
          <Download className="w-3.5 h-3.5 text-slate-950" />
          <span>{tr('Tally Prime XML')}</span>
        </Button>

        {/* Clear History */}
        {totalSalesCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenClearHistory}
            className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900 px-2.5 shrink-0 rounded-xl"
            title={tr('Delete / Reset All Transaction History')}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
};
