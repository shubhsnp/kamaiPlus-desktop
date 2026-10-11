import type { Category, Product } from '@/types';
import { generalCategoryId } from '@/lib/products/defaultCategory';
import { msg } from '@/lib/i18n/core';

/**
 * Custom Item on the counter (v4.159.0, PC = phone "Custom Item"): a one-off line such as a carry
 * bag or a delivery charge that is not in the item list. Unless the cashier saves it, it never
 * becomes a product — its id carries this prefix, and Complete Sale / Convert to Bill skip stock
 * for it (they would otherwise find a saved item with the same name and take stock off that one).
 */
export const CUSTOM_ITEM_ID_PREFIX = 'prod_misc_';

export const isUnsavedCustomItem = (productId: string | undefined): boolean =>
  Boolean(productId && productId.startsWith(CUSTOM_ITEM_ID_PREFIX));

/** Quick picks — same list as the phone's Custom Item sheet (one-off charges every shop has). */
export const CUSTOM_ITEM_PRESETS: { name: string; pricePaise: number }[] = [
  { name: msg('Carry Bag'), pricePaise: 500 },
  { name: msg('Packaging Box'), pricePaise: 1500 },
  { name: msg('Delivery Charge'), pricePaise: 5000 },
  { name: msg('Loose Item'), pricePaise: 2000 },
];

export const CUSTOM_ITEM_NAME_MAX = 60;

/** Rupees typed in the box → paise; 0 when it is not a positive amount (max 2 decimals). */
export function customItemPricePaise(raw: string): number {
  const t = raw.trim();
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(t)) return 0;
  return Math.round(parseFloat(t) * 100);
}

export function buildCustomItem(opts: {
  name: string;
  pricePaise: number;
  businessId: string;
  categories: Category[];
  save: boolean;
  now?: Date;
}): Product {
  const now = (opts.now ?? new Date()).toISOString();
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  return {
    id: opts.save ? `prod_item_${stamp}` : `${CUSTOM_ITEM_ID_PREFIX}${stamp}`,
    business_id: opts.businessId,
    name: opts.name.trim().slice(0, CUSTOM_ITEM_NAME_MAX),
    category_id: generalCategoryId(opts.categories),
    category_name: 'General',
    unit: 'piece',
    purchase_price: 0, // unknown — never guessed
    selling_price: opts.pricePaise,
    mrp: opts.pricePaise,
    tax_rate: 0,
    is_tax_inclusive: true,
    current_stock: 0,
    min_stock_level: 0,
    is_unlimited_stock: true, // a charge or a one-off line has no stock to count
    is_favorite: false,
    is_active: true,
    created_at: now,
    updated_at: now,
    sync_status: 'synced',
  };
}
