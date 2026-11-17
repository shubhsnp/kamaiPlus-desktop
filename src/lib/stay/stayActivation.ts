/**
 * DEV ONLY - production activation requires Admin Console backend.
 *
 * Controls whether the Stay (Hotel/Hospitality) module is visible
 * in this KamaiPlus Desktop App instance.  In production the flag
 * will be driven by a backend entitlement; this file exists only to
 * allow local development and QA without that backend.
 */

import { useState, useEffect } from 'react';

/** localStorage key used to persist the dev-toggle across page reloads. */
const STAY_LS_KEY = 'kamai_stay_dev_enabled';

/**
 * Compile-time constant.  Set to `true` to enable the Stay module for
 * every dev-build session automatically, without touching localStorage.
 *
 * @dev
 */
export const STAY_DEV_ENABLED = true;

/**
 * Returns `true` when the Stay module should be rendered.
 *
 * Priority:
 *  1. `STAY_DEV_ENABLED` compile-time constant (always wins in dev builds)
 *  2. localStorage flag `kamai_stay_dev_enabled` for runtime toggling
 *
 * DEV ONLY – production activation requires Admin Console backend.
 */
export function isStayEnabled(): boolean {
  if (STAY_DEV_ENABLED) return true;

  if (typeof window === 'undefined') return false;

  try {
    return localStorage.getItem(STAY_LS_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * React hook that tracks the Stay enabled state and re-renders when it
 * changes (via `setStayDevEnabled`).
 *
 * DEV ONLY – production activation requires Admin Console backend.
 */
export function useStayEnabled(): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => isStayEnabled());

  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key === STAY_LS_KEY) {
        setEnabled(isStayEnabled());
      }
    };

    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return enabled;
}

/**
 * Programmatically enable or disable the Stay module for the current
 * browser/Electron session.  Triggers a `storage` event so that
 * `useStayEnabled` hooks in other components update immediately.
 *
 * DEV ONLY – production activation requires Admin Console backend.
 *
 * @param on - `true` to enable, `false` to disable.
 */
export function setStayDevEnabled(on: boolean): void {
  if (typeof window === 'undefined') return;

  try {
    if (on) {
      localStorage.setItem(STAY_LS_KEY, 'true');
    } else {
      localStorage.removeItem(STAY_LS_KEY);
    }

    // Manually fire a storage event so hooks in the same window update.
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: STAY_LS_KEY,
        newValue: on ? 'true' : null,
        storageArea: localStorage,
      })
    );
  } catch {
    // localStorage not available (SSR, sandboxed iframe, etc.) – no-op.
  }
}
