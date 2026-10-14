import { FieldSpec, paiseInt, specFromCloud, specToCloud, toBool } from '@/lib/cloud/cloudFormat';
import { calculateLineTax } from '@/lib/sales/saleMath';

/**
 * Cloud data contract, Desktop side (docs/CLOUD_DATA_CONTRACT.md). Every Firestore write
 * goes through toCloud() and every read through fromCloud(), so Dexie keeps its own names
 * and the cloud carries the names both apps agree on: money as `*_paise`, stock as
 * `stock_quantity`, the bill's payment split as flat fields, the shop as `biz_<uid>`.
 * Pure — no Firebase, no Dexie.
 */

export interface CloudContext {
  /** `biz_<Firebase uid>` (R1). Every document's `business_id` becomes this. */
  bizId: string;
}

/** Every table that goes to the cloud (D1: all of them — the same set as a backup file). */
export const CLOUD_TABLES = [
  'businesses', 'categories', 'products', 'customers', 'suppliers', 'sales', 'inventory_movements',
  'ledger_transactions', 'cash_registers', 'cash_expenses', 'sales_returns', 'marketing_templates',
  'audit_logs', 'purchase_bills',
] as const;
export type CloudTable = (typeof CLOUD_TABLES)[number];

/** Running restaurant orders & metadata shared between counter PC and staff phones (v4.140.0, R1). */
export const RESTAURANT_COLLECTIONS = ['restaurant_orders', 'restaurant_meta'] as const;
export type RestaurantCollection = (typeof RESTAURANT_COLLECTIONS)[number];
export type AnyCloudTable = CloudTable | RestaurantCollection;

type Row = Record<string, any>;
const DATES = ['created_at', 'updated_at'];

// §4.1 / §4.3 — words older writers used.
const UNIT_ALIASES: Record<string, string> = { pcs: 'piece', pc: 'piece', nos: 'piece', pkt: 'packet' };
const STATUS_ALIASES: Record<string, string> = { refunded: 'returned', partially_refunded: 'partial_return' };

export function normalizeUnit(unit: unknown): unknown {
  if (typeof unit !== 'string') return unit;
  const u = unit.trim().toLowerCase();
  return UNIT_ALIASES[u] || u;
}

// ---- Nested lines -------------------------------------------------------------------------

const SALE_ITEM: FieldSpec = {
  money: ['unit_price', 'tax_amount', 'cost_price', 'mrp'],
  custom: ['total_amount', 'discount_amount', 'bill_discount_amount', 'is_tax_inclusive'],
  ignoreIn: ['gross_total_paise', 'discount_paise', 'bill_discount_paise', 'discount_type', 'discount_value', 'is_tax_inclusive'],
};

/** §3.6 — `gross_total_paise` is the line before its share of the bill discount (Android's meaning). */
function saleItemToCloud(item: Row): Row {
  const bill = paiseInt(item.bill_discount_amount) ?? 0;
  const out = specToCloud(SALE_ITEM, item);
  out.gross_total_paise = (paiseInt(item.total_amount) ?? 0) + bill;
  out.discount_paise = (paiseInt(item.discount_amount) ?? 0) - bill;
  out.bill_discount_paise = bill;
  out.is_tax_inclusive = item.is_tax_inclusive !== false; // Desktop: unset = inclusive (saleMath)
  return out;
}

function saleItemFromCloud(line: Row): Row {
  const item = specFromCloud(SALE_ITEM, line);
  const qty = Number(line.quantity) || 0;
  const unitPrice = paiseInt(line.unit_price_paise) ?? 0;
  const bill = paiseInt(line.bill_discount_paise) ?? 0;
  // Android lines before the contract: the line discount as a type + value (flat = rupees).
  let lineDiscount = paiseInt(line.discount_paise);
  if (lineDiscount === undefined) {
    const v = Number(line.discount_value) || 0;
    lineDiscount = line.discount_type === 'percentage' ? Math.round((qty * unitPrice * v) / 100) : Math.round(v * 100);
  }
  const gross = paiseInt(line.gross_total_paise) ?? Math.round(qty * unitPrice) - lineDiscount;
  const inclusive = toBool(line.is_tax_inclusive) !== false;
  item.unit = normalizeUnit(item.unit) || 'piece';
  item.total_amount = gross - bill;
  item.discount_amount = lineDiscount + bill;
  if (bill > 0) item.bill_discount_amount = bill;
  item.is_tax_inclusive = inclusive;
  item.tax_amount ??= calculateLineTax(item.total_amount, Number(item.tax_rate) || 0, inclusive);
  item.mrp ??= unitPrice;
  return item;
}

