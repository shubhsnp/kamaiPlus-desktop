import { Business, Customer, Sale, SalesReturn } from '@/types';
import { breakupSales, registerDate } from './saleBreakup';

export interface CAExportOptions {
  business: Business | null | undefined;
  sales: Sale[];
  customers?: Customer[];
  returns?: SalesReturn[];
  /** Only bills inside these dates (none = all). */
  range?: { start: Date; end: Date };
  /** Goes into the file name, e.g. "Sep_2026". */
  periodName?: string;
}

// Byte-order mark: Excel then reads the file as UTF-8 (Hindi / Marathi names).
const BOM = String.fromCharCode(0xfeff);
const rs = (paise: number) => (Math.round(paise || 0) / 100).toFixed(2);
const cell = (v: string | number) => (typeof v === 'number' ? String(v) : `"${String(v ?? '').replace(/"/g, '""')}"`);

/**
 * CA sales register (CSV, opens in Excel) — v4.78.0. One row per bill of the period, the
 * same figures as the GSTR-1 file (lib/tally/saleBreakup.ts): the buyer's own GSTIN and
 * place of supply, CGST + SGST or IGST, values net of returns, and how it was paid. Before,
 * the shop's own GSTIN sat in the buyer column, estimates were counted, every bill was
 * "Intra-State" and the discount total was always 0. Starts with a BOM so Excel shows
 * Hindi / Marathi names.
 */
export function generateCASalesRegisterCSV(options: CAExportOptions): { csv: string; filename: string; count: number } {
  const { business, sales, customers = [], returns = [], range, periodName = 'All' } = options;
  const storeName = business?.name || 'My Store';
  const rows = breakupSales(sales, { shopGstin: business?.gstin || '', customers, returns }, range);

  const headers = [
    'Sl No', 'Invoice Date', 'Invoice Number', 'Customer Name', 'Customer Phone', 'Customer GSTIN', 'Place of Supply', 'Supply Type',
    'Taxable Value (Rs)', 'CGST (Rs)', 'SGST (Rs)', 'IGST (Rs)', 'Total Tax (Rs)', 'Invoice Value (Rs)', 'Returned (Rs)', 'Discount Given (Rs)',
    'Cash (Rs)', 'UPI / Card (Rs)', 'Udhar (Rs)', 'Payment Status',
  ];
  const sum = { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0, returned: 0, discount: 0, cash: 0, bank: 0, credit: 0 };
  const lines = rows.map((b, i) => {
    const tax = b.cgst + b.sgst + b.igst;
    sum.taxable += b.taxable; sum.cgst += b.cgst; sum.sgst += b.sgst; sum.igst += b.igst; sum.total += b.total;
    sum.returned += b.returned; sum.discount += b.sale.discount_total || 0;
    sum.cash += b.pay.cash; sum.bank += b.pay.bank; sum.credit += b.pay.credit;
    return [
      i + 1, cell(registerDate(b.sale.created_at)), cell(b.sale.invoice_number), cell(b.buyerName), cell(b.sale.customer_phone || ''), cell(b.buyerGstin),
      cell(b.placeOfSupply), cell(b.inter ? 'Inter-State' : 'Intra-State'),
      rs(b.taxable), rs(b.cgst), rs(b.sgst), rs(b.igst), rs(tax), rs(b.total), rs(b.returned), rs(b.sale.discount_total || 0),
      rs(b.pay.cash), rs(b.pay.bank), rs(b.pay.credit), cell((b.sale.payment_status || '').toUpperCase()),
    ].join(',');
  });
  const totals = [
    cell('TOTAL'), cell(''), cell(`${rows.length} bills`), cell(''), cell(''), cell(''), cell(''), cell(''),
    rs(sum.taxable), rs(sum.cgst), rs(sum.sgst), rs(sum.igst), rs(sum.cgst + sum.sgst + sum.igst), rs(sum.total), rs(sum.returned), rs(sum.discount),
    rs(sum.cash), rs(sum.bank), rs(sum.credit), cell(''),
  ].join(',');

  const csv = BOM + [headers.map(cell).join(','), ...lines, totals].join('\r\n');
  const cleanStore = storeName.replace(/[^a-zA-Z0-9]/g, '_');
  return { csv, filename: `${cleanStore}_CA_Sales_Register_${periodName.replace(/[^a-zA-Z0-9]/g, '_')}.csv`, count: rows.length };
}
