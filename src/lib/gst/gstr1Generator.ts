// Comprehensive GSTR-1 & HSN Tax Engine for Indian GST Portal Compliance
import { Sale, Business, Customer } from '@/types';
import { isEstimate, isRevenueSale, getLineTaxablePaise, getReturnedQtyByLine, getSaleNetTotal } from '@/lib/sales/saleMath';
import { stateCodeFromGstin, stateNameFromCode } from '@/lib/gst/stateCodes';
import { localDateKey } from '@/lib/reports/cashDrawer';
import { splitIntraStateTax } from '@/lib/gst/taxSplit';

export interface HSNRecord {
  hsn_code: string;
  description: string;
  uqc: string; // Unit Quantity Code: KGS, PCS, BOX, LTR, PKT
  total_qty: number;
  total_value: number; // in paise
  taxable_value: number; // in paise
  tax_rate: number; // percentage (0, 5, 12, 18, 28)
  cgst_amount: number; // in paise
  sgst_amount: number; // in paise
  igst_amount: number; // in paise
  cess_amount: number; // in paise
}

export interface B2BRecord {
  customer_gstin: string;
  customer_name: string;
  invoice_number: string;
  invoice_date: string;
  invoice_value: number; // in paise
  place_of_supply: string;
  reverse_charge: 'Y' | 'N';
  tax_rate: number;
  taxable_value: number; // in paise
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
}

export interface B2CSRecord {
  place_of_supply: string;
  tax_rate: number;
  total_value: number; // in paise
  taxable_value: number; // in paise
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  cess_amount: number;
}

export interface GSTR1ReportData {
  business_gstin: string;
  business_name: string;
  period: string; // e.g. "082026" or "August 2026"
  hsn_summary: HSNRecord[];
  b2b_invoices: B2BRecord[];
  b2cs_summary: B2CSRecord[];
  nil_rated_value: number; // in paise
  total_taxable_value: number; // in paise
  total_cgst: number; // in paise
  total_sgst: number; // in paise
  total_igst: number; // in paise
  total_invoices_count: number;
  doc_from_num: string;
  doc_to_num: string;
  doc_cancelled_count: number;
}

// Convert units to standard GST Portal Unit Quantity Codes (UQC)
export function getGSTUQC(unit: string): string {
  const u = (unit || '').toLowerCase();
  if (u.includes('kg')) return 'KGS';
  if (u.includes('gram') || u.includes('gm')) return 'GMS';
  if (u.includes('litre') || u.includes('ltr')) return 'LTR';
  if (u.includes('ml')) return 'MLT';
  if (u.includes('box')) return 'BOX';
  if (u.includes('packet') || u.includes('pkt')) return 'PKT';
  if (u.includes('dozen')) return 'DOZ';
  if (u.includes('meter')) return 'MTR';
  if (u.includes('piece') || u.includes('pcs')) return 'PCS';
  return 'OTH';
}

/**
 * Generate GSTR-1 & HSN breakdown from Sales and Customers
 */
