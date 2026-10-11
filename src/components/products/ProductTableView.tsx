'use client';

import React, { useState } from 'react';
import { Product } from '@/types';
import { formatINR, parseRupeesToPaise, cn } from '@/lib/utils';
import { Edit2, Trash2, Printer, Check, X, Plus, Minus, Tag } from 'lucide-react';
import { TableVirtuoso } from 'react-virtuoso';
import { tr } from '@/lib/i18n/core';
import { useFeatureSwitches, useRestaurantMode } from '@/lib/features/featureSwitches';

interface ProductTableViewProps {
  products: Product[];
  categoryMap: Map<string, string>;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onQuickStockChange: (product: Product, delta: number) => void;
  onQuickPriceChange: (product: Product, newPricePaise: number) => Promise<void>;
  /** Missing when Settings → Features → Barcode Studio & Labels is off (no label button). */
  on1ClickBarcodePrint?: (product: Product) => void;
  onOpenVariants?: (product: Product) => void;
  /** v4.108.0: false when Stock counting is off — no Current Stock / Status columns. */
  showStock?: boolean;
}

export const ProductTableView: React.FC<ProductTableViewProps> = ({
  products,
  categoryMap,
  onEdit,
  onDelete,
  onQuickStockChange,
  onQuickPriceChange,
  on1ClickBarcodePrint,
  onOpenVariants,
  showStock = true,
}) => {
  const costSwitchOn = useFeatureSwitches().product_cost_price;
  const restaurantMode = useRestaurantMode();
  // v4.160.0: only a restaurant without buying prices drops the Cost column — v4.152.0 dropped it for
  // every shop whose cost switch was off (older shops, the live customer).
  const showCost = !restaurantMode || costSwitchOn;
  const showBarcode = !restaurantMode;
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
      <TableVirtuoso style={{ height: "calc(100vh - 280px)" }} data={products} fixedHeaderContent={() => ( <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 select-none shadow-sm"> <th className="py-2.5 px-3 bg-slate-50">{tr('Item Details')}</th> <th className="py-2.5 px-3 bg-slate-50">{tr('Category')}</th> {showCost && <th className="py-2.5 px-3 text-right bg-slate-50">{tr('Cost (₹)')}</th>} <th className="py-2.5 px-3 text-right bg-slate-50">{tr('Selling Price (₹)')}</th> {showStock && <><th className="py-2.5 px-3 text-center bg-slate-50">{tr('Current Stock')}</th> <th className="py-2.5 px-3 text-center bg-slate-50">{tr('Status')}</th></>} <th className="py-2.5 px-3 text-right bg-slate-50">{tr('Actions')}</th> </tr> )} components={{ Table: (props) => <table {...props} className="w-full text-left border-collapse" style={{...props.style, borderSpacing: 0}} /> }} itemContent={(_index, p) => { const isEditingThisPrice = editingPriceId === p.id; const stockNum = Number(p.current_stock ?? 0); const isParent = p.has_variants === true; const isOutOfStock = !isParent && !p.is_unlimited_stock && stockNum <= 0; const isLowStock = !p.is_unlimited_stock && !isOutOfStock && stockNum <= (p.min_stock_level || 5); const tdClass = cn("py-2.5 px-3 border-b border-slate-100 group-hover:bg-slate-50/80 transition-colors", isOutOfStock ? "bg-rose-50/30" : ""); return ( <> <td className={tdClass}> <div className="flex items-center gap-1.5"><span className="font-bold text-slate-900 line-clamp-1 group-hover:text-emerald-700 transition-colors">{p.name}</span>{isParent && <button type="button" onClick={() => onOpenVariants?.(p)} className="shrink-0 px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-black border border-purple-200 hover:bg-purple-200 cursor-pointer">{tr('Variants ▾')}</button>}{p.variant_label && <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-bold border border-purple-200">{p.variant_label}</span>}</div> <div className="flex items-center gap-2 mt-0.5 font-mono text-[10.5px] text-slate-400"> {p.barcode ? <span className="bg-slate-100 px-1 py-0.2 rounded border border-slate-200">{p.barcode}</span> : showBarcode && <span className="text-slate-400 italic">{tr('No barcode')}</span>} {(p.size || p.color) && <span className="text-indigo-600 font-sans">{p.size && <span>{tr('Size:')} {p.size} </span>}{p.color && <span>• {p.color}</span>}</span>} </div> </td> <td className={tdClass}> <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200"><Tag className="w-3 h-3 text-slate-400" /><span>{p.category_id ? categoryMap.get(p.category_id) || tr('General') : tr('General')}</span></span> </td> {showCost && <td className={cn(tdClass, "text-right font-mono text-slate-500 font-medium")}>{p.purchase_price ? formatINR(p.purchase_price) : "—"}</td>} <td className={cn(tdClass, "text-right")}> {isEditingThisPrice ? <div className="inline-flex items-center gap-1 justify-end"><span className="text-slate-400 font-bold">₹</span><input type="number" step="any" min="0" value={priceInputValue} onChange={(e) => setPriceInputValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSavePrice(p); if (e.key === "Escape") cancelEditPrice(); }} autoFocus disabled={isSavingPrice} className="w-20 bg-white border-2 border-emerald-500 rounded px-1.5 py-0.5 text-right font-mono font-bold text-xs text-slate-900 focus:outline-none" /><button type="button" onClick={() => handleSavePrice(p)} disabled={isSavingPrice} className="p-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"><Check className="w-3 h-3" /></button><button type="button" onClick={cancelEditPrice} className="p-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-600 cursor-pointer"><X className="w-3 h-3" /></button></div> : <button type="button" onClick={() => startEditPrice(p)} className="inline-flex items-center gap-1.5 font-mono font-black text-xs sm:text-sm text-slate-900 hover:text-emerald-700 cursor-pointer px-1.5 py-0.5 rounded hover:bg-slate-100 transition"><span>{formatINR(p.selling_price)}</span>{(p.wholesale_price || 0) > 0 && <span className="text-[10px] font-bold text-violet-700" data-product-wholesale-price>{tr('Wholesale {price}', { price: formatINR(p.wholesale_price || 0) })}</span>}<Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" /></button>} </td> {showStock && <><td className={cn(tdClass, "text-center")}> {isParent ? <button type="button" onClick={() => onOpenVariants?.(p)} className="text-[11px] font-bold text-purple-700 hover:underline cursor-pointer">{tr('In variants')}</button> : p.is_unlimited_stock ? <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">{tr('∞ Unlimited')}</span> : <div className="inline-flex items-center gap-1"><button type="button" onClick={() => onQuickStockChange(p, -1)} className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer active:scale-90 transition"><Minus className="w-2.5 h-2.5" /></button><span className="font-mono font-bold text-xs w-9 text-center text-slate-900">{stockNum}</span><button type="button" onClick={() => onQuickStockChange(p, 1)} className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer active:scale-90 transition"><Plus className="w-2.5 h-2.5" /></button></div>} </td> <td className={cn(tdClass, "text-center")}> {isParent ? <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-bold text-[10px] border border-purple-200">{tr('Variants')}</span> : isOutOfStock ? <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[10px] uppercase">{tr('Out of Stock')}</span> : isLowStock ? <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">{tr('Low (')}{stockNum})</span> : <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">{tr('In Stock')}</span>} </td></>} <td className={cn(tdClass, "text-right")}> <div className="inline-flex items-center gap-1">{on1ClickBarcodePrint && <button type="button" onClick={() => on1ClickBarcodePrint(p)} className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"><Printer className="w-3.5 h-3.5 text-slate-700" /></button>}<button type="button" onClick={() => onEdit(p)} className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"><Edit2 className="w-3.5 h-3.5 text-slate-700" /></button><button type="button" onClick={() => onDelete(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button></div> </td> </> ); }} />
    </div>
  );
};

