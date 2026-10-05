import { db } from '@/lib/db';
import { newId } from '@/lib/ids';
import { formatInvoiceNumber, parseInvoiceSequenceNumber } from '@/lib/invoices/invoiceNumberService';
import { inwardMovement, stockAfterInward } from '@/lib/inward/stockEntry';
import { recordSupplierEntry, writeSupplierReturn } from '@/lib/suppliers/supplierLedger';
import { formatINR } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import type { InventoryMovement, Product, PurchaseBill, PurchaseBillLineItem, Supplier } from '@/types';

/*
 * Supplier documents besides the bill (v4.102.0, tracker K-D21 / FS-09):
 * - Debit note (DN-001): goods sent back to the supplier — stock goes down, and for a saved
 *   supplier what the shop owes goes down by the returned value (ledger ADJUSTMENT).
 * - Purchase order (PO-001): what the shop asks the supplier for — nothing changes until it is
 *   received, then it is a normal stock inward (and, on credit, a purchase on the account).
 * Both are rows of purchase_bills with `kind`, so backup, restore and the cloud carry them as is.
 */

export const DEBIT_NOTE_PREFIX = 'DN-';
export const PURCHASE_ORDER_PREFIX = 'PO-';
/** The ledger note of a debit note starts with this (Suppliers shows it as "Goods returned"). */
export const DEBIT_NOTE_LEDGER_NOTE = 'Debit note';

export type SupplierDocKind = 'bill' | 'debit_note' | 'order';

export function supplierDocKind(bill: Pick<PurchaseBill, 'kind'>): SupplierDocKind {
  return bill.kind === 'debit_note' || bill.kind === 'order' ? bill.kind : 'bill';
}

/** Badge on Purchases / Suppliers: a bill is "Confirmed"; a debit note / order says what it is. */
export function supplierDocLabel(bill: Pick<PurchaseBill, 'kind' | 'status'>): string {
  const kind = supplierDocKind(bill);
  if (kind === 'debit_note') return tr('Debit note');
  if (kind === 'order') return bill.status === 'confirmed' ? tr('Order received') : bill.status === 'discarded' ? tr('Order cancelled') : tr('Order open');
  return tr('Confirmed');
}

/** One more than the highest number of that series already saved (DN-001, PO-001). */
export function nextSupplierDocNumber(prefix: string, existing: (string | undefined)[]): string {
  let max = 0;
  for (const n of existing) {
    if (!n || !n.toUpperCase().startsWith(prefix)) continue;
    const seq = parseInvoiceSequenceNumber(n);
    if (seq !== null && seq > max) max = seq;
  }
  return formatInvoiceNumber(prefix, max + 1, 3);
}

/** A line the shop typed: a saved item, how many, at what cost (paise per unit). */
export interface SupplierDocLine {
  productId: string;
  name: string;
  unit?: string;
  qty: number;
  costPaise: number;
}

/** Lines with an item and a quantity above 0; value = qty × cost, rounded to paise. */
export function cleanDocLines(lines: SupplierDocLine[]): SupplierDocLine[] {
  return lines.filter((l) => l.productId && l.qty > 0).map((l) => ({ ...l, costPaise: Math.max(0, Math.round(l.costPaise || 0)) }));
}

export function docLinesTotal(lines: SupplierDocLine[]): number {
  return cleanDocLines(lines).reduce((sum, l) => sum + Math.round(l.qty * l.costPaise), 0);
}

function toBillLines(lines: SupplierDocLine[]): PurchaseBillLineItem[] {
  return cleanDocLines(lines).map((l) => ({
    raw_name: l.name,
    matched_product_id: l.productId,
    is_new_product: false,
    quantity: l.qty,
    unit: l.unit,
    unit_price: l.costPaise,
    total_price: Math.round(l.qty * l.costPaise),
    confidence: 'high',
  }));
}

