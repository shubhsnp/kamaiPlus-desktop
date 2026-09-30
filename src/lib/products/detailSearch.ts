import type { Product } from '@/types';

/**
 * Products page search (v4.81.0): the box says "name, barcode, HSN, size, color", but the shared
 * product search (`lib/search/productSearch.ts`, also used by Billing) looks only at the name and
 * barcode. This adds the rest for the Products page only: every typed word must appear somewhere
 * in the item's name, barcode, HSN, size, colour or variant label ("red xl", "1905", "shirt m").
 */
export function matchesProductDetails(
  p: Pick<Product, 'name' | 'barcode' | 'hsn_code' | 'size' | 'color' | 'variant_label'>,
  query: string,
): boolean {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  const details = [p.name, p.barcode, p.hsn_code, p.size, p.color, p.variant_label]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const tokens = details.split(/\s+/);
  // A one-letter word ("m", "l") must be a whole size / colour word, or every name containing
  // that letter would match.
  return words.every((w) => (w.length === 1 ? tokens.includes(w) : details.includes(w)));
}
