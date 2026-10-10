'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import { openWhatsAppComposer, WhatsAppRequest } from '@/lib/whatsapp/openWhatsApp';
import { useFeatureSwitches } from '@/lib/features/featureSwitches';

/** The official WhatsApp mark (white glyph on the green circle), like the Android app — v4.132.0 (was a chat-bubble outline). */
const WA_GLYPH =
  'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z';

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" data-whatsapp-logo className={cn('shrink-0', className)}>
      <circle cx="16" cy="16" r="16" fill="#25D366" />
      <path fill="#fff" d={WA_GLYPH} transform="translate(6.5 6.5) scale(0.79)" />
    </svg>
  );
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
