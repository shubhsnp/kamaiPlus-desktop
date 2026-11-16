'use client';

import React, { useState } from 'react';
import { ChefHat, Printer } from 'lucide-react';
import { BillPrinterWarning } from '@/components/printers/BillPrinterWarning';
import { DesktopPrinter, getDesktopApi } from '@/lib/desktop/desktopBridge';
import { kotTarget, PrintSettings } from '@/lib/hardware/printSettings';
import { cn } from '@/lib/utils';
import { msg, tr } from '@/lib/i18n/core';

const KOT_SIZES: { id: 'thermal-80' | 'thermal-58'; label: string }[] = [
  { id: 'thermal-80', label: msg('80mm Thermal') },
  { id: 'thermal-58', label: msg('58mm Thermal') },
];

/**
 * v4.186.0 (Rahul): the kitchen's printer, Restaurant mode only — KOTs, cancel slips and reprints go
 * there, bills stay on the bill printer. "Same as the bill printer" (default) = one printer for both,
 * as before. Set once in Printer setup; never asked when a KOT is sent.
 */
export function KotPrinterRow({ settings, printers, onChange, shopName }: {
  settings: PrintSettings;
  printers: DesktopPrinter[];
  onChange: (patch: Partial<PrintSettings>) => void;
  shopName?: string;
}) {
  const desktop = getDesktopApi();
  const [note, setNote] = useState('');
  const target = kotTarget(settings);

  const test = async () => {
    setNote(tr('Printing a test KOT…'));
    const { printTestKot } = await import('@/lib/restaurant/kot');
    const res = await printTestKot(shopName);
    setNote(res.ok ? tr('Test KOT sent. Check it came out in the kitchen.') : tr('Could not print: {error}', { error: res.error || '' }));
  };

  return (
    <div className="rounded-xl border border-slate-200 p-2.5 space-y-2" data-kot-printer-row>
      <p className="font-black text-slate-800 flex items-center gap-1.5"><ChefHat className="w-4 h-4" /> {tr('KOT printer (kitchen)')}</p>
      <select
        value={settings.kotPrinter}
        onChange={(e) => onChange({ kotPrinter: e.target.value })}
        disabled={!desktop}
        className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white font-bold disabled:bg-slate-50"
        data-kot-printer
      >
        <option value="">{tr('Same as the bill printer')}</option>
        {printers.map((p) => <option key={p.name} value={p.name}>{p.displayName}{p.isDefault ? tr(' (default)') : ''}</option>)}
      </select>
      {settings.kotPrinter && <BillPrinterWarning name={settings.kotPrinter} format={target.paper} />}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold text-slate-600">{tr('KOT size')}</span>
        {KOT_SIZES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange({ kotFormat: s.id })}
            className={cn('px-2.5 h-7 rounded-lg border font-bold cursor-pointer', target.paper === s.id ? 'border-amber-400 bg-amber-50 text-slate-900' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}
            data-kot-format={s.id}
          >
            {tr(s.label)}
          </button>
        ))}
        {desktop && (
          <button type="button" onClick={test} className="ml-auto inline-flex items-center gap-1 px-2.5 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer" data-kot-test>
            <Printer className="w-3.5 h-3.5" /> {tr('Test KOT')}
          </button>
        )}
      </div>
      {note && <p className="text-slate-600">{note}</p>}
    </div>
  );
}
