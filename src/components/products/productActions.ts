import React from 'react';
import { cleanExpiry } from '@/lib/products/expiry';
import { showConfirm } from '@/lib/ui/dialogs';
import { db } from '@/lib/db';
import { generalCategoryId } from '@/lib/products/defaultCategory';
import { Product } from '@/types';
import { parseRupeesToPaise } from '@/lib/utils';
import { validateProductData } from '@/lib/validation/validators';
import { lookupBarcode } from '@/lib/barcode/barcodeDictionary';
import { showSellingPriceField } from '@/lib/features/featureSwitches';
import { createProductWithVariants, DEFAULT_COUNTED_STOCK, deleteProductAndVariants, isVariantParent } from '@/lib/products/variants';
import { tr } from '@/lib/i18n/core';
import { newId } from '@/lib/ids';
import type { Business, Category, ProductUnit } from '@/types';
import type { VariantRow } from '@/components/products/VariantMatrixEditor';
import type { FeatureSwitches } from '@/lib/features/featureSwitches';

export interface CreateProductActionsDeps {
  setSelectedCategory: React.Dispatch<React.SetStateAction<string>>;
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingProduct: React.Dispatch<React.SetStateAction<Product | null>>;
  editingProduct: Product | null;
  setIsBarcodePrintOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setBarcodePrintProduct: React.Dispatch<React.SetStateAction<Product | null>>;
  setBarcodePrintCopies: React.Dispatch<React.SetStateAction<number | undefined>>;
  setIsAddCategoryModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  newCatName: string;
  setNewCatName: React.Dispatch<React.SetStateAction<string>>;
  setFormName: React.Dispatch<React.SetStateAction<string>>;
  formName: string;
  setFormCategory: React.Dispatch<React.SetStateAction<string>>;
  formCategory: string;
  setFormUnit: React.Dispatch<React.SetStateAction<ProductUnit>>;
  formUnit: ProductUnit;
  setFormPurchasePrice: React.Dispatch<React.SetStateAction<string>>;
  formPurchasePrice: string;
  setFormSellingPrice: React.Dispatch<React.SetStateAction<string>>;
  formSellingPrice: string;
  setFormIsLooseItem: React.Dispatch<React.SetStateAction<boolean>>;
  formIsLooseItem: boolean;
  setFormIsUnlimitedStock: React.Dispatch<React.SetStateAction<boolean>>;
  formIsUnlimitedStock: boolean;
  setFormMrp: React.Dispatch<React.SetStateAction<string>>;
  formMrp: string;
  setFormWholesalePrice: React.Dispatch<React.SetStateAction<string>>;
  formWholesalePrice: string;
  setFormTaxRate: React.Dispatch<React.SetStateAction<number>>;
  formTaxRate: number;
  setFormStock: React.Dispatch<React.SetStateAction<string>>;
  formStock: string;
  setFormMinStock: React.Dispatch<React.SetStateAction<string>>;
  formMinStock: string;
  setFormBarcode: React.Dispatch<React.SetStateAction<string>>;
  formBarcode: string;
  setFormHsn: React.Dispatch<React.SetStateAction<string>>;
  formHsn: string;
  setFormIsFavorite: React.Dispatch<React.SetStateAction<boolean>>;
  formIsFavorite: boolean;
  setFormSize: React.Dispatch<React.SetStateAction<string>>;
  formSize: string;
  setFormBatch: React.Dispatch<React.SetStateAction<string>>;
  formBatch: string;
  setFormExpiry: React.Dispatch<React.SetStateAction<string>>;
  formExpiry: string;
  setFormColor: React.Dispatch<React.SetStateAction<string>>;
  formColor: string;
  setFormError: React.Dispatch<React.SetStateAction<string>>;
  setVariantsEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  variantsEnabled: boolean;
  setVariantRows: React.Dispatch<React.SetStateAction<VariantRow[]>>;
  variantRows: VariantRow[];
  allProducts: Product[];
  categories: Category[];
  business: Business | undefined;
  switches: FeatureSwitches;
}

