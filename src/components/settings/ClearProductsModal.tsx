'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Trash2, Cloud } from 'lucide-react';
import { tr } from '@/lib/i18n/core';

interface ClearProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  productCount: number;
  categoryCount: number;
  hasCloudAccount: boolean;
  includeCategories: boolean;
  setIncludeCategories: (val: boolean) => void;
  wipeCloudProducts: boolean;
  setWipeCloudProducts: (val: boolean) => void;
  isCleaning: boolean;
  onConfirm: () => void;
}

export const ClearProductsModal: React.FC<ClearProductsModalProps> = ({
  isOpen,
  onClose,
  productCount,
  categoryCount,
  hasCloudAccount,
  includeCategories,
  setIncludeCategories,
  wipeCloudProducts,
  setWipeCloudProducts,
  isCleaning,
  onConfirm,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isCleaning && onClose()}
      title={tr('Confirm Clear All Product Data')}
    >
      <div className="space-y-4 pt-1">
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-900 dark:text-rose-200 text-xs space-y-1.5">
          <p className="font-black text-sm">
            {tr('Are you sure you want to delete all products?')}
          </p>
          <p className="leading-relaxed">
            {tr('This will permanently remove all {count} products from the catalog. Sales bills and Khata ledger remain safe.', { count: productCount })}
          </p>
        </div>

        <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 cursor-pointer">
          <input
            type="checkbox"
            checked={includeCategories}
            onChange={(e) => setIncludeCategories(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 accent-rose-600"
          />
          <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
            {tr('Also delete product categories ({count})', { count: categoryCount })}
          </span>
        </label>

        {hasCloudAccount && (
          <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 cursor-pointer">
            <input
              type="checkbox"
              checked={wipeCloudProducts}
              onChange={(e) => setWipeCloudProducts(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 accent-rose-600"
            />
            <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-medium">
              <Cloud className="w-3.5 h-3.5 text-blue-500" />
              <span>{tr('Delete from Cloud Firestore as well')}</span>
            </div>
          </label>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isCleaning}
            className="rounded-xl text-xs"
          >
            {tr('Cancel')}
          </Button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isCleaning}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isCleaning ? tr('Cleaning Catalog...') : tr('Yes, Delete All Products')}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
