'use client';

import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Modal } from '@/components/ui/Modal';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { db } from '@/lib/db';
import type { Product } from '@/types';
import { msg, tr } from '@/lib/i18n/core';
import { formatQty } from '@/lib/invoices/invoiceDocument';
import { restockOrderMessage, suggestedOrderQty } from '@/lib/whatsapp/businessMessages';
import { messageShop } from '@/lib/whatsapp/whatsappDrafts';
import { openWhatsAppComposer } from '@/lib/whatsapp/openWhatsApp';
import { WhatsAppIcon } from './WhatsAppButton';

/**
 * Restock order on WhatsApp (v4.79.0) — the Android "Low-stock reorder": tick the items, set the
 * quantities, pick a saved supplier (or type one), and the order opens in the WhatsApp window.
 */
export function RestockOrderModal({ products, preselect, onClose }: { products: Product[]; preselect?: string[]; onClose: () => void }) {
  const business = useBusiness();
  const suppliers = useLiveQuery(() => db.suppliers.toArray(), []) || [];
  const [picked, setPicked] = useState<Set<string>>(() => new Set(preselect && preselect.length ? preselect : products.map((p) => p.id)));
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(products.map((p) => [p.id, String(suggestedOrderQty(p))])));
  const [supplierId, setSupplierId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const lines = useMemo(
    () => products.filter((p) => picked.has(p.id)).map((p) => ({ name: p.name, qty: Number(qty[p.id]) || 0, unit: p.unit, stock: Number(p.current_stock ?? 0) })).filter((l) => l.qty > 0),
    [products, picked, qty]
  );

  const pickSupplier = (id: string) => {
    setSupplierId(id);
    const s = suppliers.find((x) => x.id === id);
    setName(s?.name || '');
    setPhone(s?.phone || '');
  };
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const cont = () => {
    if (!lines.length) return;
    const message = restockOrderMessage({ shop: messageShop(business), supplierName: name, items: lines });
    onClose();
    openWhatsAppComposer({ kind: 'text', title: msg('Restock order on WhatsApp'), message, phone, recipientName: name || undefined });
  };

  const field = 'h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-bold';
  return (
    <Modal isOpen onClose={onClose} size="lg" title={<span className="flex items-center gap-2"><WhatsAppIcon className="w-5 h-5" />{tr('Restock order on WhatsApp')}</span>} description={tr('Tick what to order and how much; the order opens in WhatsApp for your supplier.')}>
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {suppliers.length > 0 && (
            <select value={supplierId} onChange={(e) => pickSupplier(e.target.value)} className={field} data-restock-supplier>
              <option value="">{tr('Type a supplier…')}</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr('Supplier name')} className={field} data-restock-name />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={tr('Supplier WhatsApp number')} className={`${field} font-mono`} inputMode="tel" data-restock-phone />
        </div>
        <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
          {products.map((p) => (
            <label key={p.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-50" data-restock-row={p.id}>
              <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} />
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-slate-900 truncate">{p.name}</span>
                <span className="block text-[10.5px] text-slate-500">{tr('In stock: {stock} {unit}', { stock: formatQty(Math.max(0, Number(p.current_stock ?? 0))), unit: p.unit })}</span>
              </span>
              <input
                value={qty[p.id] ?? ''}
                onChange={(e) => setQty((q) => ({ ...q, [p.id]: e.target.value.replace(/[^\d.]/g, '') }))}
                className="w-20 h-8 px-2 rounded-lg border border-slate-300 text-right font-mono font-bold"
                inputMode="decimal"
                aria-label={tr('Order quantity')}
                data-restock-qty
              />
              <span className="w-12 text-slate-500">{p.unit}</span>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-slate-500">{tr('{count} items in the order', { count: lines.length })}</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="h-9 px-3 rounded-lg font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">{tr('Cancel')}</button>
            <button type="button" onClick={cont} disabled={!lines.length} className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50" data-restock-continue>
              <WhatsAppIcon className="w-4 h-4 text-white" /> {tr('Continue on WhatsApp')}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
