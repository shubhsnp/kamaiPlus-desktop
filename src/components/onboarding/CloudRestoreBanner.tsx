'use client';

import React, { useState } from 'react';
import { Cloud, ArrowRight, Store, Phone, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { tr } from '@/lib/i18n/core';
import { Button } from '@/components/ui/Button';
import { DetectedCloudStore, restoreCloudStoreToLocal } from './cloudStoreRestore';

interface CloudRestoreBannerProps {
  store: DetectedCloudStore;
  router: { replace: (url: string) => void };
  onDismiss: () => void;
}

export function CloudRestoreBanner({ store, router, onDismiss }: CloudRestoreBannerProps) {
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const handleRestore = async () => {
    setIsRestoring(true);
    setRestoreError(null);
    try {
      await restoreCloudStoreToLocal(store, router);
    } catch (err: any) {
      console.error('Failed to restore store:', err);
      setRestoreError(err?.message || tr('Failed to restore store from cloud. Please try again.'));
      setIsRestoring(false);
    }
  };

  return (
    <div className="mb-6 p-5 rounded-3xl bg-gradient-to-br from-indigo-950/80 via-slate-900 to-indigo-950/40 border border-indigo-500/30 shadow-2xl backdrop-blur-xl relative overflow-hidden">
      {/* Glow highlight */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-start justify-between gap-3 relative z-10 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center shrink-0 shadow-inner">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-wider mb-0.5">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>{tr('Existing Cloud Store Found')}</span>
            </div>
            <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
              <span>{store.businessName}</span>
            </h3>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-slate-500 hover:text-slate-300 underline cursor-pointer font-medium px-2 py-1"
        >
          {tr('Setup New Instead')}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2 px-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs mb-4">
        <div className="flex items-center gap-1.5 text-slate-300">
          <Store className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="truncate">{store.ownerName}</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-300 font-mono">
          <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{store.phone}</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400 capitalize">
          <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="truncate">{store.businessType}</span>
        </div>
      </div>

      {restoreError && (
        <div className="mb-3 text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
          {restoreError}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-2.5">
        <Button
          type="button"
          onClick={handleRestore}
          disabled={isRestoring}
          className="w-full sm:w-auto flex-1 py-3 bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-black text-xs rounded-xl shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 cursor-pointer"
        >
          {isRestoring ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{tr('Restoring Store & Catalog...')}</span>
            </>
          ) : (
            <>
              <Cloud className="w-4 h-4" />
              <span>{tr('Restore This Store & Launch POS')}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>

        <button
          type="button"
          onClick={onDismiss}
          className="w-full sm:w-auto px-4 py-2.5 text-xs text-slate-400 hover:text-white rounded-xl border border-slate-800 hover:bg-slate-800/50 transition cursor-pointer font-semibold"
        >
          {tr('Create Different Shop')}
        </button>
      </div>
    </div>
  );
}
