'use client';

import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Printer, X } from 'lucide-react';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { getDesktopApi, PaperFormat } from '@/lib/desktop/desktopBridge';
import { getPrintSettings, savePrintSettings } from '@/lib/hardware/printSettings';
import { getLabelSettings, saveLabelSettings } from '@/lib/labels/labelSettings';
import { KNOWN_PRINTERS_KEY, parseKnownPrinters, PrinterFacts, printerKind, reviewPrinters, thermalFormat } from '@/lib/hardware/printerDetect';
import { loadPrinterFacts, OPEN_PRINTERS_EVENT, publishPrinters } from '@/lib/hardware/printerWatch';
import { renderInvoiceHtml } from '@/lib/invoices/invoiceOutput';
import { buildSampleSale, sampleBusiness } from '@/lib/invoices/sampleInvoice';
import { printHtml } from '@/lib/print/printDocument';
import { msg, tr } from '@/lib/i18n/core';

const PrintersWindow = dynamic(() => import('./PrintersWindow').then((m) => m.PrintersWindow), { ssr: false });

/** Quick look (names only) this often; the full Windows look (offline state) every minute. */
const QUICK_MS = 8000;
const FULL_MS = 60000;

const KIND_LABEL = {
  thermal: msg('Receipt printer'),
  label: msg('Barcode label printer'),
  a4: msg('A4 / office printer'),
  other: msg('Printer'),
};
const FORMAT_LABEL: Record<PaperFormat, string> = { 'thermal-80': msg('80mm Thermal'), 'thermal-58': msg('58mm Thermal'), a4: msg('A4 Tax Invoice') };

type Notice =
  | { kind: 'picked'; bill?: { name: string; format: PaperFormat }; label?: string }
  | { kind: 'fresh'; printer: PrinterFacts };

function setBillPrinter(name: string, format: PaperFormat) {
  const s = getPrintSettings();
  savePrintSettings({ ...s, defaultFormat: format, ...(format === 'a4' ? { a4Printer: name } : { thermalPrinter: name }) });
}

/**
 * Printer auto-detect (v4.78.0), in the app shell. Plug in a printer and install it in
 * Windows: when there is no doubt (nothing chosen yet, one receipt / one label printer) it is
 * picked on its own and the shop is told; otherwise a new printer is asked about once.
 * Also hosts the Printers window (Home tile, status bar) and feeds the status bar.
 */
