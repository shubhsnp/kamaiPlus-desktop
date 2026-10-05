'use client';

import React from 'react';
import { formatINR } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Trash2, Plus, Minus, X } from 'lucide-react';
import { tr } from '@/lib/i18n/core';
import type { CartItem, Product } from '@/types';

export interface EditInvoiceItemsProps {
  items: CartItem[];
  setIsAddingProduct: React.Dispatch<React.SetStateAction<boolean>>;
  isAddingProduct: boolean;
  productSearch: string;
  setProductSearch: React.Dispatch<React.SetStateAction<string>>;
  handleUpdateItemQty: (index: number, newQty: number) => void;
  handleUpdateItemPrice: (index: number, priceRupees: string) => void;
  handleRemoveItem: (index: number) => void;
  handleAddCatalogProduct: (product: Product) => void;
  filteredCatalog: Product[];
}

/**
 * The lines of a bill being edited (v4.104.0, K-D23 — moved out of EditInvoiceModal unchanged):
 * quantity, price, discount and remove per line, and adding an item from the catalogue.
 */
export function EditInvoiceItems(props: EditInvoiceItemsProps) {
  const {
    items, setIsAddingProduct, isAddingProduct, productSearch, setProductSearch, handleUpdateItemQty,
    handleUpdateItemPrice, handleRemoveItem, handleAddCatalogProduct, filteredCatalog,
  } = props;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
          {tr('Invoice Items (')}{items.length})
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsAddingProduct(!isAddingProduct)}
          className="text-xs font-bold gap-1 text-slate-800"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{tr('+ Add Item')}</span>
        </Button>
      </div>

      {/* Add Product Dropdown Search */}
      {isAddingProduct && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-950">{tr('Select Product to Add to Invoice:')}</span>
            <button
              type="button"
              onClick={() => setIsAddingProduct(false)}
              className="text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <Input
            placeholder={tr('Search catalog by product name...')}
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            autoFocus
          />
          <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
            {filteredCatalog.slice(0, 8).map((p) => (
              <div
                key={p.id}
                onClick={() => handleAddCatalogProduct(p)}
                className="p-2 bg-white rounded-lg border border-slate-200 hover:border-amber-400 cursor-pointer flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-slate-900">{p.name}</span>
                  <span className="text-slate-400 text-[10px] ml-1.5">({p.unit})</span>
                </div>
                <span className="font-mono font-bold text-slate-900">{formatINR(p.selling_price)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Items List */}
      <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
        {items.map((item, index) => (
          <div key={item.product_id || index} className="p-2.5 bg-white flex items-center justify-between gap-3 text-xs">
            {/* Product Name */}
            <div className="flex-1 min-w-0">
              <div className="font-bold text-slate-900 truncate">{item.product_name}</div>
              <div className="text-[10px] text-slate-400 font-medium">{item.unit}</div>
            </div>

            {/* Rate Input */}
            <div className="w-20">
              <label className="text-[10px] font-bold text-slate-400 uppercase block">{tr('Rate (₹)')}</label>
              <input
                type="number"
                step="0.01"
                value={(item.unit_price / 100).toString()}
                onChange={(e) => handleUpdateItemPrice(index, e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded p-1 font-mono text-xs text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-slate-800"
              />
            </div>

            {/* Quantity Stepper */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleUpdateItemQty(index, item.quantity - 1)}
                className="w-6 h-6 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-200"
              >
                <Minus className="w-3 h-3" />
              </button>
              <input
                type="number"
                value={item.quantity}
                onChange={(e) => handleUpdateItemQty(index, parseFloat(e.target.value) || 0)}
                className="w-10 text-center font-mono font-bold text-xs bg-transparent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleUpdateItemQty(index, item.quantity + 1)}
                className="w-6 h-6 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-200"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {/* Line Total */}
            <div className="w-20 text-right font-mono font-extrabold text-xs text-slate-900">
              {formatINR(item.total_amount)}
            </div>

            {/* Delete Button */}
            <button
              type="button"
              onClick={() => handleRemoveItem(index)}
              className="p-1 text-slate-400 hover:text-rose-600 rounded"
              title={tr('Remove item')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
