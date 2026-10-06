import type { CartItem, ProductUnit } from '@/types';
import { allocateBillDiscount, calculateLineTax, computeBillTotals } from '@/lib/sales/saleMath';
import type { RestAddOn, RestaurantSettings } from '@/lib/restaurant/settings';

/*
 * Restaurant orders (v4.106.0) — pure logic, no database and no screen.
 *
 * A table (or a takeaway token) holds one running order. Its lines carry add-ons and a note;
 * `kotQty` is how many pieces the kitchen has already been told about, so "Print KOT" sends only
 * what changed since the last slip (new pieces as ADD, removed ones as CANCEL). When the bill is
 * paid the order becomes an ordinary Sale (lib/restaurant/settle.ts) — nothing restaurant-specific
 * is saved in the shop's database.
 */

export type OrderKind = 'table' | 'takeaway';

export interface RestLine {
  /** Same item + same add-ons + same note = same line (qty goes up). */
  key: string;
  productId: string;
  name: string;
  unit: ProductUnit;
  qty: number;
  /** Menu price of one piece, paise, before add-ons. */
  basePaise: number;
  addOns: RestAddOn[];
  note: string;
  /** Pieces already sent to the kitchen on a KOT. */
  kotQty: number;
}

export interface RestOrder {
  id: string;
  kind: OrderKind;
  /** "T4" or "TA-07" — printed on the KOT and the bill. */
  label: string;
  lines: RestLine[];
  openedAt: string;
  updatedAt: string;
  /** How many KOT slips were printed (1st, 2nd…). */
  kotRounds: number;
}

export interface MenuPick {
  productId: string;
  name: string;
  unit: ProductUnit;
  basePaise: number;
}

const normalAddOns = (addOns: RestAddOn[]): RestAddOn[] =>
  [...addOns].sort((a, b) => a.name.localeCompare(b.name)).map((a) => ({ name: a.name, pricePaise: Math.max(0, Math.round(a.pricePaise)) }));

export function lineKey(productId: string, addOns: RestAddOn[], note: string): string {
  return [productId, normalAddOns(addOns).map((a) => `${a.name}:${a.pricePaise}`).join('+'), note.trim().toLowerCase()].join('|');
}

/** One piece, with its add-ons, paise. */
export const lineUnitPaise = (line: Pick<RestLine, 'basePaise' | 'addOns'>): number =>
  line.basePaise + line.addOns.reduce((sum, a) => sum + a.pricePaise, 0);

/** The line as the waiter and the kitchen read it: "Paneer Tikka + Extra cheese · no onion". */
export function lineTitle(line: Pick<RestLine, 'name' | 'addOns' | 'note'>): string {
  const adds = line.addOns.length ? ` + ${line.addOns.map((a) => a.name).join(' + ')}` : '';
  return `${line.name}${adds}`;
}

/** Lines that still count (a line cancelled after its KOT stays at 0 until the next slip says so). */
export const liveLines = (order: Pick<RestOrder, 'lines'>): RestLine[] => order.lines.filter((l) => l.qty > 0);

export const pieceCount = (order: Pick<RestOrder, 'lines'>): number => liveLines(order).reduce((n, l) => n + l.qty, 0);

export function newOrder(kind: OrderKind, label: string, id: string, now: string): RestOrder {
  return { id, kind, label, lines: [], openedAt: now, updatedAt: now, kotRounds: 0 };
}

const touch = (order: RestOrder, lines: RestLine[], now: string): RestOrder => ({ ...order, lines, updatedAt: now });

/** One more piece of a menu item (plain, or with the add-ons given). */
export function addPiece(order: RestOrder, pick: MenuPick, now: string, addOns: RestAddOn[] = [], note = ''): RestOrder {
  const key = lineKey(pick.productId, addOns, note);
  const found = order.lines.find((l) => l.key === key);
  if (found) return touch(order, order.lines.map((l) => (l === found ? { ...l, qty: l.qty + 1 } : l)), now);
  const line: RestLine = {
    key, productId: pick.productId, name: pick.name, unit: pick.unit, qty: 1, basePaise: pick.basePaise,
    addOns: normalAddOns(addOns), note: note.trim(), kotQty: 0,
  };
  return touch(order, [...order.lines, line], now);
}

