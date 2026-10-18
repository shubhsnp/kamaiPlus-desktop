import type { Customer, InvoiceThemeConfig } from '@/types';

/* The invoice document's data shapes (own file since v4.104.0, K-D23; invoiceDocument re-exports them). */

/**
 * Everything an invoice renderer needs, already computed — the web equivalent of
 * the argument map the Android app hands its native PDF engine. The A4 page, the
 * thermal slip and the ESC/POS printer all render from this, so a setting in
 * Invoice Themes changes every bill the same way.
 */

export interface InvoiceRow {
  sno: number;
  name: string;
  meta: string[];
  hsn: string;
  qty: string;
  rate: string;
  taxable: string;
  gstAmount: string;
  gstRate: string;
  total: string;
}

export interface InvoiceTaxSlab {
  label: string;
  /** "5%" — the slab's GST rate (thermal slip's short GST table). */
  rate: string;
  taxable: string;
  cgstRate: string;
  cgstAmount: string;
  sgstRate: string;
  sgstAmount: string;
  igstRate: string;
  igstAmount: string;
  totalTax: string;
}

export interface InvoiceTotalLine {
  label: string;
  value: string;
  tone?: 'default' | 'discount' | 'due' | 'muted';
}

export type PaymentTone = 'paid' | 'partial' | 'unpaid' | 'estimate' | 'returned';

export interface InvoiceDocument {
  color: string;
  heading: string;
  isEstimate: boolean;
  store: {
    name: string;
    tagline: string;
    address: string;
    contactLine: string;
    /** "Ph: 98…, 97…" — both shop numbers, '' when "Show Owner & Phone" is off. */
    phoneLine: string;
    /** Owner name, '' when "Show Owner & Phone" is off. */
    ownerName: string;
    licenseLine: string;
    logoUrl: string;
  };
  invoiceNumber: string;
  dateText: string;
  placeOfSupply: string;
  billedTo: {
    name: string;
    details: string;
    address: string;
    gstinLine: string;
  };
  isB2B: boolean;
  isInterState: boolean;
  payment: { label: string; tone: PaymentTone; splitText: string };
  statutory: boolean;
  showHsn: boolean;
  rows: InvoiceRow[];
  /** v4.180.0 (Customer Change): lines on the bill and the quantity they add up to — every output prints them. */
  itemCount: number;
  totalQty: string;
  pages: InvoiceRow[][];
  amountInWords: string;
  showTaxSlabs: boolean;
  taxSlabs: InvoiceTaxSlab[];
  totals: InvoiceTotalLine[];
  grandTotal: string;
  afterTotals: InvoiceTotalLine[];
  savingsText: string;
  upi: { show: boolean; vpa: string; qrDataUrl: string };
  terms: string[];
  footerNote: string;
  showSignatory: boolean;
  signatoryName: string;
  thermal: {
    showTagline: boolean;
    showPhone: boolean;
    /** UPI QR on the 58 / 80 mm slip: "Show UPI QR" on AND "Also on thermal slips" on (v4.91.0). */
    showUpi: boolean;
  };
}

export interface BuildInvoiceOptions {
  config?: InvoiceThemeConfig;
  customer?: Customer | null;
  upiVpa?: string;
  qrDataUrl?: string;
}
