import { msg } from '@/lib/i18n/core';

/*
 * App-wide keyboard shortcuts (AppShell) and the hints the status bar shows for them —
 * one list, so the bar never advertises a key that does nothing.
 *
 *   Ctrl+H  Home          from any page (also while typing: Ctrl keys type no text)
 *   Ctrl+L  Lock screen   from any page (master password asked again)
 *   Shift+B Billing       on Home only, and not while typing (it types a "B")
 */

export type GlobalAction = 'home' | 'lock' | 'billing';

/** "/billing/" and "/billing" are the same page (a reload keeps the trailing slash). */
export const pagePath = (pathname: string) => (pathname || '/').replace(/\/+$/, '') || '/';

interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey?: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/** The shortcut a key press means on this page (null = none). `typing` = focus in a text box. */
export function globalShortcutFor(e: KeyLike, rawPath: string, typing: boolean): GlobalAction | null {
  const pathname = pagePath(rawPath);
  const key = (e.key || '').toLowerCase();
  const ctrl = e.ctrlKey || Boolean(e.metaKey);
  if (ctrl && !e.shiftKey && !e.altKey) {
    if (key === 'h') return pathname === '/' ? null : 'home';
    if (key === 'l') return 'lock';
    return null;
  }
  if (!ctrl && !e.altKey && e.shiftKey && key === 'b' && pathname === '/' && !typing) return 'billing';
  return null;
}

/** Status-bar hints for the global keys on this page ([key, msg id]). */
export function globalShortcutHints(rawPath: string): [string, string][] {
  const pathname = pagePath(rawPath);
  const hints: [string, string][] = [];
  if (pathname === '/') hints.push(['Shift+B', msg('Billing')]);
  else hints.push(['Ctrl+H', msg('Home')]);
  hints.push(['Ctrl+L', msg('Lock')]);
  return hints;
}
