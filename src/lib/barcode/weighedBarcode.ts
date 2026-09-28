import { ProductUnit } from '@/types';
import { ean13CheckDigit, isValidEan13, STORE_BARCODE_PREFIX } from './storeBarcodes';

/*
 * Loose-pack labels (v4.77.0): a pack weighed out in the shop (250 g almonds, 2 kg rice)
 * gets a bar code that carries the item AND the weight, so one scan adds exactly that
 * much to the bill. This is the GS1 "variable measure" layout supermarkets use:
 *
 *   29  IIIII  QQQQQ  C        EAN-13, in-store prefix 29 (no maker's barcode uses 20–29)
 *       │      │      └ check digit
 *       │      └ quantity: thousandths of a kg / litre / metre (00250 = 0.25 kg),
 *       │                or whole grams / ml for items sold per gram / ml
 *       └ the item's store code number (its "200…" barcode, up to 99999)
 *
 * The item keeps its own "200…" code; the pack code is built from it and decoded back
 * at the counter (lib/billing → handleBarcodeScanned).
 */

export const WEIGHED_PREFIX = '29';

/** How a unit's quantity is written in the code: thousandths, whole numbers, or not at all. */
export function weighedScale(unit: ProductUnit | string | undefined): 1000 | 1 | null {
  if (unit === 'kg' || unit === 'litre' || unit === 'meter') return 1000;
  if (unit === 'gram' || unit === 'ml') return 1;
  return null;
}

/** The store code's number (2000000000015 → 1), or null when it is not a store code that fits. */
export function storeCodeNumber(barcode: string | undefined): number | null {
  const code = String(barcode || '').trim();
  if (!isValidEan13(code) || !code.startsWith(STORE_BARCODE_PREFIX)) return null;
  const n = Number(code.slice(3, 12));
  return n >= 1 && n <= 99999 ? n : null;
}

/** The pack's code, or null (not a weighed unit, no store code, or the amount does not fit). */
export function makeWeighedBarcode(itemBarcode: string | undefined, unit: ProductUnit | string, qty: number): string | null {
  const scale = weighedScale(unit);
  const item = storeCodeNumber(itemBarcode);
  if (!scale || item === null || !(qty > 0)) return null;
  const amount = Math.round(qty * scale);
  if (amount < 1 || amount > 99999) return null;
  const first12 = WEIGHED_PREFIX + String(item).padStart(5, '0') + String(amount).padStart(5, '0');
  return first12 + ean13CheckDigit(first12);
}

/** A scanned pack code → the item's store code and the raw amount; null for anything else. */
export function parseWeighedBarcode(code: string): { itemBarcode: string; amount: number } | null {
  const c = String(code || '').trim();
  if (!c.startsWith(WEIGHED_PREFIX) || !isValidEan13(c)) return null;
  const item = Number(c.slice(2, 7));
  const amount = Number(c.slice(7, 12));
  if (!(item >= 1) || !(amount >= 1)) return null;
  const first12 = STORE_BARCODE_PREFIX + String(item).padStart(9, '0');
  return { itemBarcode: first12 + ean13CheckDigit(first12), amount };
}

/** The quantity a pack adds to the bill, in the item's own unit (null = unit cannot be weighed). */
export function weighedQuantity(unit: ProductUnit | string, amount: number): number | null {
  const scale = weighedScale(unit);
  return scale ? Math.round((amount / scale) * 1000) / 1000 : null;
}

/** "250 g", "1.5 kg", "750 ml" — for the pack label's name. */
export function formatPackAmount(unit: ProductUnit | string, qty: number): string {
  if (unit === 'kg') return qty < 1 ? `${Math.round(qty * 1000)} g` : `${+qty.toFixed(3)} kg`;
  if (unit === 'litre') return qty < 1 ? `${Math.round(qty * 1000)} ml` : `${+qty.toFixed(3)} L`;
  if (unit === 'meter') return qty < 1 ? `${Math.round(qty * 100)} cm` : `${+qty.toFixed(3)} m`;
  if (unit === 'gram') return qty >= 1000 ? `${+(qty / 1000).toFixed(3)} kg` : `${Math.round(qty)} g`;
  if (unit === 'ml') return qty >= 1000 ? `${+(qty / 1000).toFixed(3)} L` : `${Math.round(qty)} ml`;
  return String(qty);
}
