'use client';

import React, { useEffect, useState } from 'react';
import { Printer, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { BillPrinterWarning } from '@/components/printers/BillPrinterWarning';
import { DesktopPrinter, getDesktopApi, PaperFormat } from '@/lib/desktop/desktopBridge';
import { KotPrinterRow } from '@/components/printers/KotPrinterRow';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { getPrintSettings, PrintSettings, printerForFormat, savePrintSettings } from '@/lib/hardware/printSettings';
import { readSilentPrint, saveSilentPrint } from '@/lib/hardware/printerWatch';
import { useRestaurantMode } from '@/lib/features/featureSwitches';
import { cn } from '@/lib/utils';
import { msg, tr } from '@/lib/i18n/core';

const FORMATS: { id: PaperFormat; label: string; hint: string }[] = [
  { id: 'a4', label: msg('A4 Tax Invoice'), hint: msg('Laser / inkjet printer') },
  { id: 'thermal-80', label: msg('80mm Thermal'), hint: msg('3-inch receipt printer') },
  { id: 'thermal-58', label: msg('58mm Thermal'), hint: msg('2-inch receipt printer') },
];

/**
 * Printer setup for this computer: which format the one "Print Bill" button
 * uses and its printer, whether bills print straight away / automatically after every sale,
 * and (v4.186.0, Restaurant mode) the kitchen's KOT printer. Saved immediately.
 */
export function PrintSettingsCard() {
  const [settings, setSettings] = useState<PrintSettings>(getPrintSettings());
  const [printers, setPrinters] = useState<DesktopPrinter[]>([]);
  const [loading, setLoading] = useState(false);
  const desktop = getDesktopApi();
  const restaurant = useRestaurantMode();
  const business = useBusiness();
  // The counter's / restaurant's "print straight away" switch (same as the Printers window).
  const [straightAway, setStraightAway] = useState(readSilentPrint);

  const loadPrinters = async () => {
    if (!desktop) return;
    setLoading(true);
    try {
      setPrinters(await desktop.getPrinters());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrinters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (patch: Partial<PrintSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    savePrintSettings(next);
  };

  const printerSelect = (value: string, onChange: (v: string) => void) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={!desktop}
      className="w-full mt-1 px-2.5 py-2 text-xs rounded-lg border border-slate-300 bg-white disabled:bg-slate-50"
    >
      <option value="">{tr('System default printer')}</option>
      {printers.map((p) => (
        <option key={p.name} value={p.name}>
          {p.displayName}
          {p.isDefault ? tr(' (default)') : ''}
        </option>
      ))}
    </select>
  );

  return (
    <Card className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-2xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Printer className="w-4 h-4 text-slate-700" />
          <h3 className="text-sm font-black text-slate-900">{tr('Printer Setup (this computer)')}</h3>
        </div>
        {desktop && (
          <button type="button" onClick={loadPrinters} className="text-xs font-bold text-slate-600 inline-flex items-center gap-1 cursor-pointer">
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} /> {tr('Refresh printers')}
          </button>
        )}
      </div>

      <div>
        <div className="text-xs font-black text-slate-700 mb-1.5">{tr('"Print Bill" prints as')}</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => update({ defaultFormat: f.id })}
              className={cn(
                'p-2.5 rounded-xl border text-left cursor-pointer transition-all',
                settings.defaultFormat === f.id ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-400/30' : 'border-slate-200 hover:border-slate-300'
              )}
            >
              <div className="text-xs font-black text-slate-900">{tr(f.label)}</div>
              <div className="text-[10.5px] text-slate-500">{tr(f.hint)}</div>
            </button>
          ))}
        </div>
      </div>

      {/* v4.186.0 (Rahul: set once, never asked): one printer — the one for the chosen bill size; a printer
          chosen = "Print Bill" goes straight to it (no Windows dialog, printBillSilently). */}
      <label className="block text-xs font-bold text-slate-700">
        {tr('Bill printer')}
        {printerSelect(printerForFormat(settings, settings.defaultFormat), (v) => update(settings.defaultFormat === 'a4' ? { a4Printer: v } : { thermalPrinter: v }))}
        <BillPrinterWarning name={printerForFormat(settings, settings.defaultFormat)} format={settings.defaultFormat} />
      </label>

      {restaurant && <KotPrinterRow settings={settings} printers={printers} onChange={update} shopName={business?.name} />}

      <div className="space-y-2">
        <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
          <input type="checkbox" checked={straightAway} onChange={(e) => { setStraightAway(e.target.checked); saveSilentPrint(e.target.checked); }} className="mt-0.5" data-settings-straight-print />
          <span>
            <b>{tr('Enter prints the bill straight away')}</b> {tr('No "Sale completed" window: Enter / F10 saves the bill, prints it on this printer and the next customer can be scanned.')}
          </span>
        </label>
        <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
          <input type="checkbox" checked={settings.autoPrintAfterSale} onChange={(e) => update({ autoPrintAfterSale: e.target.checked })} className="mt-0.5" />
          <span>
            <b>{tr('Auto-print the bill')}</b> {tr('as soon as a sale is completed')}
          </span>
        </label>
      </div>

      {!desktop && (
        <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-2">
          {tr('Printer selection is available in the desktop app. In a browser, bills open the system print dialog.')}
        </p>
      )}
    </Card>
  );
}
