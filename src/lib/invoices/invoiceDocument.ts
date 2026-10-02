import { Business, CartItem, Customer, InvoiceThemeConfig, Sale } from '@/types';
import { formatINR } from '@/lib/utils';
import { numberToWordsINR } from '@/lib/invoices/gstCalculator';
import { resolveInvoiceConfig } from '@/lib/invoices/themeDefaults';
import { placeOfSupplyLabel, stateCodeFromGstin, stateNameFromCode } from '@/lib/gst/stateCodes';
import {
  getLineGrossPaise,
  getLineTaxablePaise,
  getSalePaymentBreakdown,
  isEstimate,
} from '@/lib/sales/saleMath';

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

const UNIT_SHORT: Record<string, string> = {
  piece: 'pcs',
  kg: 'kg',
  gram: 'g',
  litre: 'L',
  ml: 'ml',
  box: 'box',
  packet: 'pkt',
  strip: 'strip',
  plate: 'plate',
  portion: 'portion',
  pair: 'pair',
  set: 'set',
  bundle: 'bdl',
  dozen: 'dz',
  meter: 'm',
  foot: 'ft',
  sqft: 'sqft',
  bottle: 'btl',
  can: 'can',
  bag: 'bag',
};

export function formatQty(qty: number): string {
  const q = Number(qty) || 0;
  if (Number.isInteger(q)) return String(q);
  return q.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function formatRate(rate: number): string {
  return Number.isInteger(rate) ? `${rate}%` : `${rate.toFixed(1)}%`;
}

function formatHalfRate(rate: number): string {
  return `${(rate / 2).toFixed(1)}%`;
}

/** "21 Sep 2026, 05:47 PM" — the Android invoice date format. */
export function formatInvoiceDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
  return `${date}, ${time}`;
}

const METHOD_LABEL: Record<string, string> = {
  cash: 'CASH',
  upi: 'UPI',
  card: 'CARD',
  bank_transfer: 'BANK',
  credit: 'CREDIT',
  split: 'SPLIT',
};

function paymentBadge(sale: Sale): { label: string; tone: PaymentTone } {
  if (isEstimate(sale)) return { label: 'ESTIMATE • NOT A TAX INVOICE', tone: 'estimate' };
  if (sale.status === 'returned') return { label: '● RETURNED', tone: 'returned' };
  const method = METHOD_LABEL[sale.payment_method] || (sale.payment_method || 'cash').toUpperCase();
  const due = Math.max(0, sale.balance_due || 0);
  if (due <= 0) return { label: `● PAID (${method})`, tone: 'paid' };
  if (due >= sale.grand_total) return { label: '● UNPAID (CREDIT)', tone: 'unpaid' };
  const via = sale.payment_method === 'credit' ? '' : ` (${method})`;
  return { label: `● PARTIAL${via} • DUE ${formatINR(due)}`, tone: 'partial' };
}

function lineMeta(item: CartItem): string[] {
  const meta: string[] = [];
  const attrs = [
    item.size ? `Size: ${item.size}` : '',
    item.color ? `Color: ${item.color}` : '',
    item.imei_serial ? `IMEI/SN: ${item.imei_serial}` : '',
    item.warranty_period_months ? `Warranty: ${item.warranty_period_months} months` : '',
  ].filter(Boolean);
  if (attrs.length) meta.push(attrs.join(' • '));
  if ((item.discount_amount || 0) > 0) meta.push(`Discount −${formatINR(item.discount_amount)}`);
  if ((item.returned_quantity || 0) > 0) meta.push(`Returned ${formatQty(item.returned_quantity || 0)}`);
  if (item.notes) meta.push(item.notes);
  return meta;
}

/**
 * Page split with the Android engine's budget: up to 14 rows fit on one page
 * together with the tax summary; otherwise 20 on page one, up to 26 on middle
 * pages and at most 14 on the last page (which also carries the summary).
 * Rows with extra detail lines weigh more so long bills never collide.
 */
