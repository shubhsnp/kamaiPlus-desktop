'use client';

import React from 'react';
import { 
  Building2, 
  FileSpreadsheet, 
  Download, 
  Code, 
  HelpCircle, 
  Calendar 
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { GSTPeriodPreset } from '@/lib/gst/gstr1Json';
import { cn } from '@/lib/utils';
import { CashierPrivacyToggleButton } from '@/components/privacy/ProfitMask';
import { tr } from '@/lib/i18n/core';

const dayLabel = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

interface GstHeaderActionsProps {
  periodPreset: GSTPeriodPreset;
  periodStart: Date;
  periodEnd: Date;
  /** GSTR-1 return period "MMYYYY", or null for a full year. */
  returnPeriod: string | null;
  onPeriodChange: (p: GSTPeriodPreset) => void;
  onExportCsv: () => void;
  onExportTally: () => void;
  onExportJson: () => void;
  onOpenTallyGuide: () => void;
}

export const GstHeaderActions: React.FC<GstHeaderActionsProps> = ({
  periodPreset,
  periodStart,
  periodEnd,
  returnPeriod,
  onPeriodChange,
  onExportCsv,
  onExportTally,
  onExportJson,
  onOpenTallyGuide,
}) => {
  const presets: { id: GSTPeriodPreset; label: string }[] = [
    { id: 'this_month', label: tr('⚡ This Month') },
    { id: 'last_month', label: tr('⏪ Last Month') },
    { id: 'q1', label: tr('Q1 (Apr-Jun)') },
    { id: 'q2', label: tr('Q2 (Jul-Sep)') },
    { id: 'q3', label: tr('Q3 (Oct-Dec)') },
    { id: 'q4', label: tr('Q4 (Jan-Mar)') },
    { id: 'all_year', label: tr('Financial Year') },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-3">
      {/* Top Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 flex items-center justify-center font-bold shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
                {tr('GST Reports & CA Tax Filing')}
              </h1>
              <CashierPrivacyToggleButton />
            </div>
            <p className="text-[10.5px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
              {tr('GSTR-1, HSN summary, B2B wholesale register & 1-click Tally Prime XML export')}
            </p>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-1.5 self-start sm:self-center shrink-0 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={onExportCsv}
            className="text-xs font-bold gap-1 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer shadow-2xs"
            title={tr('Download CA Excel Sales Register')}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>{tr('CA Excel (CSV)')}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onExportTally}
            className="text-xs font-bold gap-1 rounded-xl border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 cursor-pointer shadow-2xs"
            title={tr('Export Tally Prime XML')}
          >
            <Code className="w-3.5 h-3.5 text-amber-600" />
            <span>{tr('Tally XML')}</span>
          </Button>

          <Button
            size="sm"
            onClick={onExportJson}
            className="font-black bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 hover:bg-slate-800 text-xs px-3.5 py-1.5 shadow-2xs cursor-pointer gap-1.5 rounded-xl"
            title={tr('Download GST Portal Offline JSON')}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{tr('GSTR-1 JSON')}</span>
          </Button>
        </div>
      </div>

      {/* Period Selector Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none select-none pt-1 border-t border-slate-100 dark:border-slate-800">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPeriodChange(p.id)}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap",
              periodPreset === p.id
                ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 shadow-2xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <Calendar className="w-3.5 h-3.5 text-slate-400" />
        <span className="font-semibold text-slate-700 dark:text-slate-200">{dayLabel(periodStart)} – {dayLabel(periodEnd)}</span>
        <span>•</span>
        {returnPeriod ? (
          <span>{tr('GSTR-1 JSON period: {fp}', { fp: `${returnPeriod.slice(0, 2)}/${returnPeriod.slice(2)}` })}</span>
        ) : (
          <span>{tr('For the GSTR-1 JSON choose a month or a quarter')}</span>
        )}
      </p>
    </div>
  );
};
