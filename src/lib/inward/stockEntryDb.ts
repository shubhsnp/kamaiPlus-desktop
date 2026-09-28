import { db } from '@/lib/db';
import { InventoryMovement, Product } from '@/types';
import { barcodesInUse, nextStoreBarcodes } from '@/lib/barcode/storeBarcodes';
import { productLabelExtras } from '@/lib/labels/labelExtras';
import { inwardMovement, labelCopiesFor, lowStockAlertFor, StockEntryPlan, stockAfterInward } from './stockEntry';

export interface StockEntryContext {
  businessId: string;
  /** Settings → "Default GST Calculation" (new items follow it, like items added by hand). */
  taxInclusive: boolean;
  /** Category for the new items. */
  category: { id: string; name: string };
}

/** One item's labels after saving — the print list takes these as they are. */
export interface ReceivedLabel {
  id: string;
  name: string;
  barcode: string;
  pricePaise: number;
  mrpPaise: number;
  costPaise?: number;
  detail?: string;
  copies: number;
  /** Counted stock after receiving. */
  stock: number;
}

export interface StockEntryResult {
  created: number;
  restocked: number;
  /** Items that were "Unlimited stock" and are counted from now on. */
  startedCounting: number;
  labels: ReceivedLabel[];
}

/**
 * Saves "New stock + labels" in one transaction: new items (counted stock, their own
 * barcode — the scanned one if nobody has it, else a store code), restocked items
 * (fresh row re-read, price / cost if typed, a barcode if they had none) and one
 * PURCHASE movement per row. Returns the labels in the order typed.
 */
export async function applyStockEntry(plan: StockEntryPlan, ctx: StockEntryContext): Promise<StockEntryResult> {
  return db.transaction('rw', db.products, db.inventory_movements, async () => {
    const now = new Date().toISOString();
    const stamp = Date.now();
    const batchId = `inward_lbl_${stamp}`;
    const used = new Set(await barcodesInUse());

    // Fresh rows for restocks (stock may have moved since the rows were typed).
    const restockIds = plan.lines.filter((l) => l.kind === 'restock').map((l) => (l.kind === 'restock' ? l.product.id : ''));
    const freshById = new Map((await db.products.bulkGet(restockIds)).filter((p): p is Product => Boolean(p)).map((p) => [p.id, p]));

    // Barcodes: a scanned code nobody has is kept; everything else gets a store code.
    const wanted = plan.lines.map((l) => {
      if (l.kind !== 'new' || !l.barcode || used.has(l.barcode)) return '';
      used.add(l.barcode);
      return l.barcode;
    });
    const needCodes = plan.lines.filter((l, i) => (l.kind === 'new' ? !wanted[i] : !freshById.get(l.product.id)?.barcode?.trim())).length;
    const codes = needCodes ? nextStoreBarcodes(used, needCodes) : [];
    let codeIndex = 0;

    const products: Product[] = [];
    const moves: InventoryMovement[] = [];
    const labels: ReceivedLabel[] = [];
    let startedCounting = 0;

    plan.lines.forEach((line, i) => {
      if (line.kind === 'new') {
        const product: Product = {
          id: `prod_lbl_${stamp}_${i}`,
          business_id: ctx.businessId,
          name: line.name,
          barcode: wanted[i] || codes[codeIndex++],
          category_id: ctx.category.id,
          category_name: ctx.category.name,
          unit: line.unit,
          selling_price: line.pricePaise,
          mrp: line.mrpPaise,
          purchase_price: line.costPaise ?? 0,
          tax_rate: line.gstRate ?? 0,
          is_tax_inclusive: ctx.taxInclusive,
          hsn_code: line.hsn || undefined,
          is_unlimited_stock: false,
          current_stock: line.qty,
          min_stock_level: lowStockAlertFor(line.qty),
          is_favorite: false,
          is_active: true,
          created_at: now,
          updated_at: now,
          sync_status: 'pending',
        };
        products.push(product);
        moves.push(inwardMovement({
          id: `mov_lbl_${stamp}_${i}`, businessId: ctx.businessId, product, qty: line.qty,
          stock: { previous: 0, next: line.qty, startsCounting: false },
          reason: 'New item received (Barcode Studio)', referenceId: batchId, now,
        }));
        labels.push({ id: product.id, name: product.name, barcode: product.barcode!, pricePaise: product.selling_price, mrpPaise: product.mrp, ...productLabelExtras(product), copies: labelCopiesFor(product.unit, line.qty), stock: line.qty });
        return;
      }

      const fresh = freshById.get(line.product.id);
      if (!fresh) return; // deleted while the rows were being typed
      const stock = stockAfterInward(fresh, line.qty);
      if (stock.startsCounting) startedCounting++;
      const next: Product = {
        ...fresh,
        barcode: fresh.barcode?.trim() || codes[codeIndex++],
        current_stock: stock.next,
        is_unlimited_stock: false,
        selling_price: line.pricePaise ?? fresh.selling_price,
        mrp: line.mrpPaise ?? fresh.mrp,
        purchase_price: line.costPaise ?? fresh.purchase_price,
        min_stock_level: stock.startsCounting && !(fresh.min_stock_level > 0) ? lowStockAlertFor(line.qty) : fresh.min_stock_level,
        is_active: true,
        updated_at: now,
      };
      products.push(next);
      moves.push(inwardMovement({
        id: `mov_lbl_${stamp}_${i}`, businessId: ctx.businessId, product: next, qty: line.qty, stock,
        reason: 'Stock received (Barcode Studio)', referenceId: batchId, now,
      }));
      labels.push({ id: next.id, name: next.name, barcode: next.barcode!, pricePaise: next.selling_price, mrpPaise: next.mrp, ...productLabelExtras(next), copies: labelCopiesFor(next.unit, line.qty), stock: stock.next });
    });

    if (products.length) await db.products.bulkPut(products);
    if (moves.length) await db.inventory_movements.bulkPut(moves);

    return {
      created: plan.lines.filter((l) => l.kind === 'new').length,
      restocked: labels.length - plan.lines.filter((l) => l.kind === 'new').length,
      startedCounting,
      labels,
    };
  });
}
