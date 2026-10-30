'use client';

import React, { useEffect, useState } from 'react';
import { Bike, ChefHat, Clock, Plus, Settings2, ShoppingBag, UtensilsCrossed, Zap } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn, formatINR } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import { RestOrder, formatOpenTime, hasUnsentItems, minutesOpen, orderTotals, pieceCount, piecesText } from '@/lib/restaurant/model';
import type { RestaurantSettings } from '@/lib/restaurant/settings';
import { LONG_OPEN_MINUTES } from '@/lib/restaurant/tableStrip';
import type { Sale } from '@/types';
import { RecentBills } from '@/components/restaurant/RecentBills';
import { CancelledToday } from '@/components/restaurant/CancelledToday';
import { PhonesLinkNotice } from '@/components/restaurant/PhonesLinkNotice';

type View = 'all' | 'running' | 'free';

/**
 * The Tables screen (v4.106.0, v4.107.0) — the first thing a waiter sees. White = free, amber = an
 * order is running (amount, pieces, how long; red after an hour). A red KOT tag = items not sent to
 * the kitchen yet. Takeaway orders get their own row with a token (TA-01…), and today's paid bills
 * can be opened again (print, PDF, WhatsApp).
 */
export function TablesHome({ orders, settings, onOpenTable, onOpenOrder, onNewTakeaway, onNewDelivery, onSetup, onOpenBill, onFastPos }: {
  orders: RestOrder[];
  settings: RestaurantSettings;
  onOpenTable: (label: string) => void;
  onOpenOrder: (id: string) => void;
  onNewTakeaway: () => void;
  /** Optional legacy handler */
  onNewDelivery?: () => void;
  onSetup: () => void;
  onOpenBill: (sale: Sale) => void;
  /** v4.161.0: switch this computer to Fast POS (token billing, no tables). */
  onFastPos?: () => void;
}) {
  // Minutes on a card move on their own.
  const [now, setNow] = useState(() => Date.now());
  const [view, setView] = useState<View>('all');
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, []);

  const tableOrders = new Map(orders.filter((o) => o.kind === 'table').map((o) => [o.label, o]));
  // A table taken out of the set-up while it still has an order keeps showing until it is billed.
  const labels = [...settings.tables, ...Array.from(tableOrders.keys()).filter((l) => !settings.tables.includes(l))];
  const shown = labels.filter((l) => view === 'all' || (view === 'running') === tableOrders.has(l));
  // Takeaway and delivery (v4.139.0) share the parcel row, oldest first.
  const takeaways = orders.filter((o) => o.kind !== 'table').sort((a, b) => a.openedAt.localeCompare(b.openedAt));
  const free = Math.max(0, labels.length - tableOrders.size);
  const open = orders.reduce((n, o) => n + orderTotals(o, settings).grandTotal, 0);
  const unsent = orders.filter((o) => hasUnsentItems(o) && pieceCount(o) > 0).length;

  return (
    <div className="space-y-5 pb-6" data-restaurant-screen="tables">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-4 py-3.5 flex flex-wrap items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm"><UtensilsCrossed className="w-5 h-5" /></div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">{tr('Tables & Orders')}</h1>
          <p className="text-xs text-slate-500 font-medium">{tr('Tap a table to take or add to an order. Leaving a table keeps its order.')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Stat label={tr('Running')} value={String(orders.length)} tone="text-amber-700" />
          <Stat label={tr('Free')} value={String(free)} tone="text-emerald-700" />
          <Stat label={tr('Open amount')} value={formatINR(open)} tone="text-slate-900" mono />
          {unsent > 0 && <Stat label={tr('KOT pending')} value={String(unsent)} tone="text-rose-600" />}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button type="button" variant="success" onClick={onNewTakeaway} data-new-takeaway className="flex-1 sm:flex-none"><Plus className="w-4 h-4" /> {tr('New takeaway')}</Button>
          {onFastPos && (
            <Button type="button" variant="outline" onClick={onFastPos} data-fast-pos-open className="flex-1 sm:flex-none border-amber-300 bg-amber-50 hover:bg-amber-100 text-slate-900" title={tr('Token billing for a counter without tables')}>
              <Zap className="w-4 h-4 text-amber-600" /> {tr('Fast POS')}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onSetup} data-restaurant-setup aria-label={tr('Set-up')}><Settings2 className="w-4 h-4" /> <span className="hidden sm:inline">{tr('Set-up')}</span></Button>
        </div>
      </div>

      <PhonesLinkNotice />

      <section aria-label={tr('Dine-in tables')}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-500">{tr('Dine-in')} · {labels.length}</h2>
          <div className="flex items-center gap-3">
            <span className="hidden md:flex items-center gap-3 text-[10.5px] font-bold text-slate-500">
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-white border-2 border-slate-300" />{tr('Free')}</span>
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" />{tr('Running')}</span>
              <span className="inline-flex items-center gap-1"><ChefHat className="w-3 h-3 text-rose-600" />{tr('Not sent to the kitchen')}</span>
            </span>
            <div className="inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200" role="group" aria-label={tr('Show tables')}>
              {(['all', 'running', 'free'] as const).map((v) => (
                <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v} data-tables-view={v}
                  className={cn('h-7 px-2.5 rounded-md text-[11px] font-black cursor-pointer', view === v ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800')}>
                  {v === 'all' ? tr('All') : v === 'running' ? tr('Running') : tr('Free')}
                </button>
              ))}
            </div>
          </div>
        </div>
        {shown.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 px-4 py-6 text-center text-xs font-semibold text-slate-500">
            {view === 'running' ? tr('No table has an order right now.') : tr('Every table has an order.')}
          </div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
            {shown.map((label) => {
              const order = tableOrders.get(label);
              return order ? (
                <OrderCard key={label} order={order} settings={settings} now={now} onOpen={() => onOpenOrder(order.id)} table />
              ) : (
                <button key={label} type="button" onClick={() => onOpenTable(label)} data-table={label} data-table-state="free"
                  className="group text-left rounded-2xl border-2 border-slate-200 bg-white hover:border-emerald-500 hover:shadow-md hover:-translate-y-0.5 p-3.5 min-h-[96px] flex flex-col justify-between cursor-pointer transition-all active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                  <span className="text-xl font-black text-slate-900 leading-none">{label}</span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />{tr('Free')}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section aria-label={tr('Takeaway orders')}>
        <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2.5">{tr('Takeaway & delivery')} · {takeaways.length}</h2>
        {takeaways.length === 0 ? (
          <button type="button" onClick={onNewTakeaway}
            className="w-full rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 hover:border-emerald-400 hover:bg-emerald-50/40 px-4 py-6 text-center text-xs font-semibold text-slate-500 flex items-center justify-center gap-2 cursor-pointer transition-colors">
            <ShoppingBag className="w-4 h-4 text-slate-400" /> {tr('No takeaway order running. "New takeaway" gives the next token.')}
          </button>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
            {takeaways.map((o) => <OrderCard key={o.id} order={o} settings={settings} now={now} onOpen={() => onOpenOrder(o.id)} />)}
          </div>
        )}
      </section>

      <RecentBills onOpen={onOpenBill} />
      <div className="flex justify-end"><CancelledToday /></div>
    </div>
  );
}

function OrderCard({ order, settings, now, onOpen, table }: { order: RestOrder; settings: RestaurantSettings; now: number; onOpen: () => void; table?: boolean }) {
  const minutes = minutesOpen(order, now);
  const long = minutes >= LONG_OPEN_MINUTES; // A red time: someone may be waiting for the bill.
  const pieces = pieceCount(order);
  const dataAttrs = table ? { 'data-table': order.label, 'data-table-state': 'running' } : order.kind === 'delivery' ? { 'data-delivery': order.label } : { 'data-takeaway': order.label };
  return (
    <button type="button" onClick={onOpen} {...dataAttrs}
      className="text-left rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-white hover:border-amber-400 hover:shadow-md hover:-translate-y-0.5 p-3.5 min-h-[96px] flex flex-col justify-between cursor-pointer transition-all active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
      <div className="flex items-start justify-between gap-2">
        <span className={cn('font-black text-slate-900 leading-none', table ? 'text-xl' : 'text-lg')}>
          {order.kind === 'delivery' && <Bike className="w-4 h-4 inline -mt-1 mr-1 text-sky-700" />}{order.label}
          {order.guest?.name && <span className="block text-[11px] font-bold text-slate-500 mt-1 truncate max-w-[130px]">{order.guest.name}</span>}
          {/* v4.144.0: the staff member who took it (staff sign-in) */}
          {order.takenBy && <span className="block text-[10px] font-bold text-indigo-700 mt-1 truncate max-w-[130px]" data-order-taken-by>{tr('by {name}', { name: order.takenBy })}</span>}
        </span>
        {hasUnsentItems(order) && pieces > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-700 bg-rose-100 rounded-full px-1.5 py-0.5" title={tr('Not sent to the kitchen')}><ChefHat className="w-3 h-3" />KOT</span>
        )}
      </div>
      <div>
        <div className="text-lg font-black font-mono text-slate-900">{formatINR(orderTotals(order, settings).grandTotal)}</div>
        <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
          <span className="text-amber-800">{piecesText(pieces)}</span>
          <span className={cn('inline-flex items-center gap-0.5', long ? 'text-rose-600 font-black' : 'text-slate-500')}><Clock className="w-3 h-3" />{formatOpenTime(minutes)}</span>
        </div>
      </div>
    </button>
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
