'use client';

import React, { useMemo, useState } from 'react';
import { Product } from '@/types';
import { Input } from '@/components/ui/Input';
import { tr } from '@/lib/i18n/core';
import { restockMatches, restockPickOnEnter } from '@/lib/inward/restockPicker';

/** Manual Inward: find the item by name or barcode gun (FS-20) — Enter here never saves the form. */
export function RestockProductPicker({ products, value, onChange }: {
  products: Product[];
  value: string;
  onChange: (productId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const matches = useMemo(() => restockMatches(products, query), [products, query]);
  const selected = products.find((p) => p.id === value);
  const stockText = (p: Product) => `${tr('(Current:')} ${p.current_stock} ${p.unit})`;

  const choose = (p: Product) => {
    setQuery('');
    setActive(0);
    onChange(p.id);
  };

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 min-h-[38px]" data-restock-selected>
        <span className="text-xs font-semibold text-slate-900 dark:text-white min-w-0 truncate">{selected.name} {stockText(selected)}</span>
        <button type="button" onClick={() => onChange('')} className="shrink-0 text-xs font-bold text-indigo-700 hover:underline">{tr('Change')}</button>
      </div>
    );
  }

  return (
    <div>
      <Input
        autoFocus
        data-restock-search
        placeholder={tr('Type item name or barcode')}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setActive(0); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, matches.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
          else if (e.key === 'Enter') {
            e.preventDefault();
            const picked = restockPickOnEnter(products, query, active);
            if (picked) choose(picked);
          }
        }}
      />
      {matches.length > 0 ? (
        <div className="mt-1 max-h-44 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800" data-restock-results>
          {matches.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => choose(p)}
              className={`w-full text-left px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-white ${i === active ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-900'}`}
            >
              {p.name} <span className="font-normal text-slate-500">{stockText(p)}</span>
            </button>
          ))}
        </div>
      ) : query.trim() ? (
        <p className="mt-1 text-[11px] font-semibold text-rose-700" data-restock-none>{tr('No item with this name or barcode.')}</p>
      ) : null}
    </div>
  );
}
