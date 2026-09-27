'use client';

import React, { useCallback, useState } from 'react';
import { AlertTriangle, Printer, X } from 'lucide-react';
import { Business, Customer, Sale } from '@/types';
import { getDesktopApi } from '@/lib/desktop/desktopBridge';
import { getPrintSettings, printerForFormat } from '@/lib/hardware/printSettings';
import { getPrimaryUpiVpa } from '@/lib/invoices/invoiceDocument';
import { renderInvoiceHtml } from '@/lib/invoices/invoiceOutput';
import { buildSampleSale, sampleBusiness } from '@/lib/invoices/sampleInvoice';
import { getBrandLogoDataUrl } from '@/lib/print/printDocument';
import { tr } from '@/lib/i18n/core';

/*
 * "Enter prints the bill straight away", without the counter waiting (v4.74.0).
 * The bill is already saved and the next bill is open when printing starts; the job
 * runs in the background (Electron prints one job at a time, in order). A bill that
 * did not print stays in a red bar above the customer row until it is printed again
 * or dismissed — it never pops a window over the next customer's bill.
 */

export interface BillPrintJob {
  sale: Sale;
  business: Business;
  customer?: Customer;
}
export interface FailedBillPrint extends BillPrintJob {
  error: string;
}

async function printBill({ sale, business, customer }: BillPrintJob): Promise<void> {
  const api = getDesktopApi();
  if (!api) throw new Error(tr('Printing is available in the desktop app.'));
  const settings = getPrintSettings();
  const format = settings.defaultFormat || 'thermal-80';
  const html = await renderInvoiceHtml({ sale, business, customer, upiVpa: getPrimaryUpiVpa(business) }, format);
  const res = await api.print({ html, paper: format, deviceName: printerForFormat(settings, format) || undefined, silent: true });
  // print() reports a failed job instead of throwing.
  if (!res.ok) throw new Error(res.error || tr('Printing failed'));
}

export function useBackgroundBillPrint(on: { printed: (sale: Sale) => void; failed: (sale: Sale, error: string) => void }) {
  const [failed, setFailed] = useState<FailedBillPrint[]>([]);
  const { printed, failed: onFailed } = on;

  const print = useCallback((job: BillPrintJob) => {
    printBill(job).then(
      () => {
        setFailed((prev) => prev.filter((f) => f.sale.id !== job.sale.id));
        printed(job.sale);
      },
      (err: any) => {
        const error = err?.message || tr('Printing failed');
        setFailed((prev) => [...prev.filter((f) => f.sale.id !== job.sale.id), { ...job, error }]);
        onFailed(job.sale, error);
      }
    );
  }, [printed, onFailed]);

  const dismiss = useCallback((saleId: string) => setFailed((prev) => prev.filter((f) => f.sale.id !== saleId)), []);
  return { failed, print, dismiss };
}

/**
 * Load the bill-printing code and the shop logo once while the counter is idle, so the
 * first bill of the day prints (or shows "Sale completed") as fast as the rest.
 */
export function warmBillPrinting(business?: Business | null): void {
  void import('@/components/invoices/InvoiceModal').catch(() => {});
  void getBrandLogoDataUrl().catch(() => '');
  void renderInvoiceHtml({ sale: buildSampleSale(business), business: sampleBusiness(business) }, getPrintSettings().defaultFormat || 'thermal-80').catch(() => '');
}

interface PrintFailureBarProps {
  failed: FailedBillPrint[];
  onRetry: (job: FailedBillPrint) => void;
  onOpen: (job: FailedBillPrint) => void;
  onDismiss: (saleId: string) => void;
}

export function PrintFailureBar({ failed, onRetry, onOpen, onDismiss }: PrintFailureBarProps) {
  if (failed.length === 0) return null;
  return (
    <div className="space-y-1.5" data-print-failed>
      {failed.map((f) => (
        <div key={f.sale.id} className="flex items-center gap-2 p-2 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-900">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="font-black">{tr('Bill #{invoiceNumber} did not print', { invoiceNumber: f.sale.invoice_number })}</span>
            {f.error && <span className="block truncate text-rose-700">{f.error}</span>}
          </span>
          <button type="button" onClick={() => onRetry(f)} className="inline-flex items-center gap-1 px-2 h-7 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer" data-print-retry>
            <Printer className="w-3.5 h-3.5" /> {tr('Print again')}
          </button>
          <button type="button" onClick={() => onOpen(f)} className="px-2 h-7 rounded-lg border border-rose-300 bg-white hover:bg-rose-100 font-bold cursor-pointer">
            {tr('Open bill')}
          </button>
          <button type="button" onClick={() => onDismiss(f.sale.id)} className="p-1 rounded-lg hover:bg-rose-100 cursor-pointer" aria-label={tr('Dismiss')}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
