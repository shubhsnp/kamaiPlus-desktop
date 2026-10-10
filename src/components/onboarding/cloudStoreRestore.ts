import { db as localDb } from '@/lib/db';
import { Business } from '@/types';
import { setStoredUser, AuthUser } from '@/lib/auth';
import { getLanguage } from '@/lib/i18n/core';
import { markWhatsNewSeen } from '@/lib/whatsNew/changelog';
import { APP_VERSION } from '@/lib/constants/version';
import { FEATURE_SWITCHES_KEY, FEATURE_SWITCHES_EVENT } from '@/lib/features/featureSwitches';
import { isVerticalId, saveVerticalProfile } from '@/lib/business/verticalProfile';

export interface DetectedCloudStore {
  businessId: string;
  businessName: string;
  ownerName: string;
  phone: string;
  businessType: string;
  upiId?: string;
  /** The shop's GSTIN in the cloud (v4.134.0) — a GST shop stays a GST shop after the restore. */
  gstin?: string;
  address?: string;
  email?: string;
  productCount?: number;
}

/**
 * Searches Cloud Firestore for an existing store linked to the given UID or mobile number.
 * Uses dynamic imports to keep Firebase bundle isolated from standard load.
 */
export async function findCloudStore(identifiers: {
  uid?: string | null;
  phone?: string | null;
}): Promise<DetectedCloudStore | null> {
  try {
    const { getCloudAccount } = await import('@/lib/cloud/cloudAccount');
    const account = getCloudAccount();
    if (!account || account.stub) return null;
    const { getFirestoreDb, getFirebaseAuth } = await import('@/lib/firebase/config');
    const { doc, getDoc } = await import('firebase/firestore');

    const firestore = getFirestoreDb();
    if (!firestore) return null;
    // v4.134.0: wait until the saved Google session is back (a page load restores it from IndexedDB a
    // moment later). Asking before that went out signed-out → "Missing or insufficient permissions",
    // so a PC joining the phone's account never found the phone's shop.
    const auth = getFirebaseAuth();
    if (auth) {
      await auth.authStateReady();
      if (auth.currentUser?.uid !== account.uid) return null;
    }

    // v4.124.0 (AU-05 / AU-18): the shop's cloud documents can only be read by the Google account that
    // owns them (Firestore rules). Without a connected Google account every lookup was refused — five
    // failed reads (and log warnings) per new shop, by uid and by mobile number. Now: only the signed-in
    // Google account's own shop is looked up; the mobile number is no longer used.
    const uid = account.uid;
    const cleanPhone = (identifiers.phone || '').replace(/\D/g, '').slice(-10);

    if (uid) {
      // v4.134.0: the shop's own doc first — it carries business_type ("grocery"). merchants/<uid> (the
      // phone's admin copy) has none, so the restored PC became "retail" and lost the kirana features.
      try {
        const bSnap = await getDoc(doc(firestore, 'businesses', `biz_${uid}`));
        if (bSnap.exists()) {
          const d = bSnap.data();
          const name = d.name || d.business_name;
          if (name) {
            return {
              businessId: `biz_${uid}`,
              businessName: String(name),
              ownerName: d.owner_name || 'Store Owner',
              phone: d.phone || cleanPhone || '',
              businessType: d.business_type || 'retail',
              upiId: d.upi_id || d.upi_vpa || '',
              gstin: typeof d.gstin === 'string' ? d.gstin.trim().toUpperCase() : '',
              email: d.email || '',
            };
          }
        }
      } catch (bizErr) {
        console.warn('Lookup by bizId error:', bizErr);
      }

      // Fallback: the merchants copy (older phone builds)
      try {
        const mSnap = await getDoc(doc(firestore, 'merchants', uid));
        if (mSnap.exists()) {
          const d = mSnap.data();
          const name = d.business_name || d.shop_name;
          if (name) {
            return {
              businessId: d.business_id || `biz_${uid}`,
              businessName: String(name),
              ownerName: d.owner_name || 'Store Owner',
              phone: d.phone || cleanPhone || '',
              businessType: d.business_type || 'retail',
              upiId: d.upi_vpa || d.upi_id || '',
              email: d.email || '',
            };
          }
        }
      } catch (uidErr) {
        console.warn('Lookup by uid error:', uidErr);
      }
    }

    return null;
  } catch (err) {
    console.warn('Cloud store lookup failed:', err);
    return null;
  }
}

