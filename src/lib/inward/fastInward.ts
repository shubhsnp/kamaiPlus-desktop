import { Product, ProductUnit } from '@/types';
import { mapUnit } from '@/lib/import/catalogImport';
import { findCategoryByName } from '@/lib/products/categories';
import { emptyEntryRow, StockEntryRow } from './stockEntry';

/*
 * Fast barcode inward (v4.78.0) — like the Android app's rapid inward, for a USB gun:
 * every scan adds a row at once and the cursor stays in the scan box. Pure logic.
 *
 *   same code again      → that row's quantity +1 (5 packets = 5 scans), moved to the top
 *   a saved item's code  → a row that adds stock to it
 *   known in the offline barcode list → name, price, unit (and category if the shop has it)
 *   unknown              → a row waiting for its name and price
 */

export type ScanOutcome = 'more' | 'saved' | 'known' | 'unknown';

/** What the offline barcode list knows about a code (prices in ₹, as shipped). */
export interface KnownBarcode {
  name: string;
  category?: string;
  mrp?: number;
  selling_price?: number;
  unit?: string;
  tax_rate?: number;
  hsn?: string;
}

export interface ScanResult {
  rows: StockEntryRow[];
  /** The row the scan went to. */
  key: string;
  outcome: ScanOutcome;
}

const plusOne = (qty: string) => {
  const n = Number(qty);
  return String(Number.isFinite(n) && n > 0 ? Math.round((n + 1) * 1000) / 1000 : 1);
};

/** Adds one scanned code to the rows (newest first). */
export function scanIntoRows(
  rows: StockEntryRow[],
  code: string,
  products: Product[],
  known: KnownBarcode | null,
  newKey: string,
  opts: { separateSellingPrice: boolean; categories: { id: string; name: string }[] }
): ScanResult {
  const clean = code.trim();
  const sellable = products.filter((p) => p.is_active !== false && !p.has_variants);
  const saved = sellable.find((p) => p.barcode?.trim() === clean);

  const same = rows.find((r) => r.barcode === clean || (saved && r.productId === saved.id));
  if (same) {
    const moved = { ...same, qty: plusOne(same.qty) };
    return { rows: [moved, ...rows.filter((r) => r.key !== same.key)], key: same.key, outcome: 'more' };
  }

  if (saved) {
    const row: StockEntryRow = { ...emptyEntryRow(newKey, saved.unit), productId: saved.id, name: saved.name, qty: '1', categoryId: saved.category_id };
    return { rows: [row, ...rows], key: newKey, outcome: 'saved' };
  }

  const row: StockEntryRow = { ...emptyEntryRow(newKey), barcode: clean, qty: '1' };
  if (known?.name) {
    const mrp = Number(known.mrp) || 0;
    const selling = Number(known.selling_price) || 0;
    row.name = known.name;
    row.price = String(opts.separateSellingPrice ? selling || mrp || '' : mrp || selling || '');
    if (opts.separateSellingPrice && mrp) row.mrp = String(mrp);
    row.unit = (known.unit ? mapUnit(known.unit).unit : 'piece') as ProductUnit;
    if (known.tax_rate) row.gst = String(known.tax_rate);
    if (known.hsn) row.hsn = known.hsn;
    const cat = known.category ? findCategoryByName(opts.categories, known.category) : undefined;
    if (cat) row.categoryId = cat.id;
    return { rows: [row, ...rows], key: newKey, outcome: 'known' };
  }
  return { rows: [row, ...rows], key: newKey, outcome: 'unknown' };
}

/**
 * A gun scan that landed in a text box instead of the scan box: the gun types the code
 * straight after what is there ("Parle-G 80g8901719101037" + Enter). A run of 8+ digits
 * at the end is the code; a box holding only a code is one too. Returns the code and the
 * text that was there before it.
 */
export function splitTrailingCode(value: string, looksLikeCode: (s: string) => boolean): { before: string; code: string } | null {
  const digits = /^(.*?)(\d{8,})$/.exec(value.trimEnd());
  if (digits) return { before: digits[1].trimEnd(), code: digits[2] };
  const whole = value.trim();
  return whole && looksLikeCode(whole) ? { before: '', code: whole } : null;
}
