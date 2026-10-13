'use client';

import { useState, useMemo, useEffect } from 'react';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { useDebounce } from 'use-debounce';
import { useTranslation } from '@/lib/i18n';
import { Product, ProductUnit } from '@/types';
import { Package } from 'lucide-react';

// Modular Sub-components
import { ProductHeaderActions } from '@/components/products/ProductHeaderActions';
import { ProductMetricsRibbon } from '@/components/products/ProductMetricsRibbon';
import { ProductFilterToolbar } from '@/components/products/ProductFilterToolbar';
import { ProductCard } from '@/components/products/ProductCard';
import { ProductTableView } from '@/components/products/ProductTableView';
import { DuplicateItemsReview } from '@/components/products/DuplicateItemsReview';
import { createProductActions } from '@/components/products/productActions';
import { ProductPageDialogs } from '@/components/products/ProductPageDialogs';
import { VariantRow } from '@/components/products/VariantMatrixEditor';
import { useFeatureSwitches } from '@/lib/features/featureSwitches';
import { isVariantChild, tracksOwnStock } from '@/lib/products/variants';
import { tr } from '@/lib/i18n/core';
import { makeProductQuery, productSearchScore } from '@/lib/search/productSearch';
import { matchesProductDetails } from '@/lib/products/detailSearch';


// Lazy-load heavy sheets & modals

