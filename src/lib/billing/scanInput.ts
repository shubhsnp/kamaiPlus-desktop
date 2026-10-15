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

export interface ScaleEan13Result {
  plu: string;
  grams: number;
  quantityKg: number;
  pluCandidates: string[];
}

/**
 * Standard retail price/weight-embedded EAN-13 barcodes starting with prefix 20 or 21:
 * 13 digits total:
 *   [0..2]: prefix (20 or 21)
 *   [2..7]: 5-digit PLU / item code
 *   [7..12]: 5-digit weight in grams (e.g. 00250 = 250g = 0.25 kg)
 *   [12]: checksum digit
 */
export function parseScaleEan13(code: string): ScaleEan13Result | null {
  const c = code.trim();
  if (c.length !== 13 || !/^(20|21)\d{11}$/.test(c)) return null;
  // A scale prints a valid check digit; a mistyped / half-read code is not taken as a weight (v4.171.0).
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(c[i]) * (i % 2 === 0 ? 1 : 3);
  if ((10 - (sum % 10)) % 10 !== Number(c[12])) return null;
  const plu = c.slice(2, 7);
  const grams = parseInt(c.slice(7, 12), 10);
  if (isNaN(grams) || grams <= 0) return null;
  const numPlu = parseInt(plu, 10);
  const pluCandidates = [
    plu,
    isNaN(numPlu) ? plu : String(numPlu),
    `20${plu}`,
    `21${plu}`,
  ];
  return {
    plu,
    grams,
    quantityKg: Math.round((grams / 1000) * 1000) / 1000,
    pluCandidates,
  };
}