export function generateGSTR1Report(
  sales: Sale[],
  customers: Customer[],
  business: Business,
  periodLabel: string
): GSTR1ReportData {
  const customerMap = new Map<string, Customer>();
  customers.forEach((c) => customerMap.set(c.id, c));

  // Outward supplies only: estimates are not supplies and fully returned bills are
  // excluded (Android parity); partially returned bills count what the customer kept.
  const validSales = sales.filter(isRevenueSale);
  // Never a made-up GSTIN: a report for a store without one shows it as missing.
  const businessGstin = (business.gstin || '').trim().toUpperCase();
  const businessStateCode = stateCodeFromGstin(businessGstin);

  // 1. Process HSN Summary (Table 12)
  const hsnMap = new Map<string, HSNRecord>();
  let totalTaxablePaise = 0;
  let nilRatedPaise = 0;

  // 2. Process B2B (Table 4, one row per invoice and rate) vs B2CS (Table 7)
  const b2bMap = new Map<string, B2BRecord>();
  const b2csMap = new Map<string, B2CSRecord>();

  // Intra-state tax of each row, split into CGST + SGST only once the row is complete (K-D40,
  // v4.99.0): splitting every line gave CGST the odd paisa line after line.
  const intraTax = new Map<HSNRecord | B2BRecord | B2CSRecord, number>();
  const addIntra = (row: HSNRecord | B2BRecord | B2CSRecord, tax: number) => intraTax.set(row, (intraTax.get(row) || 0) + tax);

  validSales.forEach((sale) => {
    const cust = sale.customer_id ? customerMap.get(sale.customer_id) : null;
    const buyerGstin = (sale.customer_gstin || cust?.gstin || '').trim().toUpperCase();
    const hasGstin = buyerGstin.length >= 15;
    const customerGstin = hasGstin ? buyerGstin : '';
    const custStateCode = (hasGstin ? stateCodeFromGstin(customerGstin) : '') || businessStateCode;
    const isInterState = Boolean(custStateCode && businessStateCode && custStateCode !== businessStateCode);
    const pos = custStateCode ? `${custStateCode}-${getStateName(custStateCode)}` : '';
    const returnedByLine = getReturnedQtyByLine(sale);

    sale.items.forEach((item, lineIdx) => {
      const hsn = (item.hsn_code || '').trim(); // left blank rather than guessed — fix it on the product
      const rate = item.tax_rate || 0;
      // Share of the line the customer kept (partial returns).
      const kept = item.quantity > 0 ? Math.max(0, item.quantity - (returnedByLine[lineIdx] || 0)) / item.quantity : 1;
      if (kept <= 0) return;

      // Taxable value and GST exactly as billed (inclusive or exclusive pricing, discounts applied).
      const taxable = Math.round(getLineTaxablePaise(item) * kept);
      const tax = Math.round((item.tax_amount || 0) * kept);
      const totalAmount = taxable + tax;
      if (rate <= 0) {
        nilRatedPaise += totalAmount;
      }

      const intra = isInterState ? 0 : tax;
      const igst = isInterState ? tax : 0;

      totalTaxablePaise += taxable;

      // Update HSN map
      const hsnKey = `${hsn}_${rate}`;
      if (hsnMap.has(hsnKey)) {
        const existing = hsnMap.get(hsnKey)!;
        existing.total_qty += item.quantity * kept;
        existing.total_value += totalAmount;
        existing.taxable_value += taxable;
        existing.igst_amount += igst;
        addIntra(existing, intra);
      } else {
        const row: HSNRecord = {
          hsn_code: hsn,
          description: item.product_name,
          uqc: getGSTUQC(item.unit),
          total_qty: item.quantity * kept,
          total_value: totalAmount,
          taxable_value: taxable,
          tax_rate: rate,
          cgst_amount: 0,
          sgst_amount: 0,
          igst_amount: igst,
          cess_amount: 0,
        };
        hsnMap.set(hsnKey, row);
        addIntra(row, intra);
      }

      // If B2B (Table 4)
      if (hasGstin) {
        const b2bKey = `${sale.id}_${rate}`;
        const existing = b2bMap.get(b2bKey);
        if (existing) {
          existing.taxable_value += taxable;
          existing.igst_amount += igst;
          addIntra(existing, intra);
          return;
        }
        const row: B2BRecord = {
          customer_gstin: customerGstin,
          customer_name: cust!.name,
          invoice_number: sale.invoice_number,
          invoice_date: localDateKey(new Date(sale.created_at)),
          invoice_value: getSaleNetTotal(sale),
          place_of_supply: pos,
          reverse_charge: 'N',
          tax_rate: rate,
          taxable_value: taxable,
          cgst_amount: 0,
          sgst_amount: 0,
          igst_amount: igst,
        };
        b2bMap.set(b2bKey, row);
        addIntra(row, intra);
      } else {
        // B2CS Retail (Table 7)
        const b2csKey = `${pos}_${rate}`;
        if (b2csMap.has(b2csKey)) {
          const existing = b2csMap.get(b2csKey)!;
          existing.total_value += totalAmount;
          existing.taxable_value += taxable;
          existing.igst_amount += igst;
          addIntra(existing, intra);
        } else {
          const row: B2CSRecord = {
            place_of_supply: pos,
            tax_rate: rate,
            total_value: totalAmount,
            taxable_value: taxable,
            cgst_amount: 0,
            sgst_amount: 0,
            igst_amount: igst,
            cess_amount: 0,
          };
          b2csMap.set(b2csKey, row);
          addIntra(row, intra);
        }
      }
    });
  });

  intraTax.forEach((tax, row) => {
    const { cgst, sgst } = splitIntraStateTax(tax);
    row.cgst_amount = cgst;
    row.sgst_amount = sgst;
  });
  // Totals are the HSN rows added up: every billed line is in exactly one of them.
  const hsnRows = Array.from(hsnMap.values());
  const sum = (key: 'cgst_amount' | 'sgst_amount' | 'igst_amount') => hsnRows.reduce((acc, h) => acc + h[key], 0);

  // Documents issued: real tax invoices only (estimates are not documents under GST).
  const sortedSales = sales
    .filter((s) => !isEstimate(s))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const docFrom = sortedSales.length > 0 ? sortedSales[0].invoice_number : '';
  const docTo = sortedSales.length > 0 ? sortedSales[sortedSales.length - 1].invoice_number : '';
  const cancelledCount = sales.filter((s) => s.status === 'cancelled').length;

  return {
    business_gstin: businessGstin,
    business_name: business.name,
    period: periodLabel,
    hsn_summary: hsnRows,
    b2b_invoices: Array.from(b2bMap.values()),
    b2cs_summary: Array.from(b2csMap.values()),
    nil_rated_value: nilRatedPaise,
    total_taxable_value: totalTaxablePaise,
    total_cgst: sum('cgst_amount'),
    total_sgst: sum('sgst_amount'),
    total_igst: sum('igst_amount'),
    // Table 13 "total number": every tax invoice of the series, cancelled ones included
    // (net issued = total − cancelled). Before v4.78.0 cancelled bills were left out here
    // and then subtracted again.
    total_invoices_count: sortedSales.length,
    doc_from_num: docFrom,
    doc_to_num: docTo,
    doc_cancelled_count: cancelledCount,
  };
}

