'use client';

import React from 'react';
import { 
  Plus, 
  Edit3, 
  Barcode, 
  Tag, 
  Sparkles, 
  Scale, 
  Pill, 
  Trash2,
  Building2,
  Boxes,
  Infinity as InfinityIcon
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Product, Category, ProductUnit } from '@/types';
import { MASTER_UNITS } from '@/lib/constants/storeProfiles';
import { VariantMatrixEditor, VariantRow } from '@/components/products/VariantMatrixEditor';
import { DEFAULT_COUNTED_STOCK } from '@/lib/products/variants';
import { tr } from '@/lib/i18n/core';

interface AddEditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingProduct: Product | null;
  categories: Category[];
  formName: string;
  setFormName: (val: string) => void;
  formCategory: string;
  setFormCategory: (val: string) => void;
  formUnit: ProductUnit;
  setFormUnit: (val: ProductUnit) => void;
  formPurchasePrice: string;
  setFormPurchasePrice: (val: string) => void;
  formSellingPrice: string;
  setFormSellingPrice: (val: string) => void;
  formIsLooseItem: boolean;
  setFormIsLooseItem: (val: boolean) => void;
  formIsUnlimitedStock: boolean;
  setFormIsUnlimitedStock: (val: boolean) => void;
  formMrp: string;
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
  onOpenScanner: () => void;
  onOpenAddCategoryModal: () => void;
  onOpenInwardSheet?: () => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  onDeleteProduct?: (id: string, name: string) => Promise<void>;
  formError?: string;
  // Variants matrix — offered only when adding a new product (Android parity)
  variantsEnabled?: boolean;
  setVariantsEnabled?: (val: boolean) => void;
  variantRows?: VariantRow[];
  setVariantRows?: (rows: VariantRow[]) => void;
}