/** Stock after goods go back: a counted item loses the quantity (never below 0); an uncounted one is unchanged. */
export function stockAfterReturn(p: Pick<Product, 'current_stock' | 'is_unlimited_stock'>, qty: number): { previous: number; next: number; changes: boolean } {
  const previous = Number(p.current_stock) || 0;
  if (p.is_unlimited_stock) return { previous, next: previous, changes: false };
  return { previous, next: Math.max(0, Math.round((previous - qty) * 1000) / 1000), changes: true };
}

async function existingNumbers(): Promise<(string | undefined)[]> {
  return (await db.purchase_bills.toArray()).map((b) => b.bill_number);
}

export interface SupplierDocInput {
  businessId: string;
  supplier?: Supplier | null;
  /** Typed name when the supplier is not a saved one. */
  supplierName?: string;
  lines: SupplierDocLine[];
  notes?: string;
}

/**
 * Saves a debit note: stock down for every line, one movement each, and — for a saved supplier with
 * `adjustAccount` — the returned value taken off what the shop owes. All in one transaction.
 */
export async function saveDebitNote(input: SupplierDocInput & { adjustAccount: boolean }): Promise<{ ok: true; bill: PurchaseBill } | { ok: false; error: string }> {
  const lines = cleanDocLines(input.lines);
  if (lines.length === 0) return { ok: false, error: 'no-lines' };
  const now = new Date().toISOString();
  const total = docLinesTotal(lines);
  const supplier = input.supplier || null;
  const number = nextSupplierDocNumber(DEBIT_NOTE_PREFIX, await existingNumbers());
  const bill: PurchaseBill = {
    id: newId('dn'),
    business_id: input.businessId,
    supplier_id: supplier?.id,
    supplier_name_raw: supplier?.name || input.supplierName?.trim() || undefined,
    bill_number: number,
    bill_date: now.slice(0, 10),
    raw_ai_response: '',
    line_items: toBillLines(lines),
    total_amount: total,
    kind: 'debit_note',
    notes: input.notes?.trim() || undefined,
    status: 'confirmed',
    ai_model_used: 'manual',
    created_at: now,
    confirmed_at: now,
    sync_status: 'pending',
  };
  await db.transaction('rw', [db.products, db.inventory_movements, db.purchase_bills, db.suppliers, db.ledger_transactions], async () => {
    for (const l of lines) {
      const prod = await db.products.get(l.productId);
      if (!prod) continue;
      const stock = stockAfterReturn(prod, l.qty);
      if (!stock.changes) continue;
      await db.products.update(prod.id, { current_stock: stock.next, updated_at: now });
      const mov: InventoryMovement = {
        id: newId('mov_dn'),
        business_id: input.businessId,
        product_id: prod.id,
        product_name: prod.name,
        movement_type: 'ADJUSTMENT',
        quantity: l.qty,
        previous_stock: stock.previous,
        new_stock: stock.next,
        reference_id: bill.id,
        reason: `Returned to supplier — Debit note ${number}${bill.supplier_name_raw ? ` (${bill.supplier_name_raw})` : ''}`,
        created_by: 'owner',
        created_at: now,
      };
      await db.inventory_movements.put(mov);
    }
    await db.purchase_bills.put(bill);
    if (supplier && input.adjustAccount && total > 0) {
      await writeSupplierReturn({ supplierId: supplier.id, amountPaise: total, note: `${DEBIT_NOTE_LEDGER_NOTE} ${number}: goods returned`, referenceId: bill.id, date: now });
    }
  });
  return { ok: true, bill };
}

