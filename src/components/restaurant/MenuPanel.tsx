'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, UtensilsCrossed, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { cn, formatINR } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import { unitPriceFor } from '@/lib/billing/priceMode';
import type { MenuPick } from '@/lib/restaurant/model';
import { MenuDish, menuPick, useMenu } from '@/components/restaurant/useMenu';

/**
 * The menu side of an order (v4.106.0): search, category chips and big touch tiles — one tap adds a
 * piece. A dish with Half / Full asks which one. The number on a tile is how many are already in
 * this order.
 */
export function MenuPanel({ onPick, inOrder, searchRef }: {
  onPick: (pick: MenuPick) => void;
  /** product id → pieces in the current order. */
  inOrder: Map<string, number>;
  searchRef: React.RefObject<HTMLInputElement>;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const { dishes, categories, total } = useMenu(query, category);
  const [sizeFor, setSizeFor] = useState<MenuDish | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Enter in the search box adds the first match (a waiter types "pan" and Enter).
  const addFirst = () => {
    if (dishes[0]) choose(dishes[0]);
  };

  const choose = (d: MenuDish) => {
    if (d.sizes.length > 0) return setSizeFor(d);
    if (!(unitPriceFor(d.product, 'retail') > 0)) return;
    onPick(menuPick(d.product));
    if (query) setQuery('');
  };

  useEffect(() => {
    gridRef.current?.scrollTo({ top: 0 });
  }, [category, query]);

  const countOf = (d: MenuDish) => (d.sizes.length ? d.sizes.reduce((n, s) => n + (inOrder.get(s.id) || 0), 0) : inOrder.get(d.product.id) || 0);
  const priceText = (d: MenuDish) => {
    if (d.sizes.length) return `${tr('from')} ${formatINR(Math.min(...d.sizes.map((s) => unitPriceFor(s, 'retail'))))}`;
    const p = unitPriceFor(d.product, 'retail');
    return p > 0 ? formatINR(p) : tr('No price');
  };

  return (
    <div className="flex flex-col min-h-0 h-full" data-restaurant-menu>
      <div className="flex items-center gap-2 mb-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addFirst();
              } else if (e.key === 'Escape' && query) {
                e.stopPropagation();
                setQuery('');
              }
            }}
            placeholder={tr('Search the menu — press Enter to add the first one')}
            aria-label={tr('Search the menu')}
            className="w-full h-11 pl-9 pr-9 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer" aria-label={tr('Clear search')}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 shrink-0" role="tablist" aria-label={tr('Menu categories')}>
        {[{ id: 'all', name: tr('All') }, ...categories.map((c) => ({ id: c.id, name: c.name }))].map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={category === c.id}
            onClick={() => setCategory(c.id)}
            className={cn(
              'shrink-0 h-9 px-3.5 rounded-full text-xs font-bold border cursor-pointer transition-colors',
              category === c.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div ref={gridRef} className="flex-1 min-h-0 overflow-y-auto pr-1">
        {total === 0 ? (
          <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center gap-2 text-slate-500 p-6">
            <UtensilsCrossed className="w-8 h-8 text-slate-300" />
            <p className="text-sm font-bold text-slate-700">{tr('Your menu is empty')}</p>
            <p className="text-xs max-w-xs">{tr('Add your dishes as items (or load them from Excel) on the Products page — they appear here.')}</p>
            <Link href="/products" className="mt-1 px-4 h-9 inline-flex items-center rounded-xl bg-slate-900 text-white text-xs font-bold">{tr('Open Products')}</Link>
          </div>
        ) : dishes.length === 0 ? (
          <p className="text-center text-xs text-slate-500 py-12">{tr('No dish matches "{query}".', { query })}</p>
        ) : (
          <div className="grid gap-2.5 pt-1 px-0.5 pb-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))' }}>
            {dishes.map((d) => {
              const n = countOf(d);
              const noPrice = d.sizes.length === 0 && !(unitPriceFor(d.product, 'retail') > 0);
              return (
                <button
                  key={d.product.id}
                  type="button"
                  disabled={noPrice}
                  onClick={() => choose(d)}
                  data-menu-dish={d.product.id}
                  className={cn(
                    'relative text-left rounded-2xl border bg-white p-3 min-h-[88px] flex flex-col justify-between gap-2 cursor-pointer transition-all duration-100',
                    'hover:border-emerald-500 hover:shadow-md active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600',
                    n > 0 ? 'border-emerald-500 ring-1 ring-emerald-500/30' : 'border-slate-200',
                    noPrice && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <span className={cn('text-[13px] font-bold text-slate-900 leading-snug line-clamp-2', n > 0 && 'pr-6')}>
                    {d.product.name}
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-emerald-700 font-mono">{priceText(d)}</span>
                    {d.sizes.length > 0 && <span className="text-[10px] font-bold text-slate-500 uppercase">{d.sizes.map((s) => s.variant_label).filter(Boolean).slice(0, 2).join(' / ')}</span>}
                  </span>
                  {n > 0 && (
                    <span className="absolute top-2 right-2 min-w-[22px] h-[22px] px-1 rounded-full bg-emerald-600 text-white text-[11px] font-black flex items-center justify-center shadow-xs">
                      {n}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Modal isOpen={Boolean(sizeFor)} onClose={() => setSizeFor(null)} title={sizeFor?.product.name} description={tr('Which one?')} size="sm">
        <div className="grid gap-2" data-restaurant-sizes>
          {(sizeFor?.sizes || []).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onPick(menuPick(s));
                setSizeFor(null);
              }}
              className="flex items-center justify-between gap-3 px-4 h-14 rounded-xl border border-slate-200 bg-white hover:border-emerald-500 hover:bg-emerald-50 text-left cursor-pointer"
            >
              <span className="text-sm font-black text-slate-900">{s.variant_label || s.name}</span>
              <span className="text-sm font-black text-emerald-700 font-mono">{formatINR(unitPriceFor(s, 'retail'))}</span>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
