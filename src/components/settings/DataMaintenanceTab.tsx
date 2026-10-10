'use client';

import React, { useState } from 'react';
import { showAlert, showConfirm } from '@/lib/ui/dialogs';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, clearAllProductData, restoreStarterProductCatalog } from '@/lib/db';
import { Card } from '@/components/ui/Card';
import { 
  Trash2, 
  AlertTriangle, 
  Package, 
  RotateCcw, 
  CheckCircle2, 
  HardDrive, 
  ArrowRight, 
  Receipt,
  AlertOctagon
} from 'lucide-react';
import Link from 'next/link';
import { Business } from '@/types';
import { tr } from '@/lib/i18n/core';
import { getCloudAccount } from '@/lib/cloud/cloudAccount';
import { ResetSalesModal } from './ResetSalesModal';
import { FactoryResetModal } from './FactoryResetModal';
import { ClearProductsModal } from './ClearProductsModal';
import { DataHealthSummaryCards } from './DataHealthSummaryCards';
import { TestShopResetCard } from './TestShopResetCard';

interface DataMaintenanceTabProps {
  business: Business | null | undefined;
}

export const DataMaintenanceTab: React.FC<DataMaintenanceTabProps> = ({ business }) => {
  const productCount = useLiveQuery(async () => db.products.count()) ?? 0;
  const categoryCount = useLiveQuery(async () => db.categories.count()) ?? 0;
  const movementCount = useLiveQuery(async () => db.inventory_movements.count()) ?? 0;
  const salesCount = useLiveQuery(async () => db.sales.count()) ?? 0;
  const returnsCount = useLiveQuery(async () => db.sales_returns.count()) ?? 0;
  const customerCount = useLiveQuery(async () => db.customers.count()) ?? 0;

  const cloudAccount = getCloudAccount();
  const hasCloudAccount = Boolean(cloudAccount?.bizId);

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isResetSalesModalOpen, setIsResetSalesModalOpen] = useState(false);
  const [isFactoryResetModalOpen, setIsFactoryResetModalOpen] = useState(false);

  const [includeCategories, setIncludeCategories] = useState(false);
  const [wipeCloudProducts, setWipeCloudProducts] = useState(true);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleClearProducts = async () => {
    setIsCleaning(true);
    setFeedbackMessage(null);
    try {
      const res = await clearAllProductData({
        wipeCloud: hasCloudAccount && wipeCloudProducts,
        clearCategories: includeCategories,
      });
      setIsConfirmModalOpen(false);
      setFeedbackMessage({
        type: 'success',
        text: tr('Product catalog cleaned ({deletedCount} items removed).', { deletedCount: res.deletedCount }),
      });
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: tr('Error clearing products: {error}', { error: err?.message || 'Unknown error' }),
      });
    } finally {
      setIsCleaning(false);
    }
  };

  const handleRestoreStarterProducts = async () => {
    if (!business?.id) {
      showAlert(tr('Business profile not loaded.'));
      return;
    }
    if (!await showConfirm(tr('Restore sample products?'))) return;

    setIsRestoring(true);
    setFeedbackMessage(null);
    try {
      await restoreStarterProductCatalog(business.id);
      setFeedbackMessage({
        type: 'success',
        text: tr('Starter sample retail products successfully restored.'),
      });
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: tr('Error restoring sample products: {error}', { error: err?.message || 'Unknown error' }),
      });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-2xl flex items-start gap-3 border ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200'
          }`}
        >
          {feedbackMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 text-xs font-semibold">
            {feedbackMessage.text}
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-xs font-bold opacity-60 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Database Quick Health Summary */}
      <DataHealthSummaryCards
        productCount={productCount}
        salesCount={salesCount}
        customerCount={customerCount}
        movementCount={movementCount}
      />

      {/* Zone 1: Clean Product Catalog */}
      <Card className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
              {tr('Product Catalog Reset')}
            </h3>
          </div>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            {tr('Catalog Clean')}
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {tr('Remove all existing products and test inventory items to start a fresh catalog. Sales bills and Khata ledger remain safe.')}
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => setIsConfirmModalOpen(true)}
            disabled={productCount === 0 || isCleaning}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{tr('Clean All Products ({count})', { count: productCount })}</span>
          </button>

          <button
            type="button"
            onClick={handleRestoreStarterProducts}
            disabled={isRestoring}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-2 border border-slate-300 dark:border-slate-700 transition active:scale-95 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isRestoring ? tr('Seeding Catalog...') : tr('Restore Sample Products')}</span>
          </button>
        </div>
      </Card>

      {/* Zone 2: Reset Sales & Billing History */}
      <Card className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-amber-200/90 dark:border-amber-900/50 rounded-2xl shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
              {tr('Sales Bills & Transaction History Reset')}
            </h3>
          </div>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            {tr('Reset Bills & Analytics')}
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {tr('Delete old test bills and returns to start fresh billing. Next invoice number restarts from INV-001. Products and customers remain safe.')}
        </p>

        <div className="pt-1">
          <button
            type="button"
            onClick={() => setIsResetSalesModalOpen(true)}
            disabled={salesCount === 0}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{tr('Reset Sales Bills ({count})', { count: salesCount })}</span>
          </button>
        </div>
      </Card>

      {/* Zone 3: Complete Factory Reset (Start Fresh) */}
      <Card className="p-4 sm:p-5 bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 rounded-2xl shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-rose-200/60 dark:border-rose-900/60 pb-2.5">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-rose-600" />
            <h3 className="text-sm font-black text-rose-900 dark:text-rose-200">
              {tr('Complete Factory Reset (Start Fresh)')}
            </h3>
          </div>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-rose-100 text-rose-900 dark:bg-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-800">
            {tr('Full Wipe')}
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {tr('Wipe all operational data (products, bills, khata, cash register, expenses, purchases) to start fresh. Store Profile and PC Licence remain safe.')}
        </p>

        <div className="pt-1">
          <button
            type="button"
            onClick={() => setIsFactoryResetModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center gap-2 shadow-xs transition active:scale-95 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>{tr('Complete Factory Reset')}</span>
          </button>
        </div>
      </Card>

      {/* v4.142.0: only for the team's test Google accounts (the server decides) */}
      <TestShopResetCard />

      {/* Backup Recommendation Card */}
      <Card className="p-4 bg-gradient-to-r from-sky-50/50 to-indigo-50/50 dark:from-sky-950/20 dark:to-indigo-950/20 border border-sky-200/70 dark:border-sky-800/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-900/60 flex items-center justify-center text-sky-600 shrink-0 mt-0.5">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900 dark:text-slate-100">
              {tr('Download Backup First (Recommended)')}
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {tr('Download a backup before resetting data to keep a copy safe.')}
            </p>
          </div>
        </div>

        <Link
          href="/cloud-backup"
          className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300 hover:bg-sky-50 text-xs font-bold flex items-center gap-1.5 shadow-2xs self-start sm:self-center shrink-0 transition"
        >
          <span>{tr('Open Backup')}</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </Card>

      {/* Modal 1: Confirm Clear Product Data */}
      <ClearProductsModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        productCount={productCount}
        categoryCount={categoryCount}
        hasCloudAccount={hasCloudAccount}
        includeCategories={includeCategories}
        setIncludeCategories={setIncludeCategories}
        wipeCloudProducts={wipeCloudProducts}
        setWipeCloudProducts={setWipeCloudProducts}
        isCleaning={isCleaning}
        onConfirm={handleClearProducts}
      />

      {/* Modal 2: Reset Sales Bills History */}
      <ResetSalesModal
        isOpen={isResetSalesModalOpen}
        onClose={() => setIsResetSalesModalOpen(false)}
        salesCount={salesCount}
        returnsCount={returnsCount}
        businessId={business?.id}
        hasCloudAccount={hasCloudAccount}
        onSuccess={(res) => {
          setFeedbackMessage({
            type: 'success',
            text: tr('Sales history cleaned ({deletedSales} bills, {deletedReturns} returns removed). Invoice counter reset to INV-001.', {
              deletedSales: res.deletedSales,
              deletedReturns: res.deletedReturns,
            }),
          });
        }}
      />

      {/* Modal 3: Complete Factory Reset */}
      <FactoryResetModal
        isOpen={isFactoryResetModalOpen}
        onClose={() => setIsFactoryResetModalOpen(false)}
        businessId={business?.id}
        hasCloudAccount={hasCloudAccount}
        onSuccess={() => {
          setFeedbackMessage({
            type: 'success',
            text: tr('Complete Factory Reset successful! All operational data has been reset.'),
          });
        }}
      />
    </div>
  );
};
