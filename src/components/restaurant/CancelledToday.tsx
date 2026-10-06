'use client';

import React, { useEffect, useState } from 'react';
import { ChefHat, XCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { formatINR } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import { RESTAURANT_CHANGED_EVENT } from '@/lib/restaurant/settings';
import { RestVoid, loadVoids, voidsOfDay } from '@/lib/restaurant/voids';

/**
 * Today's cancelled orders (v4.108.0) on the Tables screen — the owner's void report: which table,
 * when, how much, what the kitchen had already made, and why. Hidden when nothing was cancelled.
 */
export function CancelledToday() {
  const [list, setList] = useState<RestVoid[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const refresh = () => setList(voidsOfDay(loadVoids()));
    refresh();
    window.addEventListener(RESTAURANT_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(RESTAURANT_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  if (list.length === 0) return null;
  const total = list.reduce((n, v) => n + v.amountPaise, 0);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-cancelled-today={list.length}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-[11px] font-black text-rose-700 cursor-pointer">
        <XCircle className="w-3.5 h-3.5" /> {tr('Cancelled today: {count}', { count: list.length })} · <span className="font-mono">{formatINR(total)}</span>
      </button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title={tr('Cancelled orders today')} description={tr('{count} orders · {amount}', { count: list.length, amount: formatINR(total) })} size="md">
        <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto -mx-1" data-cancelled-list>
          {list.map((v) => (
            <div key={v.id} className="px-1 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-black text-slate-900">{v.kind === 'table' ? `${tr('Table')} ${v.label}` : `${tr('Takeaway')} ${v.label}`}</span>
                <span className="text-sm font-black font-mono text-rose-700">{formatINR(v.amountPaise)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold text-slate-500">
                <span>{new Date(v.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>
                <span>· {tr(v.reason)}</span>
                {v.inKitchen > 0 && <span className="inline-flex items-center gap-0.5 text-amber-700"><ChefHat className="w-3 h-3" />{tr('{count} pieces were in the kitchen', { count: v.inKitchen })}</span>}
              </div>
              {v.items.length > 0 && <div className="mt-1 text-[11px] text-slate-600 leading-snug">{v.items.join(', ')}</div>}
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
