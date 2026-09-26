/**
 * The desktop app's local master password. Stored only as a salted SHA-256
 * hash ("sha256$<salt>$<hash>"), never as the password itself. Installs that
 * saved the old plaintext value keep working and are upgraded to a hash on
 * their next successful unlock.
 */

import { safeReturnPath } from './idleLock';

const KEY = 'kamai_master_password';
const PREFIX = 'sha256$';

function toHex(buf: ArrayBuffer | Uint8Array): string {
  return Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function digest(salt: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  return toHex(await crypto.subtle.digest('SHA-256', data));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function hasMasterPassword(): boolean {
  try {
    return Boolean(localStorage.getItem(KEY));
  } catch {
    return false;
  }
}

/**
 * Forgot-password path: call only after the licence key of this computer has been
 * verified (kp:licence-verify-key). Removes the password; shop data is untouched and
 * the owner sets a new password straight away.
 */
export function clearMasterPasswordAfterRecovery(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

/*
 * Lock on launch. A successful unlock is remembered in sessionStorage only, which
 * Electron empties when the app closes — so every start asks for the password,
 * while moving between pages (or a crash reload) does not.
 */
const UNLOCK_KEY = 'kamai_unlocked';

export function markUnlocked(): void {
  try {
    sessionStorage.setItem(UNLOCK_KEY, '1');
  } catch {}
}

/** True while a master password exists and has not been entered since the app started. */
export function isAppLocked(): boolean {
  if (!hasMasterPassword()) return false;
  try {
    return sessionStorage.getItem(UNLOCK_KEY) !== '1';
  } catch {
    return true;
  }
}

/*
 * Lock now / auto-lock when idle: forget the unlock, remember the page, and let
 * AppShell (listening to auth_changed) show the password screen. The shop stays
 * signed in; after the password it goes back to that page.
 */
const RETURN_KEY = 'kamai_return_to';

export function lockApp(returnTo?: string): void {
  if (!hasMasterPassword()) return;
  try {
    sessionStorage.removeItem(UNLOCK_KEY);
    const path = safeReturnPath(returnTo);
    if (path) sessionStorage.setItem(RETURN_KEY, path);
    else sessionStorage.removeItem(RETURN_KEY);
  } catch {}
  window.dispatchEvent(new Event('auth_changed'));
}

/** Where to go after the password: the page open when the app locked, else home. */
export function unlockDestination(): string {
  try {
    return safeReturnPath(sessionStorage.getItem(RETURN_KEY)) || '/';
  } catch {
    return '/';
  }
}

export function clearUnlockDestination(): void {
  try {
    sessionStorage.removeItem(RETURN_KEY);
  } catch {}
}

export async function setMasterPassword(password: string): Promise<void> {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  localStorage.setItem(KEY, `${PREFIX}${salt}$${await digest(salt, password)}`);
}

export async function verifyMasterPassword(password: string): Promise<boolean> {
  const stored = localStorage.getItem(KEY) || '';
  if (!stored) return false;
  if (stored.startsWith(PREFIX)) {
    const [, salt, hash] = stored.split('$');
    return constantTimeEqual(await digest(salt || '', password), hash || '');
  }
  // Legacy plaintext value: accept once, then store it hashed.
  const ok = constantTimeEqual(stored, password);
  if (ok) await setMasterPassword(password);
  return ok;
}