/** Saves a purchase order (open). Nothing else changes until it is received. */
export async function savePurchaseOrder(input: SupplierDocInput): Promise<{ ok: true; bill: PurchaseBill } | { ok: false; error: string }> {
  const lines = cleanDocLines(input.lines);
  if (lines.length === 0) return { ok: false, error: 'no-lines' };
  const now = new Date().toISOString();
  const bill: PurchaseBill = {
    id: newId('po'),
    business_id: input.businessId,
    supplier_id: input.supplier?.id,
    supplier_name_raw: input.supplier?.name || input.supplierName?.trim() || undefined,
    bill_number: nextSupplierDocNumber(PURCHASE_ORDER_PREFIX, await existingNumbers()),
    bill_date: now.slice(0, 10),
    raw_ai_response: '',
    line_items: toBillLines(lines),
    total_amount: docLinesTotal(lines),
    kind: 'order',
    notes: input.notes?.trim() || undefined,
    status: 'pending_review',
    ai_model_used: 'manual',
    created_at: now,
    sync_status: 'pending',
  };
  await db.purchase_bills.put(bill);
  return { ok: true, bill };
}

/**
 * Goods of an open order arrived: stock in for every line (same rule as Manual Inward), cost price
 * updated, the order marked received, and — on credit from a saved supplier — the value added to
 * what the shop owes.
 */
export async function receivePurchaseOrder(orderId: string, onCredit: boolean): Promise<{ ok: boolean; error?: string }> {
  const order = await db.purchase_bills.get(orderId);
  if (!order || supplierDocKind(order) !== 'order') return { ok: false, error: 'not-found' };
  if (order.status !== 'pending_review') return { ok: false, error: 'not-open' };
  const now = new Date().toISOString();
  const vendor = order.supplier_name_raw || 'Supplier';
  await db.transaction('rw', [db.products, db.inventory_movements, db.purchase_bills], async () => {
    for (const l of order.line_items || []) {
      const prod = l.matched_product_id ? await db.products.get(l.matched_product_id) : undefined;
      if (!prod || !(l.quantity > 0)) continue;
      const stock = stockAfterInward(prod, l.quantity);
      await db.products.update(prod.id, {
        current_stock: stock.next,
        is_unlimited_stock: false,
        ...(l.unit_price > 0 ? { purchase_price: l.unit_price } : {}),
        updated_at: now,
      });
      await db.inventory_movements.put(inwardMovement({
        id: newId('mov_po'),
        businessId: order.business_id,
        product: prod,
        qty: l.quantity,
        stock,
        reason: `Purchase order ${order.bill_number} received: ${vendor}`,
        referenceId: order.id,
        now,
      }));
    }
    await db.purchase_bills.update(order.id, { status: 'confirmed', confirmed_at: now, sync_status: 'pending' });
  });
  if (onCredit && order.supplier_id && order.total_amount > 0) {
    const res = await recordSupplierEntry({
      supplierId: order.supplier_id,
      kind: 'purchase',
      amountPaise: order.total_amount,
      note: `Purchase order ${order.bill_number} received`,
      referenceId: order.id,
      date: now,
    });
    if (!res.ok) return { ok: false, error: res.error };
  }
  return { ok: true };
}

export async function cancelPurchaseOrder(orderId: string): Promise<void> {
  await db.purchase_bills.update(orderId, { status: 'discarded', sync_status: 'pending' });
}

/** The order as a message for the supplier (WhatsApp / copy) — English, like the bill. */
export function purchaseOrderText(order: Pick<PurchaseBill, 'bill_number' | 'bill_date' | 'line_items' | 'total_amount' | 'notes'>, shopName?: string): string {
  const rows = (order.line_items || []).map((l, i) => `${i + 1}. ${l.raw_name} — ${l.quantity}${l.unit ? ` ${l.unit}` : ''}${l.unit_price > 0 ? ` @ ${formatINR(l.unit_price)}` : ''}`);
  return [
    `Purchase Order ${order.bill_number || ''}`.trim(),
    shopName ? `From: ${shopName}` : '',
    order.bill_date ? `Date: ${order.bill_date.split('-').reverse().join('-')}` : '',
    '',
    ...rows,
    '',
    order.total_amount > 0 ? `Approx. value: ${formatINR(order.total_amount)}` : '',
    order.notes ? `Note: ${order.notes}` : '',
  ].filter((line, i, all) => line !== '' || (i > 0 && all[i - 1] !== '')).join('\n').trim();
}