export const AddEditProductModal: React.FC<AddEditProductModalProps> = ({
  isOpen,
  onClose,
  editingProduct,
  categories,
  formName,
  setFormName,
  formCategory,
  setFormCategory,
  formUnit,
  setFormUnit,
  formPurchasePrice,
  setFormPurchasePrice,
  formSellingPrice,
  setFormSellingPrice,
  formIsLooseItem,
  setFormIsLooseItem,
  formIsUnlimitedStock,
  setFormIsUnlimitedStock,
  formMrp,
  setFormMrp,
  formTaxRate,
  setFormTaxRate,
  formStock,
  setFormStock,
  formMinStock,
  setFormMinStock,
  formBarcode,
  setFormBarcode,
  formHsn,
  setFormHsn,

  formSize,
  setFormSize,
  formColor,
  setFormColor,
  onOpenScanner,
  onOpenAddCategoryModal,
  onOpenInwardSheet,
  onSubmit,
  onDeleteProduct,
  formError,
  variantsEnabled = false,
  setVariantsEnabled,
  variantRows = [],
  setVariantRows,
}) => {
  // Size / colour used to render only when already filled, so a new product could
  // never get them. They now open on demand and stay open once they hold a value.
  const [showSizeColor, setShowSizeColor] = React.useState(false);
  React.useEffect(() => {
    if (!isOpen) setShowSizeColor(false);
  }, [isOpen]);
  const sizeColorVisible = showSizeColor || Boolean(formSize || formColor);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          {editingProduct ? <Edit3 className="w-5 h-5 text-sky-500" /> : <Plus className="w-5 h-5 text-sky-500" />}
          <span>{editingProduct ? tr('Edit Item: {name}', { name: editingProduct.name }) : tr('Add New Item to Catalog')}</span>
        </div>
      }
      description={editingProduct ? tr('Update pricing, barcode and inventory levels.') : tr('Enter product details, barcode, selling price, and initial stock.')}
      size="lg"
    >
      <form onSubmit={onSubmit} className="space-y-3.5">
        {/* Bulk Excel Inward Suggestion Banner */}
        {!editingProduct && onOpenInwardSheet && (
          <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200/80 dark:border-amber-800/60 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shrink-0">
                <Sparkles className="w-4 h-4 text-slate-950" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-slate-900 dark:text-slate-100">
                  {tr('Have a Wholesale Bill in Excel?')}
                </p>
                <p className="text-[10.5px] text-slate-600 dark:text-slate-400 truncate">
                  {tr('Don’t type items one by one. Upload the Excel / CSV file to add them all at once.')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenInwardSheet();
              }}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-black shrink-0 hover:bg-slate-800 cursor-pointer shadow-xs active:scale-95 transition"
            >
              {tr('Bulk Inward (Excel)')}
            </button>
          </div>
        )}

        {/* Product Name */}
        <Input
          label={tr('Product / Item Full Name *')}
          placeholder={tr('e.g. Fortune Sunflower Oil 1L')}
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          required
          autoFocus
        />

        {/* Category & Unit */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {tr('Category')}
              </label>
              <button
                type="button"
                onClick={onOpenAddCategoryModal}
                className="text-[11px] font-bold text-sky-600 hover:underline cursor-pointer"
              >
                {tr('+ New Category')}
              </button>
            </div>
            <select
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">{tr('General Products')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {tr('Measurement Unit')}
            </label>
            <select
              value={formUnit}
              onChange={(e) => setFormUnit(e.target.value as ProductUnit)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {MASTER_UNITS.map((u) => (
                <option key={u.id} value={u.id}>{u.labelEn}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Pricing: Selling Price, MRP, Purchase Price */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
          <div className="text-xs font-black text-slate-800 dark:text-slate-200">
            {tr('Pricing & Profit Margins')}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label={tr('Selling Price (₹) *')}
              placeholder={tr('e.g. 150.00')}
              type="number"
              step="0.01"
              value={formSellingPrice}
              onChange={(e) => setFormSellingPrice(e.target.value)}
              required
            />
            <Input
              label={tr('MRP Maximum Retail (₹)')}
              placeholder={tr('e.g. 165.00')}
              type="number"
              step="0.01"
              value={formMrp}
              onChange={(e) => setFormMrp(e.target.value)}
            />
            <Input
              label={tr('Purchase / Cost Price (₹)')}
              placeholder={tr('e.g. 120.00')}
              type="number"
              step="0.01"
              value={formPurchasePrice}
              onChange={(e) => setFormPurchasePrice(e.target.value)}
            />
          </div>
        </div>

        {/* Barcode, HSN & GST Rate */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {tr('Barcode / EAN-13')}
              </label>
              <button
                type="button"
                onClick={onOpenScanner}
                className="text-[11px] font-bold text-sky-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Barcode className="w-3 h-3" />
                <span>{tr('Scan Camera')}</span>
              </button>
            </div>
            <Input
              placeholder={tr('e.g. 8901030383748')}
              value={formBarcode}
              onChange={(e) => setFormBarcode(e.target.value)}
            />
          </div>

          {/* HSN / SAC: printed on GST invoices and grouped in the GSTR-1 HSN summary */}
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
        </div>

        {/* Stock: "Unlimited" (no count) is the default for a new item, like the
            Android app. Switching it off fills stock and the low-stock alert with 10. */}
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



        {/* Optional variant attributes (size / colour) */}
        {!sizeColorVisible && (
          <button
            type="button"
            onClick={() => setShowSizeColor(true)}
            className="text-xs font-bold text-sky-700 hover:text-sky-900 hover:underline cursor-pointer"
          >
            {tr('+ Add size / colour')}
          </button>
        )}
        {sizeColorVisible && (
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
        {!editingProduct && setVariantsEnabled && setVariantRows && (
          <VariantMatrixEditor
            enabled={variantsEnabled}
            onToggle={setVariantsEnabled}
            rows={variantRows}
            onChange={setVariantRows}
            defaults={{ price: formSellingPrice, mrp: formMrp, stock: formStock }}
            unlimitedStock={formIsUnlimitedStock}
          />
        )}
        {editingProduct?.variant_label && (
          <p className="text-[11px] text-purple-700 font-bold">
            {tr('This is the “')}{editingProduct.variant_label}{tr('” variant. Its price and stock are its own.')}
          </p>
        )}

        {/* Validation Error Banner */}
        {formError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold animate-in fade-in flex items-center gap-2">
            <span>⚠️</span>
            <span>{formError}</span>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          {editingProduct && onDeleteProduct ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => onDeleteProduct(editingProduct.id, editingProduct.name)}
              className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs rounded-xl cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              <span>{tr('Delete')}</span>
            </Button>
          ) : <div />}

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
              {tr('Cancel')}
            </Button>
            <Button type="submit" className="font-black bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 hover:bg-slate-800 rounded-xl">
              {editingProduct ? tr('Update Product') : tr('Save Product')}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
