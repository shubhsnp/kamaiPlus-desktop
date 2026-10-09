'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { EyeOff, UtensilsCrossed } from 'lucide-react';
import { FEATURES, featureForPath, useFeatureSwitches, useRestaurantMode } from '@/lib/features/featureSwitches';
import { SupportContactLine } from '@/components/support/SupportContact';
import { tr } from '@/lib/i18n/core';

/**
 * Wraps every shop page (AppShell). A screen the shop's category (or KamaiPlus support) leaves off
 * (menu item already hidden) shows this card instead when it is opened directly —
 * from an old link, a dashboard shortcut or a typed address. Nothing is deleted.
 */
export function FeatureGate({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const switches = useFeatureSwitches();
  const restaurant = useRestaurantMode();
  const router = useRouter();
  const path = (pathname || '').split('?')[0].replace(/\/+$/, '') || '/';
  // v4.106.0: in Restaurant mode the counter's Billing page is replaced by Tables & Orders; old links
  // (F1, Home shortcuts) land there. Outside it, /restaurant is closed — only KamaiPlus support opens it.
  const toRestaurant = restaurant && path === '/billing';
  useEffect(() => {
    if (toRestaurant) router.replace('/restaurant');
  }, [toRestaurant, router]);
  if (toRestaurant) return null;
  if (path === '/restaurant' && !restaurant) {
    return (
      <div className="max-w-md mx-auto mt-16 p-6 bg-white border border-slate-200 rounded-2xl shadow-sm text-center space-y-3" data-restaurant-closed>
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto"><UtensilsCrossed className="w-5 h-5" /></div>
        <h2 className="text-base font-black text-slate-900">{tr('Restaurant mode is not switched on')}</h2>
        <p className="text-xs text-slate-600 leading-relaxed">{tr('Tables, KOT and the restaurant bill are switched on by KamaiPlus support for your shop. Please contact us.')}</p>
        <SupportContactLine message={tr('Hello KamaiPlus, please switch on Restaurant mode for my shop.')} className="text-xs" />
      </div>
    );
  }
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
        {tr('KamaiPlus support switches features on for your shop. Nothing was deleted — your data is safe.')}
      </p>
      <SupportContactLine message={tr('Hello KamaiPlus, please switch on "{name}" in my app.', { name })} className="text-xs" />
    </div>
  );
}
