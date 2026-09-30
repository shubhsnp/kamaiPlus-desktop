'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, RefreshCw, UserRound } from 'lucide-react';
import { getDesktopApi } from '@/lib/desktop/desktopBridge';
import { CLOUD_ACCOUNT_EVENT, CloudAccount, connectGoogleAccount, getCloudAccount } from '@/lib/cloud/cloudAccount';
import { tr } from '@/lib/i18n/core';

/**
 * Which Google account this shop's cloud belongs to (v4.84.0, Step 2). A new shop connects
 * it before setting the master password (AuthForm); a shop set up before that connects it
 * here. Cloud sync itself is still off — this only links the account.
 */
export function CloudAccountCard() {
  const [account, setAccount] = useState<CloudAccount | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const read = () => setAccount(getCloudAccount());
    read();
    setIsDesktop(Boolean(getDesktopApi()));
    window.addEventListener(CLOUD_ACCOUNT_EVENT, read);
    return () => window.removeEventListener(CLOUD_ACCOUNT_EVENT, read);
  }, []);

  if (!isDesktop) return null;

  const connect = async () => {
    setBusy(true);
    setError('');
    const res = await connectGoogleAccount();
    setBusy(false);
    if (!res.ok) setError(res.error);
  };

  return (
    <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-2.5" data-cloud-account>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center flex-shrink-0">
            <UserRound className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-black text-slate-900 leading-tight">{tr('Google Account')}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
              {account ? (
                <>
                  {tr('Connected:')} <span className="font-bold text-slate-800">{account.email || account.name}</span>
                </>
              ) : (
                tr('Not connected — connect the same Google account as the KamaiPlus mobile app.')
              )}
            </p>
          </div>
        </div>
        {account ? (
          <span className="h-8 px-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs flex items-center gap-1 shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {tr('Connected')}
          </span>
        ) : (
          <button
            type="button"
            onClick={connect}
            disabled={busy}
            className="h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span className="font-black leading-none">G</span>}
            {busy ? tr('Finish signing in in your browser…') : tr('Continue with Google')}
          </button>
        )}
      </div>
      {error && (
        <div className="px-3 py-2 rounded-lg text-[11px] font-bold flex items-center gap-2 bg-amber-50 text-amber-900 border border-amber-200">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <p className="text-[10.5px] text-slate-400">{tr('Online backup of the shop comes in a later update; for now this only links the account.')}</p>
    </div>
  );
}
