'use client';

import React from 'react';
import { CheckCircle2, CircleSlash, Headset, LayoutGrid, Lock, MessageCircle, PackagePlus, ShieldCheck, UtensilsCrossed } from 'lucide-react';
import { FEATURES, FeatureInfo, RESTAURANT_PRESET, readAdminFeatureOverrides, useFeatureSwitches, useRestaurantMode } from '@/lib/features/featureSwitches';
import { SupportContactLine } from '@/components/support/SupportContact';
import { cn } from '@/lib/utils';
import { msg, tr } from '@/lib/i18n/core';

const GROUPS: { id: FeatureInfo['group']; title: string; hint: string; icon: typeof LayoutGrid }[] = [
  { id: 'screens', title: msg('Screens in the menu'), hint: msg('Off = not in the menu or on the Home screen.'), icon: LayoutGrid },
  { id: 'product_form', title: msg('Add Product form'), hint: msg('Off = the field is not shown; items already saved keep their values.'), icon: PackagePlus },
  { id: 'tools', title: msg('Buttons across the app'), hint: msg('Off = these buttons are hidden on every screen.'), icon: MessageCircle },
  { id: 'privacy', title: msg('Privacy'), hint: msg('Owner PIN for profit and cost prices.'), icon: ShieldCheck },
];

/**
 * Settings → Features (lib/features/featureSwitches.ts). Since v4.107.0 it only SHOWS what is on for
 * this shop: switches are set by KamaiPlus support from the Admin Console (Remote control → Features),
 * never from the shop's own computer. Nothing here can be changed.
 */
export function FeaturesTab() {
  const switches = useFeatureSwitches();
  const forced = readAdminFeatureOverrides();
  const restaurant = useRestaurantMode();
  const onCount = FEATURES.filter((f) => switches[f.id]).length;

  return (
    <div className="space-y-4" data-features-readonly>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-4 flex flex-wrap items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0"><Headset className="w-5 h-5" /></div>
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-sm font-black text-slate-900">{tr('Features are set by KamaiPlus support')}</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            {tr('Your app shows only what your shop needs. To switch a feature on or off, contact KamaiPlus support — it changes on this computer within the hour, nothing is deleted.')}
          </p>
          <SupportContactLine message={tr('Hello KamaiPlus, please change a feature in my app.')} className="text-xs" />
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
          <div className="text-base font-black text-slate-900 leading-tight">{onCount}/{FEATURES.length}</div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{tr('On')}</div>
        </div>
      </div>

      {restaurant && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 flex items-center gap-2.5 text-xs font-bold text-emerald-900" data-features-restaurant>
          <UtensilsCrossed className="w-4 h-4 shrink-0" />
          {tr('Restaurant mode is on: the app is set up for tables, KOT and the restaurant bill.')}
        </div>
      )}

      {GROUPS.map((group) => {
        const Icon = group.icon;
        return (
          <section key={group.id} className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-black text-slate-900">{tr(group.title)}</h3>
                <p className="text-[10.5px] text-slate-500">{tr(group.hint)}</p>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {FEATURES.filter((f) => f.group === group.id).map((f) => {
                const on = switches[f.id];
                const bySupport = typeof forced[f.id] === 'boolean';
                const byRestaurant = !bySupport && restaurant && typeof RESTAURANT_PRESET[f.id] === 'boolean';
                return (
                  <div key={f.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-slate-900">{tr(f.label)}</span>
                      <span className="block text-[10.5px] text-slate-500 leading-snug">{tr(f.description)}</span>
                      {(bySupport || byRestaurant) && (
                        <span className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-bold text-indigo-700" data-feature-admin-locked={f.id}>
                          <Lock className="w-3 h-3" /> {byRestaurant ? tr('Set by Restaurant mode') : tr('Set by KamaiPlus support for this computer')}
                        </span>
                      )}
                    </span>
                    <span data-feature={f.id} data-on={on ? 'true' : 'false'}
                      className={cn('shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black border',
                        on ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200')}>
                      {on ? <CheckCircle2 className="w-3.5 h-3.5" /> : <CircleSlash className="w-3.5 h-3.5" />}
                      {on ? tr('On') : tr('Off')}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
