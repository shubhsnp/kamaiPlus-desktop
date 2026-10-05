import { PurchaseBillLineItem } from '@/types';
import { msg } from '@/lib/i18n/core';
import { findHeaderRow, guessColumnRoles, mapUnit, parseAmount } from '@/lib/import/catalogImport';

/*
 * A supplier's bill as Excel / CSV → bill lines (v4.77.0). Pure, no database.
 *
 * Headings are recognised the way the price-list import does it (English / Hindi /
 * Marathi, whole words — "Discount" is not "count", "Unit Price" is not "unit"), money
 * like "₹1,250.00" is read, a title row above the headings is skipped, and total rows
 * are left out. On a supplier's bill "Rate" / "Price" is what the shop PAYS; the
 * selling price comes from a "Selling / Sale price" or MRP column, else it is typed in
 * the review — it is never made up.
 */

export interface BillColumns {
  name: number;
  qty: number;
  cost: number;
  selling: number;
  mrp: number;
  unit: number;
  barcode: number;
  gst: number;
  hsn: number;
}

const tokens = (s: string) => String(s || '').toLowerCase().split(/[\s!-\/:-@\[-`{-~]+/).filter(Boolean);
const SELLING_WORDS = ['selling', 'sale', 'sp', 'retail', 'बिक्री', 'विक्री'];
const PRICE_WORDS = ['price', 'rate', 'भाव', 'दाम', 'किंमत', 'कीमत', 'दर'];
const TOTAL_WORDS = ['total', 'amount', 'amt', 'value'];
const QTY_WORDS = ['nos', 'pcs', 'pieces', 'नग'];
const has = (h: string, words: string[]) => tokens(h).some((t) => words.includes(t));

/**
 * Which column is what on a supplier's bill (-1 = not there). A "Selling / Sale" column
 * is the selling price; the cost is the purchase column, else the first plain "Rate" /
 * "Price" column (never a total / amount column).
 */
export function guessBillColumns(headers: string[]): BillColumns {
  const roles = guessColumnRoles(headers);
  const at = (r: string) => roles.indexOf(r as never);
  const free = (i: number) => roles[i] !== 'cost' && roles[i] !== 'mrp' && roles[i] !== 'name' && roles[i] !== 'gst' && !has(headers[i], TOTAL_WORDS);
  const selling = headers.findIndex((h, i) => free(i) && has(h, SELLING_WORDS));
  let cost = at('cost');
  if (cost < 0) cost = headers.findIndex((h, i) => i !== selling && free(i) && has(h, PRICE_WORDS));
  let qty = at('stock');
  if (qty < 0) qty = headers.findIndex((h, i) => roles[i] === 'ignore' && has(h, QTY_WORDS));
  return { name: at('name'), qty, cost, selling, mrp: at('mrp'), unit: at('unit'), barcode: at('barcode'), gst: at('gst'), hsn: at('hsn') };
}

const clean = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();
const TOTAL_ROW = /^(grand\s*total|sub\s*total|total|net\s*amount|round\s*off|कुल|एकूण)\b/i;
const GST_SLABS = [0, 3, 5, 12, 18, 28, 40];

export interface BillSheetResult {
  items: PurchaseBillLineItem[];
  /** Rows left out: no item name, a total row, or no quantity. */
  skipped: number;
  columns: BillColumns;
  /** msg id when nothing could be read. */
  error?: string;
  /** What the title rows above the headings say (supplier, bill number, date), when they say it. */
  heading: BillHeading;
}

export interface BillHeading {
  supplier?: string;
  billNumber?: string;
  /** yyyy-mm-dd */
  billDate?: string;
}

// (?<![a-z]) not \b: \b never matches before a Hindi word such as "बिल".
const BILL_NO = /(?<![a-z])(?:bill|invoice|inv|challan|बिल|बील)(?![a-z])\.?\s*(?:no\.?|number|num|#|नं\.?|क्र\.?)?\s*[:#\-–—]?\s*([A-Za-z0-9][A-Za-z0-9/\-]{0,24})/i;
const DATE = /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})\b/;

/**
 * The supplier's name, bill number and date from the title rows of a bill sheet (v4.100.0).
 * Before, the supplier was the file's name and the bill number a made-up "CSV_5805", though
 * the sheet said "Shree Ganesh Distributors — Bill 2291".
 */
export function readBillHeading(rows: unknown[][]): BillHeading {
  const heading: BillHeading = {};
  for (const r of rows) {
    for (const c of r || []) {
      const text = clean(c);
      if (!text) continue;
      const no = BILL_NO.exec(text);
      if (no && !heading.billNumber && /\d/.test(no[1])) heading.billNumber = no[1];
      const d = DATE.exec(text);
      if (d && !heading.billDate) {
        const year = d[3].length === 2 ? 2000 + Number(d[3]) : Number(d[3]);
        const month = Number(d[2]), day = Number(d[1]);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) heading.billDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
      // The supplier: the first text that is not only a bill number / date / GSTIN line.
      const name = text
        .replace(BILL_NO, '')
        .replace(DATE, '')
        .replace(/\b(date|dated|दिनांक|तारीख)\b\s*[:\-]?/gi, '')
        .replace(/[\s:|,–—-]+$/g, '')
        .replace(/^[\s:|,–—-]+/g, '')
        .trim();
      if (!heading.supplier && name.length >= 3 && /[A-Za-zऀ-෿]/.test(name) && !/^(gstin|gst|phone|mobile|ph|address|tax invoice|invoice|bill)\b/i.test(name)) heading.supplier = name;
    }
  }
  return heading;
}

/** Sheet grid (rows of cells, first sheet) → bill lines, prices in paise. */
export function readBillSheet(grid: unknown[][]): BillSheetResult {
  const headerIndex = findHeaderRow(grid);
  const headers = ((grid[headerIndex] as unknown[]) || []).map((h) => String(h ?? ''));
  const columns = guessBillColumns(headers);
  const result: BillSheetResult = { items: [], skipped: 0, columns, heading: readBillHeading(grid.slice(0, Math.max(0, headerIndex))) };
  if (columns.name < 0) {
    result.error = msg('No item-name column found. The first row should have headings like "Item", "Qty", "Rate".');
    return result;
  }
  const cell = (r: unknown[], i: number) => (i >= 0 ? r[i] : undefined);
  const paise = (v: unknown) => {
    const n = parseAmount(v);
    return n !== null && n > 0 ? Math.round(n * 100) : null;
  };

  for (const r of grid.slice(headerIndex + 1)) {
    if (!r || r.every((c) => !clean(c))) continue;
    const name = clean(cell(r, columns.name));
    if (!name || TOTAL_ROW.test(name)) {
      result.skipped++;
      continue;
    }
    const qtyRead = columns.qty >= 0 ? parseAmount(cell(r, columns.qty)) : null;
    if (columns.qty >= 0 && !(qtyRead !== null && qtyRead > 0)) {
      result.skipped++;
      continue;
    }
    const quantity = qtyRead ?? 1;
    const cost = paise(cell(r, columns.cost)) ?? 0;
    const mrp = paise(cell(r, columns.mrp));
    const selling = paise(cell(r, columns.selling)) ?? mrp;
    const gstRead = columns.gst >= 0 ? parseAmount(String(cell(r, columns.gst) ?? '').replace('%', '')) : null;
    const hsn = clean(cell(r, columns.hsn)).replace(/\D/g, '').slice(0, 8);
    // A supplier's own item code ("A102") is not a barcode; only real ones (EAN / UPC) are kept.
    const code = clean(cell(r, columns.barcode)).replace(/\.0+$/, '');
    const barcode = /^\d{8,14}$/.test(code) ? code : '';
    result.items.push({
      raw_name: name,
      is_new_product: true,
      quantity,
      unit: columns.unit >= 0 ? mapUnit(cell(r, columns.unit)).unit : 'piece',
      unit_price: cost,
      total_price: Math.round(cost * quantity),
      selling_price: selling ?? undefined,
      mrp: mrp ?? undefined,
      barcode: barcode || undefined,
      tax_rate: gstRead !== null && GST_SLABS.includes(gstRead) ? gstRead : undefined,
      hsn_code: hsn || undefined,
      // No quantity column or no rate: worth a look in the review.
      confidence: columns.qty >= 0 && cost > 0 ? 'high' : 'low',
    });
  }
  if (!result.items.length) result.error = msg('No item rows with a quantity were found in the file.');
  return result;
}

/**
 * What must be fixed on a bill line before it can be saved (msg id, '' = fine). A new
 * item needs a selling price (or MRP) — the old "cost + 25 %" guess is gone.
 */
export function billLineProblem(item: PurchaseBillLineItem): string {
  if (!item.raw_name.trim()) return '';
  if (!(Number(item.quantity) > 0)) return msg('Enter the quantity');
  const newItem = item.is_new_product || !item.matched_product_id;
  const selling = item.selling_price || item.mrp || 0;
  if (newItem && !(selling > 0)) return msg('Enter the selling price for this new item');
  if (newItem && item.mrp && item.selling_price && item.mrp < item.selling_price) return msg('MRP cannot be less than the price');
  return '';
}
