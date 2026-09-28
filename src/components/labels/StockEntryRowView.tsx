'use client';

import React, { useMemo, useState } from 'react';
import { Link2, Trash2, X } from 'lucide-react';
import { Product, ProductUnit } from '@/types';
import { formatINR } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import { searchProducts } from '@/lib/search/productSearch';
import { looksLikeBarcode } from '@/lib/billing/scanInput';
import { MASTER_UNITS } from '@/lib/constants/storeProfiles';
import { isMeasuredUnit, StockEntryRow, stockAfterInward } from '@/lib/inward/stockEntry';
import { parseAmount } from '@/lib/import/catalogImport';

export interface EntryColumns {
  /** "Separate Selling Price" on: Price + MRP; off: one MRP box. */
  mrp: boolean;
  cost: boolean;
  gst: boolean;
  hsn: boolean;
}

/** CSS grid columns for the header and every row (same order as the inputs). */
export function entryGridTemplate(c: EntryColumns): string {
  return ['1.5rem', 'minmax(12rem, 1fr)', '5.5rem', c.mrp && '5.5rem', c.cost && '5.5rem', c.gst && '4.5rem', c.hsn && '5.5rem', '4.5rem', '5.5rem', '1.75rem']
    .filter(Boolean)
    .join(' ');
}

const GST_RATES = [0, 3, 5, 12, 18, 28, 40];
const input = 'w-full h-8 px-2 rounded-md border bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400';

interface StockEntryRowViewProps {
  row: StockEntryRow;
  index: number;
  /** The saved item this row restocks (picked, scanned, or the exact name). */
  linked: Product | null;
  products: Product[];
  columns: EntryColumns;
  error?: string;
  onChange: (patch: Partial<StockEntryRow>) => void;
  onRemove: () => void;
  /** Enter in the last box: go to the next row. */
  onNextRow: () => void;
  /** A code typed by the barcode gun into the name box. */
  onScan: (code: string) => void;
}

