'use client';

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Edit3, Plus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { db } from '@/lib/db';
import { Product } from '@/types';
import { formatINR, parseRupeesToPaise } from '@/lib/utils';
import { addVariantToParent } from '@/lib/products/variants';

interface VariantsManagerModalProps {
  parent: Product;
  onClose: () => void;
  /** Opens the normal edit form for one variant (it is an ordinary product). */
  onEditVariant: (variant: Product) => void;
}

/** Every variant of a parent product, and a row to add a new one. */
export function VariantsManagerModal({ parent, onClose, onEditVariant }: VariantsManagerModalProps) {
  const children =
    useLiveQuery(
      async () =>
        (await db.products.filter((p) => p.parent_id === parent.id).toArray()).sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true })
        ),
      [parent.id]
    ) || [];

  const [label, setLabel] = useState('');
  const [price, setPrice] = useState(((children[0]?.selling_price ?? parent.selling_price) / 100).toFixed(2));
  const [stock, setStock] = useState('0');
  const [barcode, setBarcode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await addVariantToParent(parent, {
      label,
      sellingPricePaise: parseRupeesToPaise(price || '0'),
      mrpPaise: 0,
      stock: parseFloat(stock) || 0,
      barcode,
    });
    setSaving(false);
    if (!res.ok) return setError(res.error || 'Could not add the variant.');
    setLabel('');
    setStock('0');
    setBarcode('');
  };

  return (
    <Modal isOpen onClose={onClose} title={`${parent.name} — Variants`} description={`${children.length} sizes / colours. Each has its own price and stock.`} size="lg">
      <div className="space-y-4">
        <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-[45vh] overflow-y-auto">
          {children.length === 0 ? (
            <p className="p-6 text-center text-xs text-slate-500">No variants yet. Add the first one below.</p>
          ) : (
            children.map((v) => {
              const out = !v.is_unlimited_stock && v.current_stock <= 0;
              return (
                <div key={v.id} className="px-3 py-2.5 flex items-center gap-3 text-xs">
                  <span className="px-2 py-1 rounded-lg bg-purple-100 text-purple-800 font-black min-w-[48px] text-center">{v.variant_label || '—'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 truncate">{v.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono truncate">{v.barcode || 'No barcode'}</div>
                  </div>
                  <span className="font-mono font-black text-slate-900">{formatINR(v.selling_price)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${out ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {v.is_unlimited_stock ? '∞' : out ? 'Out' : `${v.current_stock} ${v.unit}`}
                  </span>
                  <button type="button" onClick={() => onEditVariant(v)} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 cursor-pointer" aria-label={`Edit ${v.name}`}>
                    <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        <form onSubmit={handleAdd} className="p-3 rounded-xl bg-purple-50 border border-purple-200 space-y-2">
          <p className="text-xs font-black text-purple-900">Add a variant</p>
          <div className="grid grid-cols-2 sm:grid-cols-[1fr_110px_90px_1fr_auto] gap-2">
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Size / colour, e.g. XXL" className="h-9 px-3 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-purple-500" />
            <input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price ₹" className="h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono focus:outline-none focus:border-purple-500" />
            <input type="number" step="any" min="0" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="Stock" className="h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono focus:outline-none focus:border-purple-500" />
            <input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Barcode (optional)" className="h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono focus:outline-none focus:border-purple-500" />
            <button type="submit" disabled={saving} className="h-9 px-3 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:bg-slate-400 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
          {error && <p className="text-xs font-bold text-rose-700">{error}</p>}
        </form>
      </div>
    </Modal>
  );
}
