import React from 'react';
import QRCode from 'qrcode';
import { Business, Customer, Sale } from '@/types';
import { generateUPILink } from '@/lib/utils';
import { buildInvoiceDocument, getPrimaryUpiVpa, InvoiceDocument } from '@/lib/invoices/invoiceDocument';
import { resolveInvoiceConfig } from '@/lib/invoices/themeDefaults';
import { A4TaxInvoice } from '@/components/invoices/print/A4TaxInvoice';
import { ThermalReceipt } from '@/components/invoices/print/ThermalReceipt';
import {
  buildPrintHtml,
  getBrandLogoDataUrl,
  printHtml,
  renderElementToHtml,
  safeFileName,
  saveHtmlAsPdf,
} from '@/lib/print/printDocument';
import type { PaperFormat } from '@/lib/desktop/desktopBridge';
import { getPrintSettings, printBillSilently, printerForFormat } from '@/lib/hardware/printSettings';

export interface InvoiceRenderInput {
  sale: Sale;
  business: Business;
  customer?: Customer | null;
  upiVpa?: string;
}

/** Scannable UPI QR for the amount still to be paid on the bill (whole bill if already paid). */
export async function buildUpiQrDataUrl(sale: Sale, business: Business, vpa: string): Promise<string> {
  if (!vpa) return '';
  const amount = sale.balance_due > 0 ? sale.balance_due : sale.grand_total;
  try {
    return await QRCode.toDataURL(generateUPILink(vpa, business.name, amount, sale.invoice_number), {
      width: 240,
      margin: 1,
      color: { dark: '#0F172A', light: '#FFFFFF' },
    });
  } catch {
    return '';
  }
}

export async function prepareInvoiceDocument(input: InvoiceRenderInput): Promise<InvoiceDocument> {
  const config = resolveInvoiceConfig(input.business);
  const vpa = (input.upiVpa || getPrimaryUpiVpa(input.business)).trim();
  const qrDataUrl = config.show_upi_qr ? await buildUpiQrDataUrl(input.sale, input.business, vpa) : '';
  return buildInvoiceDocument(input.sale, input.business, { config, customer: input.customer, upiVpa: vpa, qrDataUrl });
}

export async function renderInvoiceHtml(input: InvoiceRenderInput, format: PaperFormat): Promise<string> {
  const doc = await prepareInvoiceDocument(input);
  const title = `${doc.heading} #${input.sale.invoice_number}`;
  if (format === 'a4') {
    const brand = await getBrandLogoDataUrl();
    return buildPrintHtml(renderElementToHtml(<A4TaxInvoice doc={doc} brandLogoUrl={brand} />), title, 'a4');
  }
  const width = format === 'thermal-80' ? 80 : 58;
  return buildPrintHtml(
    renderElementToHtml(<ThermalReceipt doc={doc} sale={input.sale} business={input.business} width={width} />),
    title,
    format
  );
}

/** The one "Print Bill" action: prints in the format and on the printer chosen in Print Settings. */
export async function printInvoice(input: InvoiceRenderInput, format?: PaperFormat) {
  const settings = getPrintSettings();
  const fmt = format || settings.defaultFormat;
  const html = await renderInvoiceHtml(input, fmt);
  // v4.186.0: a printer chosen for this size = straight to it, no Windows dialog (set once, never asked).
  return printHtml(html, fmt, { deviceName: printerForFormat(settings, fmt), silent: printBillSilently(settings, fmt) });
}

/** Digital copies are always the full A4 Tax Invoice, whatever the counter printer is (Android invariant). */
export async function saveInvoicePdf(input: InvoiceRenderInput) {
  const html = await renderInvoiceHtml(input, 'a4');
  const fileName = `Kamai_Invoice_${safeFileName(input.sale.invoice_number, 'Bill')}.pdf`;
  return saveHtmlAsPdf(html, fileName, 'Invoices');
}
