'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ShoppingBag, X } from 'lucide-react';
import { CLOUD_ACCOUNT_EVENT, getCloudAccount } from '@/lib/cloud/cloudAccount';
import { CLOUD_STATUS_EVENT, cloudSendActive, deviceId } from '@/lib/cloud/cloudPush';
import { STAFF_CART_OPEN_EVENT, STAFF_CART_PENDING_KEY, type StaffCart } from '@/lib/cloud/counterCarts';
import { isRestaurantMode } from '@/lib/features/featureSwitches';
import { pagePath } from '@/lib/ui/globalShortcuts';
import { tr } from '@/lib/i18n/core';
import { formatINR } from '@/lib/utils';

/**
 * Carts sent from a staff phone ("Send to counter", v4.173.0, lib/cloud/counterCarts.ts) — a card per
 * cart, bottom right, on every screen. "Open bill" takes it for this PC and opens it as a new bill on
 * Billing; the bill is completed here (this PC's invoice number, GST, stock, galla).
 * Only with cloud sync on, and not in Restaurant mode (waiters use the tables).
 */
export function StaffCartInbox() {
  const router = useRouter();
  const pathname = usePathname();
  const [carts, setCarts] = useState<StaffCart[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    let stop: (() => void) | null = null;
    let listeningFor = '';
    const sync = async () => {
      const account = getCloudAccount();
      const want = cloudSendActive() && account && !account.stub && !isRestaurantMode() ? account.bizId : '';
      if (want === listeningFor) return;
      stop?.();
      stop = null;
      listeningFor = want;
      setCarts([]);
      if (!want) return;
      try {
        const { startCartInbox } = await import('@/lib/cloud/counterCartsCloud');
        const s = await startCartInbox(want, setCarts, (e: any) => console.warn('Staff carts notice:', e?.message));
        if (listeningFor === want) stop = s;
        else s();
      } catch (e) {
        listeningFor = '';
        console.warn('Staff carts could not start:', e);
      }
    };
    void sync();
    window.addEventListener(CLOUD_ACCOUNT_EVENT, sync);
    window.addEventListener(CLOUD_STATUS_EVENT, sync);
    const every = window.setInterval(sync, 60 * 1000);
    return () => {
      window.removeEventListener(CLOUD_ACCOUNT_EVENT, sync);
      window.removeEventListener(CLOUD_STATUS_EVENT, sync);
      window.clearInterval(every);
      stop?.();
    };
  }, []);

  const open = async (cart: StaffCart) => {
    const account = getCloudAccount();
    if (!account || busy) return;
    setBusy(cart.id);
    try {
      const { takeCart } = await import('@/lib/cloud/counterCartsCloud');
      const taken = await takeCart(account.bizId, cart.id, deviceId());
      if (!taken) {
        setNote(tr('This cart was already opened on another counter.'));
        return;
      }
      localStorage.setItem(STAFF_CART_PENDING_KEY, JSON.stringify(taken));
      if (pagePath(pathname) === '/billing') window.dispatchEvent(new Event(STAFF_CART_OPEN_EVENT));
      else router.push('/billing');
    } catch {
      setNote(tr('Could not open the cart. Check the internet and try again.'));
    } finally {
      setBusy('');
    }
  };

  const shown = carts.filter((c) => !hidden.includes(c.id)).slice(-3);
  if (!shown.length && !note) return null;
  return (
    <div className="fixed bottom-10 right-16 z-50 w-[330px] space-y-2" data-staff-cart-inbox>
      {note && (
        <div className="rounded-xl bg-slate-900 text-white text-xs font-bold px-3 py-2 flex items-center justify-between gap-2 shadow-xl">
          <span>{note}</span>
          <button type="button" onClick={() => setNote('')} className="opacity-70 hover:opacity-100 cursor-pointer" aria-label={tr('Close')}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      {shown.map((c) => {
        const items = c.lines.length;
        return (
          <div key={c.id} className="rounded-2xl bg-white border-2 border-indigo-300 shadow-2xl p-3" data-staff-cart={c.id}>
            <div className="flex items-start gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0"><ShoppingBag className="w-4 h-4 text-indigo-700" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-slate-900 truncate">{tr('{name} sent a cart', { name: c.staffName })}</p>
                <p className="text-xs text-slate-500 font-semibold">
                  {items === 1 ? tr('1 item') : tr('{count} items', { count: items })} · {formatINR(c.totalPaise)}{c.customerName ? ` · ${c.customerName}` : ''}
                </p>
              </div>
              <button type="button" onClick={() => setHidden((h) => [...h, c.id])} className="text-slate-400 hover:text-slate-700 cursor-pointer" aria-label={tr('Later')} title={tr('Later')}><X className="w-4 h-4" /></button>
            </div>
            <button type="button" onClick={() => void open(c)} disabled={busy === c.id} data-staff-cart-open
              className="mt-2.5 w-full h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-black cursor-pointer">
              {busy === c.id ? tr('Opening…') : tr('Open bill at the counter')}
            </button>
          </div>
        );
      })}
    </div>
  );
}
