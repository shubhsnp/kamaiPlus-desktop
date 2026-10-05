import { formatInvoiceNumber, parseInvoiceSequenceNumber } from '@/lib/invoices/invoiceNumberService';
import type { Sale } from '@/types';

/**
 * Estimate / quotation from the billing counter (v4.102.0, tracker K-D07). Saved as a sale with
 * status 'draft' and an EST- number: no stock, no khata, no cash drawer, no GST (see isEstimate in
 * lib/sales/saleMath.ts — every report already leaves estimates out). Transactions → "Convert to
 * Bill" turns it into a tax invoice later.
 */
export const ESTIMATE_PREFIX = 'EST-';
export const ESTIMATE_NOTE = 'ESTIMATE / QUOTATION';

/**
 * The next estimate number: one more than the highest EST- number still saved, and never below
 * `floor` (the last one handed out on this PC — a converted estimate loses its EST- number, and
 * its number must not be given to the next customer).
 */
export function nextEstimateNumber(existing: string[], floor = 0): { number: string; seq: number } {
  let max = Math.max(0, Math.floor(floor || 0));
  for (const n of existing) {
    if (!n || !n.toUpperCase().startsWith(ESTIMATE_PREFIX)) continue;
    const seq = parseInvoiceSequenceNumber(n);
    if (seq !== null && seq > max) max = seq;
  }
  const seq = max + 1;
  return { number: formatInvoiceNumber(ESTIMATE_PREFIX, seq, 3), seq };
}

/**
 * The estimate itself: the bill as priced on the counter, with nothing paid and nothing owed — the
 * money is settled when it is converted to a bill.
 */
export function buildEstimateSale(p: {
  id: string;
  businessId: string;
  estimateNumber: string;
  customer?: { id?: string; name?: string; phone?: string; address?: string; gstin?: string } | null;
  items: Sale['items'];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  priceMode?: 'retail' | 'wholesale';
  now: string;
}): Sale {
  const c = p.customer || null;
  return {
    id: p.id,
    business_id: p.businessId,
    invoice_number: p.estimateNumber,
    customer_id: c?.id,
    customer_name: c?.name || 'Cash Customer',
    customer_phone: c?.phone,
    customer_address: c?.address,
    customer_gstin: c?.gstin,
    items: p.items,
    subtotal: p.subtotal,
    discount_total: p.discountTotal,
    tax_total: p.taxTotal,
    grand_total: p.grandTotal,
    payment_method: 'cash',
    amount_received: 0,
    balance_due: 0,
    change_returned: 0,
    payment_status: 'unpaid',
    status: 'draft',
    notes: ESTIMATE_NOTE,
    ...(p.priceMode === 'wholesale' ? { price_mode: 'wholesale' as const } : {}),
    created_by: 'owner',
    created_at: p.now,
    updated_at: p.now,
    sync_status: 'synced',
  };
}
