// GSTR-1 JSON for upload on the GST portal (Returns → GSTR-1 → Prepare offline → Upload)
// or for import into the GSTN offline tool. Built straight from the bills so that every
// invoice appears once, with its items grouped by tax rate.
import type { Business, Customer, Sale } from '@/types';
import { getLineTaxablePaise, getReturnedQtyByLine, getSaleNetTotal, isEstimate, isRevenueSale } from '@/lib/sales/saleMath';
import { stateCodeFromGstin } from '@/lib/gst/stateCodes';
import { getGSTUQC } from '@/lib/gst/gstr1Generator';
import { splitIntraStateTax } from '@/lib/gst/taxSplit';

/** "MMYYYY" of the return period. Quarterly (QRMP) filers use the last month of the quarter. */
export function gstReturnPeriod(month0: number, year: number): string {
  return `${String(month0 + 1).padStart(2, '0')}${year}`;
}

export type GSTPeriodPreset = 'this_month' | 'last_month' | 'q1' | 'q2' | 'q3' | 'q4' | 'all_year';

/**
 * Dates of a GST page period, on the Indian financial year (Apr–Mar). A quarter is its
 * latest occurrence that has started (in Sep 2026: Q3 = Oct–Dec 2025, Q4 = Jan–Mar 2026).
 * `fp` is the GSTR-1 period — none for a full year, because GSTR-1 is filed per month
 * or per quarter.
 */
export function gstPeriodRange(preset: GSTPeriodPreset, now: Date = new Date()): { start: Date; end: Date; fp: string | null } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const month = (year: number, m0: number) => ({
    start: new Date(year, m0, 1, 0, 0, 0, 0),
    end: new Date(year, m0 + 1, 0, 23, 59, 59, 999),
    fp: gstReturnPeriod(m0, year),
  });
  if (preset === 'this_month') return month(y, m);
  if (preset === 'last_month') return m === 0 ? month(y - 1, 11) : month(y, m - 1);
  if (preset === 'all_year') {
    const fyStart = m >= 3 ? y : y - 1;
    return { start: new Date(fyStart, 3, 1, 0, 0, 0, 0), end: new Date(fyStart + 1, 3, 0, 23, 59, 59, 999), fp: null };
  }
  const firstMonth = { q1: 3, q2: 6, q3: 9, q4: 0 }[preset];
  const year = new Date(y, firstMonth, 1) <= now ? y : y - 1;
  return {
    start: new Date(year, firstMonth, 1, 0, 0, 0, 0),
    end: new Date(year, firstMonth + 3, 0, 23, 59, 59, 999),
    fp: gstReturnPeriod(firstMonth + 2, year),
  };
}

/** Date on the bill as the portal wants it: dd-mm-yyyy (the shop's local date). */
export function gstInvoiceDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

export const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
/** Invoice numbers on the portal: at most 16 characters, letters / digits / "-" / "/". */
export const GST_INVOICE_NO_PATTERN = /^[A-Za-z0-9/-]{1,16}$/;

const rupees = (paise: number) => Math.round(paise) / 100;
const qty2 = (n: number) => Math.round(n * 100) / 100;

export interface Gstr1JsonIssue {
  kind: 'no_gstin' | 'bad_buyer_gstin' | 'missing_hsn' | 'long_invoice_no';
  /** Examples to show the shop (product or invoice names), at most 5. */
  examples: string[];
  count: number;
}

export interface Gstr1JsonResult {
  json: Record<string, unknown>;
  issues: Gstr1JsonIssue[];
  fileName: string;
}

/** A row's amounts in paise. Intra-state tax stays one amount until the row is written
 *  (K-D40, v4.99.0): splitting every line gave CGST the odd paisa line after line. */
interface TaxSplit {
  txval: number;
  iamt: number;
  intra: number;
}

const addSplit = (a: TaxSplit, b: TaxSplit) => {
  a.txval += b.txval;
  a.iamt += b.iamt;
  a.intra += b.intra;
};

/** Amount keys the portal expects: IGST for inter-state, CGST + SGST within the state. */
function amountFields(s: TaxSplit, inter: boolean) {
  if (inter) return { txval: rupees(s.txval), iamt: rupees(s.iamt), csamt: 0 };
  const { cgst, sgst } = splitIntraStateTax(s.intra);
  return { txval: rupees(s.txval), camt: rupees(cgst), samt: rupees(sgst), csamt: 0 };
}