/** + / − on a line. A line the kitchen already knows about stays at 0 until the next KOT cancels it. */
export function changeQty(order: RestOrder, key: string, delta: number, now: string): RestOrder {
  const lines: RestLine[] = [];
  for (const l of order.lines) {
    if (l.key !== key) {
      lines.push(l);
      continue;
    }
    const qty = Math.max(0, l.qty + delta);
    if (qty === 0 && l.kotQty === 0) continue;
    lines.push({ ...l, qty });
  }
  return touch(order, lines, now);
}

/**
 * Add-ons / note for ONE piece of a line (the others stay as they are). A piece the kitchen already
 * has becomes "cancel the plain one, add this one" on the next KOT — exactly what the cook needs.
 */
export function applyToOnePiece(order: RestOrder, key: string, addOns: RestAddOn[], note: string, now: string): RestOrder {
  const source = order.lines.find((l) => l.key === key && l.qty > 0);
  if (!source) return order;
  const newKey = lineKey(source.productId, addOns, note);
  if (newKey === key) return order;
  const reduced = changeQty(order, key, -1, now);
  const target = reduced.lines.find((l) => l.key === newKey);
  if (target) return touch(reduced, reduced.lines.map((l) => (l === target ? { ...l, qty: l.qty + 1 } : l)), now);
  const line: RestLine = { ...source, key: newKey, qty: 1, addOns: normalAddOns(addOns), note: note.trim(), kotQty: 0 };
  return touch(reduced, [...reduced.lines, line], now);
}

export interface KotLine {
  title: string;
  note: string;
  /** > 0 = new pieces to cook, < 0 = pieces to stop. */
  delta: number;
}

/** What the next KOT slip says: the change since the last one. Empty = nothing new to send. */
export function kotChanges(order: RestOrder): KotLine[] {
  return order.lines
    .filter((l) => l.qty !== l.kotQty)
    .map((l) => ({ title: lineTitle(l), note: l.note, delta: l.qty - l.kotQty }))
    .sort((a, b) => Math.sign(a.delta) - Math.sign(b.delta));
}

/** After the slip is printed: the kitchen is up to date; cancelled lines can go. */
export function markKotSent(order: RestOrder, now: string): RestOrder {
  const lines = order.lines.filter((l) => l.qty > 0).map((l) => ({ ...l, kotQty: l.qty }));
  return { ...order, lines, updatedAt: now, kotRounds: order.kotRounds + 1 };
}

export const hasUnsentItems = (order: RestOrder): boolean => order.lines.some((l) => l.qty !== l.kotQty);

/**
 * Guests changed tables (v4.107.0): the order takes the new table's name — lines, KOT state and open
 * time stay. Refused (orders unchanged) when the target already has an order or it is not a table.
 */
export function moveOrderTo(orders: RestOrder[], id: string, toTable: string, now: string): RestOrder[] {
  const order = orders.find((o) => o.id === id);
  const to = toTable.trim();
  if (!order || order.kind !== 'table' || !to || order.label === to) return orders;
  if (orders.some((o) => o.kind === 'table' && o.label === to)) return orders;
  return orders.map((o) => (o.id === id ? { ...o, label: to, updatedAt: now } : o));
}

// ── Money ─────────────────────────────────────────────────────────────────────

/** Restaurant services (SAC / HSN 9963) — printed on the bill's GST table. */
export const RESTAURANT_HSN = '9963';
export const SERVICE_CHARGE_ID = 'restaurant_service_charge';
export const PACKING_CHARGE_ID = 'restaurant_packing_charge';

export interface DiscountInput {
  type: 'flat' | 'percentage';
  /** Rupees for flat, percent for percentage (as typed). */
  value: number;
}

/** Discount in paise on a food value (never more than the food value). */
export function discountPaise(foodPaise: number, d?: DiscountInput | null): number {
  if (!d || !(d.value > 0) || foodPaise <= 0) return 0;
  const raw = d.type === 'percentage' ? Math.round((foodPaise * Math.min(100, d.value)) / 100) : Math.round(d.value * 100);
  return Math.min(Math.max(0, raw), foodPaise);
}

