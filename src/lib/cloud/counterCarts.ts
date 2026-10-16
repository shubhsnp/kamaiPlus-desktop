/**
 * "Send to counter" (v4.173.0): a staff phone of a shop (not a restaurant — waiters use the tables)
 * makes the customer's cart and sends it to the counter instead of billing it on the phone. The
 * counter (this PC, or the owner's phone) opens it as a new bill and completes the sale there — one
 * invoice series, the shop's GST, its stock and galla. Before this, a staff phone's bills stayed on
 * that phone only.
 *
 * Cloud: `businesses/{biz}/counter_carts/{id}` — the staff phone creates it (`status: 'sent'`, only
 * with its own `staff_id`, firestore.rules); the counter takes it once (`status: 'taken'`, in a
 * transaction, so two counters never bill the same cart). Taken carts older than two days are removed
 * by the counter. Same shape as KamaiPlus Android `lib/services/counter_cart_service.dart`.
 * Pure here (no Firebase — the Billing screen reads it); the cloud side is counterCartsCloud.ts.
 */
export const COUNTER_CARTS = 'counter_carts';
/** The cart the counter took, waiting for the Billing screen to open it (this PC only). */
export const STAFF_CART_PENDING_KEY = 'kamai_staff_cart_pending';
export const STAFF_CART_OPEN_EVENT = 'kamai_staff_cart_open';
export const TAKEN_KEEP_MS = 2 * 24 * 60 * 60 * 1000;

export interface StaffCartLine {
  productId: string;
  name: string;
  qty: number;
  /** The phone's price — used only for an item this PC does not have (a custom item). */
  unitPricePaise: number;
  unit?: string;
}

export interface StaffCart {
  id: string;
  staffId: string;
  staffName: string;
  createdAt: string;
  lines: StaffCartLine[];
  totalPaise: number;
  customerName?: string;
  customerPhone?: string;
  status: 'sent' | 'taken';
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** A cloud document → a cart the counter can open; null when it is not one. */
export function parseStaffCart(id: string, d: Record<string, unknown> | undefined | null): StaffCart | null {
  if (!d || !id) return null;
  const lines: StaffCartLine[] = [];
  for (const raw of Array.isArray(d.lines) ? d.lines.slice(0, 200) : []) {
    const l = (raw || {}) as Record<string, unknown>;
    const name = text(l.name, 120);
    const qty = Math.round(num(l.qty) * 1000) / 1000;
    if (!name || !(qty > 0)) continue;
    lines.push({ productId: text(l.product_id, 80), name, qty, unitPricePaise: Math.max(0, Math.round(num(l.unit_price_paise))), ...(text(l.unit, 20) ? { unit: text(l.unit, 20) } : {}) });
  }
  if (!lines.length) return null;
  return {
    id,
    staffId: text(d.staff_id, 40),
    staffName: text(d.staff_name, 40) || 'Staff',
    createdAt: text(d.created_at, 40),
    lines,
    totalPaise: Math.max(0, Math.round(num(d.total_paise))),
    ...(text(d.customer_name, 60) ? { customerName: text(d.customer_name, 60) } : {}),
    ...(text(d.customer_phone, 15) ? { customerPhone: text(d.customer_phone, 15) } : {}),
    status: d.status === 'taken' ? 'taken' : 'sent',
  };
}

/**
 * The lines the counter's addToCart will refuse (v4.174.0): this PC's stock is lower than the cart's
 * quantity (addToCart then adds nothing for that line — the same rule, line by line). `stockOf(i)` =
 * this PC's stock for line i, or null when the item is not counted at the counter / not on this PC.
 * Before, such a line was dropped with a toast that the "cart is open" toast hid at once.
 */
export function linesShortOfStock(lines: StaffCartLine[], stockOf: (i: number) => number | null): string[] {
  return lines.filter((line, i) => {
    const stock = stockOf(i);
    return stock !== null && (stock <= 0 || line.qty > stock);
  }).map((line) => line.name);
}
