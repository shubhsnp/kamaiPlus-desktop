// Comprehensive GSTR-1 & HSN Tax Engine for Indian GST Portal Compliance
import { Sale, Business, Customer, SalesReturn } from '@/types';
import { isEstimate } from '@/lib/sales/saleMath';
import { stateNameFromCode } from '@/lib/gst/stateCodes';
import { periodSupplies } from '@/lib/gst/periodSupplies';
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

/** A B2B credit note (goods returned by a registered buyer), one row per note and rate — GSTR-1 table 9B. */
export interface CreditNoteRecord {
  customer_gstin: string;
  customer_name: string;
  note_number: string;
  note_date: string;
  /** The bill the goods came from. */
  invoice_number: string;
  place_of_supply: string;
  tax_rate: number;
  taxable_value: number; // in paise
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
}

export interface GSTR1ReportData {
  business_gstin: string;
  business_name: string;
  period: string; // e.g. "082026" or "August 2026"
  hsn_summary: HSNRecord[];
  b2b_invoices: B2BRecord[];
  b2b_credit_notes: CreditNoteRecord[];
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
  /** Credit notes (returns) issued in the period. */
  credit_notes_count: number;
  credit_note_from: string;
  credit_note_to: string;
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
  // GST's own codes for the app's Bottle, Can / Tin and Bag / Sack units (v4.101.0; they were OTH).
  if (u.includes('bottle')) return 'BTL';
  if (u === 'can' || u.includes('tin')) return 'CAN';
  if (u === 'bag' || u.includes('sack')) return 'BAG';
  return 'OTH';
}

/**
 * GSTR-1 & HSN breakdown of a period, for the GST screen and its CSV. Built from the same
 * lines as the GSTR-1 JSON (lib/gst/periodSupplies.ts): bills in full, goods returned in the
 * period as credit notes — B2B ones listed as credit notes, B2C ones lowering the B2C rows,
 * HSN net of both (v4.101.0, K-D04). Without `opts.returns` there are no credit notes.
 */
