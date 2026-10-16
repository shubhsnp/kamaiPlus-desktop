'use client';

import React from 'react';
import { Minus, Plus, Receipt, ShoppingBag, Sparkles, Trash2, UtensilsCrossed, XCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn, formatINR } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import { RestLine, RestOrder, lineTitle, lineUnitPaise, orderTotals, pieceCount, piecesText } from '@/lib/restaurant/model';
import type { RestaurantSettings } from '@/lib/restaurant/settings';

/**
 * The cart of Fast POS (v4.161.0): the token it will get, Takeaway / Dine-in, the dishes with − / + and
 * add-ons, the totals with GST, and one big Pay. No KOT button, no table: the KOT (if the shop wants
 * one) prints by itself with the bill.
 */
export function FastCartPanel({ cart, settings, token, busy, onDineIn, onQty, onDelete, onAddOns, onClear, onPay }: {
  cart: RestOrder;
  settings: RestaurantSettings;
  /** The cart's own token once Pay was pressed, else the one it will most likely get. */
  token: { label: string; reserved: boolean };
  busy: boolean;
  onDineIn: (dineIn: boolean) => void;
  onQty: (key: string, delta: number) => void;
  onDelete: (key: string) => void;
  onAddOns: (line: RestLine) => void;
  onClear: () => void;
  onPay: () => void;
}) {
  const totals = orderTotals(cart, settings);
  const pieces = pieceCount(cart);
  const lines = cart.lines.filter((l) => l.qty > 0);
  const dineIn = Boolean(cart.fast?.dineIn);

  return (
    <div className="flex flex-col min-h-0 h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" data-fast-cart>
      <div className="px-3.5 py-3 border-b border-slate-200 bg-slate-50/70">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{token.reserved ? tr('Token') : tr('Next token')}</div>
            <div className="text-3xl font-black font-mono text-slate-900 leading-none mt-0.5" data-fast-token>{token.label}</div>
          </div>
          <div className="inline-flex rounded-xl border border-slate-300 bg-white p-0.5" role="radiogroup" aria-label={tr('Order type')}>
            <TypeButton active={!dineIn} onClick={() => onDineIn(false)} icon={ShoppingBag} label={tr('Takeaway')} data="takeaway" />
            <TypeButton active={dineIn} onClick={() => onDineIn(true)} icon={UtensilsCrossed} label={tr('Dine-in')} data="dinein" />
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100" data-fast-lines>
        {lines.length === 0 ? (
          <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center text-slate-400 gap-2 p-6">
            <Zap className="w-8 h-8 text-amber-400" />
            <p className="text-sm font-bold text-slate-500">{tr('Tap a dish to add it')}</p>
            <p className="text-[11px] font-semibold text-slate-400 max-w-[240px]">{tr('Pay gives the bill a token number; the kitchen slip prints with it when a kitchen printer is chosen.')}</p>
          </div>
        ) : (
          lines.map((l) => (
            <div key={l.key} className="px-3 py-2.5" data-fast-line={l.productId}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-slate-900 leading-snug">{lineTitle(l)}</div>
                  {l.note && <div className="text-[11px] text-amber-800 font-semibold">“{l.note}”</div>}
                  <div className="text-[11px] text-slate-500 font-mono font-semibold">{formatINR(lineUnitPaise(l))}</div>
                </div>
                <div className="text-sm font-black font-mono text-slate-900 shrink-0">{formatINR(Math.round(l.qty * lineUnitPaise(l)))}</div>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <button type="button" onClick={() => onAddOns(l)} className="h-8 px-2.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 hover:border-emerald-500 hover:text-emerald-700 flex items-center gap-1 cursor-pointer" data-fast-addons>
                  <Sparkles className="w-3.5 h-3.5" /> {tr('Add-ons / note')}
                </button>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => onDelete(l.key)} aria-label={tr('Remove {name}', { name: lineTitle(l) })} title={tr('Remove this dish')}
                    className="w-9 h-9 rounded-xl border border-slate-200 text-slate-400 hover:border-rose-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer" data-fast-delete>
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="inline-flex items-center rounded-xl border border-slate-300 overflow-hidden bg-white">
                    <button type="button" onClick={() => onQty(l.key, -1)} className="w-10 h-9 flex items-center justify-center hover:bg-slate-100 cursor-pointer" aria-label={tr('One less')} data-fast-minus><Minus className="w-4 h-4" /></button>
                    <span className="min-w-[36px] px-1 text-center text-sm font-black font-mono" data-fast-qty>{l.qty}</span>
                    <button type="button" onClick={() => onQty(l.key, 1)} className="w-10 h-9 flex items-center justify-center hover:bg-slate-100 cursor-pointer" aria-label={tr('One more')} data-fast-plus><Plus className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-slate-200 bg-slate-50/70 px-3.5 pt-2.5 pb-3 space-y-1">
        {totals.serviceChargePaise > 0 && <Row label={`${tr('Service charge')} ${settings.serviceChargePercent}%`} value={formatINR(totals.serviceChargePaise)} />}
        {totals.packingPaise > 0 && <Row label={tr('Packing charge')} value={formatINR(totals.packingPaise)} />}
        {settings.gstRate > 0 && <Row label={`GST ${settings.gstRate}% ${settings.gstInclusive ? tr('(included)') : tr('(added)')}`} value={formatINR(totals.taxTotal)} muted />}
        <div className="flex items-end justify-between pt-1">
          <span className="text-[11px] font-black uppercase tracking-wide text-slate-500">{tr('Total')} · {piecesText(pieces)}</span>
          <span className="text-2xl font-black font-mono text-slate-900" data-fast-total>{formatINR(totals.grandTotal)}</span>
        </div>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-1.5 pt-2">
          <Button type="button" variant="outline" size="lg" onClick={onClear} disabled={pieces === 0 || busy} className="h-12 px-3 text-[13px]" data-fast-clear>
            <XCircle className="w-4 h-4" /> {tr('Clear')}
          </Button>
          <Button type="button" variant="success" size="lg" onClick={onPay} disabled={pieces === 0} isLoading={busy} className="h-12 px-3 text-sm" data-fast-pay>
            <Receipt className="w-4 h-4" /> {tr('Pay')} <kbd className="ml-1 text-[10px] font-mono bg-white/20 rounded px-1.5 py-0.5">F10</kbd>
          </Button>
        </div>
      </div>
    </div>
  );
}

function TypeButton({ active, onClick, icon: Icon, label, data }: { active: boolean; onClick: () => void; icon: React.ElementType; label: string; data: string }) {
  return (
    <button type="button" role="radio" aria-checked={active} onClick={onClick} data-fast-type={data}
      className={cn('h-9 px-2.5 rounded-lg text-xs font-black flex items-center gap-1.5 cursor-pointer transition-colors', active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100')}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between text-xs', muted ? 'text-slate-500' : 'text-slate-700 font-semibold')}>
      <span>{label}</span>
      <span className="font-mono font-bold">{value}</span>
    </div>
  );
}
