'use client';

import React, { useState } from 'react';
import { KeyRound, LayoutGrid, Lock, MessageCircle, PackagePlus, ShieldCheck } from 'lucide-react';
import { FEATURES, FeatureInfo, RESTAURANT_PRESET_OFF, readAdminFeatureOverrides, setFeatureSwitch, useFeatureSwitches, useRestaurantMode } from '@/lib/features/featureSwitches';
import { hasOwnerPin, setProfitHidden } from '@/lib/auth/cashierPrivacy';
import { OwnerPinPrompt } from '@/components/privacy/OwnerPinPrompt';
import { msg, tr } from '@/lib/i18n/core';

const GROUPS: { id: FeatureInfo['group']; title: string; hint: string; icon: typeof LayoutGrid }[] = [
  { id: 'screens', title: msg('Screens in the menu'), hint: msg('Switched off = not in the menu or on the Home screen.'), icon: LayoutGrid },
  { id: 'product_form', title: msg('Add Product form'), hint: msg('Switched off = the field is not shown; items already saved keep their values.'), icon: PackagePlus },
  { id: 'tools', title: msg('Buttons across the app'), hint: msg('Switched off = these buttons are hidden on every screen.'), icon: MessageCircle },
  { id: 'privacy', title: msg('Privacy'), hint: msg('Owner PIN for profit and cost prices.'), icon: ShieldCheck },
];

/**
 * Settings → Features: turn screens and form fields on / off (lib/features/featureSwitches.ts).
 * With an owner PIN set, changing them needs the PIN — otherwise staff could simply
 * switch "Hide profit from staff" off.
 */
export function FeaturesTab() {
  const switches = useFeatureSwitches();
  // v4.105.0: switches the KamaiPlus Admin set for this computer — shown, not changeable here.
  const forced = readAdminFeatureOverrides();
  // v4.106.0: Restaurant mode (set from the Admin Console) keeps stock, labels and purchases off.
  const restaurant = useRestaurantMode();
  const [unlocked, setUnlocked] = useState(() => !hasOwnerPin());
  const [pinOpen, setPinOpen] = useState(false);

  const change = (id: FeatureInfo['id'], on: boolean) => {
    setFeatureSwitch(id, on);
    // Privacy off → nothing stays locked; switching it back on starts unlocked.
    if (id === 'profit_privacy' && !on) setProfitHidden(false);
  };

  if (!unlocked) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white border border-slate-200 rounded-2xl shadow-2xs text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
          <Lock className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-black text-slate-900">{tr('Owner PIN needed')}</h3>
        <p className="text-xs text-slate-600">{tr('Only the owner can turn features on or off.')}</p>
        <button
          type="button"
          onClick={() => setPinOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
        >
          <KeyRound className="w-3.5 h-3.5" /> {tr('Unlock with owner PIN')}
        </button>
        <OwnerPinPrompt
          isOpen={pinOpen}
          onClose={() => setPinOpen(false)}
          onUnlocked={() => setUnlocked(true)}
          title={tr('Owner PIN required')}
          description={tr('Only the owner can turn features on or off.')}
          submitLabel={tr('Unlock')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-600">
        {tr('Keep the app simple: show only what your shop uses. Switching something off only hides it — nothing is deleted, and you can switch it back on any time.')}
      </p>

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
                const byRestaurant = restaurant && RESTAURANT_PRESET_OFF.includes(f.id) && typeof forced[f.id] !== 'boolean';
                const locked = typeof forced[f.id] === 'boolean' || byRestaurant;
                return (
                <label key={f.id} className={`px-4 py-3 flex items-center justify-between gap-3 ${locked ? 'cursor-not-allowed bg-slate-50/60' : 'cursor-pointer hover:bg-slate-50/70'}`}>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-slate-900">{tr(f.label)}</span>
                    <span className="block text-[10.5px] text-slate-500 leading-snug">{tr(f.description)}</span>
                    {locked && (
                      <span className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-bold text-indigo-700" data-feature-admin-locked={f.id}>
                        <Lock className="w-3 h-3" /> {byRestaurant ? tr('Off in Restaurant mode') : tr('Set by KamaiPlus support for this computer')}
                      </span>
                    )}
                  </span>
                  <span className="relative inline-flex items-center shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      aria-label={tr(f.label)}
                      data-feature={f.id}
                      checked={switches[f.id]}
                      disabled={locked}
                      onChange={(e) => change(f.id, e.target.checked)}
                    />
                    <span className={`w-9 h-5 rounded-full bg-slate-300 peer-checked:bg-emerald-600 transition-colors ${locked ? 'opacity-60' : ''}`} />
                    <span className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
                  </span>
                </label>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
