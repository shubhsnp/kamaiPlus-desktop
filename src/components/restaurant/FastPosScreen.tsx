'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutGrid, Settings2, Zap } from 'lucide-react';
import type { Business, Sale } from '@/types';
import { newId } from '@/lib/ids';
import { tr } from '@/lib/i18n/core';
import { MenuPick, RestLine, RestOrder, addPiece, applyToOnePiece, changeQty, lineTitle, liveLines, removeLine } from '@/lib/restaurant/model';
import type { RestAddOn, RestaurantSettings } from '@/lib/restaurant/settings';
import { RestState, parseRestState } from '@/lib/restaurant/store';
import { newFastCart, previewFastToken, reserveFastToken } from '@/lib/restaurant/fastPos';
import { printKot } from '@/lib/restaurant/kot';
import { RestPayMethod, settleOrder } from '@/lib/restaurant/settle';
import type { DiscountInput } from '@/lib/restaurant/model';
import { showConfirm } from '@/lib/ui/dialogs';
import { MenuPanel } from '@/components/restaurant/MenuPanel';
import { FastCartPanel } from '@/components/restaurant/FastCartPanel';
import { AddOnsDialog } from '@/components/restaurant/AddOnsDialog';
import { PayDialog, SettleExtras } from '@/components/restaurant/PayDialog';
import { RecentBills } from '@/components/restaurant/RecentBills';
import { reportError } from '@/lib/diagnostics/errorReporter';

const CART_KEY = 'kamai_fast_cart';

/** The saved cart (survives leaving the screen or a restart); a damaged one is a fresh cart. */
function loadCart(): RestOrder {
  const fresh = newFastCart(false, new Date().toISOString(), newId('fast'));
  if (typeof window === 'undefined') return fresh;
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return fresh;
    // The shared parser needs a label; an un-tokened cart is stored with none.
    const [o] = parseRestState({ orders: [{ ...raw, kind: 'takeaway', label: raw.label || '·' }] }).orders;
    return o ? { ...o, label: o.label === '·' ? '' : o.label, fast: { dineIn: Boolean(o.fast?.dineIn) } } : fresh;
  } catch {
    return fresh;
  }
}

const saveCart = (cart: RestOrder) => {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch (e) {
    reportError('storage', e, 'fast POS cart not saved');
  }
};

/**
 * Fast POS (v4.161.0): the token counter for a restaurant with no tables. Menu on the left, the cart on
 * the right; Pay (or F10) takes the next token (TK-01…), saves an ordinary bill through settleOrder —
 * the same GST, UPI QR, printing, Transactions and cloud as a table bill — and, with a kitchen printer
 * and the Set-up switch on, prints the KOT with the token. The cart is never a running order.
 */
