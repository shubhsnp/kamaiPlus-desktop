import React from 'react';
import { showAlert } from '@/lib/ui/dialogs';
import { db } from '@/lib/db';
import { Product, CartItem } from '@/types';
import { playBeepSound } from '@/lib/voice/speechParser';
import { quickRestockProduct } from '@/lib/inventory/quickRestock';
import { unitPriceFor } from '@/lib/billing/priceMode';
import { allowsFractionalQty, roundQty } from '@/lib/billing/unitQuantity';
import { isFeatureOn } from '@/lib/features/featureSwitches';
import { countsStockAtCounter } from '@/lib/billing/stockRule';
import { tr } from '@/lib/i18n/core';
import type { BillTab } from '@/lib/billing/billTabs';
import type { PriceMode } from '@/lib/billing/priceMode';
import type { Business } from '@/types';

export interface CreateCartActionsDeps {
  showBillingToast: (message: string, type?: "success" | "info" | "error") => void;
  tabs: BillTab[];
  cart: CartItem[];
  priceModeRef: React.MutableRefObject<PriceMode>;
  setCart: (action: CartItem[] | ((prev: CartItem[]) => CartItem[])) => void;
  setEditingCartItem: React.Dispatch<React.SetStateAction<CartItem | null>>;
  editingCartItem: CartItem | null;
  setEditItemQty: React.Dispatch<React.SetStateAction<string>>;
  editItemQty: string;
  setEditItemPrice: React.Dispatch<React.SetStateAction<string>>;
  editItemPrice: string;
  setEditItemDiscount: React.Dispatch<React.SetStateAction<string>>;
  editItemDiscount: string;
  setEditItemDiscountType: React.Dispatch<React.SetStateAction<"flat" | "percentage">>;
  editItemDiscountType: "flat" | "percentage";
  business: Business | undefined;
  products: any[];
  setVariantPick: React.Dispatch<React.SetStateAction<{ parent: Product; qty: number; } | null>>;
}

/**
 * Bill lines on the counter (v4.104.0, K-D23 — moved out of app/billing/page.tsx unchanged): stock
 * kept for every open bill, adding an item (price mode, whole / part units, stock checks), quantity
 * +/−, remove, the line edit window, and quick restock from the counter.
 */
