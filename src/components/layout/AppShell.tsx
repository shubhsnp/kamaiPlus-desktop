'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { db as localDb } from '@/lib/db';
import { AuthUser, getStoredUser, setStoredUser } from '@/lib/auth';
import { clearUnlockDestination, isAppLocked, lockApp, unlockDestination } from '@/lib/auth/masterPassword';
import { globalShortcutFor, NEW_BILL_HREF } from '@/lib/ui/globalShortcuts';
import { IdleLock } from './IdleLock';
import { WhatsNewModal } from '@/components/whatsNew/WhatsNewModal';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { DesktopStatusBar } from './DesktopStatusBar';
import { GlobalDrawers } from './GlobalDrawers';
import { PrinterWatcher } from '@/components/printers/PrinterWatcher';
import { WhatsAppHost } from '@/components/whatsapp/WhatsAppHost';
import { BusinessProvider } from './BusinessProvider';
import { UpdateReadyBanner } from './UpdateReadyBanner';
import { FeatureGate } from '@/components/features/FeatureGate';
import { AutoBackupScheduler } from './AutoBackupScheduler';
import { CloudSyncScheduler } from './CloudSyncScheduler';
import { tr } from '@/lib/i18n/core';
import { SupportContactLine } from '@/components/support/SupportContact';
import { supportGreeting } from '@/lib/support/contact';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [isClient, setIsClient] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  // Signed in but the master password not yet entered since the app started.
  const [locked, setLocked] = useState<boolean>(true);
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
    setLocked(isAppLocked());

    const handleAuthChange = () => {
      const u = getStoredUser();
      setCurrentUser(u);
      setLocked(isAppLocked());
    };

    const handleAccountFrozen = (e: any) => {
      setAccountLockout({
        isFrozen: true,
        message: e.detail?.message || tr('Your merchant store has been frozen/blocked by the platform administrator.'),
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

    if (user && locked) {
      // Lock on launch: the password screen first, whatever page was open.
      if (!isAuthRoute && !isCustomerInvoice) router.replace('/auth');
    } else if (!user) {
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
          // Back to the page that was open when the app locked (Lock now / idle), else home.
          router.replace(unlockDestination());
        } else if (unlockDestination() === pathname) {
          clearUnlockDestination();
        }
      }
    }
  }, [pathname, currentUser, locked, isClient, router]);

  // --- 3. GLOBAL KEYBOARD SHORTCUTS (lib/ui/globalShortcuts.ts — the status bar shows the same list) ---
  // F1 (new bill), Ctrl+H (Home) and Ctrl+L (Lock) work while typing too — they type no text.
  // With a window (form, dialog) open, F1 / Ctrl+H do nothing: leaving would lose what was typed.
  useEffect(() => {
    if (!isClient || !currentUser || locked) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const windowOpen = Boolean(document.querySelector('[aria-modal="true"]'));
      const action = globalShortcutFor(e, pathname, windowOpen);
      if (!action) return;
      e.preventDefault();
      if (action === 'home') router.push('/');
      else if (action === 'billing') router.push(NEW_BILL_HREF);
      else if (action === 'lock') lockApp(pathname);
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isClient, currentUser, locked, router, pathname]);

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

  // Protected routes check (a locked app never renders a shop page)
  if (!currentUser || !currentUser.business_id || currentUser.business_id === 'biz_pending' || locked) {
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
                {accountLockout.isFrozen ? tr('Account Suspended') : tr('Account Deactivated')}
              </h2>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                {accountLockout.message}
              </p>
            </div>
            <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-100 text-xs text-rose-950 space-y-1.5">
              <div className="font-bold">{tr('Contact KamaiPlus support:')}</div>
              <SupportContactLine
                className="text-rose-700"
                message={`${supportGreeting()}\n${tr('My KamaiPlus account shows "{status}". Please help.', { status: accountLockout.isFrozen ? 'Account Suspended' : 'Account Deactivated' })}`}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                window.location.href = '/auth';
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
            >
              {tr('Return to Login')}
            </button>
          </div>
        </div>
      )}


      <Navbar />
      <div className="flex-1 flex w-full overflow-hidden min-h-0">
        <Sidebar />
        <main className="flex-1 p-3 sm:p-5 overflow-y-auto w-full min-h-0 bg-slate-50/40 animate-in fade-in duration-300">
          <FeatureGate pathname={pathname}>{children}</FeatureGate>
        </main>
      </div>
      <DesktopStatusBar />
      <PrinterWatcher />
      <WhatsAppHost />
      <GlobalDrawers />
      <UpdateReadyBanner />
      <AutoBackupScheduler />
      <CloudSyncScheduler />
      <IdleLock />
      <WhatsNewModal />
    </div>
    </BusinessProvider>
  );
};