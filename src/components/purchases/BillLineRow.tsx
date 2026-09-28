'use client';

import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Product, PurchaseBillLineItem } from '@/types';
import { formatINR, parseRupeesToPaise } from '@/lib/utils';
import { MASTER_UNITS } from '@/lib/constants/storeProfiles';
import { tr } from '@/lib/i18n/core';

interface BillLineRowProps {
  item: PurchaseBillLineItem;
  existingProducts: Product[];
  /** What to fix on this line (msg id), shown after "Confirm" was pressed. */
  problem?: string;
  onUpdate: (updates: Partial<PurchaseBillLineItem>) => void;
  onRemove: () => void;
}

/** One line of a supplier's bill in the review: item, saved item it matches, qty, unit, cost, selling price. */
export function BillLineRow({ item, existingProducts, problem, onUpdate, onRemove }: BillLineRowProps) {
  return (
    <tr className={`transition-colors ${problem ? 'bg-rose-50' : 'hover:bg-slate-50 dark:hover:bg-slate-900/40'}`} data-inward-row>
      {/* Name */}
      <td className="py-2.5 px-3 min-w-[12rem]">
        <input
          type="text"
          value={item.raw_name}
          onChange={(e) => onUpdate({ raw_name: e.target.value })}
          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-medium"
        />
        {problem && <div className="mt-1 text-[10px] font-bold text-rose-700" data-inward-problem>{tr(problem)}</div>}
      </td>

      {/* Match Status & Override Picker */}
      <td className="py-2.5 px-3">
        <div className="space-y-1">
          <select
            value={item.matched_product_id || 'NEW'}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'NEW') {
                onUpdate({ matched_product_id: undefined, is_new_product: true });
              } else {
                const found = existingProducts.find((p) => p.id === val);
                onUpdate({
                  matched_product_id: val,
                  is_new_product: false,
                  selling_price: found?.selling_price || item.selling_price,
                });
              }
            }}
            className={`w-full text-[11px] rounded-lg px-2 py-1 border font-bold ${
              !item.is_new_product && item.matched_product_id
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300'
            }`}
          >
            <option value="NEW">{tr('➕ Create as New Item')}</option>
            <optgroup label={tr('Map to Existing Inventory:')}>
              {existingProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  🔗 {p.name} {tr('(Stock:')} {p.current_stock})
                </option>
              ))}
            </optgroup>
          </select>

          {item.confidence === 'low' && (
            <div className="flex items-center gap-1 text-[10px] text-rose-500 font-bold">
              <AlertTriangle className="w-3 h-3" />
              <span>{tr('Check this row')}</span>
            </div>
          )}
        </div>
      </td>

      {/* Quantity */}
      <td className="py-2.5 px-3">
        <input
          type="number"
          min="0.1"
          step="any"
          value={item.quantity}
          onChange={(e) => onUpdate({ quantity: parseFloat(e.target.value) || 0 })}
          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-white font-mono font-bold text-center"
        />
      </td>

      {/* Unit */}
      <td className="py-2.5 px-3">
        <select
          value={item.unit || 'piece'}
          onChange={(e) => onUpdate({ unit: e.target.value })}
          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-1.5 py-1.5 text-xs text-slate-900 dark:text-white"
        >
          {MASTER_UNITS.map((u) => (
            <option key={u.id} value={u.id}>
              {u.symbol} ({u.id})
            </option>
          ))}
        </select>
      </td>

      {/* Cost Price */}
      <td className="py-2.5 px-3">
        <input
          type="number"
          min="0"
          step="any"
          value={item.unit_price / 100}
          onChange={(e) =>
            onUpdate({ unit_price: parseRupeesToPaise(e.target.value) })
          }
          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-white font-mono font-bold"
        />
      </td>

      {/* Selling Price */}
      <td className="py-2.5 px-3">
        <input
          type="number"
          min="0"
          step="any"
          value={item.selling_price ? item.selling_price / 100 : ''}
          placeholder={item.is_new_product || !item.matched_product_id ? (item.mrp ? formatINR(item.mrp) : tr('required')) : ''}
          onChange={(e) =>
            onUpdate({ selling_price: e.target.value ? parseRupeesToPaise(e.target.value) : undefined })
          }
          data-inward-selling
          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-mono font-bold"
        />
      </td>

      {/* Total */}
      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
        {formatINR(item.total_price)}
      </td>

      {/* Delete */}
      <td className="py-2.5 px-2 text-center">
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
          title={tr('Remove row')}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}
