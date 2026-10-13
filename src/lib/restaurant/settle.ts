import { db, ensureStarterBusinessIfEmpty } from '@/lib/db';
import { newId } from '@/lib/ids';
import { commitNextInvoiceNumber, getNextUniqueInvoiceNumber } from '@/lib/invoices/invoiceNumberService';
import { cloudMerge, cloudSyncSoon, cloudTrackInvoice } from '@/lib/firebase/lazyCloud';
import type { Business, CartItem, PaymentMethod, Product, Sale } from '@/types';
import { DELIVERY_CHARGE_ID, DiscountInput, PACKING_CHARGE_ID, RestOrder, SERVICE_CHARGE_ID, orderRef, orderTotals } from '@/lib/restaurant/model';
import type { RestaurantSettings } from '@/lib/restaurant/settings';

/*
 * Paying a restaurant bill (v4.106.0). The order becomes an ordinary Sale — the same table the
 * counter's bills use — so Transactions, Reports, GST, Day Summary and the Cash Register see it
 * with no change. Same order of steps as the counter's completeSale (Bible §6.1):
 * reserve the number → save the bill → commit the number → stock → (cloud, never awaited).
 * The table / token name is the "customer" on the bill ("Table T4"), so it prints on every
 * bill format and shows in Transactions without touching the invoice code.
 */

export type RestPayMethod = Extract<PaymentMethod, 'cash' | 'upi' | 'card' | 'split'>;

export interface SettleInput {
  order: RestOrder;
  settings: RestaurantSettings;
  business?: Business | null;
  method: RestPayMethod;
  /** Cash handed over, paise (ignored for UPI / card, which are paid in full). For 'split' (v4.108.0):
   *  the cash part — the rest is UPI. */
  receivedPaise?: number;
  discount?: DiscountInput | null;
  /** v4.107.0: optional guest name and mobile (the mobile fills WhatsApp when the bill is sent). */
  guestName?: string;
  guestPhone?: string;
}

export const billLabel = (order: Pick<RestOrder, 'kind' | 'label'>): string => orderRef(order);

/** The name on the bill: "Table T4", or "Rahul · Table T4" when the guest gave a name. */
export const billCustomerName = (order: Pick<RestOrder, 'kind' | 'label'>, guestName?: string): string => {
  const name = (guestName || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  return name ? `${name} · ${billLabel(order)}` : billLabel(order);
};

/** A 10-digit Indian mobile, or '' (anything else is left out rather than saved wrong). */
export const cleanGuestPhone = (raw?: string): string => {
  const digits = (raw || '').replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(digits) ? digits : '';
};

export async function settleOrder(input: SettleInput): Promise<Sale> {
  const { order, settings, method } = input;
  const totals = orderTotals(order, settings, input.discount);
  if (totals.items.length === 0 || totals.grandTotal <= 0) throw new Error('empty-order');
  const grand = totals.grandTotal;
  const received = method === 'cash' ? Math.max(grand, Math.round(input.receivedPaise || 0)) : grand;
  // Cash + UPI (v4.108.0): the same payment_split the counter writes, so the cash drawer and reports
  // count each part where it belongs.
  const splitCash = method === 'split' ? Math.round(input.receivedPaise || 0) : 0;
  if (method === 'split' && (splitCash <= 0 || splitCash >= grand)) throw new Error('bad-split');

  const biz = input.business || (await ensureStarterBusinessIfEmpty());
  const businessId = biz?.id || 'biz_default';
  const now = new Date().toISOString();
  const saleId = newId('sale');

  // The buying rate of each item is frozen on the bill (profit reports), like at the counter.
  const chargeIds = new Set([SERVICE_CHARGE_ID, PACKING_CHARGE_ID, DELIVERY_CHARGE_ID]);
  const dishIds = totals.items.filter((i) => !chargeIds.has(i.product_id)).map((i) => i.product_id);
  // v4.139.0: a takeaway / delivery guest typed when the order was opened is the bill's guest.
  const guestName = input.guestName || order.guest?.name || '';
  const guestPhone = input.guestPhone || order.guest?.phone || '';
  const address = (order.guest?.address || '').trim();
  const products = new Map<string, Product>();
  for (const p of await db.products.bulkGet(dishIds)) if (p) products.set(p.id, p);
  const items: CartItem[] = totals.items.map((i) => {
    const cost = products.get(i.product_id)?.purchase_price || 0;
    return cost > 0 ? { ...i, cost_price: cost } : i;
  });

  const { invoiceNumber, nextSeq } = await getNextUniqueInvoiceNumber(businessId);
  const sale: Sale = {
    id: saleId,
    business_id: businessId,
    invoice_number: invoiceNumber,
    customer_name: billCustomerName(order, guestName),
    ...(cleanGuestPhone(guestPhone) ? { customer_phone: cleanGuestPhone(guestPhone) } : {}),
    items,
    subtotal: totals.subtotal,
    discount_total: totals.discountTotal,
    tax_total: totals.taxTotal,
    grand_total: grand,
    payment_method: method,
    ...(method === 'split' ? { payment_split: { cash_amount: splitCash, upi_amount: grand - splitCash, card_amount: 0, credit_amount: 0 } } : {}),
    amount_received: received,
    balance_due: 0,
    change_returned: Math.max(0, received - grand),
    payment_status: 'paid',
    status: 'completed',
    notes: address ? `${billLabel(order)} · ${address}` : billLabel(order),
    created_by: order.takenBy || 'owner',
    created_at: now,
    updated_at: now,
    sync_status: 'synced',
  };

  await db.sales.put(sale);
  void cloudTrackInvoice({
    invoiceNumber: sale.invoice_number,
    totalAmountPaise: sale.grand_total,
    paymentMode: sale.payment_method,
    itemCount: sale.items.length,
    businessId,
    isGstBill: (sale.tax_total || 0) > 0,
  });
  void cloudSyncSoon(businessId);
  if (biz?.id) await commitNextInvoiceNumber(biz.id, nextSeq);

  // Stock: only items that are counted (a menu item is "unlimited stock" by default → nothing to do).
  const changed: Product[] = [];
  await db.transaction('rw', db.products, db.inventory_movements, async () => {
    for (const line of items) {
      const prod = products.get(line.product_id);
      if (!prod || prod.is_unlimited_stock) continue;
      const fresh = (await db.products.get(prod.id)) || prod;
      const prev = Number(fresh.current_stock ?? 0);
      const next = Math.max(0, prev - line.quantity);
      const updated: Product = { ...fresh, current_stock: next, updated_at: now };
      await db.products.put(updated);
      await db.inventory_movements.put({
        id: `mov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${prod.id}`,
        business_id: businessId,
        product_id: prod.id,
        product_name: prod.name,
        movement_type: 'SALE',
        quantity: line.quantity,
        previous_stock: prev,
        new_stock: next,
        reference_id: saleId,
        reason: `Sold on Invoice #${invoiceNumber} (${billLabel(order)})`,
        created_by: 'owner',
        created_at: now,
      });
      changed.push(updated);
    }
  });
  if (businessId !== 'biz_default') for (const p of changed) void cloudMerge(`businesses/${businessId}/products/${p.id}`, p);
  return sale;
}
