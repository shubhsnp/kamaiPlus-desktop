import type { AdminControl } from '@/lib/desktop/desktopBridge';
import { compareVersions } from '@/lib/whatsNew/changelog';
import { ADMIN_FEATURES_KEY, FEATURE_SWITCHES_EVENT } from '@/lib/features/featureSwitches';

/*
 * The Admin Console's remote control, page side (v4.105.0). The main process keeps the control
 * from the last check-in (adminLink.js) and hands it here; AdminControlHost applies it:
 *   - features forced on / off → kept in localStorage (ADMIN_FEATURES_KEY), read by
 *     readFeatureSwitches on top of the shop's own switches;
 *   - mode 'locked' → the whole app is covered (data untouched); 'read_only' → no new bills;
 *   - min_version newer than this app → "Update required" until the update is installed.
 * Pure helpers here; no database.
 */

export const NORMAL_CONTROL: AdminControl = { mode: 'normal' };

/** This app is older than the Admin's minimum version. */
export function needsUpdate(appVersion: string | undefined, minVersion: string | undefined): boolean {
  if (!appVersion || !minVersion) return false;
  return compareVersions(appVersion, minVersion) < 0;
}

/** What covers the app now: the lock first, then the update; null = nothing. */
export function adminBlock(control: AdminControl | null | undefined): 'locked' | 'update' | null {
  if (!control) return null;
  if (control.mode === 'locked') return 'locked';
  if (needsUpdate(control.appVersion, control.min_version)) return 'update';
  return null;
}

/** Read-only covers only the billing counter (no new bills); everything else stays open. */
export function blocksBilling(control: AdminControl | null | undefined, pathname: string): boolean {
  return Boolean(control && control.mode === 'read_only' && /^\/billing(\/|$)/.test(pathname || ''));
}

/** The forced features as they are kept (unknown / non-boolean entries dropped). */
export function cleanFeatureOverrides(features: Record<string, unknown> | undefined): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(features || {})) if (/^[a-z][a-z_]{1,39}$/.test(k) && typeof v === 'boolean') out[k] = v;
  return out;
}

/** Saves the forced features for readFeatureSwitches; screens re-read them at once. */
export function applyFeatureOverrides(features: Record<string, unknown> | undefined): void {
  if (typeof window === 'undefined') return;
  const next = JSON.stringify(cleanFeatureOverrides(features));
  try {
    if (localStorage.getItem(ADMIN_FEATURES_KEY) === next) return;
    localStorage.setItem(ADMIN_FEATURES_KEY, next);
  } catch {
    return;
  }
  window.dispatchEvent(new Event(FEATURE_SWITCHES_EVENT));
}

/** Is a bill being made? Any open bill tab with items (localStorage `kamai_pos_tabs`). */
export function counterHasOpenBill(rawTabs: string | null): boolean {
  if (!rawTabs) return false;
  try {
    const parsed = JSON.parse(rawTabs);
    const tabs = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.tabs) ? parsed.tabs : [];
    return tabs.some((t: { cart?: unknown[] }) => Array.isArray(t?.cart) && t.cart.length > 0);
  } catch {
    return false;
  }
}
