import { Product } from '@/types';

/*
 * Extra lines on a label (v4.77.0), each switched on in the label setup.
 *
 * Cost code — the purchase price written in the shop's own code word, so the owner can
 * read what an item cost without the customer knowing. The word has 10 different
 * letters for the digits 1 2 3 4 5 6 7 8 9 0 (e.g. BLACKHORSE: B=1 … E=0), so a cost of
 * ₹245 prints "LCK". Printed in whole rupees.
 *
 * Size / colour — clothes, shoes and variants ("M / Red", "XL").
 */

/** 10 different letters (A–Z) — anything else cannot be decoded and is not printed. */
export function isValidCostCodeWord(word: string): boolean {
  const w = String(word || '').toUpperCase();
  return /^[A-Z]{10}$/.test(w) && new Set(w.split('')).size === 10;
}

/** Cost in the code word ('' when the word is not valid or there is no cost). */
export function encodeCostCode(costPaise: number | undefined, word: string): string {
  const rupees = Math.round((Number(costPaise) || 0) / 100);
  if (!(rupees > 0) || !isValidCostCodeWord(word)) return '';
  const w = word.toUpperCase();
  return String(rupees)
    .split('')
    .map((d) => w[(Number(d) + 9) % 10])
    .join('');
}

/** What the label's size / colour line says for an item ('' = nothing). */
export function productLabelDetail(p: Pick<Product, 'size' | 'color' | 'variant_label' | 'parent_id'>): string {
  const parts = [p.size, p.color].map((x) => String(x || '').trim()).filter(Boolean);
  if (parts.length) return parts.join(' / ');
  // A variant's name already ends in "(XL)"; its label is shown only when there is no size / colour.
  return p.parent_id ? String(p.variant_label || '').trim() : '';
}

/** The label fields a saved item adds beyond name / code / price. */
export function productLabelExtras(p: Pick<Product, 'purchase_price' | 'size' | 'color' | 'variant_label' | 'parent_id'>): { costPaise?: number; detail?: string } {
  const detail = productLabelDetail(p);
  return {
    costPaise: p.purchase_price > 0 ? p.purchase_price : undefined,
    detail: detail || undefined,
  };
}
