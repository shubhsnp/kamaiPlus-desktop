'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Edit2, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import type { CartItem } from '@/types';
import { cn, formatINR } from '@/lib/utils';
import { formatCartQty } from '@/lib/billing/unitQuantity';
import { tr } from '@/lib/i18n/core';
import { cartQuantities, lastChangedLine, scrollIntoContainer } from '@/lib/billing/cartFocus';

/**
 * The bill's lines on the counter (moved out of app/billing/page.tsx, v4.93.0 — same rows).
 * The line just added (or whose quantity went up) scrolls into view and flashes green, so a
 * scan is never hidden below the fold. Switching bills or opening the page flashes nothing.
 */
function useLineFocus(cart: CartItem[], billId: string) {
  const listRef = useRef<HTMLDivElement>(null);
  const prev = useRef<{ bill: string; qty: Map<string, number> } | null>(null);
  const [flash, setFlash] = useState<{ id: string; tick: number }>({ id: '', tick: 0 });

  useEffect(() => {
    const before = prev.current;
    prev.current = { bill: billId, qty: cartQuantities(cart) };
    if (!before || before.bill !== billId) return;
    const changed = lastChangedLine(before.qty, cart);
    if (changed) setFlash((f) => ({ id: changed.product_id, tick: f.tick + 1 }));
  }, [cart, billId]);

  useEffect(() => {
    if (!flash.id) return;
    const list = listRef.current;
    const line = list?.querySelector<HTMLElement>(`[data-pos-line="${CSS.escape(flash.id)}"]`) ?? null;
    scrollIntoContainer((list?.closest('[data-pos-bill-scroll]') as HTMLElement | null) ?? null, line);
    const timer = window.setTimeout(() => setFlash((f) => (f.tick === flash.tick ? { ...f, id: '' } : f)), 900);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flash.tick]);

  return { listRef, flashId: flash.id };
}

interface Props {
  cart: CartItem[];
  billId: string;
  onQuantity: (productId: string, delta: number) => void;
  onEdit: (item: CartItem) => void;
  onRemove: (productId: string) => void;
}

export function PosCartLines({ cart, billId, onQuantity, onEdit, onRemove }: Props) {
  const { listRef, flashId } = useLineFocus(cart, billId);

  return (
    <div ref={listRef} className="border-b border-slate-100 pb-2 space-y-2 min-h-[60px]" data-pos-cart-lines>
      {cart.length === 0 ? (
        <div className="text-center py-8 text-xs text-slate-400 font-medium space-y-1.5">
          <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="font-semibold text-slate-600">{tr('Cart is empty')}</p>
          <p className="text-[11px] text-slate-400">{tr('Tap products on the left or scan barcode to add')}</p>
        </div>
      ) : (
        cart.map((item) => (
          <div
            key={item.product_id}
            data-pos-line={item.product_id}
            data-pos-line-flash={flashId === item.product_id ? 'true' : undefined}
            className={cn(
              'p-2 sm:p-2.5 rounded-xl border hover:shadow-2xs transition-all duration-300 flex items-center justify-between gap-2 text-xs',
              flashId === item.product_id ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-300' : 'border-slate-200 bg-white hover:border-slate-300'
            )}
          >
            <div className="flex-1 min-w-0">
              <div className="font-bold text-slate-900 truncate" title={item.product_name}>
                {item.product_name}
              </div>

              {/* Size / colour / serial — only when the line has them (an empty row took space on every line) */}
              {(item.size || item.color || item.imei_serial || item.warranty_period_months) && (
                <div className="flex flex-wrap gap-1 my-0.5">
                  {(item.size || item.color) && (
                    <span className="text-[10px] bg-indigo-50 text-indigo-900 border border-indigo-200 px-1 py-0.2 rounded font-medium">
                      {item.size && <span>{tr('Size:')} {item.size} </span>}
                      {item.color && <span>• {item.color}</span>}
                    </span>
                  )}
                  {(item.imei_serial || item.warranty_period_months) && (
                    <span className="text-[10px] bg-cyan-50 text-cyan-900 border border-cyan-200 px-1 py-0.2 rounded font-mono">
                      {item.imei_serial && <span>SN:{item.imei_serial} </span>}
                      {item.warranty_period_months && <span>• {item.warranty_period_months}M</span>}
                    </span>
                  )}
                </div>
              )}

              <div className="text-[11px] text-slate-500 font-mono flex items-center flex-wrap gap-1.5">
                <span>{formatINR(item.unit_price)} × {formatCartQty(item.quantity)} {item.unit}</span>
                {item.discount_amount ? (
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1 rounded">
                    -₹{(item.discount_amount / 100).toFixed(0)} {tr('off')}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Quantity Stepper & Edit Button */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => onQuantity(item.product_id, -1)}
                aria-label={tr('One less')}
                className="w-6 h-6 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer active:scale-95 transition-all"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-bold font-mono text-xs min-w-6 text-center text-slate-900">{formatCartQty(item.quantity)}</span>
              <button
                onClick={() => onQuantity(item.product_id, 1)}
                aria-label={tr('One more')}
                className="w-6 h-6 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer active:scale-95 transition-all"
              >
                <Plus className="w-3 h-3" />
              </button>

              <button
                onClick={() => onEdit(item)}
                title={tr('Edit Price, Quantity or Item Discount')}
                className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 ml-0.5 cursor-pointer transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-700" />
              </button>

              <button
                onClick={() => onRemove(item.product_id)}
                title={tr('Remove from bill')}
                aria-label={tr('Remove from bill')}
                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 ml-0.5 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="w-16 text-right font-extrabold font-mono text-xs text-slate-900">
              {formatINR(item.total_amount)}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
