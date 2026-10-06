'use client';

import React from 'react';
import { Boxes, Infinity as InfinityIcon } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { VariantMatrixEditor } from '@/components/products/VariantMatrixEditor';
import { DEFAULT_COUNTED_STOCK } from '@/lib/products/variants';
import { tr } from '@/lib/i18n/core';
import { ProductBarcodeField } from './ProductBarcodeField';
import type { VariantRow } from '@/components/products/VariantMatrixEditor';
import type { FeatureSwitches } from '@/lib/features/featureSwitches';
import type { Product } from '@/types';

export interface ProductFormDetailsProps {
  editingProduct: Product | null;
  formPurchasePrice: string;
  setFormPurchasePrice: (val: string) => void;
  formSellingPrice: string;
  setFormSellingPrice: (val: string) => void;
  formIsUnlimitedStock: boolean;
  setFormIsUnlimitedStock: (val: boolean) => void;
  formMrp: string;
  formWholesalePrice: string;
  setFormWholesalePrice: (val: string) => void;
  setFormMrp: (val: string) => void;
  formTaxRate: number;
  setFormTaxRate: (val: number) => void;
  formStock: string;
  setFormStock: (val: string) => void;
  formMinStock: string;
  setFormMinStock: (val: string) => void;
  formBarcode: string;
  setFormBarcode: (val: string) => void;
  formHsn: string;
  setFormHsn: (val: string) => void;
  formSize: string;
  setFormSize: (val: string) => void;
  formColor: string;
  setFormColor: (val: string) => void;
  onBarcodeScanned: ((code: string) => void) | undefined;
  variantsEnabled: boolean;
  setVariantsEnabled: ((val: boolean) => void) | undefined;
  variantRows: VariantRow[];
  setVariantRows: ((rows: VariantRow[]) => void) | undefined;
  setShowSizeColor: React.Dispatch<React.SetStateAction<boolean>>;
  sizeColorVisible: boolean;
  switches: FeatureSwitches;
  showSellingPrice: boolean;
  priceFieldCount: number;
  codeFieldCount: number;
  SM_COLS: Record<number, string>;
}

/**
 * The middle of the Add / Edit Product form (v4.104.0, K-D23 — moved out of AddEditProductModal
 * unchanged): prices, barcode / HSN / GST, stock, size / colour and the variants matrix.
 */