export interface OrderTotals {
  /** Every line of the bill as the Sale will save it: food, then service charge, then packing. */
  items: CartItem[];
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  serviceChargePaise: number;
  packingPaise: number;
  pieces: number;
}

function chargeLine(id: string, name: string, paise: number, rate: number): CartItem {
  return {
    product_id: id, product_name: name, hsn_code: RESTAURANT_HSN, quantity: 1, unit: 'piece', unit_price: paise, mrp: paise,
    discount_amount: 0, tax_rate: rate, tax_amount: calculateLineTax(paise, rate, false), total_amount: paise, is_tax_inclusive: false,
  };
}

/**
 * The bill of an order: food lines at the shop's GST (inclusive or on top), an optional discount spread
 * over the food (saleMath.allocateBillDiscount — GST follows what is really charged), then the service
 * charge on the discounted food value and the takeaway packing charge, both with GST on top.
 */
export function orderTotals(order: RestOrder, settings: RestaurantSettings, discount?: DiscountInput | null): OrderTotals {
  const rate = settings.gstRate;
  const food: CartItem[] = liveLines(order).map((l) => {
    const unit = lineUnitPaise(l);
    const total = Math.round(l.qty * unit);
    return {
      product_id: l.productId, product_name: lineTitle(l), hsn_code: RESTAURANT_HSN, quantity: l.qty, unit: l.unit, unit_price: unit, mrp: unit,
      discount_amount: 0, tax_rate: rate, tax_amount: calculateLineTax(total, rate, settings.gstInclusive), total_amount: total,
      is_tax_inclusive: settings.gstInclusive, ...(l.note ? { notes: l.note } : {}),
    };
  });
  const foodGross = food.reduce((n, i) => n + i.total_amount, 0);
  const disc = discountPaise(foodGross, discount);
  const discounted = allocateBillDiscount(food, disc);
  const foodTotals = computeBillTotals(discounted);
  const serviceChargePaise = settings.serviceChargePercent > 0 ? Math.round((foodTotals.subtotal * settings.serviceChargePercent) / 100) : 0;
  const packingPaise = order.kind === 'takeaway' ? settings.packingChargePaise : 0;
  const items = [...discounted];
  if (serviceChargePaise > 0 && discounted.length) items.push(chargeLine(SERVICE_CHARGE_ID, `Service charge ${settings.serviceChargePercent}%`, serviceChargePaise, rate));
  if (packingPaise > 0 && discounted.length) items.push(chargeLine(PACKING_CHARGE_ID, 'Packing charge', packingPaise, rate));
  const totals = computeBillTotals(items);
  return {
    items, subtotal: totals.subtotal, taxTotal: totals.taxTotal, discountTotal: totals.discountTotal, grandTotal: totals.grandTotal,
    serviceChargePaise: discounted.length ? serviceChargePaise : 0, packingPaise: discounted.length ? packingPaise : 0, pieces: pieceCount(order),
  };
}

// ── Takeaway tokens ───────────────────────────────────────────────────────────

export interface TokenCounter {
  /** Local date (YYYY-MM-DD) the count belongs to. */
  day: string;
  last: number;
}

export const localDay = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** TA-01, TA-02… — starts again at 01 every day. */
export function nextToken(counter: TokenCounter | null | undefined, now: Date = new Date()): { label: string; counter: TokenCounter } {
  const day = localDay(now);
  const last = counter && counter.day === day ? Math.max(0, Math.floor(counter.last) || 0) : 0;
  const n = last + 1;
  return { label: `TA-${String(n).padStart(2, '0')}`, counter: { day, last: n } };
}

/** Whole minutes an order has been open ("12 min"); 0 for a bad date. */
export function minutesOpen(order: Pick<RestOrder, 'openedAt'>, now: number = Date.now()): number {
  const t = Date.parse(order.openedAt);
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 60000)) : 0;
}

export function formatOpenTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} m`;
}
