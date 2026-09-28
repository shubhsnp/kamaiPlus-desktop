'use client';

import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { BackupCheck, restoreDatabaseFromPayload } from '@/lib/backup/cloudBackupService';
import { runAutoBackup } from '@/lib/backup/autoBackup';
import { getDesktopApi } from '@/lib/desktop/desktopBridge';
import { showConfirm } from '@/lib/ui/dialogs';
import { tr } from '@/lib/i18n/core';

type OkCheck = Extract<BackupCheck, { ok: true }>;

/**
 * Restore a backup (v4.78.0): shows what the file holds (counted from the file), warns when
 * it is another shop's, saves the current data as today's automatic backup before a Clean
 * Replace, restores in one transaction and reloads the app so every screen shows the data.
 */
export function RestoreBackupModal({ check, currentShopName, onClose, onRestored }: { check: OkCheck; currentShopName: string; onClose: () => void; onRestored: (message: string) => void }) {
  const [mode, setMode] = useState<'clean' | 'merge'>('clean');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const c = check.counts;
  const otherShop = Boolean(check.shopName && currentShopName && check.shopName.trim().toLowerCase() !== currentShopName.trim().toLowerCase());
  const created = check.createdAt ? new Date(check.createdAt) : null;

  const restore = async () => {
    setBusy(true);
    setError('');
    try {
      // A way back: today's automatic backup is refreshed with the data as it is now.
      if (mode === 'clean' && getDesktopApi()) {
        const safety = await runAutoBackup({ force: true });
        if (safety.status === 'failed') {
          const go = await showConfirm(tr('Could not save a copy of the current data first ({error}). Restore anyway?', { error: safety.error }), { danger: true, confirmLabel: tr('Restore anyway') });
          if (!go) return;
        }
      }
      const res = await restoreDatabaseFromPayload(check.payload, mode);
      onRestored(res.message);
    } catch (err: any) {
      setError(err?.message || tr('Database restore failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={() => !busy && onClose()} title={tr('Verify & Confirm Database Restore')} description={tr('Review backup file contents before restoring onto your store.')} size="md">
      <div className="space-y-4 text-xs p-1" data-restore-modal>
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="font-black text-slate-900 text-sm">{tr('Store:')} {check.shopName || '—'}</div>
          <div className="text-[11px] text-slate-500 font-mono">
            {tr('Date:')} {created && !Number.isNaN(created.getTime()) ? created.toLocaleString('en-IN') : '—'}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-2 border-t border-slate-200 font-mono text-[11px] text-slate-700" data-restore-counts>
            <div>{tr('• Products:')} {c.products}</div>
            <div>{tr('• Customers:')} {c.customers}</div>
            <div>{tr('• Bills:')} {c.sales}</div>
            <div>{tr('• Khata:')} {c.ledger_transactions}</div>
            <div>{tr('• Returns:')} {c.sales_returns}</div>
            <div>{tr('• Suppliers:')} {c.suppliers}</div>
          </div>
        </div>

        {otherShop && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 font-bold flex gap-2" data-restore-other-shop>
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{tr('This backup is from "{backup}", not from "{current}". Check the file before restoring.', { backup: check.shopName, current: currentShopName })}</span>
          </div>
        )}

        <div>
          <label className="text-xs font-bold text-slate-800 block mb-1.5">{tr('Choose Restore Strategy:')}</label>
          <div className="space-y-2">
            <label className="flex items-start gap-2 p-2.5 rounded-xl border border-slate-300 cursor-pointer bg-white">
              <input type="radio" name="restoreMode" checked={mode === 'clean'} onChange={() => setMode('clean')} className="mt-0.5" data-restore-mode="clean" />
              <div>
                <div className="font-bold text-slate-900">{tr('Clean Replace (Recommended)')}</div>
                <div className="text-[10px] text-slate-500">{tr("The shop's data becomes exactly this backup. Your current data is saved first as today's automatic backup.")}</div>
              </div>
            </label>
            <label className="flex items-start gap-2 p-2.5 rounded-xl border border-slate-300 cursor-pointer bg-white">
              <input type="radio" name="restoreMode" checked={mode === 'merge'} onChange={() => setMode('merge')} className="mt-0.5" data-restore-mode="merge" />
              <div>
                <div className="font-bold text-slate-900">{tr('Add missing records only')}</div>
                <div className="text-[10px] text-slate-500">{tr('Adds bills, items and customers that are not here yet. Nothing already here is changed.')}</div>
              </div>
            </label>
          </div>
        </div>

        <p className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-semibold">
          <ShieldCheck className="w-3.5 h-3.5" /> {tr('All or nothing: if anything in the file fails, your data stays exactly as it is.')}
        </p>
        {error && <p className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-bold" data-restore-error>{error}</p>}

        <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
          <Button variant="outline" size="sm" disabled={busy} onClick={onClose}>{tr('Cancel')}</Button>
          <Button size="sm" onClick={() => void restore()} disabled={busy} className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold gap-1" data-restore-confirm>
            {busy && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            {busy ? tr('Restoring...') : tr('Confirm & Restore')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
