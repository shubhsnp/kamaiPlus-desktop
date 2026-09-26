'use client';

import React, { useState } from 'react';
import { Layers, X } from 'lucide-react';
import { VARIANT_PRESETS } from '@/lib/products/variants';
import { tr } from '@/lib/i18n/core';

/** One row of the matrix, kept as typed strings until the product is saved. */
export interface VariantRow {
  label: string;
  price: string;
  mrp: string;
  stock: string;
  barcode: string;
}

interface VariantMatrixEditorProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  rows: VariantRow[];
  onChange: (rows: VariantRow[]) => void;
  /** Pre-fill for a new row: the product's own price / MRP / stock fields. */
  defaults: { price: string; mrp: string; stock: string };
}

/**
 * "Variants Matrix (Size / Color)" — same flow as the Android add-product form:
 * switch on, tap presets or type a custom label, then set price / MRP / stock
 * (and an optional barcode) for each variant.
 */
export function VariantMatrixEditor({ enabled, onToggle, rows, onChange, defaults }: VariantMatrixEditorProps) {
  const [custom, setCustom] = useState('');
  const has = (label: string) => rows.some((r) => r.label.toLowerCase() === label.toLowerCase());

  const add = (label: string) => {
    const clean = label.trim();
    if (!clean || has(clean)) return;
    onChange([...rows, { label: clean, price: defaults.price, mrp: defaults.mrp, stock: defaults.stock || '0', barcode: '' }]);
  };
  const remove = (label: string) => onChange(rows.filter((r) => r.label !== label));
  const update = (label: string, field: keyof VariantRow, value: string) =>
    onChange(rows.map((r) => (r.label === label ? { ...r, [field]: value } : r)));

  return (
    <div className={`rounded-2xl border ${enabled ? 'border-purple-300 bg-purple-50/60' : 'border-slate-200 bg-white'}`}>
      <div className="px-3.5 py-2.5 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
          <Layers className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-slate-900">{tr('Variants (Size / Colour)')}</p>
          <p className="text-[10.5px] text-slate-500">{tr('Sell one item in many sizes or colours, each with its own price and stock.')}</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0">
          <input type="checkbox" className="sr-only peer" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
          <span className="w-9 h-5 rounded-full bg-slate-300 peer-checked:bg-purple-600 transition-colors" />
          <span className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
        </label>
      </div>

      {enabled && (
        <div className="px-3.5 pb-3.5 pt-1 space-y-3 border-t border-purple-200">
          <div>
            <p className="text-[11px] font-bold text-slate-600 mb-1.5 mt-2">{tr('Quick presets (tap to add / remove)')}</p>
            <div className="flex flex-wrap gap-1.5">
              {VARIANT_PRESETS.map((label) => {
                const on = has(label);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => (on ? remove(rows.find((r) => r.label.toLowerCase() === label.toLowerCase())!.label) : add(label))}
                    className={`px-2 py-1 rounded-lg border text-[11px] font-bold cursor-pointer ${on ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-purple-400'}`}
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
              placeholder={tr('Custom variant (e.g. 36, Red-XL, 500 g)')}
              className="flex-1 h-9 px-3 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-purple-500"
            />
            <button
              type="button"
              onClick={() => { add(custom); setCustom(''); }}
              className="h-9 px-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold cursor-pointer"
            >
              {tr('Add')}
            </button>
          </div>

          {rows.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-black text-purple-800">{rows.length} {tr('variants — price & stock for each')}</p>
              <div className="grid grid-cols-[90px_1fr_1fr_80px_1fr_28px] gap-1.5 text-[10px] font-bold text-slate-500 px-1">
                <span>{tr('Variant')}</span><span>{tr('Selling ₹')}</span><span>MRP ₹</span><span>{tr('Stock')}</span><span>{tr('Barcode')}</span><span />
              </div>
              {rows.map((r) => (
                <div key={r.label} className="grid grid-cols-[90px_1fr_1fr_80px_1fr_28px] gap-1.5 items-center">
                  <span className="px-2 py-1.5 rounded-lg bg-purple-100 text-purple-800 text-xs font-black truncate">{r.label}</span>
                  <input type="number" step="0.01" min="0" value={r.price} onChange={(e) => update(r.label, 'price', e.target.value)} className="h-8 px-2 rounded-lg border border-slate-300 text-xs font-mono focus:outline-none focus:border-purple-500" />
                  <input type="number" step="0.01" min="0" value={r.mrp} onChange={(e) => update(r.label, 'mrp', e.target.value)} className="h-8 px-2 rounded-lg border border-slate-300 text-xs font-mono focus:outline-none focus:border-purple-500" />
                  <input type="number" step="any" min="0" value={r.stock} onChange={(e) => update(r.label, 'stock', e.target.value)} className="h-8 px-2 rounded-lg border border-slate-300 text-xs font-mono focus:outline-none focus:border-purple-500" />
                  <input value={r.barcode} onChange={(e) => update(r.label, 'barcode', e.target.value)} placeholder={tr('optional')} className="h-8 px-2 rounded-lg border border-slate-300 text-xs font-mono focus:outline-none focus:border-purple-500" />
                  <button type="button" onClick={() => remove(r.label)} className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer" aria-label={tr('Remove {label}', { label: r.label })}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
