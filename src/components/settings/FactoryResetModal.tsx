'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Trash2, AlertOctagon, ShieldAlert, Cloud } from 'lucide-react';
import { tr } from '@/lib/i18n/core';
import { completeFactoryReset } from '@/lib/db';

interface FactoryResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId?: string;
  hasCloudAccount: boolean;
  onSuccess: () => void;
}

export const FactoryResetModal: React.FC<FactoryResetModalProps> = ({
  isOpen,
  onClose,
  businessId,
  hasCloudAccount,
  onSuccess,
}) => {
  const [wipeCloud, setWipeCloud] = useState(true);
  const [confirmText, setConfirmText] = useState('');
  const [isWiping, setIsWiping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canProceed = confirmText.trim().toUpperCase() === 'RESET';

  const handleFactoryReset = async () => {
    if (!canProceed) return;
    setIsWiping(true);
    setError(null);
    try {
      await completeFactoryReset({
        preserveStoreProfile: true,
        wipeCloud: hasCloudAccount && wipeCloud,
        businessId,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error executing factory reset');
    } finally {
      setIsWiping(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isWiping && onClose()}
      title={tr('Complete Factory Reset')}
    >
      <div className="space-y-4 pt-1">
        {/* Extreme Danger Warning */}
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl text-rose-950 dark:text-rose-200 text-xs space-y-2">
          <div className="flex items-center gap-2 font-black text-sm text-rose-700 dark:text-rose-300">
            <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{tr('Irreversible Factory Data Wipe')}</span>
          </div>
          <p className="leading-relaxed">
            {tr('This action will completely reset your POS store. The following operational data will be permanently deleted:')}
          </p>
          <ul className="list-disc list-inside space-y-1 font-semibold text-rose-900 dark:text-rose-200 pl-1">
            <li>{tr('All Products & Stock Inventory')}</li>
            <li>{tr('All Sales Bills & Transaction History')}</li>
            <li>{tr('All Customers & Khata Udhar Ledgers')}</li>
            <li>{tr('All Cash Drawer Shifts & Expenses')}</li>
            <li>{tr('All Supplier Purchase Bills & Purchase Orders')}</li>
          </ul>
        </div>

        {/* What is safe */}
        <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-blue-900 dark:text-blue-200 text-xs flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold">{tr('Store Profile & Licence Remain Safe:')}</span>{' '}
            {tr('Store Name, Owner Details, GSTIN, UPI details, and PC Machine Licence will never be deleted.')}
          </div>
        </div>

        {/* Cloud wipe option */}
        {hasCloudAccount && (
          <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 cursor-pointer">
            <input
              type="checkbox"
              checked={wipeCloud}
              onChange={(e) => setWipeCloud(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 accent-rose-600"
            />
            <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-medium">
              <Cloud className="w-3.5 h-3.5 text-blue-500" />
              <span>{tr('Wipe all collections from Cloud Firestore as well')}</span>
            </div>
          </label>
        )}

        {/* Type RESET to confirm */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            {tr('Type {word} to confirm:', { word: 'RESET' })}
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="RESET"
            disabled={isWiping}
            className="w-full px-3.5 py-2 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50/30 dark:bg-slate-800 text-sm font-mono font-black text-rose-700 dark:text-rose-300 focus:outline-hidden focus:ring-2 focus:ring-rose-500 uppercase"
          />
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-rose-50 text-rose-800 text-xs font-semibold">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isWiping}
            className="rounded-xl text-xs"
          >
            {tr('Cancel')}
          </Button>

          <button
            type="button"
            onClick={handleFactoryReset}
            disabled={!canProceed || isWiping}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95 disabled:opacity-40 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isWiping ? tr('Wiping Complete Data...') : tr('Start Fresh / Complete Reset')}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
