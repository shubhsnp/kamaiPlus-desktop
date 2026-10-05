import { db } from '@/lib/db';
import { newId } from '@/lib/ids';
import { normName } from '@/lib/import/catalogImport';
import { isVariantChild, isVariantParent } from '@/lib/products/variants';
import type { CartItem, Product } from '@/types';

/*
 * Duplicate items (v4.103.0, tracker K-D28). The same item typed separately on the phone and on
 * this PC (two ids) shows twice once the cloud brings both; an Excel list imported twice does the
 * same. The app cannot know which copy is right, so Products shows the groups and the shop merges
 * them: one item is kept, the others' bills, returns and stock history point to it, and the shop
 * says how much stock there really is.
 */

type Dup = Pick<Product, 'id' | 'name' | 'unit' | 'barcode' | 'has_variants' | 'parent_id' | 'is_active' | 'created_at'>;

const barcodeOf = (p: Dup) => (p.barcode || '').trim().toUpperCase();

/** A group key that stays the same when the group is found again (used to remember "not duplicates"). */
export function duplicateGroupKey(ids: string[]): string {
  return [...ids].sort().join('|');
}

/**
 * Groups of two or more items that look like the same item: the same barcode, or the same name and
 * unit where the barcodes do not disagree (one or both without a barcode). Variant parents / sizes and
 * switched-off items are left out. Oldest first inside a group.
 */
export function findDuplicateGroups<T extends Dup>(products: T[]): T[][] {
  const live = products.filter((p) => p.is_active !== false && !isVariantParent(p) && !isVariantChild(p) && p.name?.trim());
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let r = id;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(id, r);
    return r;
  };
  const join = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(rb, ra); };
  for (const p of live) parent.set(p.id, p.id);

  const byBarcode = new Map<string, T>();
  const byName = new Map<string, T[]>();
  for (const p of live) {
    const bc = barcodeOf(p);
    if (bc) {
      const first = byBarcode.get(bc);
      if (first) join(first.id, p.id);
      else byBarcode.set(bc, p);
    }
    const key = `${normName(p.name)}|${p.unit || ''}`;
    byName.set(key, [...(byName.get(key) || []), p]);
  }
  for (const same of Array.from(byName.values())) {
    for (let i = 0; i < same.length; i++) {
      for (let j = i + 1; j < same.length; j++) {
        const a = barcodeOf(same[i]), b = barcodeOf(same[j]);
        if (!a || !b || a === b) join(same[i].id, same[j].id);
      }
    }
  }

  const groups = new Map<string, T[]>();
  for (const p of live) groups.set(find(p.id), [...(groups.get(find(p.id)) || []), p]);
  return Array.from(groups.values())
    .filter((g) => g.length > 1)
    .map((g) => g.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '')));
}

/** The kept item after the merge: its own data, plus a barcode / star the others had and it lacks. */
export function mergedProduct(keep: Product, drops: Product[], stock: number, now: string): Product {
  const barcode = keep.barcode?.trim() || drops.map((d) => d.barcode?.trim()).find(Boolean) || keep.barcode;
  return {
    ...keep,
    barcode,
    is_favorite: Boolean(keep.is_favorite || drops.some((d) => d.is_favorite)),
    current_stock: keep.is_unlimited_stock ? keep.current_stock : Math.max(0, Math.round(stock * 1000) / 1000),
    updated_at: now,
  };
}

/** A bill / return line that pointed at a merged-away item now points at the kept one. */
export function repointLines<L extends Pick<CartItem, 'product_id'>>(lines: L[] | undefined, dropIds: Set<string>, keepId: string): { lines: L[]; changed: boolean } {
  let changed = false;
  const out = (lines || []).map((l) => {
    if (!dropIds.has(l.product_id)) return l;
    changed = true;
    return { ...l, product_id: keepId };
  });
  return { lines: out, changed };
}

/**
 * Merges `dropIds` into `keepId` in one transaction: bills, returns, stock history and purchase
 * lines point to the kept item; its stock becomes `stock` (with a stock-history row); the others
 * are deleted. The cloud outbox sends every change (and the deletes) as usual.
 */
export async function mergeDuplicateProducts(keepId: string, dropIds: string[], stock: number): Promise<{ ok: boolean; error?: string }> {
  const drops = new Set(dropIds.filter((id) => id && id !== keepId));
  if (drops.size === 0) return { ok: false, error: 'nothing-to-merge' };
  const now = new Date().toISOString();
  await db.transaction('rw', [db.products, db.inventory_movements, db.sales, db.sales_returns, db.purchase_bills], async () => {
    const keep = await db.products.get(keepId);
    if (!keep) throw new Error('kept item not found');
    const others = (await db.products.bulkGet(Array.from(drops))).filter((p): p is Product => Boolean(p));
    const merged = mergedProduct(keep, others, stock, now);
    await db.products.put(merged);

    await db.inventory_movements.where('product_id').anyOf(Array.from(drops)).modify({ product_id: keepId });
    await db.sales.filter((s) => (s.items || []).some((i) => drops.has(i.product_id))).modify((s) => { s.items = repointLines(s.items, drops, keepId).lines; });
    await db.sales_returns.filter((r) => (r.items || []).some((i) => drops.has(i.product_id))).modify((r) => { r.items = repointLines(r.items, drops, keepId).lines; });
    await db.purchase_bills.filter((b) => (b.line_items || []).some((l) => Boolean(l.matched_product_id && drops.has(l.matched_product_id))))
      .modify((b) => { b.line_items = b.line_items.map((l) => (l.matched_product_id && drops.has(l.matched_product_id) ? { ...l, matched_product_id: keepId } : l)); });

    if (!keep.is_unlimited_stock && merged.current_stock !== keep.current_stock) {
      await db.inventory_movements.put({
        id: newId('mov_merge'),
        business_id: keep.business_id,
        product_id: keepId,
        product_name: keep.name,
        movement_type: 'ADJUSTMENT',
        quantity: Math.abs(merged.current_stock - (Number(keep.current_stock) || 0)),
        previous_stock: Number(keep.current_stock) || 0,
        new_stock: merged.current_stock,
        reason: `Duplicate items merged (${others.length + 1} → 1)`,
        created_by: 'owner',
        created_at: now,
      });
    }
    await db.products.bulkDelete(Array.from(drops));
  });
  return { ok: true };
}
