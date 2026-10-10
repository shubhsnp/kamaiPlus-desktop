'use client';

import React, { useEffect, useState } from 'react';
import { FlaskConical, RotateCcw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { tr } from '@/lib/i18n/core';
import { getCloudAccount } from '@/lib/cloud/cloudAccount';
import { isTestShopAccount, resetTestShop } from '@/lib/cloud/testShopReset';

/**
 * v4.142.0 "Reset test shop" — shows ONLY when the server says this shop's Google account is one of the
 * team's test accounts (lib/cloud/testShopReset.ts). Erases the cloud shop (no tombstone, the Gmail is
 * not blocked) and empties this PC like a new install (the licence is kept), so testing starts again
 * from signup. A real shop never sees it.
 */
export const TestShopResetCard: React.FC = () => {
  const [isTest, setIsTest] = useState(false);
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const email = getCloudAccount()?.email || '';

  useEffect(() => {
    let alive = true;
    if (!getCloudAccount()) return;
    isTestShopAccount().then((v) => alive && setIsTest(v));
    return () => {
      alive = false;
    };
  }, []);

  if (!isTest) return null;

  const canProceed = confirmText.trim().toUpperCase() === 'RESET';

  const run = async () => {
    if (!canProceed || busy) return;
    setBusy(true);
    setError(null);
    const r = await resetTestShop();
    // On success the app restarts by itself; the dialog stays on "Resetting…" until then.
    if (!r.ok) {
      setError(r.error);
      setBusy(false);
    }
  };

  return (
    <>
      <Card
        data-testid="test-shop-reset-card"
        className="p-4 sm:p-5 bg-amber-50/50 dark:bg-amber-950/20 border border-dashed border-amber-300 dark:border-amber-800 rounded-2xl shadow-2xs space-y-3"
      >
        <div className="flex items-center justify-between border-b border-amber-200/70 dark:border-amber-900/60 pb-2.5">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-black text-amber-900 dark:text-amber-200">{tr('Reset test shop')}</h3>
          </div>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
            {tr('Test account')}
          </span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {tr('{email} is a test account. This erases the whole shop from the cloud and from this computer, so you can sign up again from the start. The Gmail stays usable. The licence on this computer is kept.', { email })}
        </p>
        <div className="pt-1">
          <button
            type="button"
            onClick={() => {
              setConfirmText('');
              setError(null);
              setOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs flex items-center gap-2 shadow-xs transition active:scale-95 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{tr('Reset test shop')}</span>
          </button>
        </div>
      </Card>

      <Modal isOpen={open} onClose={() => !busy && setOpen(false)} title={tr('Reset test shop')}>
        <div className="space-y-4 pt-1">
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl text-amber-950 dark:text-amber-100 text-xs space-y-1.5 leading-relaxed">
            <p className="font-bold">{tr('Everything of this shop is erased: cloud and this computer.')}</p>
            <p>{tr('Other phones / computers signed in with this Gmail: press "Reset test shop" there too before you sign up again, or their old data goes back up.')}</p>
            <p>{tr('A backup file is saved in Documents\\KamaiPlus first.')}</p>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{tr('Type {word} to confirm:', { word: 'RESET' })}</label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && run()}
              placeholder="RESET"
              disabled={busy}
              autoFocus
              className="w-full px-3.5 py-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/30 dark:bg-slate-800 text-sm font-mono font-black text-amber-800 dark:text-amber-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500 uppercase"
            />
          </div>
          {error && <div className="p-2.5 rounded-lg bg-rose-50 text-rose-800 text-xs font-semibold">{error}</div>}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy} className="rounded-xl text-xs">
              {tr('Cancel')}
            </Button>
            <button
              type="button"
              onClick={run}
              disabled={!canProceed || busy}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95 disabled:opacity-40 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{busy ? tr('Resetting…') : tr('Reset test shop')}</span>
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
