import { db } from '@/lib/db';
import { InventoryMovement, Product } from '@/types';
import { tr } from '@/lib/i18n/core';

/**
 * Product variants — the Android app's model (lib/core/database/local_database.dart
 * createProductWithVariants), money in integer paise.
 *
 *   parent  "Cotton Shirt"        has_variants = true   — shown in lists, never sold itself
 *   child   "Cotton Shirt (M)"    parent_id = parent.id, variant_label = "M"
 *   child   "Cotton Shirt (XL)"   … each child has its own price, MRP, stock and barcode
 *
 * Children are ordinary products, so billing, stock, returns, reports and barcode
 * scanning work on them unchanged. Lists hide children unless the user is searching;
 * the POS opens a picker when a parent is tapped.
 */

import type { VerticalId } from '@/lib/business/verticalProfile';
import { UNLIMITED_REPAIR_AT } from '@/lib/products/unlimitedStock';

/** Quick presets matching the Android "Variants Matrix" across all verticals. */
export const VARIANT_PRESETS = [
  'S', 'M', 'L', 'XL', 'XXL', '3XL',
  '28', '30', '32', '34', '36', '38', '40', '42',
  'Red', 'Blue', 'Black', 'White', 'Green', 'Yellow', 'Grey', 'Navy',
];

/** Business vertical-specific quick variant presets */
export function getVariantPresets(vertical?: VerticalId | null): string[] {
  switch (vertical) {
    case 'restaurant':
      return ['Half', 'Full', 'Regular', 'Medium', 'Large', 'Single', 'Double', 'Jain', 'Spicy', 'Combo'];
    case 'grocery':
      return ['100g', '250g', '500g', '1kg', '2kg', '5kg', '10kg', '500ml', '1 Litre', 'Pack of 2', 'Pack of 4', 'Combo'];
    case 'pharmacy':
      return ['Strip (10 Tab)', 'Strip (15 Tab)', 'Bottle (60ml)', 'Bottle (100ml)', '100mg', '250mg', '500mg', '650mg', 'Sachet', 'Box of 10'];
    case 'hardware':
      return ['1/2 Inch', '3/4 Inch', '1 Inch', '1.5 Inch', '2 Inch', '50mm', '100mm', '500ml', '1 Ltr', '4 Ltr', '10 Ltr', '20 Ltr'];
    case 'retail':
      return ['Small', 'Medium', 'Large', 'Pack of 1', 'Pack of 2', 'Pack of 5', '100g', '250g', '500g', '1kg'];
    case 'clothing':
    default:
      return VARIANT_PRESETS;
  }
}

export function getVariantInfo(vertical?: VerticalId | null): { title: string; subtitle: string; placeholder: string } {
  switch (vertical) {
    case 'restaurant':
      return {
        title: tr('Variants (Half / Full)'),
        subtitle: tr('One dish in Half / Full or other portions, each with its own price.'),
        placeholder: tr('Custom variant (e.g. Half, Spicy, Jain, Large)'),
      };
    case 'grocery':
      return {
        title: tr('Variants (Weight / Pack)'),
        subtitle: tr('Sell one item in different weights or packs (e.g. 500g, 1kg), each with its own price.'),
        placeholder: tr('Custom variant (e.g. 250g, 2kg, Combo)'),
      };
    case 'pharmacy':
      return {
        title: tr('Variants (Dosage / Pack)'),
        subtitle: tr('Sell medicine in different dosages or strips (e.g. 500mg, Strip of 10), each with its own price.'),
        placeholder: tr('Custom variant (e.g. Strip 15, 650mg, 100ml)'),
      };
    case 'hardware':
      return {
        title: tr('Variants (Size / Dimension)'),
        subtitle: tr('Sell one item in different sizes or volumes (e.g. 1/2 Inch, 1 Litre), each with its own price.'),
        placeholder: tr('Custom variant (e.g. 1.5 Inch, 10 Litre)'),
      };
    case 'retail':
      return {
        title: tr('Variants (Size / Pack)'),
        subtitle: tr('Sell one item in different sizes or packs, each with its own price.'),
        placeholder: tr('Custom variant (e.g. Medium, 500g, Pack of 2)'),
      };
    case 'clothing':
    default:
      return {
        title: tr('Variants (Size / Colour)'),
        subtitle: tr('Sell one item in many sizes or colours, each with its own price and stock.'),
        placeholder: tr('Custom variant (e.g. 36, Red-XL, 500 g)'),
      };
  }
}


export interface VariantDraft {
  label: string;
  sellingPricePaise: number;
  mrpPaise: number;
  stock: number;
  barcode?: string;
}

export const isVariantParent = (p: Pick<Product, 'has_variants'>): boolean => p.has_variants === true;
export const isVariantChild = (p: Pick<Product, 'parent_id'>): boolean => Boolean(p.parent_id);

/**
 * Whether a product's own stock means anything. A variant parent's stock lives in
 * its children, so stock alerts, "out of stock" badges and valuation skip it.
 */
export const tracksOwnStock = (p: Pick<Product, 'has_variants' | 'is_unlimited_stock'> & { current_stock?: number }): boolean =>
  !p.is_unlimited_stock && !isVariantParent(p) && !(Number(p.current_stock ?? 0) >= UNLIMITED_REPAIR_AT);