export default function ProductsPage() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPurchaseSheetOpen, setIsPurchaseSheetOpen] = useState(false);
  const [isExcelImporterOpen, setIsExcelImporterOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Desktop Switcher: Dense Excel Table vs Cards Grid (default 'table')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [isBarcodePrintOpen, setIsBarcodePrintOpen] = useState(false);
  const [isFastInwardOpen, setIsFastInwardOpen] = useState(false);
  const [barcodePrintProduct, setBarcodePrintProduct] = useState<Product | null>(null);
  // "Save & print label": copies for the 1-click label window (a new counted item: its stock).
  const [barcodePrintCopies, setBarcodePrintCopies] = useState<number | undefined>(undefined);

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
  // v4.93.0: a new item starts as Piece (it was Packet — wrong for most items).
  const [formUnit, setFormUnit] = useState<ProductUnit>('piece');
  const [formPurchasePrice, setFormPurchasePrice] = useState('');
  const [formSellingPrice, setFormSellingPrice] = useState('');
  const [formIsLooseItem, setFormIsLooseItem] = useState(false);
  const [formIsUnlimitedStock, setFormIsUnlimitedStock] = useState(false);
  const [formMrp, setFormMrp] = useState('');
  const [formWholesalePrice, setFormWholesalePrice] = useState('');
  const [formTaxRate, setFormTaxRate] = useState<number>(0);
  const [formStock, setFormStock] = useState('');
  const [formMinStock, setFormMinStock] = useState('5');
  const [formBarcode, setFormBarcode] = useState('');
  const [formHsn, setFormHsn] = useState('');
  const [formIsFavorite, setFormIsFavorite] = useState(false);

  // Dynamic Store Specific Attributes

  const [formSize, setFormSize] = useState('');
  const [formBatch, setFormBatch] = useState('');
  const [formExpiry, setFormExpiry] = useState('');
  const [formFoodType, setFormFoodType] = useState('');
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
    const productQuery = makeProductQuery(debouncedSearch);
    return allProducts.filter((p) => {
      // 0. Variants show under their parent; they appear on their own only in a search
      if (!debouncedSearch.trim() && isVariantChild(p)) return false;

      // 1. Search Query
      if (debouncedSearch.trim()) {
        // Name or barcode, typed in English or हिंदी / मराठी (lib/search/productSearch.ts),
        // or HSN / size / colour as the box promises (lib/products/detailSearch.ts, v4.81.0).
        if (productSearchScore(p, productQuery) < 0 && !matchesProductDetails(p, debouncedSearch)) return false;
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
    return allProducts.filter((p) => tracksOwnStock(p) && !p.is_unlimited_stock && Number(p.current_stock ?? 0) < 99990 && p.current_stock <= (p.min_stock_level || 5)).length;
  }, [allProducts]);

  const totalStockValuePaise = useMemo(() => {
    return allProducts.reduce((acc, p) => {
      if (!tracksOwnStock(p) || p.is_unlimited_stock || Number(p.current_stock ?? 0) >= 99990) return acc;
      const cost = p.purchase_price || p.selling_price || 0;
      return acc + (cost * Math.max(0, p.current_stock));
    }, 0);
  }, [allProducts]);

  // Handlers
  const { handle1ClickBarcodePrint, handleOpenAddModal, handleOpenEditModal, handleSaveProduct, handleDeleteProduct, handleToggleFavorite, handleQuickStockChange, handleQuickPriceChange, handleBarcodeScanned, handleCreateCategory } = createProductActions({
    setSelectedCategory, setIsModalOpen, setEditingProduct, editingProduct, setIsBarcodePrintOpen, setBarcodePrintProduct,
    setBarcodePrintCopies, setIsAddCategoryModalOpen, newCatName, setNewCatName, setFormName, formName,
    setFormCategory, formCategory, setFormUnit, formUnit, setFormPurchasePrice, formPurchasePrice,
    setFormSellingPrice, formSellingPrice, setFormIsLooseItem, formIsLooseItem, setFormIsUnlimitedStock, formIsUnlimitedStock,
    setFormMrp, formMrp, setFormWholesalePrice, formWholesalePrice, setFormTaxRate, formTaxRate,
    setFormStock, formStock, setFormMinStock, formMinStock, setFormBarcode, formBarcode,
    setFormHsn, formHsn, setFormIsFavorite, formIsFavorite, setFormSize, formSize, setFormBatch, formBatch, setFormExpiry, formExpiry, setFormFoodType, formFoodType,
    setFormColor, formColor, setFormError, setVariantsEnabled, variantsEnabled, setVariantRows,
    variantRows, allProducts, categories, business, switches,
  });

  return (
    <div className="space-y-3.5 pb-20 sm:pb-8 animate-in fade-in duration-150">
      {/* 1. Header Actions */}
      <ProductHeaderActions
        totalProducts={allProducts.length}
        onOpenAddModal={handleOpenAddModal}
        onOpenFastInward={switches.product_barcode && switches.stock_counting ? () => setIsFastInwardOpen(true) : undefined}
        onOpenExcelImporter={() => setIsExcelImporterOpen(true)}
        onOpenInwardSheet={switches.purchases ? () => setIsPurchaseSheetOpen(true) : undefined}
      />

      {/* Same item twice (phone + PC, or an Excel list imported twice) — v4.103.0, K-D28 */}
      <DuplicateItemsReview products={allProducts} />

      {/* 2. Metrics Ribbon */}
      <ProductMetricsRibbon
        totalProducts={allProducts.length}
        lowStockCount={lowStockCount}
        totalStockValuePaise={totalStockValuePaise}
        totalCategories={categories.length}
        showStock={switches.stock_counting}
      />

      {/* 3. Filter & Category Toolbar */}
      <ProductFilterToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        showLowStockOnly={showLowStockOnly}
        onToggleLowStock={switches.stock_counting ? setShowLowStockOnly : undefined}
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
            on1ClickBarcodePrint={switches.barcode_studio ? handle1ClickBarcodePrint : undefined}
            onOpenVariants={setVariantsParent}
            showStock={switches.stock_counting}
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
              showStock={switches.stock_counting}
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
      <ProductPageDialogs
        {...{
          isModalOpen, setIsModalOpen, setIsPurchaseSheetOpen, isPurchaseSheetOpen, isExcelImporterOpen, setIsExcelImporterOpen,
          editingProduct, isBarcodePrintOpen, setIsBarcodePrintOpen, isFastInwardOpen, setIsFastInwardOpen, barcodePrintProduct,
          barcodePrintCopies, setIsAddCategoryModalOpen, isAddCategoryModalOpen, newCatName, setNewCatName, formName,
          setFormName, formCategory, setFormCategory, formUnit, setFormUnit, formPurchasePrice,
          setFormPurchasePrice, formSellingPrice, setFormSellingPrice, formIsLooseItem, setFormIsLooseItem, formIsUnlimitedStock,
          setFormIsUnlimitedStock, formMrp, setFormMrp, formWholesalePrice, setFormWholesalePrice, formTaxRate,
          setFormTaxRate, formStock, setFormStock, formMinStock, setFormMinStock, formBarcode,
          setFormBarcode, formHsn, setFormHsn, formSize, setFormSize, formBatch, setFormBatch, formExpiry, setFormExpiry, formFoodType, setFormFoodType, formColor,
          setFormColor, formError, variantsEnabled, setVariantsEnabled, variantRows, setVariantRows,
          variantsParent, setVariantsParent, allProducts, categories, business, switches,
          handleBarcodeScanned, handleSaveProduct, handleDeleteProduct, handleOpenEditModal, handleCreateCategory, handleOpenAddModal,
        }}
      />
    </div>
  );
}
