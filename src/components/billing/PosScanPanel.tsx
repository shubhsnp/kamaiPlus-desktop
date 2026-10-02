'use client';

import React, { useEffect, useRef, useState } from 'react';
import { LayoutGrid, ScanLine } from 'lucide-react';
import type { CartItem } from '@/types';
import { cn, formatINR } from '@/lib/utils';
import { formatCartQty } from '@/lib/billing/unitQuantity';
import { tr } from '@/lib/i18n/core';

/**
 * Scan mode (v4.92.0): what the product list's place shows while the gun does the work —
 * the item just scanned, big, and the bill so far. The bill itself stays on the right.
 */

/** The line that was just added or whose quantity just went up (the "last scanned" item). */
export function lastChangedLine(prev: Map<string, number>, cart: CartItem[]): CartItem | null {
  for (let i = cart.length - 1; i >= 0; i--) {
    const line = cart[i];
    const before = prev.get(line.product_id);
    if (before === undefined || line.quantity > before) return line;
  }
  return null;
}

function useLastScanned(cart: CartItem[]): { line: CartItem | null; tick: number } {
  const prev = useRef<Map<string, number>>(new Map());
  const [state, setState] = useState<{ id: string | null; tick: number }>({ id: null, tick: 0 });
  useEffect(() => {
    const changed = lastChangedLine(prev.current, cart);
    prev.current = new Map(cart.map((l) => [l.product_id, l.quantity]));
    if (changed) setState((s) => ({ id: changed.product_id, tick: s.tick + 1 }));
  }, [cart]);
  const line = (state.id && cart.find((l) => l.product_id === state.id)) || cart[cart.length - 1] || null;
  return { line, tick: state.tick };
}

interface PanelProps {
  cart: CartItem[];
  itemCount: number;
  grandTotalPaise: number;
}

export function PosScanPanel({ cart, itemCount, grandTotalPaise }: PanelProps) {
  const { line, tick } = useLastScanned(cart);

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3" data-pos-scan-panel>
      {line ? (
        <div
          key={tick}
          className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/70 p-4 animate-in fade-in zoom-in-95 duration-200"
          data-pos-last-scanned
        >
          <div className="text-[10.5px] font-black uppercase tracking-wider text-emerald-700">{tr('Last scanned')}</div>
          <div className="mt-1 text-xl xl:text-2xl font-black text-slate-900 leading-tight break-words">{line.product_name}</div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div className="text-sm font-bold text-slate-600 font-mono">
              {formatCartQty(line.quantity)} {line.unit} × {formatINR(line.unit_price)}
            </div>
            <div className="text-2xl xl:text-3xl font-black text-emerald-800 font-mono">{formatINR(line.total_amount)}</div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <ScanLine className="w-10 h-10 mx-auto text-slate-400" />
          <div className="mt-2 text-base font-black text-slate-800">{tr('Ready to scan')}</div>
          <p className="mt-1 text-xs text-slate-500">{tr('Scan an item with the barcode gun — it goes straight on the bill.')}</p>
        </div>
      )}

      <div className="rounded-2xl bg-slate-900 text-white p-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10.5px] font-black uppercase tracking-wider text-slate-400">{tr('This bill')}</div>
          <div className="text-sm font-bold text-slate-200">
            {itemCount} {itemCount === 1 ? tr('item') : tr('items')}
          </div>
        </div>
        <div className="text-3xl font-black font-mono" data-pos-scan-total>
          {formatINR(grandTotalPaise)}
        </div>
      </div>

      <p className="text-[11px] text-slate-500 leading-relaxed">
        {tr('Product list is hidden in Scan mode. Type a name in the box above to search, or press "Show products".')}
      </p>
    </div>
  );
}

/** Next to the product search: Scan mode on / off. Never takes the focus away from the search box. */
export function PosScanModeButton({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onToggle}
      aria-pressed={active}
      title={active ? tr('Show the product list again') : tr('Scan mode: hide the product list and make the bill bigger')}
      data-pos-scan-mode={active ? 'on' : 'off'}
      className={cn(
        'hidden lg:inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-lg border text-xs font-black whitespace-nowrap cursor-pointer transition-colors shrink-0',
        active ? 'bg-slate-900 border-slate-900 text-white hover:bg-slate-800' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
      )}
    >
      {active ? <LayoutGrid className="w-4 h-4" /> : <ScanLine className="w-4 h-4" />}
      {active ? tr('Show products') : tr('Scan mode')}
    </button>
  );
}