/** One row of "New stock + labels": item, price(s), quantity (= labels). Enter moves on. */
export function StockEntryRowView({ row, index, linked, products, columns, error, onChange, onRemove, onNextRow, onScan }: StockEntryRowViewProps) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);

  const results = useMemo(() => {
    if (row.productId || !open || row.name.trim().length < 2) return [];
    return searchProducts(products, row.name).slice(0, 6);
  }, [products, row.name, row.productId, open]);

  const pick = (p: Product) => {
    onChange({ productId: p.id, name: p.name, unit: p.unit, price: '', mrp: '', barcode: '' });
    setOpen(false);
    setHi(-1);
  };

  // Enter moves to the next box of this row; the last box goes to the next row.
  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter' || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    const boxes = Array.from((e.currentTarget.closest('[data-entry-row]') as HTMLElement).querySelectorAll<HTMLElement>('input:not([readonly]):not([data-skip-enter]), select:not([disabled]):not([data-skip-enter])'));
    const at = boxes.indexOf(e.currentTarget as HTMLElement);
    if (at >= 0 && at < boxes.length - 1) boxes[at + 1].focus();
    else onNextRow();
  };

  const onNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && results.length) {
      e.preventDefault();
      setHi((h) => Math.min(results.length - 1, h + 1));
      return;
    }
    if (e.key === 'ArrowUp' && results.length) {
      e.preventDefault();
      setHi((h) => Math.max(-1, h - 1));
      return;
    }
    if (e.key === 'Escape' && results.length) {
      e.stopPropagation(); // closes the list, not the window
      setOpen(false);
      return;
    }
    if (e.key !== 'Enter' || e.ctrlKey || e.metaKey) return;
    const text = e.currentTarget.value.trim();
    if (looksLikeBarcode(text)) {
      e.preventDefault();
      setOpen(false);
      onScan(text);
      return;
    }
    if (hi >= 0 && results[hi]) {
      e.preventDefault();
      pick(results[hi]);
      const price = e.currentTarget.closest('[data-entry-row]')?.querySelector<HTMLInputElement>('[data-entry-price]');
      window.setTimeout(() => price?.focus(), 0);
      return;
    }
    setOpen(false);
    onKeyDown(e);
  };

  const qty = parseAmount(row.qty);
  const unit = linked ? linked.unit : row.unit;
  let hint: React.ReactNode = null;
  if (linked) {
    const s = qty && qty > 0 ? stockAfterInward(linked, qty) : null;
    hint = (
      <span className="text-emerald-700">
        <Link2 className="inline w-3 h-3 mr-0.5 -mt-0.5" />
        {linked.is_unlimited_stock
          ? s ? tr('Saved item • not counted now — counting starts at {qty}', { qty: s.next }) : tr('Saved item • not counted now')
          : s ? tr('Saved item • stock {from} → {to}', { from: s.previous, to: s.next }) : tr('Saved item • stock {stock}', { stock: linked.current_stock })}
        {' • '}{linked.barcode || tr('gets its own barcode')}
      </span>
    );
  } else if (row.name.trim() || row.barcode) {
    hint = <span className="text-sky-700">{row.barcode ? tr('New item • barcode {code} (from the packet)', { code: row.barcode }) : tr('New item • gets its own barcode')}</span>;
  }

  return (
    <div data-entry-row={row.key} className={`rounded-lg px-1 py-1 ${error ? 'bg-rose-50' : ''}`}>
      <div className="grid items-center gap-1.5" style={{ gridTemplateColumns: entryGridTemplate(columns) }}>
        <span className="text-[10px] font-mono text-slate-400 text-right">{index + 1}</span>

        <div className="relative">
          <div className="flex items-center">
            <input
              value={row.name}
              readOnly={Boolean(row.productId)}
              onChange={(e) => { onChange({ name: e.target.value }); setOpen(true); setHi(-1); }}
              onFocus={() => setOpen(true)}
              onBlur={() => window.setTimeout(() => setOpen(false), 150)}
              onKeyDown={onNameKeyDown}
              placeholder={tr('Item name, or scan the packet')}
              className={`${input} ${row.productId ? 'bg-emerald-50 border-emerald-300 pr-7' : 'border-slate-300'}`}
              data-entry-name
            />
            {row.productId && (
              <button type="button" tabIndex={-1} onClick={() => onChange({ productId: undefined, name: '', price: '' })} className="-ml-6 p-0.5 text-slate-400 hover:text-rose-600 cursor-pointer" title={tr('Not this item')}>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {results.length > 0 && (
            <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
              {results.map((p, i) => (
                <button key={p.id} type="button" tabIndex={-1} onMouseDown={(e) => { e.preventDefault(); pick(p); }} className={`w-full text-left px-2.5 py-1.5 flex items-center justify-between gap-2 cursor-pointer ${i === hi ? 'bg-amber-50' : 'hover:bg-slate-50'}`} data-entry-suggestion>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-slate-900 truncate">{p.name}</span>
                    <span className="block text-[10px] text-slate-500">{formatINR(p.selling_price)} • {p.is_unlimited_stock ? tr('not counted') : tr('stock {stock}', { stock: p.current_stock })}</span>
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 shrink-0">{tr('add stock')}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <input value={row.price} onChange={(e) => onChange({ price: e.target.value })} onKeyDown={onKeyDown} inputMode="decimal" placeholder={linked ? formatINR(columns.mrp ? linked.selling_price : linked.mrp || linked.selling_price) : '₹'} className={`${input} border-slate-300 font-mono`} data-entry-price />
        {columns.mrp && <input value={row.mrp} onChange={(e) => onChange({ mrp: e.target.value })} onKeyDown={onKeyDown} inputMode="decimal" placeholder={linked ? formatINR(linked.mrp || linked.selling_price) : tr('optional')} className={`${input} border-slate-300 font-mono`} data-entry-mrp />}
        {columns.cost && <input value={row.cost} onChange={(e) => onChange({ cost: e.target.value })} onKeyDown={onKeyDown} inputMode="decimal" placeholder={linked?.purchase_price ? formatINR(linked.purchase_price) : tr('optional')} className={`${input} border-slate-300 font-mono`} data-entry-cost />}
        {columns.gst && (
          <select value={linked ? String(linked.tax_rate) : row.gst} disabled={Boolean(linked)} onChange={(e) => onChange({ gst: e.target.value })} onKeyDown={onKeyDown} className={`${input} border-slate-300 px-1`} data-entry-gst>
            <option value="">{tr('None')}</option>
            {GST_RATES.map((r) => <option key={r} value={String(r)}>{r}%</option>)}
          </select>
        )}
        {columns.hsn && <input value={linked ? linked.hsn_code || '' : row.hsn} readOnly={Boolean(linked)} onChange={(e) => onChange({ hsn: e.target.value })} onKeyDown={onKeyDown} inputMode="numeric" placeholder={tr('optional')} className={`${input} border-slate-300 font-mono ${linked ? 'bg-slate-50 text-slate-500' : ''}`} data-entry-hsn />}
        <input value={row.qty} onChange={(e) => onChange({ qty: e.target.value })} onKeyDown={onKeyDown} inputMode="decimal" placeholder={isMeasuredUnit(unit) ? '0.0' : '0'} className={`${input} border-slate-300 font-mono font-black text-center`} data-entry-qty />
        <select value={unit} disabled={Boolean(linked)} onChange={(e) => onChange({ unit: e.target.value as ProductUnit })} onKeyDown={onKeyDown} className={`${input} border-slate-300 px-1`} data-skip-enter data-entry-unit>
          {MASTER_UNITS.map((u) => <option key={u.id} value={u.id}>{u.symbol}</option>)}
        </select>
        <button type="button" tabIndex={-1} onClick={onRemove} className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer" aria-label={tr('Remove')}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {(hint || error) && (
        <div className="text-[10px] font-semibold mt-0.5" style={{ paddingLeft: '2rem' }}>
          {error ? <span className="text-rose-700" data-entry-error>{tr(error)}</span> : hint}
        </div>
      )}
    </div>
  );
}
