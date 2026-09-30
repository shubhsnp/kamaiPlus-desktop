import { db } from '@/lib/db';
import { Product } from '@/types';

/*
 * The shop's own barcodes (v4.70.0). Every product that gets a label needs a code
 * that is SAVED on the product — otherwise the POS cannot find it when the label is
 * scanned. Codes are EAN-13 with the GS1 in-store prefix "200" (200 + 9-digit
 * number + check digit): numeric, short enough for a 38 mm label, readable by any
 * scanner, and never clashing with a manufacturer's barcode.
 */

export const STORE_BARCODE_PREFIX = '200';

/** EAN-13 check digit for the first 12 digits. */
export function ean13CheckDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

export function isValidEan13(code: string): boolean {
  return /^\d{13}$/.test(code) && ean13CheckDigit(code.slice(0, 12)) === Number(code[12]);
}

/**
 * Which store-code numbers each app hands out (v4.86.0, Step 5). With cloud sync the phone
 * makes store codes too; "after the highest in use" on both would give two items the same
 * code before they had synced. So the Desktop keeps 1–49,999 (the numbers a loose-pack code
 * can carry, up to 99,999) and 100,000–549,999 after that; the phone (KamaiPlus Android
 * `store_barcodes.dart`) 50,000–99,999, then 550,000 and up.
 */
export const DESKTOP_STORE_CODE_RANGES: [number, number][] = [[1, 49_999], [100_000, 549_999]];

/** `count` new store codes, after the highest one in use in this computer's ranges, skipping any code already taken. */
export function nextStoreBarcodes(existing: Iterable<string>, count: number, ranges: [number, number][] = DESKTOP_STORE_CODE_RANGES): string[] {
  const used = new Set<string>();
  const high = ranges.map(([lo]) => lo - 1);
  for (const raw of Array.from(existing)) {
    const code = String(raw || '').trim();
    if (!code) continue;
    used.add(code);
    if (code.length === 13 && code.startsWith(STORE_BARCODE_PREFIX) && /^\d+$/.test(code)) {
      const n = Number(code.slice(3, 12));
      ranges.forEach(([lo, hi], r) => { if (n >= lo && n <= hi) high[r] = Math.max(high[r], n); });
    }
  }
  let r = 0;
  while (r < ranges.length - 1 && high[r] >= ranges[r][1]) r++;
  let seq = high[r];
  const out: string[] = [];
  while (out.length < count) {
    seq += 1;
    if (seq > ranges[r][1]) {
      if (r === ranges.length - 1) throw new Error('No store barcodes left');
      r += 1;
      seq = Math.max(high[r] + 1, ranges[r][0]);
    }
    const first12 = STORE_BARCODE_PREFIX + String(seq).padStart(9, '0');
    const code = first12 + ean13CheckDigit(first12);
    if (!used.has(code)) {
      used.add(code);
      out.push(code);
    }
  }
  return out;
}

/** Every barcode in use (keys of the barcode index only — no product rows are loaded). */
export async function barcodesInUse(): Promise<string[]> {
  return (await db.products.orderBy('barcode').uniqueKeys()).map((k) => String(k)).filter(Boolean);
}

/** The product's barcode — a new store code is saved first if it has none. */
export async function ensureProductBarcode(product: Pick<Product, 'id' | 'barcode'>): Promise<string> {
  if (product.barcode?.trim()) return product.barcode.trim();
  return db.transaction('rw', db.products, async () => {
    const fresh = await db.products.get(product.id);
    if (fresh?.barcode?.trim()) return fresh.barcode.trim();
    const [code] = nextStoreBarcodes(await barcodesInUse(), 1);
    await db.products.update(product.id, { barcode: code, updated_at: new Date().toISOString() });
    return code;
  });
}

/**
 * Bulk version for label printing: every listed product ends up with a saved barcode
 * (one transaction, fresh rows re-read). Returns product id → barcode.
 */
export async function ensureProductBarcodes(products: Pick<Product, 'id' | 'barcode'>[]): Promise<Map<string, string>> {
  const codes = new Map<string, string>();
  const missingIds: string[] = [];
  for (const p of products) {
    if (p.barcode?.trim()) codes.set(p.id, p.barcode.trim());
    else missingIds.push(p.id);
  }
  if (missingIds.length === 0) return codes;
  await db.transaction('rw', db.products, async () => {
    const fresh = (await db.products.bulkGet(missingIds)).filter((p): p is Product => Boolean(p));
    const stillMissing = fresh.filter((p) => !p.barcode?.trim());
    fresh.filter((p) => p.barcode?.trim()).forEach((p) => codes.set(p.id, p.barcode!.trim()));
    if (stillMissing.length === 0) return;
    const newCodes = nextStoreBarcodes(await barcodesInUse(), stillMissing.length);
    const now = new Date().toISOString();
    await db.products.bulkPut(stillMissing.map((p, i) => ({ ...p, barcode: newCodes[i], updated_at: now })));
    stillMissing.forEach((p, i) => codes.set(p.id, newCodes[i]));
  });
  return codes;
}
