/*
 * Barcode gun on the POS (v4.72.0). A USB gun types the code into whatever has focus
 * and ends with Enter. On the counter that is usually the product search box, so the
 * box itself decides what an Enter means — no key-timing guesswork there (timing cut
 * codes short when the screen was busy: "unknown barcode 0000015").
 */

export type SearchEnterAction = 'complete-sale' | 'add-exact' | 'unknown-code' | 'add-highlighted' | 'none';

/** A code, not words: 6+ digits, or 6+ capitals / digits / dashes with at least 4 digits (e.g. SKU-00123). */
export function looksLikeBarcode(text: string): boolean {
  const t = text.trim();
  if (/^\d{6,}$/.test(t)) return true;
  return /^[A-Z0-9-]{6,}$/.test(t) && (t.match(/\d/g) || []).length >= 4;
}

/**
 * Enter in the product search box:
 *   empty box            → finish the bill (if it has items)
 *   a saved barcode      → add that item
 *   a code nobody has    → offer to add it as a new item (never "the first search result")
 *   typed words          → add the highlighted / first search result
 */
export function searchEnterAction(text: string, cartLength: number, exactMatch: boolean, resultCount: number): SearchEnterAction {
  const t = text.trim();
  if (!t) return cartLength > 0 ? 'complete-sale' : 'none';
  if (exactMatch) return 'add-exact';
  if (looksLikeBarcode(t)) return 'unknown-code';
  return resultCount > 0 ? 'add-highlighted' : 'none';
}
