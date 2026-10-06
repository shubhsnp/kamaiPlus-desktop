'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Business, Sale } from '@/types';
import { tr } from '@/lib/i18n/core';
import { MenuPick, RestLine, RestOrder, addPiece, applyToOnePiece, changeQty, lineTitle, liveLines, markKotSent } from '@/lib/restaurant/model';
import type { RestAddOn, RestaurantSettings } from '@/lib/restaurant/settings';
import type { RestState } from '@/lib/restaurant/store';
import { printKot } from '@/lib/restaurant/kot';
import { RestPayMethod, settleOrder } from '@/lib/restaurant/settle';
import type { DiscountInput } from '@/lib/restaurant/model';
import { MenuPanel } from '@/components/restaurant/MenuPanel';
import { OrderPanel } from '@/components/restaurant/OrderPanel';
import { AddOnsDialog } from '@/components/restaurant/AddOnsDialog';
import { PayDialog } from '@/components/restaurant/PayDialog';

const mapOrder = (s: RestState, id: string, f: (o: RestOrder) => RestOrder): RestState => ({ ...s, orders: s.orders.map((o) => (o.id === id ? f(o) : o)) });

/**
 * One table / takeaway (v4.106.0): the menu on the left, the running order on the right. Leaving the
 * screen ("Tables") keeps the order on hold; Send KOT prints only what changed since the last slip;
 * Bill & Pay saves an ordinary bill, prints it and frees the table.
 */
export function OrderScreen({ order, settings, update, business, onBack, onSettled, notify }: {
  order: RestOrder;
  settings: RestaurantSettings;
  update: (change: (s: RestState) => RestState) => void;
  business?: Business | null;
  onBack: () => void;
  onSettled: (sale: Sale) => void;
  notify: (text: string, tone?: 'success' | 'error' | 'info') => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [addOnsFor, setAddOnsFor] = useState<RestLine | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [kotBusy, setKotBusy] = useState(false);
  const now = () => new Date().toISOString();

  const pick = (p: MenuPick) => update((s) => mapOrder(s, order.id, (o) => addPiece(o, p, now())));
  const qty = (key: string, delta: number) => update((s) => mapOrder(s, order.id, (o) => changeQty(o, key, delta, now())));
  const applyAddOns = (addOns: RestAddOn[], note: string) => {
    if (addOnsFor) update((s) => mapOrder(s, order.id, (o) => applyToOnePiece(o, addOnsFor.key, addOns, note, now())));
    setAddOnsFor(null);
  };

  const sendKot = async () => {
    if (kotBusy) return;
    setKotBusy(true);
    try {
      const res = await printKot({ order, shopName: business?.name, round: order.kotRounds + 1 });
      if (res.ok) {
        update((s) => mapOrder(s, order.id, (o) => markKotSent(o, now())));
        notify(tr('KOT sent to the kitchen ({label})', { label: order.label }), 'success');
      } else if (res.empty) {
        notify(tr('Nothing new to send.'), 'info');
      } else {
        notify(tr('KOT did not print: {error}', { error: res.error || tr('printer not ready') }), 'error');
      }
    } catch (e: any) {
      notify(tr('KOT did not print: {error}', { error: e?.message || tr('printer not ready') }), 'error');
    } finally {
      setKotBusy(false);
    }
  };

  const settle = async (method: RestPayMethod, receivedPaise: number, discount: DiscountInput | null) => {
    if (busy) return;
    setBusy(true);
    try {
      const sale = await settleOrder({ order, settings, business, method, receivedPaise, discount });
      // The bill is saved: only now does the table become free.
      update((s) => ({ ...s, orders: s.orders.filter((o) => o.id !== order.id) }));
      setPayOpen(false);
      onSettled(sale);
    } catch (e) {
      console.error('Restaurant bill not saved:', e);
      notify(tr('Could not save the bill. Please try again.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  // Esc = back to the Tables (unless a window is open or you are typing in the search box), "/" = search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('[aria-modal="true"]')) return;
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'Escape' && !typing) {
        onBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  const inOrder = new Map<string, number>();
  for (const l of liveLines(order)) inOrder.set(l.productId, (inOrder.get(l.productId) || 0) + l.qty);

  return (
    <div className="grid gap-4 h-full min-h-[560px] lg:grid-cols-[minmax(0,1fr)_400px]" data-restaurant-screen="order">
      <div className="min-h-[420px] lg:min-h-0 lg:h-full rounded-2xl bg-slate-50/60 border border-slate-200 p-3 sm:p-4 flex flex-col">
        <MenuPanel onPick={pick} inOrder={inOrder} searchRef={searchRef} />
      </div>
      <div className="min-h-[520px] lg:min-h-0 lg:h-full">
        <OrderPanel order={order} settings={settings} kotBusy={kotBusy} onBack={onBack} onQty={qty} onAddOns={setAddOnsFor} onKot={sendKot} onPay={() => setPayOpen(true)} />
      </div>
      <AddOnsDialog title={addOnsFor ? lineTitle(addOnsFor) : null} library={settings.addOns} onClose={() => setAddOnsFor(null)} onApply={applyAddOns} />
      <PayDialog order={order} settings={settings} open={payOpen} busy={busy} onClose={() => !busy && setPayOpen(false)} onSettle={settle} />
    </div>
  );
}
