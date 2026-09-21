'use client';

import React, { useState } from 'react';
import { Product } from '@/types';
import { formatINR, parseRupeesToPaise, cn } from '@/lib/utils';
import { Edit2, Trash2, Printer, Check, X, Plus, Minus, Tag } from 'lucide-react';

interface ProductTableViewProps {
  products: Product[];
  categoryMap: Map<string, string>;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onQuickStockChange: (product: Product, delta: number) => void;
  onQuickPriceChange: (product: Product, newPricePaise: number) => Promise<void>;
  on1ClickBarcodePrint: (product: Product) => void;
}

export const ProductTableView: React.FC<ProductTableViewProps> = ({
  products,
  categoryMap,
  onEdit,
  onDelete,
  onQuickStockChange,
  onQuickPriceChange,
  on1ClickBarcodePrint,
}) => {
  // Inline Price Editing State: productId -> editing string
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceInputValue, setPriceInputValue] = useState<string>('');
  const [isSavingPrice, setIsSavingPrice] = useState<boolean>(false);

  const startEditPrice = (product: Product) => {
    setEditingPriceId(product.id);
    setPriceInputValue((product.selling_price / 100).toString());
  };

  const cancelEditPrice = () => {
    setEditingPriceId(null);
    setPriceInputValue('');
  };

  const handleSavePrice = async (product: Product) => {
    const val = parseFloat(priceInputValue);
    if (isNaN(val) || val < 0) {
      cancelEditPrice();
      return;
    }

    setIsSavingPrice(true);
    try {
      const paise = Math.round(val * 100);
      await onQuickPriceChange(product, paise);
      setEditingPriceId(null);
    } catch {
      // ignore
    } finally {
      setIsSavingPrice(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 select-none">
              <th className="py-2.5 px-3">Item Details</th>
              <th className="py-2.5 px-3">Category</th>
              <th className="py-2.5 px-3 text-right">Cost (₹)</th>
              <th className="py-2.5 px-3 text-right">Selling Price (₹)</th>
              <th className="py-2.5 px-3 text-center">Current Stock</th>
              <th className="py-2.5 px-3 text-center">Status</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {products.map((p) => {
              const isEditingThisPrice = editingPriceId === p.id;
              const stockNum = Number(p.current_stock ?? 0);
              const isOutOfStock = !p.is_unlimited_stock && stockNum <= 0;
              const isLowStock = !p.is_unlimited_stock && !isOutOfStock && stockNum <= (p.min_stock_level || 5);

              return (
                <tr
                  key={p.id}
                  className={cn(
                    "hover:bg-slate-50/80 transition-colors group",
                    isOutOfStock ? "bg-rose-50/20" : ""
                  )}
                >
                  {/* 1. Item Details */}
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-slate-900 line-clamp-1 group-hover:text-emerald-700 transition-colors">
                      {p.name}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 font-mono text-[10.5px] text-slate-400">
                      {p.barcode ? (
                        <span className="bg-slate-100 px-1 py-0.2 rounded border border-slate-200">
                          {p.barcode}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">No barcode</span>
                      )}
                      {(p.size || p.color) && (
                        <span className="text-indigo-600 font-sans">
                          {p.size && <span>Size: {p.size} </span>}
                          {p.color && <span>• {p.color}</span>}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 2. Category */}
                  <td className="py-2.5 px-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200">
                      <Tag className="w-3 h-3 text-slate-400" />
                      <span>{p.category_id ? categoryMap.get(p.category_id) || 'General' : 'General'}</span>
                    </span>
                  </td>

                  {/* 3. Cost Price */}
                  <td className="py-2.5 px-3 text-right font-mono text-slate-500 font-medium">
                    {p.purchase_price ? formatINR(p.purchase_price) : '—'}
                  </td>

                  {/* 4. Selling Price with Inline Edit */}
                  <td className="py-2.5 px-3 text-right">
                    {isEditingThisPrice ? (
                      <div className="inline-flex items-center gap-1 justify-end">
                        <span className="text-slate-400 font-bold">₹</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={priceInputValue}
                          onChange={(e) => setPriceInputValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSavePrice(p);
                            if (e.key === 'Escape') cancelEditPrice();
                          }}
                          autoFocus
                          disabled={isSavingPrice}
                          className="w-20 bg-white border-2 border-emerald-500 rounded px-1.5 py-0.5 text-right font-mono font-bold text-xs text-slate-900 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSavePrice(p)}
                          disabled={isSavingPrice}
                          className="p-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                          title="Save Price"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditPrice}
                          className="p-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-600 cursor-pointer"
                          title="Cancel"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditPrice(p)}
                        className="inline-flex items-center gap-1.5 font-mono font-black text-xs sm:text-sm text-slate-900 hover:text-emerald-700 cursor-pointer px-1.5 py-0.5 rounded hover:bg-slate-100 transition"
                        title="Click to edit selling price directly"
                      >
                        <span>{formatINR(p.selling_price)}</span>
                        <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    )}
                  </td>

                  {/* 5. Current Stock with Quick Stepper */}
                  <td className="py-2.5 px-3 text-center">
                    {p.is_unlimited_stock ? (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        ∞ Unlimited
                      </span>
                    ) : (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onQuickStockChange(p, -1)}
                          className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer active:scale-90 transition"
                          title="Deduct 1 unit"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <span className="font-mono font-bold text-xs w-9 text-center text-slate-900">
                          {stockNum}
                        </span>
                        <button
                          type="button"
                          onClick={() => onQuickStockChange(p, 1)}
                          className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer active:scale-90 transition"
                          title="Restock +1 unit"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    )}
                  </td>

                  {/* 6. Status Badge */}
                  <td className="py-2.5 px-3 text-center">
                    {isOutOfStock ? (
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[10px] uppercase">
                        Out of Stock
                      </span>
                    ) : isLowStock ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                        Low ({stockNum})
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                        In Stock
                      </span>
                    )}
                  </td>

                  {/* 7. Action Buttons */}
                  <td className="py-2.5 px-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      {/* 1-Click Barcode Print */}
                      <button
                        type="button"
                        onClick={() => on1ClickBarcodePrint(p)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
                        title="1-Click Print Barcode Label"
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-700" />
                      </button>

                      {/* Edit Product */}
                      <button
                        type="button"
                        onClick={() => onEdit(p)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
                        title="Edit Full Product"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-700" />
                      </button>

                      {/* Delete Product */}
                      <button
                        type="button"
                        onClick={() => onDelete(p)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition cursor-pointer"
                        title="Delete Product"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
