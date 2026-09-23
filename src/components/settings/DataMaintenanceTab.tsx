'use client';

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { clearAllProductData, restoreStarterProductCatalog } from '@/lib/db';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { 
  Trash2, 
  AlertTriangle, 
  Package, 
  Layers, 
  RotateCcw, 
  CheckCircle2, 
  ShieldAlert, 
  HardDrive, 
  ArrowRight, 
  FileSpreadsheet,
  Plus
} from 'lucide-react';
import Link from 'next/link';
import { Business } from '@/types';

interface DataMaintenanceTabProps {
  business: Business | null | undefined;
}

export const DataMaintenanceTab: React.FC<DataMaintenanceTabProps> = ({ business }) => {
  const productCount = useLiveQuery(async () => db.products.count()) ?? 0;
  const categoryCount = useLiveQuery(async () => db.categories.count()) ?? 0;
  const movementCount = useLiveQuery(async () => db.inventory_movements.count()) ?? 0;

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [includeCategories, setIncludeCategories] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleClearProducts = async () => {
    setIsCleaning(true);
    setFeedbackMessage(null);
    try {
      const res = await clearAllProductData();
      if (includeCategories) {
        await db.categories.clear();
      }
      setIsConfirmModalOpen(false);
      setFeedbackMessage({
        type: 'success',
        text: `Saara Product data clean ho gaya hai! (${res.deletedCount} items removed from catalog). Ab aap naye fresh products add ya test kar sakte hain.`,
      });
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: `Error clearing products: ${err?.message || 'Unknown error'}`,
      });
    } finally {
      setIsCleaning(false);
    }
  };

  const handleRestoreStarterProducts = async () => {
    if (!business?.id) {
      alert('Business profile not loaded.');
      return;
    }
    if (!confirm('Sample retail products restore karna chahte hain?')) return;

    setIsRestoring(true);
    setFeedbackMessage(null);
    try {
      await restoreStarterProductCatalog(business.id);
      setFeedbackMessage({
        type: 'success',
        text: 'Starter sample retail products successfully restore ho gaye!',
      });
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: `Error restoring sample products: ${err?.message || 'Unknown error'}`,
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
            className="text-xs font-bold opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Catalog Overview Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Total Products
              </div>
              <div className="text-xl font-mono font-black text-slate-900 dark:text-slate-100">
                {productCount}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-sky-600">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Categories
              </div>
              <div className="text-xl font-mono font-black text-slate-900 dark:text-slate-100">
                {categoryCount}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Stock Movements
              </div>
              <div className="text-xl font-mono font-black text-slate-900 dark:text-slate-100">
                {movementCount}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Danger Zone: Clean Product Data */}
      <Card className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-950/70 rounded-2xl shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
              Product Catalog Reset (Danger Zone)
            </h3>
          </div>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            Irreversible Action
          </span>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Agar aap apni dukan ke puraane sabhi products aur test inventory items ko hatakar ekdum fresh catalog shuru karna chahte hain, toh yahan se saare products 1-click me clean kar sakte hain.
          </p>

          <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Important Notice:</span> Is action se aapke <strong>Sales Bills, Customers aur Khata Udhar ledger safely safe rahenge</strong> — sirf Product Master list aur local inventory stock movements clean hogi.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsConfirmModalOpen(true)}
              disabled={productCount === 0 || isCleaning}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center gap-2 shadow-xs transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clean All Product Data ({productCount} Items)</span>
            </button>

            <button
              type="button"
              onClick={handleRestoreStarterProducts}
              disabled={isRestoring}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-2 border border-slate-300 dark:border-slate-700 transition active:scale-95 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isRestoring ? 'Seeding Catalog...' : 'Restore Sample Products'}</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Backup Recommendation Card */}
      <Card className="p-4 sm:p-5 bg-gradient-to-r from-sky-50/50 to-indigo-50/50 dark:from-sky-950/20 dark:to-indigo-950/20 border border-sky-200/70 dark:border-sky-800/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-900/60 flex items-center justify-center text-sky-600 shrink-0 mt-0.5">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900 dark:text-slate-100">
              Download JSON Backup First (Recommended)
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Product data wipe karne se pehle poore database ka backup download karke rakh sakte hain.
            </p>
          </div>
        </div>

        <Link
          href="/cloud-backup"
          className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40 text-xs font-bold flex items-center gap-1.5 shadow-2xs self-start sm:self-center shrink-0 transition"
        >
          <span>Open Backup Center</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </Card>

      {/* Confirmation Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => !isCleaning && setIsConfirmModalOpen(false)}
        title="⚠️ Confirm Clear All Product Data"
      >
        <div className="space-y-4 pt-1">
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-900 dark:text-rose-200 text-xs space-y-1.5">
            <p className="font-black text-sm">
              Kya aap sach me saare products delete karna chahte hain?
            </p>
            <p className="leading-relaxed">
              Isse catalog ke sabhi <strong>{productCount} products</strong> permanently remove ho jayenge. Iske baad aap naye products manually add kar sakte hain ya Excel sheet se import kar sakte hain.
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
              Product Categories bhi delete karein ({categoryCount} categories)
            </span>
          </label>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsConfirmModalOpen(false)}
              disabled={isCleaning}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>

            <button
              type="button"
              onClick={handleClearProducts}
              disabled={isCleaning}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isCleaning ? 'Cleaning Catalog...' : 'Yes, Delete All Products'}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
