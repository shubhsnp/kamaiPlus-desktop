'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { SupportedLanguage } from '@/types';
import { db } from '@/lib/db';
import { useBusiness } from '@/components/layout/BusinessProvider';
import {
  Wifi,
  WifiOff,
  Globe,
  Store,
  QrCode,
  Volume2,
  VolumeX,
  ShieldCheck,
  User,
  LogOut,
  Sparkles,
  Settings,
  ChevronDown,
  Crown,
  Lock,
  Timer
} from 'lucide-react';
// Counter QR standee pulls in jsPDF + html2canvas (~600 KB). It sits in the app
// shell, so importing it statically made every page pay that cost on load.
const MerchantQRModal = dynamic(
  () => import('@/components/paytm/MerchantQRModal').then((m) => m.MerchantQRModal),
  { ssr: false }
);

import { AuthUser, getStoredUser, setStoredUser, logoutUser } from '@/lib/auth';
import { tr } from '@/lib/i18n/core';
import { lockApp } from '@/lib/auth/masterPassword';
import { getIdleLockMinutes, IDLE_LOCK_OPTIONS, setIdleLockMinutes } from '@/lib/auth/idleLock';
import { SoundToggleButton } from './SoundToggleButton';


export const Navbar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { language, setLanguage, t } = useTranslation();
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [showStoreMenu, setShowStoreMenu] = useState<boolean>(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [idleMinutes, setIdleMinutes] = useState<number>(getIdleLockMinutes);

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  const business = useBusiness();

  useEffect(() => {
    setCurrentUser(getStoredUser());

    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    const handleAuthChange = () => {
      setCurrentUser(getStoredUser());
    };


    // Close menu when clicking outside
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowStoreMenu(false);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('auth_changed', handleAuthChange);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('auth_changed', handleAuthChange);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    await logoutUser();
    router.push('/auth');
  };



  const languages: { code: SupportedLanguage; label: string }[] = [
    { code: 'en', label: tr('English') },
    { code: 'hi', label: 'हिंदी' },
    { code: 'mr', label: 'मराठी' },
  ];

  const displayBusinessName = business?.name || tr('My Store');
  const displayOwnerName = business?.owner_name || currentUser?.name || tr('Owner');

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        
        {/* Left Side: Actions (Upgrade Pro, Store QR, Network Status) */}
        <div className="flex items-center gap-2">
          {/* Quick Merchant QR Code Button */}
          <button
            onClick={() => setIsQrModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer transition shadow-2xs"
            title={tr('Show Merchant UPI QR for Counter')}
          >
            <QrCode className="w-3.5 h-3.5 text-slate-700" />
            <span className="hidden sm:inline">{tr('Store QR')}</span>
          </button>

          {/* Sound on / off for every beep and voice in the app */}
          <SoundToggleButton />



          {/* Network Status & Offline Queue Indicator */}
          {isOnline ? (
            <div 
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold shadow-2xs"
              title={tr('Online. All bills are saved on this computer.')}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{tr('Online • Saved Locally')}</span>
            </div>
          ) : (
            <div 
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-300 text-xs font-bold shadow-xs"
              title={tr('Offline Mode: billing works fully offline. All bills are safely saved on this computer.')}
            >
              <WifiOff className="w-3.5 h-3.5 text-amber-600" />
              <span>{tr('Offline Mode • Saved Locally')}</span>
            </div>
          )}
        </div>

        {/* Right Side: Extreme Right Store Profile & Logo Trigger */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowStoreMenu(!showStoreMenu)}
            className="flex items-center gap-2.5 p-1 -mr-1 rounded-xl hover:bg-slate-50 transition cursor-pointer text-right focus:outline-none"
            title={tr('Click for Store Menu, Language & Settings')}
          >
            <div className="min-w-0 text-right">
              <div className="flex items-center justify-end gap-1.5">
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${showStoreMenu ? 'rotate-180 text-amber-500' : ''}`} />
                <h1 className="text-xs sm:text-base font-extrabold text-slate-900 truncate leading-tight tracking-tight max-w-[120px] sm:max-w-[220px]">
                  {displayBusinessName}
                </h1>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 font-normal truncate max-w-[120px] sm:max-w-[220px]">
                {displayOwnerName}
              </p>
            </div>

            {business?.logo_url ? (
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-xs p-0.5">
                <img
                  src={business.logo_url}
                  alt={displayBusinessName}
                  className="w-full h-full object-contain rounded-lg"
                />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm flex-shrink-0 shadow-xs">
                <Store className="w-5 h-5 text-amber-400" />
              </div>
            )}
          </button>

          {/* Store Logo Dropdown Menu (Anchored to the Right) */}
          {showStoreMenu && (
            <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl py-2 z-50 text-slate-900 animate-in fade-in slide-in-from-top-2 duration-150">
              
              {/* Store & Owner Header */}
              <div className="px-4 py-2.5 border-b border-slate-100 mb-1.5 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {displayBusinessName}
                  </div>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    <span>{tr('Verified')}</span>
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {displayOwnerName}
                  {(currentUser?.phone || business?.phone) ? ` • ${currentUser?.phone || business?.phone}` : ''}
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  {business?.gstin && (
                    <span className="text-[10px] font-mono text-slate-500">
                      GST: {business.gstin}
                    </span>
                  )}
                </div>
              </div>

              {/* Language Switcher */}
              <div className="px-4 py-2 border-b border-slate-100">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-500" />
                  <span>{tr('Language / भाषा')}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {languages.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => {
                        setLanguage(l.code);
                        if (business?.id) {
                          db.businesses.update(business.id, { language: l.code }).catch(() => { });
                        }
                      }}
                      className={`px-2 py-1.5 rounded-lg text-xs font-bold text-center transition-all cursor-pointer ${
                        language === l.code
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {l.code === 'hi' ? 'हिंदी' : l.code === 'mr' ? 'मराठी' : tr('English')}
                    </button>
                  ))}
                </div>
              </div>



              {/* App lock: auto-lock after idle minutes (per computer) */}
              <div className="px-4 py-2 border-b border-slate-100">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1.5">
                  <Timer className="w-3.5 h-3.5 text-slate-500" />
                  <span>{tr('Auto-lock when idle')}</span>
                </div>
                <div className="grid grid-cols-6 gap-1">
                  {IDLE_LOCK_OPTIONS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setIdleLockMinutes(m);
                        setIdleMinutes(m);
                      }}
                      aria-pressed={idleMinutes === m}
                      className={`h-7 rounded-lg text-[11px] font-bold text-center transition-all cursor-pointer ${
                        idleMinutes === m ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {m === 0 ? tr('Off') : tr('{m}m', { m })}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5 leading-snug">
                  {idleMinutes === 0
                    ? tr('The app stays open until you lock it or close it.')
                    : tr('Asks for the master password after {m} minutes with no use. Open bills are kept.', { m: idleMinutes })}
                </p>
              </div>

              {/* Navigation & Actions */}
              <div className="pt-1 px-1">
                <button
                  onClick={() => {
                    setShowStoreMenu(false);
                    router.push('/settings');
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2.5 font-semibold cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-slate-500" />
                  <span>{tr('Store Profile & Print Settings')}</span>
                </button>

                <button
                  onClick={() => {
                    setShowStoreMenu(false);
                    lockApp(pathname);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2.5 font-semibold cursor-pointer"
                >
                  <Lock className="w-4 h-4 text-slate-500" />
                  <span className="flex-1">{tr('Lock now')}</span>
                  <span className="text-[10px] font-normal text-slate-400">{tr('password to open again')}</span>
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2.5 font-bold mt-1 border-t border-slate-100 cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  <span>{tr('Log Out / Switch Account')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Clean Corporate Merchant QR Modal */}
      {isQrModalOpen && (
        <MerchantQRModal
          isOpen={isQrModalOpen}
          onClose={() => setIsQrModalOpen(false)}
          business={business || null}
        />
      )}
    </>
  );
};