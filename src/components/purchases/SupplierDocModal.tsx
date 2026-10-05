'use client';

import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatINR, parseRupeesToPaise } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import { searchProducts } from '@/lib/search/productSearch';
import { isVariantParent } from '@/lib/products/variants';
import { docLinesTotal, saveDebitNote, savePurchaseOrder, SupplierDocLine } from '@/lib/purchases/supplierDocs';
import type { PurchaseBill } from '@/types';

interface Row extends SupplierDocLine {
  key: string;
  costText: string;
}

/**
 * Purchases → "Return to supplier" (debit note) and "Purchase order" (v4.102.0, K-D21): the
 * supplier, the items with quantity and cost, a note. The saving rules are in
 * lib/purchases/supplierDocs.ts.
 */
export function SupplierDocModal({ kind, businessId, onClose, onSaved }: {
  kind: 'debit_note' | 'order';
  businessId: string;
  onClose: () => void;
  onSaved: (bill: PurchaseBill) => void;
}) {
  const products = (useLiveQuery(() => db.products.toArray()) || []).filter((p) => !isVariantParent(p));
  const suppliers = useLiveQuery(() => db.suppliers.orderBy('name').toArray()) || [];
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState('');
  const [notes, setNotes] = useState('');
  const [adjustAccount, setAdjustAccount] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isReturn = kind === 'debit_note';
  const matches = useMemo(() => (query.trim() ? searchProducts(products, query).slice(0, 8) : []), [products, query]);
  const supplier = suppliers.find((s) => s.id === supplierId) || null;
  const total = docLinesTotal(rows);

  const addProduct = (id: string) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setRows((prev) => prev.some((r) => r.productId === id) ? prev : [...prev, {
      key: `${id}_${Date.now()}`, productId: id, name: p.name, unit: p.unit, qty: 1,
      costPaise: p.purchase_price || 0, costText: p.purchase_price ? String(p.purchase_price / 100) : '',
    }]);
    setQuery('');
  };
  const setRow = (key: string, patch: Partial<Row>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const save = async () => {
    setError(null);
    if (!supplier && !supplierName.trim()) return setError(tr('Choose the supplier or type the name.'));
    if (rows.filter((r) => r.qty > 0).length === 0) return setError(tr('Add at least one item with a quantity.'));
    if (isReturn) {
      const over = rows.find((r) => {
        const p = products.find((x) => x.id === r.productId);
        return p && !p.is_unlimited_stock && r.qty > (Number(p.current_stock) || 0);
      });
      if (over) return setError(tr('Only {stock} of "{name}" in stock — you cannot return more.', { stock: products.find((x) => x.id === over.productId)?.current_stock ?? 0, name: over.name }));
    }
    setSaving(true);
    try {
      const input = { businessId, supplier, supplierName, lines: rows, notes };
      const res = isReturn ? await saveDebitNote({ ...input, adjustAccount }) : await savePurchaseOrder(input);
      if (res.ok) onSaved(res.bill);
      else setError(tr('Add at least one item with a quantity.'));
    } catch (e) {
      console.error('Supplier document not saved:', e);
      setError(tr('Could not save. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full bg-white border border-slate-300 text-slate-900 rounded-xl p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none min-h-[38px]';

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      title={isReturn ? tr('Return to Supplier (Debit Note)') : tr('New Purchase Order')}
      description={isReturn ? tr('Goods going back to the supplier. Stock goes down; for a saved supplier, what you owe goes down too.') : tr('What you are ordering from the supplier. Stock changes only when you mark it received.')}
    >
      <div className="space-y-3" data-supplier-doc={kind}>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700 block">{tr('Supplier / Vendor')}</label>
          {suppliers.length > 0 && (
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={field}>
              <option value="">{tr('-- Not a saved supplier --')}</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}{s.phone ? ` (${s.phone})` : ''}</option>)}
            </select>
          )}
          {!supplierId && <Input placeholder={tr('e.g. Metro Wholesale')} value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />}
        </div>

        <div className="space-y-1 relative">
          <label className="text-xs font-bold text-slate-700 block">{tr('Add item')}</label>
          <Input placeholder={tr('Type item name or barcode')} value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && matches[0]) { e.preventDefault(); addProduct(matches[0].id); } }} />
          {matches.length > 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
              {matches.map((p) => (
                <button key={p.id} type="button" onClick={() => addProduct(p.id)} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex justify-between gap-2 cursor-pointer">
                  <span className="font-bold text-slate-900 truncate">{p.name}</span>
                  <span className="text-slate-500 shrink-0">{tr('Stock:')} {p.is_unlimited_stock ? '∞' : p.current_stock} {p.unit}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {rows.length > 0 && (
          <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
            {rows.map((r) => (
              <div key={r.key} className="p-2.5 flex flex-wrap items-center gap-2 text-xs">
                <span className="flex-1 min-w-[140px] font-bold text-slate-900 truncate">{r.name}</span>
                <label className="flex items-center gap-1 text-slate-500">{tr('Qty')}
                  <input type="number" min="0" step="any" value={r.qty || ''} onChange={(e) => setRow(r.key, { qty: parseFloat(e.target.value) || 0 })}
                    className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-slate-900 font-mono" aria-label={tr('Quantity')} />
                </label>
                <label className="flex items-center gap-1 text-slate-500">{tr('Cost ₹')}
                  <input type="number" min="0" step="0.01" value={r.costText} onChange={(e) => setRow(r.key, { costText: e.target.value, costPaise: e.target.value ? parseRupeesToPaise(e.target.value) : 0 })}
                    className="w-24 border border-slate-300 rounded-lg px-2 py-1.5 text-slate-900 font-mono" aria-label={tr('Cost price per unit')} />
                </label>
                <span className="w-20 text-right font-mono font-bold">{formatINR(Math.round(r.qty * r.costPaise))}</span>
                <button type="button" onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))} className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer" aria-label={tr('Remove')}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <div className="p-2.5 flex justify-between text-xs font-black">
              <span>{tr('Total')}</span>
              <span className="font-mono">{formatINR(total)}</span>
            </div>
          </div>
        )}

        <Input label={isReturn ? tr('Reason (optional)') : tr('Note for the supplier (optional)')} placeholder={isReturn ? tr('e.g. Damaged, expired, wrong item') : tr('e.g. Deliver by Monday')} value={notes} onChange={(e) => setNotes(e.target.value)} />

        {isReturn && supplier && (
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input type="checkbox" checked={adjustAccount} onChange={(e) => setAdjustAccount(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
            {tr('Take {amount} off what I owe {name}', { amount: formatINR(total), name: supplier.name })}
          </label>
        )}

        {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">{error}</div>}

        <div className="pt-3 flex justify-end gap-2 border-t border-slate-200">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>{tr('Cancel')}</Button>
          <Button type="button" size="sm" disabled={saving} onClick={save}>{isReturn ? tr('Save Debit Note') : tr('Save Purchase Order')}</Button>
        </div>
      </div>
    </Modal>
  );
}
