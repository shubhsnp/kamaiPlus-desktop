/*
 * Quantities by unit on the counter (v4.78.0) — what the ✏️ item window allows.
 *
 *   piece, pair, set, packet,
 *   bottle, can              → whole numbers only (v4.100.0: bottle / can took 1.5 too)
 *   box, bundle, bag, custom → parts too: ¼, ½, ¾ box, half a sack …
 *   dozen                    → parts, or pieces: 7 pcs = 7/12 dozen
 *   kg, litre, metre …       → any amount (250 g = 0.25 kg)
 *
 * The line amount is always rate × quantity (the rate is per unit), rounded to paise.
 */

const WHOLE_ONLY = ['piece', 'pair', 'set', 'packet', 'bottle', 'can'];

/** Can this unit be sold in parts? An item marked "decimals allowed" always can. */
export function allowsFractionalQty(unit: string | undefined, allowDecimal?: boolean): boolean {
  if (allowDecimal) return true;
  return !WHOLE_ONLY.includes(String(unit || 'piece').toLowerCase());
}

/** Quantities keep 6 decimals: 7/12 dozen × any rate still rounds to the exact paise. */
export const roundQty = (q: number) => Math.round((Number(q) || 0) * 1e6) / 1e6;

/** Pieces of a dozen → dozen quantity (7 → 0.583333). */
export const dozenFromPieces = (pieces: number) => roundQty((Number(pieces) || 0) / 12);

/** Whole pieces in a dozen quantity (0.583333 → 7). */
export const piecesInDozen = (dozen: number) => Math.round((Number(dozen) || 0) * 12);

/** Line amount in paise for a quantity at a rate per unit. */
export const lineAmountPaise = (qty: number, ratePaise: number) => Math.round((Number(qty) || 0) * (Number(ratePaise) || 0));

/** A quantity as the counter shows it: 2, 0.5, 0.583 (never 0.5833333333). */
export function formatCartQty(qty: number): string {
  const q = Number(qty) || 0;
  if (Number.isInteger(q)) return String(q);
  return q.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}
