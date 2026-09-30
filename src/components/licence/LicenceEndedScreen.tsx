'use client';

import React, { useState } from 'react';
import { AlertCircle, CalendarClock, Loader2, RefreshCw, ShieldAlert, X } from 'lucide-react';
import { getDesktopApi, LicenceStatus } from '@/lib/desktop/desktopBridge';
import { tr } from '@/lib/i18n/core';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { SupportContactLine } from '@/components/support/SupportContact';
import { supportGreeting } from '@/lib/support/contact';

const dateText = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

/**
 * The key's end date has passed (v4.85.0 — set in the Admin Console). The shop's data
 * stays on this computer; after renewing, "Check again" fetches the new end date.
 */
export const LicenceEndedScreen: React.FC<{
  status: Extract<LicenceStatus, { state: 'expired' }>;
  onChecked: (s: LicenceStatus) => void;
}> = ({ status, onChecked }) => {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const checkAgain = async () => {
    const api = getDesktopApi();
    if (!api?.refreshLicence || busy) return;
    setBusy(true);
    setNote(null);
    const res = await api.refreshLicence().catch(() => null);
    setBusy(false);
    if (!res) return setNote(tr('Could not check. Please try again.'));
    if (res.status.state !== 'expired') return onChecked(res.status);
    setNote(res.offline
      ? tr('No internet. Connect to the internet and press "Check again".')
      : tr('The licence has not been renewed yet. Contact KamaiPlus support.'));
  };

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative">
      <LanguageSwitcher className="absolute top-4 right-4" />
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-7 shadow-2xl relative overflow-hidden space-y-5" data-licence-ended>
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-amber-400 to-rose-500" />

        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4 border border-slate-700">
            <ShieldAlert className="w-8 h-8 text-rose-400" />
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">{tr('Your KamaiPlus licence has ended')}</h1>
          <p className="text-sm text-slate-400 mt-1">
            {tr('Valid till {date}. Renew it with KamaiPlus support to continue.', { date: dateText(status.validUntil) })}
          </p>
        </div>

        <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-800 text-emerald-200 text-xs font-semibold">
          {tr('Your bills, items and khata are safe on this computer. Nothing is deleted.')}
        </div>

        {note && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs font-semibold flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{note}</span>
          </div>
        )}

        <button
          type="button"
          onClick={checkAgain}
          disabled={busy}
          className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed transition-colors"
          data-licence-check-again
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {busy ? tr('Checking…') : tr('Check again (after renewing)')}
        </button>

        <div className="pt-3 border-t border-slate-800 text-center text-xs text-slate-500 space-y-1.5">
          <div>{tr('To renew, contact KamaiPlus support:')}</div>
          <SupportContactLine
            className="text-slate-300"
            message={`${supportGreeting()}\n${tr('Please renew my KamaiPlus licence:')} ${status.key} (${status.shopName || status.machineName})`}
          />
        </div>
      </div>
    </main>
  );
};

/** A small note in the corner when the key ends within a week (v4.85.0); it can be closed. */
export const LicenceEndingNotice: React.FC<{ validUntil: string; daysLeft: number }> = ({ validUntil, daysLeft }) => {
  const [closed, setClosed] = useState(false);
  if (closed) return null;
  return (
    <div className="fixed bottom-12 right-4 z-50 max-w-xs p-3 rounded-xl bg-amber-50 border border-amber-300 shadow-lg text-xs text-amber-950 flex items-start gap-2" data-licence-ending>
      <CalendarClock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
      <div className="space-y-0.5">
        <p className="font-black">
          {daysLeft === 0 ? tr('Your licence ends today') : tr('Your licence ends in {days} days', { days: daysLeft })}
        </p>
        <p>{tr('Valid till {date}. Contact KamaiPlus support to renew.', { date: dateText(validUntil) })}</p>
      </div>
      <button type="button" onClick={() => setClosed(true)} className="p-0.5 text-amber-700 hover:text-amber-950 cursor-pointer" aria-label={tr('Close')}>
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
