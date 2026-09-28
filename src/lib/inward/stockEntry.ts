import { InventoryMovement, Product, ProductUnit } from '@/types';
import { msg } from '@/lib/i18n/core';
import { normName, parseAmount } from '@/lib/import/catalogImport';
import { DEFAULT_COUNTED_STOCK } from '@/lib/products/variants';

/*
 * Goods coming in (v4.77.0) — one rule for every way stock arrives: "New stock + labels"
 * in Barcode Studio, Manual Inward and the supplier's Excel bill. Pure logic, no database.
 *
 * Label-first flow: the shop types name, price and quantity; every row becomes a saved
 * item (or restocks one) with counted stock and its own barcode, and gets one label per
 * piece — so every label printed here scans at the counter.
 */

/** Units sold by weight / volume / length: one label per lot, decimals allowed. */
const MEASURED_UNITS: string[] = ['kg', 'gram', 'litre', 'ml', 'meter', 'foot', 'sqft'];
export const isMeasuredUnit = (unit: string | undefined): boolean => MEASURED_UNITS.includes(String(unit || ''));

/** The most labels one item gets in one go (the print list allows 999). */
export const MAX_LABEL_COPIES = 999;

/** Labels for a quantity received: one per piece / box / packet; one for a lot sold by measure. */
export function labelCopiesFor(unit: string | undefined, qty: number): number {
  if (!(qty > 0)) return 0;
  if (isMeasuredUnit(unit)) return 1;
  return Math.min(MAX_LABEL_COPIES, Math.ceil(qty - 1e-9));
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Stock after goods come in. A counted item adds the quantity. An item that was not
 * counted ("Unlimited stock") starts counting from what came in — the shop now knows
 * how many it has; its old, unused number is not added to.
 */
export function stockAfterInward(p: Pick<Product, 'current_stock' | 'is_unlimited_stock'>, qty: number): { previous: number; next: number; startsCounting: boolean } {
  if (p.is_unlimited_stock) return { previous: 0, next: round3(qty), startsCounting: true };
  const previous = Number(p.current_stock) || 0;
  return { previous, next: round3(previous + qty), startsCounting: false };
}

/** Low-stock alert for an item that starts counting at `qty`: about a fifth of it, 1 to 10. */
export function lowStockAlertFor(qty: number): number {
  return Math.max(1, Math.min(DEFAULT_COUNTED_STOCK, Math.floor(qty / 5)));
}

/** The stock-movement row for goods received (reason stays English — it is saved data). */
export function inwardMovement(args: {
  id: string;
  businessId: string;
  product: Pick<Product, 'id' | 'name'>;
  qty: number;
  stock: { previous: number; next: number; startsCounting: boolean };
  reason: string;
  referenceId?: string;
  now: string;
}): InventoryMovement {
  return {
    id: args.id,
    business_id: args.businessId,
    product_id: args.product.id,
    product_name: args.product.name,
    movement_type: 'PURCHASE',
    quantity: args.qty,
    previous_stock: args.stock.previous,
    new_stock: args.stock.next,
    reference_id: args.referenceId,
    reason: args.stock.startsCounting ? `${args.reason} — stock counting started` : args.reason,
    created_by: 'owner',
    created_at: args.now,
  };
}

// ---------------------------------------------------------------------------
// "New stock + labels" rows (Barcode Studio)
// ---------------------------------------------------------------------------

export interface StockEntryRow {
  key: string;
  /** A saved item picked from the suggestions (restock); none = a new item. */
  productId?: string;
  name: string;
  /** As typed, in ₹. With "Separate Selling Price" off this is the MRP (the item sells at it). */
  price: string;
  mrp: string;
  cost: string;
  qty: string;
  unit: ProductUnit;
  /** GST % as typed ('' = none). */
  gst: string;
  hsn: string;
  /** A code scanned from the packet for a new item; '' = the shop's own code is given. */
  barcode: string;
  /** This row's own category (Fast barcode inward, v4.78.0); none = the batch's category. */
  categoryId?: string;
}

export interface StockEntryOptions {
  /** Settings → Features → "Separate Selling Price". */
  separateSellingPrice: boolean;
  /**
   * Fast barcode inward (v4.78.0): a row may leave the quantity blank — a new item is then
   * saved "Unlimited" (not counted) and a saved item's stock is left as it is.
   */
  qtyOptional?: boolean;
}

export interface PlannedNewItem {
  kind: 'new';
  key: string;
  name: string;
  unit: ProductUnit;
  qty: number;
  pricePaise: number;
  mrpPaise: number;
  costPaise: number | null;
  gstRate: number | null;
  hsn: string;
  barcode: string;
  categoryId?: string;
}

export interface PlannedRestock {
  kind: 'restock';
  key: string;
  product: Product;
  qty: number;
  /** A new price typed for the item (null = keep its price). */
  pricePaise: number | null;
  mrpPaise: number | null;
  costPaise: number | null;
  /** A category picked for the saved item (undefined = keep its own). */
  categoryId?: string;
}

export type PlannedLine = PlannedNewItem | PlannedRestock;

export interface StockEntryPlan {
  /** Rows in the order typed. */
  lines: PlannedLine[];
  /** Row key → what is wrong (msg id). Nothing is saved while there is one. */
  errors: Record<string, string>;
  created: number;
  restocked: number;
  labels: number;
}

export const emptyEntryRow = (key: string, unit: ProductUnit = 'piece'): StockEntryRow => ({
  key, name: '', price: '', mrp: '', cost: '', qty: '', unit, gst: '', hsn: '', barcode: '',
});

export const isBlankEntryRow = (r: StockEntryRow): boolean =>
  !r.productId && !r.name.trim() && !r.price.trim() && !r.qty.trim() && !r.barcode.trim();

/** ₹ text → paise; blank → null; not a number → NaN (an error). */
function paiseOf(text: string): number | null {
  if (!text.trim()) return null;
  const n = parseAmount(text);
  return n === null || n < 0 ? NaN : Math.round(n * 100);
}

/**
 * What saving the rows will do: new items, restocked items (picked, or found by the
 * scanned code or the exact name — never a second copy of a saved item), and the
 * problems to fix first. Blank rows are ignored.
 */
export function planStockEntry(rows: StockEntryRow[], products: Product[], opts: StockEntryOptions): StockEntryPlan {
  const sellable = products.filter((p) => p.is_active !== false && !p.has_variants);
  const byId = new Map(sellable.map((p) => [p.id, p]));
  const byCode = new Map<string, Product>();
  const byName = new Map<string, Product>();
  for (const p of sellable) {
    if (p.barcode?.trim() && !byCode.has(p.barcode.trim())) byCode.set(p.barcode.trim(), p);
    if (!byName.has(normName(p.name))) byName.set(normName(p.name), p);
  }
  const parentNames = new Set(products.filter((p) => p.has_variants).map((p) => normName(p.name)));

  const plan: StockEntryPlan = { lines: [], errors: {}, created: 0, restocked: 0, labels: 0 };
  const seen = new Set<string>();

  for (const r of rows) {
    if (isBlankEntryRow(r)) continue;
    const fail = (m: string) => { plan.errors[r.key] = m; };
    const product = (r.productId && byId.get(r.productId)) || (r.barcode.trim() && byCode.get(r.barcode.trim())) || byName.get(normName(r.name)) || null;

    if (r.productId && !product) { fail(msg('This item was deleted — type it again')); continue; }
    if (!product && !r.name.trim()) { fail(msg('Type the item name')); continue; }
    if (!product && parentNames.has(normName(r.name))) { fail(msg('This item has sizes / colours — type the size too, e.g. "Shirt (M)"')); continue; }

    const unit = product ? product.unit : r.unit;
    // Blank quantity (fast inward only) = 0: nothing counted, nothing added.
    const qty = opts.qtyOptional && !r.qty.trim() ? 0 : parseAmount(r.qty);
    if (qty === null || !(qty > 0 || (opts.qtyOptional && qty === 0 && !r.qty.trim()))) { fail(msg('Enter the quantity received')); continue; }
    if (qty > 100000) { fail(msg('Quantity is too large')); continue; }
    if (!isMeasuredUnit(unit) && !product?.allow_decimal && !Number.isInteger(qty)) { fail(msg('Whole numbers only for this unit')); continue; }

    const price = paiseOf(r.price);
    const mrp = opts.separateSellingPrice ? paiseOf(r.mrp) : null;
    const cost = paiseOf(r.cost);
    if (Number.isNaN(price) || Number.isNaN(mrp) || Number.isNaN(cost)) { fail(msg('Prices must be numbers')); continue; }
    if (price === 0) { fail(msg('The price cannot be 0')); continue; }
    const gst = r.gst.trim() === '' ? null : Number(r.gst);
    if (gst !== null && !(gst >= 0 && gst <= 100)) { fail(msg('GST % must be between 0 and 100')); continue; }

    let line: PlannedLine;
    if (product) {
      // A price typed for a saved item is its new price (and the label's); blank keeps it.
      let pricePaise: number | null = null;
      let mrpPaise: number | null = null;
      if (price !== null) {
        pricePaise = price;
        mrpPaise = opts.separateSellingPrice ? mrp ?? Math.max(product.mrp || 0, price) : price;
      } else if (mrp !== null) {
        mrpPaise = mrp;
      }
      if (mrpPaise !== null && mrpPaise < (pricePaise ?? product.selling_price)) { fail(msg('MRP cannot be less than the price')); continue; }
      line = { kind: 'restock', key: r.key, product, qty, pricePaise, mrpPaise, costPaise: cost, categoryId: r.categoryId && r.categoryId !== product.category_id ? r.categoryId : undefined };
    } else {
      if (price === null) { fail(opts.separateSellingPrice ? msg('Enter the selling price') : msg('Enter the MRP')); continue; }
      const mrpPaise = mrp ?? price;
      if (mrpPaise < price) { fail(msg('MRP cannot be less than the price')); continue; }
      line = {
        kind: 'new', key: r.key, name: r.name.trim(), unit, qty, pricePaise: price, mrpPaise, costPaise: cost,
        gstRate: gst, hsn: r.hsn.replace(/\D/g, '').slice(0, 8), barcode: r.barcode.trim(), categoryId: r.categoryId || undefined,
      };
    }

    const dupKey = product ? `id:${product.id}` : `new:${normName(r.name)}`;
    if (seen.has(dupKey)) { fail(msg('Same item twice — put the total quantity in one row')); continue; }
    seen.add(dupKey);
    plan.lines.push(line);
    if (line.kind === 'new') plan.created++;
    else plan.restocked++;
    plan.labels += labelCopiesFor(unit, qty);
  }
  return plan;
}
