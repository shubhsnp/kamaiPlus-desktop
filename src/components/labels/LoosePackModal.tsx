'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Scale, Search, Trash2 } from 'lucide-react';
import { Product } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { formatINR } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import { searchProducts } from '@/lib/search/productSearch';
import { ensureProductBarcode } from '@/lib/barcode/storeBarcodes';
import { formatPackAmount, makeWeighedBarcode, storeCodeNumber, weighedScale } from '@/lib/barcode/weighedBarcode';
import { QueueItem } from './LabelQueuePanel';

/** Pack sizes are typed in the small unit (g / ml / cm); this turns them into the item's unit. */
const SMALL: Record<string, { label: string; perUnit: number; chips: number[] }> = {
  kg: { label: 'g', perUnit: 1000, chips: [100, 250, 500, 1000, 2000] },
  litre: { label: 'ml', perUnit: 1000, chips: [250, 500, 1000] },
  meter: { label: 'cm', perUnit: 100, chips: [50, 100, 200] },
  gram: { label: 'g', perUnit: 1, chips: [50, 100, 250, 500] },
  ml: { label: 'ml', perUnit: 1, chips: [100, 250, 500, 1000] },
};

interface PackRow {
  small: number;
  copies: number;
}

/**
 * Loose-pack labels (v4.77.0): packs weighed out of a loose item. Each label's bar code
 * carries the item and the weight (lib/barcode/weighedBarcode.ts), and its price is the
 * item's rate × the weight — one scan at the counter adds exactly that pack.
 */
