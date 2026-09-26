'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { HardDrive, Wifi, WifiOff, Printer, Clock } from 'lucide-react';
import { APP_VERSION } from '@/lib/constants/version';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { db } from '@/lib/db';
import { getDesktopApi } from '@/lib/desktop/desktopBridge';
import { getPrintSettings, printerForFormat } from '@/lib/hardware/printSettings';
import { msg, tr } from '@/lib/i18n/core';
import { openWhatsNew } from '@/components/whatsNew/WhatsNewModal';

// Keep in step with the keydown handler in app/billing/page.tsx. The bar used to
// advertise F1 Billing / F2 Products / F4 Register everywhere — none of which existed.
const BILLING_SHORTCUTS: [string, string][] = [
  ['F1', msg('New bill')],
  ['F2', msg('Search')],
  ['F4', msg('Cash')],
  ['F8', 'UPI'],
  ['F9', msg('Credit')],
  ['F10', msg('Complete sale')],
  ['Esc', msg('Clear search')],
];
const GLOBAL_SHORTCUTS: [string, string][] = [['Ctrl+B', msg('Show / hide menu')]];

export const DesktopStatusBar: React.FC = () => {
  const pathname = usePathname();
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<string>('');

  const business = useBusiness();

  // Real printer status (it used to say "Ready" whatever was connected): is the
  // printer that bills go to installed in Windows right now?
  const [printer, setPrinter] = useState<{ ok: boolean; label: string; title: string } | null>(null);
  useEffect(() => {
    const api = getDesktopApi();
    if (!api) return;
    let alive = true;
    const check = async () => {
      const settings = getPrintSettings();
      const chosen = printerForFormat(settings, settings.defaultFormat);
      const list = await api.getPrinters().catch(() => []);
      if (!alive) return;
      if (list.length === 0) {
        setPrinter({ ok: false, label: tr('None installed'), title: tr('No printer is installed in Windows.') });
      } else if (chosen) {
        const found = list.find((p) => p.name === chosen);
        setPrinter(
          found
            ? { ok: true, label: found.displayName, title: tr('Bills print on {displayName}.', { displayName: found.displayName }) }
            : { ok: false, label: tr('Not found: {chosen}', { chosen: chosen }), title: tr('The printer chosen in Settings ({chosen}) is not connected or was removed.', { chosen: chosen }) }
        );
      } else {
        const def = list.find((p) => p.isDefault);
        setPrinter(
          def
            ? { ok: true, label: def.displayName, title: tr('Bills print on the Windows default printer ({displayName}).', { displayName: def.displayName }) }
            : { ok: false, label: tr('No default'), title: tr('Choose a printer in Settings → Print.') }
        );
      }
    };
    void check();
    const timer = window.setInterval(check, 60000);
    window.addEventListener('print_settings_changed', check);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener('print_settings_changed', check);
    };
  }, []);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      );
    };

    updateClock();
    const interval = setInterval(updateClock, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return (
    <footer className="h-7 bg-slate-900 text-slate-400 text-[11px] font-medium px-3 flex items-center justify-between border-t border-slate-800 select-none flex-shrink-0 z-30">
      {/* Left: Storage & Sync Telemetry */}
      <div className="flex items-center gap-3">
        {/* Local Storage Offline Guarantee */}
        <div className="flex items-center gap-1.5 text-emerald-400 font-semibold" title={tr('IndexedDB Persistent Offline Engine Active')}>
          <HardDrive className="w-3 h-3 text-emerald-400" />
          <span className="hidden sm:inline">{tr('Offline DB:')}</span>
          <span>{tr('Ready (Local)')}</span>
        </div>

        <span className="text-slate-700">|</span>

        {/* Sync Heartbeat */}
        <div className="flex items-center gap-1.5" title={isOnline ? tr('Online: bills are saved on this computer') : tr('Offline mode: saving locally')}>
          {isOnline ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-slate-300">{tr('Online')}</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-amber-400" />
              <span className="text-amber-400 font-semibold">{tr('Offline (Local Only)')}</span>
            </>
          )}
        </div>

        {business?.name && (
          <>
            <span className="text-slate-700 hidden md:inline">|</span>
            <span className="text-slate-400 font-normal hidden md:inline truncate max-w-[150px]">
              {business.name}
            </span>
          </>
        )}
      </div>

      {/* Center: the keyboard shortcuts that actually work on this screen */}
      <div className="hidden lg:flex items-center gap-3 text-slate-400 text-[10.5px]">
        {(pathname === '/billing' ? BILLING_SHORTCUTS : GLOBAL_SHORTCUTS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono font-bold text-[9.5px]">{key}</kbd>
            <span>{tr(label)}</span>
          </div>
        ))}
      </div>

      {/* Right: Printer, Clock, Version */}
      <div className="flex items-center gap-3">
        {printer && (
          <>
            <div className="flex items-center gap-1.5 text-slate-300" title={printer.title}>
              <Printer className="w-3 h-3 text-slate-400" />
              <span className="hidden sm:inline">{tr('Printer:')}</span>
              <span className={`font-mono truncate max-w-[180px] ${printer.ok ? 'text-emerald-400' : 'text-amber-400'}`}>{printer.label}</span>
            </div>
            <span className="text-slate-700">|</span>
          </>
        )}

        {currentTime && (
          <div className="flex items-center gap-1 text-slate-300 font-mono">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>{currentTime}</span>
          </div>
        )}

        <span className="text-slate-700 hidden sm:inline">|</span>

        <button
          type="button"
          onClick={openWhatsNew}
          title={tr("What's new in KamaiPlus")}
          className="font-mono text-[10px] text-slate-400 hover:text-amber-400 hidden sm:inline cursor-pointer"
        >
          {tr('v')}{APP_VERSION}
        </button>
      </div>
    </footer>
  );
};
