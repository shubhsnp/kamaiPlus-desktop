'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Bike, ChefHat, Clock, Plus } from 'lucide-react';
import { cn, formatINR } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import { RestOrder, formatOpenTime, piecesText } from '@/lib/restaurant/model';
import type { RestaurantSettings } from '@/lib/restaurant/settings';
import { STRIP_TOGGLE_ABOVE, StripChip, StripView, chipAmount, stripChips } from '@/lib/restaurant/tableStrip';
import { useDragScroll } from '@/components/restaurant/useDragScroll';

const FADE = {
  left: 'linear-gradient(to right, transparent, #000 36px)',
  right: 'linear-gradient(to right, #000 calc(100% - 36px), transparent)',
  both: 'linear-gradient(to right, transparent, #000 36px, #000 calc(100% - 36px), transparent)',
};

const chipTitle = (c: StripChip): string =>
  c.running
    ? [`${c.label}: ${formatINR(c.totalPaise)}`, piecesText(c.pieces), formatOpenTime(c.minutes), ...(c.pending ? [tr('Not sent to the kitchen')] : [])].join(' · ')
    : `${c.label}: ${tr('Free')}`;

function Chip({ chip, onOpen }: { chip: StripChip; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} title={chipTitle(chip)} aria-current={chip.current ? 'true' : undefined}
      data-strip-chip={chip.label} data-strip-state={chip.running ? 'running' : 'free'} data-strip-current={chip.current} data-strip-pending={chip.pending}
      className={cn('shrink-0 h-11 min-w-[58px] px-2.5 rounded-xl border-2 flex items-center justify-center gap-1.5 text-sm font-black cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600',
        chip.current ? 'bg-slate-900 border-slate-900 text-white'
          : chip.running ? cn('bg-amber-50 text-slate-900 hover:border-amber-500', chip.pending ? 'border-rose-500' : 'border-amber-300')
            : 'bg-white border-slate-200 text-slate-900 hover:border-emerald-500')}>
      {!chip.running && !chip.current && <span className="w-[7px] h-[7px] rounded-full bg-emerald-500" />}
      {chip.kind === 'delivery' && <Bike className={cn('w-4 h-4', chip.current ? 'text-sky-300' : 'text-sky-700')} />}
      <span>{chip.label}</span>
      {chip.running && <span className={cn('text-[12.5px] font-bold font-mono', chip.current ? 'text-amber-300' : 'text-amber-800')}>{chipAmount(chip.totalPaise)}</span>}
      {chip.pending && <ChefHat className={cn('w-[15px] h-[15px]', chip.current ? 'text-rose-300' : 'text-rose-600')} />}
      {chip.long && <Clock className={cn('w-3.5 h-3.5', chip.current ? 'text-rose-300' : 'text-rose-600')} />}
    </button>
  );
}

/**
 * Every table in sight on the order screen (v4.183.0): one click changes table, so nobody goes back to
 * the Tables screen for it. Black = on screen, amber + amount = running, red chef = KOT not sent, red
 * clock = over an hour. Many tables: Running / All, and the row is dragged, wheeled or swiped.
 */
export function TableStrip({ orders, settings, currentId, view, onView, onOpenTable, onOpenOrder, onNewTakeaway }: {
  orders: RestOrder[];
  settings: RestaurantSettings;
  currentId: string;
  /** null = the default for the shop's size. */
  view: StripView | null;
  onView: (view: StripView) => void;
  onOpenTable: (label: string) => void;
  onOpenOrder: (id: string) => void;
  onNewTakeaway: () => void;
}) {
  // Over an hour turns the clock on by itself.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, []);

  const { view: shown, tables, parcels, tableCount, runningCount } = stripChips(orders, settings, currentId, view, now);
  const { ref, edges, measure, handlers } = useDragScroll<HTMLDivElement>();

  // The table on screen stays in view when the row changes.
  const mounted = useRef(false);
  useEffect(() => {
    const el = ref.current;
    const chip = el?.querySelector<HTMLElement>('[data-strip-current="true"]');
    if (el && chip) {
      const smooth = mounted.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollTo({ left: chip.offsetLeft - el.clientWidth / 2 + chip.offsetWidth / 2, behavior: smooth ? 'smooth' : 'auto' });
    }
    mounted.current = true;
    measure();
  }, [currentId, shown, tables.length, ref, measure]);

  const mask = edges.left && edges.right ? FADE.both : edges.left ? FADE.left : edges.right ? FADE.right : undefined;
  const seg = (on: boolean) => cn('h-[38px] px-3 rounded-lg text-xs font-black cursor-pointer whitespace-nowrap', on ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800');

  return (
    <nav aria-label={tr('Tables')} className="shrink-0 flex items-center gap-2 bg-white border border-slate-200 rounded-2xl shadow-sm p-2 min-w-0" data-table-strip>
      {tableCount > STRIP_TOGGLE_ABOVE && (
        <div className="shrink-0 inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200" role="group" aria-label={tr('Show tables')}>
          <button type="button" onClick={() => onView('running')} aria-pressed={shown === 'running'} data-strip-view="running" className={seg(shown === 'running')}>{tr('Running')} {runningCount}</button>
          <button type="button" onClick={() => onView('all')} aria-pressed={shown === 'all'} data-strip-view="all" className={seg(shown === 'all')}>{tr('All')} {tableCount}</button>
        </div>
      )}
      <div ref={ref} {...handlers} data-strip-scroll style={{ scrollbarWidth: 'none', touchAction: 'pan-x', maskImage: mask, WebkitMaskImage: mask }}
        className="relative flex-1 min-w-0 flex gap-1.5 overflow-x-auto p-0.5 cursor-grab select-none">
        {tables.map((c) => <Chip key={c.label} chip={c} onOpen={() => onOpenTable(c.label)} />)}
      </div>
      {parcels.length > 0 && <span className="shrink-0 w-px h-8 bg-slate-200" />}
      {parcels.map((c) => <Chip key={c.label} chip={c} onOpen={() => c.orderId && onOpenOrder(c.orderId)} />)}
      <button type="button" onClick={onNewTakeaway} data-strip-new-takeaway
        className="shrink-0 h-11 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-black flex items-center gap-1 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">
        <Plus className="w-4 h-4" /> {tr('Takeaway')}
      </button>
    </nav>
  );
}
