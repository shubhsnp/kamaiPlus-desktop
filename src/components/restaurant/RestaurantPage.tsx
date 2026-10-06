'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { PrintFailureBar, useBackgroundBillPrint } from '@/components/billing/BillPrintQueue';
import { getDesktopApi } from '@/lib/desktop/desktopBridge';
import { newId } from '@/lib/ids';
import { tr } from '@/lib/i18n/core';
import { cn } from '@/lib/utils';
import type { Sale } from '@/types';
import { newOrder, nextToken } from '@/lib/restaurant/model';
import { useRestaurant } from '@/lib/restaurant/store';
import { OrderScreen } from '@/components/restaurant/OrderScreen';
import { SetupDialog } from '@/components/restaurant/SetupDialog';
import { TablesHome } from '@/components/restaurant/TablesHome';

// The bill window (only when the bill cannot be printed straight away): loaded the first time it opens.
const InvoiceModal = dynamic(() => import('@/components/invoices/InvoiceModal').then((m) => m.InvoiceModal), { ssr: false });

type Toast = { id: number; text: string; tone: 'success' | 'error' | 'info' };

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
  const [toast, setToast] = useState<Toast | null>(null);
  const [saleToShow, setSaleToShow] = useState<Sale | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const notify = useCallback((text: string, tone: Toast['tone'] = 'success') => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), text, tone });
    timer.current = window.setTimeout(() => setToast(null), 4200);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const billPrint = useBackgroundBillPrint({
    printed: (sale) => notify(tr('Bill {number} sent to the printer.', { number: sale.invoice_number }), 'success'),
    failed: (sale, error) => notify(tr('Bill {number} saved, but it did not print: {error}', { number: sale.invoice_number, error }), 'error'),
  });

  const order = selectedId ? state.orders.find((o) => o.id === selectedId) : undefined;

  const openTable = (label: string) => {
    const existing = state.orders.find((o) => o.kind === 'table' && o.label === label);
    if (existing) return setSelectedId(existing.id);
    const id = newId('rord');
    update((s) => (s.orders.some((o) => o.kind === 'table' && o.label === label) ? s : { ...s, orders: [...s.orders, newOrder('table', label, id, new Date().toISOString())] }));
    setSelectedId(id);
  };

  const newTakeaway = () => {
    const id = newId('rord');
    update((s) => {
      const t = nextToken(s.token);
      return { token: t.counter, orders: [...s.orders, newOrder('takeaway', t.label, id, new Date().toISOString())] };
    });
    setSelectedId(id);
  };

  const back = useCallback(() => {
    setSelectedId(null);
    // An order nobody added anything to is not kept (an empty table card or a wasted token).
    update((s) => ({ ...s, orders: s.orders.filter((o) => o.lines.length > 0 || o.kotRounds > 0) }));
  }, [update]);

  const onSettled = (sale: Sale) => {
    setSelectedId(null);
    if (business && getDesktopApi()) {
      billPrint.print({ sale, business });
      notify(tr('Bill {number} saved — printing.', { number: sale.invoice_number }), 'success');
    } else {
      // No printer to send it to here (a browser): show the bill, it can be printed from there.
      setSaleToShow(sale);
    }
  };

  return (
    <div className="relative h-full flex flex-col" data-restaurant-page>
      {toast && (
        <div role="status" className={cn('fixed top-16 left-1/2 -translate-x-1/2 z-[70] max-w-[92vw] px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold flex items-center gap-2 border',
          toast.tone === 'success' && 'bg-emerald-600 text-white border-emerald-700', toast.tone === 'error' && 'bg-rose-600 text-white border-rose-700', toast.tone === 'info' && 'bg-slate-800 text-white border-slate-900')} data-restaurant-toast={toast.tone}>
          {toast.tone === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : toast.tone === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <Info className="w-4 h-4 shrink-0" />}
          <span>{toast.text}</span>
        </div>
      )}

      <PrintFailureBar failed={billPrint.failed} onRetry={(job) => billPrint.print(job)} onOpen={(job) => setSaleToShow(job.sale)} onDismiss={billPrint.dismiss} />

      <div className="flex-1 min-h-0">
        {order ? (
          <OrderScreen order={order} settings={settings} update={update} business={business} onBack={back} onSettled={onSettled} notify={notify} />
        ) : (
          <div className="h-full overflow-y-auto pr-1">
            <TablesHome orders={state.orders} settings={settings} onOpenTable={openTable} onOpenOrder={setSelectedId} onNewTakeaway={newTakeaway} onSetup={() => setSetupOpen(true)} />
          </div>
        )}
      </div>

      <SetupDialog open={setupOpen} settings={settings} onClose={() => setSetupOpen(false)} />
      {saleToShow && (
        <InvoiceModal isOpen onClose={() => setSaleToShow(null)} onNewBill={() => setSaleToShow(null)} sale={saleToShow} business={business || null} isPostSaleSuccess />
      )}
    </div>
  );
}
