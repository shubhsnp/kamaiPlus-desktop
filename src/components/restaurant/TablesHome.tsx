'use client';

import React, { useEffect, useState } from 'react';
import { ChefHat, Plus, Settings2, ShoppingBag, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn, formatINR } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import { RestOrder, formatOpenTime, hasUnsentItems, minutesOpen, orderTotals, pieceCount } from '@/lib/restaurant/model';
import type { RestaurantSettings } from '@/lib/restaurant/settings';

/**
 * The Tables screen (v4.106.0) — the first thing a waiter sees. Green = free, amber = an order is
 * running (amount, pieces, how long). A red tag means items are not sent to the kitchen yet.
 * Takeaway orders get their own row with a token (TA-01…).
 */
export function TablesHome({ orders, settings, onOpenTable, onOpenOrder, onNewTakeaway, onSetup }: {
  orders: RestOrder[];
  settings: RestaurantSettings;
  onOpenTable: (label: string) => void;
  onOpenOrder: (id: string) => void;
  onNewTakeaway: () => void;
  onSetup: () => void;
}) {
  // Minutes on a card move on their own.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, []);

  const tableOrders = new Map(orders.filter((o) => o.kind === 'table').map((o) => [o.label, o]));
  // A table taken out of the set-up while it still has an order keeps showing until it is billed.
  const labels = [...settings.tables, ...Array.from(tableOrders.keys()).filter((l) => !settings.tables.includes(l))];
  const takeaways = orders.filter((o) => o.kind === 'takeaway').sort((a, b) => a.openedAt.localeCompare(b.openedAt));
  const running = orders.length;
  const open = orders.reduce((n, o) => n + orderTotals(o, settings).grandTotal, 0);

  return (
    <div className="space-y-5 pb-6" data-restaurant-screen="tables">
      <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-200 rounded-2xl shadow-sm px-4 py-3.5">
        <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0"><UtensilsCrossed className="w-5 h-5" /></div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">{tr('Tables & Orders')}</h1>
          <p className="text-xs text-slate-500 font-medium">{tr('Tap a table to take or add to an order. Leaving a table keeps its order.')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Stat label={tr('Running')} value={String(running)} tone="text-amber-700" />
          <Stat label={tr('Free')} value={String(Math.max(0, labels.length - tableOrders.size))} tone="text-emerald-700" />
          <Stat label={tr('Open amount')} value={formatINR(open)} tone="text-slate-900" mono />
          <Button type="button" variant="outline" onClick={onSetup} data-restaurant-setup><Settings2 className="w-4 h-4" /> {tr('Set-up')}</Button>
        </div>
      </div>

      <section aria-label={tr('Dine-in tables')}>
        <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2.5">{tr('Dine-in')}</h2>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
          {labels.map((label) => {
            const order = tableOrders.get(label);
            return order ? (
              <button key={label} type="button" onClick={() => onOpenOrder(order.id)} data-table={label} data-table-state="running"
                className="text-left rounded-2xl border-2 border-amber-300 bg-amber-50 hover:bg-amber-100/70 p-3.5 min-h-[116px] flex flex-col justify-between cursor-pointer transition-all active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xl font-black text-slate-900 leading-none">{label}</span>
                  {hasUnsentItems(order) && pieceCount(order) > 0 && <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-700 bg-rose-100 rounded-full px-1.5 py-0.5" title={tr('Not sent to the kitchen')}><ChefHat className="w-3 h-3" />KOT</span>}
                </div>
                <div>
                  <div className="text-lg font-black font-mono text-slate-900">{formatINR(orderTotals(order, settings).grandTotal)}</div>
                  <div className="text-[11px] font-semibold text-amber-800">{pieceCount(order)} {tr('pieces')} · {formatOpenTime(minutesOpen(order, now))}</div>
                </div>
              </button>
            ) : (
              <button key={label} type="button" onClick={() => onOpenTable(label)} data-table={label} data-table-state="free"
                className="text-left rounded-2xl border-2 border-slate-200 bg-white hover:border-emerald-500 hover:bg-emerald-50/50 p-3.5 min-h-[116px] flex flex-col justify-between cursor-pointer transition-all active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                <span className="text-xl font-black text-slate-900 leading-none">{label}</span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700"><span className="w-2 h-2 rounded-full bg-emerald-500" />{tr('Free')} · {tr('tap to start')}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-label={tr('Takeaway orders')}>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-500">{tr('Takeaway')}</h2>
          <Button type="button" variant="success" onClick={onNewTakeaway} data-new-takeaway><Plus className="w-4 h-4" /> {tr('New takeaway')}</Button>
        </div>
        {takeaways.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 px-4 py-6 text-center text-xs font-semibold text-slate-500 flex items-center justify-center gap-2">
            <ShoppingBag className="w-4 h-4 text-slate-400" /> {tr('No takeaway order running. "New takeaway" gives the next token.')}
          </div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
            {takeaways.map((o) => (
              <button key={o.id} type="button" onClick={() => onOpenOrder(o.id)} data-takeaway={o.label}
                className={cn('text-left rounded-2xl border-2 p-3.5 min-h-[96px] flex flex-col justify-between cursor-pointer transition-all active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500', 'border-amber-300 bg-amber-50 hover:bg-amber-100/70')}>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-lg font-black text-slate-900 leading-none">{o.label}</span>
                  {hasUnsentItems(o) && pieceCount(o) > 0 && <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-700 bg-rose-100 rounded-full px-1.5 py-0.5"><ChefHat className="w-3 h-3" />KOT</span>}
                </div>
                <div>
                  <div className="text-base font-black font-mono text-slate-900">{formatINR(orderTotals(o, settings).grandTotal)}</div>
                  <div className="text-[11px] font-semibold text-amber-800">{pieceCount(o)} {tr('pieces')} · {formatOpenTime(minutesOpen(o, now))}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, tone, mono }: { label: string; value: string; tone: string; mono?: boolean }) {
  return (
    <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-center min-w-[72px]">
      <div className={cn('text-base font-black leading-tight', tone, mono && 'font-mono')}>{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}