/**
 * Restores an existing Cloud Store to this computer's local SQLite/Dexie database,
 * seeds/pulls existing catalogue if available, sets session, and opens dashboard.
 */
export async function restoreCloudStoreToLocal(
  store: DetectedCloudStore,
  router: { replace: (url: string) => void }
): Promise<void> {
  const now = new Date().toISOString();
  const businessId = store.businessId;

  // 1. Prepare schema-compliant Business entity
  const businessRecord: Business = {
    id: businessId,
    name: store.businessName,
    business_type: store.businessType,
    owner_name: store.ownerName,
    phone: store.phone,
    address: store.address || '',
    upi_id: store.upiId || undefined,
    gstin: store.gstin || undefined,
    email: store.email || undefined,
    currency: 'INR',
    language: getLanguage(),
    invoice_prefix: 'INV-',
    next_invoice_number: 1,
    terms_conditions: 'Thank you for your business! Goods once sold can be exchanged within 7 days.',
    footer_message: 'Thank you for shopping with us! Please visit again.',
    is_onboarded: true,
    sync_status: 'synced',
    created_at: now,
    updated_at: now,
  };

  if (!localDb.isOpen()) {
    await localDb.open();
  }

  // A safety copy of whatever this PC holds, then clear it for the restored shop (v4.124.0).
  try {
    const { runAutoBackup } = await import('@/lib/backup/autoBackup');
    await runAutoBackup({ force: true });
  } catch {}
  // Clear stale data tables before restoring clean shop
  await Promise.all([
    localDb.businesses.clear().catch(() => {}),
    localDb.products.clear().catch(() => {}),
    localDb.categories.clear().catch(() => {}),
    localDb.sales.clear().catch(() => {}),
    localDb.customers.clear().catch(() => {}),
    localDb.cash_registers.clear().catch(() => {}),
  ]);

  await localDb.businesses.put(businessRecord);

  // 2. The app follows the shop's category (v4.118.0, same as store setup — lib/business/verticalProfile.ts)
  try {
    localStorage.removeItem(FEATURE_SWITCHES_KEY);
  } catch {}
  saveVerticalProfile(isVerticalId(store.businessType) ? store.businessType : 'retail', Boolean(store.gstin));
  window.dispatchEvent(new Event(FEATURE_SWITCHES_EVENT));

  // 3. Set Authenticated User session in localStorage
  const rawUid = businessId.replace(/^biz_/, '');
  const authUser: AuthUser = {
    uid: rawUid,
    id: rawUid,
    phone: store.phone,
    email: store.email || null,
    name: store.ownerName,
    business_id: businessId,
    business_name: store.businessName,
    shop_name: store.businessName,
    role: 'admin',
  };
  markWhatsNewSeen(APP_VERSION);
  setStoredUser(authUser);

  // 4. v4.124.0 (AU-02): the whole shop comes back — products, categories, customers with their udhar,
  // bills, khata, suppliers… (cloudPull.pullEverything, the cloud data contract). Bill numbers then go
  // on after the restored bills instead of starting again at INV-001.
  try {
    const { pullEverything } = await import('@/lib/cloud/cloudPull');
    await pullEverything({ bizId: businessId, localBizId: businessId });
  } catch (pullErr) {
    console.warn('Cloud restore data sync note:', pullErr);
  }

  // 5. v4.134.0: this PC joined the phone's shop — sync both ways from now on (it stayed off until the
  // shop found Backup → Google Account, so a bill made here never reached the phone).
  try {
    const { setCloudSendOn } = await import('@/lib/cloud/cloudPush');
    setCloudSendOn(true);
  } catch {}

  // 6. Navigate to Home
  router.replace('/');
}