/**
 * New products are "Unlimited stock" (not counted) by default, like the Android app.
 * Switching that off in the product form fills stock and the low-stock alert with this.
 */
export const DEFAULT_COUNTED_STOCK = 10;

export function variantChildName(parentName: string, label: string): string {
  return `${parentName.trim()} (${label.trim()})`;
}

/** Trims, drops blanks and duplicates (case-insensitive), keeps the order typed. */
export function cleanVariantLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of labels) {
    const label = raw.trim();
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

export async function getVariantChildren(parentId: string): Promise<Product[]> {
  const children = await db.products.filter((p) => p.parent_id === parentId).toArray();
  return children.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

/** Cheapest price, count and total stock across a parent's children. */
export function summarizeVariants(children: Product[]): { count: number; minPricePaise: number; totalStock: number } {
  return {
    count: children.length,
    minPricePaise: children.length ? Math.min(...children.map((c) => c.selling_price)) : 0,
    totalStock: children.reduce((acc, c) => acc + (c.is_unlimited_stock ? 0 : Math.max(0, Number(c.current_stock) || 0)), 0),
  };
}

function buildChild(parent: Product, draft: VariantDraft, id: string, now: string): Product {
  return {
    ...parent,
    id,
    name: variantChildName(parent.name, draft.label),
    barcode: draft.barcode?.trim() || undefined,
    selling_price: Math.round(draft.sellingPricePaise),
    mrp: Math.round(draft.mrpPaise > 0 ? draft.mrpPaise : draft.sellingPricePaise),
    current_stock: Math.max(0, draft.stock),
    size: draft.label.trim(),
    parent_id: parent.id,
    has_variants: false,
    variant_label: draft.label.trim(),
    is_favorite: false,
    created_at: now,
    updated_at: now,
    sync_status: 'pending',
  };
}

function openingMovement(p: Product, now: string, id: string): InventoryMovement {
  return {
    id,
    business_id: p.business_id,
    product_id: p.id,
    product_name: p.name,
    movement_type: 'ADJUSTMENT',
    quantity: p.current_stock,
    previous_stock: 0,
    new_stock: p.current_stock,
    reason: 'Initial variant stock creation',
    created_by: 'owner',
    created_at: now,
  };
}

/** Saves the parent and all its children atomically. Returns the children. */
export async function createProductWithVariants(parent: Product, drafts: VariantDraft[]): Promise<Product[]> {
  const now = new Date().toISOString();
  const labels = cleanVariantLabels(drafts.map((d) => d.label));
  // First entry wins for a repeated label, matching cleanVariantLabels.
  const byLabel = new Map<string, VariantDraft>();
  for (const d of drafts) {
    const key = d.label.trim().toLowerCase();
    if (key && !byLabel.has(key)) byLabel.set(key, d);
  }
  const savedParent: Product = { ...parent, has_variants: true, parent_id: undefined, variant_label: undefined, current_stock: 0, barcode: parent.barcode || undefined };
  const stamp = Date.now();
  const children = labels.map((label, i) => buildChild(savedParent, { ...byLabel.get(label.toLowerCase())!, label }, `prod_${stamp}_v${i}`, now));

  await db.transaction('rw', db.products, db.inventory_movements, async () => {
    await db.products.put(savedParent);
    await db.products.bulkPut(children);
    const moves = children.filter((c) => c.current_stock > 0).map((c, i) => openingMovement(c, now, `mov_${stamp}_v${i}`));
    if (moves.length) await db.inventory_movements.bulkPut(moves);
  });
  return children;
}

/** Adds one more variant to an existing parent (e.g. a new size arrives). */
export async function addVariantToParent(parent: Product, draft: VariantDraft): Promise<{ ok: boolean; error?: string; child?: Product }> {
  const label = draft.label.trim();
  if (!label) return { ok: false, error: tr('Enter a variant name, e.g. XL or Red.') };
  if (draft.sellingPricePaise <= 0) return { ok: false, error: tr('Enter a selling price.') };
  const existing = await getVariantChildren(parent.id);
  if (existing.some((c) => (c.variant_label || '').toLowerCase() === label.toLowerCase())) {
    return { ok: false, error: tr('"{label}" already exists for this product.', { label: label }) };
  }
  const now = new Date().toISOString();
  const child = buildChild({ ...parent, has_variants: true }, { ...draft, label }, `prod_${Date.now()}_v`, now);
  await db.transaction('rw', db.products, db.inventory_movements, async () => {
    if (!parent.has_variants) await db.products.update(parent.id, { has_variants: true, updated_at: now });
    await db.products.put(child);
    if (child.current_stock > 0) await db.inventory_movements.put(openingMovement(child, now, `mov_${Date.now()}_v`));
  });
  return { ok: true, child };
}

/** Deleting a parent removes its children too (they cannot be sold without it). */
export async function deleteProductAndVariants(product: Product): Promise<number> {
  let removed = 1;
  await db.transaction('rw', db.products, async () => {
    if (isVariantParent(product)) {
      const children = await db.products.filter((p) => p.parent_id === product.id).primaryKeys();
      removed += children.length;
      await db.products.bulkDelete(children);
    }
    await db.products.delete(product.id);
  });
  return removed;
}
