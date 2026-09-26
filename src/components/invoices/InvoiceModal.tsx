'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Bluetooth,
  CheckCircle2,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  FolderOpen,
  Palette,
  Printer,
  Receipt,
  RotateCcw,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { db } from '@/lib/db';
import { Business, Sale } from '@/types';
import { formatINR, cn } from '@/lib/utils';
import { InvoiceDocument, getPrimaryUpiVpa } from '@/lib/invoices/invoiceDocument';
import { prepareInvoiceDocument, printInvoice, saveInvoicePdf } from '@/lib/invoices/invoiceOutput';
import { getBrandLogoDataUrl } from '@/lib/print/printDocument';
import { getDesktopApi, PaperFormat } from '@/lib/desktop/desktopBridge';
import { getPrintSettings } from '@/lib/hardware/printSettings';
import { bluetoothPrinter } from '@/lib/hardware/bluetoothPrinter';
import { getSalePaymentBreakdown, isEstimate } from '@/lib/sales/saleMath';
import { EditInvoiceModal } from '@/components/invoices/EditInvoiceModal';
import { InvoicePreview } from '@/components/invoices/InvoicePreview';
import { msg, tr } from '@/lib/i18n/core';

export type InvoiceFormat = PaperFormat;

export interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNewBill?: () => void;
  sale: Sale | null;
  business?: Business | null;
  format?: InvoiceFormat;
  initialPhone?: string;
  onInvoiceUpdated?: (updatedSale: Sale) => void;
  /** Opened right after checkout: shows the "Sale Completed" summary and + New Bill. */
  isPostSaleSuccess?: boolean;
  /** When given, a Return button opens the caller's Sales Return flow for this bill. */
  onRequestReturn?: (sale: Sale) => void;
}

type Notice = { tone: 'success' | 'error'; text: string; pdfPath?: string } | null;

const FORMAT_TABS: { id: InvoiceFormat; label: string }[] = [
  { id: 'a4', label: msg('A4 Bill') },
  { id: 'thermal-80', label: '80mm' },
  { id: 'thermal-58', label: '58mm' },
];

/**
 * Invoice / sale detail — desktop port of the Android SaleDetailModal and
 * SaleCompletedModal: live preview of the exact printed bill, one Print Bill
 * button (format and printer from Print Settings), A4 PDF saved to
 * Documents\KamaiPlus\Invoices, Edit, Return and Theme shortcuts.
 */
