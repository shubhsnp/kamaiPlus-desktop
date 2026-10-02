import { db } from '@/lib/db';
import { Category, InventoryMovement, Product } from '@/types';
import { generalCategoryId } from '@/lib/products/defaultCategory';
import { DEFAULT_COUNTED_STOCK } from '@/lib/products/variants';
import { barcodesInUse, nextStoreBarcodes } from '@/lib/barcode/storeBarcodes';
import { ImportPlan, normName } from './catalogImport';

export interface ImportContext {
  businessId: string;
  /** Settings → "Default GST Calculation" (new items follow it, like items added by hand). */
  taxInclusive: boolean;
  /** Columns present in the sheet — an unmapped column never overwrites a saved value. */
  mapped: { mrp: boolean; cost: boolean; unit: boolean; stock: boolean; category: boolean; gst: boolean; hsn: boolean; wholesale?: boolean };
  /** Give every new item without a barcode its own store code. */
  giveBarcodes: boolean;
}

export interface ImportResult {
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  categoriesCreated: number;
  barcodesGiven: number;
  createdIds: string[];
  /** Saved items whose price or details changed (their labels may need reprinting). */
  updatedIds: string[];
}

/** Writes an import plan in one transaction: new categories, new items (with barcodes), changed prices. */
export async function applyImportPlan(plan: ImportPlan, ctx: ImportContext): Promise<ImportResult> {
  return db.transaction('rw', db.products, db.categories, db.inventory_movements, async () => {
    const now = new Date().toISOString();
    const stamp = Date.now();

    // 1. Categories: reuse by name, create the missing ones.
    const categories = await db.categories.toArray();
    const byName = new Map(categories.map((c) => [normName(c.name), c]));
    const newCategories: Category[] = [];
    const categoryFor = (name: string): { id: string; name: string } => {
      if (!name) {
        const id = generalCategoryId(categories);
        return { id, name: categories.find((c) => c.id === id)?.name || 'General' };
      }
      let cat = byName.get(normName(name));
      if (!cat) {
        cat = { id: `cat_imp_${stamp}_${newCategories.length}`, business_id: ctx.businessId, name, created_at: now };
        byName.set(normName(name), cat);
        newCategories.push(cat);
      }
      return { id: cat.id, name: cat.name };
    };

    // 2. Barcodes: a sheet barcode already used elsewhere (or twice) is not reused.
    const used = new Set(await barcodesInUse());
    const wantCode = plan.creates.map((r) => {
      if (r.barcode && !used.has(r.barcode)) {
        used.add(r.barcode);
        return r.barcode;
      }
      return '';
    });
    const missing = wantCode.filter((c) => !c).length;
    const reserved = Array.from(used).concat(plan.updates.map((u) => u.row.barcode).filter(Boolean));
    const fresh = ctx.giveBarcodes && missing ? nextStoreBarcodes(reserved, missing) : [];
    fresh.forEach((c) => used.add(c));
    let freshIndex = 0;

    const creates: Product[] = plan.creates.map((r, i) => {
      const cat = categoryFor(ctx.mapped.category ? r.category : '');
      const counted = ctx.mapped.stock && r.stock !== null;
      // No price in the sheet → ₹0 for now (the counter asks for it; the label prints without one).
      const price = r.pricePaise ?? 0;
      return {
        id: `prod_imp_${stamp}_${i}`,
        business_id: ctx.businessId,
        name: r.name,
        barcode: wantCode[i] || (ctx.giveBarcodes ? fresh[freshIndex++] : undefined),
        category_id: cat.id,
        category_name: cat.name,
        unit: r.unit || 'piece',
        selling_price: price,
        mrp: ctx.mapped.mrp && r.mrpPaise ? r.mrpPaise : price,
        purchase_price: r.costPaise ?? 0,
        wholesale_price: ctx.mapped.wholesale && r.wholesalePaise ? r.wholesalePaise : undefined,
        tax_rate: r.gstRate ?? 0,
        is_tax_inclusive: ctx.taxInclusive,
        // No HSN in the sheet = no HSN (a made-up code would reach the GST / HSN report).
        hsn_code: r.hsn || undefined,
        // No stock column = not counted, so scanning is never blocked by "out of stock".
        is_unlimited_stock: !counted,
        current_stock: counted ? r.stock! : 0,
        min_stock_level: DEFAULT_COUNTED_STOCK,
        is_favorite: false,
        is_active: true,
        created_at: now,
        updated_at: now,
        sync_status: 'synced',
      };
    });

    const updates: Product[] = plan.updates.map(({ row, product }) => {
      const price = row.pricePaise;
      const next: Product = {
        ...product,
        // A blank price cell never wipes the saved price.
        selling_price: price ?? product.selling_price,
        mrp: price === null ? product.mrp : ctx.mapped.mrp && row.mrpPaise ? row.mrpPaise : price,
        is_active: true,
        updated_at: now,
      };
      if (ctx.mapped.category && row.category) {
        const cat = categoryFor(row.category);
        next.category_id = cat.id;
        next.category_name = cat.name;
      }
      if (ctx.mapped.unit && row.unit) next.unit = row.unit;
      if (ctx.mapped.cost && row.costPaise !== null) next.purchase_price = row.costPaise;
      if (ctx.mapped.wholesale && row.wholesalePaise !== null) next.wholesale_price = row.wholesalePaise;
      if (ctx.mapped.gst && row.gstRate !== null) next.tax_rate = row.gstRate;
      if (ctx.mapped.hsn && row.hsn) next.hsn_code = row.hsn;
      if (row.barcode && !product.barcode?.trim() && !used.has(row.barcode)) {
        next.barcode = row.barcode;
        used.add(row.barcode);
      }
      return next;
    });

    if (newCategories.length) await db.categories.bulkPut(newCategories);
    if (creates.length) await db.products.bulkPut(creates);
    if (updates.length) await db.products.bulkPut(updates);

    const moves: InventoryMovement[] = creates
      .filter((p) => !p.is_unlimited_stock && p.current_stock > 0)
      .map((p, i) => ({
        id: `mov_imp_${stamp}_${i}`,
        business_id: ctx.businessId,
        product_id: p.id,
        product_name: p.name,
        movement_type: 'ADJUSTMENT',
        quantity: p.current_stock,
        previous_stock: 0,
        new_stock: p.current_stock,
        reason: 'Opening stock (Excel import)',
        created_by: 'owner',
        created_at: now,
      }));
    if (moves.length) await db.inventory_movements.bulkPut(moves);

    return {
      created: creates.length,
      updated: updates.length,
      unchanged: plan.unchanged.length,
      skipped: plan.skipped.length,
      categoriesCreated: newCategories.length,
      barcodesGiven: freshIndex,
      createdIds: creates.map((p) => p.id),
      updatedIds: updates.map((p) => p.id),
    };
  });
}
