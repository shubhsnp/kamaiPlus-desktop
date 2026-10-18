'use client';

import React, { useState } from 'react';
import { Layers, X } from 'lucide-react';
import { getVariantPresets, getVariantInfo, DEFAULT_COUNTED_STOCK, type VariantFormRow } from '@/lib/products/variants';
import { readVerticalProfile, type VerticalId } from '@/lib/business/verticalProfile';
import { tr } from '@/lib/i18n/core';

/** One row of the matrix, kept as typed strings until the product is saved. */
export type VariantRow = VariantFormRow;

interface VariantMatrixEditorProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  rows: VariantRow[];
  onChange: (rows: VariantRow[]) => void;
  /** Pre-fill for a new row: the product's own price / MRP / stock fields. */
  defaults: { price: string; mrp: string; stock: string };
  /** New rows start unlimited (∞); each row can be switched to a counted stock. */
  unlimitedStock?: boolean;
  /** A separate MRP column (shops with "Separate Selling Price" on). Off: one Price column. */
  showMrp?: boolean;
  /** Stock counting on (Settings → Features). Off: every variant is unlimited, no stock column. */
  showStock?: boolean;
  showBarcode?: boolean;
  /** Editing an item that already has variants: they cannot be switched off as a whole. */
  locked?: boolean;
  /** Business vertical (defaults to active store profile). */
  vertical?: VerticalId | null;
}

const box = 'w-full min-w-0 h-9 px-2 rounded-lg border border-slate-300 bg-white text-xs font-mono focus:outline-none focus:border-purple-500';

/**
 * "Variants" — matches the Android add-product form across all verticals: switch on, tap vertical
 * presets (e.g. Half / Full for restaurant, 500g / 1kg for grocery) or type a custom label, then set
 * each one's price and stock. v4.179.0: also in the edit form; one Price column when the shop has no
 * separate MRP (a restaurant); stock per row — ∞ by default, tap it to count; every box shrinks to
 * fit (min-w-0), nothing sticks out of the window.
 */
