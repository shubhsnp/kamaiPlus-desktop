'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db as localDb, seedBusinessStarterData } from '@/lib/db';
import { BusinessType, Business } from '@/types';
import { getStoredUser, setStoredUser, AuthUser } from '@/lib/auth';
import { CLOUD_SYNC_ENABLED } from '@/lib/firebase/cloudAvailability';
import { 
  Store, 
  ShoppingBag, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  Pill, 
  Wrench, 
  Utensils, 
  Tv, 
  User, 
  Phone, 
  Building2, 
  AlertCircle,
  ShieldCheck,
  ChevronDown,
  QrCode
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getLanguage, tr } from '@/lib/i18n/core';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { markWhatsNewSeen } from '@/lib/whatsNew/changelog';
import { APP_VERSION } from '@/lib/constants/version';

export default function OnboardingPage() {
  const router = useRouter();
  const [currentUser, setCurrentUserState] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  
  // Required Onboarding Fields
  const [businessName, setBusinessName] = useState<string>('');
  const [ownerName, setOwnerName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [upiId, setUpiId] = useState<string>('');
  const [businessType] = useState<BusinessType>('retail');
  // v4.93.0: off by default — the sample items are fireworks, which a kirana or clothes shop
  // then had to delete one by one. A shop that wants to try the app ticks it.
  const [seedStarterCatalog, setSeedStarterCatalog] = useState<boolean>(false);

  // Load current authenticated user and pre-fill details
  useEffect(() => {
    const user = getStoredUser();
    setCurrentUserState(user);

    if (user?.name && user.name !== 'Store Owner') {
      setOwnerName(user.name);
    }
    if (user?.phone) {
      const clean = user.phone.replace(/\D/g, '').slice(-10);
      if (clean.length === 10) {
        setPhone(clean);
      }
    }
  }, []);



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
        email: user?.email || undefined,
        user_email: user?.email || undefined,
        user_uid: rawUid,
        address: '',
        currency: 'INR',
        language: getLanguage(),
        invoice_prefix: 'INV-',
        next_invoice_number: 1,
        terms_conditions: 'Thank you for your business! Goods once sold can be exchanged within 7 days with bill receipt.',
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

      // Seed starter catalog products for selected category
      if (seedStarterCatalog) {
        try {
          await seedBusinessStarterData(businessId);
        } catch (seedErr) {
          console.warn('Starter catalog seed warning:', seedErr);
        }
      }

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

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background Ambience Glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <LanguageSwitcher className="absolute top-4 right-4 z-20" />

      <div className="w-full max-w-xl relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-300 text-xs font-bold mb-3 shadow-sm">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{tr('Store Onboarding • Fast & Free Setup')}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {tr('Setup Your Store Profile')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {tr('Fill in your shop details to launch your digital billing counter and khata.')}
          </p>
        </div>

        {/* Onboarding Form Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl text-white">
          {error && (
            <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {/* 1. Store / Business Name */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                {tr('Store / Business Name *')}
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-amber-400 pointer-events-none">
                  <Store className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder={tr('e.g. Sharma Kirana & General Store')}
                  required
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-none text-white text-sm placeholder:text-slate-600 transition"
                />
              </div>
            </div>

            {/* 2. Owner Name */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                {tr('Owner / Manager Name')}
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-emerald-400 pointer-events-none">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder={tr('e.g. Ramesh Sharma')}
                  className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-none text-white text-sm placeholder:text-slate-600 transition"
                />
              </div>
            </div>

            {/* 3. Primary Mobile / Contact Number */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                {tr('Primary Contact Mobile Number *')}
              </label>
              <div className="flex rounded-xl overflow-hidden border border-slate-800 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20 transition bg-slate-950">
                <div className="flex items-center gap-1.5 px-3.5 py-3 bg-slate-900/90 border-r border-slate-800 text-slate-200 text-xs font-bold select-none shrink-0">
                  <span className="text-sm">🇮🇳</span>
                  <span className="text-amber-400 font-mono">+91</span>
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="98765 43210"
                  required
                  className="flex-1 px-4 py-3 bg-transparent text-white text-sm font-mono tracking-wide placeholder:text-slate-600 placeholder:font-sans focus:outline-none"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {tr('Printed on thermal receipt headers & customer invoices.')}
              </p>
            </div>

            {/* 4. UPI ID (optional — adds the payment QR to bills) */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                <span>{tr('UPI ID / VPA (Optional)')}</span>
                <span className="text-[10px] text-slate-500 font-semibold normal-case">{tr('Can be added later in Settings')}</span>
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-cyan-400 pointer-events-none">
                  <QrCode className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value.trim())}
                  placeholder={tr('e.g. 9876543210@paytm or store@okaxis')}
                  data-onboarding-upi
                  className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-none text-white text-sm font-mono placeholder:font-sans placeholder:text-slate-600 transition"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {tr('If added, bills print a UPI QR code for the bill amount. Leave blank if you do not take UPI.')}
              </p>
            </div>

            {/* 5. Preload Starter Catalog Checkbox */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={seedStarterCatalog}
                  onChange={(e) => setSeedStarterCatalog(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 text-amber-400 focus:ring-amber-400 mt-0.5 accent-amber-400"
                />
                <div>
                  <span className="text-xs font-bold text-slate-200 block">
                    {tr('Pre-load starter product catalog')}
                  </span>
                  <span className="text-[10.5px] text-slate-400 block leading-tight mt-0.5">
                    {tr('Adds 10 sample products (fireworks) with prices and stock — edit or delete them anytime.')}
                  </span>
                </div>
              </label>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading || !businessName.trim() || phone.length < 10}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 active:scale-[0.99] text-slate-950 font-black text-sm rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <span>{tr('Setting Up Store...')}</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-slate-950" />
                  <span>{tr('Complete Setup & Launch POS 🚀')}</span>
                  <ArrowRight className="w-4 h-4 text-slate-950" />
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
