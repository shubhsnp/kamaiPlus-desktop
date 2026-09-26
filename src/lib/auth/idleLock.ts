/*
 * Auto-lock when idle. After N minutes with no mouse / keyboard / scanner use the
 * app forgets the unlock (see masterPassword.ts) and shows the master-password
 * screen; after the password it returns to the page that was open. Open bills live
 * in localStorage (kamai_pos_tabs), so nothing on the counter is lost.
 *
 * The choice is per computer (localStorage). 0 = off.
 */

export const IDLE_LOCK_KEY = 'kamai_idle_lock_minutes';
export const IDLE_LOCK_OPTIONS = [0, 5, 10, 15, 30, 60] as const;
export const DEFAULT_IDLE_LOCK_MINUTES = 10;
export const IDLE_LOCK_CHANGED_EVENT = 'idle_lock_changed';

/** A stored value, or the default when nothing / something unexpected is stored. */
export function parseIdleLockMinutes(raw: string | null | undefined): number {
  if (raw === null || raw === undefined || raw === '') return DEFAULT_IDLE_LOCK_MINUTES;
  const n = Number(raw);
  return (IDLE_LOCK_OPTIONS as readonly number[]).includes(n) ? n : DEFAULT_IDLE_LOCK_MINUTES;
}

export function getIdleLockMinutes(): number {
  try {
    return parseIdleLockMinutes(localStorage.getItem(IDLE_LOCK_KEY));
  } catch {
    return DEFAULT_IDLE_LOCK_MINUTES;
  }
}

export function setIdleLockMinutes(minutes: number): void {
  try {
    localStorage.setItem(IDLE_LOCK_KEY, String(parseIdleLockMinutes(String(minutes))));
    window.dispatchEvent(new Event(IDLE_LOCK_CHANGED_EVENT));
  } catch {}
}

/** True when the app has been idle for the chosen time (0 = never). Also true after the PC slept. */
export function shouldIdleLock(lastActivityMs: number, nowMs: number, minutes: number): boolean {
  return minutes > 0 && nowMs - lastActivityMs >= minutes * 60_000;
}

/** Only a shop page of this app may be returned to after unlocking. */
export function safeReturnPath(path: string | null | undefined): string | null {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return null;
  if (/^\/(auth|onboarding|invoice|pay)(\/|\?|$)/.test(path)) return null;
  return path;
}
