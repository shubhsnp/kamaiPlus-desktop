import { Customer, Sale, SalesReturn } from '@/types';
import { getLineTaxablePaise, getNetPaymentBreakdown, getReturnedQtyByLine, getReturnsForSale, isRevenueSale } from '@/lib/sales/saleMath';
import { placeOfSupplyLabel, stateCodeFromGstin } from '@/lib/gst/stateCodes';

/*
 * One bill as the accountant sees it (v4.78.0) — shared by the CA sales register and the
 * Tally export so both agree with the GSTR-1 file (lib/gst/gstr1Json.ts):
 *   - estimates, cancelled and fully returned bills are left out; partial returns count net
 *   - taxable and tax per line (bill discounts are already spread over the lines)
 *   - IGST when a registered buyer is in another state, else CGST + SGST
 *   - how it was paid, net of refunds: cash / bank (UPI, card) / udhar — adding up to the bill
 */

// Same pattern as the GST portal check (lib/gst/gstr1Json.ts).
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export interface SaleBreakup {
  sale: Sale;
  buyerName: string;
  /** A valid buyer GSTIN, else ''. */
  buyerGstin: string;
  /** Place of supply, e.g. "27 (Maharashtra)" ('' when the shop has no GSTIN). */
  placeOfSupply: string;
  inter: boolean;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  /** Bill value after returns (taxable + tax), paise. */
  total: number;
  /** Value taken back by returns, paise. */
  returned: number;
  /** Net of refunds; adds up to `total`. */
  pay: { cash: number; bank: number; credit: number };
}

export interface BreakupContext {
  /** The shop's GSTIN (its state decides inter-state). */
  shopGstin: string;
  customers: Customer[];
  returns: SalesReturn[];
}

/** The bills of a period, broken up; bills that are not revenue are left out. Oldest first. */
export function breakupSales(sales: Sale[], ctx: BreakupContext, range?: { start: Date; end: Date }): SaleBreakup[] {
  const shopState = stateCodeFromGstin((ctx.shopGstin || '').trim().toUpperCase());
  const byId = new Map(ctx.customers.map((c) => [c.id, c]));
  const out: SaleBreakup[] = [];
  const inRange = (iso: string) => {
    if (!range) return true;
    const t = Date.parse(iso);
    return t >= range.start.getTime() && t <= range.end.getTime();
  };
  for (const sale of [...sales].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    if (!isRevenueSale(sale) || !inRange(sale.created_at)) continue;
    const b = breakupSale(sale, shopState, byId, ctx.returns);
    if (b) out.push(b);
  }
  return out;
}

function breakupSale(sale: Sale, shopState: string, byId: Map<string, Customer>, allReturns: SalesReturn[]): SaleBreakup | null {
  const cust = sale.customer_id ? byId.get(sale.customer_id) : undefined;
  const raw = (sale.customer_gstin || cust?.gstin || '').trim().toUpperCase();
  const buyerGstin = GSTIN.test(raw) ? raw : '';
  const pos = (buyerGstin ? stateCodeFromGstin(buyerGstin) : '') || shopState;
  const inter = Boolean(pos && shopState && pos !== shopState);

  const saleReturns = getReturnsForSale(sale.id, allReturns);
  const returnedQty = getReturnedQtyByLine(sale, saleReturns);
  let taxable = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  (sale.items || []).forEach((item, i) => {
    const kept = item.quantity > 0 ? Math.max(0, item.quantity - (returnedQty[i] || 0)) / item.quantity : 1;
    if (kept <= 0) return;
    const tax = Math.round((item.tax_amount || 0) * kept);
    taxable += Math.round(getLineTaxablePaise(item) * kept);
    if (inter) igst += tax;
    else {
      const c = Math.round(tax / 2);
      cgst += c;
      sgst += tax - c;
    }
  });
  const total = taxable + cgst + sgst + igst;
  if (total <= 0) return null;

  const net = getNetPaymentBreakdown(sale, saleReturns);
  const pay = { cash: net.cash, bank: net.upi + net.card, credit: net.credit };
  // Rounding of partly returned lines can leave a paisa or two: it goes to the biggest part.
  const diff = total - (pay.cash + pay.bank + pay.credit);
  if (diff !== 0) {
    const key = (Object.keys(pay) as (keyof typeof pay)[]).sort((a, b) => pay[b] - pay[a])[0];
    pay[key] = Math.max(0, pay[key] + diff);
    const left = total - (pay.cash + pay.bank + pay.credit);
    if (left !== 0) pay.cash += left;
  }

  return {
    sale,
    buyerName: sale.customer_name || cust?.name || 'Cash Customer',
    buyerGstin,
    placeOfSupply: pos ? placeOfSupplyLabel(pos) : '',
    inter,
    taxable,
    cgst,
    sgst,
    igst,
    total,
    returned: Math.max(0, (sale.grand_total || 0) - total),
    pay,
  };
}

/** dd-mm-yyyy in the shop's time. */
export function registerDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}