export function ProductFormDetails(props: ProductFormDetailsProps) {
  const {
    editingProduct, formPurchasePrice, setFormPurchasePrice, formSellingPrice, setFormSellingPrice, formIsUnlimitedStock,
    setFormIsUnlimitedStock, formMrp, formWholesalePrice, setFormWholesalePrice, setFormMrp, formTaxRate,
    setFormTaxRate, formStock, setFormStock, formMinStock, setFormMinStock, formBarcode,
    setFormBarcode, formHsn, setFormHsn, formSize, setFormSize, formColor,
    setFormColor, onBarcodeScanned, variantsEnabled, setVariantsEnabled, variantRows, setVariantRows,
    setShowSizeColor, sizeColorVisible, switches, showSellingPrice, priceFieldCount, codeFieldCount,
    SM_COLS,
  } = props;
  return (
    <>
      {/* Pricing: Selling Price, MRP, Purchase Price. With "Separate Selling Price"
          off (Settings → Features) only MRP shows and the item sells at MRP. */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
        <div className="text-xs font-black text-slate-800 dark:text-slate-200">
          {switches.product_cost_price ? tr('Pricing & Profit Margins') : tr('Price')}
        </div>
        <div className={`grid grid-cols-1 ${SM_COLS[priceFieldCount]} gap-3`}>
          {showSellingPrice && (
            <Input
              label={tr('Selling Price (₹) *')}
              placeholder={tr('e.g. 150.00')}
              type="number"
              step="0.01"
              value={formSellingPrice}
              onChange={(e) => setFormSellingPrice(e.target.value)}
              required
            />
          )}
          <Input
            label={showSellingPrice ? tr('MRP Maximum Retail (₹)') : tr('MRP (₹) *')}
            placeholder={tr('e.g. 165.00')}
            type="number"
            step="0.01"
            value={formMrp}
            onChange={(e) => setFormMrp(e.target.value)}
            required={!showSellingPrice}
          />
          {switches.wholesale_price && (
            <Input
              label={tr('Wholesale Price (₹)')}
              placeholder={tr('blank = same as retail')}
              type="number"
              step="0.01"
              min="0"
              value={formWholesalePrice}
              onChange={(e) => setFormWholesalePrice(e.target.value)}
              data-product-wholesale
            />
          )}
          {switches.product_cost_price && (
            <Input
              label={tr('Purchase / Cost Price (₹)')}
              placeholder={tr('e.g. 120.00')}
              type="number"
              step="0.01"
              value={formPurchasePrice}
              onChange={(e) => setFormPurchasePrice(e.target.value)}
            />
          )}
        </div>
      </div>

      {/* Barcode, HSN & GST Rate — each only when its feature is on (v4.108.0: barcode too). */}
      {codeFieldCount > 0 && (
      <div className={`grid grid-cols-1 ${SM_COLS[codeFieldCount]} gap-3`}>
        {switches.product_barcode && <ProductBarcodeField value={formBarcode} onChange={setFormBarcode} onScanned={onBarcodeScanned} />}

        {/* HSN / SAC: printed on GST invoices and grouped in the GSTR-1 HSN summary */}
        {switches.product_hsn && (
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {tr('HSN / SAC Code')}
            </label>
            <Input
              placeholder={tr('e.g. 3401')}
              inputMode="numeric"
              maxLength={8}
              value={formHsn}
              onChange={(e) => setFormHsn(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        )}

        {switches.product_gst_rate && (
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {tr('GST Tax Rate (%)')}
            </label>
            <select
              value={formTaxRate}
              onChange={(e) => setFormTaxRate(Number(e.target.value))}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {/* Slabs since the 22 Sep 2025 GST rate change; 12% / 28% kept for items still billed at the old rate. */}
              <option value={0}>{tr('0% (Exempt / Nil Rated)')}</option>
              <option value={3}>{tr('3% (Gold / Silver / Jewellery)')}</option>
              <option value={5}>{tr('5% (Essential / Daily Use)')}</option>
              <option value={18}>{tr('18% (Standard Rate)')}</option>
              <option value={40}>{tr('40% (Luxury / Sin Goods)')}</option>
              <option value={12}>{tr('12% (old slab)')}</option>
              <option value={28}>{tr('28% (old slab)')}</option>
            </select>
          </div>
        )}
      </div>
      )}

      {/* Stock: "Unlimited" (no count) is the default for a new item, like the
          Android app. Switching it off fills stock and the low-stock alert with 10.
          v4.108.0: with Stock counting off the choice is not shown (a new item stays unlimited). */}
      {switches.stock_counting && (
      <div className={`rounded-2xl border ${formIsUnlimitedStock ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-white'}`}>
        <div className="px-3.5 py-2.5 flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${formIsUnlimitedStock ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
            {formIsUnlimitedStock ? <InfinityIcon className="w-4 h-4" /> : <Boxes className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-slate-900">{tr('Unlimited Stock (no count)')}</p>
            <p className="text-[10.5px] text-slate-500">
              {formIsUnlimitedStock
                ? tr('No stock count and no low-stock warnings. Switch off to count stock.')
                : tr('Stock is counted: it goes down with every sale.')}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              className="sr-only peer"
              aria-label={tr('Unlimited Stock (no count)')}
              checked={formIsUnlimitedStock}
              onChange={(e) => {
                const unlimited = e.target.checked;
                setFormIsUnlimitedStock(unlimited);
                if (!unlimited) {
                  // An item that was already counted gets its own numbers back;
                  // everything else starts at 10 in stock with an alert at 10.
                  const counted = editingProduct && !editingProduct.is_unlimited_stock;
                  setFormStock(counted ? String(editingProduct.current_stock) : String(DEFAULT_COUNTED_STOCK));
                  setFormMinStock(counted ? String(editingProduct.min_stock_level || 5) : String(DEFAULT_COUNTED_STOCK));
                }
              }}
            />
            <span className="w-9 h-5 rounded-full bg-slate-300 peer-checked:bg-emerald-600 transition-colors" />
            <span className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
          </label>
        </div>
        {!formIsUnlimitedStock && (
          <div className="px-3.5 pb-3.5 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-200">
            <Input
              label={tr('Current Available Stock')}
              placeholder={tr('e.g. 50')}
              type="number"
              value={formStock}
              onChange={(e) => setFormStock(e.target.value)}
            />
            <Input
              label={tr('Low Stock Warning Threshold')}
              placeholder={tr('e.g. 5')}
              type="number"
              value={formMinStock}
              onChange={(e) => setFormMinStock(e.target.value)}
            />
          </div>
        )}
      </div>
      )}

      {/* Optional variant attributes (size / colour) */}
      {switches.product_size_colour && !sizeColorVisible && (
        <button
          type="button"
          onClick={() => setShowSizeColor(true)}
          className="text-xs font-bold text-sky-700 hover:text-sky-900 hover:underline cursor-pointer"
        >
          {tr('+ Add size / colour')}
        </button>
      )}
      {switches.product_size_colour && sizeColorVisible && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label={tr('Size / Dimensions')}
            placeholder={tr('e.g. XL or 32 or Free Size')}
            value={formSize}
            onChange={(e) => setFormSize(e.target.value)}
          />
          <Input
            label={tr('Color / Shade')}
            placeholder={tr('e.g. Navy Blue / Maroon')}
            value={formColor}
            onChange={(e) => setFormColor(e.target.value)}
          />
        </div>
      )}

      {/* Variants matrix: new products only (edit a variant from the Variants list) */}
      {switches.product_variants && !editingProduct && setVariantsEnabled && setVariantRows && (
        <VariantMatrixEditor
          enabled={variantsEnabled}
          onToggle={setVariantsEnabled}
          rows={variantRows}
          onChange={setVariantRows}
          defaults={{ price: showSellingPrice ? formSellingPrice : formMrp, mrp: formMrp, stock: formStock }}
          unlimitedStock={formIsUnlimitedStock}
        />
      )}
      {editingProduct?.variant_label && (
        <p className="text-[11px] text-purple-700 font-bold">
          {tr('This is the “')}{editingProduct.variant_label}{tr('” variant. Its price and stock are its own.')}
        </p>
      )}
    </>
  );
}
