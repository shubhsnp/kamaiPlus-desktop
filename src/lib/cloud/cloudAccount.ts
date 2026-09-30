import { getDesktopApi } from '@/lib/desktop/desktopBridge';
import { tr } from '@/lib/i18n/core';

/**
 * The Google account this shop's cloud belongs to (v4.84.0, Step 2 — tracker §3b).
 *
 * Rahul's rule: the desktop app signs in with Google the very first time (before the
 * master password is set); after that the master password opens it every day. The
 * account is the same one the Android app uses, so the shop's cloud is
 * `businesses/biz_<uid>` (cloud data contract R1). This computer's own business id is
 * NOT changed — the contract maps it to `bizId` on the way out. Cloud sync itself stays
 * off (CLOUD_SYNC_ENABLED) until Step 3.
 *
 * Firebase is loaded only when the owner connects (dynamic import — §8 performance).
 */

export interface CloudAccount {
  uid: string;
  email: string | null;
  name: string | null;
  photoURL: string | null;
  /** `biz_<uid>` — this shop's document in Firestore. */
  bizId: string;
  linkedAt: string;
  /** Only the Electron E2E (no real Google). */
  stub?: boolean;
}

export const CLOUD_ACCOUNT_KEY = 'kamai_cloud_account';
export const CLOUD_ACCOUNT_EVENT = 'cloud_account_changed';

export const cloudBizId = (uid: string) => `biz_${uid}`;

export function parseCloudAccount(raw: string | null): CloudAccount | null {
  if (!raw) return null;
  try {
    const a = JSON.parse(raw);
    if (!a || typeof a.uid !== 'string' || !a.uid || a.bizId !== cloudBizId(a.uid)) return null;
    return a as CloudAccount;
  } catch {
    return null;
  }
}

export function getCloudAccount(): CloudAccount | null {
  try {
    return parseCloudAccount(localStorage.getItem(CLOUD_ACCOUNT_KEY));
  } catch {
    return null;
  }
}

function saveCloudAccount(account: CloudAccount): void {
  try {
    localStorage.setItem(CLOUD_ACCOUNT_KEY, JSON.stringify(account));
  } catch {}
  window.dispatchEvent(new Event(CLOUD_ACCOUNT_EVENT));
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_DESKTOP_CLIENT_ID || '';
const CLIENT_SECRET = process.env.NEXT_PUBLIC_GOOGLE_DESKTOP_CLIENT_SECRET || '';

/** Why Google sign-in did not finish, in the shop's words. */
export function googleSignInMessage(code: string): string {
  if (code === 'timeout') return tr('Google sign-in was not finished in time. Please try again.');
  if (code === 'access_denied') return tr('Google sign-in was cancelled.');
  if (code === 'not_configured') return tr('Google sign-in is not set up in this build of the app. Please contact KamaiPlus support.');
  if (code === 'desktop_only') return tr('Google sign-in works in the installed KamaiPlus Desktop app.');
  if (/network|fetch|ENOTFOUND|ECONN|internet/i.test(code)) return tr('No internet connection. Connect to the internet and try again.');
  return tr('Could not sign in with Google ({code}). Please try again.', { code });
}

/**
 * Opens Google sign-in in the browser, then signs in to Firebase with the answer.
 * The account is saved on this computer only when both worked.
 */
export async function connectGoogleAccount(): Promise<{ ok: true; account: CloudAccount } | { ok: false; error: string }> {
  const api = getDesktopApi();
  if (!api) return { ok: false, error: googleSignInMessage('desktop_only') };
  if (!CLIENT_ID || !CLIENT_SECRET) return { ok: false, error: googleSignInMessage('not_configured') };

  const res = await api.googleSignIn({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET }).catch((e) => ({ ok: false as const, error: String(e?.message || e) }));
  if (!res.ok) return { ok: false, error: googleSignInMessage(res.error) };

  let uid: string;
  let email = res.email;
  let name = res.name;
  let photoURL = res.picture;
  if (res.stub) {
    uid = 'e2e_stub_uid';
  } else {
    try {
      const [{ getFirebaseAuth }, { GoogleAuthProvider, signInWithCredential }] = await Promise.all([
        import('@/lib/firebase/config'),
        import('firebase/auth'),
      ]);
      const auth = getFirebaseAuth();
      if (!auth) return { ok: false, error: googleSignInMessage('not_configured') };
      const cred = await signInWithCredential(auth, GoogleAuthProvider.credential(res.idToken));
      uid = cred.user.uid;
      email = cred.user.email || email;
      name = cred.user.displayName || name;
      photoURL = cred.user.photoURL || photoURL;
    } catch (e: any) {
      return { ok: false, error: googleSignInMessage(String(e?.code || e?.message || 'firebase')) };
    }
  }

  const account: CloudAccount = { uid, email, name, photoURL, bizId: cloudBizId(uid), linkedAt: new Date().toISOString(), ...(res.stub ? { stub: true } : {}) };
  saveCloudAccount(account);
  return { ok: true, account };
}
