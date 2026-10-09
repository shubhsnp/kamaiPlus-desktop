import { db as localDb } from '@/lib/db';
import { Business, Product, Category } from '@/types';
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
    const { getFirestoreDb } = await import('@/lib/firebase/config');
    const { doc, getDoc } = await import('firebase/firestore');

    const firestore = getFirestoreDb();
    if (!firestore) return null;

    const { uid, phone } = identifiers;
    const cleanPhone = phone ? phone.replace(/\D/g, '').slice(-10) : '';

    // 1. Search by UID in 'merchants' collection
    if (uid) {
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

      // Also check 'businesses' collection
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
              email: d.email || '',
            };
          }
        }
      } catch (bizErr) {
        console.warn('Lookup by bizId error:', bizErr);
      }
    }

    // 2. Search by Phone in 'merchants' collection (wa_<phone>, user_<phone>)
    if (cleanPhone && cleanPhone.length === 10) {
      for (const prefix of [`wa_${cleanPhone}`, `user_${cleanPhone}`]) {
        try {
          const phoneSnap = await getDoc(doc(firestore, 'merchants', prefix));
          if (phoneSnap.exists()) {
            const d = phoneSnap.data();
            const name = d.business_name || d.shop_name;
            if (name) {
              return {
                businessId: d.business_id || `biz_${prefix}`,
                businessName: String(name),
                ownerName: d.owner_name || 'Store Owner',
                phone: cleanPhone,
                businessType: d.business_type || 'retail',
                upiId: d.upi_vpa || d.upi_id || '',
                email: d.email || '',
              };
            }
          }
        } catch (phoneErr) {
          console.warn(`Lookup by ${prefix} error:`, phoneErr);
        }
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
  saveVerticalProfile(isVerticalId(store.businessType) ? store.businessType : 'retail', false);
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

  // 4. Pull live products and categories from Cloud Firestore if available
  try {
    const [{ getFirestoreDb }, { collection, getDocs }, { fromCloud }] = await Promise.all([
      import('@/lib/firebase/config'),
      import('firebase/firestore'),
      import('@/lib/cloud/cloudContract'),
    ]);

    const firestore = getFirestoreDb();
    if (firestore) {
      // Pull products
      const prodSnap = await getDocs(collection(firestore, `businesses/${businessId}/products`));
      if (!prodSnap.empty) {
        const cloudProducts: Product[] = [];
        prodSnap.forEach((d) => {
          cloudProducts.push(fromCloud('products', { ...d.data(), id: d.id }, null, { bizId: businessId }) as Product);
        });
        if (cloudProducts.length > 0) {
          await localDb.products.bulkPut(cloudProducts);
        }
      }

      // Pull categories
      const catSnap = await getDocs(collection(firestore, `businesses/${businessId}/categories`));
      if (!catSnap.empty) {
        const cloudCats: Category[] = [];
        catSnap.forEach((d) => {
          cloudCats.push(fromCloud('categories', { ...d.data(), id: d.id }, null, { bizId: businessId }) as Category);
        });
        if (cloudCats.length > 0) {
          await localDb.categories.bulkPut(cloudCats);
        }
      }
    }
  } catch (pullErr) {
    console.warn('Cloud restore data sync note:', pullErr);
  }

  // 5. Navigate to Home
  router.replace('/');
}
