import { CartItem, Sale, SalesReturn } from '@/types';

/**
 * Shared money rules for a sale. Every screen that totals sales (Dashboard,
 * Transactions, Cash Register, Day-End report, Sales Analytics, invoices) reads
 * them from here so no two screens disagree about the same bill.
 *
 * All amounts are integer paise.
 */

/** Estimates / quotations are saved as sales but are not supplies: no stock, no money, no GST. */
export function isEstimate(sale: Pick<Sale, 'status' | 'invoice_number'>): boolean {
  return sale.status === 'draft' || (sale.invoice_number || '').toUpperCase().startsWith('EST-');
}

/** A bill that counts toward revenue. Fully returned bills are excluded; partial returns count net. */
export function isRevenueSale(sale: Pick<Sale, 'status' | 'invoice_number'>): boolean {
  if (isEstimate(sale)) return false;
  return sale.status !== 'cancelled' && sale.status !== 'returned';
}

export function isLineTaxInclusive(item: Pick<CartItem, 'is_tax_inclusive'>): boolean {
  return item.is_tax_inclusive !== false;
}

/** GST inside (inclusive) or on top of (exclusive) a line amount — same rounding the POS uses. */
export function calculateLineTax(lineTotalPaise: number, taxRate: number, isInclusive: boolean): number {
  if (!taxRate || taxRate <= 0 || lineTotalPaise <= 0) return 0;
  return isInclusive
    ? Math.round(lineTotalPaise - lineTotalPaise / (1 + taxRate / 100))
    : Math.round((lineTotalPaise * taxRate) / 100);
}

/** Taxable value of a line (price before GST). */
export function getLineTaxablePaise(item: CartItem): number {
  const tax = item.tax_amount || 0;
  return isLineTaxInclusive(item) && (item.tax_rate || 0) > 0 ? item.total_amount - tax : item.total_amount;
}

/** What the customer pays for a line, GST included. */
export function getLineGrossPaise(item: CartItem): number {
  return getLineTaxablePaise(item) + (item.tax_amount || 0);
}

export interface BillTotals {
  subtotal: number; // taxable value
  discountTotal: number; // line + bill discounts
  taxTotal: number;
  grandTotal: number;
}

export function computeBillTotals(items: CartItem[]): BillTotals {
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  for (const item of items) {
    subtotal += getLineTaxablePaise(item);
    discountTotal += item.discount_amount || 0;
    taxTotal += item.tax_amount || 0;
  }
  return { subtotal, discountTotal, taxTotal, grandTotal: subtotal + taxTotal };
}

/**
 * Spreads a bill-level discount over the lines (largest-remainder, exact to the
 * paisa) and recomputes each line's GST on the discounted amount.
 *
 * The discount is taken off each line's own amount — the MRP for tax-inclusive
 * items, the base rate for tax-exclusive ones — exactly like a line discount.
 * Before this, the bill discount was subtracted from the taxable subtotal while
 * GST stayed at the undiscounted figure, so the customer paid, and the GST
 * report declared, tax on money that was never charged.
 */
export function allocateBillDiscount(items: CartItem[], billDiscountPaise: number): CartItem[] {
  const base = items.map((i) => Math.max(0, i.total_amount));
  const sumBase = base.reduce((a, b) => a + b, 0);
  const discount = Math.min(Math.max(0, Math.round(billDiscountPaise || 0)), sumBase);
  if (discount <= 0 || sumBase <= 0) return items.map((i) => ({ ...i }));

  const exact = base.map((b) => (discount * b) / sumBase);
  const shares = exact.map((x) => Math.floor(x));
  let leftover = discount - shares.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, idx) => ({ idx, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || base[b.idx] - base[a.idx]);
  for (let k = 0; leftover > 0 && order.length > 0; k = (k + 1) % order.length) {
    const idx = order[k].idx;
    if (shares[idx] < base[idx]) {
      shares[idx] += 1;
      leftover -= 1;
    }
  }

  return items.map((item, idx) => {
    const share = shares[idx];
    if (share <= 0) return { ...item };
    const total = item.total_amount - share;
    return {
      ...item,
      total_amount: total,
      discount_amount: (item.discount_amount || 0) + share,
      bill_discount_amount: (item.bill_discount_amount || 0) + share,
      tax_amount: calculateLineTax(total, item.tax_rate || 0, isLineTaxInclusive(item)),
    };
  });
}

export interface PaymentBreakdown {
  cash: number;
  upi: number;
  card: number;
  credit: number;
}

const ZERO: PaymentBreakdown = { cash: 0, upi: 0, card: 0, credit: 0 };

/**
 * How a bill was paid. "cash" is money kept in the drawer — change handed back
 * is never counted. Udhar (credit) is whatever is still due on the bill.
 */
