'use client';

import React, { useState } from 'react';
import { Plus, Edit3, Sparkles, Trash2, Printer, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Product, Category, ProductUnit } from '@/types';
import { MASTER_UNITS } from '@/lib/constants/storeProfiles';
import { VariantRow } from '@/components/products/VariantMatrixEditor';
import { showSellingPriceField, useFeatureSwitches } from '@/lib/features/featureSwitches';
import { tr } from '@/lib/i18n/core';
import { readVerticalProfile } from '@/lib/business/verticalProfile';

// v4.124.0 (AU-27): an example name that fits the shop's category (shops without one: as before).
const NAME_EXAMPLE: Record<string, string> = {
  pharmacy: 'e.g. Dolo 650 Tablet (15 tab)',
  clothing: 'e.g. Women Cotton Kurti',
  hardware: 'e.g. USB Type-C Charging Cable 1 m',
  restaurant: 'e.g. Paneer Butter Masala',
  retail: 'e.g. Classmate Notebook 172 Pages',
};
import { ProductFormDetails } from '@/components/products/ProductFormDetails';
import { categoryLabel } from '@/lib/products/defaultCategory';

const EXCEL_TIP_KEY = 'kamai_hide_excel_tip';

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
  /** Wholesale price (v4.87.0) — shown with the "Wholesale price" switch on. */
  formWholesalePrice: string;
  setFormWholesalePrice: (val: string) => void;
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
  formBatch: string;
  setFormBatch: (val: string) => void;
  formExpiry: string;
  setFormExpiry: (val: string) => void;
  /** v4.138.0 restaurant: 'veg' | 'egg' | 'nonveg' | '' */
  formFoodType?: string;
  setFormFoodType?: (val: string) => void;
  formColor: string;
  setFormColor: (val: string) => void;
  /** A code scanned (USB gun + Enter) into the barcode box — fill name / MRP from the offline list. */
  onBarcodeScanned?: (code: string) => void;
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
  formWholesalePrice,
  setFormWholesalePrice,
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
  formBatch,
  setFormBatch,
  formExpiry,
  setFormExpiry,
  formFoodType = '',
  setFormFoodType,
  formColor,
  setFormColor,
  onBarcodeScanned,
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

  // Settings → Features decides which optional fields the form shows. A hidden field
  // keeps whatever value the product already has; a new product gets it empty / 0.
  const switches = useFeatureSwitches();
  const showSellingPrice = showSellingPriceField(switches.product_selling_price, editingProduct);
  const priceFieldCount = 1 + (showSellingPrice ? 1 : 0) + (switches.product_cost_price ? 1 : 0) + (switches.wholesale_price ? 1 : 0);
  const codeFieldCount = (switches.product_barcode ? 1 : 0) + (switches.product_hsn ? 1 : 0) + (switches.product_gst_rate ? 1 : 0);
  const SM_COLS: Record<number, string> = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4' };

  // The "Have a wholesale bill in Excel?" tip: closed once = gone on this computer.
  const [excelTipHidden, setExcelTipHidden] = useState(() => {
    try { return localStorage.getItem(EXCEL_TIP_KEY) === '1'; } catch { return false; }
  });
  const hideExcelTip = () => {
    setExcelTipHidden(true);
    try { localStorage.setItem(EXCEL_TIP_KEY, '1'); } catch {}
  };

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
        {/* Bulk Excel Inward Suggestion Banner — ✕ hides it on this computer (v4.93.0) */}
        {!editingProduct && onOpenInwardSheet && !excelTipHidden && (
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
            <button
              type="button"
              onClick={hideExcelTip}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 shrink-0 cursor-pointer"
              aria-label={tr('Do not show this again')}
              title={tr('Do not show this again')}
              data-excel-tip-hide
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Product Name */}
        <Input
          label={tr('Product / Item Full Name *')}
          placeholder={tr(NAME_EXAMPLE[readVerticalProfile()?.vertical || ''] || 'e.g. Fortune Sunflower Oil 1L')}
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
                <option key={c.id} value={c.id}>{categoryLabel(c.name)}</option>
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

        <ProductFormDetails
          {...{
            editingProduct, formPurchasePrice, setFormPurchasePrice, formSellingPrice, setFormSellingPrice, formIsUnlimitedStock,
            setFormIsUnlimitedStock, formMrp, formWholesalePrice, setFormWholesalePrice, setFormMrp, formTaxRate,
            setFormTaxRate, formStock, setFormStock, formMinStock, setFormMinStock, formBarcode,
            setFormBarcode, formHsn, setFormHsn, formSize, setFormSize, formBatch, setFormBatch, formExpiry, setFormExpiry, formFoodType, setFormFoodType, formColor,
            setFormColor, onBarcodeScanned, variantsEnabled, setVariantsEnabled, variantRows, setVariantRows,
            setShowSizeColor, sizeColorVisible, switches, showSellingPrice, priceFieldCount, codeFieldCount,
            SM_COLS,
          }}
        />

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
            {/* Save, then its labels (the 1-click label window) — not for a new item with variants (each size has its own),
                nor with Settings → Features → Barcode Studio & Labels off. */}
            {switches.barcode_studio && !(variantsEnabled && !editingProduct) && (
              <Button type="submit" variant="outline" data-save-action="print" className="rounded-xl font-bold gap-1" data-product-save-print>
                <Printer className="w-3.5 h-3.5" />
                {tr('Save & print label')}
              </Button>
            )}
            <Button type="submit" className="font-black bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 hover:bg-slate-800 rounded-xl">
              {editingProduct ? tr('Update Product') : tr('Save Product')}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
