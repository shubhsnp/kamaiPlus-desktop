'use client';

import React from 'react';
import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import { openWhatsAppComposer, WhatsAppRequest } from '@/lib/whatsapp/openWhatsApp';
import { useFeatureSwitches } from '@/lib/features/featureSwitches';

/** WhatsApp green, the same on every button. */
export function WhatsAppIcon({ className }: { className?: string }) {
  return <MessageCircle className={cn('text-[#25D366]', className)} strokeWidth={2.4} />;
}

const LOOK = {
  icon: 'p-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40',
  pill: 'h-7 px-2.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-900 dark:text-emerald-200 text-[11px] font-bold gap-1',
  block: 'h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black gap-2 w-full justify-center',
};

/**
 * Opens the WhatsApp window for a bill, a customer, a khata entry… (v4.79.0). Clicks never reach
 * the row / card underneath (many sit on clickable rows). Settings → Features → WhatsApp off
 * (v4.81.0): the button is not drawn — every WhatsApp button in the app is this one or
 * RestockOrderButton, so one check hides them all.
 */
export function WhatsAppButton({
  request,
  variant = 'pill',
  label,
  title,
  className,
}: {
  request: WhatsAppRequest | (() => WhatsAppRequest);
  variant?: keyof typeof LOOK;
  label?: string;
  title?: string;
  className?: string;
}) {
  const whatsappOn = useFeatureSwitches().whatsapp;
  if (!whatsappOn) return null;
  const req = typeof request === 'function' ? null : request;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        openWhatsAppComposer(typeof request === 'function' ? request() : request);
      }}
      title={title || tr('Send on WhatsApp')}
      className={cn('inline-flex items-center cursor-pointer shadow-2xs transition active:scale-95 shrink-0', LOOK[variant], className)}
      data-whatsapp={req?.kind || 'action'}
    >
      <WhatsAppIcon className={variant === 'block' ? 'w-4 h-4 text-white' : variant === 'icon' ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5'} />
      {variant !== 'icon' && <span>{label || tr('WhatsApp')}</span>}
    </button>
  );
}