export function LoosePackModal({ products, onClose, onAdd }: { products: Product[]; onClose: () => void; onAdd: (items: QueueItem[]) => void }) {
  const loose = useMemo(() => products.filter((p) => weighedScale(p.unit)), [products]);
  const [search, setSearch] = useState('');
  const [item, setItem] = useState<Product | null>(null);
  const [rows, setRows] = useState<PackRow[]>([]);
  const [custom, setCustom] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const results = useMemo(() => (search.trim() ? searchProducts(loose, search).slice(0, 6) : loose.slice(0, 6)), [loose, search]);
  const small = item ? SMALL[item.unit] : null;
  const qtyOf = (r: PackRow) => (small ? r.small / small.perUnit : 0);
  const total = rows.reduce((n, r) => n + r.copies, 0);

  const addSize = (sizeSmall: number) => {
    if (!(sizeSmall > 0)) return;
    setRows((prev) => {
      const at = prev.findIndex((r) => r.small === sizeSmall);
      if (at >= 0) return prev.map((r, i) => (i === at ? { ...r, copies: Math.min(999, r.copies + 1) } : r));
      return [...prev, { small: sizeSmall, copies: 1 }];
    });
  };

  const submit = async () => {
    if (!item || !small || rows.length === 0) return;
    setBusy(true);
    setError('');
    try {
      const code = await ensureProductBarcode(item);
      if (storeCodeNumber(code) === null) {
        setError(tr('"{name}" has the maker\'s barcode ({code}). Loose-pack labels need the shop\'s own code — clear the barcode in Products and try again.', { name: item.name, code }));
        return;
      }
      const out: QueueItem[] = [];
      for (const r of rows) {
        const qty = qtyOf(r);
        const barcode = makeWeighedBarcode(code, item.unit, qty);
        if (!barcode) {
          setError(tr('{size} is too big for one pack label.', { size: formatPackAmount(item.unit, qty) }));
          return;
        }
        out.push({
          id: `${item.id}@${r.small}`,
          name: `${item.name} ${formatPackAmount(item.unit, qty)}`,
          barcode,
          pricePaise: Math.round(item.selling_price * qty),
          mrpPaise: Math.round((item.mrp || item.selling_price) * qty),
          costPaise: item.purchase_price > 0 ? Math.round(item.purchase_price * qty) : undefined,
          copies: r.copies,
          stock: null,
        });
      }
      onAdd(out);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} size="lg" title={<span className="flex items-center gap-2"><Scale className="w-4 h-4 text-amber-600" />{tr('Loose pack labels')}</span>} description={tr('Packs weighed out of a loose item. The bar code carries the weight — one scan adds that pack to the bill at the right price.')}>
      <div className="space-y-3 text-xs">
        {!item ? (
          <>
            <div className="flex items-center bg-white border border-slate-300 focus-within:border-slate-800 rounded-lg px-2 h-9">
              <Search className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
              <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr('Search an item sold by kg / litre / metre…')} className="w-full bg-transparent focus:outline-none font-medium" data-loose-search />
            </div>
            {loose.length === 0 ? (
              <p className="py-6 text-center text-slate-500">{tr('No item is sold by kg, gram, litre, ml or metre yet. Set the item\'s unit in Products first.')}</p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                {results.map((p) => (
                  <button key={p.id} type="button" onClick={() => { setItem(p); setRows([]); setError(''); }} className="w-full text-left p-2.5 hover:bg-slate-50 flex items-center justify-between cursor-pointer" data-loose-item>
                    <span className="font-bold text-slate-900 truncate">{p.name}</span>
                    <span className="text-slate-500 font-mono shrink-0">{formatINR(p.selling_price)} / {p.unit}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50 border border-amber-200">
              <span className="font-black text-slate-900 truncate">{item.name} <span className="font-mono font-bold text-slate-600">{formatINR(item.selling_price)} / {item.unit}</span></span>
              <button type="button" onClick={() => setItem(null)} className="text-sky-700 font-bold cursor-pointer shrink-0">{tr('Change')}</button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-slate-700">{tr('Pack size:')}</span>
              {small!.chips.map((c) => (
                <button key={c} type="button" onClick={() => addSize(c)} className="px-2.5 h-8 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 font-bold cursor-pointer" data-loose-chip={c}>
                  {formatPackAmount(item.unit, c / small!.perUnit)}
                </button>
              ))}
              <span className="flex items-center gap-1">
                <input value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { addSize(Math.round(Number(custom))); setCustom(''); } }} inputMode="numeric" placeholder={small!.label} className="w-16 h-8 px-2 rounded-lg border border-slate-300 font-mono" data-loose-custom />
                <button type="button" onClick={() => { addSize(Math.round(Number(custom))); setCustom(''); }} className="p-1.5 rounded-lg border border-slate-300 bg-white cursor-pointer" aria-label={tr('Add')}>
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </span>
            </div>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg" data-loose-rows>
              {rows.length === 0 ? (
                <p className="py-5 text-center text-slate-400">{tr('Pick a pack size above.')}</p>
              ) : rows.map((r) => (
                <div key={r.small} className="px-2.5 py-1.5 flex items-center gap-2">
                  <span className="flex-1 font-bold text-slate-900">{formatPackAmount(item.unit, qtyOf(r))}</span>
                  <span className="font-mono font-bold text-slate-700 w-20 text-right">{formatINR(Math.round(item.selling_price * qtyOf(r)))}</span>
                  <input type="number" min="1" value={r.copies} onChange={(e) => setRows((prev) => prev.map((x) => (x.small === r.small ? { ...x, copies: Math.max(1, Math.min(999, Math.round(Number(e.target.value)) || 1)) } : x)))} className="w-14 h-7 text-center rounded border border-slate-300 font-mono font-bold" aria-label={tr('Copies')} />
                  <button type="button" onClick={() => setRows((prev) => prev.filter((x) => x.small !== r.small))} className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer" aria-label={tr('Remove')}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            {error && <p className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-bold">{error}</p>}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button type="button" onClick={onClose} className="px-3 h-9 rounded-lg border border-slate-300 bg-white font-bold cursor-pointer">{tr('Cancel')}</button>
              <button type="button" disabled={busy || total === 0} onClick={() => void submit()} className="px-4 h-9 rounded-lg bg-slate-900 text-white font-black cursor-pointer disabled:opacity-50" data-loose-add>
                {tr('Add {count} labels to the print list', { count: total })}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