export function generateGSTR1Report(
  sales: Sale[],
  customers: Customer[],
  business: Business,
  periodLabel: string,
  opts: { returns?: SalesReturn[]; originals?: Sale[]; start?: Date; end?: Date } = {}
): GSTR1ReportData {
  const customerMap = new Map<string, Customer>();
  customers.forEach((c) => customerMap.set(c.id, c));
  // Never a made-up GSTIN: a report for a store without one shows it as missing.
  const businessGstin = (business.gstin || '').trim().toUpperCase();
  const supplies = periodSupplies({
    sales, customers, shopGstin: businessGstin,
    returns: opts.returns || [], originals: opts.originals,
    start: opts.start || new Date(0), end: opts.end || new Date(8.64e15),
  });

  const hsnMap = new Map<string, HSNRecord>();
  const b2bMap = new Map<string, B2BRecord>();
  const cnMap = new Map<string, CreditNoteRecord>();
  const b2csMap = new Map<string, B2CSRecord>();
  let totalTaxablePaise = 0;
  let nilRatedPaise = 0;

  // Intra-state tax of each row, split into CGST + SGST only once the row is complete (K-D40,
  // v4.99.0): splitting every line gave CGST the odd paisa line after line.
  type Row = HSNRecord | B2BRecord | B2CSRecord | CreditNoteRecord;
  const intraTax = new Map<Row, number>();
  const addIntra = (row: Row, tax: number) => intraTax.set(row, (intraTax.get(row) || 0) + tax);

  for (const line of [...supplies.invoices, ...supplies.creditNotes]) {
    const { sale, ret, rt } = line;
    const registered = Boolean(line.buyerGstin);
    const pos = line.pos ? `${line.pos}-${getStateName(line.pos)}` : '';
    const totalAmount = line.taxable + line.tax;
    if (rt <= 0) nilRatedPaise += totalAmount;
    const intra = line.inter ? 0 : line.tax;
    const igst = line.inter ? line.tax : 0;
    totalTaxablePaise += line.taxable;

    // HSN summary (Table 12), net of credit notes.
    const hsnKey = `${line.hsn}_${rt}`;
    const h = hsnMap.get(hsnKey);
    if (h) {
      h.total_qty += line.qty;
      h.total_value += totalAmount;
      h.taxable_value += line.taxable;
      h.igst_amount += igst;
      addIntra(h, intra);
    } else {
      const row: HSNRecord = {
        hsn_code: line.hsn, description: line.desc, uqc: getGSTUQC(line.unit), total_qty: line.qty,
        total_value: totalAmount, taxable_value: line.taxable, tax_rate: rt,
        cgst_amount: 0, sgst_amount: 0, igst_amount: igst, cess_amount: 0,
      };
      hsnMap.set(hsnKey, row);
      addIntra(row, intra);
    }

    if (registered && ret) {
      // B2B credit note (Table 9B): one row per note and rate, amounts shown positive.
      const key = `${ret.id}_${rt}`;
      const existing = cnMap.get(key);
      if (existing) {
        existing.taxable_value -= line.taxable;
        existing.igst_amount -= igst;
        addIntra(existing, -intra);
      } else {
        const row: CreditNoteRecord = {
          customer_gstin: line.buyerGstin, customer_name: sale.customer_name || customerMap.get(sale.customer_id || '')?.name || '',
          note_number: ret.return_number || ret.id, note_date: localDateKey(new Date(ret.created_at)), invoice_number: sale.invoice_number,
          place_of_supply: pos, tax_rate: rt, taxable_value: -line.taxable, cgst_amount: 0, sgst_amount: 0, igst_amount: -igst,
        };
        cnMap.set(key, row);
        addIntra(row, -intra);
      }
    } else if (registered) {
      // B2B invoice (Table 4), one row per invoice and rate, as issued.
      const key = `${sale.id}_${rt}`;
      const existing = b2bMap.get(key);
      if (existing) {
        existing.taxable_value += line.taxable;
        existing.igst_amount += igst;
        addIntra(existing, intra);
      } else {
        const row: B2BRecord = {
          customer_gstin: line.buyerGstin, customer_name: customerMap.get(sale.customer_id || '')?.name || sale.customer_name || '',
          invoice_number: sale.invoice_number, invoice_date: localDateKey(new Date(sale.created_at)), invoice_value: sale.grand_total || 0,
          place_of_supply: pos, reverse_charge: 'N', tax_rate: rt, taxable_value: line.taxable, cgst_amount: 0, sgst_amount: 0, igst_amount: igst,
        };
        b2bMap.set(key, row);
        addIntra(row, intra);
      }
    } else {
      // B2C small (Table 7), net of returns in the period.
      const key = `${pos}_${rt}`;
      const existing = b2csMap.get(key);
      if (existing) {
        existing.total_value += totalAmount;
        existing.taxable_value += line.taxable;
        existing.igst_amount += igst;
        addIntra(existing, intra);
      } else {
        const row: B2CSRecord = {
          place_of_supply: pos, tax_rate: rt, total_value: totalAmount, taxable_value: line.taxable,
          cgst_amount: 0, sgst_amount: 0, igst_amount: igst, cess_amount: 0,
        };
        b2csMap.set(key, row);
        addIntra(row, intra);
      }
    }
  }

  intraTax.forEach((tax, row) => {
    const { cgst, sgst } = splitIntraStateTax(tax);
    row.cgst_amount = cgst;
    row.sgst_amount = sgst;
  });
  // Totals are the HSN rows added up: every billed or returned line is in exactly one of them.
  const hsnRows = Array.from(hsnMap.values());
  const sum = (key: 'cgst_amount' | 'sgst_amount' | 'igst_amount') => hsnRows.reduce((acc, h) => acc + h[key], 0);

  // Documents issued: real tax invoices only (estimates are not documents under GST).
  const sortedSales = sales
    .filter((s) => !isEstimate(s))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const notes = supplies.notes.slice().sort((a, b) => a.created_at.localeCompare(b.created_at));

  return {
    business_gstin: businessGstin,
    business_name: business.name,
    period: periodLabel,
    hsn_summary: hsnRows,
    b2b_invoices: Array.from(b2bMap.values()),
    b2b_credit_notes: Array.from(cnMap.values()),
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
    doc_from_num: sortedSales.length > 0 ? sortedSales[0].invoice_number : '',
    doc_to_num: sortedSales.length > 0 ? sortedSales[sortedSales.length - 1].invoice_number : '',
    doc_cancelled_count: sales.filter((s) => s.status === 'cancelled').length,
    credit_notes_count: notes.length,
    credit_note_from: notes[0]?.return_number || '',
    credit_note_to: notes[notes.length - 1]?.return_number || '',
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

  // SECTION 3b: TABLE 9B CREDIT NOTES (goods returned by registered buyers, v4.101.0)
  csv += `=== TABLE 9B: CREDIT NOTES (B2B RETURNS) ===\n`;
  csv += `GSTIN of Recipient,Receiver Name,Credit Note No,Credit Note Date,Against Invoice,Place of Supply,Rate (%),Taxable Value (Rs),CGST (Rs),SGST (Rs),IGST (Rs)\n`;
  data.b2b_credit_notes.forEach((c) => {
    csv += `"${c.customer_gstin}","${c.customer_name}",${c.note_number},${c.note_date},${c.invoice_number},"${c.place_of_supply}",${c.tax_rate}%,${(c.taxable_value / 100).toFixed(2)},${(c.cgst_amount / 100).toFixed(2)},${(c.sgst_amount / 100).toFixed(2)},${(c.igst_amount / 100).toFixed(2)}\n`;
  });
  csv += `\n`;

  // SECTION 4: TABLE 13 DOCUMENTS ISSUED
  csv += `=== TABLE 13: DOCUMENTS ISSUED SUMMARY ===\n`;
  csv += `Nature of Document,From Serial No,To Serial No,Total Number,Cancelled Number,Net Issued\n`;
  csv += `Invoices for Outward Supply,${data.doc_from_num},${data.doc_to_num},${data.total_invoices_count},${data.doc_cancelled_count},${data.total_invoices_count - data.doc_cancelled_count}\n`;
  if (data.credit_notes_count) csv += `Credit Note,${data.credit_note_from},${data.credit_note_to},${data.credit_notes_count},0,${data.credit_notes_count}\n`;

  return csv;
}

// The portal / offline-tool JSON is built from the bills in lib/gst/gstr1Json.ts
// (the old builder here repeated invoices per line and always said period 082026).
