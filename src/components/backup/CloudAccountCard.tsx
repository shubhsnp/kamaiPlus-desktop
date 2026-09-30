'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, RefreshCw, UserRound } from 'lucide-react';
import { getDesktopApi } from '@/lib/desktop/desktopBridge';
import { CLOUD_ACCOUNT_EVENT, CloudAccount, connectGoogleAccount, getCloudAccount } from '@/lib/cloud/cloudAccount';
import { CLOUD_STATUS_EVENT, getCloudSendStatus, isCloudSendOn, needsFullPush, sendToCloudNow, setCloudSendOn } from '@/lib/cloud/cloudPush';
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

  const [sendOn, setSendOn] = useState(false);
  const [status, setStatus] = useState(getCloudSendStatus);

  useEffect(() => {
    const read = () => {
      setAccount(getCloudAccount());
      setSendOn(isCloudSendOn());
      setStatus(getCloudSendStatus());
    };
    read();
    setIsDesktop(Boolean(getDesktopApi()));
    const poll = window.setInterval(read, 5000); // the waiting count moves as the shop works
    window.addEventListener(CLOUD_ACCOUNT_EVENT, read);
    window.addEventListener(CLOUD_STATUS_EVENT, read);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener(CLOUD_ACCOUNT_EVENT, read);
      window.removeEventListener(CLOUD_STATUS_EVENT, read);
    };
  }, []);

  const toggleSend = () => {
    setCloudSendOn(!sendOn);
    setSendOn(!sendOn);
    if (!sendOn) void sendToCloudNow();
  };

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
      {account && !account.stub && (
        <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 text-[11px]" data-cloud-send>
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="font-bold text-slate-800">
              {tr('Send this shop to the cloud')} <span className="font-semibold text-amber-700">{tr('(beta — for testing)')}</span>
            </span>
            <input type="checkbox" checked={sendOn} onChange={toggleSend} className="w-4 h-4 accent-slate-900 cursor-pointer" />
          </label>
          {sendOn && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-slate-600">
              <span>
                {status.sending
                  ? tr('Sending…')
                  : needsFullPush()
                    ? tr('The first send (everything) is waiting.')
                    : status.lastSentAt
                      ? tr('Last sent {time} · {count} change(s) waiting', { time: new Date(status.lastSentAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), count: String(status.pending) })
                      : tr('{count} change(s) waiting', { count: String(status.pending) })}
              </span>
              <button type="button" onClick={() => void sendToCloudNow()} disabled={status.sending} className="h-7 px-2.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 font-bold text-slate-800 cursor-pointer disabled:opacity-60">
                {tr('Send now')}
              </button>
            </div>
          )}
          {sendOn && status.lastError && <div className="font-bold text-amber-800">{status.lastError}</div>}
        </div>
      )}
      <p className="text-[10.5px] text-slate-400">{tr('The mobile app reads what this computer sends. Changes made on the phone do not come here yet.')}</p>
    </div>
  );
}
