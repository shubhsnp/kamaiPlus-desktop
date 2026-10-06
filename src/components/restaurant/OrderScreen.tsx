'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Business, Sale } from '@/types';
import { tr } from '@/lib/i18n/core';
import { MenuPick, RestLine, RestOrder, addPiece, applyToOnePiece, cancelOrderChanges, changeQty, lineTitle, liveLines, markKotSent, moveOrderTo, removeLine, reprintKotLines } from '@/lib/restaurant/model';
import type { RestAddOn, RestaurantSettings } from '@/lib/restaurant/settings';
import type { RestState } from '@/lib/restaurant/store';
import { printKot } from '@/lib/restaurant/kot';
import { RestPayMethod, settleOrder } from '@/lib/restaurant/settle';
import { printCheck } from '@/lib/restaurant/checkPrint';
import { recordVoid, voidFromOrder } from '@/lib/restaurant/voids';
import type { DiscountInput } from '@/lib/restaurant/model';
import { MenuPanel } from '@/components/restaurant/MenuPanel';
import { OrderPanel } from '@/components/restaurant/OrderPanel';
import { AddOnsDialog } from '@/components/restaurant/AddOnsDialog';
import { PayDialog, SettleExtras } from '@/components/restaurant/PayDialog';
import { MoveTableDialog } from '@/components/restaurant/MoveTableDialog';
import { CancelOrderDialog } from '@/components/restaurant/CancelOrderDialog';

const mapOrder = (s: RestState, id: string, f: (o: RestOrder) => RestOrder): RestState => ({ ...s, orders: s.orders.map((o) => (o.id === id ? f(o) : o)) });

/**
 * One table / takeaway (v4.106.0): the menu on the left, the running order on the right. Leaving the
 * screen ("Tables") keeps the order on hold; Send KOT prints only what changed since the last slip;
 * Bill & Pay saves an ordinary bill, prints it and frees the table. v4.108.0: Print bill (to check,
 * before paying), Reprint KOT, delete a dish, Cancel order (cancel slip + Today's cancelled list).
 */
