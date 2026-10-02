'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Boxes, Calculator, Plus, ArrowRight, Printer, ScanLine } from 'lucide-react';
import { msg, tr } from '@/lib/i18n/core';
import { useFeatureSwitches } from '@/lib/features/featureSwitches';
import { HomeAction, QuickActionId, quickActionsFor } from '@/lib/dashboard/homeTiles';
import { getPrintSettings, printerForFormat } from '@/lib/hardware/printSettings';

interface QuickActionDockProps {
  onOpenClosingReport: () => void;
  onOpenFastInward: () => void;
  onOpenPrinters: () => void;
}

const LOOK: Record<Exclude<QuickActionId, 'new_bill'>, { icon: React.ElementType; title: string; subtitle: string; border: string; chip: string }> = {
  khata: { icon: BookOpen, title: msg('Khata Ledger'), subtitle: msg('Customer Udhar'), border: 'border-indigo-200/80 dark:border-indigo-900/60', chip: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' },
  stock_inward: { icon: Boxes, title: msg('Stock Inward'), subtitle: msg('Bills & Restock'), border: 'border-blue-200/80 dark:border-blue-900/60', chip: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  fast_inward: { icon: ScanLine, title: msg('Fast barcode inward'), subtitle: msg('Scan new stock in'), border: 'border-blue-200/80 dark:border-blue-900/60', chip: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  day_summary: { icon: Calculator, title: msg('Day Summary'), subtitle: msg('Shift Z-Report'), border: 'border-emerald-200/80 dark:border-emerald-900/60', chip: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  printers: { icon: Printer, title: msg('Printer setup'), subtitle: msg('Bill & label printer'), border: 'border-slate-300/80 dark:border-slate-700', chip: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700' },
};

/** The printer bills go to, for the Printer tile ('' = Windows default). */
function useBillPrinterName(): string {
  const [name, setName] = useState('');
  useEffect(() => {
    const read = () => {
      const s = getPrintSettings();
      setName(printerForFormat(s, s.defaultFormat));
    };
    read();
    window.addEventListener('print_settings_changed', read);
    return () => window.removeEventListener('print_settings_changed', read);
  }, []);
  return name;
}

/**
 * 1-tap actions on Home (v4.78.0: built from a list). A screen switched off in Settings →
 * Features is swapped for a tile that does its job, and the tiles grow to fill the row, so
 * there is never an empty slot.
 */
export const QuickActionDock: React.FC<QuickActionDockProps> = ({ onOpenClosingReport, onOpenFastInward, onOpenPrinters }) => {
  const actions = quickActionsFor(useFeatureSwitches());
  const billPrinter = useBillPrinterName();
  const run: Record<HomeAction, () => void> = { day_summary: onOpenClosingReport, fast_inward: onOpenFastInward, printers: onOpenPrinters };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span>{tr('⚡ 1-Tap Quick Actions')}</span>
        </h2>
      </div>

      <div className="flex flex-wrap gap-2.5 sm:gap-3">
        {actions.map((a) => {
          if (a.id === 'new_bill') {
            return (
              <Link key={a.id} href={a.href || '/billing'} className="group grow-[1.6] basis-56 min-w-0" data-home-action={a.id}>
                <div className="h-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 hover:from-amber-500 hover:to-amber-600 text-slate-950 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-2.5 shadow-md shadow-amber-500/20 active:scale-[0.98] transition-all cursor-pointer border border-amber-300">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center font-black shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                      <Plus className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-black truncate leading-tight">{tr('+ New Bill (POS)')}</div>
                      <div className="text-[10.5px] font-bold text-slate-900/80 truncate mt-0.5">{tr('Fast Barcode Checkout')}</div>
                    </div>
                  </div>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <kbd className="px-1.5 py-0.5 rounded-md bg-slate-950/10 border border-slate-950/20 font-mono font-black text-[10px]" title={tr('F1 opens a new bill from any screen')}>F1</kbd>
                    <ArrowRight className="w-4 h-4 text-slate-950 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </Link>
            );
          }
          const look = LOOK[a.id];
          const Icon = look.icon;
          const subtitle = a.id === 'printers' ? billPrinter || tr(look.subtitle) : tr(look.subtitle);
          const body = (
            <div className={`h-full bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-2xl p-3 sm:p-3.5 flex items-center gap-2.5 shadow-2xs border ${look.border} active:scale-[0.98] transition-all cursor-pointer text-left`}>
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform ${look.chip}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">{tr(look.title)}</div>
                <div className="text-[10.5px] font-medium text-slate-400 truncate" title={subtitle}>{subtitle}</div>
              </div>
            </div>
          );
          const cls = 'group grow basis-44 min-w-0';
          return a.href ? (
            <Link key={a.id} href={a.href} className={cls} data-home-action={a.id}>{body}</Link>
          ) : (
            <button key={a.id} type="button" onClick={run[a.action as HomeAction]} className={`${cls} block`} data-home-action={a.id}>{body}</button>
          );
        })}
      </div>
    </div>
  );
};
