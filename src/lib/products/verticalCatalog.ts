import type { ProductUnit } from '@/types';
import type { VerticalId } from '@/lib/business/verticalProfile';

/*
 * v4.175.0 — the shop's category (vertical) decides the units and categories a new item starts with.
 * Same table as KamaiPlus Android `lib/core/constants/business_vertical_config.dart`
 * (defaultUnit / recommendedUnits) and `lib/core/utils/vertical_catalog.dart`. Pure (tested in Suite 9).
 *
 * Why this keeps coming back (2026-10-16): neither app could delete a category, the Desktop seeded five
 * generic starters ("General, FMCG, Loose Items, Apparel, Accessories") into EVERY shop — again whenever
 * its products were empty — and the cloud carried them to the phone, where the Add Product form picked
 * the first one A→Z ("Accessories" in a restaurant). Now: the generic starters a vertical does not use
 * are removed while no item uses them, nothing re-seeds them, and the form starts on the category the
 * shop used last (else General) — never on whichever comes first in the list.
 */

export interface VerticalUnits {
  defaultUnit: ProductUnit;
  /** Shown first in the unit picker; every other unit stays under "More units". */
  units: ProductUnit[];
}

export const VERTICAL_UNITS: Record<VerticalId, VerticalUnits> = {
  grocery: { defaultUnit: 'kg', units: ['kg', 'gram', 'litre', 'packet', 'piece', 'box', 'dozen'] },
  pharmacy: { defaultUnit: 'strip', units: ['strip', 'piece', 'box', 'ml', 'litre', 'packet'] },
  clothing: { defaultUnit: 'piece', units: ['piece', 'pair', 'set', 'meter', 'box'] },
  hardware: { defaultUnit: 'piece', units: ['piece', 'meter', 'foot', 'sqft', 'kg', 'litre', 'box', 'bundle'] },
  restaurant: { defaultUnit: 'plate', units: ['plate', 'portion', 'piece', 'bottle', 'can', 'packet', 'box', 'litre', 'ml'] },
  retail: { defaultUnit: 'piece', units: ['piece', 'packet', 'box', 'set', 'dozen'] },
};

/** A shop set up before v4.118.0 has no vertical: it keeps the old behaviour (piece, every unit). */
export function unitsForVertical(vertical: VerticalId | null | undefined): VerticalUnits {
  return vertical ? VERTICAL_UNITS[vertical] : VERTICAL_UNITS.retail;
}

/** The generic starters older Desktop versions put into every shop (besides "General"). */
export const GENERIC_STARTER_CATEGORIES = ['FMCG', 'Loose Items', 'Apparel', 'Accessories'];

/** The generic starters that still fit a vertical — kept even when empty. */
const STARTERS_KEPT: Record<VerticalId, string[]> = {
  grocery: ['FMCG', 'Loose Items'],
  pharmacy: [],
  clothing: ['Apparel', 'Accessories'],
  hardware: ['Accessories'],
  restaurant: [],
  retail: GENERIC_STARTER_CATEGORIES,
};

const key = (s: string | undefined | null) => (s || '').trim().toLowerCase();

/**
 * The categories to remove: a generic starter this vertical does not use, that no item (active or
 * not) points to by id or by name. A category the shop typed itself is never touched. No vertical
 * (old shop) = nothing removed.
 */
export function foreignStarterCategoryIds(
  vertical: VerticalId | null | undefined,
  categories: { id: string; name: string }[],
  products: { category_id?: string; category_name?: string }[],
): string[] {
  if (!vertical) return [];
  const kept = new Set(STARTERS_KEPT[vertical].map(key));
  const starters = new Set(GENERIC_STARTER_CATEGORIES.map(key));
  const usedIds = new Set(products.map((p) => p.category_id || ''));
  const usedNames = new Set(products.map((p) => key(p.category_name)));
  return categories
    .filter((c) => starters.has(key(c.name)) && !kept.has(key(c.name)) && !usedIds.has(c.id) && !usedNames.has(key(c.name)))
    .map((c) => c.id);
}

/** The category a NEW item starts on: the one used last on this PC while it still exists, else '' (= General). */
export const LAST_PRODUCT_CATEGORY_KEY = 'kamai_last_product_category';

export function defaultCategoryForNewItem(categories: { id: string }[], lastUsedId: string | null | undefined): string {
  return lastUsedId && categories.some((c) => c.id === lastUsedId) ? lastUsedId : '';
}