export function OrderScreen({ order, settings, update, business, freeTables, onBack, onSettled, notify }: {
  order: RestOrder;
  settings: RestaurantSettings;
  update: (change: (s: RestState) => RestState) => void;
  business?: Business | null;
  /** Tables with no order — where this one can be moved. */
  freeTables: string[];
  onBack: () => void;
  onSettled: (sale: Sale, printNow: boolean) => void;
  notify: (text: string, tone?: 'success' | 'error' | 'info') => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [addOnsFor, setAddOnsFor] = useState<RestLine | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [kotBusy, setKotBusy] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [checkBusy, setCheckBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const now = () => new Date().toISOString();
  const failText = (e: unknown) => (e instanceof Error && e.message) || tr('printer not ready');

  const pick = (p: MenuPick) => update((s) => mapOrder(s, order.id, (o) => addPiece(o, p, now())));
  const qty = (key: string, delta: number) => update((s) => mapOrder(s, order.id, (o) => changeQty(o, key, delta, now())));
  const applyAddOns = (addOns: RestAddOn[], note: string) => {
    if (addOnsFor) update((s) => mapOrder(s, order.id, (o) => applyToOnePiece(o, addOnsFor.key, addOns, note, now())));
    setAddOnsFor(null);
  };

  const remove = (key: string) => update((s) => mapOrder(s, order.id, (o) => removeLine(o, key, now())));

  // v4.108.0: the bill for the table to check before paying (not saved, no number).
  const check = async () => {
    if (checkBusy) return;
    setCheckBusy(true);
    try {
      const res = await printCheck({ order, settings, business });
      if (res.ok) notify(tr('Bill for {label} sent to the printer (not paid yet).', { label: order.label }), 'success');
      else notify(tr('The bill did not print: {error}', { error: res.error || tr('printer not ready') }), 'error');
    } catch (e) {
      notify(tr('The bill did not print: {error}', { error: failText(e) }), 'error');
    } finally {
      setCheckBusy(false);
    }
  };

  // v4.108.0: a lost / torn kitchen slip — everything the kitchen has for this order, marked REPRINT.
  const reprint = async () => {
    try {
      const res = await printKot({ order, shopName: business?.name, round: order.kotRounds, kind: 'reprint' }, reprintKotLines(order));
      if (res.ok) notify(tr('KOT printed again ({label})', { label: order.label }), 'success');
      else if (!res.empty) notify(tr('KOT did not print: {error}', { error: res.error || tr('printer not ready') }), 'error');
    } catch (e) {
      notify(tr('KOT did not print: {error}', { error: failText(e) }), 'error');
    }
  };

  // v4.108.0: cancel the whole order — cancel slip for the kitchen, written to Today's cancelled orders.
  const cancelOrder = async (reason: string) => {
    if (cancelBusy) return;
    setCancelBusy(true);
    let slipError = '';
    const stop = cancelOrderChanges(order);
    if (stop.length > 0) {
      try {
        const res = await printKot({ order, shopName: business?.name, round: order.kotRounds + 1, kind: 'cancel', reason }, stop);
        if (!res.ok) slipError = res.error || tr('printer not ready');
      } catch (e) {
        slipError = failText(e);
      }
    }
    recordVoid(voidFromOrder(order, settings, reason, now()));
    update((s) => ({ ...s, orders: s.orders.filter((o) => o.id !== order.id) }));
    setCancelBusy(false);
    setCancelOpen(false);
    if (slipError) notify(tr('Order {label} cancelled, but the cancel slip did not print: {error}. Tell the kitchen.', { label: order.label, error: slipError }), 'error');
    else notify(stop.length ? tr('Order {label} cancelled — cancel slip sent to the kitchen.', { label: order.label }) : tr('Order {label} cancelled.', { label: order.label }), 'success');
    onBack();
  };

  const move = (to: string) => {
    const from = order.label;
    update((s) => ({ ...s, orders: moveOrderTo(s.orders, order.id, to, now()) }));
    setMoveOpen(false);
    notify(tr('Order moved from {from} to {to}', { from, to }), 'success');
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

  const settle = async (method: RestPayMethod, receivedPaise: number, discount: DiscountInput | null, extras: SettleExtras) => {
    if (busy) return;
    setBusy(true);
    try {
      const sale = await settleOrder({ order, settings, business, method, receivedPaise, discount, guestName: extras.guestName, guestPhone: extras.guestPhone });
      // The bill is saved: only now does the table become free.
      update((s) => ({ ...s, orders: s.orders.filter((o) => o.id !== order.id) }));
      setPayOpen(false);
      onSettled(sale, extras.printNow);
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
        <OrderPanel order={order} settings={settings} kotBusy={kotBusy} onBack={onBack} onQty={qty} onAddOns={setAddOnsFor} onKot={sendKot} onPay={() => setPayOpen(true)} onMove={() => setMoveOpen(true)}
          checkBusy={checkBusy} onDelete={remove} onCheck={check} onReprint={reprint} onCancel={() => setCancelOpen(true)} />
      </div>
      <AddOnsDialog title={addOnsFor ? lineTitle(addOnsFor) : null} library={settings.addOns} onClose={() => setAddOnsFor(null)} onApply={applyAddOns} />
      <CancelOrderDialog order={order} settings={settings} open={cancelOpen} busy={cancelBusy} onClose={() => !cancelBusy && setCancelOpen(false)} onConfirm={cancelOrder} />
      <MoveTableDialog from={order.label} freeTables={freeTables} open={moveOpen} onClose={() => setMoveOpen(false)} onMove={move} />
      <PayDialog order={order} settings={settings} business={business} open={payOpen} busy={busy} onClose={() => !busy && setPayOpen(false)} onSettle={settle} />
    </div>
  );
}
