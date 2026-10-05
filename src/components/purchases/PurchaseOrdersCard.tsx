'use client';

import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ClipboardList, MessageCircle, PackageCheck, X } from 'lucide-react';
import { db } from '@/lib/db';
import { Card } from '@/components/ui/Card';
import { ProfitMask } from '@/components/privacy/ProfitMask';
import { formatINR } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import { showConfirm } from '@/lib/ui/dialogs';
import { openWhatsApp } from '@/lib/whatsapp/openWhatsApp';
import { toWhatsAppNumber } from '@/lib/whatsapp/whatsappLinks';
import { cancelPurchaseOrder, purchaseOrderText, receivePurchaseOrder, supplierDocKind } from '@/lib/purchases/supplierDocs';
import type { PurchaseBill } from '@/types';

/**
 * Open purchase orders on Purchases (v4.102.0, K-D21): send to the supplier on WhatsApp, mark
 * received (stock in, and on credit what you owe), or cancel. Hidden when there are none.
 */
export function PurchaseOrdersCard({ shopName, onMessage }: { shopName?: string; onMessage: (text: string) => void }) {
  const orders = useLiveQuery(async () => (await db.purchase_bills.where('status').equals('pending_review').toArray())
    .filter((b) => supplierDocKind(b) === 'order')
    .sort((a, b) => b.created_at.localeCompare(a.created_at)), []) || [];
  const suppliers = useLiveQuery(() => db.suppliers.toArray()) || [];
  if (orders.length === 0) return null;

  const phoneOf = (o: PurchaseBill) => suppliers.find((s) => s.id === o.supplier_id)?.phone || null;

  const receive = async (o: PurchaseBill) => {
    const saved = Boolean(o.supplier_id);
    const ok = await showConfirm(tr('Add the {count} items of {number} to stock?', { count: o.line_items?.length || 0, number: o.bill_number || '' }), {
      title: tr('Goods received'), confirmLabel: tr('Add to stock'), cancelLabel: tr('Cancel'),
    });
    if (!ok) return;
    const onCredit = saved && o.total_amount > 0 && await showConfirm(
      tr('Bought on credit? Add {amount} to what you owe {name}.', { amount: formatINR(o.total_amount), name: o.supplier_name_raw || '' }),
      { title: tr('On credit?'), confirmLabel: tr('Yes, on credit'), cancelLabel: tr('No, paid') }
    );
    const res = await receivePurchaseOrder(o.id, Boolean(onCredit));
    onMessage(res.ok ? tr('{number} received — stock updated.', { number: o.bill_number || '' }) : tr('Could not save. Please try again.'));
  };

  const cancel = async (o: PurchaseBill) => {
    if (!(await showConfirm(tr('Cancel purchase order {number}?', { number: o.bill_number || '' }), { title: tr('Cancel order'), confirmLabel: tr('Cancel order'), cancelLabel: tr('Keep') }))) return;
    await cancelPurchaseOrder(o.id);
  };

  return (
    <Card className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm" data-purchase-orders>
      <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white mb-3 flex items-center gap-2">
        <ClipboardList className="w-4 h-4 text-sky-600" />
        <span>{tr('Open Purchase Orders')}</span>
        <span className="text-[11px] font-mono text-slate-500 normal-case">{orders.length}</span>
      </h3>
      <div className="space-y-2">
        {orders.map((o) => (
          <div key={o.id} className="p-3 rounded-xl border border-sky-200 bg-sky-50/50 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="min-w-0">
              <div className="font-bold text-slate-900 truncate">{o.bill_number} • {o.supplier_name_raw || tr('Supplier')}</div>
              <div className="text-[11px] text-slate-500">
                {(o.line_items || []).length} {tr('items •')} {new Date(o.created_at).toLocaleDateString('en-IN')}
                {o.total_amount > 0 && <> • <ProfitMask>{formatINR(o.total_amount)}</ProfitMask></>}
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button type="button" onClick={() => void openWhatsApp(toWhatsAppNumber(phoneOf(o)), purchaseOrderText(o, shopName))}
                className="h-8 px-2.5 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-bold flex items-center gap-1 cursor-pointer">
                <MessageCircle className="w-3.5 h-3.5" /> {tr('WhatsApp')}
              </button>
              <button type="button" onClick={() => void receive(o)} className="h-8 px-2.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 font-bold flex items-center gap-1 cursor-pointer" data-receive-order>
                <PackageCheck className="w-3.5 h-3.5" /> {tr('Received')}
              </button>
              <button type="button" onClick={() => void cancel(o)} className="h-8 w-8 rounded-lg border border-slate-300 text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer" aria-label={tr('Cancel order')}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