export function getSalePaymentBreakdown(sale: Sale): PaymentBreakdown {
  if (isEstimate(sale) || sale.status === 'cancelled') return { ...ZERO };
  const grand = Math.max(0, sale.grand_total || 0);

  if (sale.payment_method === 'split' && sale.payment_split) {
    const s = sale.payment_split;
    return {
      cash: Math.max(0, s.cash_amount || 0),
      upi: Math.max(0, s.upi_amount || 0),
      card: Math.max(0, s.card_amount || 0),
      credit: Math.max(0, s.credit_amount || 0),
    };
  }

  // What was left on udhar at the counter. A later khata payment is khata cash on
  // its own day (cashDrawer.ts), never a cash sale on the bill's date.
  const credit = Math.min(grand, Math.max(0, sale.balance_due_at_sale ?? sale.balance_due ?? 0));
  const paid = grand - credit;
  switch (sale.payment_method) {
    case 'upi':
      return { cash: 0, upi: paid, card: 0, credit };
    case 'card':
    case 'bank_transfer':
      return { cash: 0, upi: 0, card: paid, credit };
    default:
      // cash, credit (the part paid upfront is cash) and legacy splits without a breakdown
      return { cash: paid, upi: 0, card: 0, credit };
  }
}

export function getReturnsForSale(saleId: string, returns: SalesReturn[]): SalesReturn[] {
  return returns.filter((r) => r.original_sale_id === saleId);
}

/** Refunded amount of a bill, from its return records (falls back to the bill's own counter). */
export function getRefundedPaise(sale: Sale, saleReturns?: SalesReturn[]): number {
  if (saleReturns && saleReturns.length > 0) {
    return saleReturns.reduce((acc, r) => acc + Math.max(0, r.refund_amount || 0), 0);
  }
  return Math.max(0, sale.returned_amount || 0);
}

/** Bill value after returns. */
export function getSaleNetTotal(sale: Sale, saleReturns?: SalesReturn[]): number {
  if (!isRevenueSale(sale)) return 0;
  return Math.max(0, (sale.grand_total || 0) - getRefundedPaise(sale, saleReturns));
}

/**
 * Payment breakdown net of refunds: a cash refund comes out of cash, a UPI refund
 * out of UPI, a khata deduction / store credit out of udhar. Any excess spills
 * into the other buckets so the parts always add up to the net bill value.
 */
export function getNetPaymentBreakdown(sale: Sale, saleReturns: SalesReturn[] = []): PaymentBreakdown {
  if (!isRevenueSale(sale)) return { ...ZERO };
  const out = getSalePaymentBreakdown(sale);
  const refunds = saleReturns.length > 0
    ? saleReturns.map((r) => ({ amount: Math.max(0, r.refund_amount || 0), method: r.refund_method }))
    : (sale.returned_amount || 0) > 0
    ? [{ amount: sale.returned_amount || 0, method: 'cash' as const }]
    : [];

  for (const refund of refunds) {
    let left = refund.amount;
    const first: keyof PaymentBreakdown =
      refund.method === 'upi' ? 'upi' : refund.method === 'cash' ? 'cash' : 'credit';
    const order: (keyof PaymentBreakdown)[] = [first, 'credit', 'cash', 'upi', 'card'];
    for (const key of order) {
      if (left <= 0) break;
      const take = Math.min(out[key], left);
      out[key] -= take;
      left -= take;
    }
  }
  return out;
}

/**
 * Quantity returned on each line of a bill (same order as `sale.items`). Uses
 * the per-line counter written by Sales Return, or rebuilds it from the return
 * records for returns processed before that counter existed.
 */
export function getReturnedQtyByLine(sale: Sale, saleReturns: SalesReturn[] = []): number[] {
  const items = sale.items || [];
  if (items.some((i) => (i.returned_quantity || 0) > 0)) {
    return items.map((i) => Math.min(i.quantity, Math.max(0, i.returned_quantity || 0)));
  }
  const pending = new Map<string, number>();
  for (const ret of saleReturns) {
    for (const ri of ret.items || []) {
      pending.set(ri.product_id, (pending.get(ri.product_id) || 0) + Math.max(0, ri.quantity || 0));
    }
  }
  return items.map((item) => {
    const avail = pending.get(item.product_id) || 0;
    const take = Math.min(item.quantity, avail);
    if (take > 0) pending.set(item.product_id, avail - take);
    return take;
  });
}

/**
 * Money to give back for returning `qty` of a line: the line's GST-inclusive
 * amount prorated by quantity, so line discounts, bill discounts and
 * tax-exclusive GST are all refunded exactly as they were charged.
 */
export function getLineRefundPaise(item: CartItem, qty: number): number {
  if (!item.quantity || qty <= 0) return 0;
  const gross = getLineGrossPaise(item);
  if (qty >= item.quantity) return gross;
  return Math.round((gross * qty) / item.quantity);
}

/** Local-time half-open day window [start, end) as ISO strings, for Dexie `between` queries. */
export function getLocalDayRange(date: Date = new Date()): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}
