'use client';

import React from 'react';
import Link from 'next/link';
import { EyeOff, Settings } from 'lucide-react';
import { FEATURES, featureForPath, useFeatureSwitches } from '@/lib/features/featureSwitches';
import { tr } from '@/lib/i18n/core';

/**
 * Wraps every shop page (AppShell). A screen switched off in Settings → Features
 * (menu item already hidden) shows this card instead when it is opened directly —
 * from an old link, a dashboard shortcut or a typed address. Nothing is deleted.
 */
export function FeatureGate({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const switches = useFeatureSwitches();
  const id = featureForPath(pathname);
  if (!id || switches[id]) return <>{children}</>;

  const name = tr(FEATURES.find((f) => f.id === id)?.label || '');
  return (
    <div className="max-w-md mx-auto mt-16 p-6 bg-white border border-slate-200 rounded-2xl shadow-sm text-center space-y-3">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
        <EyeOff className="w-5 h-5" />
      </div>
      <h2 className="text-base font-black text-slate-900">{tr('"{name}" is turned off', { name })}</h2>
      <p className="text-xs text-slate-600 leading-relaxed">
        {tr('Turn it on in Settings → Features. Nothing was deleted — your data is safe.')}
      </p>
      <Link
        href="/settings?tab=features"
        prefetch={false}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
      >
        <Settings className="w-3.5 h-3.5" /> {tr('Open Settings → Features')}
      </Link>
    </div>
  );
}
