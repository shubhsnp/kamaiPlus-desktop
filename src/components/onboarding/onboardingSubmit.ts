import React from 'react';
import { db as localDb, seedBusinessStarterData } from '@/lib/db';
import { Business } from '@/types';
import { getStoredUser, setStoredUser, AuthUser } from '@/lib/auth';
import { CLOUD_SYNC_ENABLED } from '@/lib/firebase/cloudAvailability';
import { getLanguage, tr } from '@/lib/i18n/core';
import { markWhatsNewSeen } from '@/lib/whatsNew/changelog';
import { APP_VERSION } from '@/lib/constants/version';
import { FEATURE_SWITCHES_KEY, FEATURE_SWITCHES_EVENT } from '@/lib/features/featureSwitches';
import { isVerticalId, restaurantGstFor, saveVerticalProfile } from '@/lib/business/verticalProfile';
import { validateGstin } from '@/lib/validation/validators';
import { loadRestaurantSettings, saveRestaurantSettings } from '@/lib/restaurant/settings';
import type { useRouter } from 'next/navigation';

/** v4.124.0 (AU-32): bill terms that fit the category (a table, never a branch — Suite 9). */
const BILL_TERMS: Record<string, string> = {
  restaurant: 'Thank you for dining with us! Prices include taxes as shown.',
};

export interface CreateOnboardingSubmitDeps {
  router: ReturnType<typeof useRouter>;
  currentUser: AuthUser | null;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string>>;
  businessName: string;
  ownerName: string;
  phone: string;
  upiId: string;
  businessType: string;
  seedStarterCatalog: boolean;
  /** Optional (v4.120.0): GST on bills and the GST screens only with one. */
  gstin?: string;
}

/**
 * Finishing shop setup (v4.104.0, K-D23 — moved out of app/onboarding/page.tsx unchanged): the form is
 * checked, the shop row and its defaults are saved, the signed-in user gets the shop id, and the app opens.
 */