const RETURN_ITEM: FieldSpec = { money: ['unit_price', 'total_amount'] };
const BILL_LINE: FieldSpec = { money: ['unit_price', 'total_price', 'selling_price', 'mrp'] };
const ALLOCATION: FieldSpec = { money: ['amount'] };

function mapLines(lines: unknown, map: (r: Row) => Row): Row[] | undefined {
  return Array.isArray(lines) ? lines.map((l) => map(l || {})) : undefined;
}

// ---- Tables -------------------------------------------------------------------------------

interface TableSpec extends FieldSpec {
  out?: (row: Row, doc: Row) => void;
  in?: (doc: Row, row: Row, local: Row | null | undefined) => void;
}

const SPECS: Record<CloudTable | RestaurantCollection, TableSpec> = {
  businesses: {
    rename: { upi_id: 'upi_vpa', fssai_license_no: 'fssai' },
    // business_type: Android's vertical lives in the cloud; the Desktop is one universal app and
    // never overwrites it (a new cloud shop gets 'grocery' from the sync, §3.1).
    local: ['next_invoice_number', 'is_onboarded', 'business_type'],
    ignoreIn: ['id', 'business_id', 'owner_uid', 'platform', 'shop_name', 'business_name', 'store_name', 'city', 'fcm_token',
      'trial_started_at', 'device_reported_pro', 'device_reported_plan', 'device_reported_expiry', 'device_reported_tier',
      'total_sales_count', 'total_revenue_paise', 'last_sale_at', 'category'],
    dates: DATES,
    out: (row, doc) => {
      doc.platform = 'desktop';
      // v4.137.0: the phone reads the shop's name as store_name (older builds: only that or business_name).
      // With `name` alone a shop made on the PC looked like "no shop" and the phone showed its signup form.
      if (typeof row.name === 'string' && row.name.trim()) doc.store_name = doc.shop_name = doc.business_name = row.name;
    },
    in: (doc, row, local) => {
      if (local) return;
      // This computer has no shop yet (a restore onto a new PC): what the Desktop needs to open.
      row.business_type ??= 'retail';
      row.currency ??= 'INR';
      row.language ??= 'hi';
      row.invoice_prefix ??= 'INV-';
      row.next_invoice_number ??= 1;
      row.is_onboarded ??= true;
      row.created_at ??= new Date().toISOString();
      row.updated_at ??= row.created_at;
    },
  },
  categories: {
    dates: ['created_at'],
    in: (doc, row, local) => { if (!local) row.created_at ??= new Date().toISOString(); },
  },
  products: {
    money: ['purchase_price', 'selling_price', 'mrp', 'wholesale_price'],
    rename: { current_stock: 'stock_quantity' },
    bools: ['is_tax_inclusive', 'is_loose_item', 'is_favorite', 'is_active', 'has_variants', 'allow_decimal', 'is_unlimited_stock'],
    ignoreIn: ['stock', 'price'],
    dates: DATES,
    in: (doc, row, local) => {
      row.unit = normalizeUnit(row.unit) || 'piece';
      // v4.134.0: the phone writes "unlimited / uncounted" as stock >= 99990 (no flag). Taken as stock it
      // counted 999999 pieces — Inventory Asset ₹5.5 crore for one ₹55 item (live sync test).
      if (Number(row.current_stock) >= 99990) row.is_unlimited_stock = true;
      if (local) return;
      // A product first made on the phone: the fields the Desktop screens expect.
      row.category_id ??= '';
      row.current_stock ??= 0;
      row.min_stock_level ??= 0;
      row.purchase_price ??= 0;
      row.selling_price ??= 0;
      row.mrp ??= row.selling_price;
      row.tax_rate ??= 0;
      row.is_tax_inclusive ??= true;
      row.is_favorite ??= false;
      row.is_active ??= true;
      row.created_at ??= new Date().toISOString();
      row.updated_at ??= row.created_at;
    },
  },
  customers: {
    // credit_limit ↔ the phone's credit_limit_paise (v4.102.0, K-D03).
    money: ['current_balance', 'opening_balance', 'total_spent', 'credit_limit'],
    bools: ['is_wholesale'],
    // state_code: worked out from the GSTIN on the way out; the phone's copy stays in the cloud (merge writes).
    ignoreIn: ['is_vip', 'birthday', 'state_code'],
    dates: DATES,
    out: (row, doc) => {
      doc.is_vip = row.customer_type === 'vip';
      const md = /(?:^|-)(\d{2}-\d{2})$/.exec(String(row.date_of_birth || ''));
      if (md) doc.birthday = md[1];
      const gstin = String(row.gstin || '');
      if (gstin.length >= 2 && !doc.state_code) doc.state_code = gstin.slice(0, 2);
    },
    in: (doc, row, local) => {
      if (typeof toBool(doc.is_vip) === 'boolean') {
        if (toBool(doc.is_vip)) row.customer_type = 'vip';
        else if (row.customer_type === 'vip') row.customer_type = local && local.customer_type !== 'vip' ? local.customer_type : 'regular';
      }
      // Birthday arrives as MM-DD; keep the year this computer already knows.
      if (!('date_of_birth' in doc) && typeof doc.birthday === 'string' && doc.birthday) {
        if (!String(local?.date_of_birth || '').endsWith(doc.birthday)) row.date_of_birth = doc.birthday;
      }
      if (local) return;
      row.opening_balance ??= 0;
      row.current_balance ??= 0;
      row.loyalty_points ??= 0;
      row.total_spent ??= 0;
      row.total_visits ??= 0;
      row.customer_type ??= 'regular';
      row.created_at ??= new Date().toISOString();
      row.updated_at ??= row.created_at;
    },
  },
  suppliers: { money: ['current_balance', 'opening_balance'], dates: DATES },
  sales: {
    money: ['subtotal', 'tax_total', 'grand_total', 'amount_received', 'balance_due', 'balance_due_at_sale', 'change_returned', 'returned_amount'],
    rename: { subtotal: 'subtotal_paise', tax_total: 'tax_amount_paise', grand_total: 'total_amount_paise' },
    custom: ['items', 'payment_split', 'discount_total'],
    ignoreIn: ['items', 'discount_paise', 'line_discount_paise', 'split_cash_paise', 'split_upi_paise', 'split_card_paise',
      'split_credit_paise', 'split_notes', 'timestamp', 'source', 'total_amount'],
    dates: DATES,
    out: (row, doc) => {
      const items = mapLines(row.items, saleItemToCloud) || [];
      doc.items = items;
      // §3.5 — `discount_paise` is the bill-level discount only; line discounts are separate.
      doc.discount_paise = items.reduce((s, l) => s + (l.bill_discount_paise || 0), 0);
      doc.line_discount_paise = (paiseInt(row.discount_total) ?? 0) - doc.discount_paise;
      const split = row.payment_split;
      if (split) {
        doc.split_cash_paise = paiseInt(split.cash_amount) ?? 0;
        doc.split_upi_paise = paiseInt(split.upi_amount) ?? 0;
        doc.split_card_paise = paiseInt(split.card_amount) ?? 0;
        doc.split_credit_paise = paiseInt(split.credit_amount) ?? 0;
        if (split.notes) doc.split_notes = split.notes;
      }
      const t = Date.parse(row.created_at);
      if (Number.isFinite(t)) doc.timestamp = t;
      doc.source = 'desktop';
    },
    in: (doc, row, local) => {
      if (Array.isArray(doc.items)) row.items = doc.items.map((l: Row) => saleItemFromCloud(l || {}));
      if (typeof row.status === 'string') row.status = STATUS_ALIASES[row.status] || row.status;
      const lineDiscounts = (row.items || []).reduce((s: number, i: Row) => s + ((i.discount_amount || 0) - (i.bill_discount_amount || 0)), 0);
      if ('discount_paise' in doc || 'line_discount_paise' in doc) {
        row.discount_total = (paiseInt(doc.discount_paise) ?? 0) + (paiseInt(doc.line_discount_paise) ?? lineDiscounts);
      }
      const splitKeys = ['split_cash_paise', 'split_upi_paise', 'split_card_paise', 'split_credit_paise'];
      if (splitKeys.some((k) => k in doc)) {
        const s = { cash_amount: paiseInt(doc.split_cash_paise) ?? 0, upi_amount: paiseInt(doc.split_upi_paise) ?? 0, card_amount: paiseInt(doc.split_card_paise) ?? 0, credit_amount: paiseInt(doc.split_credit_paise) ?? 0 };
        if (row.payment_method === 'split' || s.cash_amount + s.upi_amount + s.card_amount + s.credit_amount > 0) {
          row.payment_split = doc.split_notes ? { ...s, notes: doc.split_notes } : s;
        }
      }
      if (local) return;
      // A bill first made on the phone: what the Desktop's khata / cash screens read.
      const total = row.grand_total ?? 0;
      const owed = row.payment_method === 'credit' ? total : row.payment_method === 'split' ? row.payment_split?.credit_amount ?? 0 : 0;
      row.balance_due ??= owed;
      row.amount_received ??= total - owed;
      row.change_returned ??= 0;
      row.discount_total ??= (row.items || []).reduce((s: number, i: Row) => s + (i.discount_amount || 0), 0);
      row.payment_status ??= owed <= 0 ? 'paid' : owed >= total ? 'unpaid' : 'partial';
      row.status ??= 'completed';
      row.created_by ??= 'android';
      row.updated_at ??= row.created_at;
    },
  },
  inventory_movements: { dates: ['created_at'] },
  ledger_transactions: {
    money: ['amount', 'balance_after'],
    custom: ['bill_allocations'],
    ignoreIn: ['bill_allocations'],
    dates: ['created_at'],
    out: (row, doc) => { const a = mapLines(row.bill_allocations, (l) => specToCloud(ALLOCATION, l)); if (a) doc.bill_allocations = a; },
    in: (doc, row) => { const a = mapLines(doc.bill_allocations, (l) => specFromCloud(ALLOCATION, l)); if (a) row.bill_allocations = a; },
  },
  cash_registers: {
    money: ['opening_cash', 'cash_sales', 'upi_sales', 'credit_sales', 'cash_in', 'cash_out', 'expected_closing_cash', 'actual_closing_cash', 'difference'],
    dates: ['opened_at', 'closed_at'],
  },
  cash_expenses: { money: ['amount'], dates: ['created_at'] },
  sales_returns: {
    money: ['refund_amount'],
    custom: ['items'],
    ignoreIn: ['items'],
    dates: ['created_at'],
    out: (row, doc) => { const a = mapLines(row.items, (l) => specToCloud(RETURN_ITEM, l)); if (a) doc.items = a; },
    in: (doc, row) => { const a = mapLines(doc.items, (l) => { const r = specFromCloud(RETURN_ITEM, l); r.unit = normalizeUnit(r.unit); return r; }); if (a) row.items = a; },
  },
  marketing_templates: {},
  audit_logs: { dates: ['created_at'] },
  purchase_bills: {
    money: ['total_amount'],
    custom: ['line_items'],
    ignoreIn: ['line_items'],
    dates: ['created_at', 'confirmed_at'],
    out: (row, doc) => { const a = mapLines(row.line_items, (l) => specToCloud(BILL_LINE, l)); if (a) doc.line_items = a; },
    in: (doc, row) => { const a = mapLines(doc.line_items, (l) => specFromCloud(BILL_LINE, l)); if (a) row.line_items = a; },
  },
  restaurant_orders: { dates: ['openedAt', 'updatedAt'] },
  restaurant_meta: { dates: ['updated_at'] },
};

