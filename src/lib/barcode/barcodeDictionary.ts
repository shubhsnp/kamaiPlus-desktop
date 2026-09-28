'use client';

/**
 * Offline barcode dictionary.
 *
 * This used to pick one of five JSON files based on the shop's trade
 * (pharmacy / apparel / electronics / general / FMCG). KamaiPlus is one
 * universal product now, so every shipped dictionary is merged into a single
 * lookup, loaded once on the first scan and then served from memory.
 */

export interface BarcodeDictionaryItem {
  barcode: string;
  name: string;
  category: string;
  mrp: number;
  selling_price: number;
  unit: string;
  tax_rate: number;
  hsn?: string;
}

const DICTIONARY_FILES = [
  '/barcodes/fmcg-india.json',
  '/barcodes/general-store.json',
  '/barcodes/apparel-retail.json',
  '/barcodes/electronics-mobile.json',
  '/barcodes/pharmacy-india.json',
];

let barcodeMap: Map<string, BarcodeDictionaryItem> | null = null;
let loadingPromise: Promise<Map<string, BarcodeDictionaryItem>> | null = null;

async function fetchDictionary(url: string): Promise<BarcodeDictionaryItem[]> {
  try {
    const res = await fetch(url, { cache: 'force-cache', headers: { Accept: 'application/json' } });
    return res.ok ? await res.json() : [];
  } catch (err) {
    // A broken file used to vanish without a word (fmcg-india.json did until v4.78.0).
    console.warn('Barcode dictionary could not be read:', url, err);
    return [];
  }
}

/** Loads and indexes the shipped barcode dictionaries. Repeat calls are free. */
export async function loadBarcodeDictionary(): Promise<Map<string, BarcodeDictionaryItem>> {
  if (barcodeMap) return barcodeMap;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const map = new Map<string, BarcodeDictionaryItem>();
    if (typeof window !== 'undefined') {
      const batches = await Promise.all(DICTIONARY_FILES.map(fetchDictionary));
      for (const items of batches) {
        for (const item of items) {
          const code = item?.barcode?.trim();
          // First file wins, so the general retail list stays authoritative.
          if (code && !map.has(code)) map.set(code, item);
        }
      }
    }
    barcodeMap = map;
    return map;
  })();

  return loadingPromise;
}

/** Instant in-memory lookup for a scanned barcode. */
export async function lookupBarcode(barcode: string): Promise<BarcodeDictionaryItem | null> {
  const clean = (barcode || '').trim();
  if (clean.length < 3) return null;
  const map = await loadBarcodeDictionary();
  return map.get(clean) || null;
}