export function createOnboardingSubmit(deps: CreateOnboardingSubmitDeps) {
  const {
    router, currentUser, setIsLoading, setError, businessName, ownerName,
    phone, upiId, businessType, seedStarterCatalog, gstin = '',
  } = deps;
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const cleanStoreName = businessName.trim();
    const cleanOwnerName = ownerName.trim() || 'Store Owner';
    const cleanUpiId = upiId.trim();

    if (!cleanStoreName) {
      setError(tr('Please enter your Store / Business Name.'));
      return;
    }

    if (!cleanPhone || cleanPhone.length !== 10) {
      setError(tr('Please enter a valid 10-digit Store Contact Number.'));
      return;
    }

    // UPI is optional (v4.91.0, Customer Change): a shop can add it later in Settings → UPI.
    // When typed, it must still be a real UPI ID — a wrong one would put a dead QR on every bill.
    const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
    if (cleanUpiId && !upiRegex.test(cleanUpiId)) {
      setError(tr('Please enter a valid UPI ID (e.g. yourname@upi, 9876543210@paytm, store@okaxis).'));
      return;
    }

    const cleanGstin = gstin.trim().toUpperCase();
    if (cleanGstin) {
      const gstinRes = validateGstin(cleanGstin, false);
      if (!gstinRes.isValid) {
        setError(gstinRes.error || tr('Invalid GSTIN structure.'));
        return;
      }
    }

    setIsLoading(true);

    try {
      const user = currentUser || getStoredUser();
      const rawUid = user?.uid || user?.id || `user_${cleanPhone}`;
      const safeUidSlice = rawUid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'merchant';
      const businessId = `biz_${safeUidSlice}_${Date.now()}`;
      const now = new Date().toISOString();

      // 1. Initialize Default Store Record in Local IndexedDB (Dexie)
      const newBusinessRecord: Business & { user_uid?: string; user_email?: string } = {
        id: businessId,
        name: cleanStoreName,
        business_type: businessType,
        owner_name: cleanOwnerName,
        phone: cleanPhone,
        upi_id: cleanUpiId || undefined,
        gstin: cleanGstin || undefined,
        email: user?.email || undefined,
        user_email: user?.email || undefined,
        user_uid: rawUid,
        address: '',
        currency: 'INR',
        language: getLanguage(),
        invoice_prefix: 'INV-',
        next_invoice_number: 1,
        // v4.124.0 (AU-32): a restaurant bill does not promise an exchange of goods.
        terms_conditions: BILL_TERMS[businessType] || 'Thank you for your business! Goods once sold can be exchanged within 7 days with bill receipt.',
        footer_message: 'Thank you for shopping with us! Please visit again.',
        is_onboarded: true,
        sync_status: 'synced',
        created_at: now,
        updated_at: now,
      };

      if (!localDb.isOpen()) {
        await localDb.open();
      }
      await Promise.all([
        localDb.businesses.clear().catch(() => {}),
        localDb.products.clear().catch(() => {}),
        localDb.sales.clear().catch(() => {}),
        localDb.customers.clear().catch(() => {}),
        localDb.categories.clear().catch(() => {}),
        localDb.inventory_movements.clear().catch(() => {}),
        localDb.suppliers.clear().catch(() => {}),
        localDb.cash_registers.clear().catch(() => {}),
        localDb.cash_expenses.clear().catch(() => {}),
        localDb.ledger_transactions.clear().catch(() => {}),
      ]);
      await localDb.businesses.put(newBusinessRecord);

      // Seed category-tailored starter catalog products
      if (seedStarterCatalog) {
        try {
          await seedBusinessStarterData(businessId, businessType);
        } catch (seedErr) {
          console.warn('Starter catalog seed warning:', seedErr);
        }
      }

      // v4.118.0: the app follows the chosen category (lib/business/verticalProfile.ts) — screens,
      // item fields, Restaurant mode; GST follows the GSTIN. Switches left by an earlier shop on this
      // computer would override the category, so they go.
      try {
        localStorage.removeItem(FEATURE_SWITCHES_KEY);
      } catch {}
      const vertical = isVerticalId(businessType) ? businessType : 'retail';
      saveVerticalProfile(vertical, Boolean(cleanGstin));
      // A restaurant's one GST %: 5 % with a GSTIN, none without (AU-12).
      if (vertical === 'restaurant') {
        const rs = loadRestaurantSettings();
        saveRestaurantSettings({ ...rs, gstRate: restaurantGstFor(Boolean(cleanGstin), rs.gstRate) });
      }
      window.dispatchEvent(new Event(FEATURE_SWITCHES_EVENT));

      // 2. Write Complete Merchant Document to Firestore `merchants/{uid}`.
      // Firebase (~650 KB) is pulled in here, at the one moment onboarding needs
      // it, rather than with the page — the shop is usable offline without it.
      const [{ getFirestoreDb }, { doc, setDoc, deleteDoc }, { sanitizeForFirestore }, { toCloud }] = CLOUD_SYNC_ENABLED
        ? await Promise.all([
            import('@/lib/firebase/config'),
            import('firebase/firestore'),
            import('@/lib/firebase/firestoreSync'),
            import('@/lib/cloud/cloudContract'),
          ])
        : [{ getFirestoreDb: () => null }, {} as any, {} as any, {} as any];
      // Skipped while the desktop app has no cloud login: the writes are rejected, and
      // awaiting them on a slow connection could stall first-time store setup.
      const firestore = CLOUD_SYNC_ENABLED ? getFirestoreDb() : null;
      if (firestore) {
        try {
          // Merchant Document
          const merchantDoc = {
            uid: rawUid,
            business_id: businessId,
            shop_name: cleanStoreName,
            business_name: cleanStoreName,
            owner_name: cleanOwnerName,
            phone: cleanPhone,
            email: user?.email || null,
            business_type: businessType,
            role: 'admin',
            createdAt: now,
            updatedAt: now,
          };
          await setDoc(doc(firestore, 'merchants', rawUid), sanitizeForFirestore(merchantDoc), { merge: true });

          // Cross-index with WhatsApp phone prefix so WhatsApp OTP login resolves immediately to this store
          if (cleanPhone && cleanPhone.length === 10) {
            await setDoc(doc(firestore, 'merchants', `wa_${cleanPhone}`), sanitizeForFirestore({
              ...merchantDoc,
              uid: `wa_${cleanPhone}`,
              linked_uid: rawUid,
            }), { merge: true });
            await setDoc(doc(firestore, 'merchants', `user_${cleanPhone}`), sanitizeForFirestore({
              ...merchantDoc,
              uid: `user_${cleanPhone}`,
              linked_uid: rawUid,
            }), { merge: true });
          }

          // Also write Business Document for full compatibility with email & phone bindings.
          // In the cloud data contract's names; no plan fields (the rules reject any write carrying them).
          const businessDoc = {
            ...newBusinessRecord,
            user_uid: rawUid,
            email: user?.email || null,
            user_email: user?.email || null,
            phone: cleanPhone,
            is_active: true,
            created_at: now,
            updated_at: now,
          };
          await setDoc(doc(firestore, 'businesses', businessId), sanitizeForFirestore(toCloud('businesses', businessDoc, { bizId: businessId })), { merge: true });

          // Clear any legacy tombstones for this store ID and phone so it is immediately active and visible in Admin
          await deleteDoc(doc(firestore, 'deleted_businesses', businessId)).catch(() => {});
          if (cleanPhone) {
            await deleteDoc(doc(firestore, 'deleted_phones', cleanPhone)).catch(() => {});
          }
        } catch (cloudErr) {
          console.warn('Cloud Firestore merchant creation notice:', cloudErr);
        }
      }

      // 3. Update localStorage via setStoredUser with complete AuthUser interface
      const completeAuthUser: AuthUser = {
        uid: rawUid,
        id: rawUid,
        phone: cleanPhone,
        email: user?.email || null,
        photoURL: user?.photoURL || null,
        name: cleanOwnerName,
        business_id: businessId,
        business_name: cleanStoreName,
        shop_name: cleanStoreName,
        role: 'admin',
      };
      // A new shop starts up to date: no "What's new" pop-up on its first screen.
      markWhatsNewSeen(APP_VERSION);
      setStoredUser(completeAuthUser);

      // v4.137.0: a new shop with a Google account on this computer goes to the cloud at once, so the
      // same account on the phone opens this shop (not a signup form) and both stay in sync.
      try {
        const [{ getCloudAccount }, { setCloudSendOn, sendToCloudNow }] = await Promise.all([
          import('@/lib/cloud/cloudAccount'),
          import('@/lib/cloud/cloudPush'),
        ]);
        const account = getCloudAccount();
        if (account && !account.stub) {
          setCloudSendOn(true);
          void sendToCloudNow();
        }
      } catch {}

      // Sync profile to cloud
      try {
        const { syncProfileToCloud } = await import('@/lib/sync/syncEngine');
        await syncProfileToCloud(businessId);
      } catch (e) {}

      // 4. Navigate to dashboard
      router.replace('/');
    } catch (err: any) {
      console.error('Failed to complete onboarding:', err);
      setError(err?.message || tr('Error setting up your store. Please try again.'));
      setIsLoading(false);
    }
  };

  return { handleSubmit };
}
