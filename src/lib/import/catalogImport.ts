import { Product, ProductUnit } from '@/types';
import { msg } from '@/lib/i18n/core';

/*
 * Smart Excel / CSV price-list import (v4.70.0) — pure logic, no database.
 *
 * Any shop's own list works, not one fixed template: each column is recognised by
 * its heading (English, Hindi, Marathi) and the shop can correct the guess. The
 * price in the sheet IS the selling price. Uploading the same (edited) sheet again
 * updates prices instead of adding copies: rows are matched to saved items by
 * barcode, else by the item name built here — which is stable for the same sheet.
 */

export type ColumnRole = 'name' | 'company' | 'category' | 'price' | 'mrp' | 'cost' | 'unit' | 'stock' | 'barcode' | 'gst' | 'hsn' | 'ignore';

/** Choices in the "Use this column as" list (msg ids). */
export const COLUMN_ROLES: { id: ColumnRole; label: string }[] = [
  { id: 'name', label: msg('Item name *') },
  { id: 'price', label: msg('Price *') },
  { id: 'company', label: msg('Company / brand') },
  { id: 'category', label: msg('Category / section') },
  { id: 'unit', label: msg('Unit / per') },
  { id: 'mrp', label: msg('MRP') },
  { id: 'cost', label: msg('Purchase / cost price') },
  { id: 'stock', label: msg('Stock') },
  { id: 'barcode', label: msg('Barcode') },
  { id: 'gst', label: msg('GST %') },
  { id: 'hsn', label: msg('HSN / SAC') },
  { id: 'ignore', label: msg("Don't use") },
];

// First rule that matches a heading wins; a role already taken makes a later column "ignore".
const HEADING_RULES: [ColumnRole, string[]][] = [
  ['ignore', ['sr', 's no', 'sno', 'sl', 'serial', 'page', 'side', 'note', 'notes', 'remark', 'remarks', 'review', 'क्रमांक', 'अनु']],
  ['hsn', ['hsn', 'sac']],
  ['barcode', ['barcode', 'bar code', 'ean', 'upc', 'sku', 'code', 'बारकोड']],
  ['gst', ['gst', 'tax', 'vat', 'जीएसटी']],
  ['mrp', ['mrp', 'max retail', 'एमआरपी']],
  ['cost', ['purchase', 'cost', 'buy', 'buying', 'खरीद', 'खरेदी']],
  ['price', ['price', 'selling', 'sale', 'rate', 'sp', 'भाव', 'दाम', 'किंमत', 'कीमत', 'दर']],
  ['stock', ['stock', 'qty', 'quantity', 'opening', 'स्टॉक', 'मात्रा', 'नग संख्या']],
  ['unit', ['unit', 'uom', 'per', 'प्रति', 'इकाई', 'युनिट']],
  ['category', ['category', 'section', 'group', 'department', 'dept', 'type', 'श्रेणी', 'विभाग', 'प्रकार', 'वर्ग']],
  ['company', ['company', 'brand', 'make', 'manufacturer', 'कंपनी', 'कम्पनी', 'ब्रांड']],
  ['name', ['item', 'name', 'product', 'description', 'particulars', 'आयटम', 'नाम', 'नाव', 'माल', 'वस्तू', 'वस्तु']],
];

