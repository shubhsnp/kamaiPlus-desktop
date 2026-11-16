'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { WhatsAppIcon } from '@/components/whatsapp/WhatsAppButton';
import { LANG_CHIPS } from '@/components/whatsapp/WhatsAppComposerParts';
import { WaLinkCard } from '@/components/whatsapp/WaLinkCard';
import { getWhatsAppSettings, saveWhatsAppSettings, WhatsAppSettings } from '@/lib/whatsapp/whatsappSettings';
import { toWhatsAppNumber } from '@/lib/whatsapp/whatsappLinks';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';

const field = 'w-full mt-1 h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-300';

/**
 * Settings → Invoice & Bill Rules → WhatsApp messages (v4.79.0): what customers' bills and
 * reminders look like, and where day reports / GST figures go. Saved on this computer.
 */
export function WhatsAppSettingsCard() {
  const [s, setS] = useState<WhatsAppSettings>(getWhatsAppSettings);
  const update = (patch: Partial<WhatsAppSettings>) => setS(saveWhatsAppSettings(patch));
  const bad = (v: string) => v.trim() !== '' && !toWhatsAppNumber(v);

  return (
    <Card className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-2xs space-y-3" data-whatsapp-settings>
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <WhatsAppIcon className="w-4 h-4" />
        <div>
          <h3 className="text-sm font-black text-slate-900">{tr('WhatsApp messages (this computer)')}</h3>
          <p className="text-[11px] text-slate-500">{tr('Bills, udhar reminders, khata slips and orders open in WhatsApp ready to send — WhatsApp Desktop if it is installed, else WhatsApp Web.')}</p>
        </div>
      </div>

      <div className="text-xs space-y-3">
        <WaLinkCard />
        <div>
          <span className="font-bold text-slate-700">{tr('Language of customer messages')}</span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            <button type="button" onClick={() => update({ lang: '' })} className={cn('px-2.5 h-7 rounded-lg border font-bold cursor-pointer', s.lang === '' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-300 text-slate-700')}>
              {tr('Same as the app')}
            </button>
            {LANG_CHIPS.map((l) => (
              <button key={l.id} type="button" onClick={() => update({ lang: l.id })} className={cn('px-2.5 h-7 rounded-lg border font-bold cursor-pointer', s.lang === l.id ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-300 text-slate-700')}>
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-start gap-2 cursor-pointer">
          <input type="checkbox" checked={s.payLink} onChange={(e) => update({ payLink: e.target.checked })} className="mt-0.5" />
          <span>
            <span className="block font-bold text-slate-800">{tr('Add a "Pay by UPI" link when money is due')}</span>
            <span className="block text-slate-500">{tr('The customer taps it and their UPI app opens with the amount filled in. Needs a UPI ID in Store Profile.')}</span>
          </span>
        </label>

        <label className="block">
          <span className="font-bold text-slate-700">{tr('Last line of customer messages')}</span>
          <input value={s.signOff} onChange={(e) => update({ signOff: e.target.value })} maxLength={200} placeholder={tr('Empty = "Thank you for shopping with us! Visit again"')} className={field} />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="font-bold text-slate-700">{tr("Owner's WhatsApp (day summary, cash count)")}</span>
            <input value={s.ownerPhone} onChange={(e) => update({ ownerPhone: e.target.value.replace(/[^\d+ ]/g, '') })} maxLength={16} placeholder={tr('Empty = the shop number')} inputMode="tel" className={cn(field, 'font-mono', bad(s.ownerPhone) && 'border-rose-400')} />
          </label>
          <label className="block">
            <span className="font-bold text-slate-700">{tr("CA's WhatsApp (GST figures)")}</span>
            <input value={s.caPhone} onChange={(e) => update({ caPhone: e.target.value.replace(/[^\d+ ]/g, '') })} maxLength={16} placeholder="98765 43210" inputMode="tel" className={cn(field, 'font-mono', bad(s.caPhone) && 'border-rose-400')} />
          </label>
        </div>
      </div>
    </Card>
  );
}
