'use client';
import { showConfirm } from '@/lib/ui/dialogs';

import React, { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { db } from '@/lib/db';
import { generalCategoryId } from '@/lib/products/defaultCategory';
import { useLiveQuery } from 'dexie-react-hooks';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { useDebounce } from 'use-debounce';
import { useTranslation } from '@/lib/i18n';
import { Product, ProductUnit } from '@/types';
import { parseRupeesToPaise } from '@/lib/utils';
import { validateProductData } from '@/lib/validation/validators';
import { Package } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { lookupBarcode } from '@/lib/barcode/barcodeDictionary';

// Modular Sub-components
import { ProductHeaderActions } from '@/components/products/ProductHeaderActions';
import { ProductMetricsRibbon } from '@/components/products/ProductMetricsRibbon';
import { ProductFilterToolbar } from '@/components/products/ProductFilterToolbar';
import { ProductCard } from '@/components/products/ProductCard';
import { ProductTableView } from '@/components/products/ProductTableView';
import { QuickBarcodePrintModal } from '@/components/products/QuickBarcodePrintModal';
import { AddEditProductModal } from '@/components/products/AddEditProductModal';
import { VariantRow } from '@/components/products/VariantMatrixEditor';
import { showSellingPriceField, useFeatureSwitches } from '@/lib/features/featureSwitches';
import { createProductWithVariants, DEFAULT_COUNTED_STOCK, deleteProductAndVariants, isVariantChild, isVariantParent, tracksOwnStock } from '@/lib/products/variants';
import { tr } from '@/lib/i18n/core';

const VariantsManagerModal = dynamic(
  () => import('@/components/products/VariantsManagerModal').then((m) => m.VariantsManagerModal),
  { ssr: false }
);

// Lazy-load heavy sheets & modals
const PurchaseInwardOptionsSheet = dynamic(
  () => import('@/components/purchases/PurchaseInwardOptionsSheet').then((m) => m.PurchaseInwardOptionsSheet),
  { ssr: false }
);
const ExcelInventoryImporter = dynamic(
  () => import('@/components/inventory/ExcelInventoryImporter').then((m) => m.ExcelInventoryImporter),
  { ssr: false }
);
const BarcodeScannerModal = dynamic(
  () => import('@/components/barcode/BarcodeScannerModal').then((m) => m.BarcodeScannerModal),
  { ssr: false }
);

export default function ProductsPage() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isPurchaseSheetOpen, setIsPurchaseSheetOpen] = useState(false);
  const [isExcelImporterOpen, setIsExcelImporterOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Desktop Switcher: Dense Excel Table vs Cards Grid (default 'table')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [isBarcodePrintOpen, setIsBarcodePrintOpen] = useState(false);
  const [barcodePrintProduct, setBarcodePrintProduct] = useState<Product | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('kamai_products_view_mode') as 'table' | 'cards';
      if (saved === 'table' || saved === 'cards') setViewMode(saved);
    } catch {}
  }, []);

  const handleViewModeChange = (mode: 'table' | 'cards') => {
    setViewMode(mode);
    try {
      localStorage.setItem('kamai_products_view_mode', mode);
    } catch {}
  };

  // Quick Add Category State
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Form State
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formUnit, setFormUnit] = useState<ProductUnit>('packet');
  const [formPurchasePrice, setFormPurchasePrice] = useState('');
  const [formSellingPrice, setFormSellingPrice] = useState('');
  const [formIsLooseItem, setFormIsLooseItem] = useState(false);
  const [formIsUnlimitedStock, setFormIsUnlimitedStock] = useState(false);
  const [formMrp, setFormMrp] = useState('');
  const [formTaxRate, setFormTaxRate] = useState<number>(0);
  const [formStock, setFormStock] = useState('');
  const [formMinStock, setFormMinStock] = useState('5');
  const [formBarcode, setFormBarcode] = useState('');
  const [formHsn, setFormHsn] = useState('');
  const [formIsFavorite, setFormIsFavorite] = useState(false);

  // Dynamic Store Specific Attributes

  const [formSize, setFormSize] = useState('');
  const [formColor, setFormColor] = useState('');
  const [formError, setFormError] = useState('');

  // Variants (new products only, like Android) and the per-parent variants modal
  const [variantsEnabled, setVariantsEnabled] = useState(false);
  const [variantRows, setVariantRows] = useState<VariantRow[]>([]);
  const [variantsParent, setVariantsParent] = useState<Product | null>(null);

  // Dexie Queries
  const allProducts = useLiveQuery(async () => db.products.toArray()) || [];
  const categories = useLiveQuery(async () => db.categories.toArray()) || [];
  const business = useBusiness();
  // Settings → Features: optional form fields, and Bulk Inward belongs to Purchases.
  const switches = useFeatureSwitches();

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  // Auto-launch the bulk inward sheet if navigated with ?scan=auto
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('scan') === 'auto') {
        setIsPurchaseSheetOpen(true);
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      }
    }
  }, []);

  const [debouncedSearch] = useDebounce(searchQuery, 300);

  // Filtered Products List
  const filteredProducts = useMemo(() => {
    return allProducts.filter((p) => {
      // 0. Variants show under their parent; they appear on their own only in a search
      if (!debouncedSearch.trim() && isVariantChild(p)) return false;

      // 1. Search Query
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase().trim();
        const matchName = p.name.toLowerCase().includes(q);
        const matchBarcode = p.barcode ? p.barcode.toLowerCase().includes(q) : false;
        if (!matchName && !matchBarcode) return false;
      }

      // 2. Category Filter
      if (selectedCategory !== 'all' && p.category_id !== selectedCategory) {
        return false;
      }

      // 3. Low Stock Filter
      if (showLowStockOnly) {
        if (!tracksOwnStock(p)) return false;
        const minAlert = p.min_stock_level || 5;
        if (p.current_stock > minAlert) return false;
      }

      return true;
    }).sort((a, b) => {
      if (a.is_favorite && !b.is_favorite) return -1;
      if (!a.is_favorite && b.is_favorite) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [allProducts, debouncedSearch, selectedCategory, showLowStockOnly]);

  // Financial & Inventory Metrics
  const lowStockCount = useMemo(() => {
    return allProducts.filter((p) => tracksOwnStock(p) && p.current_stock <= (p.min_stock_level || 5)).length;
  }, [allProducts]);

  const totalStockValuePaise = useMemo(() => {
    return allProducts.reduce((acc, p) => {
      if (!tracksOwnStock(p)) return acc;
      const cost = p.purchase_price || p.selling_price || 0;
      return acc + (cost * Math.max(0, p.current_stock));
    }, 0);
  }, [allProducts]);

  // Handlers
  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormError('');
    setFormName('');
    setFormCategory('');
    setFormUnit('packet');
    setFormPurchasePrice('');
    setFormSellingPrice('');
    setFormIsLooseItem(false);
    // New items are "Unlimited stock" (not counted) by default, like the Android app.
    setFormIsUnlimitedStock(true);
    setFormMrp('');
    setFormTaxRate(0);
    setFormStock('0');
    setFormMinStock(String(DEFAULT_COUNTED_STOCK));
    setFormBarcode('');
    setFormHsn('');
    setFormIsFavorite(false);

    setFormSize('');
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
    setFormTaxRate(p.tax_rate || 0);
    setFormStock(p.current_stock.toString());
    setFormMinStock((p.min_stock_level || 5).toString());
    setFormBarcode(p.barcode || '');
    setFormHsn(p.hsn_code || '');
    setFormIsFavorite(Boolean(p.is_favorite));

    setFormSize(p.size || '');
    setFormColor(p.color || '');
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // "Separate Selling Price" off: the form shows only MRP and the item sells at MRP.
    const sellingShown = showSellingPriceField(switches.product_selling_price, editingProduct);
    if (!sellingShown && !(parseRupeesToPaise(formMrp || '0') > 0)) {
      setFormError(tr('Enter the MRP (₹).'));
      return;
    }
    const sellingPricePaise = sellingShown ? parseRupeesToPaise(formSellingPrice) : parseRupeesToPaise(formMrp);
    const purchasePricePaise = formPurchasePrice ? parseRupeesToPaise(formPurchasePrice) : 0;
    const mrpPaise = formMrp ? parseRupeesToPaise(formMrp) : sellingPricePaise;
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
      if (editingProduct) {
        // Keep fields the form does not show (variant links, supplier, IMEI…).
        await db.products.put({
          ...editingProduct,
          ...productPayload,
          id: editingProduct.id,
        });
      } else if (useVariants) {
        await createProductWithVariants(
          { ...productPayload, id: `prod_${Date.now()}` },
          variantRows.map((r) => ({
            label: r.label,
            sellingPricePaise: parseRupeesToPaise(r.price || '0'),
            mrpPaise: r.mrp ? parseRupeesToPaise(r.mrp) : 0,
            stock: formIsUnlimitedStock ? 0 : parseFloat(r.stock) || 0,
            barcode: r.barcode,
          }))
        );
      } else {
        const newId = `prod_${Date.now()}`;
        await db.products.put({
          ...productPayload,
          id: newId,
        });

        // Opening-stock entry in the stock history (an unlimited item has no count to record)
        if (!formIsUnlimitedStock) await db.inventory_movements.put({
          id: `mov_${Date.now()}`,
          business_id: business?.id || 'biz_default',
          product_id: newId,
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
      id: `mov_${Date.now()}`,
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
    setIsBarcodePrintOpen(true);
  };

  const handleBarcodeScanned = async (code: string) => {
    setIsScannerOpen(false);
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
    const newId = `cat_${Date.now()}`;
    await db.categories.put({
      id: newId,
      business_id: business?.id || 'biz_default',
      name: newCatName.trim(),
      created_at: new Date().toISOString(),
    });
    setFormCategory(newId);
    setSelectedCategory(newId);
    setNewCatName('');
    setIsAddCategoryModalOpen(false);
  };

  return (
    <div className="space-y-3.5 pb-20 sm:pb-8 animate-in fade-in duration-150">
      {/* 1. Header Actions */}
      <ProductHeaderActions
        totalProducts={allProducts.length}
        onOpenAddModal={handleOpenAddModal}
        onOpenExcelImporter={() => setIsExcelImporterOpen(true)}
        onOpenInwardSheet={switches.purchases ? () => setIsPurchaseSheetOpen(true) : undefined}
      />

      {/* 2. Metrics Ribbon */}
      <ProductMetricsRibbon
        totalProducts={allProducts.length}
        lowStockCount={lowStockCount}
        totalStockValuePaise={totalStockValuePaise}
        totalCategories={categories.length}
      />

      {/* 3. Filter & Category Toolbar */}
      <ProductFilterToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        showLowStockOnly={showLowStockOnly}
        onToggleLowStock={setShowLowStockOnly}
        onOpenScanner={() => setIsScannerOpen(true)}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
      />

      {/* 4. Products View: Dense Excel Table or Cards Grid */}
      {viewMode === 'table' ? (
        filteredProducts.length > 0 ? (
          <ProductTableView
            products={filteredProducts}
            categoryMap={categoryMap}
            onEdit={handleOpenEditModal}
            onDelete={(prod) => handleDeleteProduct(prod.id, prod.name)}
            onQuickStockChange={handleQuickStockChange}
            onQuickPriceChange={handleQuickPriceChange}
            on1ClickBarcodePrint={handle1ClickBarcodePrint}
            onOpenVariants={setVariantsParent}
          />
        ) : (
          <div className="py-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <Package className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <div className="font-bold text-slate-700 dark:text-slate-300 text-sm">{tr('No products found')}</div>
            <p className="text-xs text-slate-400 mt-1">{tr('Try adjusting your filters or click "Add Product".')}</p>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredProducts.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              categoryName={p.category_id ? categoryMap.get(p.category_id) : undefined}
              onEdit={handleOpenEditModal}
              onDelete={(prod) => handleDeleteProduct(prod.id, prod.name)}
              onToggleFavorite={handleToggleFavorite}
              onQuickStockChange={handleQuickStockChange}
              onOpenVariants={setVariantsParent}
            />
          ))}

          {filteredProducts.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              <Package className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <div className="font-bold text-slate-700 dark:text-slate-300 text-sm">{tr('No products found')}</div>
              <p className="text-xs text-slate-400 mt-1">{tr('Try adjusting your filters or click "Add Product".')}</p>
            </div>
          )}
        </div>
      )}

      {/* ---------------- MODALS ---------------- */}
      <AddEditProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingProduct={editingProduct}
        categories={categories}
        formName={formName}
        setFormName={setFormName}
        formCategory={formCategory}
        setFormCategory={setFormCategory}
        formUnit={formUnit}
        setFormUnit={setFormUnit}
        formPurchasePrice={formPurchasePrice}
        setFormPurchasePrice={setFormPurchasePrice}
        formSellingPrice={formSellingPrice}
        setFormSellingPrice={setFormSellingPrice}
        formIsLooseItem={formIsLooseItem}
        setFormIsLooseItem={setFormIsLooseItem}
        formIsUnlimitedStock={formIsUnlimitedStock}
        setFormIsUnlimitedStock={setFormIsUnlimitedStock}
        formMrp={formMrp}
        setFormMrp={setFormMrp}
        formTaxRate={formTaxRate}
        setFormTaxRate={setFormTaxRate}
        formStock={formStock}
        setFormStock={setFormStock}
        formMinStock={formMinStock}
        setFormMinStock={setFormMinStock}
        formBarcode={formBarcode}
        setFormBarcode={setFormBarcode}
        formHsn={formHsn}
        setFormHsn={setFormHsn}

        formSize={formSize}
        setFormSize={setFormSize}
        formColor={formColor}
        setFormColor={setFormColor}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenAddCategoryModal={() => setIsAddCategoryModalOpen(true)}
        onOpenInwardSheet={switches.purchases ? () => setIsPurchaseSheetOpen(true) : undefined}
        onSubmit={handleSaveProduct}
        onDeleteProduct={handleDeleteProduct}
        formError={formError}
        variantsEnabled={variantsEnabled}
        setVariantsEnabled={setVariantsEnabled}
        variantRows={variantRows}
        setVariantRows={setVariantRows}
      />

      {variantsParent && (
        <VariantsManagerModal
          parent={variantsParent}
          onClose={() => setVariantsParent(null)}
          onEditVariant={(v) => {
            setVariantsParent(null);
            handleOpenEditModal(v);
          }}
        />
      )}

      {/* Quick Add Category Modal */}
      <Modal
        isOpen={isAddCategoryModalOpen}
        onClose={() => setIsAddCategoryModalOpen(false)}
        title={tr('Add New Category')}
        description={tr('Create a product category to organize your catalog.')}
      >
        <form onSubmit={handleCreateCategory} className="space-y-3.5">
          <Input
            label={tr('Category Name *')}
            placeholder={tr('e.g. Edible Oils, Dairy, Spices')}
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            required
            autoFocus
          />
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsAddCategoryModalOpen(false)}>
              {tr('Cancel')}
            </Button>
            <Button type="submit" className="font-black bg-slate-900 text-white">
              {tr('Create Category')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScanned}
      />

      {/* Excel Inventory Importer Modal */}
      <ExcelInventoryImporter
        isOpen={isExcelImporterOpen}
        onClose={() => setIsExcelImporterOpen(false)}
        businessId={business?.id || 'biz_default'}
      />

      {/* Purchase Inward Sheet */}
      <PurchaseInwardOptionsSheet
        isOpen={isPurchaseSheetOpen}
        onClose={() => setIsPurchaseSheetOpen(false)}
        businessId={business?.id || 'biz_default'}
        existingProducts={allProducts}
        onManualInwardClick={() => {
          setIsPurchaseSheetOpen(false);
          handleOpenAddModal();
        }}
      />

      {/* 1-Click Barcode Print Modal */}
      <QuickBarcodePrintModal
        isOpen={isBarcodePrintOpen}
        onClose={() => setIsBarcodePrintOpen(false)}
        product={barcodePrintProduct}
        storeName={business?.name}
      />
    </div>
  );
}
