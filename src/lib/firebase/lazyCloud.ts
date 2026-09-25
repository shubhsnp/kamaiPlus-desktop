/**
 * Lazy bridge to the cloud (Firestore + Analytics).
 *
 * The Firebase SDK is ~650 KB of JavaScript. KamaiPlus is offline-first: a bill
 * is complete the moment it is written to Dexie, and every cloud write here is a
 * mirror of data that is already saved locally. Importing the SDK statically
 * therefore only did one thing — make the counter screen slower to open.
 *
 * Every helper below loads Firebase on first use and never throws: if the shop
 * is offline, or the SDK fails to load, billing carries on exactly as before.
 */

import { CLOUD_SYNC_ENABLED } from './cloudAvailability';

/** Mirrors one document to Firestore (merge write). Silently no-ops when offline. */
export async function cloudMerge(path: string, data: Record<string, any>): Promise<void> {
  if (!CLOUD_SYNC_ENABLED) return;
  try {
    const [{ getFirestoreDb }, { doc, setDoc }, { sanitizeForFirestore }] = await Promise.all([
      import('@/lib/firebase/config'),
      import('firebase/firestore'),
      import('@/lib/firebase/firestoreSync'),
    ]);
    const firestore = getFirestoreDb();
    if (!firestore) return;
    await setDoc(doc(firestore, path), sanitizeForFirestore(data), { merge: true });
  } catch {
    // Non-blocking: the local Dexie copy is the source of truth.
  }
}

/** Queues the debounced full backup sync for a business. */
export async function cloudSyncSoon(businessId: string): Promise<void> {
  if (!CLOUD_SYNC_ENABLED || !businessId || businessId === 'biz_default') return;
  try {
    const { triggerBackgroundSync } = await import('@/lib/firebase/backgroundSync');
    await triggerBackgroundSync(businessId);
  } catch {
    // Offline or sync disabled — nothing to do.
  }
}

/** Reports a completed invoice to platform analytics. */
export async function cloudTrackInvoice(payload: {
  invoiceNumber: string;
  totalAmountPaise: number;
  paymentMode: string;
  itemCount: number;
  businessId: string;
  isGstBill: boolean;
}): Promise<void> {
  try {
    const { PlatformAnalytics } = await import('@/lib/firebase/analytics');
    PlatformAnalytics.invoiceCreated(payload as any);
  } catch {
    // Analytics is never allowed to affect billing.
  }
}

let warmed = false;

/**
 * Pulls the Firebase chunk in while the cashier is still looking at the product
 * grid, so the first sale of the day does not pay for the download.
 */
export function prewarmCloud(): void {
  if (!CLOUD_SYNC_ENABLED || warmed || typeof window === 'undefined') return;
  warmed = true;
  const load = () => {
    void import('@/lib/firebase/config');
    void import('firebase/firestore');
  };
  const ric = (window as any).requestIdleCallback as
    | ((cb: () => void, opts?: { timeout: number }) => number)
    | undefined;
  if (ric) ric(load, { timeout: 4000 });
  else window.setTimeout(load, 2000);
}
