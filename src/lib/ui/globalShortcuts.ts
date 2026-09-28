import { msg } from '@/lib/i18n/core';

/*
 * App-wide keyboard shortcuts (AppShell) and the hints the status bar shows for them —
 * one list, so the bar never advertises a key that does nothing.
 *
 *   F1      New bill      from any page: Billing opens on a fresh bill (v4.78.0 — was
 *                         Shift+B on Home only). On Billing itself F1 is the counter's own
 *                         "new bill tab" key. Not while a window (form) is open.
 *   Ctrl+H  Home          from any page (also while typing), not while a window is open
 *   Ctrl+L  Lock screen   from any page (master password asked again)
 *
 * F-keys and Ctrl-keys type no text, so they also work with the cursor in a box.
 */

export type GlobalAction = 'home' | 'lock' | 'billing';

/** "/billing/" and "/billing" are the same page (a reload keeps the trailing slash). */
export const pagePath = (pathname: string) => (pathname || '/').replace(/\/+$/, '') || '/';

/** Where F1 goes: Billing, starting a fresh bill (see billing page `?new=1`). */
export const NEW_BILL_HREF = '/billing?new=1';

interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey?: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/**
 * The shortcut a key press means on this page (null = none). `windowOpen` = a form or
 * dialog is open on top of the page: leaving would lose what was typed in it.
 */
export function globalShortcutFor(e: KeyLike, rawPath: string, windowOpen = false): GlobalAction | null {
  const pathname = pagePath(rawPath);
  const key = (e.key || '').toLowerCase();
  const ctrl = e.ctrlKey || Boolean(e.metaKey);
  if (ctrl && !e.shiftKey && !e.altKey) {
    if (key === 'l') return 'lock';
    if (key === 'h') return pathname === '/' || windowOpen ? null : 'home';
    return null;
  }
  if (e.key === 'F1' && !ctrl && !e.altKey && !e.shiftKey) {
    return pathname === '/billing' || windowOpen ? null : 'billing';
  }
  return null;
}

/** Status-bar hints for the global keys on this page ([key, msg id]). Billing shows its own F1. */
export function globalShortcutHints(rawPath: string): [string, string][] {
  const pathname = pagePath(rawPath);
  const hints: [string, string][] = [];
  if (pathname !== '/billing') hints.push(['F1', msg('New bill')]);
  if (pathname !== '/') hints.push(['Ctrl+H', msg('Home')]);
  hints.push(['Ctrl+L', msg('Lock')]);
  return hints;
}