export function PrinterWatcher() {
  const business = useBusiness();
  const [windowOpen, setWindowOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [note, setNote] = useState('');
  const busy = useRef(false);

  useEffect(() => {
    const open = () => setWindowOpen(true);
    window.addEventListener(OPEN_PRINTERS_EVENT, open);
    return () => window.removeEventListener(OPEN_PRINTERS_EVENT, open);
  }, []);

  useEffect(() => {
    const api = getDesktopApi();
    if (!api) return;
    let alive = true;
    let lastNames: string | null = null;
    const look = async (full: boolean) => {
      if (busy.current) return;
      busy.current = true;
      try {
        const quick = await api.getPrinters().catch(() => []);
        const names = quick.map((p) => p.name).sort().join('|');
        if (!full && names === lastNames) return;
        lastNames = names;
        const facts = await loadPrinterFacts(api, quick);
        if (!alive) return;
        publishPrinters(facts);
        let known: string[] | null = null;
        try {
          known = parseKnownPrinters(localStorage.getItem(KNOWN_PRINTERS_KEY));
        } catch {}
        const review = reviewPrinters({ known, printers: facts, bill: getPrintSettings(), labelPrinter: getLabelSettings().printer });
        try {
          localStorage.setItem(KNOWN_PRINTERS_KEY, JSON.stringify(review.known));
        } catch {}
        if (review.bill) setBillPrinter(review.bill.name, review.bill.format);
        if (review.label) saveLabelSettings({ ...getLabelSettings(), printer: review.label });
        if (review.bill || review.label) {
          setNote('');
          setNotice({ kind: 'picked', bill: review.bill, label: review.label });
        } else if (review.fresh.length) {
          setNote('');
          setNotice({ kind: 'fresh', printer: review.fresh[0] });
        }
      } finally {
        busy.current = false;
      }
    };
    void look(true);
    const quickTimer = window.setInterval(() => void look(false), QUICK_MS);
    const fullTimer = window.setInterval(() => void look(true), FULL_MS);
    return () => {
      alive = false;
      window.clearInterval(quickTimer);
      window.clearInterval(fullTimer);
    };
  }, []);

  const testPrint = async (name: string, format: PaperFormat) => {
    setNote(tr('Printing a test bill…'));
    const html = await renderInvoiceHtml({ sale: buildSampleSale(business), business: sampleBusiness(business) }, format);
    const res = await printHtml(html, format, { deviceName: name, silent: true });
    setNote(res.ok ? tr('Test bill sent. Check the paper size and that the text is clear.') : tr('Could not print: {error}', { error: res.error || '' }));
  };

  const btn = 'px-2.5 h-7 rounded-lg font-bold cursor-pointer';
  let card: React.ReactNode = null;
  if (notice?.kind === 'picked') {
    const { bill, label } = notice;
    card = (
      <>
        <p className="font-black text-slate-900">{tr('Printer set automatically')}</p>
        {bill && <p className="text-slate-700">{tr('Bills print on {name} ({size}).', { name: bill.name, size: tr(FORMAT_LABEL[bill.format]) })}</p>}
        {label && <p className="text-slate-700">{tr('Labels print on {name}.', { name: label })}</p>}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {bill && <button type="button" className={`${btn} bg-slate-900 text-white`} onClick={() => void testPrint(bill.name, bill.format)} data-printer-notice-test>{tr('Test print')}</button>}
          <button type="button" className={`${btn} bg-slate-100 text-slate-800`} onClick={() => { setNotice(null); setWindowOpen(true); }}>{tr('Change')}</button>
          <button type="button" className={`${btn} bg-amber-400 text-slate-950`} onClick={() => setNotice(null)}>{tr('OK')}</button>
        </div>
      </>
    );
  } else if (notice?.kind === 'fresh') {
    const p = notice.printer;
    const kind = printerKind(p);
    const format: PaperFormat = kind === 'thermal' ? thermalFormat(p) : 'a4';
    const use = () => {
      if (kind === 'label') saveLabelSettings({ ...getLabelSettings(), printer: p.name });
      else setBillPrinter(p.name, format);
      setNotice({ kind: 'picked', ...(kind === 'label' ? { label: p.name } : { bill: { name: p.name, format } }) });
    };
    card = (
      <>
        <p className="font-black text-slate-900">{tr('New printer found: {name}', { name: p.displayName || p.name })}</p>
        <p className="text-slate-600">{tr(KIND_LABEL[kind])}{p.offline ? ` • ${tr('switched off or unplugged')}` : ''}</p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <button type="button" className={`${btn} bg-amber-400 text-slate-950`} onClick={use} data-printer-notice-use>
            {kind === 'label' ? tr('Use for labels') : kind === 'thermal' ? tr('Use for bills') : tr('Use for A4 bills')}
          </button>
          {kind !== 'label' && <button type="button" className={`${btn} bg-slate-900 text-white`} onClick={() => void testPrint(p.name, format)}>{tr('Test print')}</button>}
          <button type="button" className={`${btn} bg-slate-100 text-slate-800`} onClick={() => setNotice(null)}>{tr('Not now')}</button>
        </div>
      </>
    );
  }

  return (
    <>
      {card && (
        <div className="fixed bottom-10 right-4 z-[90] w-[320px] max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-2xl shadow-xl p-3 text-xs space-y-1 animate-in fade-in" role="status" data-printer-notice={notice?.kind}>
          <div className="flex items-start gap-2">
            <Printer className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1 space-y-1">
              {card}
              {note && <p className="text-slate-500">{note}</p>}
            </div>
            <button type="button" onClick={() => setNotice(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer" aria-label={tr('Close')}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
      {windowOpen && <PrintersWindow onClose={() => setWindowOpen(false)} business={business} />}
    </>
  );
}
