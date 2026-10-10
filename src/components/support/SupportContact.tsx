'use client';

import React, { useState } from 'react';
import { Check, Copy, Globe, Headset, Mail, Phone } from 'lucide-react';
import { WhatsAppIcon } from '@/components/whatsapp/WhatsAppButton';
import { tr } from '@/lib/i18n/core';
import { cn } from '@/lib/utils';
import {
  SUPPORT_EMAIL,
  SUPPORT_PHONE_DISPLAY,
  supportEmailUrl,
  supportGreeting,
  supportWhatsAppUrl,
} from '@/lib/support/contact';

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      window.setTimeout(() => setCopied((c) => (c === value ? null : c)), 1800);
    } catch {}
  };
  return { copied, copy };
}

/**
 * Settings → Help & Support: WhatsApp chat, phone number and e-mail of KamaiPlus
 * support, each one tap away (links open in the system browser / WhatsApp).
 */
export const SupportContactCard: React.FC<{ shopName?: string | null }> = ({ shopName }) => {
  const { copied, copy } = useCopy();
  const hello = `${supportGreeting(shopName)}\n${tr('I need help with:')} `;

  const CopyButton = ({ value }: { value: string }) => (
    <button
      type="button"
      onClick={() => copy(value)}
      className="h-8 px-2.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
    >
      {copied === value ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
      {copied === value ? tr('Copied') : tr('Copy')}
    </button>
  );

  return (
    <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
          <Headset className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-black text-slate-900">{tr('KamaiPlus Support')}</h3>
          <p className="text-[11px] text-slate-500">{tr('Aapki Dukaan Ka Digital Sathi')} • {tr('Help with billing, licence key, printer, backup or updates — in Hindi, Marathi or English.')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/60 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-black text-emerald-800 uppercase tracking-wide">
            <WhatsAppIcon className="w-3.5 h-3.5" /> WhatsApp
          </div>
          <div className="text-sm font-black text-slate-900 font-mono">{SUPPORT_PHONE_DISPLAY}</div>
          <a
            href={supportWhatsAppUrl(hello)}
            target="_blank"
            rel="noreferrer"
            className="mt-auto h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"
          >
            <WhatsAppIcon className="w-3.5 h-3.5" /> {tr('Chat on WhatsApp')}
          </a>
        </div>

        <div className="p-3 rounded-xl border border-sky-200 bg-sky-50/60 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-black text-sky-800 uppercase tracking-wide">
            <Phone className="w-3.5 h-3.5" /> {tr('Call')}
          </div>
          <div className="text-sm font-black text-slate-900 font-mono select-all">{SUPPORT_PHONE_DISPLAY}</div>
          <div className="mt-auto flex">
            <CopyButton value={SUPPORT_PHONE_DISPLAY} />
          </div>
        </div>

        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-700 uppercase tracking-wide">
            <Mail className="w-3.5 h-3.5" /> {tr('Email')}
          </div>
          <div className="text-xs font-bold text-slate-900 font-mono truncate select-all" title={SUPPORT_EMAIL}>{SUPPORT_EMAIL}</div>
          <div className="mt-auto flex gap-1.5">
            <a
              href={supportEmailUrl(tr('KamaiPlus Desktop help'), hello)}
              target="_blank"
              rel="noreferrer"
              className="h-8 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold flex items-center gap-1"
            >
              <Mail className="w-3.5 h-3.5" /> {tr('Write')}
            </a>
            <CopyButton value={SUPPORT_EMAIL} />
          </div>
        </div>

        <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/60 flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-black text-rose-800 uppercase tracking-wide">
            <Globe className="w-3.5 h-3.5" /> {tr('Website')}
          </div>
          <div className="text-xs font-bold text-slate-900 font-mono select-all truncate">{'www.kamaiplus.com'}</div>
          <div className="mt-auto flex gap-1.5">
            <a
              href="https://www.kamaiplus.com"
              target="_blank"
              rel="noreferrer"
              className="h-8 w-full rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold flex items-center justify-center gap-1"
            >
              <Globe className="w-3.5 h-3.5" /> {tr('Visit Website')}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * One line for the screens before the app opens (licence, locked account,
 * forgotten password): "WhatsApp +91 86699 97711 · kamaiplus.app@gmail.com · www.kamaiplus.com".
 */
export const SupportContactLine: React.FC<{ message: string; className?: string }> = ({ message, className }) => (
  <span className={cn('inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1', className)}>
    <a
      href={supportWhatsAppUrl(message)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-bold text-emerald-500 hover:text-emerald-400"
    >
      <WhatsAppIcon className="w-3.5 h-3.5" /> WhatsApp {SUPPORT_PHONE_DISPLAY}
    </a>
    <a
      href={supportEmailUrl('KamaiPlus Desktop', message)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-mono font-bold hover:underline"
    >
      <Mail className="w-3.5 h-3.5" /> {SUPPORT_EMAIL}
    </a>
    <a
      href="https://www.kamaiplus.com"
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-bold text-slate-400 hover:text-red-400"
    >
      <Globe className="w-3.5 h-3.5" /> {'www.kamaiplus.com'}
    </a>
  </span>
);
