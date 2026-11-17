'use client';

import React, { useEffect, useState } from 'react';
import { Printer, RefreshCw } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { BillPrinterWarning } from '@/components/printers/BillPrinterWarning';
import { KotPrinterRow } from '@/components/printers/KotPrinterRow';
import { useRestaurantMode } from '@/lib/features/featureSwitches';
import { Business } from '@/types';
import { DesktopPrinter, getDesktopApi, PaperFormat } from '@/lib/desktop/desktopBridge';
import { getPrintSettings, PrintSettings, printerForFormat, savePrintSettings } from '@/lib/hardware/printSettings';
import { renderInvoiceHtml } from '@/lib/invoices/invoiceOutput';
import { buildSampleSale, sampleBusiness } from '@/lib/invoices/sampleInvoice';
import { printHtml } from '@/lib/print/printDocument';
import { cn } from '@/lib/utils';
import { msg, tr } from '@/lib/i18n/core';

const FORMATS: { id: PaperFormat; label: string }[] = [
  { id: 'thermal-80', label: msg('80mm Thermal') },
  { id: 'thermal-58', label: msg('58mm Thermal') },
  { id: 'a4', label: msg('A4 Tax Invoice') },
];

interface BillPrinterSetupProps {
  onClose: () => void;
  business?: Business | null;
  /** "Enter prints the bill straight away" — the counter's silent-print switch. */
  autoPrint: boolean;
  onAutoPrintChange: (on: boolean) => void;
  /** Window title (Home calls it "Printers"); default "Bill printer". */
  title?: string;
  /** Extra section above the buttons — Home adds the label printer here. */
  children?: React.ReactNode;
}

/**
 * Bill printer, right on the counter (v4.72.0): bill size, printer, "Enter prints
 * straight away", test print. Saved on this computer (same settings as Settings →
 * Invoice & Bill Rules → Printer Setup), so it is set once.
 */
export function BillPrinterSetup({ onClose, business, autoPrint, onAutoPrintChange, title, children }: BillPrinterSetupProps) {
  const [settings, setSettings] = useState<PrintSettings>(getPrintSettings);
  const [printers, setPrinters] = useState<DesktopPrinter[]>([]);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const desktop = getDesktopApi();
  const restaurant = useRestaurantMode();
  const fmt = settings.defaultFormat;
  const printer = printerForFormat(settings, fmt);

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
    void loadPrinters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (patch: Partial<PrintSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    savePrintSettings(next);
  };
  const setPrinter = (name: string) => update(fmt === 'a4' ? { a4Printer: name } : { thermalPrinter: name });

  const testPrint = async () => {
    setNote(tr('Printing a test bill…'));
    const html = await renderInvoiceHtml({ sale: buildSampleSale(business), business: sampleBusiness(business) }, fmt);
    const res = await printHtml(html, fmt, { deviceName: printer || undefined, silent: Boolean(printer) });
    setNote(res.ok ? tr('Test bill sent. Check the paper size and that the text is clear.') : tr('Could not print: {error}', { error: res.error || '' }));
  };

  return (
    <Modal isOpen onClose={onClose} title={title || tr('Bill printer')} description={tr('Set once — saved on this computer.')} size="md">
      <div className="space-y-4 text-xs">
        <div>
          <p className="font-bold text-slate-700 mb-1.5">{tr('Bill size')}</p>
          <div className="grid grid-cols-3 gap-2">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => update({ defaultFormat: f.id })}
                className={cn('p-2.5 rounded-xl border font-bold cursor-pointer', fmt === f.id ? 'border-amber-400 bg-amber-50 text-slate-900' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}
                data-bill-format={f.id}
              >
                {tr(f.label)}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="font-bold text-slate-700 flex items-center justify-between">
            {tr('Printer for this bill size')}
            {desktop && (
              <button type="button" onClick={loadPrinters} className="text-sky-700 font-bold inline-flex items-center gap-1 cursor-pointer">
                <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} /> {tr('Refresh')}
              </button>
            )}
          </span>
          <select
            value={printer}
            onChange={(e) => setPrinter(e.target.value)}
            disabled={!desktop}
            className="w-full mt-1 h-9 px-2.5 rounded-lg border border-slate-300 bg-white font-bold disabled:bg-slate-50"
            data-bill-printer
          >
            <option value="">{tr('System default printer')}</option>
            {printers.map((p) => <option key={p.name} value={p.name}>{p.displayName}{p.isDefault ? tr(' (default)') : ''}</option>)}
          </select>
          <BillPrinterWarning name={printer || printers.find((p) => p.isDefault)?.name || ''} format={fmt} />
        </label>

        {/* v4.190.0: a restaurant always prints the bill straight after Settle — nothing to choose. */}
        {!restaurant && <label className="flex items-start gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 cursor-pointer">
          <input type="checkbox" checked={autoPrint} onChange={(e) => onAutoPrintChange(e.target.checked)} className="mt-0.5" data-bill-autoprint />
          <span>
            <span className="block font-black text-emerald-900">{tr('Enter prints the bill straight away')}</span>
            <span className="block text-emerald-800">{tr('No "Sale completed" window: Enter / F10 saves the bill, prints it on this printer and the next customer can be scanned.')}</span>
          </span>
        </label>}

        {/* v4.186.0: a restaurant's kitchen printer for KOTs (default: the same printer as the bill). */}
        {restaurant && <KotPrinterRow settings={settings} printers={printers} onChange={update} shopName={business?.name} />}

        {children}

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={testPrint} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer" data-bill-test>
            <Printer className="w-3.5 h-3.5" /> {tr('Test print')}
          </button>
          {note && <span className="text-slate-600">{note}</span>}
          <button type="button" onClick={onClose} className="ml-auto px-4 h-9 rounded-lg bg-amber-400 hover:bg-amber-500 font-black cursor-pointer">{tr('Done')}</button>
        </div>
      </div>
    </Modal>
  );
}
