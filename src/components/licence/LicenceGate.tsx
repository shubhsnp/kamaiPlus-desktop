'use client';

import React, { useEffect, useState } from 'react';
import { KeyRound, Monitor, ShieldCheck, Loader2, AlertCircle, Wifi, Gift, Hourglass } from 'lucide-react';
import { getDesktopApi, LicenceStatus, TrialInfo } from '@/lib/desktop/desktopBridge';
import { tr } from '@/lib/i18n/core';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { SupportContactLine } from '@/components/support/SupportContact';
import { supportGreeting } from '@/lib/support/contact';
import { LicenceEndedScreen } from './LicenceEndedScreen';

/**
 * Nothing in the app opens until this computer holds a valid licence.
 *
 * KamaiPlus Desktop is sold for a fixed, one-time price: one key works on one
 * computer. v4.148.0: a NEW computer without a key can start the free trial the Admin
 * offers (days set in the Admin Console); when it ends, a key is asked for — the shop's
 * data stays. A computer with a key never sees the trial. The check itself runs in the Electron main
 * process (licence.js) — it verifies the signed licence file offline, so after
 * the one-time activation the shop never needs the internet for this.
 *
 * In a plain browser (`next dev` without Electron) there is no desktop bridge
 * and the gate steps aside, so development is not blocked.
 */
export const LicenceGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<LicenceStatus | 'checking' | 'no-desktop'>('checking');

  useEffect(() => {
    const api = getDesktopApi();
    if (!api) {
      setStatus('no-desktop');
      return;
    }
    api.getLicenceStatus()
      .then(setStatus)
      .catch(() => setStatus({ state: 'required', machineName: '' }));
    // v4.85.0: the main process re-checks while the app is open (end date passed, key
    // blocked or moved at an online check-in, or renewed).
    return api.onLicenceChanged?.(setStatus);
  }, []);

  if (status === 'checking') return <main className="min-h-screen bg-slate-950" />;
  if (status === 'no-desktop') return <>{children}</>;
  // The "licence ends within a week" note is a strip under the top bar (AdminMessageBanner, v4.98.0).
  if (status.state === 'active') return <>{children}</>;
  if (status.state === 'expired') {
    // v4.148.0: an ended free trial asks for a key; an ended key asks for a renewal (as before).
    if (status.trial) return <ActivationScreen status={{ state: 'required', machineName: status.machineName }} trialEnded onActivated={setStatus} />;
    return <LicenceEndedScreen status={status} onChecked={setStatus} />;
  }
  return <ActivationScreen status={status} onActivated={setStatus} />;
};

/**
 * The part after the fixed "KPD-" prefix, grouped as the shop types:
 * "7f3k9qxm" -> "7F3K-9QXM". A pasted full key ("KPD-7F3K-...") is accepted too.
 */
function formatKeyBody(raw: string): string {
  let s = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.length > 16 && s.startsWith('KPD')) s = s.slice(3);
  s = s.slice(0, 16);
  return (s.match(/.{1,4}/g) || []).join('-');
}

