import { db } from '@/lib/db';
import { InventoryMovement, Product, ProductUnit, PurchaseBill, PurchaseBillLineItem } from '@/types';
import { generalCategoryId } from '@/lib/products/defaultCategory';
import { barcodesInUse, nextStoreBarcodes } from '@/lib/barcode/storeBarcodes';
import { inwardMovement, labelCopiesFor, lowStockAlertFor, stockAfterInward } from '@/lib/inward/stockEntry';
import { LabelHandoffItem } from '@/lib/labels/labelSettings';
import { normalizeName } from './matchProductByName';

export interface BillInwardInput {
  businessId: string;
  /** Settings → "Default GST Calculation" (new items follow it). */
  taxInclusive: boolean;
  supplierName: string;
  billNumber: string;
  billDate: string;
  items: PurchaseBillLineItem[];
  rawResponse: string;
  modelUsed: string;
}

export interface BillInwardResult {
  billId: string;
  restocked: number;
  created: number;
  /** Items that were "Unlimited stock" and are counted from now on. */
  startedCounting: number;
  /** One label per piece received — for "Print labels" (Barcode Studio). */
  labels: LabelHandoffItem[];
}

/**
 * Saves a supplier's bill in ONE transaction (v4.77.0 — before, each line was written
 * on its own, so an error half-way left half the stock added): saved items get the
 * quantity (fresh row re-read; an uncounted item starts counting), cost and a new
 * selling price if typed; new items get counted stock, the shop's GST mode, the
 * "General" category and their own barcode (the bill's EAN if nobody has it, else a
 * store code). One PURCHASE movement per line and the purchase bill record.
 */
export async function applyBillInward(input: BillInwardInput): Promise<BillInwardResult> {
  return db.transaction('rw', [db.products, db.categories, db.inventory_movements, db.purchase_bills], async () => {
    const now = new Date().toISOString();
    const stamp = Date.now();
    const billId = `bill_scan_${stamp}`;
    const reasonFor = (isNew: boolean) => `Bill Inward${isNew ? ' (New Product)' : ''}: ${input.supplierName || 'Wholesaler'}`;
    const lines = input.items.filter((i) => i.raw_name.trim());

    const categories = await db.categories.toArray();
    const generalId = generalCategoryId(categories);
    const generalName = categories.find((c) => c.id === generalId)?.name || 'General';

    const fresh = await db.products.bulkGet(lines.map((l) => (!l.is_new_product && l.matched_product_id) || '__none__'));
    const used = new Set(await barcodesInUse());
    // New items: the bill's barcode if nobody has it, else a store code.
    const billCode = lines.map((l, i) => {
      const code = (l.barcode || '').trim();
      if (fresh[i] || !code || used.has(code)) return '';
      used.add(code);
      return code;
    });
    const needCodes = lines.filter((_, i) => !fresh[i] && !billCode[i]).length;
    const codes = needCodes ? nextStoreBarcodes(used, needCodes) : [];
    let codeIndex = 0;

    // Running copy of every item written: the same item on two lines (saved, or new with
    // the same name) adds both quantities instead of the second line overwriting the first.
    const working = new Map<string, Product>();
    const newIdByName = new Map<string, string>();
    const moves: InventoryMovement[] = [];
    const copies = new Map<string, number>();
    const addLabels = (p: Product, qty: number) => copies.set(p.id, Math.min(999, (copies.get(p.id) || 0) + labelCopiesFor(p.unit, qty)));
    let restocked = 0;
    let created = 0;
    let startedCounting = 0;

    lines.forEach((line, i) => {
      const qty = Number(line.quantity);
      const repeatOfNew = fresh[i] ? undefined : newIdByName.get(normalizeName(line.raw_name));
      const saved = fresh[i] ? working.get(fresh[i]!.id) || fresh[i] : repeatOfNew ? working.get(repeatOfNew) : undefined;
      if (saved) {
        const stock = stockAfterInward(saved, qty);
        if (stock.startsCounting) startedCounting++;
        const selling = line.selling_price || saved.selling_price;
        const next: Product = {
          ...saved,
          current_stock: stock.next,
          is_unlimited_stock: false,
          purchase_price: line.unit_price > 0 ? line.unit_price : saved.purchase_price,
          selling_price: selling,
          mrp: Math.max(line.mrp || saved.mrp || 0, selling),
          updated_at: now,
        };
        working.set(next.id, next);
        moves.push(inwardMovement({ id: `mov_pur_${stamp}_${i}`, businessId: input.businessId, product: next, qty, stock, reason: reasonFor(false), referenceId: billId, now }));
        addLabels(next, qty);
        if (!repeatOfNew) restocked++;
        return;
      }

      const selling = line.selling_price || line.mrp || 0;
      const product: Product = {
        id: `prod_pur_${stamp}_${i}`,
        business_id: input.businessId,
        name: line.raw_name.trim(),
        barcode: billCode[i] || codes[codeIndex++],
        category_id: generalId,
        category_name: generalName,
        unit: (line.unit as ProductUnit) || 'piece',
        selling_price: selling,
        purchase_price: line.unit_price,
        mrp: Math.max(line.mrp || 0, selling),
        tax_rate: line.tax_rate ?? 0,
        is_tax_inclusive: input.taxInclusive,
        hsn_code: line.hsn_code || undefined,
        is_unlimited_stock: false,
        current_stock: qty,
        min_stock_level: lowStockAlertFor(qty),
        is_favorite: false,
        is_active: true,
        created_at: now,
        updated_at: now,
        sync_status: 'pending',
      };
      working.set(product.id, product);
      if (normalizeName(product.name)) newIdByName.set(normalizeName(product.name), product.id);
      moves.push(inwardMovement({ id: `mov_pur_${stamp}_${i}`, businessId: input.businessId, product, qty, stock: { previous: 0, next: qty, startsCounting: false }, reason: reasonFor(true), referenceId: billId, now }));
      addLabels(product, qty);
      created++;
    });

    const products = Array.from(working.values());
    if (products.length) await db.products.bulkPut(products);
    if (moves.length) await db.inventory_movements.bulkPut(moves);

    const bill: PurchaseBill = {
      id: billId,
      business_id: input.businessId,
      supplier_name_raw: input.supplierName.trim(),
      bill_number: input.billNumber.trim(),
      bill_date: input.billDate,
      raw_ai_response: input.rawResponse,
      line_items: lines,
      total_amount: lines.reduce((sum, l) => sum + (l.total_price || 0), 0),
      status: 'confirmed',
      ai_model_used: input.modelUsed || 'csv-direct-parser',
      created_at: now,
      confirmed_at: now,
      sync_status: 'pending',
    };
    await db.purchase_bills.put(bill);

    const labels: LabelHandoffItem[] = Array.from(copies.entries()).filter(([, n]) => n > 0).map(([id, n]) => ({ id, copies: n }));
    return { billId, restocked, created, startedCounting, labels };
  });
}
