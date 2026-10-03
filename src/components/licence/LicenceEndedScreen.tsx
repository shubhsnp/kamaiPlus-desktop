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

/**
 * The key ends within a week (v4.85.0). v4.98.0: a strip under the top bar (with the Admin's
 * messages, AdminMessageBanner) — as a corner note it covered "Complete Sale" on the billing
 * counter. WhatsApp / email to renew with the key filled in; red in the last 2 days; ✕ hides it
 * until the app opens again. A renewal or a new day while the app is open updates it (main.js
 * sends any change of the end date / days left).
 */
export const LicenceEndingNotice: React.FC<{ validUntil: string; daysLeft: number; licenceKey: string; shopName: string }> = ({ validUntil, daysLeft, licenceKey, shopName }) => {
  const [closed, setClosed] = useState(false);
  if (closed) return null;
  const last = daysLeft <= 2;
  const when = daysLeft <= 0 ? tr('Your licence ends today') : daysLeft === 1 ? tr('Your licence ends tomorrow') : tr('Your licence ends in {days} days', { days: daysLeft });
  return (
    <div
      role="status"
      className={`flex items-start gap-2.5 px-3.5 py-1.5 rounded-xl border text-[13px] ${last ? 'bg-rose-50 border-rose-300 text-rose-950' : 'bg-amber-50 border-amber-300 text-amber-950'}`}
      data-licence-ending={last ? 'last-days' : 'week'}
    >
      <CalendarClock className={`w-4 h-4 shrink-0 mt-0.5 ${last ? 'text-rose-600' : 'text-amber-600'}`} />
      <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-3 gap-y-0.5">
        <span>
          <span className="font-black">{when}</span> · {tr('Valid till {date}. Renew now so billing does not stop:', { date: dateText(validUntil) })}
        </span>
        <SupportContactLine
          className="!justify-start text-slate-700 text-xs"
          message={`${supportGreeting()}\n${tr('Please renew my KamaiPlus licence:')} ${licenceKey} (${shopName})`}
        />
      </div>
      <button type="button" onClick={() => setClosed(true)} className="p-0.5 opacity-70 hover:opacity-100 cursor-pointer" aria-label={tr('Close')} data-licence-ending-close>
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
