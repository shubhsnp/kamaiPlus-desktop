'use client';

import React, { useMemo, useState } from 'react';
import { Layers, Plus, Scale, Search, Trash2, Upload } from 'lucide-react';
import { Category, Product } from '@/types';
import { formatINR } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import { searchProducts } from '@/lib/search/productSearch';

export interface QueueItem {
  /** Product id (every label belongs to a saved item, so it scans at the counter). */
  id: string;
  name: string;
  barcode: string;
  pricePaise: number;
  mrpPaise?: number;
  /** For the cost code / size-colour lines (labelExtras.ts). */
  costPaise?: number;
  detail?: string;
  copies: number;
  /** Counted stock (null = unlimited). */
  stock: number | null;
}

interface LabelQueuePanelProps {
  queue: QueueItem[];
  onChange: (queue: QueueItem[]) => void;
  products: Product[];
  categories: Category[];
  onAdd: (products: Product[]) => void;
  lastImportCount: number;
  onAddLastImport: () => void;
  /** Opens "Loose pack labels" (weighed packs). */
  onLoosePack: () => void;
  busy: boolean;
}

const btn = 'inline-flex items-center gap-1 px-2.5 h-8 rounded-lg border text-[11px] font-bold cursor-pointer disabled:opacity-50';

/** Which items get labels and how many of each — one by one, a whole category, all, or the last Excel import. */
export function LabelQueuePanel({ queue, onChange, products, categories, onAdd, lastImportCount, onAddLastImport, onLoosePack, busy }: LabelQueuePanelProps) {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [allCopies, setAllCopies] = useState('1');

  const results = useMemo(() => {
    if (!search.trim()) return [];
    return searchProducts(products, search).slice(0, 6); // English or हिंदी / मराठी
  }, [products, search]);
  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) m.set(p.category_id, (m.get(p.category_id) || 0) + 1);
    return m;
  }, [products]);

  const labels = queue.reduce((n, q) => n + q.copies, 0);
  const setCopies = (id: string, copies: number) => onChange(queue.map((q) => (q.id === id ? { ...q, copies: Math.max(1, Math.min(999, Math.round(copies) || 1)) } : q)));

  return (
    <div className="space-y-2.5 text-xs">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-slate-900 uppercase tracking-wider" data-queue-count>
          {tr('Print list: {items} items • {labels} labels', { items: queue.length, labels })}
        </h3>
        {queue.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="text-rose-600 font-bold cursor-pointer">{tr('Clear')}</button>
        )}
      </div>

      <div className="relative">
        <div className="flex items-center bg-white border border-slate-300 focus-within:border-slate-800 rounded-lg px-2 h-9">
          <Search className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr('Search an item to add…')} className="w-full bg-transparent focus:outline-none font-medium" data-queue-search />
        </div>
        {results.length > 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-300 rounded-xl shadow-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
            {results.map((p) => (
              <button key={p.id} type="button" onClick={() => { onAdd([p]); setSearch(''); }} className="w-full text-left p-2.5 hover:bg-slate-50 flex items-center justify-between gap-2 cursor-pointer" data-queue-result>
                <span className="min-w-0">
                  <span className="block font-bold text-slate-900 truncate">{p.name}</span>
                  <span className="block text-[10px] text-slate-500 font-mono">{p.barcode || tr('new code on add')} • {formatINR(p.selling_price)}</span>
                </span>
                <Plus className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button type="button" disabled={busy || products.length === 0} onClick={() => onAdd(products)} className={`${btn} border-slate-300 bg-white hover:bg-slate-50`} data-queue-all>
          <Layers className="w-3.5 h-3.5" /> {tr('All items ({count})', { count: products.length })}
        </button>
        {lastImportCount > 0 && (
          <button type="button" disabled={busy} onClick={onAddLastImport} className={`${btn} border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100`} data-queue-last-import>
            <Upload className="w-3.5 h-3.5" /> {tr('Last Excel import ({count})', { count: lastImportCount })}
          </button>
        )}
        <button type="button" onClick={onLoosePack} className={`${btn} border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100`} title={tr('Packs weighed out of a loose item — the bar code carries the weight')} data-queue-loose>
          <Scale className="w-3.5 h-3.5" /> {tr('Loose packs (by weight)')}
        </button>
      </div>
      <div className="flex gap-1.5">
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="flex-1 h-8 px-2 rounded-lg border border-slate-300 bg-white font-bold" data-queue-category>
          <option value="">{tr('Add a whole category…')}</option>
          {categories.filter((c) => byCategory.get(c.id)).map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({byCategory.get(c.id)})</option>
          ))}
        </select>
        <button type="button" disabled={!categoryId || busy} onClick={() => { onAdd(products.filter((p) => p.category_id === categoryId)); setCategoryId(''); }} className={`${btn} border-slate-900 bg-slate-900 text-white`}>
          {tr('Add')}
        </button>
      </div>

      {queue.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-slate-50 border border-slate-200">
          <span className="font-bold text-slate-700">{tr('Copies for all:')}</span>
          <input type="number" min="1" value={allCopies} onChange={(e) => setAllCopies(e.target.value)} className="w-16 h-8 px-2 rounded-lg border border-slate-300 font-mono" data-queue-all-copies />
          <button type="button" onClick={() => onChange(queue.map((q) => ({ ...q, copies: Math.max(1, Math.round(Number(allCopies)) || 1) })))} className={`${btn} border-slate-300 bg-white`}>{tr('Apply')}</button>
          <button type="button" onClick={() => onChange(queue.map((q) => (q.stock && q.stock > 0 ? { ...q, copies: Math.min(999, Math.ceil(q.stock)) } : q)))} className={`${btn} border-slate-300 bg-white`} title={tr('Items with counted stock get one label per piece in stock')}>
            {tr('= stock')}
          </button>
        </div>
      )}

      <div className="divide-y divide-slate-100 max-h-[40vh] overflow-y-auto pr-1" data-queue-list>
        {queue.length === 0 ? (
          <p className="py-6 text-center text-slate-400">{tr('No items yet. Search one, add a category or all items.')}</p>
        ) : (
          queue.map((q) => (
            <div key={q.id} className="py-1.5 flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-900 truncate">{q.name}</div>
                <div className="text-[10px] text-slate-500 font-mono">{q.barcode} • {formatINR(q.pricePaise)}</div>
              </div>
              <button type="button" onClick={() => setCopies(q.id, q.copies - 1)} className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold cursor-pointer">−</button>
              <input type="number" min="1" value={q.copies} onChange={(e) => setCopies(q.id, Number(e.target.value))} className="w-12 h-6 text-center rounded border border-slate-200 font-mono font-bold" />
              <button type="button" onClick={() => setCopies(q.id, q.copies + 1)} className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold cursor-pointer">+</button>
              <button type="button" onClick={() => onChange(queue.filter((x) => x.id !== q.id))} className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer" aria-label={tr('Remove')}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
