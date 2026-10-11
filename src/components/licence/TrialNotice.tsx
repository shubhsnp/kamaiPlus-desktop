'use client';

import React, { useState } from 'react';
import { Hourglass, KeyRound, Loader2, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { getDesktopApi } from '@/lib/desktop/desktopBridge';
import { tr } from '@/lib/i18n/core';
import { SupportContactLine } from '@/components/support/SupportContact';
import { supportGreeting } from '@/lib/support/contact';

/** "KPD-" + the 16 key characters as the shop types them (the activation screen's format). */
function formatKeyBody(raw: string): string {
  let s = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.length > 16 && s.startsWith('KPD')) s = s.slice(3);
  s = s.slice(0, 16);
  return (s.match(/.{1,4}/g) || []).join('-');
}

/**
 * v4.148.0 — while the free trial runs: a strip with the days left and "Enter licence key" (the key
 * replaces the trial at once; the shop's data stays). ✕ hides it until the app opens again, except in the
 * last 3 days.
 */
export function TrialNotice({ daysLeft, machineName }: { daysLeft: number; machineName: string }) {
  const [closed, setClosed] = useState(false);
  const [open, setOpen] = useState(false);
  const [keyBody, setKeyBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urgent = daysLeft <= 3;
  if (closed && !urgent) return null;

  const when = daysLeft <= 0 ? tr('Free trial ends today') : daysLeft === 1 ? tr('Free trial: 1 day left') : tr('Free trial: {days} days left', { days: daysLeft });
  const complete = keyBody.replace(/-/g, '').length === 16;

  const activate = async (e: React.FormEvent) => {
    e.preventDefault();
    const api = getDesktopApi();
    if (!api || !complete || busy) return;
    setBusy(true);
    setError(null);
    const r = await api.activateLicence(`KPD-${keyBody}`).catch(() => ({ ok: false as const, error: tr('Activation failed. Please try again.') }));
    if (r.ok) {
      window.location.reload(); // the licence gate reads the new licence
      return;
    }
    setError(r.error);
    setBusy(false);
  };

  return (
    <>
      <div role="status" className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl border text-[13px] ${urgent ? 'bg-amber-50 border-amber-300 text-amber-950' : 'bg-emerald-50 border-emerald-200 text-emerald-950'}`} data-trial-notice>
        <Hourglass className="w-4 h-4 shrink-0" />
        <span className="flex-1 min-w-0 truncate"><span className="font-black">{when}</span> · {tr('Enter a licence key any time — your data stays.')}</span>
        <button type="button" onClick={() => setOpen(true)} className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0" data-trial-enter-key>
          <KeyRound className="w-3.5 h-3.5" /> {tr('Enter licence key')}
        </button>
        {!urgent && (
          <button type="button" onClick={() => setClosed(true)} className="p-0.5 opacity-70 hover:opacity-100 cursor-pointer" aria-label={tr('Close')}>
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <Modal isOpen={open} onClose={() => !busy && setOpen(false)} title={tr('Enter licence key')} description={tr('The key replaces the free trial on this computer. Nothing is deleted.')} size="sm">
        <form onSubmit={activate} className="space-y-3" data-trial-key-form>
          <div className="flex items-center h-12 rounded-xl border border-slate-300 focus-within:border-amber-500 overflow-hidden">
            <span className="pl-4 pr-1 text-lg font-mono tracking-wider text-slate-400 select-none">KPD-</span>
            <input autoFocus spellCheck={false} autoComplete="off" value={keyBody} onChange={(e) => { setKeyBody(formatKeyBody(e.target.value)); setError(null); }}
              placeholder="XXXX-XXXX-XXXX-XXXX" aria-label={tr('Licence key')}
              className="flex-1 min-w-0 h-full pr-4 bg-transparent text-lg font-mono tracking-wider focus:outline-none" />
          </div>
          {error && <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>}
          <button type="submit" disabled={!complete || busy}
            className="w-full h-11 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-200 disabled:text-slate-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 cursor-pointer">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            {busy ? tr('Activating…') : tr('Activate')}
          </button>
          <div className="text-center text-xs text-slate-500 space-y-1">
            <div>{tr('Need a key? Contact KamaiPlus support:')}</div>
            <SupportContactLine message={`${supportGreeting()}\n${tr('I need a licence key for this computer:')} ${machineName || '—'}`} />
          </div>
        </form>
      </Modal>
    </>
  );
}