export function createCartActions(deps: CreateCartActionsDeps) {
  const {
    showBillingToast, tabs, cart, priceModeRef, setCart, setEditingCartItem,
    editingCartItem, setEditItemQty, editItemQty, setEditItemPrice, editItemPrice, setEditItemDiscount,
    editItemDiscount, setEditItemDiscountType, editItemDiscountType, business, products, setVariantPick,
  } = deps;
  // Stock reservation across ALL open bill tabs (so other parallel bills don't oversell or display ghost stock)
  const getTotalCartQuantityForProduct = (productId: string, productName?: string) => {
    return tabs.reduce((total, tab) => {
      const tabQty = tab.cart.reduce((sum, item) => {
        const matchesId = item.product_id === productId;
        const matchesName = Boolean(productName && item.product_name.toLowerCase() === productName.toLowerCase());
        return (matchesId || matchesName) ? sum + item.quantity : sum;
      }, 0);
      return total + tabQty;
    }, 0);
  };

  const getCartQuantityForProduct = (productId: string, productName?: string) =>
    cart.reduce((sum, item) => {
      const matchesId = item.product_id === productId;
      const matchesName = Boolean(productName && item.product_name.toLowerCase() === productName.toLowerCase());
      return (matchesId || matchesName) ? sum + item.quantity : sum;
    }, 0);

  // Whether GST is added on top of prices (Exclusive) vs included in prices (Inclusive)
  const isBusinessGstExclusive = business?.gst_pricing_mode === 'exclusive';

  const calculateItemTax = (lineTotal: number, taxRate: number, isProductInclusive?: boolean) => {
    if (!taxRate || taxRate <= 0 || lineTotal <= 0) return 0;
    const isExclusive = isProductInclusive !== undefined ? !isProductInclusive : isBusinessGstExclusive;
    return isExclusive
      ? Math.round((lineTotal * taxRate) / 100)
      : Math.round(lineTotal - lineTotal / (1 + taxRate / 100));
  };

  // A cart line at a new quantity, totals worked out again (the same rule as adding an item).
  const retotalLine = (line: CartItem, quantity: number): CartItem => {
    const lineTotal = Math.max(0, Math.round(quantity * line.unit_price) - (line.discount_amount || 0));
    return { ...line, quantity, total_amount: lineTotal, tax_amount: calculateItemTax(lineTotal, line.tax_rate || 0, line.is_tax_inclusive) };
  };

  const getAvailableStockForProduct = (product: Product) => {
    if (!countsStockAtCounter(product, isFeatureOn('stock_counting'))) return 999999;
    const stock = Number(product.current_stock ?? 0);
    const reservedQty = getTotalCartQuantityForProduct(product.id, product.name);
    return Math.max(0, stock - reservedQty);
  };

  // Instant POS Quick Restock and Add to Cart
  const handleRestockAndAddToCart = async (product: Product, restockQty: number = 10, billQty: number = 1) => {
    try {
      addToCart(await quickRestockProduct(product, restockQty, business?.id), billQty);
    } catch (err) {
      console.error('Failed to quick restock from POS:', err);
      showAlert(tr('Failed to restock item. Please check inventory.'));
    }
  };

  // Cart operations
  const addToCart = (product: Product, quantityToAdd: number = 1) => {
    if (product.is_active === false) return;

    // A parent with sizes / colours is never sold itself: ask which variant.
    // Every add path (grid, search Enter, scanner) comes through here.
    if (product.has_variants) {
      setVariantPick({ parent: product, qty: quantityToAdd });
      return;
    }

    // Out-of-Stock and Maximum Stock Enforcement — only when the shop counts stock (v4.119.0, AU-30)
    if (countsStockAtCounter(product, isFeatureOn('stock_counting'))) {
      const currentStock = Number(product.current_stock ?? 0);
      if (currentStock <= 0) {
        playBeepSound('alert');
        showBillingToast(tr('Out of Stock: "{name}" has 0 stock remaining.', { name: product.name }), 'error');
        return;
      }

      const currentInCart = getCartQuantityForProduct(product.id, product.name);
      if (currentInCart + quantityToAdd > currentStock) {
        playBeepSound('alert');
        showBillingToast(tr('Insufficient Stock: Only {currentStock} {v2} available for "{name}".', { currentStock: currentStock, v2: product.unit || 'units', name: product.name }), 'error');
        return;
      }
    }

    // No price yet (v4.87.0): it goes in the cart and the price box opens at once.
    const needsPrice = !product.has_variants && !(unitPriceFor(product, 'retail') > 0) && !cart.some((line) => line.product_id === product.id);
    if (needsPrice) {
      window.setTimeout(() => {
        showBillingToast(tr('"{name}" has no price yet — enter it.', { name: product.name }), 'info');
        handleOpenEditItem({ product_id: product.id, product_name: product.name, quantity: quantityToAdd, unit: product.unit, unit_price: 0, discount_amount: 0, tax_rate: product.tax_rate || 0, tax_amount: 0, total_amount: 0, is_tax_inclusive: product.is_tax_inclusive } as CartItem);
      }, 0);
    }
    playBeepSound('success');
    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      const allowedQty = quantityToAdd;

      if (allowedQty <= 0) {
        return prev;
      }

      if (existing) {
        // Loose packs add decimals (0.25 + 0.5 kg): keep 3 places, never 0.7500000001.
        const newQty = Math.round((existing.quantity + allowedQty) * 1000) / 1000;
        // Keep a rate the cashier edited on this line; adding more must not reset it.
        const price = existing.unit_price;
        const lineTotal = Math.max(0, Math.round(newQty * price) - (existing.discount_amount || 0));
        const taxRate = existing.tax_rate || 0;
        const taxAmt = calculateItemTax(lineTotal, taxRate, product.is_tax_inclusive);
        return prev.map((item) =>
          item.product_id === product.id
            ? { 
                ...item, 
                quantity: newQty, 
                unit_price: price, 
                total_amount: lineTotal, 
                tax_amount: taxAmt,
                is_tax_inclusive: product.is_tax_inclusive ?? !isBusinessGstExclusive,
              }
            : item
        );
      } else {
        // The bill's price: wholesale when the bill is wholesale and the item has one (v4.87.0).
        const price = unitPriceFor(product, isFeatureOn('wholesale_price') ? priceModeRef.current : 'retail');
        const lineTotal = Math.round(price * allowedQty);
        const taxRate = product.tax_rate || 0;
        const taxAmt = calculateItemTax(lineTotal, taxRate, product.is_tax_inclusive);
        return [
          ...prev,
          {
            product_id: product.id,
            product_name: product.name,
            hsn_code: product.hsn_code,
            barcode: product.barcode,
            quantity: allowedQty,
            unit: product.unit,
            unit_price: price,
            mrp: product.mrp,
            discount_amount: 0,
            tax_rate: taxRate,
            tax_amount: taxAmt,
            total_amount: lineTotal,
            is_tax_inclusive: product.is_tax_inclusive ?? !isBusinessGstExclusive,
            // Buying rate frozen on the bill, so later price edits never rewrite past profit.
            cost_price: product.purchase_price > 0 ? product.purchase_price : undefined,

            size: product.size,
            color: product.color,
            imei_serial: product.imei_serial,
            warranty_period_months: product.warranty_period_months,
          },
        ];
      }
    });
  };

  const updateQuantity = async (productId: string, delta: number) => {
    let product = products.find((p) => p.id === productId);
    if (!product) {
      product = await db.products.get(productId);
    }
    if (!product) return;

    if (delta > 0 && countsStockAtCounter(product, isFeatureOn('stock_counting'))) {
      const currentStock = Number(product.current_stock ?? 0);
      const currentInCart = getCartQuantityForProduct(productId, product.name);
      if (currentInCart + delta > currentStock) {
        playBeepSound('alert');
        showBillingToast(tr('Max stock reached ({currentStock} {v2}) for "{name}".', { currentStock: currentStock, v2: product.unit || 'units', name: product.name }), 'error');
        return;
      }
    }

    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product_id === productId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            const price = item.unit_price; // the line's own (possibly edited) rate
            const lineTotal = Math.max(0, Math.round(newQty * price) - (item.discount_amount || 0));
            const taxRate = item.tax_rate || 0;
            const taxAmt = calculateItemTax(lineTotal, taxRate, item.is_tax_inclusive ?? product.is_tax_inclusive);
            return { 
              ...item, 
              quantity: newQty, 
              unit_price: price, 
              total_amount: lineTotal, 
              tax_amount: taxAmt 
            };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product_id !== productId));
  };

  const handleOpenEditItem = (item: CartItem) => {
    setEditingCartItem(item);
    setEditItemQty(item.quantity.toString());
    setEditItemPrice((item.unit_price / 100).toString());
    setEditItemDiscount(((item.discount_amount || 0) / 100).toString());
    setEditItemDiscountType('flat');
  };

  const handleSaveEditItem = () => {
    if (!editingCartItem) return;

    // 6 decimals: 7 pcs of a dozen (7/12) still gives the exact paise (lib/billing/unitQuantity.ts).
    const qty = roundQty(parseFloat(editItemQty));
    const unitPricePaise = Math.round((parseFloat(editItemPrice) || 0) * 100);

    if (isNaN(qty) || qty <= 0 || isNaN(unitPricePaise) || unitPricePaise < 0) {
      showAlert(tr('Please enter valid numeric values.'));
      return;
    }

    const rawTotal = Math.round(qty * unitPricePaise);
    let discountPaise = 0;
    const discountVal = parseFloat(editItemDiscount) || 0;
    if (editItemDiscountType === 'percentage') {
      const pct = Math.min(100, Math.max(0, discountVal));
      discountPaise = Math.round((rawTotal * pct) / 100);
    } else {
      discountPaise = Math.min(rawTotal, Math.round(Math.max(0, discountVal) * 100));
    }

    const product = products.find((p) => p.id === editingCartItem.product_id);
    // A piece / pair / set / packet cannot be split; a box, dozen, kg… can (v4.78.0).
    if (!Number.isInteger(qty) && !allowsFractionalQty(editingCartItem.unit, product?.allow_decimal)) {
      showAlert(tr('{name} is sold in whole {unit} only — it cannot be split.', { name: editingCartItem.product_name, unit: editingCartItem.unit || 'piece' }));
      return;
    }
    if (product && countsStockAtCounter(product, isFeatureOn('stock_counting')) && qty > product.current_stock) {
      showAlert(tr('Entered quantity ({qty}) exceeds available stock ({current_stock}).', { qty: qty, current_stock: product.current_stock }));
      return;
    }

    const lineTotal = Math.max(0, rawTotal - discountPaise);
    const taxRate = editingCartItem.tax_rate || 0;
    const taxAmt = calculateItemTax(lineTotal, taxRate, editingCartItem.is_tax_inclusive);

    setCart((prev) =>
      prev.map((item) =>
        item.product_id === editingCartItem.product_id
          ? {
              ...item,
              quantity: qty,
              unit_price: unitPricePaise,
              discount_amount: discountPaise,
              total_amount: lineTotal,
              tax_amount: taxAmt,
            }
          : item
      )
    );

    setEditingCartItem(null);
  };

  return { getTotalCartQuantityForProduct, getCartQuantityForProduct, isBusinessGstExclusive, calculateItemTax, retotalLine, getAvailableStockForProduct, handleRestockAndAddToCart, addToCart, updateQuantity, removeFromCart, handleOpenEditItem, handleSaveEditItem };
}
