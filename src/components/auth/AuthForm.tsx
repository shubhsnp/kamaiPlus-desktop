'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithGoogle } from '@/lib/firebase/googleAuth';
import { setStoredUser, AuthUser } from '@/lib/auth';
import { db as localDb } from '@/lib/db';
import { getFirestoreDb } from '@/lib/firebase/config';
import { doc, getDoc, setDoc, collection, query, where, getDocs, limit, deleteDoc } from 'firebase/firestore';
import { syncProfileToCloud, restoreDataFromCloud } from '@/lib/sync/syncEngine';
import { 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck,
  Zap,
  RefreshCw
} from 'lucide-react';

export const AuthForm: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null);

  // Show notice if redirected after admin store deletion
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('deleted=true')) {
      setError('⚠️ आपका स्टोर एडमिन द्वारा हमेशा के लिए हटा दिया गया है। नया स्टोर शुरू करने के लिए नया अकाउंट बनाएं।');
    }
  }, []);

  /**
   * Universal Post-Authentication Handler
   * Handles routing and local hydration for Google OAuth
   */
  const handlePostAuth = useCallback(async (authUser: {
    uid: string;
    phone?: string | null;
    email?: string | null;
    name?: string | null;
    photoURL?: string | null;
  }) => {
    const { uid, phone, email, name, photoURL } = authUser;
    const cleanPhone = phone ? phone.replace(/\D/g, '').slice(-10) : '';
    const cleanEmail = email?.toLowerCase().trim() || '';

    try {
      const firestore = getFirestoreDb();
      let merchantData: any = null;

      if (firestore) {
        // 1. Primary check: Query collection `merchants` for document `merchants/{uid}`
        try {
          const merchantDocRef = doc(firestore, 'merchants', uid);
          const merchantSnap = await getDoc(merchantDocRef);
          if (merchantSnap.exists()) {
            merchantData = merchantSnap.data();
          }
        } catch (mErr) {
          console.warn('merchants/{uid} lookup notice:', mErr);
        }

        // 2. Comprehensive Fallback Check: Query businesses & merchants by user_uid, email, or phone
        if (!merchantData) {
          try {
            // 2a. Query by UID
            if (uid) {
              const uidQ = query(collection(firestore, 'businesses'), where('user_uid', '==', uid), limit(1));
              const uidSnap = await getDocs(uidQ);
              if (!uidSnap.empty) {
                merchantData = uidSnap.docs[0].data();
              }
            }

            // 2b. Query by Email
            if (!merchantData && cleanEmail) {
              const emailQ1 = query(collection(firestore, 'businesses'), where('user_email', '==', cleanEmail), limit(1));
              const emailSnap1 = await getDocs(emailQ1);
              if (!emailSnap1.empty) {
                merchantData = emailSnap1.docs[0].data();
              }

              if (!merchantData) {
                const emailQ2 = query(collection(firestore, 'businesses'), where('email', '==', cleanEmail), limit(1));
                const emailSnap2 = await getDocs(emailQ2);
                if (!emailSnap2.empty) {
                  merchantData = emailSnap2.docs[0].data();
                }
              }

              if (!merchantData) {
                const emailMQ = query(collection(firestore, 'merchants'), where('email', '==', cleanEmail), limit(1));
                const emailMSnap = await getDocs(emailMQ);
                if (!emailMSnap.empty) {
                  merchantData = emailMSnap.docs[0].data();
                }
              }
            }

            // 2c. Query by Phone
            if (!merchantData && cleanPhone) {
              const possibleUids = [`wa_${cleanPhone}`, `user_${cleanPhone}`, `staff_${cleanPhone}`];
              for (const pUid of possibleUids) {
                if (merchantData) break;
                try {
                  const pSnap = await getDoc(doc(firestore, 'merchants', pUid));
                  if (pSnap.exists()) {
                    merchantData = pSnap.data();
                  }
                } catch (pErr) {}
              }

              if (!merchantData) {
                const phoneQ1 = query(collection(firestore, 'businesses'), where('phone', '==', cleanPhone), limit(1));
                const phoneSnap1 = await getDocs(phoneQ1);
                if (!phoneSnap1.empty) {
                  merchantData = phoneSnap1.docs[0].data();
                }
              }

              if (!merchantData) {
                const phoneQ2 = query(collection(firestore, 'businesses'), where('phone', '==', `+91${cleanPhone}`), limit(1));
                const phoneSnap2 = await getDocs(phoneQ2);
                if (!phoneSnap2.empty) {
                  merchantData = phoneSnap2.docs[0].data();
                }
              }

              if (!merchantData) {
                const phoneMQ = query(collection(firestore, 'merchants'), where('phone', '==', cleanPhone), limit(1));
                const phoneMSnap = await getDocs(phoneMQ);
                if (!phoneMSnap.empty) {
                  merchantData = phoneMSnap.docs[0].data();
                }
              }
            }
          } catch (bErr) {
            console.warn('businesses/merchants lookup fallback notice:', bErr);
          }
        }

        // 3. Strict Verification: Check if the business document actually exists in `businesses` and is not tombstoned
        if (merchantData) {
          const targetBizId = merchantData.business_id || merchantData.id;
          if (targetBizId) {
            try {
              const [bizSnap, tombSnap] = await Promise.all([
                getDoc(doc(firestore, 'businesses', targetBizId)).catch(() => null),
                getDoc(doc(firestore, 'deleted_businesses', targetBizId)).catch(() => null),
              ]);
              if (tombSnap?.exists() || (bizSnap?.exists() && bizSnap.data()?.is_active === false)) {
                // The store was deleted or frozen by platform admin!
                merchantData = null;
              } else if (bizSnap && bizSnap.exists()) {
                merchantData = { ...merchantData, ...bizSnap.data() };
              }
            } catch (vErr) {
              console.warn('Verify business existence notice:', vErr);
            }
          }
        }
      }

      // 4. Local Database Fallback: ONLY if the local business actually belongs to this authenticated user AND wasn't deleted!
      if (!merchantData) {
        try {
          if (!localDb.isOpen()) await localDb.open();
          const localBiz = await localDb.businesses.toCollection().first();
          if (localBiz && localBiz.id && localBiz.is_onboarded) {
            const bizPhone = localBiz.phone ? localBiz.phone.replace(/\D/g, '').slice(-10) : '';
            const bizEmail = localBiz.email ? localBiz.email.toLowerCase().trim() : '';
            const matchesPhone = Boolean(cleanPhone && bizPhone && bizPhone === cleanPhone);
            const matchesEmail = Boolean(cleanEmail && bizEmail && bizEmail === cleanEmail);
            const matchesUid = Boolean((localBiz as any).user_uid && (localBiz as any).user_uid === uid);

            if (matchesPhone || matchesEmail || matchesUid) {
              let isCloudDeleted = false;
              if (firestore) {
                const [bSnap, tSnap] = await Promise.all([
                  getDoc(doc(firestore, 'businesses', localBiz.id)).catch(() => null),
                  getDoc(doc(firestore, 'deleted_businesses', localBiz.id)).catch(() => null),
                ]);
                if (tSnap?.exists()) {
                  isCloudDeleted = true;
                }
              }

              if (!isCloudDeleted) {
                merchantData = localBiz;
              } else {
                console.log('🧹 Local store was deleted in cloud. Purging local device.');
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
              }
            } else {
              // Stale data from previous user on this shared device/browser!
              console.log('🧹 Stale local store data detected from a different account. Purging local device.');
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
            }
          }
        } catch (dexErr) {
          console.warn('Local Dexie business fallback notice:', dexErr);
        }
      }

      // CASE A: Returning User (Active Merchant document or business verified in Cloud / Local DB)
      if (merchantData && (merchantData.business_id || merchantData.id) && merchantData.is_active !== false) {
        const businessId = merchantData.business_id || merchantData.id;
        const shopName = merchantData.shop_name || merchantData.name || merchantData.business_name || 'My Store';
        const ownerName = merchantData.owner_name || name || 'Merchant';
        const userPhone = merchantData.phone || cleanPhone || '';

        setWelcomeMessage(`Welcome back, ${shopName}!`);

        // Store business into local Dexie
        try {
          if (!localDb.isOpen()) await localDb.open();
          const existingBiz = await localDb.businesses.toCollection().first();
          if (existingBiz && existingBiz.id && existingBiz.id !== businessId) {
            console.log('🔄 Switching store accounts on this device. Purging previous store data.');
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
          }

          await localDb.businesses.put({
            id: businessId,
            name: shopName,
            owner_name: ownerName,
            phone: userPhone,
            email: cleanEmail || merchantData.email,
            business_type: merchantData.business_type || 'grocery',
            address: merchantData.address || '',
            currency: 'INR',
            language: merchantData.language || 'hi',
            invoice_prefix: merchantData.invoice_prefix || 'INV-',
            next_invoice_number: merchantData.next_invoice_number || 1,
            is_onboarded: true,
            sync_status: 'synced',
            created_at: merchantData.createdAt || merchantData.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        } catch (dbErr) {
          console.warn('Put business in local db notice:', dbErr);
        }

        // Hydrate local session
        const sessionPayload: AuthUser = {
          uid,
          id: uid,
          phone: userPhone,
          email: cleanEmail || null,
          photoURL: photoURL || null,
          name: ownerName,
          business_id: businessId,
          business_name: shopName,
          shop_name: shopName,
          role: merchantData.role || 'admin',
        };
        setStoredUser(sessionPayload);

        // Ensure bi-directional cross-indexing in Firestore so email and phone always resolve to the exact same store
        try {
          const firestore = getFirestoreDb();
          if (firestore) {
            const resolvedPhone = (userPhone || cleanPhone || '').replace(/\D/g, '').slice(-10);
            const resolvedEmail = cleanEmail || merchantData.email || '';

            // 1. Update/bind current uid in merchants collection
            await setDoc(doc(firestore, 'merchants', uid), {
              uid,
              business_id: businessId,
              shop_name: shopName,
              business_name: shopName,
              owner_name: ownerName,
              phone: resolvedPhone || userPhone || null,
              email: resolvedEmail || null,
              role: merchantData.role || 'admin',
              updatedAt: new Date().toISOString(),
            }, { merge: true });

            // 2. If phone is available, bind wa_${resolvedPhone} and user_${resolvedPhone} to same store
            if (resolvedPhone && resolvedPhone.length === 10) {
              await setDoc(doc(firestore, 'merchants', `wa_${resolvedPhone}`), {
                uid: `wa_${resolvedPhone}`,
                linked_uid: uid,
                business_id: businessId,
                shop_name: shopName,
                business_name: shopName,
                owner_name: ownerName,
                phone: resolvedPhone,
                email: resolvedEmail || null,
                role: merchantData.role || 'admin',
                updatedAt: new Date().toISOString(),
              }, { merge: true });
              await setDoc(doc(firestore, 'merchants', `user_${resolvedPhone}`), {
                uid: `user_${resolvedPhone}`,
                linked_uid: uid,
                business_id: businessId,
                shop_name: shopName,
                business_name: shopName,
                owner_name: ownerName,
                phone: resolvedPhone,
                email: resolvedEmail || null,
                role: merchantData.role || 'admin',
                updatedAt: new Date().toISOString(),
              }, { merge: true });
            }

            // 3. Keep business doc bound with full profile details so it is 100% visible in Admin panel
            await setDoc(doc(firestore, 'businesses', businessId), {
              id: businessId,
              name: shopName,
              owner_name: ownerName,
              email: resolvedEmail || undefined,
              user_email: resolvedEmail || undefined,
              phone: resolvedPhone || userPhone || undefined,
              user_uid: uid,
              is_active: true,
              subscription_tier: merchantData.subscription_tier || 'free',
              created_at: merchantData.createdAt || merchantData.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, { merge: true });

            // 4. Clear any stale tombstones for this active store and phone
            await deleteDoc(doc(firestore, 'deleted_businesses', businessId)).catch(() => {});
            if (resolvedPhone && resolvedPhone.length === 10) {
              await deleteDoc(doc(firestore, 'deleted_phones', resolvedPhone)).catch(() => {});
            }
          }
        } catch (bindErr) {
          console.warn('Cross-index binding notice on login:', bindErr);
        }

        // Restore cloud data and sync profile
        try {
          await restoreDataFromCloud(businessId);
          await syncProfileToCloud(businessId);
        } catch (syncErr) {
          console.warn('Restore and sync cloud data on login:', syncErr);
        }

        // Navigate seamlessly to dashboard
        setTimeout(() => {
          router.replace('/');
        }, 1000);
      } else {
        // CASE B: First-Time User OR Deleted Merchant (Document Does NOT Exist in Cloud)
        // Complete purge of any stale device data
        try {
          if (!localDb.isOpen()) await localDb.open();
          await Promise.all([
            localDb.sales.clear().catch(() => {}),
            localDb.customers.clear().catch(() => {}),
            localDb.products.clear().catch(() => {}),
            localDb.categories.clear().catch(() => {}),
            localDb.ledger_transactions.clear().catch(() => {}),
            localDb.cash_expenses.clear().catch(() => {}),
            localDb.cash_registers.clear().catch(() => {}),
            localDb.inventory_movements.clear().catch(() => {}),
            localDb.suppliers.clear().catch(() => {}),
            localDb.businesses.clear().catch(() => {}),
          ]);
        } catch (purgeErr) {
          console.warn('Wipe local device tables on first-time signup:', purgeErr);
        }

        const partialUser: AuthUser = {
          uid,
          id: uid,
          phone: cleanPhone || null,
          email: cleanEmail || null,
          photoURL: photoURL || null,
          name: name || 'Store Owner',
          role: 'admin',
          business_id: undefined, // Mandatory onboarding flag
        };
        setStoredUser(partialUser);

        // Navigate immediately to onboarding page for fresh store creation
        router.replace('/onboarding');
      }
    } catch (err: any) {
      console.error('Post-auth routing error:', err);
      setError(err?.message || 'Failed to initialize merchant session.');
      setLoading(false);
    }
  }, [router]);

  // Google OAuth Sign-In
  const handleGoogleSignIn = async () => {
    setError('');
    setWelcomeMessage(null);
    setLoading(true);

    try {
      const result = await signInWithGoogle();
      if (!result.success || !result.user) {
        setError(result.error || 'Google Sign-In failed. Please try again.');
        setLoading(false);
        return;
      }

      const googleUser = result.user;
      await handlePostAuth({
        uid: googleUser.uid,
        phone: googleUser.phoneNumber,
        email: googleUser.email,
        name: googleUser.displayName,
        photoURL: googleUser.photoURL,
      });
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      setError(err?.message || 'Google sign-in error occurred.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
      {/* Decorative gradient header glow */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-emerald-400 to-amber-500" />

      {/* Header title */}
      <div className="text-center mb-6">
        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
          Welcome to KamaiPlus
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Fast, Free &amp; Offline-First POS Counter &amp; Digital Khata
        </p>
      </div>

      {/* Welcome Back Banner for Returning Users */}
      {welcomeMessage && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-3 animate-in fade-in zoom-in-95">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="font-black text-white text-sm">{welcomeMessage} 👋</div>
            <div className="text-xs text-emerald-300/80">Opening your store &amp; POS billing counter...</div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Primary Google Login Button */}
      <div className="space-y-4">
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading || !!welcomeMessage}
          className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm shadow-xl hover:shadow-2xl transition-all duration-200 border border-slate-200 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-slate-900 animate-spin" />
              <span>Authenticating with Google...</span>
            </div>
          ) : (
            <>
              {/* Official Google 'G' SVG Logo */}
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </>
          )}
        </button>

        {/* Feature Highlights */}
        <div className="pt-2 grid grid-cols-2 gap-2 text-center">
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2 justify-center">
            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-300">100% Offline POS</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2 justify-center">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-300">Cloud Sync &amp; Backup</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;