/**
 * sales: every bill dated inside the return period (any status — estimates are left
 * out here, cancelled bills only count in "documents issued").
 */
export function buildGstr1Json(params: {
  sales: Sale[];
  customers: Customer[];
  business: Pick<Business, 'gstin' | 'name'>;
  fp: string;
}): Gstr1JsonResult {
  const { sales, customers, business, fp } = params;
  const gstin = (business.gstin || '').trim().toUpperCase();
  const shopState = stateCodeFromGstin(gstin);
  const customerById = new Map(customers.map((c) => [c.id, c]));

  const missingHsn = new Set<string>();
  const longInvoiceNos = new Set<string>();
  const badBuyerGstins = new Set<string>();

  // ctin → invoice number → { invoice head, rate → split }
  const b2b = new Map<string, Map<string, { sale: Sale; pos: string; inter: boolean; rates: Map<number, TaxSplit> }>>();
  const b2cs = new Map<string, { pos: string; inter: boolean; rt: number; split: TaxSplit }>();
  const nil = new Map<string, number>(); // sply_ty → paise
  type HsnRow = { hsn: string; desc: string; uqc: string; rt: number; qty: number; split: TaxSplit };
  const hsn = { b2b: new Map<string, HsnRow>(), b2c: new Map<string, HsnRow>() };

  for (const sale of sales) {
    if (!isRevenueSale(sale)) continue;
    const cust = sale.customer_id ? customerById.get(sale.customer_id) : undefined;
    const rawBuyer = (sale.customer_gstin || cust?.gstin || '').trim().toUpperCase();
    const buyerGstin = GSTIN_PATTERN.test(rawBuyer) ? rawBuyer : '';
    if (rawBuyer && !buyerGstin) badBuyerGstins.add(`${sale.invoice_number}: ${rawBuyer}`);
    const registered = Boolean(buyerGstin);
    // Unregistered buyers at the counter are treated as within the shop's state.
    const pos = (registered ? stateCodeFromGstin(buyerGstin) : '') || shopState;
    const inter = Boolean(pos && shopState && pos !== shopState);
    if (registered && !GST_INVOICE_NO_PATTERN.test(sale.invoice_number || '')) longInvoiceNos.add(sale.invoice_number);
    const returned = getReturnedQtyByLine(sale);

    (sale.items || []).forEach((item, i) => {
      const kept = item.quantity > 0 ? Math.max(0, item.quantity - (returned[i] || 0)) / item.quantity : 1;
      if (kept <= 0) return;
      const rt = item.tax_rate || 0;
      const taxable = Math.round(getLineTaxablePaise(item) * kept);
      const tax = Math.round((item.tax_amount || 0) * kept);
      const split: TaxSplit = { txval: taxable, iamt: inter ? tax : 0, intra: inter ? 0 : tax };

      // Table 12 — HSN summary, separate for registered (B2B) and other buyers (B2C).
      const code = (item.hsn_code || '').trim();
      if (!code) missingHsn.add(item.product_name);
      const uqc = getGSTUQC(item.unit);
      const table = registered ? hsn.b2b : hsn.b2c;
      const hKey = `${code}|${uqc}|${rt}`;
      const h = table.get(hKey);
      if (h) {
        h.qty += item.quantity * kept;
        addSplit(h.split, split);
      } else {
        table.set(hKey, { hsn: code, desc: (item.product_name || '').slice(0, 30), uqc, rt, qty: item.quantity * kept, split: { ...split } });
      }

      // Table 8 — nil rated (0 % GST) lines are not reported in B2B / B2CS.
      if (rt <= 0) {
        const ty = `${inter ? 'INTR' : 'INTRA'}${registered ? 'B2B' : 'B2C'}`;
        nil.set(ty, (nil.get(ty) || 0) + taxable);
        return;
      }

      if (registered) {
        // Table 4A — one invoice per bill, items per tax rate.
        if (!b2b.has(buyerGstin)) b2b.set(buyerGstin, new Map());
        const invoices = b2b.get(buyerGstin)!;
        if (!invoices.has(sale.invoice_number)) invoices.set(sale.invoice_number, { sale, pos, inter, rates: new Map() });
        const inv = invoices.get(sale.invoice_number)!;
        const r = inv.rates.get(rt);
        if (r) addSplit(r, split);
        else inv.rates.set(rt, { ...split });
      } else {
        // Table 7 — B2C (small), one row per place of supply and rate.
        const key = `${inter ? 'INTER' : 'INTRA'}|${pos}|${rt}`;
        const row = b2cs.get(key);
        if (row) addSplit(row.split, split);
        else b2cs.set(key, { pos, inter, rt, split: { ...split } });
      }
    });
  }

  const hsnRows = (table: typeof hsn.b2b) =>
    Array.from(table.values()).map((h, i) => {
      const { cgst, sgst } = splitIntraStateTax(h.split.intra);
      return {
        num: i + 1,
        hsn_sc: h.hsn,
        desc: h.desc,
        uqc: h.uqc,
        qty: qty2(h.qty),
        rt: h.rt,
        txval: rupees(h.split.txval),
        iamt: rupees(h.split.iamt),
        camt: rupees(cgst),
        samt: rupees(sgst),
        csamt: 0,
      };
    });

  // Table 13 — documents issued, one row per invoice series (prefix before the running number).
  const series = new Map<string, { nums: { n: number; label: string }[]; cancelled: number }>();
  for (const s of sales) {
    if (isEstimate(s) || !s.invoice_number) continue;
    const m = s.invoice_number.match(/^(.*?)(\d+)$/);
    const prefix = m ? m[1] : s.invoice_number;
    const n = m ? parseInt(m[2], 10) : 0;
    if (!series.has(prefix)) series.set(prefix, { nums: [], cancelled: 0 });
    const row = series.get(prefix)!;
    row.nums.push({ n, label: s.invoice_number });
    if (s.status === 'cancelled') row.cancelled += 1;
  }
  const docs = Array.from(series.values()).map((row, i) => {
    const sorted = row.nums.sort((a, b) => a.n - b.n);
    return {
      num: i + 1,
      from: sorted[0].label,
      to: sorted[sorted.length - 1].label,
      totnum: sorted.length,
      cancel: row.cancelled,
      net_issue: sorted.length - row.cancelled,
    };
  });

  const json: Record<string, unknown> = {
    gstin,
    fp,
    version: 'GST3.2.1',
    hash: 'hash',
  };
  if (b2b.size) {
    json.b2b = Array.from(b2b.entries()).map(([ctin, invoices]) => ({
      ctin,
      inv: Array.from(invoices.values()).map(({ sale, pos, inter, rates }) => ({
        inum: sale.invoice_number,
        idt: gstInvoiceDate(sale.created_at),
        val: rupees(getSaleNetTotal(sale)),
        pos,
        rchrg: 'N',
        inv_typ: 'R',
        itms: Array.from(rates.entries()).map(([rt, s], i) => ({ num: i + 1, itm_det: { rt, ...amountFields(s, inter) } })),
      })),
    }));
  }
  if (b2cs.size) {
    json.b2cs = Array.from(b2cs.values()).map((r) => ({
      sply_ty: r.inter ? 'INTER' : 'INTRA',
      pos: r.pos,
      typ: 'OE',
      rt: r.rt,
      ...amountFields(r.split, r.inter),
    }));
  }
  if (nil.size) {
    json.nil = { inv: Array.from(nil.entries()).map(([sply_ty, paise]) => ({ sply_ty, nil_amt: rupees(paise), expt_amt: 0, ngsup_amt: 0 })) };
  }
  if (hsn.b2b.size || hsn.b2c.size) {
    json.hsn = { hsn_b2b: hsnRows(hsn.b2b), hsn_b2c: hsnRows(hsn.b2c) };
  }
  if (docs.length) {
    json.doc_issue = { doc_det: [{ doc_num: 1, docs }] };
  }

  const issues: Gstr1JsonIssue[] = [];
  const pushIssue = (kind: Gstr1JsonIssue['kind'], set: Set<string>) => {
    if (set.size) issues.push({ kind, count: set.size, examples: Array.from(set).slice(0, 5) });
  };
  if (!GSTIN_PATTERN.test(gstin)) issues.push({ kind: 'no_gstin', count: 1, examples: gstin ? [gstin] : [] });
  pushIssue('missing_hsn', missingHsn);
  pushIssue('bad_buyer_gstin', badBuyerGstins);
  pushIssue('long_invoice_no', longInvoiceNos);

  return { json, issues, fileName: `GSTR1_${gstin || 'NO-GSTIN'}_${fp}.json` };
}
