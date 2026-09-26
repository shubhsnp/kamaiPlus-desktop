'use client';
import { showConfirm } from '@/lib/ui/dialogs';

import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Search, Truck, CheckCircle2 } from 'lucide-react';
import { db } from '@/lib/db';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { Supplier } from '@/types';
import { formatINR } from '@/lib/utils';
import { deleteSupplier, SupplierEntryKind } from '@/lib/suppliers/supplierLedger';
import { SupplierFormModal } from '@/components/suppliers/SupplierFormModal';
import { SupplierEntryModal } from '@/components/suppliers/SupplierEntryModal';
import { SupplierDetailPanel, SupplierEmptyPanel, balanceLabel } from '@/components/suppliers/SupplierDetailPanel';
import { CashierPrivacyToggleButton, ProfitMask } from '@/components/privacy/ProfitMask';
import { tr } from '@/lib/i18n/core';

type Filter = 'all' | 'owe' | 'advance';

export default function SuppliersPage() {
  const business = useBusiness();
  const suppliers = useLiveQuery(() => db.suppliers.orderBy('name').toArray()) || [];

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [entryKind, setEntryKind] = useState<SupplierEntryKind | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const showToast = (text: string, ok = true) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 4500);
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return suppliers
      .filter((s) => (filter === 'owe' ? s.current_balance > 0 : filter === 'advance' ? s.current_balance < 0 : true))
      .filter((s) => !q || s.name.toLowerCase().includes(q) || (s.phone || '').includes(q) || (s.gstin || '').toLowerCase().includes(q))
      .sort((a, b) => (b.current_balance || 0) - (a.current_balance || 0) || a.name.localeCompare(b.name));
  }, [suppliers, query, filter]);

  const totalOwed = suppliers.reduce((acc, s) => acc + Math.max(0, s.current_balance || 0), 0);
  const oweCount = suppliers.filter((s) => s.current_balance > 0).length;
  const selected = suppliers.find((s) => s.id === selectedId) || null;

  const handleDelete = async (s: Supplier) => {
    if (!await showConfirm(tr('Delete supplier "{name}"? Their account history stays in your records.', { name: s.name }), { danger: true, confirmLabel: tr('Delete') })) return;
    const res = await deleteSupplier(s.id);
    if (!res.ok) return showToast(res.error || tr('Could not delete.'), false);
    setSelectedId(null);
    showToast(tr('Deleted {name}.', { name: s.name }));
  };

  return (
    <div className="h-full flex flex-col gap-3 min-h-0">
      {toast && (
        <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${toast.ok ? 'bg-emerald-500 text-slate-950' : 'bg-rose-600 text-white'}`}>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toast.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Truck className="w-5 h-5 text-amber-500" />
            {tr('Suppliers')}
          </h1>
          <p className="text-xs text-slate-500">
            {suppliers.length} {tr('suppliers • You owe')}{' '}
            <span className="font-black text-rose-700"><ProfitMask>{formatINR(totalOwed)}</ProfitMask></span> {tr('to')} {oweCount}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CashierPrivacyToggleButton />
          <button
            type="button"
            onClick={() => { setEditing(null); setFormOpen(true); }}
            className="h-9 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> {tr('Add Supplier')}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(300px,380px)_1fr] gap-3">
        {/* List */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col min-h-0">
          <div className="p-3 border-b border-slate-100 space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tr('Search name, phone or GSTIN')}
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-slate-900"
              />
            </div>
            <div className="flex gap-1.5">
              {([['all', tr('All')], ['owe', tr('You owe')], ['advance', tr('Advance')]] as [Filter, string][]).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${filter === id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100">
            {shown.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                {suppliers.length === 0 ? tr('No suppliers yet. Add the wholesalers you buy from.') : tr('No supplier matches.')}
              </div>
            ) : (
              shown.map((s) => {
                const bal = balanceLabel(s.current_balance || 0);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 cursor-pointer ${selectedId === s.id ? 'bg-amber-50' : 'hover:bg-slate-50'}`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{s.name}</div>
                      <div className="text-[11px] text-slate-500 truncate">{s.phone || tr('No phone')}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md border text-[10.5px] font-black whitespace-nowrap ${bal.className}`}>
                      <ProfitMask>{bal.text}</ProfitMask>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detail */}
        <div className="min-h-0">
          {selected ? (
            <SupplierDetailPanel
              supplier={selected}
              onPurchase={() => setEntryKind('purchase')}
              onPayment={() => setEntryKind('payment')}
              onEdit={() => { setEditing(selected); setFormOpen(true); }}
              onDelete={() => handleDelete(selected)}
            />
          ) : (
            <SupplierEmptyPanel />
          )}
        </div>
      </div>

      {formOpen && (
        <SupplierFormModal
          isOpen={formOpen}
          onClose={() => setFormOpen(false)}
          businessId={business?.id || 'biz_default'}
          existing={editing}
          onSaved={(created) => {
            if (created) setSelectedId(created.id);
            showToast(editing ? tr('Supplier updated.') : tr('Supplier added.'));
          }}
        />
      )}

      {selected && entryKind && (
        <SupplierEntryModal
          isOpen={Boolean(entryKind)}
          onClose={() => setEntryKind(null)}
          supplier={selected}
          kind={entryKind}
          onSaved={(msg) => showToast(msg)}
        />
      )}
    </div>
  );
}
