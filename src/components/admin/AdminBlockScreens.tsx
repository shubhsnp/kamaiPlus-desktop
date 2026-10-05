'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, Lock, PauseCircle, RefreshCw } from 'lucide-react';
import { getDesktopApi, UpdateStatus } from '@/lib/desktop/desktopBridge';
import { SupportContactLine } from '@/components/support/SupportContact';
import { tr } from '@/lib/i18n/core';

/*
 * What the Admin Console's remote control can put over the app (v4.105.0, AdminControlHost):
 * a lock (the whole app, data untouched), "update required" and "billing paused" (read-only:
 * the counter only). Every one says why and how to reach KamaiPlus support.
 */

const Shell: React.FC<{ children: React.ReactNode; tone: 'rose' | 'indigo' | 'amber'; testId: string }> = ({ children, tone, testId }) => (
  <div className="fixed inset-0 z-[90] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4" role="alertdialog" aria-modal="true" data-admin-block={testId}>
    <div className={`w-full max-w-md bg-white rounded-2xl shadow-2xl border-t-4 ${tone === 'rose' ? 'border-rose-600' : tone === 'indigo' ? 'border-indigo-600' : 'border-amber-500'} p-6 text-center space-y-3`}>
      {children}
    </div>
  </div>
);

export const AdminLockScreen: React.FC<{ reason?: string }> = ({ reason }) => (
  <Shell tone="rose" testId="locked">
    <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
      <Lock className="w-6 h-6" />
    </div>
    <h2 className="text-base font-black text-slate-900">{tr('KamaiPlus is paused on this computer')}</h2>
    <p className="text-sm text-slate-700 whitespace-pre-line break-words">{reason || tr('Please contact KamaiPlus support.')}</p>
    <p className="text-[11px] text-slate-500">{tr('Your shop data is safe on this computer. The app opens again as soon as KamaiPlus support releases it.')}</p>
    <SupportContactLine message={tr('Hello KamaiPlus, my Desktop app is paused. Please help.')} className="text-xs" />
  </Shell>
);

export const UpdateRequiredScreen: React.FC<{ current?: string; required?: string }> = ({ current, required }) => {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const api = getDesktopApi();
    if (!api) return;
    void api.getUpdateStatus().then(setStatus).catch(() => {});
    const off = api.onUpdateReady?.(() => void api.getUpdateStatus().then(setStatus).catch(() => {}));
    // Look for it now — the shop should not wait for the hourly check.
    void api.checkForUpdates?.().then((r) => r && 'status' in r && r.status && setStatus(r.status as UpdateStatus)).catch(() => {});
    return () => off?.();
  }, []);
  const api = getDesktopApi();
  const ready = status?.readyVersion;
  const check = async () => {
    if (!api) return;
    setBusy(true);
    try {
      const r = await api.checkForUpdates?.();
      if (r && 'status' in r && r.status) setStatus(r.status as UpdateStatus);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell tone="indigo" testId="update">
      <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center mx-auto">
        <Download className="w-6 h-6" />
      </div>
      <h2 className="text-base font-black text-slate-900">{tr('Please update KamaiPlus')}</h2>
      <p className="text-sm text-slate-700">{tr('This computer has version {current}. KamaiPlus support needs version {required} or newer here.', { current: current || '?', required: required || '?' })}</p>
      {ready ? (
        <button type="button" onClick={() => void api?.installUpdate()} className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black cursor-pointer" data-admin-update-install>
          {tr('Restart & update to {version}', { version: ready })}
        </button>
      ) : (
        <>
          <p className="text-xs text-slate-500">{status?.lastCheck?.result === 'downloading' ? tr('Downloading the update… this can take a few minutes.') : tr('Checking for the update. Keep the internet on.')}</p>
          <button type="button" disabled={busy} onClick={() => void check()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 text-slate-800 text-xs font-bold cursor-pointer disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} /> {tr('Check again')}
          </button>
        </>
      )}
      <SupportContactLine message={tr('Hello KamaiPlus, my Desktop app asks for an update. Please help.')} className="text-xs" />
    </Shell>
  );
};

export const BillingPausedScreen: React.FC<{ reason?: string }> = ({ reason }) => (
  <Shell tone="amber" testId="read-only">
    <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
      <PauseCircle className="w-6 h-6" />
    </div>
    <h2 className="text-base font-black text-slate-900">{tr('New bills are paused')}</h2>
    <p className="text-sm text-slate-700 whitespace-pre-line break-words">{reason || tr('KamaiPlus support has paused billing on this computer for now.')}</p>
    <p className="text-[11px] text-slate-500">{tr('You can still look at bills, khata, stock and reports.')}</p>
    <Link href="/" className="inline-block px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold">{tr('Go to Home')}</Link>
    <SupportContactLine message={tr('Hello KamaiPlus, billing is paused on my Desktop app. Please help.')} className="text-xs" />
  </Shell>
);