export function paginateInvoiceRows(rows: InvoiceRow[]): InvoiceRow[][] {
  const weight = (r: InvoiceRow) => 1 + 0.45 * r.meta.length;
  const total = rows.reduce((acc, r) => acc + weight(r), 0);
  if (total <= 14) return [rows];

  const pages: InvoiceRow[][] = [];
  let idx = 0;
  const take = (capacity: number) => {
    const page: InvoiceRow[] = [];
    let used = 0;
    while (idx < rows.length && (page.length === 0 || used + weight(rows[idx]) <= capacity)) {
      used += weight(rows[idx]);
      page.push(rows[idx++]);
    }
    return page;
  };
  const remainingWeight = () => rows.slice(idx).reduce((acc, r) => acc + weight(r), 0);

  pages.push(take(20));
  while (idx < rows.length) {
    const remaining = remainingWeight();
    if (remaining <= 14) {
      pages.push(rows.slice(idx));
      idx = rows.length;
    } else if (remaining <= 26 + 14) {
      // Split what is left so the last page (which also carries the tax summary,
      // totals and signatory) never gets more than 14 rows — nor only a couple.
      pages.push(take(remaining - Math.min(14, Math.max(4, Math.ceil(remaining / 2)))));
    } else {
      pages.push(take(26));
    }
  }
  return pages;
}

