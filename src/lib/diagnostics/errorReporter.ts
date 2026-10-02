import { getDesktopApi } from '@/lib/desktop/desktopBridge';

/**
 * Sends page errors to the desktop error log (errorlog.js in the main process).
 * The same message is logged at most once every 10 seconds so a render loop
 * cannot flood the file. Never throws.
 */
const recent = new Map<string, number>();

export function reportError(source: string, error: unknown, detail?: string): void {
  try {
    const api = getDesktopApi();
    if (!api) return;
    const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error));
    const key = `${source}|${err.message}`;
    const now = Date.now();
    if ((recent.get(key) || 0) > now - 10000) return;
    recent.set(key, now);
    void api.logError({ source, message: err.message || 'Unknown error', stack: err.stack, detail }).catch(() => {});
  } catch {}
}

/** A rejection from Firebase Analytics / Installations (codes "installations/…", "analytics/…"). */
export function isAnalyticsNetworkNoise(reason: unknown): boolean {
  const code = reason && typeof reason === 'object' && 'code' in reason ? String((reason as { code?: unknown }).code || '') : '';
  return /^(installations|analytics)\//.test(code);
}

let installed = false;

/** Hooks window.onerror and unhandled promise rejections once per page load. */
export function installGlobalErrorReporting(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (e) => {
    reportError('window', e.error || e.message, e.filename ? `${e.filename}:${e.lineno}` : undefined);
  });
  window.addEventListener('unhandledrejection', (e) => {
    // v4.93.0: Firebase Analytics' own background calls (installation id, config) reject when the
    // internet drops — network noise from an optional add-on, not a fault in the shop's app.
    if (isAnalyticsNetworkNoise(e.reason)) {
      e.preventDefault();
      return;
    }
    reportError('promise', e.reason);
  });
}
