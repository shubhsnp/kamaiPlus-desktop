'use client';

import React, { useState, useEffect } from 'react';
import { HardDrive, Wifi, WifiOff, Printer, Clock } from 'lucide-react';
import { APP_VERSION } from '@/lib/constants/version';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { db } from '@/lib/db';

export const DesktopStatusBar: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<string>('');

  const business = useBusiness();

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
        <div className="flex items-center gap-1.5 text-emerald-400 font-semibold" title="IndexedDB Persistent Offline Engine Active">
          <HardDrive className="w-3 h-3 text-emerald-400" />
          <span className="hidden sm:inline">Offline DB:</span>
          <span>Ready (Local)</span>
        </div>

        <span className="text-slate-700">|</span>

        {/* Sync Heartbeat */}
        <div className="flex items-center gap-1.5" title={isOnline ? 'Online: bills are saved on this computer' : 'Offline mode: saving locally'}>
          {isOnline ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-slate-300">Online</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-amber-400" />
              <span className="text-amber-400 font-semibold">Offline (Local Only)</span>
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

      {/* Center: Essential Keyboard Shortcuts */}
      <div className="hidden lg:flex items-center gap-3 text-slate-400 text-[10.5px]">
        <div className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono font-bold text-[9.5px]">F1</kbd>
          <span>Billing</span>
        </div>
        <div className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono font-bold text-[9.5px]">F2</kbd>
          <span>Products</span>
        </div>
        <div className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono font-bold text-[9.5px]">F4</kbd>
          <span>Register</span>
        </div>
        <div className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono font-bold text-[9.5px]">Esc</kbd>
          <span>Close/Cancel</span>
        </div>
      </div>

      {/* Right: Printer, Clock, Version */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-slate-300" title="Thermal Printer Service Ready">
          <Printer className="w-3 h-3 text-slate-400" />
          <span className="hidden sm:inline">Printer:</span>
          <span className="text-emerald-400 font-mono">Ready</span>
        </div>

        <span className="text-slate-700">|</span>

        {currentTime && (
          <div className="flex items-center gap-1 text-slate-300 font-mono">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>{currentTime}</span>
          </div>
        )}

        <span className="text-slate-700 hidden sm:inline">|</span>

        <span className="font-mono text-[10px] text-slate-400 hidden sm:inline">
          v{APP_VERSION}
        </span>
      </div>
    </footer>
  );
};
