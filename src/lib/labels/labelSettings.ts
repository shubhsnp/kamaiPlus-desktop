import { msg } from '@/lib/i18n/core';

/*
 * Barcode label printing setup (v4.71.0) — per computer, like the bill printer
 * (the printer belongs to the machine). Set once, used by Barcode Studio, the
 * 1-click label and "print labels" after an Excel import.
 */

export interface LabelStock {
  id: string;
  /** msg id shown in the size list */
  label: string;
  kind: 'roll' | 'sheet';
  widthMm: number;
  heightMm: number;
  /** Labels side by side (roll) / columns (A4 sheet). */
  across: number;
  /** Gap between labels side by side. */
  gapMm: number;
  // A4 sheets only
  rows?: number;
  rowGapMm?: number;
  topMm?: number;
  leftMm?: number;
}

/** Common Indian label stocks. Anything else: "Custom roll size". */
export const LABEL_STOCKS: LabelStock[] = [
  { id: 'roll_50x25', label: msg('Roll 50 × 25 mm (1 across)'), kind: 'roll', widthMm: 50, heightMm: 25, across: 1, gapMm: 0 },
  { id: 'roll_38x25', label: msg('Roll 38 × 25 mm (1 across)'), kind: 'roll', widthMm: 38, heightMm: 25, across: 1, gapMm: 0 },
  { id: 'roll_38x25_2', label: msg('Roll 38 × 25 mm (2 across)'), kind: 'roll', widthMm: 38, heightMm: 25, across: 2, gapMm: 2 },
  { id: 'roll_50x25_2', label: msg('Roll 50 × 25 mm (2 across)'), kind: 'roll', widthMm: 50, heightMm: 25, across: 2, gapMm: 3 },
  { id: 'roll_40x30', label: msg('Roll 40 × 30 mm (1 across)'), kind: 'roll', widthMm: 40, heightMm: 30, across: 1, gapMm: 0 },
  { id: 'roll_50x30', label: msg('Roll 50 × 30 mm (1 across)'), kind: 'roll', widthMm: 50, heightMm: 30, across: 1, gapMm: 0 },
  { id: 'roll_75x50', label: msg('Roll 75 × 50 mm (1 across)'), kind: 'roll', widthMm: 75, heightMm: 50, across: 1, gapMm: 0 },
  { id: 'roll_100x50', label: msg('Roll 100 × 50 mm (1 across)'), kind: 'roll', widthMm: 100, heightMm: 50, across: 1, gapMm: 0 },
  { id: 'a4_24', label: msg('A4 sheet, 24 labels (3 × 8, 63.5 × 33.9 mm)'), kind: 'sheet', widthMm: 63.5, heightMm: 33.9, across: 3, gapMm: 2.5, rows: 8, rowGapMm: 0, topMm: 12.9, leftMm: 7.2 },
  { id: 'a4_40', label: msg('A4 sheet, 40 labels (4 × 10, 52.5 × 29.7 mm)'), kind: 'sheet', widthMm: 52.5, heightMm: 29.7, across: 4, gapMm: 0, rows: 10, rowGapMm: 0, topMm: 0, leftMm: 0 },
  { id: 'a4_65', label: msg('A4 sheet, 65 labels (5 × 13, 38.1 × 21.2 mm)'), kind: 'sheet', widthMm: 38.1, heightMm: 21.2, across: 5, gapMm: 2.5, rows: 13, rowGapMm: 0, topMm: 10.7, leftMm: 4.7 },
];

export const CUSTOM_STOCK_ID = 'custom';

export interface LabelContent {
  shopName: boolean;
  itemName: boolean;
  price: boolean;
  /** MRP shown struck through when it is above the price. */
  mrp: boolean;
  /** The digits under the bars. */
  code: boolean;
  /** Printing date. */
  date: boolean;
  /** A QR code instead of bars (for 2D / camera scanners; a laser gun reads bars only). */
  qr: boolean;
  /** Purchase price in the shop's code word (labelExtras.ts) — v4.77.0. */
  costCode: boolean;
  /** Size / colour line (clothes, shoes, variants) — v4.77.0. */
  detail: boolean;
}

export interface LabelSettings {
  stockId: string;
  /** Used when stockId is "custom" (a roll). */
  custom: { widthMm: number; heightMm: number; across: number; gapMm: number };
  /** Windows printer name; '' = ask every time (print dialog). */
  printer: string;
  /** Print straight to the chosen printer (no dialog). Needs a printer. */
  silent: boolean;
  content: LabelContent;
  /** Copies for an item added to the print list. */
  copies: number;
  /** 10 different letters for the digits 1…9, 0 (cost code); '' = not set. */
  costCodeWord: string;
  /** Height of the bars in mm; 0 = the bars fill the space left on the label (v4.80.0). */
  barHeightMm: number;
}

/** Bar heights offered in the label setup (besides "fill the label"). */
export const BAR_HEIGHTS_MM = [6, 8, 10, 12, 14, 16, 20];

export const LABEL_SETTINGS_KEY = 'kamai_label_settings';
export const LABEL_SETTINGS_EVENT = 'label_settings_changed';

