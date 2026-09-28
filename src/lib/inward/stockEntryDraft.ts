import { MASTER_UNITS } from '@/lib/constants/storeProfiles';
import { ProductUnit } from '@/types';
import { StockEntryRow } from './stockEntry';

/*
 * Rows typed in "New stock + labels" survive closing the window, a page change or a
 * power cut until they are saved (per computer, like the open POS bills).
 */

const DRAFT_KEY = 'kamai_stock_entry_draft';
const UNITS = new Set<string>(MASTER_UNITS.map((u) => u.id));
const text = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');

export interface StockEntryDraft {
  rows: StockEntryRow[];
  categoryId: string;
}

/** Stored JSON → draft; broken or foreign values are dropped. */
export function parseStockEntryDraft(raw: string | null | undefined): StockEntryDraft | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.rows)) return null;
    const rows: StockEntryRow[] = d.rows.slice(0, 500).filter((r: any) => r && typeof r.key === 'string').map((r: any) => ({
      key: r.key.slice(0, 40),
      productId: typeof r.productId === 'string' && r.productId ? r.productId : undefined,
      name: text(r.name),
      price: text(r.price, 20),
      mrp: text(r.mrp, 20),
      cost: text(r.cost, 20),
      qty: text(r.qty, 20),
      unit: (UNITS.has(r.unit) ? r.unit : 'piece') as ProductUnit,
      gst: text(r.gst, 5),
      hsn: text(r.hsn, 8),
      barcode: text(r.barcode, 40),
    }));
    return rows.length ? { rows, categoryId: text(d.categoryId, 80) } : null;
  } catch {
    return null;
  }
}

export function readStockEntryDraft(): StockEntryDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseStockEntryDraft(localStorage.getItem(DRAFT_KEY));
  } catch {
    return null;
  }
}

export function saveStockEntryDraft(draft: StockEntryDraft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {}
}

export function clearStockEntryDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {}
}

/** Rows waiting in the draft (Barcode Studio shows "continue" when there are some). */
export const stockEntryDraftCount = (): number => readStockEntryDraft()?.rows.length || 0;
