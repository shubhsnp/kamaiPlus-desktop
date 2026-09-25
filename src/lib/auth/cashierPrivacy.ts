'use client';

const PIN_STORAGE_KEY = 'kamai_cashier_owner_pin';
const PRIVACY_MODE_KEY = 'kamai_cashier_privacy_locked';

/*
 * There is no default PIN. A built-in "1234" (printed on the PIN screen) let any
 * staff member see profit and cost prices. The owner now sets the PIN — and can
 * reset it — with the master password (OwnerPinSetup).
 */

/** The owner's PIN, or '' when none has been set yet. */
export function getOwnerCashierPin(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(PIN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function hasOwnerPin(): boolean {
  return getOwnerCashierPin().length === 4;
}

/**
 * Sets a new 4-digit Owner PIN
 */
export function setOwnerCashierPin(newPin: string): boolean {
  if (!newPin || newPin.length !== 4 || isNaN(Number(newPin))) return false;
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(PIN_STORAGE_KEY, newPin);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if sensitive profit & purchase prices are currently locked/hidden
 */
export function isProfitHidden(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(PRIVACY_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Sets privacy lock state
 */
export function setProfitHidden(hidden: boolean) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PRIVACY_MODE_KEY, hidden ? 'true' : 'false');
    window.dispatchEvent(new Event('privacy_mode_changed'));
  } catch {}
}

/**
 * Verifies entered PIN against Owner PIN
 */
export function verifyOwnerPin(enteredPin: string): boolean {
  const currentPin = getOwnerCashierPin();
  return currentPin.length === 4 && enteredPin.trim() === currentPin;
}