export const DEFAULT_LABEL_SETTINGS: LabelSettings = {
  stockId: 'roll_50x25',
  custom: { widthMm: 50, heightMm: 25, across: 1, gapMm: 2 },
  printer: '',
  silent: true,
  content: { shopName: true, itemName: true, price: true, mrp: true, code: true, date: false, qr: false, costCode: false, detail: false },
  copies: 1,
  costCodeWord: '',
  barHeightMm: 0,
};

const clampNum = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
};

/** Stored JSON → settings; missing or broken values fall back to the defaults. */
export function parseLabelSettings(raw: string | null | undefined): LabelSettings {
  const d = DEFAULT_LABEL_SETTINGS;
  let s: any = {};
  try {
    s = raw ? JSON.parse(raw) || {} : {};
  } catch {
    s = {};
  }
  const stockOk = s.stockId === CUSTOM_STOCK_ID || LABEL_STOCKS.some((x) => x.id === s.stockId);
  const c = s.custom || {};
  const content = { ...d.content };
  for (const k of Object.keys(content) as (keyof LabelContent)[]) if (typeof s.content?.[k] === 'boolean') content[k] = s.content[k];
  return {
    stockId: stockOk ? s.stockId : d.stockId,
    custom: {
      widthMm: clampNum(c.widthMm, 15, 120, d.custom.widthMm),
      heightMm: clampNum(c.heightMm, 10, 120, d.custom.heightMm),
      across: Math.round(clampNum(c.across, 1, 5, d.custom.across)),
      gapMm: clampNum(c.gapMm, 0, 10, d.custom.gapMm),
    },
    printer: typeof s.printer === 'string' ? s.printer : d.printer,
    silent: typeof s.silent === 'boolean' ? s.silent : d.silent,
    content,
    copies: Math.round(clampNum(s.copies, 1, 500, d.copies)),
    costCodeWord: typeof s.costCodeWord === 'string' ? s.costCodeWord.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 10) : d.costCodeWord,
    barHeightMm: +clampNum(s.barHeightMm, 3, 60, d.barHeightMm).toFixed(1),
  };
}

export function getLabelSettings(): LabelSettings {
  if (typeof window === 'undefined') return parseLabelSettings(null);
  try {
    return parseLabelSettings(localStorage.getItem(LABEL_SETTINGS_KEY));
  } catch {
    return parseLabelSettings(null);
  }
}

export function saveLabelSettings(next: LabelSettings) {
  try {
    localStorage.setItem(LABEL_SETTINGS_KEY, JSON.stringify(next));
  } catch {}
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(LABEL_SETTINGS_EVENT));
}

/** The label stock in use (a custom size is a roll). */
export function stockFor(settings: LabelSettings): LabelStock {
  if (settings.stockId === CUSTOM_STOCK_ID) {
    const c = settings.custom;
    return { id: CUSTOM_STOCK_ID, label: msg('Custom roll size'), kind: 'roll', widthMm: c.widthMm, heightMm: c.heightMm, across: c.across, gapMm: c.gapMm };
  }
  return LABEL_STOCKS.find((s) => s.id === settings.stockId) || LABEL_STOCKS[0];
}

/** Page the printer gets: one row of a roll, or an A4 sheet. */
export function labelPageMm(stock: LabelStock): { widthMm: number; heightMm: number } {
  if (stock.kind === 'sheet') return { widthMm: 210, heightMm: 297 };
  return { widthMm: +(stock.across * stock.widthMm + (stock.across - 1) * stock.gapMm).toFixed(2), heightMm: stock.heightMm };
}

const LAST_IMPORT_KEY = 'kamai_last_import_ids';

/** Items added or re-priced by the last Excel import — Barcode Studio offers labels for them. */
export function saveLastImportIds(ids: string[]) {
  try {
    localStorage.setItem(LAST_IMPORT_KEY, JSON.stringify(ids));
  } catch {}
}

export function getLastImportIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const v = JSON.parse(localStorage.getItem(LAST_IMPORT_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

const HANDOFF_KEY = 'kamai_label_handoff';

/** Items and label counts sent to Barcode Studio after stock came in (Purchases). */
export interface LabelHandoffItem {
  id: string;
  copies: number;
}

export function saveLabelHandoff(items: LabelHandoffItem[]) {
  try {
    localStorage.setItem(HANDOFF_KEY, JSON.stringify(items.filter((i) => i.id && i.copies > 0)));
  } catch {}
}

export function readLabelHandoff(): LabelHandoffItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const v = JSON.parse(localStorage.getItem(HANDOFF_KEY) || '[]');
    if (!Array.isArray(v)) return [];
    return v
      .filter((x) => x && typeof x.id === 'string' && Number(x.copies) > 0)
      .map((x) => ({ id: x.id, copies: Math.min(999, Math.max(1, Math.round(Number(x.copies)))) }));
  } catch {
    return [];
  }
}

export function clearLabelHandoff() {
  try {
    localStorage.removeItem(HANDOFF_KEY);
  } catch {}
}

/** Labels that fit on one page (a roll row, or a full A4 sheet). */
export const labelsPerPage = (stock: LabelStock) => stock.across * (stock.kind === 'sheet' ? stock.rows || 1 : 1);
