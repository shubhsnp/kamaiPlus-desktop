'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRightLeft, Check, ChefHat, FileText, Minus, MoreVertical, Plus, Printer, Receipt, Sparkles, Trash2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn, formatINR } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import { RestLine, RestOrder, formatOpenTime, hasUnsentItems, lineTitle, lineUnitPaise, minutesOpen, orderTotals, pieceCount, piecesInKitchen, piecesText } from '@/lib/restaurant/model';
import type { RestaurantSettings } from '@/lib/restaurant/settings';

/**
 * The running order of a table or takeaway (v4.106.0): every dish with − / + and its add-ons, what the
 * kitchen already has (✓), the totals with GST, and the waiter's actions: KOT, Print bill (before paying,
 * v4.108.0), Bill & Pay; ⋯ = Reprint KOT and Cancel order. A line's 🗑 removes it (a piece the kitchen has
 * goes on the next KOT as CANCEL).
 */
export function OrderPanel({ order, settings, kotBusy, checkBusy, onBack, onQty, onAddOns, onKot, onPay, onMove, onDelete, onCheck, onReprint, onCancel }: {
  order: RestOrder;
  settings: RestaurantSettings;
  kotBusy: boolean;
  onBack: () => void;
  onQty: (key: string, delta: number) => void;
  onAddOns: (line: RestLine) => void;
  onKot: () => void;
  onPay: () => void;
  /** Table orders only (v4.107.0): move the order to another table. */
  onMove?: () => void;
  checkBusy: boolean;
  onDelete: (key: string) => void;
  onCheck: () => void;
  onReprint: () => void;
  onCancel: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [menuOpen]);
  const inKitchen = piecesInKitchen(order);
  const totals = orderTotals(order, settings);
  const pieces = pieceCount(order);
  const unsent = hasUnsentItems(order);
  const lines = order.lines;
  const name = order.kind === 'table' ? `${tr('Table')} ${order.label}` : `${tr('Takeaway')} ${order.label}`;

  return (
    <div className="flex flex-col min-h-0 h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" data-restaurant-order>
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-200 bg-slate-50/70">
        <button type="button" onClick={onBack} className="h-9 px-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold flex items-center gap-1 cursor-pointer" data-order-back>
          <ArrowLeft className="w-4 h-4" /> {tr('Tables')}
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-base font-black text-slate-900 truncate">{name}</div>
          <div className="text-[11px] text-slate-500 font-semibold">
            {piecesText(pieces)} · {formatOpenTime(minutesOpen(order))}
          </div>
        </div>
        {onMove && order.kind === 'table' && (
          <button type="button" onClick={onMove} className="h-9 px-2.5 rounded-lg border border-slate-300 bg-white hover:border-emerald-500 hover:text-emerald-700 text-xs font-bold flex items-center gap-1 cursor-pointer" title={tr('Move to another table')} data-order-move>
            <ArrowRightLeft className="w-4 h-4" /> <span className="hidden xl:inline">{tr('Move')}</span>
          </button>
        )}
        {order.kotRounds > 0 && <span className="text-[10px] font-black uppercase tracking-wide text-amber-800 bg-amber-100 rounded-full px-2 py-1">KOT {order.kotRounds}</span>}
        <div className="relative" ref={menuRef}>
          <button type="button" onClick={() => setMenuOpen((v) => !v)} aria-haspopup="menu" aria-expanded={menuOpen} aria-label={tr('More')}
            className="h-9 w-9 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center cursor-pointer" data-order-more>
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div role="menu" className="absolute right-0 top-10 z-30 w-56 rounded-xl border border-slate-200 bg-white shadow-lg p-1">
              <button type="button" role="menuitem" disabled={inKitchen === 0} onClick={() => { setMenuOpen(false); onReprint(); }} data-order-reprint
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                <Printer className="w-4 h-4" /> {tr('Reprint KOT')}
              </button>
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onCancel(); }} data-order-cancel
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-rose-700 hover:bg-rose-50 flex items-center gap-2 cursor-pointer">
                <XCircle className="w-4 h-4" /> {tr('Cancel order')}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100" data-order-lines>
        {lines.length === 0 ? (
          <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center text-slate-400 gap-2 p-6">
            <ChefHat className="w-8 h-8" />
            <p className="text-sm font-bold text-slate-500">{tr('Tap a dish to add it')}</p>
          </div>
        ) : (
          lines.map((l) => {
            const cancelled = l.qty === 0;
            const sent = !cancelled && l.kotQty === l.qty;
            return (
              <div key={l.key} className={cn('px-3 py-2.5', cancelled && 'bg-rose-50/60')} data-order-line={l.productId}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className={cn('text-[13px] font-bold text-slate-900 leading-snug', cancelled && 'line-through text-slate-500')}>{lineTitle(l)}</div>
                    {l.note && <div className="text-[11px] text-amber-800 font-semibold">“{l.note}”</div>}
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] font-semibold">
                      <span className="text-slate-500 font-mono">{formatINR(lineUnitPaise(l))}</span>
                      {cancelled ? (
                        <span className="text-rose-600">{tr('Cancelled — goes on the next KOT')}</span>
                      ) : sent ? (
                        <span className="text-emerald-700 inline-flex items-center gap-0.5"><Check className="w-3 h-3" />{tr('In kitchen')}</span>
                      ) : (
                        <span className="text-amber-700">{l.kotQty > 0 ? tr('{count} new', { count: l.qty - l.kotQty }) : tr('Not sent')}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={cn('text-sm font-black font-mono', cancelled ? 'text-slate-400' : 'text-slate-900')}>{formatINR(Math.round(l.qty * lineUnitPaise(l)))}</div>
                  </div>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <button type="button" onClick={() => onAddOns(l)} disabled={cancelled} className="h-8 px-2.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 hover:border-emerald-500 hover:text-emerald-700 flex items-center gap-1 cursor-pointer disabled:opacity-40" data-line-addons>
                    <Sparkles className="w-3.5 h-3.5" /> {tr('Add-ons / note')}
                  </button>
                  <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => onDelete(l.key)} disabled={cancelled} aria-label={tr('Remove {name}', { name: lineTitle(l) })} title={tr('Remove this dish')}
                    className="w-9 h-9 rounded-xl border border-slate-200 text-slate-400 hover:border-rose-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" data-line-delete>
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="inline-flex items-center rounded-xl border border-slate-300 overflow-hidden bg-white">
                    <button type="button" onClick={() => onQty(l.key, -1)} className="w-10 h-9 flex items-center justify-center hover:bg-slate-100 cursor-pointer" aria-label={tr('One less')} data-line-minus><Minus className="w-4 h-4" /></button>
                    <span className="w-9 text-center text-sm font-black font-mono" data-line-qty>{l.qty}</span>
                    <button type="button" onClick={() => onQty(l.key, 1)} className="w-10 h-9 flex items-center justify-center hover:bg-slate-100 cursor-pointer" aria-label={tr('One more')} data-line-plus><Plus className="w-4 h-4" /></button>
                  </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-slate-200 bg-slate-50/70 px-3.5 pt-2.5 pb-3 space-y-1">
        {totals.serviceChargePaise > 0 && <TotalRow label={`${tr('Service charge')} ${settings.serviceChargePercent}%`} value={formatINR(totals.serviceChargePaise)} />}
        {totals.packingPaise > 0 && <TotalRow label={tr('Packing charge')} value={formatINR(totals.packingPaise)} />}
        <TotalRow label={`GST ${settings.gstRate}% ${settings.gstInclusive ? tr('(included)') : tr('(added)')}`} value={formatINR(totals.taxTotal)} muted />
        <div className="flex items-end justify-between pt-1">
          <span className="text-[11px] font-black uppercase tracking-wide text-slate-500">{tr('Total')}</span>
          <span className="text-2xl font-black font-mono text-slate-900" data-order-total>{formatINR(totals.grandTotal)}</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 pt-2">
          <Button type="button" size="lg" onClick={onKot} isLoading={kotBusy} disabled={!unsent}
            className={cn('h-12 px-2 text-[13px]', unsent ? 'bg-amber-500 hover:bg-amber-600 border-amber-500 text-slate-950' : 'bg-slate-100 text-slate-400 border-slate-200')} data-order-kot>
            <ChefHat className="w-4 h-4" /> {tr('Send KOT')}
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={onCheck} isLoading={checkBusy} disabled={pieces === 0} className="h-12 px-2 text-[13px]" title={tr('Print the bill for the table to check (not paid yet)')} data-order-check>
            <FileText className="w-4 h-4" /> {tr('Print bill')}
          </Button>
          <Button type="button" variant="success" size="lg" onClick={onPay} disabled={pieces === 0} className="h-12 px-2 text-[13px]" data-order-pay>
            <Receipt className="w-4 h-4" /> {tr('Bill & Pay')}
          </Button>
        </div>
        {unsent && pieces > 0 && <p className="text-[11px] font-semibold text-amber-800 text-center pt-0.5">{tr('Some items are not sent to the kitchen yet.')}</p>}
      </div>
    </div>
  );
}

function TotalRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between text-xs', muted ? 'text-slate-500' : 'text-slate-700 font-semibold')}>
      <span>{label}</span>
      <span className="font-mono font-bold">{value}</span>
    </div>
  );
}