export function FastPosScreen({ state, settings, update, business, onTables, onSetup, onSettled, onOpenBill, notify }: {
  state: RestState;
  settings: RestaurantSettings;
  update: (change: (s: RestState) => RestState) => void;
  business?: Business | null;
  onTables: () => void;
  onSetup: () => void;
  onSettled: (sale: Sale) => void;
  /** Today's bills strip: open one again (print, PDF, WhatsApp). */
  onOpenBill: (sale: Sale) => void;
  notify: (text: string, tone?: 'success' | 'error' | 'info') => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [cart, setCart] = useState<RestOrder>(() => loadCart());
  const [addOnsFor, setAddOnsFor] = useState<RestLine | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const now = () => new Date().toISOString();

  const change = (f: (o: RestOrder) => RestOrder) => setCart((c) => {
    const next = f(c);
    saveCart(next);
    return next;
  });

  const pick = (p: MenuPick) => change((o) => addPiece(o, p, now()));
  const qty = (key: string, delta: number) => change((o) => changeQty(o, key, delta, now()));
  // No KOT went out yet, so a removed dish simply goes (no cancel slip needed).
  const remove = (key: string) => change((o) => {
    const r = removeLine(o, key, now());
    return { ...r, lines: r.lines.filter((l) => l.qty > 0) };
  });
  const applyAddOns = (addOns: RestAddOn[], note: string) => {
    if (addOnsFor) change((o) => applyToOnePiece(o, addOnsFor.key, addOns, note, now()));
    setAddOnsFor(null);
  };
  const setDineIn = (dineIn: boolean) => change((o) => ({ ...o, fast: { dineIn } }));

  const freshCart = (dineIn: boolean) => {
    const next = newFastCart(dineIn, now(), newId('fast'));
    saveCart(next);
    setCart(next);
  };

  const clear = async () => {
    if (liveLines(cart).length === 0) return;
    const ok = await showConfirm(tr('Remove every dish from this order?'), { title: tr('Clear order'), confirmLabel: tr('Clear') });
    // A token already taken stays with the cart, so the next customer still gets the next number.
    if (ok) change((o) => ({ ...o, lines: [] }));
  };

  // Pay: the cart takes its token now (once), so the number shows in the payment window and on the bill.
  const pay = () => {
    if (liveLines(cart).length === 0 || busy) return;
    if (!cart.label) {
      let label = '';
      update((s) => {
        const r = reserveFastToken(s);
        label = r.label;
        return r.state;
      });
      if (label) change((o) => ({ ...o, label }));
    }
    setPayOpen(true);
  };

  const settle = async (method: RestPayMethod, receivedPaise: number, discount: DiscountInput | null, extras: SettleExtras) => {
    if (busy || !cart.label) return;
    setBusy(true);
    const order = cart;
    try {
      const sale = await settleOrder({ order, settings, business, method, receivedPaise, discount, guestName: extras.guestName, guestPhone: extras.guestPhone });
      setPayOpen(false);
      freshCart(Boolean(order.fast?.dineIn));
      onSettled(sale);
      if (settings.fastKot) {
        // The kitchen slip with the token — only when a kitchen printer is chosen (no printer = just the bill).
        try {
          const res = await printKot({ order, shopName: business?.name, round: 1 });
          if (!res.ok && !res.noPrinter && !res.empty) notify(tr('Bill saved, but the KOT did not print: {error}. Tell the kitchen token {label}.', { error: res.error || tr('printer not ready'), label: order.label }), 'error');
        } catch (e) {
          notify(tr('Bill saved, but the KOT did not print: {error}. Tell the kitchen token {label}.', { error: (e instanceof Error && e.message) || tr('printer not ready'), label: order.label }), 'error');
        }
      }
      searchRef.current?.focus();
    } catch (e) {
      console.error('Fast POS bill not saved:', e);
      notify(tr('Could not save the bill. Please try again.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  // F10 = Pay, "/" = search (unless a window is open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('[aria-modal="true"]')) return;
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (e.key === 'F10') {
        e.preventDefault();
        pay();
      } else if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const inOrder = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of liveLines(cart)) m.set(l.productId, (m.get(l.productId) || 0) + l.qty);
    return m;
  }, [cart]);
  const token = cart.label ? { label: cart.label, reserved: true } : { label: previewFastToken(state), reserved: false };

  return (
    <div className="h-full flex flex-col gap-3" data-restaurant-screen="fast">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-sm"><Zap className="w-5 h-5" /></div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">{tr('Fast POS')}</h1>
          <p className="text-xs text-slate-500 font-medium">{tr('Token billing for a counter without tables: tap dishes, Pay, and the bill prints with a token.')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onTables} data-fast-tables
            className="h-10 px-3 rounded-xl border border-slate-300 bg-white hover:border-emerald-500 hover:text-emerald-700 text-sm font-bold flex items-center gap-1.5 cursor-pointer">
            <LayoutGrid className="w-4 h-4" /> {tr('Tables')}
          </button>
          <button type="button" onClick={onSetup} aria-label={tr('Set-up')} data-fast-setup
            className="h-10 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-sm font-bold flex items-center gap-1.5 cursor-pointer">
            <Settings2 className="w-4 h-4" /> <span className="hidden sm:inline">{tr('Set-up')}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid gap-4 min-h-[520px] lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-h-[420px] lg:min-h-0 lg:h-full rounded-2xl bg-slate-50/60 border border-slate-200 p-3 sm:p-4 flex flex-col">
          <MenuPanel onPick={pick} inOrder={inOrder} searchRef={searchRef} />
        </div>
        <div className="min-h-[520px] lg:min-h-0 lg:h-full">
          <FastCartPanel cart={cart} settings={settings} token={token} busy={busy} onDineIn={setDineIn} onQty={qty} onDelete={remove} onAddOns={setAddOnsFor} onClear={clear} onPay={pay} />
        </div>
      </div>

      <RecentBills onOpen={onOpenBill} />

      <AddOnsDialog title={addOnsFor ? lineTitle(addOnsFor) : null} library={settings.addOns} onClose={() => setAddOnsFor(null)} onApply={applyAddOns} />
      {cart.label && <PayDialog order={cart} settings={settings} business={business} open={payOpen} busy={busy} onClose={() => !busy && setPayOpen(false)} onSettle={settle} />}
    </div>
  );
}
