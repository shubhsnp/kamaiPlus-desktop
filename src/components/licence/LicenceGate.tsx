'use client';

import React, { useEffect, useState } from 'react';
import { KeyRound, Monitor, ShieldCheck, Loader2, AlertCircle, Wifi } from 'lucide-react';
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
  // v4.148.0 (Rahul: no trial button — the shop just signs up): a computer without a key
  // starts / takes back its free trial by itself; only when that is not possible the key screen shows.
  const [trialNote, setTrialNote] = useState<string | null | undefined>(undefined);

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
  if (!status.reason && trialNote === undefined) {
    return <TrialAutoStart onStarted={setStatus} onNotStarted={(note) => setTrialNote(note)} />;
  }
  return <ActivationScreen status={trialNote ? { ...status, reason: status.reason || trialNote } : status} onActivated={setStatus} />;
};

/**
 * v4.148.0 — no button: asks the server whether this computer has (or may start) a free trial and
 * starts it at once, then the normal signup (master password → store setup) follows. Not possible
 * (trial off, used up, no internet) → the key screen, with a note only when the internet was missing.
 */
const TrialAutoStart: React.FC<{ onStarted: (s: LicenceStatus) => void; onNotStarted: (note: string | null) => void }> = ({ onStarted, onNotStarted }) => {
  useEffect(() => {
    let alive = true;
    (async () => {
      const api = getDesktopApi();
      if (!api?.getTrialInfo || !api.startTrial) return onNotStarted(null);
      const info: TrialInfo = await api.getTrialInfo().catch(() => ({ offline: true as const }));
      if (!alive) return;
      if ('offline' in info) return onNotStarted(tr('No internet. Connect to the internet and open KamaiPlus again to start — or enter your licence key.'));
      if (!('available' in info)) return onNotStarted(null);
      const running = info.used && info.endsAt && Date.parse(info.endsAt) > Date.now();
      if (!info.available && !running) return onNotStarted(null);
      const res = await api.startTrial().catch(() => null);
      if (!alive) return;
      if (res && res.ok) onStarted(res.status);
      else onNotStarted(res && !res.ok ? res.error : null);
    })();
    return () => {
      alive = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center" data-trial-auto>
      <div className="flex items-center gap-2.5 text-slate-400 text-sm font-semibold">
        <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> {tr('Getting KamaiPlus ready…')}
      </div>
    </main>
  );
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

        <div className="space-y-1.5">
          <label htmlFor="licence-key" className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            {tr('Licence key')}
          </label>
          <div className="flex items-center h-12 rounded-xl bg-slate-950 border border-slate-700 focus-within:border-amber-400 overflow-hidden">
            <span className="pl-4 pr-1 text-lg font-mono tracking-wider text-slate-500 select-none">KPD-</span>
            <input
              id="licence-key"
              autoFocus
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
