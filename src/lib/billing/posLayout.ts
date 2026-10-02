/**
 * Billing counter layout (v4.92.0, Customer Change — first client).
 *
 * A counter that only scans barcodes never uses the product grid; it wants the bill big. So:
 * - the line between the product list and the bill can be dragged (the bill's share of the
 *   width is remembered on this PC), double-click puts it back;
 * - "Scan mode" hides the product list while the search box is empty (the scan box stays,
 *   typing a name shows the matches again) and gives the bill its own, wider share.
 * Never opened before = exactly the old 7 : 5 counter.
 */

import { looksLikeBarcode } from './scanInput';

export const POS_LAYOUT_KEY = 'kamai_pos_layout';

/** The bill's share of the counter width: the old 5 of 12 columns. */
export const DEFAULT_BILL_SHARE = 5 / 12;
/** Scan mode starts with a wide bill. */
export const DEFAULT_SCAN_BILL_SHARE = 0.62;
export const MIN_BILL_SHARE = 0.32;
export const MAX_BILL_SHARE = 0.68;
/** Arrow keys on the divider move it this much. */
export const BILL_SHARE_STEP = 0.02;

export interface PosLayout {
  scanMode: boolean;
  /** Bill share with the product list showing. */
  billShare: number;
  /** Bill share in scan mode. */
  scanBillShare: number;
}

export const DEFAULT_POS_LAYOUT: PosLayout = {
  scanMode: false,
  billShare: DEFAULT_BILL_SHARE,
  scanBillShare: DEFAULT_SCAN_BILL_SHARE,
};

export function clampBillShare(share: number, fallback = DEFAULT_BILL_SHARE): number {
  const n = Number(share);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_BILL_SHARE, Math.max(MIN_BILL_SHARE, n));
}

/** A stored value, however broken, becomes a usable layout. */
export function parsePosLayout(raw: string | null | undefined): PosLayout {
  try {
    const v = raw ? JSON.parse(raw) : null;
    if (!v || typeof v !== 'object') return { ...DEFAULT_POS_LAYOUT };
    return {
      scanMode: v.scanMode === true,
      billShare: clampBillShare(v.billShare ?? DEFAULT_BILL_SHARE, DEFAULT_BILL_SHARE),
      scanBillShare: clampBillShare(v.scanBillShare ?? DEFAULT_SCAN_BILL_SHARE, DEFAULT_SCAN_BILL_SHARE),
    };
  } catch {
    return { ...DEFAULT_POS_LAYOUT };
  }
}

export function loadPosLayout(): PosLayout {
  try {
    return parsePosLayout(localStorage.getItem(POS_LAYOUT_KEY));
  } catch {
    return { ...DEFAULT_POS_LAYOUT };
  }
}

export function savePosLayout(layout: PosLayout): void {
  try {
    localStorage.setItem(POS_LAYOUT_KEY, JSON.stringify(layout));
  } catch {}
}

/** The share in force for the mode the counter is in. */
export function activeBillShare(layout: PosLayout): number {
  return layout.scanMode ? layout.scanBillShare : layout.billShare;
}

/** The same layout with the share of the current mode changed (clamped). */
export function withBillShare(layout: PosLayout, share: number): PosLayout {
  const fallback = layout.scanMode ? DEFAULT_SCAN_BILL_SHARE : DEFAULT_BILL_SHARE;
  const next = clampBillShare(share, fallback);
  return layout.scanMode ? { ...layout, scanBillShare: next } : { ...layout, billShare: next };
}

/** Double-click on the divider: the current mode's share goes back to its default. */
export function resetBillShare(layout: PosLayout): PosLayout {
  return withBillShare(layout, layout.scanMode ? DEFAULT_SCAN_BILL_SHARE : DEFAULT_BILL_SHARE);
}

/** Pointer at `x` over a counter from `left` to `left + width` → the bill's share (bill on the right). */
export function billShareFromPointer(left: number, width: number, x: number): number {
  if (!(width > 0)) return DEFAULT_BILL_SHARE;
  // 0.1 % steps: a drag never stores a long float.
  return clampBillShare(Math.round(((left + width - x) / width) * 1000) / 1000);
}

/**
 * Scan mode hides the product list while nothing is typed and while the box holds a code the
 * gun is typing (digits, or a code like SKU-00123) — so the list never flashes up mid-scan. A
 * typed name shows its matches. Enter still adds by code either way (it reads the data, not
 * the screen).
 */
export function showProductList(layout: Pick<PosLayout, 'scanMode'>, searchText: string): boolean {
  if (!layout.scanMode) return true;
  const t = searchText.trim();
  if (!t || /^\d+$/.test(t) || looksLikeBarcode(t)) return false;
  return true;
}