// Split on spaces and ASCII punctuation; Devanagari letters and matras stay inside words.
const words = (s: string) => s.toLowerCase().split(/[\s!-\/:-@\[-`{-~]+/).filter(Boolean);
const hasPhrase = (tokens: string[], phrase: string) => {
  const p = words(phrase);
  for (let i = 0; i + p.length <= tokens.length; i++) if (p.every((w, j) => tokens[i + j] === w)) return true;
  return false;
};

/** Best guess for every column, by its heading. */
export function guessColumnRoles(headers: string[]): ColumnRole[] {
  const taken = new Set<ColumnRole>();
  return headers.map((h) => {
    const tokens = words(String(h || ''));
    const rule = HEADING_RULES.find(([, phrases]) => phrases.some((p) => hasPhrase(tokens, p)));
    const role = rule ? rule[0] : 'ignore';
    if (role === 'ignore' || taken.has(role)) return 'ignore';
    taken.add(role);
    return role;
  });
}

const clean = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();

/** "₹1,250.00" / 1250 / "1250" → 1250; blank, "-" or text → null. */
export function parseAmount(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = clean(v).replace(/[₹,\s]/g, '').replace(/^rs\.?/i, '');
  if (!s || s === '-' || !/^-?\d*\.?\d+$/.test(s)) return null;
  return Number(s);
}

const UNIT_WORDS: [ProductUnit, string[]][] = [
  ['box', ['बॉक्स', 'box', 'boxes', 'डिब्बा', 'carton', 'ctn']],
  ['packet', ['पॅकेट', 'पैकेट', 'packet', 'packets', 'pkt', 'pack', 'pouch']],
  ['bundle', ['थैली', 'bag', 'bags', 'bundle', 'bdl']],
  ['piece', ['युनिट', 'unit', 'units', 'pc', 'pcs', 'piece', 'pieces', 'nos', 'no', 'नग', 'पिस', 'पीस', 'each']],
  ['kg', ['kg', 'kgs', 'किलो', 'kilo']],
  ['gram', ['g', 'gm', 'gms', 'gram', 'grams', 'ग्राम']],
  ['litre', ['l', 'ltr', 'litre', 'liter', 'लीटर']],
  ['ml', ['ml']],
  ['dozen', ['dozen', 'dz', 'doz', 'दर्जन']],
  ['pair', ['pair', 'जोड़ी', 'जोडी']],
  ['set', ['set', 'सेट']],
  ['meter', ['m', 'mtr', 'meter', 'metre', 'मीटर']],
];

/**
 * "प्रति" / unit text → the app's unit. A count above 1 ("100 नग", "10 थैली") is a pack
 * sold as one: the unit becomes box / bundle and the pack text goes into the item name.
 */
export function mapUnit(text: unknown): { unit: ProductUnit; pack?: string } {
  const s = clean(text);
  const m = /^(\d+(?:\.\d+)?)\s*(.*)$/.exec(s);
  const count = m ? Number(m[1]) : 1;
  const word = (m ? m[2] : s).toLowerCase().replace(/\.$/, '');
  const unit = UNIT_WORDS.find(([, ws]) => ws.includes(word))?.[0] || 'piece';
  if (count > 1) return { unit: unit === 'piece' || unit === 'box' ? 'box' : 'bundle', pack: s };
  return { unit };
}

/** A "company" cell that is really a pack size ("1 Piece", "5 नग", "50 Box/Case"). */
function companyAsPack(company: string): { isPack: boolean; pack?: string } {
  const m = /^(\d+(?:\.\d+)?)\s*(pieces?|pcs\.?|pc|nos|नग|पिस|पीस|items?|box\/case|boxes\/case)$/i.exec(company);
  if (!m) return { isPack: false };
  if (/case$/i.test(m[2]) || Number(m[1]) <= 1) return { isPack: true };
  return { isPack: true, pack: company };
}

export interface ImportOptions {
  /** "8 वाला" under चौरसा → "चौरसा 8 वाला": names that start with a size / number get their section in front. */
  prefixSection: boolean;
}

export function buildItemName(item: string, company: string, category: string, perPack: string | undefined, options: ImportOptions): string {
  let name = item;
  const section = category.replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (options.prefixSection && section && /^[\d"'“”′″]/.test(item)) {
    const lastWord = section.split(' ').pop()!.toLowerCase();
    if (!item.toLowerCase().includes(lastWord)) name = `${section} ${item}`;
  }
  const asPack = companyAsPack(company);
  if (company && !asPack.isPack) name += ` – ${company}`;
  // A pack already written in the item ("2.5\" 2 Piece") is not repeated.
  const packs = [asPack.pack, perPack].filter((p, i, all): p is string => Boolean(p) && all.indexOf(p) === i && !normName(name).includes(normName(p!)));
  if (packs.length) name += ` (${packs.join(', ')})`;
  return name;
}

export interface ImportRow {
  /** Row number as Excel shows it. */
  rowNumber: number;
  name: string;
  category: string;
  pricePaise: number | null;
  mrpPaise: number | null;
  costPaise: number | null;
  unit: ProductUnit | null;
  stock: number | null;
  barcode: string;
  gstRate: number | null;
  hsn: string;
  /** Why the row is not imported (msg id), if it is not. */
  skip?: string;
}

export const normName = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

/** Header row = the first row with at least two filled cells. */
export function findHeaderRow(grid: unknown[][]): number {
  const i = grid.findIndex((r) => r.filter((c) => clean(c)).length >= 2);
  return i < 0 ? 0 : i;
}

/** Sheet rows → import rows (names built, prices in paise, repeats and blanks marked). */
export function buildImportRows(grid: unknown[][], headerIndex: number, roles: ColumnRole[], options: ImportOptions): ImportRow[] {
  const col = (role: ColumnRole) => roles.indexOf(role);
  const cell = (r: unknown[], role: ColumnRole) => (col(role) >= 0 ? r[col(role)] : undefined);
  const paise = (v: unknown) => {
    const n = parseAmount(v);
    return n !== null && n > 0 ? Math.round(n * 100) : null;
  };

  const rows: ImportRow[] = [];
  grid.slice(headerIndex + 1).forEach((r, i) => {
    if (!r || r.every((c) => !clean(c))) return;
    const item = clean(cell(r, 'name'));
    const category = clean(cell(r, 'category'));
    const mapped = col('unit') >= 0 ? mapUnit(cell(r, 'unit')) : null;
    const stock = col('stock') >= 0 ? parseAmount(cell(r, 'stock')) : null;
    const gst = col('gst') >= 0 ? parseAmount(String(cell(r, 'gst') ?? '').replace('%', '')) : null;
    const row: ImportRow = {
      rowNumber: headerIndex + i + 2,
      name: item ? buildItemName(item, clean(cell(r, 'company')), category, mapped?.pack, options) : '',
      category,
      pricePaise: paise(cell(r, 'price')),
      mrpPaise: col('mrp') >= 0 ? paise(cell(r, 'mrp')) : null,
      costPaise: col('cost') >= 0 ? paise(cell(r, 'cost')) : null,
      unit: mapped ? mapped.unit : null,
      stock: stock !== null && stock >= 0 ? stock : null,
      barcode: clean(cell(r, 'barcode')).replace(/\.0+$/, ''),
      gstRate: gst !== null && gst >= 0 && gst <= 100 ? gst : null,
      hsn: clean(cell(r, 'hsn')).replace(/\D/g, '').slice(0, 8),
    };
    if (!row.name) row.skip = msg('No item name');
    else if (row.pricePaise === null) row.skip = msg('No price');
    rows.push(row);
  });

  // Same name twice: add the section; still the same → keep the first row only.
  const live = rows.filter((r) => !r.skip);
  const groups = new Map<string, ImportRow[]>();
  for (const r of live) groups.set(normName(r.name), [...(groups.get(normName(r.name)) || []), r]);
  for (const group of Array.from(groups.values())) {
    if (group.length < 2) continue;
    for (const r of group) if (r.category && !normName(r.name).includes(normName(r.category))) r.name = `${r.name} – ${r.category}`;
  }
  const seen = new Set<string>();
  for (const r of live) {
    const key = normName(r.name);
    if (seen.has(key)) r.skip = msg('Same item twice in the sheet — the first one is kept');
    seen.add(key);
  }
  return rows;
}

export interface PlannedUpdate {
  row: ImportRow;
  product: Product;
  /** What changes (msg ids): price, category, unit… */
  changes: string[];
}

export interface ImportPlan {
  creates: ImportRow[];
  updates: PlannedUpdate[];
  unchanged: ImportRow[];
  skipped: ImportRow[];
}

/** Which rows add a new item, which change a saved one (matched by barcode, else by name), which change nothing. */
export function planImport(rows: ImportRow[], existing: Product[], mrpMapped: boolean): ImportPlan {
  const byBarcode = new Map<string, Product>();
  const byName = new Map<string, Product>();
  for (const p of existing) {
    if (p.has_variants) continue;
    if (p.barcode?.trim() && !byBarcode.has(p.barcode.trim())) byBarcode.set(p.barcode.trim(), p);
    if (!byName.has(normName(p.name))) byName.set(normName(p.name), p);
  }
  const plan: ImportPlan = { creates: [], updates: [], unchanged: [], skipped: [] };
  const matched = new Set<string>();
  for (const row of rows) {
    if (row.skip) {
      plan.skipped.push(row);
      continue;
    }
    const product = (row.barcode && byBarcode.get(row.barcode)) || byName.get(normName(row.name));
    if (!product) {
      plan.creates.push(row);
      continue;
    }
    if (matched.has(product.id)) {
      plan.skipped.push({ ...row, skip: msg('Same item twice in the sheet — the first one is kept') });
      continue;
    }
    matched.add(product.id);
    const price = row.pricePaise!;
    const mrp = mrpMapped && row.mrpPaise ? row.mrpPaise : price;
    const changes: string[] = [];
    if (product.selling_price !== price || (product.mrp || product.selling_price) !== mrp) changes.push(msg('price'));
    if (row.category && normName(product.category_name || '') !== normName(row.category)) changes.push(msg('category'));
    if (row.unit && product.unit !== row.unit) changes.push(msg('unit'));
    if (row.costPaise !== null && product.purchase_price !== row.costPaise) changes.push(msg('cost price'));
    if (row.gstRate !== null && product.tax_rate !== row.gstRate) changes.push(msg('GST'));
    if (row.hsn && product.hsn_code !== row.hsn) changes.push(msg('HSN'));
    if (row.barcode && !product.barcode?.trim()) changes.push(msg('barcode'));
    if (changes.length) plan.updates.push({ row, product, changes });
    else plan.unchanged.push(row);
  }
  return plan;
}
