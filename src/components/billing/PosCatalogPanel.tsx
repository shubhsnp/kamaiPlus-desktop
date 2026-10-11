'use client';

import React from 'react';
import { playBeepSound } from '@/lib/voice/speechParser';
import { VirtuosoGrid } from 'react-virtuoso';
import { Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PosProductCard } from '@/components/billing/PosProductCard';
import { PosScanModeButton, PosScanPanel } from '@/components/billing/PosScanPanel';
import { PosCategoryTabs } from '@/components/billing/PosCategoryTabs';
import { tr } from '@/lib/i18n/core';
import { useFeatureSwitches } from '@/lib/features/featureSwitches';
import { countsStockAtCounter } from '@/lib/billing/stockRule';
import type { PosLayout } from '@/lib/billing/posLayout';
import type { CartItem, Category, Product } from '@/types';

export interface PosCatalogPanelProps {
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  selectedCategory: string;
  setSelectedCategory: React.Dispatch<React.SetStateAction<string>>;
  posLayout: PosLayout;
  setPosLayout: (next: PosLayout, persist?: boolean | undefined) => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
  highlightedIndex: number;
  showBillingToast: (message: string, type?: "success" | "info" | "error") => void;
  cart: CartItem[];
  isSeedingProducts: boolean;
  handleLoadSampleProducts: () => Promise<void>;
  categories: Category[];
  totalProductCount: number;
  categoryCounts: Record<string, number>;
  variantInfo: Record<string, { count: number; minPricePaise: number; }>;
  products: any[];
  getAvailableStockForProduct: (product: Product) => number;
  addToCart: (product: Product, quantityToAdd?: number) => void;
  focusProductSearch: () => number;
  totalItemCount: number;
  grandTotalPaise: number;
  listVisible: boolean;
  onCustomItem?: () => void;
}

/**
 * The item side of the counter (v4.104.0, K-D23 — moved out of app/billing/page.tsx unchanged):
 * search box, scan mode, categories and the product grid (or the scan panel in scan mode).
 */
export function PosCatalogPanel(props: PosCatalogPanelProps) {
  const {
    searchQuery, setSearchQuery, selectedCategory, setSelectedCategory, posLayout, setPosLayout,
    searchInputRef, highlightedIndex, showBillingToast, cart, isSeedingProducts, handleLoadSampleProducts,
    categories, totalProductCount, categoryCounts, variantInfo, products, getAvailableStockForProduct,
    addToCart, focusProductSearch, totalItemCount, grandTotalPaise, listVisible, onCustomItem,
  } = props;
  // Stock counting off (e.g. a restaurant): no stock badge, never "Out of stock" (v4.119.0, AU-30).
  const stockOn = useFeatureSwitches().stock_counting;
  return (
    <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full min-h-0 space-y-3">
      {/* Search & Actions Bar */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="relative flex-1">
          <Input
            ref={searchInputRef}
            placeholder={tr('Search products by name, barcode or category... [/]')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            autoFocus
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 pointer-events-none">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-500 font-mono text-[10px] font-bold">/</kbd>
          </div>
        </div>
        <PosScanModeButton
          active={posLayout.scanMode}
          onToggle={() => {
            setPosLayout({ ...posLayout, scanMode: !posLayout.scanMode });
            focusProductSearch();
          }}
        />
      </div>

      {!posLayout.scanMode && (
        <PosCategoryTabs categories={categories} categoryCounts={categoryCounts} selectedCategory={selectedCategory} onSelect={setSelectedCategory} totalProductCount={totalProductCount} onCustomItem={onCustomItem} />
      )}
      {!listVisible && (
        <PosScanPanel cart={cart} itemCount={totalItemCount} grandTotalPaise={grandTotalPaise} />
      )}

      {listVisible && (
        <>
          {/* Responsive Products Grid */}
          <div className="flex-1 min-h-0" style={{ height: '100%' }} data-pos-product-grid>
            {products.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 border border-dashed border-slate-300 rounded-2xl bg-white p-6 space-y-2.5">
                <div className="font-bold text-slate-800 text-sm">
                  {totalProductCount === 0 ? tr('No products in store catalog') : tr('No items match your search')}
                </div>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  {totalProductCount === 0
                    ? tr('Your inventory is currently empty. Click below to load pre-configured starter items.')
                    : tr('Try clearing your search query or selecting "All Items".')}
                </p>
                {totalProductCount === 0 && (
                  <Button
                    type="button"
                    onClick={handleLoadSampleProducts}
                    disabled={isSeedingProducts}
                    size="sm"
                    className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs gap-1.5 shadow-xs cursor-pointer border-none mt-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isSeedingProducts ? tr('Loading Default Items...') : tr('✨ Load Default Products')}</span>
                  </Button>
                )}
              </div>
            ) : (
              <VirtuosoGrid
                data={products}
                totalCount={products.length}
                listClassName="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 pr-1 content-start"
                itemClassName="w-full"
                itemContent={(idx, p) => {
                  const inCartQuantity = cart.find((i) => i.product_id === p.id)?.quantity || 0;
                  const availableStock = getAvailableStockForProduct(p);
                  const stockNum = Number(p.current_stock ?? 0);
                  const variants = p.has_variants ? variantInfo[p.id] || { count: 0, minPricePaise: p.selling_price } : undefined;
                  // A variant parent's stock lives in its sizes / colours; the picker shows those.
                  const counted = !variants && countsStockAtCounter(p, stockOn);
                  const isOutOfStock = counted && (stockNum <= 0 || availableStock <= 0);
                  const isLowStock = counted && !isOutOfStock && availableStock <= (p.min_stock_level || 5);
                  const isHighlighted = highlightedIndex === idx;

                  return (
                    <PosProductCard
                      key={p.id}
                      p={p}
                      idx={idx}
                      inCartQuantity={inCartQuantity}
                      availableStock={availableStock}
                      stockNum={stockNum}
                      isOutOfStock={isOutOfStock}
                      isLowStock={isLowStock}
                      isHighlighted={isHighlighted}
                      variants={variants}
                      showStock={stockOn}
                      onAdd={(prod) => {
                        if (isOutOfStock) {
                          playBeepSound('alert');
                          showBillingToast(tr('Out of Stock: "{name}" has 0 stock remaining.', { name: prod.name }), 'error');
                          return;
                        }
                        addToCart(prod, 1);
                      }}
                    />
                  );
                }}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
