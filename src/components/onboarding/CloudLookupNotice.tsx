'use client';

import React, { useState } from 'react';
import { Cloud, RefreshCw } from 'lucide-react';
import { connectGoogleAccount } from '@/lib/cloud/cloudAccount';
import { tr } from '@/lib/i18n/core';

/**
 * Store setup, one Google account = one shop on every device (v4.137.0). While this computer's
 * Google account is being looked up, the setup form waits ("Looking for your shop…") so an owner
 * whose shop is already on the phone is not shown a signup form. Without a Google account the
 * form shows with a way to connect it first.
 */
export function CloudLookupNotice({ checking, linked, onConnected }: { checking: boolean; linked: boolean; onConnected: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (checking) {
    return (
      <div className="mb-4 p-6 rounded-3xl bg-slate-900/90 border border-slate-800 text-center text-slate-300 text-sm flex flex-col items-center gap-3" data-cloud-lookup="checking">
        <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
        <span className="font-bold">{tr('Looking for your shop in your Google account…')}</span>
      </div>
    );
  }
  if (linked) return null;

  const connect = async () => {
    setBusy(true);
    setError('');
    const res = await connectGoogleAccount();
    setBusy(false);
    if (res.ok) onConnected();
    else setError(res.error);
  };

  return (
    <div className="mb-4 p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-100 text-xs flex flex-col sm:flex-row sm:items-center gap-3" data-cloud-lookup="connect">
      <Cloud className="w-5 h-5 text-sky-300 shrink-0" />
      <div className="flex-1">
        <div className="font-black text-white text-sm">{tr('Already using KamaiPlus on your phone?')}</div>
        <div className="text-sky-200/80">{tr('Connect the same Google account — your shop opens here with all its items, bills and khata.')}</div>
        {error && <div className="text-rose-300 mt-1">{error}</div>}
      </div>
      <button
        type="button"
        onClick={connect}
        disabled={busy}
        className="h-9 px-4 rounded-xl bg-white text-slate-900 font-black text-xs shrink-0 disabled:opacity-60"
      >
        {busy ? tr('Connecting…') : tr('Connect Google Account')}
      </button>
    </div>
  );
}
