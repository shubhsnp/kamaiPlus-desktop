'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Trash2, AlertTriangle, ShieldCheck, Cloud } from 'lucide-react';
import { tr } from '@/lib/i18n/core';
import { clearSalesAndAnalyticsHistory } from '@/lib/db';

interface ResetSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  salesCount: number;
  returnsCount: number;
  businessId?: string;
  hasCloudAccount: boolean;
  onSuccess: (res: { deletedSales: number; deletedReturns: number }) => void;
}

export const ResetSalesModal: React.FC<ResetSalesModalProps> = ({
  isOpen,
  onClose,
  salesCount,
  returnsCount,
  businessId,
  hasCloudAccount,
  onSuccess,
}) => {
  const [wipeCloud, setWipeCloud] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async () => {
    setIsResetting(true);
    setError(null);
    try {
      const res = await clearSalesAndAnalyticsHistory({
        wipeCloud: hasCloudAccount && wipeCloud,
        businessId,
      });
      onSuccess(res);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error resetting sales');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isResetting && onClose()}
      title={tr('Reset Sales & Bills History')}
    >
      <div className="space-y-4 pt-1">
        {/* Warning notice */}
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-900 dark:text-amber-200 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-black text-sm text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{tr('Are you sure you want to delete all sales history?')}</span>
          </div>
          <p className="leading-relaxed">
            {tr('All {salesCount} sales bills and {returnsCount} returns will be permanently deleted. Sales analytics and daily counters will reset to zero.', { salesCount, returnsCount })}
          </p>
        </div>

        {/* Safety Guarantee */}
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-900 dark:text-emerald-200 text-xs flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            {tr('Safe Data Guarantee: Product catalog, stock inventory, customers, and Khata ledgers remain untouched. Next invoice restarts from INV-001.')}
          </div>
        </div>

        {/* Cloud wipe option */}
        {hasCloudAccount && (
          <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 cursor-pointer">
            <input
              type="checkbox"
              checked={wipeCloud}
              onChange={(e) => setWipeCloud(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 accent-amber-600"
            />
            <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-medium">
              <Cloud className="w-3.5 h-3.5 text-blue-500" />
              <span>{tr('Also delete sales bills from Cloud Firestore')}</span>
            </div>
          </label>
        )}

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
            disabled={isResetting}
            className="rounded-xl text-xs"
          >
            {tr('Cancel')}
          </Button>

          <button
            type="button"
            onClick={handleReset}
            disabled={isResetting}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isResetting ? tr('Resetting History...') : tr('Yes, Clear Sales History')}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