const ActivationScreen: React.FC<{
  status: Extract<LicenceStatus, { state: 'required' }>;
  onActivated: (s: LicenceStatus) => void;
  /** v4.148.0: the free trial ended — a key continues it. */
  trialEnded?: boolean;
}> = ({ status, onActivated, trialEnded = false }) => {
  const [keyBody, setKeyBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(status.reason || null);
  const [trial, setTrial] = useState<TrialInfo | null>(null);
  const [startingTrial, setStartingTrial] = useState(false);

  // v4.148.0: is a free trial offered to this computer? (Never asked once a trial has ended.)
  useEffect(() => {
    const api = getDesktopApi();
    if (trialEnded || !api?.getTrialInfo) return;
    let alive = true;
    api.getTrialInfo().then((t) => alive && setTrial(t)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [trialEnded]);
  const trialOffer = trial && 'available' in trial && trial.available ? trial : null;

  const handleStartTrial = async () => {
    const api = getDesktopApi();
    if (!api?.startTrial || startingTrial) return;
    setStartingTrial(true);
    setError(null);
    const result = await api.startTrial().catch(() => ({ ok: false as const, error: tr('The free trial could not start. Please try again.') }));
    if (result.ok) onActivated(result.status);
    else {
      setError(result.error);
      setStartingTrial(false);
    }
  };

  const complete = keyBody.replace(/-/g, '').length === 16;
  const key = `KPD-${keyBody}`;

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    const api = getDesktopApi();
    if (!api || !complete || busy) return;
    setBusy(true);
    setError(null);
    const result = await api.activateLicence(key).catch(() => ({ ok: false as const, error: tr('Activation failed. Please try again.') }));
    if (result.ok) {
      onActivated(result.status);
    } else {
      setError(result.error);
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative">
      <LanguageSwitcher className="absolute top-4 right-4" />
      <form
        onSubmit={handleActivate}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-7 shadow-2xl relative overflow-hidden space-y-5"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-emerald-400 to-amber-500" />

        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4 border border-slate-700">
            <ShieldCheck className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">{trialEnded ? tr('Your free trial has ended') : tr('Activate KamaiPlus Desktop')}</h1>
          <p className="text-sm text-slate-400 mt-1">
            {trialEnded
              ? tr('Enter your licence key to continue. Your bills, items and khata are safe on this computer.')
              : tr('Enter the licence key you received with your purchase.')}
          </p>
        </div>

        {trialOffer && (
          <div className="rounded-2xl border border-emerald-700/60 bg-emerald-950/40 p-4 space-y-3" data-trial-offer>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-300 flex items-center justify-center shrink-0"><Gift className="w-5 h-5" /></div>
              <div>
                <div className="text-sm font-black text-white">{tr('Try KamaiPlus free for {days} days', { days: trialOffer.days })}</div>
                <div className="text-xs text-emerald-100/70 leading-relaxed mt-0.5">{tr('No key needed now. When the trial ends, enter a licence key to continue — your data stays.')}</div>
              </div>
            </div>
            <button type="button" onClick={handleStartTrial} disabled={startingTrial}
              className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-black text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors" data-trial-start>
              {startingTrial ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hourglass className="w-4 h-4" />}
              {startingTrial ? tr('Starting…') : tr('Start free trial')}
            </button>
            <div className="flex items-center gap-3 text-[11px] text-slate-500 font-semibold">
              <span className="h-px flex-1 bg-slate-800" />{tr('or activate with your licence key')}<span className="h-px flex-1 bg-slate-800" />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="licence-key" className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            {tr('Licence key')}
          </label>
          <div className="flex items-center h-12 rounded-xl bg-slate-950 border border-slate-700 focus-within:border-amber-400 overflow-hidden">
            <span className="pl-4 pr-1 text-lg font-mono tracking-wider text-slate-500 select-none">KPD-</span>
            <input
              id="licence-key"
              autoFocus={!trialOffer}
              spellCheck={false}
              autoComplete="off"
              value={keyBody}
              onChange={(e) => {
                setKeyBody(formatKeyBody(e.target.value));
                setError(null);
              }}
              placeholder={tr('XXXX-XXXX-XXXX-XXXX')}
              className="flex-1 min-w-0 h-full pr-4 bg-transparent text-white text-lg font-mono tracking-wider placeholder:text-slate-600 focus:outline-none"
            />
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs font-semibold flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={!complete || busy}
          className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed transition-colors"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          {busy ? tr('Activating…') : tr('Activate')}
        </button>

        <div className="space-y-2 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{tr('Internet is needed only this once. After that the app works fully offline.')}</span>
          </div>
          {status.machineName && (
            <div className="flex items-center gap-2">
              <Monitor className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>
                {tr('The key will be locked to this computer:')} <span className="font-bold text-slate-200">{status.machineName}</span>
              </span>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-slate-800 text-center text-xs text-slate-500 space-y-1.5">
          <div>{tr('Need a key or moving to a new computer? Contact KamaiPlus support:')}</div>
          <SupportContactLine
            className="text-slate-300"
            message={`${supportGreeting()}\n${tr('I need a licence key for this computer:')} ${status.machineName || '—'}`}
          />
        </div>
      </form>
    </main>
  );
};
