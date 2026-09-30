'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import type { Product } from '@/types';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import { WhatsAppIcon } from './WhatsAppButton';
import { useFeatureSwitches } from '@/lib/features/featureSwitches';

const RestockOrderModal = dynamic(() => import('./RestockOrderModal').then((m) => m.RestockOrderModal), { ssr: false });

/** "Order on WhatsApp" for low-stock items (v4.79.0) — Home watchlist and Inventory reorder alerts. */
export function RestockOrderButton({ products, preselect, label, className }: { products: Product[]; preselect?: string[]; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const whatsappOn = useFeatureSwitches().whatsapp; // Settings → Features → WhatsApp off: no order button
  if (products.length === 0 || !whatsappOn) return null;
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn('px-2.5 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs inline-flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95', className)}
        title={tr('Send a restock order to your supplier on WhatsApp')}
        data-restock-order
      >
        <WhatsAppIcon className="w-3.5 h-3.5" />
        <span>{label || tr('Order on WhatsApp')}</span>
      </button>
      {open && <RestockOrderModal products={products} preselect={preselect} onClose={() => setOpen(false)} />}
    </>
  );
}
