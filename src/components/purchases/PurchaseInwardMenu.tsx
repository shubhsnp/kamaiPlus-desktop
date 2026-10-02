'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Barcode, ChevronDown, FileSpreadsheet, PackagePlus, Plus } from 'lucide-react';
import { tr } from '@/lib/i18n/core';

/**
 * Purchases → "Stock Inward ▾" (v4.93.0, UX audit batch 3). Four buttons in a row (Excel bill,
 * fast barcode, new items + labels, manual) became one menu that says what each way is for.
 * The windows behind the items are unchanged.
 */
export function PurchaseInwardMenu({
  onManual,
  onExcel,
  onFast,
  labelsOn,
}: {
  onManual: () => void;
  onExcel: () => void;
  onFast: () => void;
  labelsOn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      if (e.type === 'mousedown' && boxRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', close);
    };
  }, [open]);

  const pick = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  const item = 'w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-50 flex items-start gap-2.5 cursor-pointer';
  const title = 'block text-xs font-black text-slate-900';
  const sub = 'block text-[11px] text-slate-500 leading-snug mt-0.5';

  return (
    <div ref={boxRef} className="relative" data-purchases-inward-menu>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
      >
        <PackagePlus className="w-4 h-4" />
        <span>{tr('Stock Inward')}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-40 w-80 rounded-xl border border-slate-200 bg-white shadow-2xl p-1.5" role="menu">
          <button type="button" role="menuitem" onClick={pick(onManual)} className={item} data-inward-option="manual">
            <Plus className="w-4 h-4 text-slate-700 mt-0.5 shrink-0" />
            <span>
              <span className={title}>{tr('Manual Inward')}</span>
              <span className={sub}>{tr('One item: pick it, type the quantity and buying price.')}</span>
            </span>
          </button>
          <button type="button" role="menuitem" onClick={pick(onExcel)} className={item} data-inward-option="excel">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <span>
              <span className={title}>{tr('Inward Bill (Excel / CSV)')}</span>
              <span className={sub}>{tr('The supplier sent the bill as a file — every row at once.')}</span>
            </span>
          </button>
          <button type="button" role="menuitem" onClick={pick(onFast)} className={item} data-inward-option="fast">
            <Barcode className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <span>
              <span className={title}>{tr('Fast barcode inward')}</span>
              <span className={sub}>{tr('Scan each piece with the barcode gun.')}</span>
            </span>
          </button>
          {labelsOn && (
            <Link href="/barcode-generator?new=1" prefetch={false} role="menuitem" onClick={() => setOpen(false)} className={item} data-purchases-new-stock>
              <Barcode className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
              <span>
                <span className={title}>{tr('New items + labels')}</span>
                <span className={sub}>{tr('Type name, price and quantity — items are saved with their stock and barcode, one label per piece.')}</span>
              </span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
