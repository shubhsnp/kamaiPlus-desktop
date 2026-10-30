import { looksLikeBarcode } from '@/lib/billing/scanInput';
import { SearchableProduct, searchProducts } from '@/lib/search/productSearch';

/*
 * The item box of Purchases → Manual Inward (FS-20, v4.182.0). It was a plain dropdown of every
 * item — no way to search 800 names, and a barcode gun did nothing. Pure, so the suite can run it.
 */

/** What the box lists: search results (English letters find Hindi names), or the first items when empty. */
export function restockMatches<T extends SearchableProduct>(products: T[], query: string, limit = 50): T[] {
  return searchProducts(products, query).slice(0, limit);
}

/**
 * Enter in the box, typed or from a gun: a saved barcode wins, a code nobody has picks nothing
 * (never the first result — stock would go to the wrong item), typed words pick the highlighted result.
 */
export function restockPickOnEnter<T extends SearchableProduct>(products: T[], query: string, highlighted: number): T | null {
  const text = query.trim();
  if (!text) return null;
  const exact = products.find((p) => p.barcode === text);
  if (exact) return exact;
  if (looksLikeBarcode(text)) return null;
  const matches = restockMatches(products, text);
  return matches[Math.min(Math.max(0, highlighted), matches.length - 1)] ?? null;
}