/** Dexie row → Firestore document for `businesses/{bizId}/{table}/{id}` (or the shop doc itself). */
export function toCloud(table: CloudTable | RestaurantCollection, row: Row, ctx: CloudContext): Row {
  const spec = (SPECS as Record<string, any>)[table] || {};
  const doc = specToCloud(spec, row);
  spec.out?.(row, doc);
  doc.business_id = ctx.bizId;
  if (table === 'businesses') doc.id = ctx.bizId;
  return doc;
}

/** Firestore document → Dexie row, merged over the row this computer already has (R7). */
export function fromCloud(table: CloudTable | RestaurantCollection, doc: Row, local: Row | null | undefined, ctx: CloudContext): Row {
  const spec = (SPECS as Record<string, any>)[table] || {};
  const row = specFromCloud(spec, doc, local);
  spec.in?.(doc, row, local);
  if (table === 'businesses') row.id = local?.id ?? ctx.bizId;
  else if (table !== 'marketing_templates') row.business_id = local?.business_id ?? ctx.bizId;
  return row;
}

/** `businesses/{biz}` → 'businesses'; `businesses/{biz}/{table}/{id}` → table; anything else → null. */
export function tableForCloudPath(path: string): CloudTable | RestaurantCollection | null {
  const parts = path.split('/').filter(Boolean);
  if (parts[0] !== 'businesses') return null;
  const table = parts.length === 2 ? 'businesses' : parts.length === 4 ? parts[2] : '';
  if ((CLOUD_TABLES as readonly string[]).includes(table)) return table as CloudTable;
  if ((RESTAURANT_COLLECTIONS as readonly string[]).includes(table)) return table as RestaurantCollection;
  return null;
}