/**
 * What the Products page saves (v4.104.0, K-D23 — moved out of app/products/page.tsx unchanged): open
 * the add / edit window, save an item (with variants, opening stock, validation), delete, star, quick
 * stock and price changes, a scanned barcode, a new category.
 */
export function createProductActions(deps: CreateProductActionsDeps) {
  const {
    setSelectedCategory, setIsModalOpen, setEditingProduct, editingProduct, setIsBarcodePrintOpen, setBarcodePrintProduct,
    setBarcodePrintCopies, setIsAddCategoryModalOpen, newCatName, setNewCatName, setFormName, formName,
    setFormCategory, formCategory, setFormUnit, formUnit, setFormPurchasePrice, formPurchasePrice,
    setFormSellingPrice, formSellingPrice, setFormIsLooseItem, formIsLooseItem, setFormIsUnlimitedStock, formIsUnlimitedStock,
    setFormMrp, formMrp, setFormWholesalePrice, formWholesalePrice, setFormTaxRate, formTaxRate,
    setFormStock, formStock, setFormMinStock, formMinStock, setFormBarcode, formBarcode,
    setFormHsn, formHsn, setFormIsFavorite, formIsFavorite, setFormSize, formSize, setFormBatch, formBatch, setFormExpiry, formExpiry,
    setFormColor, formColor, setFormError, setVariantsEnabled, variantsEnabled, setVariantRows,
    variantRows, allProducts, categories, business, switches,
  } = deps;
  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormError('');
    setFormName('');
    setFormCategory('');
    setFormUnit('piece');
    setFormPurchasePrice('');
    setFormSellingPrice('');
    setFormIsLooseItem(false);
    // New items are "Unlimited stock" (not counted) by default, like the Android app.
    setFormIsUnlimitedStock(true);
    setFormMrp('');
    setFormWholesalePrice('');
    setFormTaxRate(0);
    setFormStock('0');
    setFormMinStock(String(DEFAULT_COUNTED_STOCK));
    setFormBarcode('');
    setFormHsn('');
    setFormIsFavorite(false);

    setFormSize('');
    setFormBatch('');
    setFormExpiry('');
    setFormColor('');
    setVariantsEnabled(false);
    setVariantRows([]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: Product) => {
    setVariantsEnabled(false);
    setVariantRows([]);
    setEditingProduct(p);
    setFormError('');
    setFormName(p.name);
    setFormCategory(p.category_id || '');
    setFormUnit(p.unit || 'packet');
    setFormPurchasePrice(p.purchase_price ? (p.purchase_price / 100).toFixed(2) : '');
    setFormSellingPrice((p.selling_price / 100).toFixed(2));
    setFormIsLooseItem(Boolean(p.is_loose_item));
    setFormIsUnlimitedStock(Boolean(p.is_unlimited_stock));
    setFormMrp(p.mrp ? (p.mrp / 100).toFixed(2) : '');
    setFormWholesalePrice(p.wholesale_price ? (p.wholesale_price / 100).toFixed(2) : '');
    setFormTaxRate(p.tax_rate || 0);
    setFormStock(p.current_stock.toString());
    setFormMinStock((p.min_stock_level || 5).toString());
    setFormBarcode(p.barcode || '');
    setFormHsn(p.hsn_code || '');
    setFormIsFavorite(Boolean(p.is_favorite));

    setFormSize(p.size || '');
    setFormBatch(p.batch_number || '');
    setFormExpiry(cleanExpiry(p.expiry_date));
    setFormColor(p.color || '');
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    // Pressed "Save & print label" (v4.78.0): after saving, its labels open.
    const printAfterSave = ((e.nativeEvent as SubmitEvent).submitter as HTMLElement | null)?.dataset?.saveAction === 'print';

    // "Separate Selling Price" off: the form shows only MRP and the item sells at MRP.
    const sellingShown = showSellingPriceField(switches.product_selling_price, editingProduct);
    if (!sellingShown && !(parseRupeesToPaise(formMrp || '0') > 0)) {
      setFormError(tr('Enter the MRP (₹).'));
      return;
    }
    const sellingPricePaise = sellingShown ? parseRupeesToPaise(formSellingPrice) : parseRupeesToPaise(formMrp);
    const purchasePricePaise = formPurchasePrice ? parseRupeesToPaise(formPurchasePrice) : 0;
    const mrpPaise = formMrp ? parseRupeesToPaise(formMrp) : sellingPricePaise;
    // Wholesale price (v4.87.0): only from the form while the switch is on; else the saved one stays.
    const wholesalePricePaise = switches.wholesale_price
      ? (formWholesalePrice ? parseRupeesToPaise(formWholesalePrice) : 0)
      : editingProduct?.wholesale_price || 0;
    if (wholesalePricePaise < 0) {
      setFormError(tr('Enter a valid wholesale price.'));
      return;
    }
    const stockNum = parseFloat(formStock) || 0;
    const minStockNum = parseInt(formMinStock) || 5;

    // Strict validation check
    const validation = validateProductData({
      name: formName,
      sellingPricePaise,
      mrpPaise,
      purchasePricePaise,
      currentStock: stockNum,
      minStockLevel: minStockNum,
      isUnlimitedStock: formIsUnlimitedStock,
      taxRate: formTaxRate,
    });

    if (!validation.isValid) {
      setFormError(validation.error || tr('Invalid product details'));
      return;
    }

    const now = new Date().toISOString();

    const categoryId = formCategory || generalCategoryId(categories);
    const productPayload: Omit<Product, 'id'> = {
      business_id: business?.id || 'biz_default',
      name: formName.trim(),
      category_id: categoryId,
      // Shown on the POS card and in reports; kept in step with the chosen category.
      category_name: categories.find((c) => c.id === categoryId)?.name || 'General',
      unit: formUnit,
      selling_price: sellingPricePaise,
      purchase_price: purchasePricePaise,
      mrp: mrpPaise,
      wholesale_price: wholesalePricePaise > 0 ? wholesalePricePaise : undefined,
      tax_rate: formTaxRate,
      // New products follow Settings → "Default GST Calculation"; an edited product keeps its own.
      is_tax_inclusive: editingProduct?.is_tax_inclusive ?? business?.gst_pricing_mode !== 'exclusive',
      is_loose_item: formIsLooseItem,
      is_unlimited_stock: formIsUnlimitedStock,
      current_stock: stockNum,
      min_stock_level: minStockNum,
      barcode: formBarcode.trim() || undefined,
      hsn_code: formHsn.trim() || undefined,

      size: formSize.trim() || undefined,
      batch_number: formBatch.trim() || undefined,
      expiry_date: cleanExpiry(formExpiry) || undefined,
      color: formColor.trim() || undefined,
      is_favorite: formIsFavorite,
      is_active: true,
      created_at: editingProduct ? editingProduct.created_at : now,
      updated_at: now,
      sync_status: 'synced',
    };

    // Variants: every row needs a price; the parent itself is never sold.
    const useVariants = !editingProduct && variantsEnabled;
    if (useVariants) {
      if (variantRows.length === 0) {
        setFormError(tr('Add at least one variant (size / colour), or switch variants off.'));
        return;
      }
      const badRow = variantRows.find((r) => parseRupeesToPaise(r.price || '0') <= 0);
      if (badRow) {
        setFormError(tr('Enter a selling price for variant "{label}".', { label: badRow.label }));
        return;
      }
    }

    try {
      let saved: Product | null = null;
      if (editingProduct) {
        // Keep fields the form does not show (variant links, supplier, IMEI…).
        saved = { ...editingProduct, ...productPayload, id: editingProduct.id };
        await db.products.put(saved);
      } else if (useVariants) {
        await createProductWithVariants(
          { ...productPayload, id: newId('prod') },
          variantRows.map((r) => ({
            label: r.label,
            sellingPricePaise: parseRupeesToPaise(r.price || '0'),
            mrpPaise: r.mrp ? parseRupeesToPaise(r.mrp) : 0,
            stock: formIsUnlimitedStock ? 0 : parseFloat(r.stock) || 0,
            barcode: r.barcode,
          }))
        );
      } else {
        const newProdId = newId('prod');
        saved = { ...productPayload, id: newProdId };
        await db.products.put(saved);

        // Opening-stock entry in the stock history (an unlimited item has no count to record)
        if (!formIsUnlimitedStock) await db.inventory_movements.put({
          id: newId('mov'),
          business_id: business?.id || 'biz_default',
          product_id: newProdId,
          product_name: formName.trim(),
          movement_type: 'ADJUSTMENT',
          quantity: stockNum,
          previous_stock: 0,
          new_stock: stockNum,
          reason: 'Initial product stock creation',
          created_by: 'owner',
          created_at: now,
        });
      }

      setIsModalOpen(false);
      if (printAfterSave && saved) {
        setBarcodePrintProduct(saved);
        setBarcodePrintCopies(!editingProduct && !formIsUnlimitedStock && stockNum > 0 ? stockNum : undefined);
        setIsBarcodePrintOpen(true);
      }
    } catch (err) {
      console.error('Failed to save product:', err);
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    const product = allProducts.find((p) => p.id === id);
    const variantCount = product && isVariantParent(product) ? allProducts.filter((p) => p.parent_id === id).length : 0;
    const question = variantCount
      ? tr('Delete "{name}" and its {variantCount} variants?', { name: name, variantCount: variantCount })
      : tr('Are you sure you want to delete "{name}"?', { name: name });
    if (await showConfirm(question, { danger: true, confirmLabel: tr('Delete') })) {
      if (product) await deleteProductAndVariants(product);
      else await db.products.delete(id);
      setIsModalOpen(false);
    }
  };

  const handleToggleFavorite = async (p: Product) => {
    await db.products.update(p.id, {
      is_favorite: !p.is_favorite,
      updated_at: new Date().toISOString(),
    });
  };

  const handleQuickStockChange = async (p: Product, delta: number) => {
    const newStock = Math.max(0, p.current_stock + delta);
    await db.products.update(p.id, {
      current_stock: newStock,
      updated_at: new Date().toISOString(),
    });

    await db.inventory_movements.put({
      id: newId('mov'),
      business_id: business?.id || 'biz_default',
      product_id: p.id,
      product_name: p.name,
      movement_type: delta > 0 ? 'PURCHASE' : 'SALE',
      quantity: Math.abs(delta),
      previous_stock: p.current_stock,
      new_stock: newStock,
      reason: delta > 0 ? 'Quick stock restock' : 'Stock deduction',
      created_by: 'owner',
      created_at: new Date().toISOString(),
    });
  };

  const handleQuickPriceChange = async (p: Product, newPricePaise: number) => {
    await db.products.update(p.id, {
      selling_price: newPricePaise,
      updated_at: new Date().toISOString(),
    });
  };

  const handle1ClickBarcodePrint = (p: Product) => {
    setBarcodePrintProduct(p);
    setBarcodePrintCopies(undefined);
    setIsBarcodePrintOpen(true);
  };

  // A code scanned into the Add / Edit Product barcode box (USB gun + Enter): name, price,
  // GST and unit from the offline barcode list, only while the name is still empty.
  const handleBarcodeScanned = async (code: string) => {
    setFormBarcode(code);

    if (!formName) {
      const match = await lookupBarcode(code);
      if (match && match.name) {
        setFormName(match.name);
        if (match.selling_price) setFormSellingPrice(match.selling_price.toString());
        if (match.mrp) setFormMrp(match.mrp.toString());
        if (match.tax_rate) setFormTaxRate(match.tax_rate);
        if (match.unit) setFormUnit(match.unit as any);
      }
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const newCatId = newId('cat');
    await db.categories.put({
      id: newCatId,
      business_id: business?.id || 'biz_default',
      name: newCatName.trim(),
      created_at: new Date().toISOString(),
    });
    setFormCategory(newCatId);
    setSelectedCategory(newCatId);
    setNewCatName('');
    setIsAddCategoryModalOpen(false);
  };

  return { handle1ClickBarcodePrint, handleOpenAddModal, handleOpenEditModal, handleSaveProduct, handleDeleteProduct, handleToggleFavorite, handleQuickStockChange, handleQuickPriceChange, handleBarcodeScanned, handleCreateCategory };
}
