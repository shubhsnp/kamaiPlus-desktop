// What one GST return period contains, line by line (v4.101.0, tracker K-D04).
//
// A bill is reported in full in the period it was made; goods that come back are a CREDIT NOTE
// in the period they came back (the return's date), never by quietly shrinking the old bill —
// that changed a month the shop may already have filed, and B2B returns had no credit note at
// all (GSTR-1 table 9B, "cdnr"). The GST screen and the GSTR-1 JSON both read from here.
import type { Customer, Sale, SalesReturn } from '@/types';
import { getLineTaxablePaise, getReturnedQtyByLine, getReturnsForSale, isEstimate } from '@/lib/sales/saleMath';
import { stateCodeFromGstin } from '@/lib/gst/stateCodes';

/** A valid-looking GSTIN (state code, PAN, entity, Z, check character). */
export const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export interface SupplyLine {
  sale: Sale;
  /** The return this line comes from (credit notes only). */
  ret?: SalesReturn;
  /** Buyer GSTIN when the buyer is registered (B2B), else ''. */
  buyerGstin: string;
  /** Raw buyer GSTIN that did not look valid (reported as a problem), else ''. */
  badBuyerGstin: string;
  /** Place of supply: state code. */
  pos: string;
  inter: boolean;
  hsn: string;
  desc: string;
  unit: string;
  rt: number;
  /** Quantity, taxable value and tax in paise — negative on a credit note. */
  qty: number;
  taxable: number;
  tax: number;
}

export interface PeriodSupplies {
  /** Every line of the period's bills (estimates and cancelled bills left out). */
  invoices: SupplyLine[];
  /** Goods returned in the period, as negative lines (of bills from this or an earlier period). */
  creditNotes: SupplyLine[];
  /** The period's credit notes (one per return), for "documents issued". */
  notes: SalesReturn[];
}

function buyerOf(sale: Sale, customerById: Map<string, Customer>, shopState: string) {
  const cust = sale.customer_id ? customerById.get(sale.customer_id) : undefined;
  const raw = (sale.customer_gstin || cust?.gstin || '').trim().toUpperCase();
  const buyerGstin = GSTIN_PATTERN.test(raw) ? raw : '';
  // Unregistered buyers at the counter are taken as within the shop's state.
  const pos = (buyerGstin ? stateCodeFromGstin(buyerGstin) : '') || shopState;
  return { buyerGstin, badBuyerGstin: raw && !buyerGstin ? raw : '', pos, inter: Boolean(pos && shopState && pos !== shopState) };
}

/** The quantity one return took back from each line of its bill (same order as `sale.items`). */
export function returnQtyByLine(sale: Sale, ret: SalesReturn): number[] {
  const pending = new Map<string, number>();
  for (const ri of ret.items || []) pending.set(ri.product_id, (pending.get(ri.product_id) || 0) + Math.max(0, ri.quantity || 0));
  return (sale.items || []).map((item) => {
    const avail = pending.get(item.product_id) || 0;
    const take = Math.min(item.quantity, avail);
    if (take > 0) pending.set(item.product_id, avail - take);
    return take;
  });
}

export function periodSupplies(params: {
  /** Bills dated in the period (any status). */
  sales: Sale[];
  /** Return records — all of them, or at least those of the period's bills and those dated in it. */
  returns: SalesReturn[];
  /** Bills that this period's returns came from but are not in `sales` (an earlier period). */
  originals?: Sale[];
  customers: Customer[];
  shopGstin: string;
  /** The period: a return dated inside it is a credit note of this period. */
  start: Date;
  end: Date;
}): PeriodSupplies {
  const shopState = stateCodeFromGstin((params.shopGstin || '').trim().toUpperCase());
  const customerById = new Map(params.customers.map((c) => [c.id, c]));
  const invoices: SupplyLine[] = [];
  const creditNotes: SupplyLine[] = [];

  for (const sale of params.sales) {
    if (isEstimate(sale) || sale.status === 'cancelled') continue;
    const buyer = buyerOf(sale, customerById, shopState);
    // Returns made before return records existed only lowered the bill's own counters: those
    // stay netted on the bill, as before. Returns with a record become credit notes.
    const counted = getReturnedQtyByLine(sale);
    const recorded = getReturnedQtyByLine({ ...sale, items: (sale.items || []).map((i) => ({ ...i, returned_quantity: undefined })) }, getReturnsForSale(sale.id, params.returns));
    (sale.items || []).forEach((item, i) => {
      const legacy = Math.max(0, (counted[i] || 0) - (recorded[i] || 0));
      const kept = item.quantity > 0 ? Math.max(0, item.quantity - legacy) / item.quantity : 1;
      if (kept <= 0) return;
      invoices.push({
        sale, ...buyer,
        hsn: (item.hsn_code || '').trim(), desc: item.product_name || '', unit: item.unit || '', rt: item.tax_rate || 0,
        qty: item.quantity * kept,
        taxable: Math.round(getLineTaxablePaise(item) * kept),
        tax: Math.round((item.tax_amount || 0) * kept),
      });
    });
  }

  const byId = new Map<string, Sale>();
  for (const s of params.originals || []) byId.set(s.id, s);
  for (const s of params.sales) byId.set(s.id, s);
  const notes: SalesReturn[] = [];
  const from = params.start.getTime();
  const to = params.end.getTime();
  for (const ret of params.returns) {
    const t = Date.parse(ret.created_at);
    if (!(t >= from && t <= to)) continue;
    const sale = byId.get(ret.original_sale_id);
    if (!sale || isEstimate(sale) || sale.status === 'cancelled') continue;
    const buyer = buyerOf(sale, customerById, shopState);
    const qty = returnQtyByLine(sale, ret);
    let any = false;
    (sale.items || []).forEach((item, i) => {
      const q = qty[i] || 0;
      if (q <= 0 || !item.quantity) return;
      const share = q / item.quantity;
      any = true;
      creditNotes.push({
        sale, ret, ...buyer,
        hsn: (item.hsn_code || '').trim(), desc: item.product_name || '', unit: item.unit || '', rt: item.tax_rate || 0,
        qty: -q,
        taxable: -Math.round(getLineTaxablePaise(item) * share),
        tax: -Math.round((item.tax_amount || 0) * share),
      });
    });
    if (any) notes.push(ret);
  }
  return { invoices, creditNotes, notes };
}
