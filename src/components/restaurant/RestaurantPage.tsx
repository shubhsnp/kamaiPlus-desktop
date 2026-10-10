'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { AlertCircle, CheckCircle2, FileText, Info } from 'lucide-react';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { PrintFailureBar, useBackgroundBillPrint } from '@/components/billing/BillPrintQueue';
import { getDesktopApi } from '@/lib/desktop/desktopBridge';
import { newId } from '@/lib/ids';
import { tr } from '@/lib/i18n/core';
import { cn } from '@/lib/utils';
import type { Sale } from '@/types';
import { OrderGuest, newOrder, nextToken } from '@/lib/restaurant/model';
import { DeliveryDialog } from '@/components/restaurant/DeliveryDialog';
import { useRestaurant } from '@/lib/restaurant/store';
import { OrderScreen } from '@/components/restaurant/OrderScreen';
import { SetupDialog } from '@/components/restaurant/SetupDialog';
import { TablesHome } from '@/components/restaurant/TablesHome';

// The bill window (Print, PDF, WhatsApp — the counter's own): loaded the first time it opens.
const InvoiceModal = dynamic(() => import('@/components/invoices/InvoiceModal').then((m) => m.InvoiceModal), { ssr: false });

type Toast = { id: number; text: string; tone: 'success' | 'error' | 'info'; sale?: Sale };

/**
 * Restaurant mode's screen (v4.106.0, opened from the sidebar "Tables & Orders"): the Tables grid, and
 * one table's order. Only reachable when KamaiPlus support switches Restaurant mode on for this
 * computer (Admin Console → Remote control → Features). Same bills, printer and GST as the counter.
 */
export function RestaurantPage() {
  const business = useBusiness();
  const { state, settings, update } = useRestaurant();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  // v4.139.0: "New delivery" asks for the guest first; "New takeaway" may take a name / mobile too.
  const [guestFor, setGuestFor] = useState<'takeaway' | 'delivery' | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  // The bill window: right after paying ("Show the bill") or a bill opened again from Today's bills.
  const [saleToShow, setSaleToShow] = useState<{ sale: Sale; justPaid: boolean } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const notify = useCallback((text: string, tone: Toast['tone'] = 'success', sale?: Sale) => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), text, tone, sale });
    timer.current = window.setTimeout(() => setToast(null), sale ? 7000 : 4200);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const billPrint = useBackgroundBillPrint({
    printed: (sale) => notify(tr('Bill {number} sent to the printer.', { number: sale.invoice_number }), 'success', sale),
    failed: (sale, error) => notify(tr('Bill {number} saved, but it did not print: {error}', { number: sale.invoice_number, error }), 'error', sale),
  });

  const order = selectedId ? state.orders.find((o) => o.id === selectedId) : undefined;
  const busyTables = new Set(state.orders.filter((o) => o.kind === 'table').map((o) => o.label));
  const freeTables = settings.tables.filter((t) => !busyTables.has(t));

  const openTable = (label: string) => {
    const existing = state.orders.find((o) => o.kind === 'table' && o.label === label);
    if (existing) return setSelectedId(existing.id);
    const id = newId('rord');
    update((s) => (s.orders.some((o) => o.kind === 'table' && o.label === label) ? s : { ...s, orders: [...s.orders, newOrder('table', label, id, new Date().toISOString())] }));
    setSelectedId(id);
  };

  const newParcel = (kind: 'takeaway' | 'delivery', guest?: OrderGuest) => {
    const id = newId('rord');
    update((s) => {
      const t = nextToken(s.token, new Date(), kind === 'delivery' ? 'DL' : 'TA');
      const o = newOrder(kind, t.label, id, new Date().toISOString());
      const g = guest && (guest.name || guest.phone || guest.address) ? guest : undefined;
      return { token: t.counter, orders: [...s.orders, g ? { ...o, guest: g } : o] };
    });
    setSelectedId(id);
  };
  const newTakeaway = () => newParcel('takeaway');

  const back = useCallback(() => {
    setSelectedId(null);
    // An order nobody added anything to is not kept (an empty table card or a wasted token).
    update((s) => ({ ...s, orders: s.orders.filter((o) => o.lines.length > 0 || o.kotRounds > 0) }));
  }, [update]);

  // Like the counter: "Print straight away" sends it to the printer (the toast can still open it);
  // otherwise — or with no printer to send it to (a browser) — the bill window opens.
  const onSettled = (sale: Sale, printNow: boolean) => {
    setSelectedId(null);
    if (printNow && business && getDesktopApi()) {
      billPrint.print({ sale, business });
      notify(tr('Bill {number} saved — printing.', { number: sale.invoice_number }), 'success', sale);
    } else {
      setSaleToShow({ sale, justPaid: true });
    }
  };

  return (
    <div className="relative h-full flex flex-col" data-restaurant-page>
      {toast && (
        <div role="status" className={cn('fixed top-16 left-1/2 -translate-x-1/2 z-[70] max-w-[92vw] px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold flex items-center gap-2 border',
          toast.tone === 'success' && 'bg-emerald-600 text-white border-emerald-700', toast.tone === 'error' && 'bg-rose-600 text-white border-rose-700', toast.tone === 'info' && 'bg-slate-800 text-white border-slate-900')} data-restaurant-toast={toast.tone}>
          {toast.tone === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : toast.tone === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <Info className="w-4 h-4 shrink-0" />}
          <span>{toast.text}</span>
          {toast.sale && (
            <button type="button" onClick={() => { setSaleToShow({ sale: toast.sale!, justPaid: false }); setToast(null); }} data-toast-open-bill
              className="ml-1 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/20 hover:bg-white/30 font-black cursor-pointer">
              <FileText className="w-3.5 h-3.5" /> {tr('Open bill')}
            </button>
          )}
        </div>
      )}

      <PrintFailureBar failed={billPrint.failed} onRetry={(job) => billPrint.print(job)} onOpen={(job) => setSaleToShow({ sale: job.sale, justPaid: false })} onDismiss={billPrint.dismiss} />

      <div className="flex-1 min-h-0">
        {order ? (
          <OrderScreen order={order} settings={settings} update={update} business={business} freeTables={freeTables} onBack={back} onSettled={onSettled} notify={notify} />
        ) : (
          <div className="h-full overflow-y-auto pr-1">
            <TablesHome orders={state.orders} settings={settings} onOpenTable={openTable} onOpenOrder={setSelectedId} onNewTakeaway={newTakeaway} onNewDelivery={() => setGuestFor('delivery')} onSetup={() => setSetupOpen(true)} onOpenBill={(sale) => setSaleToShow({ sale, justPaid: false })} />
          </div>
        )}
      </div>

      <SetupDialog open={setupOpen} settings={settings} onClose={() => setSetupOpen(false)} />
      <DeliveryDialog open={guestFor === 'delivery'} onClose={() => setGuestFor(null)} onStart={(g) => { setGuestFor(null); newParcel('delivery', g); }} />
      {saleToShow && (
        <InvoiceModal isOpen onClose={() => setSaleToShow(null)} onNewBill={() => setSaleToShow(null)} sale={saleToShow.sale} business={business || null}
          isPostSaleSuccess={saleToShow.justPaid} initialPhone={saleToShow.sale.customer_phone} />
      )}
    </div>
  );
}
