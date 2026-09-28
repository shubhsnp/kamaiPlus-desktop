/*
 * The right-edge "Transactions" pull-tab can be dragged up or down (v4.78.0) and stays where
 * the shop put it on this computer. Its place is kept as a share of the window height
 * (0 = top, 1 = bottom) so it survives a different window size.
 */

export const DRAWER_TAB_KEY = 'kamai_drawer_tab_y';
export const DRAWER_TAB_DEFAULT = 0.5;
/** Movement (px) before a press on the tab counts as a drag and not a click. */
export const DRAG_THRESHOLD_PX = 6;

/** Top bar and status bar the tab must not cover (px). */
const TOP_GAP = 76;
const BOTTOM_GAP = 32;

/** Stored text → a share of the height (bad / missing → the middle). */
export function parseTabY(raw: string | null | undefined): number {
  const n = Number(raw);
  return raw !== null && raw !== undefined && raw !== '' && Number.isFinite(n) && n >= 0 && n <= 1 ? n : DRAWER_TAB_DEFAULT;
}

/** Centre of the tab in px for a share of the window, kept clear of the top bar and status bar. */
export function tabCenterPx(share: number, viewportH: number, tabH: number): number {
  const min = TOP_GAP + tabH / 2;
  const max = viewportH - BOTTOM_GAP - tabH / 2;
  if (max <= min) return viewportH / 2;
  return Math.min(max, Math.max(min, share * viewportH));
}

/** A dragged centre (px) back to a share of the window height, within the allowed band. */
export function shareFromCenter(centerPx: number, viewportH: number, tabH: number): number {
  if (viewportH <= 0) return DRAWER_TAB_DEFAULT;
  return Math.round((tabCenterPx(centerPx / viewportH, viewportH, tabH) / viewportH) * 1000) / 1000;
}
