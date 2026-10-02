'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import { Category, Product } from '@/types';
import { formatINR } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import { looksLikeBarcode } from '@/lib/billing/scanInput';
import { parseAmount } from '@/lib/import/catalogImport';
import { StockEntryRow, stockAfterInward } from '@/lib/inward/stockEntry';
import { splitTrailingCode } from '@/lib/inward/fastInward';

export interface FastColumns {
  /** "Separate Selling Price" on: Price + MRP; off: one MRP box. */
  mrp: boolean;
  cost: boolean;
}

export function fastGridTemplate(c: FastColumns): string {
  return ['1.5rem', '8.5rem', 'minmax(11rem, 1fr)', '5.5rem', c.mrp && '5.5rem', c.cost && '5.5rem', '8.5rem', '4.5rem', '1.75rem'].filter(Boolean).join(' ');
}

const input = 'w-full h-8 px-2 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400';

interface FastInwardRowProps {
  row: StockEntryRow;
  index: number;
  linked: Product | null;
  categories: Category[];
  columns: FastColumns;
  /** Set right after a scan landed on this row. */
  flash: boolean;
  error?: string;
  onChange: (patch: Partial<StockEntryRow>) => void;
  onRemove: () => void;
  /** Enter in a box: back to the scan box. */
  onBackToScan: () => void;
  /** The gun typed a code into this row's name box: handle it as a scan. */
  onScan: (code: string) => void;
}

/** One scanned item: its code, name, price, category and quantity (blank = not counted). */
export function FastInwardRow({ row, index, linked, categories, columns, flash, error, onChange, onRemove, onBackToScan, onScan }: FastInwardRowProps) {
  const qty = row.qty.trim() ? parseAmount(row.qty) : 0;
  const needs = !linked && (!row.name.trim() || !row.price.trim());

  const onEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    onBackToScan();
  };
  const onNameEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const hit = splitTrailingCode(e.currentTarget.value, looksLikeBarcode);
    if (hit) {
      onChange({ name: hit.before });
      onScan(hit.code);
      return;
    }
    onBackToScan();
  };

  let hint = '';
  if (linked) {
    if (!(qty && qty > 0)) hint = linked.is_unlimited_stock ? tr('not counted') : tr('Saved item • stock {stock}', { stock: linked.current_stock });
    else {
      const s = stockAfterInward(linked, qty);
      hint = s.startsCounting ? tr('Saved item • not counted now — counting starts at {qty}', { qty: s.next }) : tr('Saved item • stock {from} → {to}', { from: s.previous, to: s.next });
    }
  } else if (!(qty && qty > 0)) {
    hint = tr('No quantity — saved as "Unlimited stock" (not counted)');
  }

  return (
    <div data-fast-row={row.key} className={`rounded-lg px-1 py-1 transition-colors ${error ? 'bg-rose-50' : flash ? 'bg-amber-50' : ''}`}>
      <div className="grid items-center gap-1.5" style={{ gridTemplateColumns: fastGridTemplate(columns) }}>
        <span className="text-[10px] font-mono text-slate-400 text-right">{index + 1}</span>
        <div className="min-w-0">
          <div className="text-[10px] font-mono text-slate-600 truncate" title={row.barcode || linked?.barcode || ''}>{row.barcode || linked?.barcode || '—'}</div>
          <span className={`inline-block mt-0.5 px-1.5 rounded text-[10px] font-black uppercase ${linked ? 'bg-emerald-100 text-emerald-800' : needs ? 'bg-amber-100 text-amber-900' : 'bg-sky-100 text-sky-800'}`} data-fast-status>
            {linked ? tr('Saved') : needs ? tr('Name + price needed') : tr('New')}
          </span>
        </div>
        <input value={row.name} readOnly={Boolean(linked)} onChange={(e) => onChange({ name: e.target.value })} onKeyDown={onNameEnter} placeholder={tr('Item name')} className={`${input} ${linked ? 'bg-emerald-50 border-emerald-300' : ''}`} data-fast-name />
        <input value={row.price} onChange={(e) => onChange({ price: e.target.value })} onKeyDown={onEnter} inputMode="decimal" placeholder={linked ? formatINR(columns.mrp ? linked.selling_price : linked.mrp || linked.selling_price) : '₹'} className={`${input} font-mono`} data-fast-price />
        {columns.mrp && <input value={row.mrp} onChange={(e) => onChange({ mrp: e.target.value })} onKeyDown={onEnter} inputMode="decimal" placeholder={linked ? formatINR(linked.mrp || linked.selling_price) : tr('optional')} className={`${input} font-mono`} />}
        {columns.cost && <input value={row.cost} onChange={(e) => onChange({ cost: e.target.value })} onKeyDown={onEnter} inputMode="decimal" placeholder={linked?.purchase_price ? formatINR(linked.purchase_price) : tr('optional')} className={`${input} font-mono`} />}
        <select value={row.categoryId || ''} onChange={(e) => onChange({ categoryId: e.target.value || undefined })} className={`${input} px-1`} data-fast-category>
          <option value="">{tr('Default')}</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input value={row.qty} onChange={(e) => onChange({ qty: e.target.value })} onKeyDown={onEnter} inputMode="decimal" placeholder="—" className={`${input} font-mono font-black text-center`} data-fast-qty />
        <button type="button" tabIndex={-1} onClick={onRemove} className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer" aria-label={tr('Remove')}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {(hint || error) && (
        <div className="text-[10px] font-semibold mt-0.5" style={{ paddingLeft: '10.5rem' }}>
          {error ? <span className="text-rose-700" data-fast-error>{tr(error)}</span> : <span className={linked ? 'text-emerald-700' : 'text-slate-500'}>{hint}</span>}
        </div>
      )}
    </div>
  );
}