export function getStateName(code: string): string {
  // Full official list; an unknown code is shown as-is instead of being called Maharashtra.
  return stateNameFromCode(code) || code;
}

/**
 * Export Official GSTR-1 Excel / CSV format
 */
export function generateGSTR1CSV(data: GSTR1ReportData): string {
  let csv = '';

  // HEADER
  csv += `GSTR-1 MONTHLY TAX RETURN REPORT\n`;
  csv += `Business Name:,${data.business_name}\n`;
  csv += `GSTIN:,${data.business_gstin}\n`;
  csv += `Tax Period:,${data.period}\n`;
  csv += `Total Taxable Value (Rs):,${(data.total_taxable_value / 100).toFixed(2)}\n`;
  csv += `Total CGST (Rs):,${(data.total_cgst / 100).toFixed(2)}\n`;
  csv += `Total SGST (Rs):,${(data.total_sgst / 100).toFixed(2)}\n`;
  csv += `Total IGST (Rs):,${(data.total_igst / 100).toFixed(2)}\n\n`;

  // SECTION 1: TABLE 12 HSN SUMMARY
  csv += `=== TABLE 12: HSN-WISE SUMMARY OF OUTWARD SUPPLIES ===\n`;
  csv += `HSN Code,Description,UQC,Total Qty,Total Value (Rs),Taxable Value (Rs),Rate (%),CGST (Rs),SGST (Rs),IGST (Rs),Cess (Rs)\n`;
  data.hsn_summary.forEach((h) => {
    csv += `"${h.hsn_code}","${h.description.replace(/"/g, '""')}",${h.uqc},${h.total_qty},${(h.total_value / 100).toFixed(2)},${(h.taxable_value / 100).toFixed(2)},${h.tax_rate}%,${(h.cgst_amount / 100).toFixed(2)},${(h.sgst_amount / 100).toFixed(2)},${(h.igst_amount / 100).toFixed(2)},0.00\n`;
  });
  csv += `\n`;

  // SECTION 2: TABLE 7 B2CS SMALL RETAIL
  csv += `=== TABLE 7: B2CS (SMALL RETAIL SUPPLIES) ===\n`;
  csv += `Type,Place of Supply,Rate (%),Taxable Value (Rs),Cess (Rs),CGST (Rs),SGST (Rs),IGST (Rs)\n`;
  data.b2cs_summary.forEach((b) => {
    csv += `OE,"${b.place_of_supply}",${b.tax_rate}%,${(b.taxable_value / 100).toFixed(2)},0.00,${(b.cgst_amount / 100).toFixed(2)},${(b.sgst_amount / 100).toFixed(2)},${(b.igst_amount / 100).toFixed(2)}\n`;
  });
  csv += `\n`;

  // SECTION 3: TABLE 4 B2B INVOICES
  csv += `=== TABLE 4: B2B INVOICES ===\n`;
  csv += `GSTIN of Recipient,Receiver Name,Invoice Number,Invoice Date,Invoice Value (Rs),Place of Supply,Reverse Charge,Rate (%),Taxable Value (Rs),CGST (Rs),SGST (Rs),IGST (Rs)\n`;
  data.b2b_invoices.forEach((b) => {
    csv += `"${b.customer_gstin}","${b.customer_name}",${b.invoice_number},${b.invoice_date},${(b.invoice_value / 100).toFixed(2)},"${b.place_of_supply}",${b.reverse_charge},${b.tax_rate}%,${(b.taxable_value / 100).toFixed(2)},${(b.cgst_amount / 100).toFixed(2)},${(b.sgst_amount / 100).toFixed(2)},${(b.igst_amount / 100).toFixed(2)}\n`;
  });
  csv += `\n`;

  // SECTION 4: TABLE 13 DOCUMENTS ISSUED
  csv += `=== TABLE 13: DOCUMENTS ISSUED SUMMARY ===\n`;
  csv += `Nature of Document,From Serial No,To Serial No,Total Number,Cancelled Number,Net Issued\n`;
  csv += `Invoices for Outward Supply,${data.doc_from_num},${data.doc_to_num},${data.total_invoices_count},${data.doc_cancelled_count},${data.total_invoices_count - data.doc_cancelled_count}\n`;

  return csv;
}

// The portal / offline-tool JSON is built from the bills in lib/gst/gstr1Json.ts
// (the old builder here repeated invoices per line and always said period 082026).
