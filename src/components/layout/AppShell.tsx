'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { db as localDb } from '@/lib/db';
import { AuthUser, getStoredUser, setStoredUser } from '@/lib/auth';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { DesktopStatusBar } from './DesktopStatusBar';
import { GlobalDrawers } from './GlobalDrawers';
import { BusinessProvider } from './BusinessProvider';
import { UpdateReadyBanner } from './UpdateReadyBanner';
import { AutoBackupScheduler } from './AutoBackupScheduler';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [isClient, setIsClient] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [accountLockout, setAccountLockout] = useState<{ isFrozen: boolean; message: string } | null>(null);
  // Ask the OS not to evict the shop's local database.
  useEffect(() => {
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  // --- 1. MOUNT SETUP: DB HYDRATION & EVENT LISTENERS ---
  useEffect(() => {
    setIsClient(true);
    
    const initialUser = getStoredUser();
    setCurrentUser(initialUser);

    const handleAuthChange = () => {
      const u = getStoredUser();
      setCurrentUser(u);
    };

    const handleAccountFrozen = (e: any) => {
      setAccountLockout({
        isFrozen: true,
        message: e.detail?.message || 'Your merchant store has been frozen/blocked by the platform administrator.',
      });
    };

    const handleAccountUnfrozen = () => {
      setAccountLockout(null);
    };

    window.addEventListener('account_frozen', handleAccountFrozen);
    window.addEventListener('account_unfrozen', handleAccountUnfrozen);
    window.addEventListener('auth_changed', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);

    // Initial DB hydration: restore business and default products from local Dexie
    const initDb = async () => {
      try {
        if (!localDb.isOpen()) {
          await localDb.open();
        }

        const u = getStoredUser();

        // If user is not logged in (e.g. on /auth or just logged out), DO NOT synthesize a user session
        if (!u) {
          return;
        }

        let localBiz = await localDb.businesses.toCollection().first();

        if (localBiz && localBiz.id && localBiz.is_onboarded) {
          const userPhone = (u.phone || '').replace(/\D/g, '').slice(-10);
          const bizPhone = (localBiz.phone || '').replace(/\D/g, '').slice(-10);
          const userEmail = (u.email || '').toLowerCase().trim();
          const bizEmail = (localBiz.email || '').toLowerCase().trim();
          const isOwner = (userPhone && bizPhone && userPhone === bizPhone) ||
                          (userEmail && bizEmail && userEmail === bizEmail) ||
                          (u.business_id && u.business_id === localBiz.id);

          if (isOwner && (!u.business_id || u.business_id === 'biz_pending')) {
            const restoredUser: AuthUser = {
              uid: u.uid || localBiz.id,
              id: u.id || localBiz.id,
              phone: u.phone || localBiz.phone,
              name: u.name || localBiz.owner_name || 'Store Owner',
              role: u.role || 'admin',
              business_id: localBiz.id,
              business_name: localBiz.name,
              shop_name: localBiz.name,
            };
            setStoredUser(restoredUser);
            setCurrentUser(restoredUser);
          } else if (!isOwner && (!u.business_id || u.business_id === 'biz_pending')) {
            // Stale business from an old or different account on this device; clear it so new user is routed to onboarding cleanly
            await localDb.businesses.clear().catch(() => {});
          }
        }
      } catch (err) {
        console.warn('Local DB hydration notice:', err);
      }
    };

    initDb();

    return () => {
      window.removeEventListener('account_frozen', handleAccountFrozen);
      window.removeEventListener('account_unfrozen', handleAccountUnfrozen);
      window.removeEventListener('auth_changed', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, []);

  // --- 2. DETERMINISTIC ROUTE GUARDING ---
  useEffect(() => {
    if (!isClient) return;

    const user = currentUser || getStoredUser();
    
    // Route classifications
    const isCustomerInvoice = pathname === '/invoice' || (pathname.startsWith('/invoice') && !pathname.startsWith('/invoice-designer'))
      // The customer-facing UPI payment link must open without a shop login.
      || pathname === '/pay';
    const isLegalOrPublic = pathname === '/terms-of-service' || pathname === '/privacy-policy' || pathname === '/refund-policy' || pathname === '/contact-us' || pathname === '/features' || pathname === '/about' || pathname === '/download' || pathname === '/plans';
    const isAuthRoute = pathname === '/auth';
    const isOnboardingRoute = pathname === '/onboarding';
    // The public marketing homepage only takes over "/" for logged-out visitors
    const isRootMarketing = pathname === '/' && !user;
    const isPublicRoute = isCustomerInvoice || isLegalOrPublic || isAuthRoute || isOnboardingRoute || isRootMarketing;

    if (!user) {
      if (!isPublicRoute && pathname !== '/auth') {
        router.replace('/auth');
      }
    } else {
      const hasBusinessId = Boolean(user.business_id && user.business_id !== 'biz_pending');

      if (!hasBusinessId) {
        if (!isOnboardingRoute && !isLegalOrPublic && !isCustomerInvoice && pathname !== '/auth') {
          router.replace('/onboarding');
        }
      } else {
        if (isAuthRoute || isOnboardingRoute) {
          router.replace('/');
        }
      }
    }
  }, [pathname, currentUser, isClient, router]);

  if (!isClient) {
    return <main className="min-h-screen bg-slate-50" />;
  }

  // Standalone layout for public customer links (digital invoice, UPI payment)
  const isCustomerInvoice = pathname === '/invoice' || (pathname.startsWith('/invoice') && !pathname.startsWith('/invoice-designer')) || pathname === '/pay';
  if (isCustomerInvoice) {
    return <main className="min-h-screen bg-slate-50">{children}</main>;
  }

  // Standalone full-screen layout for onboarding, auth, legal pages, and the public marketing site
  const isRootMarketing = pathname === '/' && !currentUser;
  if (pathname === '/onboarding' || pathname === '/auth' || pathname === '/terms-of-service' || pathname === '/privacy-policy' || pathname === '/refund-policy' || pathname === '/contact-us' || pathname === '/features' || pathname === '/about' || pathname === '/download' || pathname === '/plans' || isRootMarketing) {
    return <main className="min-h-screen bg-slate-950">{children}</main>;
  }

  // Protected routes check
  if (!currentUser || !currentUser.business_id || currentUser.business_id === 'biz_pending') {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
      </main>
    );
  }

  return (
    <BusinessProvider>
    <div className="h-screen w-screen overflow-hidden bg-slate-50 flex flex-col text-slate-900">
      {/* Account Freeze / Delete Lockout Modal */}
      {accountLockout && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-rose-200 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
              <span className="text-2xl">🛑</span>
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-black text-slate-900">
                {accountLockout.isFrozen ? 'Account Suspended' : 'Account Deactivated'}
              </h2>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                {accountLockout.message}
              </p>
            </div>
            <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-100 text-xs text-rose-950 space-y-1">
              <div className="font-bold">Official Platform Support Email:</div>
              <div className="font-mono font-bold text-rose-700 text-sm select-all">info@proventure.in</div>
            </div>
            <button
              type="button"
              onClick={() => {
                window.location.href = '/auth';
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
            >
              Return to Login
            </button>
          </div>
        </div>
      )}


      <Navbar />
      <div className="flex-1 flex w-full overflow-hidden min-h-0">
        <Sidebar />
        <main className="flex-1 p-3 sm:p-5 overflow-y-auto w-full min-h-0 bg-slate-50/40 animate-in fade-in duration-300">
          {children}
        </main>
      </div>
      <DesktopStatusBar />
      <GlobalDrawers />
      <UpdateReadyBanner />
      <AutoBackupScheduler />
    </div>
    </BusinessProvider>
  );
};