export function buildInvoiceDocument(sale: Sale, business: Business, options: BuildInvoiceOptions = {}): InvoiceDocument {
  const config = options.config || resolveInvoiceConfig(business);
  const estimate = isEstimate(sale);
  const items = sale.items || [];

  const storeGstin = (business.gstin || '').trim().toUpperCase();
  const storeState = stateCodeFromGstin(storeGstin);
  const customerGstin = (sale.customer_gstin || options.customer?.gstin || '').trim().toUpperCase();
  const customerState = stateCodeFromGstin(customerGstin);
  const isB2B = customerGstin.length >= 15;
  const isInterState = Boolean(isB2B && storeState && customerState && storeState !== customerState);
  const placeOfSupply = placeOfSupplyLabel(customerState || storeState);

  const hasGst = items.some((i) => (i.tax_amount || 0) > 0) || (sale.tax_total || 0) > 0;
  const statutory = !estimate && (isB2B || hasGst);
  const showHsn = statutory && config.show_hsn_code !== false;

  // Store block
  const contactParts: string[] = [];
  const phones = storePhones(business);
  const phoneLine = config.show_owner && phones ? `Ph: ${phones}` : '';
  if (phoneLine) contactParts.push(phoneLine);
  if (storeGstin) contactParts.push(`GSTIN: ${storeGstin}${stateNameFromCode(storeState) ? ` (${stateNameFromCode(storeState)})` : ''}`);
  // The pharmacy D.L. / pharmacist line was taken out of Invoice Themes (v4.91.0, Customer
  // Change) — a switch saved on before that no longer prints it.
  const licenseParts: string[] = [];
  if (config.fssai_license_no) licenseParts.push(`FSSAI: ${config.fssai_license_no}`);
  const ownerLine = config.show_owner && business.owner_name ? business.owner_name : '';

  // Billed-to block
  const detailParts: string[] = [];
  if (sale.customer_phone) detailParts.push(`Ph: ${sale.customer_phone}`);

  // Rows
  const rows: InvoiceRow[] = items.map((item, idx) => {
    const taxable = getLineTaxablePaise(item);
    const gross = getLineGrossPaise(item);
    const rate = item.tax_rate || 0;
    const unit = UNIT_SHORT[item.unit] || item.unit || '';
    return {
      sno: idx + 1,
      name: item.product_name || 'Item',
      meta: lineMeta(item),
      hsn: (item.hsn_code || '').trim() || '-',
      qty: `${formatQty(item.quantity)}${unit ? ` ${unit}` : ''}`,
      rate: formatINR(item.unit_price),
      taxable: formatINR(taxable),
      gstAmount: formatINR(item.tax_amount || 0),
      gstRate: rate > 0 ? formatRate(rate) : '0%',
      total: formatINR(gross),
    };
  });

  // GST slab summary (grouped by rate, HSN codes listed like the Android PDF)
  const slabMap = new Map<number, { hsns: Set<string>; taxable: number; tax: number }>();
  for (const item of items) {
    const rate = item.tax_rate || 0;
    if (rate <= 0) continue;
    const entry = slabMap.get(rate) || { hsns: new Set<string>(), taxable: 0, tax: 0 };
    if (item.hsn_code && item.hsn_code.trim()) entry.hsns.add(item.hsn_code.trim());
    entry.taxable += getLineTaxablePaise(item);
    entry.tax += item.tax_amount || 0;
    slabMap.set(rate, entry);
  }
  const taxSlabs: InvoiceTaxSlab[] = Array.from(slabMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([rate, s]) => {
      const cgst = isInterState ? 0 : Math.floor(s.tax / 2);
      const sgst = isInterState ? 0 : s.tax - cgst;
      const hsnText = s.hsns.size > 0 ? Array.from(s.hsns).join(', ') : 'GST';
      return {
        label: `${hsnText} (${formatRate(rate)})`,
        rate: formatRate(rate),
        taxable: formatINR(s.taxable),
        cgstRate: isInterState ? '-' : formatHalfRate(rate),
        cgstAmount: isInterState ? '-' : formatINR(cgst),
        sgstRate: isInterState ? '-' : formatHalfRate(rate),
        sgstAmount: isInterState ? '-' : formatINR(sgst),
        igstRate: isInterState ? formatRate(rate) : '-',
        igstAmount: isInterState ? formatINR(s.tax) : '-',
        totalTax: formatINR(s.tax),
      };
    });

  // Totals
  const sumTaxable = items.reduce((acc, i) => acc + getLineTaxablePaise(i), 0);
  const sumGross = items.reduce((acc, i) => acc + getLineGrossPaise(i), 0);
  const sumLineDiscount = items.reduce((acc, i) => acc + (i.discount_amount || 0), 0);
  // Bills saved before bill discounts were spread over the lines keep it at bill level.
  const legacyBillDiscount = Math.max(0, sumGross - (sale.grand_total || 0));
  const taxTotal = sale.tax_total || items.reduce((acc, i) => acc + (i.tax_amount || 0), 0);

  const totals: InvoiceTotalLine[] = [];
  if (statutory) {
    totals.push({ label: 'Taxable Value:', value: formatINR(Math.max(0, sumTaxable - legacyBillDiscount)) });
    if (legacyBillDiscount > 0) totals.push({ label: 'Bill Discount:', value: `−${formatINR(legacyBillDiscount)}`, tone: 'discount' });
    if (isInterState) {
      totals.push({ label: 'IGST:', value: formatINR(taxTotal) });
    } else if (taxTotal > 0) {
      const cgst = Math.floor(taxTotal / 2);
      totals.push({ label: 'CGST:', value: formatINR(cgst) });
      totals.push({ label: 'SGST:', value: formatINR(taxTotal - cgst) });
    }
  } else {
    const gross = items.reduce((acc, i) => acc + Math.round((i.unit_price || 0) * (i.quantity || 0)), 0);
    totals.push({ label: 'Subtotal:', value: formatINR(gross) });
    const discount = sumLineDiscount + legacyBillDiscount;
    if (discount > 0) totals.push({ label: 'Discount:', value: `−${formatINR(discount)}`, tone: 'discount' });
  }

  const afterTotals: InvoiceTotalLine[] = [];
  const pay = getSalePaymentBreakdown(sale);
  let splitText = '';
  if (!estimate) {
    if (sale.payment_method === 'split') {
      splitText = [
        pay.cash > 0 ? `Cash ${formatINR(pay.cash)}` : '',
        pay.upi > 0 ? `UPI ${formatINR(pay.upi)}` : '',
        pay.card > 0 ? `Card ${formatINR(pay.card)}` : '',
        pay.credit > 0 ? `Udhar ${formatINR(pay.credit)}` : '',
      ].filter(Boolean).join(' • ');
    }
    const due = Math.max(0, sale.balance_due || 0);
    if (due > 0) {
      afterTotals.push({ label: 'Amount Paid:', value: formatINR(Math.max(0, sale.grand_total - due)) });
      afterTotals.push({ label: 'Balance Due (Udhar):', value: formatINR(due), tone: 'due' });
    }
    if ((sale.change_returned || 0) > 0) {
      afterTotals.push({ label: 'Cash Received:', value: formatINR(sale.amount_received), tone: 'muted' });
      afterTotals.push({ label: 'Change Returned:', value: formatINR(sale.change_returned), tone: 'muted' });
    }
    if ((sale.returned_amount || 0) > 0) {
      afterTotals.push({ label: 'Refunded (Return):', value: `−${formatINR(sale.returned_amount || 0)}`, tone: 'discount' });
    }
  }

  let savingsText = '';
  if (config.show_mrp_savings) {
    const mrpSavings = items.reduce((acc, i) => {
      const diff = (i.mrp || 0) - (i.unit_price || 0);
      return acc + (diff > 0 ? Math.round(diff * (i.quantity || 0)) : 0);
    }, 0);
    const saved = mrpSavings + sumLineDiscount + legacyBillDiscount;
    if (saved > 0) savingsText = `You saved ${formatINR(saved)} on this bill`;
  }

  const upiVpa = (options.upiVpa || '').trim();
  const heading = estimate ? 'ESTIMATE / QUOTATION' : config.custom_title || 'TAX INVOICE';

  return {
    color: config.primary_color,
    heading,
    isEstimate: estimate,
    store: {
      name: business.name || 'My Store',
      tagline: config.show_tagline ? (business.tagline || '').trim() : '',
      address: [business.address, business.pincode].filter((p) => p && String(p).trim()).join(' - '),
      contactLine: [ownerLine, ...contactParts].filter(Boolean).join('  •  '),
      phoneLine,
      ownerName: ownerLine,
      licenseLine: licenseParts.join('   '),
      logoUrl: config.show_logo ? business.logo_url || '' : '',
    },
    invoiceNumber: sale.invoice_number,
    dateText: formatInvoiceDate(sale.created_at),
    placeOfSupply: statutory ? placeOfSupply : '',
    billedTo: {
      name: (sale.customer_name || '').trim() || 'Cash Customer',
      details: detailParts.join('   '),
      address: (sale.customer_address || options.customer?.address || '').trim(),
      gstinLine: isB2B ? `Buyer GSTIN: ${customerGstin}${customerState ? `  •  State: ${placeOfSupplyLabel(customerState)}` : ''}` : '',
    },
    isB2B,
    isInterState,
    payment: { ...paymentBadge(sale), splitText },
    statutory,
    showHsn,
    rows,
    pages: paginateInvoiceRows(rows),
    amountInWords: `Indian ${numberToWordsINR(sale.grand_total || 0)}.`,
    showTaxSlabs: statutory && config.show_gst_breakup !== false && taxSlabs.length > 0,
    taxSlabs,
    totals,
    grandTotal: formatINR(sale.grand_total || 0),
    afterTotals,
    savingsText,
    upi: {
      show: !estimate && Boolean(config.show_upi_qr) && upiVpa.length > 0,
      vpa: upiVpa,
      qrDataUrl: options.qrDataUrl || '',
    },
    terms: config.show_terms
      ? (config.custom_terms || '')
          .split('\n')
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 4)
      : [],
    footerNote: (config.custom_footer || '').trim(),
    showSignatory: config.show_signature !== false && !estimate,
    signatoryName: business.name || 'Store',
    thermal: {
      showTagline: Boolean(config.show_tagline),
      showPhone: Boolean(config.show_owner),
      showUpi: !estimate && Boolean(config.show_upi_qr) && config.show_upi_qr_thermal !== false && upiVpa.length > 0,
    },
  };
}

/** The shop's contact numbers for a bill: "9876543210, 9123456780" (second one only when set and different). */
export function storePhones(business?: Pick<Business, 'phone' | 'phone2'> | null): string {
  const first = (business?.phone || '').trim();
  const second = (business?.phone2 || '').trim();
  return [first, second && second !== first ? second : ''].filter(Boolean).join(', ');
}

/** The UPI VPA a bill should be paid to: the default shop UPI, else the first one. */
export function getPrimaryUpiVpa(business?: Business | null): string {
  if (!business) return '';
  const list = business.upi_ids || [];
  const preferred = list.find((u) => u.is_default) || list[0];
  return (preferred?.upi_id || business.upi_id || '').trim();
}