export function InvoiceModal({
  isOpen,
  onClose,
  onNewBill,
  sale: initialSale,
  business,
  format: initialFormat,
  onInvoiceUpdated,
  isPostSaleSuccess = false,
  onRequestReturn,
}: InvoiceModalProps) {
  const [sale, setSale] = useState<Sale | null>(initialSale);
  const [format, setFormat] = useState<InvoiceFormat>(initialFormat || 'a4');
  const [doc, setDoc] = useState<InvoiceDocument | null>(null);
  const [brandLogo, setBrandLogo] = useState('');
  const [upiIndex, setUpiIndex] = useState(0);
  const [busy, setBusy] = useState<'print' | 'pdf' | 'bt' | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const autoPrinted = useRef<string | null>(null);

  useEffect(() => setSale(initialSale), [initialSale]);

  useEffect(() => {
    if (isOpen) {
      setFormat(initialFormat || getPrintSettings().defaultFormat);
      setNotice(null);
    }
  }, [isOpen, initialFormat]);

  const customer = useLiveQuery(
    async () => (sale?.customer_id ? db.customers.get(sale.customer_id) : undefined),
    [sale?.customer_id]
  );

  const upiOptions = useMemo(() => {
    if (!business) return [];
    const list = (business.upi_ids || []).filter((u) => u.upi_id);
    if (list.length > 0) return list;
    return business.upi_id ? [{ id: 'default', label: tr('Primary UPI'), upi_id: business.upi_id, is_default: true }] : [];
  }, [business]);
  const selectedVpa = upiOptions[upiIndex]?.upi_id || getPrimaryUpiVpa(business);

  useEffect(() => {
    let cancelled = false;
    getBrandLogoDataUrl().then((url) => !cancelled && setBrandLogo(url));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isOpen || !sale || !business) return;
    let cancelled = false;
    prepareInvoiceDocument({ sale, business, customer, upiVpa: selectedVpa }).then((d) => !cancelled && setDoc(d));
    return () => {
      cancelled = true;
    };
  }, [isOpen, sale, business, customer, selectedVpa]);

  // Optional auto-print straight after checkout (Print Settings → "Print after every sale").
  useEffect(() => {
    if (!isOpen || !isPostSaleSuccess || !sale || !business) return;
    if (autoPrinted.current === sale.id || !getPrintSettings().autoPrintAfterSale) return;
    autoPrinted.current = sale.id;
    printInvoice({ sale, business, customer, upiVpa: selectedVpa }).catch(() => {});
  }, [isOpen, isPostSaleSuccess, sale, business, customer, selectedVpa]);

  if (!sale || !business) return null;

  const estimate = isEstimate(sale);
  const returned = sale.status === 'returned' || sale.status === 'partial_return';
  const pay = getSalePaymentBreakdown(sale);
  const input = { sale, business, customer, upiVpa: selectedVpa };

  const flash = (n: Notice) => {
    setNotice(n);
    if (n && n.tone === 'success' && !n.pdfPath) setTimeout(() => setNotice((cur) => (cur === n ? null : cur)), 3500);
  };

  const handlePrint = async () => {
    setBusy('print');
    try {
      const res = await printInvoice(input, format);
      if (res.ok) flash({ tone: 'success', text: res.method === 'desktop' ? tr('Bill sent to printer.') : tr('Print dialog opened.') });
      else if (res.error && !/cancel/i.test(res.error)) flash({ tone: 'error', text: tr('Print failed: {error}', { error: res.error }) });
    } finally {
      setBusy(null);
    }
  };

  const handleSavePdf = async () => {
    setBusy('pdf');
    try {
      const res = await saveInvoicePdf(input);
      if (res.ok && res.path) flash({ tone: 'success', text: tr('Tax Invoice PDF saved.'), pdfPath: res.path });
      else if (res.ok) flash({ tone: 'success', text: tr('Choose "Save as PDF" in the print dialog.') });
      else flash({ tone: 'error', text: res.error || tr('Could not create the PDF.') });
    } finally {
      setBusy(null);
    }
  };

  const handleBluetooth = async () => {
    setBusy('bt');
    try {
      await bluetoothPrinter.printSaleReceipt(sale, business, format === 'thermal-80' ? 80 : 58);
      flash({ tone: 'success', text: tr('Receipt printed on the Bluetooth printer.') });
    } catch (err: any) {
      flash({ tone: 'error', text: err?.message || tr('Bluetooth printing failed. Check that the printer is on and paired.') });
    } finally {
      setBusy(null);
    }
  };

  const handleSaved = (updated: Sale) => {
    setSale(updated);
    flash({ tone: 'success', text: tr('Invoice updated.') });
    onInvoiceUpdated?.(updated);
  };

  const desktop = getDesktopApi();
  const title = isPostSaleSuccess ? (
    <span className="flex items-center gap-2">
      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
      {estimate ? tr('Estimate Created') : tr('Sale Completed')}
    </span>
  ) : (
    <span className="flex items-center gap-2">
      <FileText className="w-4 h-4 text-slate-700" />
      {estimate ? tr('Estimate / Quotation') : tr('Tax Invoice')} #{sale.invoice_number}
    </span>
  );

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={title} description={`${sale.customer_name || 'Cash Customer'} • ${doc?.dateText || ''}`} size="xl">
        <div className="space-y-3">
          {isPostSaleSuccess && (
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[10.5px] font-black uppercase tracking-wider text-emerald-800">{tr('Total Billed • #')}{sale.invoice_number}</div>
                <div className="text-2xl font-black text-slate-900 font-mono">{formatINR(sale.grand_total)}</div>
                {sale.balance_due > 0 && !estimate && (
                  <div className="text-xs font-bold text-amber-800">{formatINR(sale.balance_due)} {tr('added to')} {sale.customer_name}{tr('\'s Khata')}</div>
                )}
              </div>
              <Button size="lg" onClick={() => (onNewBill ? onNewBill() : onClose())} className="bg-amber-400 hover:bg-amber-500 text-slate-950 border-amber-400">
                <Receipt className="w-4 h-4" /> {tr('+ New Bill')}
              </Button>
            </div>
          )}

          <SummaryStrip sale={sale} pay={pay} estimate={estimate} />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
              {FORMAT_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFormat(t.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                    format === t.id ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  {tr(t.label)}
                </button>
              ))}
            </div>
            {upiOptions.length > 1 && (
              <select
                value={upiIndex}
                onChange={(e) => setUpiIndex(Number(e.target.value))}
                className="text-xs font-semibold border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
                title={tr('UPI ID printed on this bill')}
              >
                {upiOptions.map((u, i) => (
                  <option key={u.id || i} value={i}>
                    {u.label || 'UPI'} — {u.upi_id}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Button onClick={handlePrint} isLoading={busy === 'print'} className="h-10">
              <Printer className="w-4 h-4 text-amber-300" /> {tr('Print Bill')}
            </Button>
            <Button variant="outline" onClick={handleSavePdf} isLoading={busy === 'pdf'} className="h-10">
              <Download className="w-4 h-4" /> {tr('Save PDF')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsEditOpen(true)}
              disabled={returned}
              title={returned ? tr('Bills with a return cannot be edited — the return already adjusted stock and khata.') : tr('Edit items, prices or payment')}
              className="h-10"
            >
              <Edit3 className="w-4 h-4 text-amber-600" /> {estimate ? tr('Edit Estimate') : tr('Edit Bill')}
            </Button>
            {onRequestReturn && !estimate && sale.status !== 'returned' ? (
              <Button variant="outline" onClick={() => onRequestReturn(sale)} className="h-10 text-rose-700 border-rose-200 hover:bg-rose-50">
                <RotateCcw className="w-4 h-4" /> {tr('Return')}
              </Button>
            ) : (
              <Link href="/invoice-designer" className="contents">
                <Button variant="outline" className="h-10 w-full">
                  <Palette className="w-4 h-4 text-purple-600" /> {tr('Theme')}
                </Button>
              </Link>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
            {format !== 'a4' && (
              <button type="button" onClick={handleBluetooth} disabled={busy === 'bt'} className="inline-flex items-center gap-1 font-bold text-sky-700 hover:underline cursor-pointer disabled:opacity-50">
                <Bluetooth className="w-3.5 h-3.5" /> {busy === 'bt' ? tr('Printing…') : tr('Print on Bluetooth printer')}
              </button>
            )}
            {onRequestReturn && (
              <Link href="/invoice-designer" className="inline-flex items-center gap-1 font-bold text-purple-700 hover:underline">
                <Palette className="w-3.5 h-3.5" /> {tr('Invoice theme')}
              </Link>
            )}
            <span>{tr('PDF is always the full A4 Tax Invoice.')}</span>
          </div>

          {notice && (
            <div
              className={cn(
                'p-2.5 rounded-xl text-xs font-bold flex flex-wrap items-center gap-2 border',
                notice.tone === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
              )}
            >
              <span className="flex-1 min-w-0">{notice.text}</span>
              {notice.pdfPath && desktop && (
                <>
                  <button type="button" onClick={() => desktop.openPath(notice.pdfPath!)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-emerald-300 cursor-pointer">
                    <ExternalLink className="w-3.5 h-3.5" /> {tr('Open')}
                  </button>
                  <button type="button" onClick={() => desktop.showItemInFolder(notice.pdfPath!)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-emerald-300 cursor-pointer">
                    <FolderOpen className="w-3.5 h-3.5" /> {tr('Show in folder')}
                  </button>
                </>
              )}
            </div>
          )}

          <InvoicePreview doc={doc} sale={sale} business={business} format={format} brandLogoUrl={brandLogo} className="max-h-[58vh]" />
        </div>
      </Modal>

      <EditInvoiceModal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} sale={sale} onSaved={handleSaved} />
    </>
  );
}

function SummaryStrip({ sale, pay, estimate }: { sale: Sale; pay: ReturnType<typeof getSalePaymentBreakdown>; estimate: boolean }) {
  const chips: { label: string; value: number; tone: string }[] = [
    { label: tr('Cash'), value: pay.cash, tone: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    { label: 'UPI', value: pay.upi, tone: 'bg-sky-50 text-sky-800 border-sky-200' },
    { label: tr('Card'), value: pay.card, tone: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
    { label: tr('Udhar'), value: pay.credit, tone: 'bg-amber-50 text-amber-900 border-amber-200' },
  ].filter((c) => c.value > 0);

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="font-mono font-black text-slate-900 text-sm">{formatINR(sale.grand_total)}</span>
      <span className="text-slate-400">•</span>
      <span className="text-slate-600">{sale.items.length} {sale.items.length === 1 ? tr('item') : tr('items')}</span>
      {estimate && <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 font-bold text-slate-700">{tr('ESTIMATE')}</span>}
      {!estimate && chips.map((c) => (
        <span key={c.label} className={cn('px-2 py-0.5 rounded-full border font-bold', c.tone)}>
          {c.label}: {formatINR(c.value)}
        </span>
      ))}
      {sale.status === 'returned' && <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 font-black text-rose-700">{tr('RETURNED')}</span>}
      {sale.status === 'partial_return' && (
        <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 font-black text-amber-800">
          {tr('PARTIAL RETURN •')} {formatINR(sale.returned_amount || 0)}
        </span>
      )}
    </div>
  );
}
