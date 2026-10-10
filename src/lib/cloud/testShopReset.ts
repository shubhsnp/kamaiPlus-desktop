import { getCloudAccount } from '@/lib/cloud/cloudAccount';
import { getDesktopApi } from '@/lib/desktop/desktopBridge';
import { tr } from '@/lib/i18n/core';

/*
 * "Reset test shop" (v4.142.0, Rahul 2026-10-10) — only for the team's own TEST Google accounts.
 * The `resetTestShop` Cloud Function (KamaiPlus Android functions/test_shop_core.js) checks the signed-in
 * email against admin_settings/test_accounts (no app can read that list) and erases this account's shop
 * from the cloud with NO tombstone, so the same Gmail signs up fresh. Then this PC is emptied the way a
 * new install is (the licence is kept) and the app starts again at setup. A real shop's account is
 * never on the list, so the card never shows for it.
 */

export const TEST_SHOP_URL = 'https://us-central1-kamaiplus.cloudfunctions.net/resetTestShop';

export type TestShopAnswer = { ok: true; body: any } | { ok: false; error: string };

/** The signed-in Firebase user's ID token, only when it is this shop's Google account. */
async function idTokenForShop(): Promise<string | null> {
  const account = getCloudAccount();
  if (!account || account.stub) return null;
  try {
    const { getFirebaseAuth } = await import('@/lib/firebase/config');
    const auth = getFirebaseAuth();
    if (!auth) return null;
    await auth.authStateReady();
    if (!auth.currentUser || auth.currentUser.uid !== account.uid) return null;
    return await auth.currentUser.getIdToken();
  } catch {
    return null;
  }
}

export async function callTestShop(action: 'status' | 'reset', fetchImpl: typeof fetch = fetch): Promise<TestShopAnswer> {
  const token = await idTokenForShop();
  if (!token) return { ok: false, error: 'signed_out' };
  try {
    const res = await fetchImpl(TEST_SHOP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: String(body?.code || body?.error || res.status) };
    return { ok: true, body };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || 'network') };
  }
}

/** True only when the server says this shop's Google account is a test account. Offline / error = false. */
export async function isTestShopAccount(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  const r = await callTestShop('status');
  return r.ok && r.body?.test === true;
}

export function testShopResetMessage(error: string): string {
  if (error === 'signed_out') return tr('Sign in with the Google account again (Backup & Restore), then try again.');
  if (error === 'not_test_account') return tr('This Google account is not a test account.');
  if (/network|fetch|Failed/i.test(error)) return tr('No internet connection. Connect to the internet and try again.');
  return tr('Could not reset the test shop ({code}). Please try again.', { code: error });
}

/** Cloud first; only when that worked, this PC is emptied and the app starts again. */
export async function resetTestShop(): Promise<{ ok: true } | { ok: false; error: string }> {
  const cloud = await callTestShop('reset');
  if (!cloud.ok) return { ok: false, error: testShopResetMessage(cloud.error) };
  // A backup file in Documents\KamaiPlus first (the wipe never touches it) — best effort.
  try {
    const { runAutoBackup } = await import('@/lib/backup/autoBackup');
    await runAutoBackup({ force: true });
  } catch {}
  const api = getDesktopApi();
  if (api?.resetTestShopDevice) {
    await api.resetTestShopDevice();
    return { ok: true };
  }
  // Browser preview (no Electron): empty what the page can reach.
  const { purgeLocalDeviceData } = await import('@/lib/auth');
  await purgeLocalDeviceData();
  window.location.href = '/onboarding';
  return { ok: true };
}