export function VariantMatrixEditor({
  enabled,
  onToggle,
  rows,
  onChange,
  defaults,
  unlimitedStock = true,
  showMrp = true,
  showStock = true,
  showBarcode = true,
  locked = false,
  vertical,
}: VariantMatrixEditorProps) {
  const [custom, setCustom] = useState('');
  const activeVertical = vertical ?? readVerticalProfile()?.vertical;
  const presets = getVariantPresets(activeVertical);
  const info = getVariantInfo(activeVertical);

  const has = (label: string) => rows.some((r) => r.label.toLowerCase() === label.toLowerCase());

  const add = (label: string) => {
    const clean = label.trim();
    if (!clean || has(clean)) return;
    const counted = showStock && !unlimitedStock;
    onChange([...rows, {
      label: clean, price: defaults.price, mrp: defaults.mrp, barcode: '',
      stock: counted && defaults.stock && defaults.stock !== '0' ? defaults.stock : String(DEFAULT_COUNTED_STOCK),
      unlimited: !counted,
    }]);
  };
  const remove = (label: string) => onChange(rows.filter((r) => r.label !== label));
  const update = (label: string, patch: Partial<VariantRow>) =>
    onChange(rows.map((r) => (r.label === label ? { ...r, ...patch } : r)));

  const columns = [
    'minmax(52px,96px)',
    'minmax(0,1fr)',
    ...(showMrp ? ['minmax(0,1fr)'] : []),
    ...(showStock ? ['minmax(0,1fr)'] : []),
    ...(showBarcode ? ['minmax(0,1fr)'] : []),
    '28px',
  ].join(' ');

  return (
    <div className={`rounded-2xl border ${enabled ? 'border-purple-300 bg-purple-50/60' : 'border-slate-200 bg-white'}`} data-variant-editor>
      <div className="px-3.5 py-2.5 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
          <Layers className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-slate-900">{info.title}</p>
          <p className="text-[10.5px] text-slate-500">{info.subtitle}</p>
        </div>
        {!locked && (
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input type="checkbox" className="sr-only peer" aria-label={info.title} checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
            <span className="w-9 h-5 rounded-full bg-slate-300 peer-checked:bg-purple-600 transition-colors" />
            <span className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
          </label>
        )}
      </div>

      {enabled && (
        <div className="px-3.5 pb-3.5 pt-1 space-y-3 border-t border-purple-200">
          <div>
            <p className="text-[11px] font-bold text-slate-600 mb-1.5 mt-2">{tr('Tap to add (tap again to remove)')}</p>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((label) => {
                const on = has(label);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => (on ? remove(rows.find((r) => r.label.toLowerCase() === label.toLowerCase())!.label) : add(label))}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer ${on ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-purple-400'}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add(custom);
                  setCustom('');
                }
              }}
              placeholder={info.placeholder}
              className="flex-1 min-w-0 h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs focus:outline-none focus:border-purple-500"
            />
            <button
              type="button"
              onClick={() => { add(custom); setCustom(''); }}
              className="h-9 px-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold cursor-pointer shrink-0"
            >
              {tr('Add')}
            </button>
          </div>

          {rows.length > 0 && (
            <div className="space-y-1.5" data-variant-rows>
              <div className="grid gap-1.5 text-[10px] font-bold text-slate-500 px-0.5" style={{ gridTemplateColumns: columns }}>
                <span className="truncate">{tr('Variant')}</span>
                <span className="truncate">{showMrp ? tr('Selling ₹') : tr('Price ₹')}</span>
                {showMrp && <span className="truncate">{tr('MRP ₹')}</span>}
                {showStock && <span className="truncate">{tr('Stock')}</span>}
                {showBarcode && <span className="truncate">{tr('Barcode')}</span>}
                <span />
              </div>
              {rows.map((r) => {
                const unlimited = !showStock || r.unlimited !== false;
                return (
                  <div key={r.label} className="grid gap-1.5 items-center" style={{ gridTemplateColumns: columns }} data-variant-row={r.label}>
                    <span className="h-9 px-2 rounded-lg bg-purple-100 text-purple-800 text-xs font-black flex items-center min-w-0" title={r.label}>
                      <span className="truncate">{r.label}</span>
                    </span>
                    <input type="number" step="0.01" min="0" value={r.price} onChange={(e) => update(r.label, { price: e.target.value })} aria-label={tr('Price ₹')} className={box} />
                    {showMrp && (
                      <input type="number" step="0.01" min="0" value={r.mrp} onChange={(e) => update(r.label, { mrp: e.target.value })} aria-label={tr('MRP ₹')} className={box} />
                    )}
                    {showStock && (unlimited ? (
                      <button
                        type="button"
                        onClick={() => update(r.label, { unlimited: false, stock: r.stock && r.stock !== '0' ? r.stock : String(DEFAULT_COUNTED_STOCK) })}
                        title={tr('Unlimited — tap to count stock')}
                        className="w-full min-w-0 h-9 px-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black flex items-center justify-center gap-1 cursor-pointer hover:border-emerald-400"
                        data-variant-unlimited
                      >
                        <span className="text-sm leading-none">∞</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 min-w-0">
                        <input type="number" step="any" min="0" value={r.stock} onChange={(e) => update(r.label, { stock: e.target.value })} aria-label={tr('Stock')} className={box} />
                        <button
                          type="button"
                          onClick={() => update(r.label, { unlimited: true })}
                          title={tr('Make unlimited (no count)')}
                          className="w-7 h-9 shrink-0 rounded-lg border border-slate-200 text-slate-500 hover:text-emerald-700 hover:border-emerald-300 text-sm cursor-pointer"
                        >
                          ∞
                        </button>
                      </div>
                    ))}
                    {showBarcode && (
                      <input value={r.barcode} onChange={(e) => update(r.label, { barcode: e.target.value })} placeholder={tr('optional')} aria-label={tr('Barcode')} className={box} />
                    )}
                    <button type="button" onClick={() => remove(r.label)} className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer" aria-label={tr('Remove {label}', { label: r.label })}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
              {showStock && <p className="text-[10.5px] text-slate-500 pt-0.5">{tr('∞ = not counted. Tap ∞ to count the stock of that one (e.g. bottles).')}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
