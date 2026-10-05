'use client';
import React, { useState, useEffect } from 'react';
import { db, ensureStarterBusinessIfEmpty, seedBusinessStarterData } from '@/lib/db';
import { useTranslation } from '@/lib/i18n';
import { Product, CartItem } from '@/types';
import { allocateBillDiscount, computeBillTotals, isLineTaxInclusive } from '@/lib/sales/saleMath';
import { playBeepSound } from '@/lib/voice/speechParser';
import { useBusiness } from '@/components/layout/BusinessProvider';

import { modeForCustomer, PriceMode, repriceCart } from '@/lib/billing/priceMode';
import { searchEnterAction } from '@/lib/billing/scanInput';
import { SILENT_PRINT_EVENT, SILENT_PRINT_KEY } from '@/lib/hardware/printerWatch';
import { Sale } from '@/types';


import { PosSplitLayout, usePosLayout } from '@/components/billing/PosSplitLayout';
import { PosCheckoutPanel, PosCheckoutPanelProps } from '@/components/billing/PosCheckoutPanel';
import { createSaleActions } from '@/components/billing/posSaleActions';
import { usePosKeyboard } from '@/components/billing/usePosKeyboard';
import { createCartActions } from '@/components/billing/posCartActions';
import { PosCatalogPanel } from '@/components/billing/PosCatalogPanel';
import { usePosScanning } from '@/components/billing/usePosScanning';
import { PosMobileCart } from '@/components/billing/PosMobileCart';
import { PosCounterDialogs } from '@/components/billing/PosCounterDialogs';
import { usePosCatalogData } from '@/components/billing/usePosCatalogData';
import { usePosBillTabs } from '@/components/billing/usePosBillTabs';
import { usePosUpiQr } from '@/components/billing/usePosUpiQr';
import { showProductList } from '@/lib/billing/posLayout';
import { BillingToast, BillingToastData } from '@/components/billing/PosDialogs';
import { tabsAfterUndo } from '@/lib/billing/billTabs';
import { isFeatureOn, useFeatureSwitches } from '@/lib/features/featureSwitches';
import { useBackgroundBillPrint } from '@/components/billing/BillPrintQueue';
import { tr } from '@/lib/i18n/core';

export default function BillingPage() {
  const { language, t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [posLayout, setPosLayout] = usePosLayout();
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  // True while a sale is being saved (see handleCompleteSale).
  const completingSaleRef = React.useRef(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [billingToast, setBillingToast] = useState<BillingToastData | null>(null);

  // One timer for the toast: an older toast's timer must not hide a newer message early.
  const toastTimerRef = React.useRef<number | undefined>(undefined);
  const showBillingToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setBillingToast({ message, type });
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setBillingToast(null), 4000);
  };

  // Bills printed in the background (v4.74.0); one that did not print waits in a red bar.
  const billPrint = useBackgroundBillPrint({
    printed: (sale) => showBillingToast(tr('⚡ Silent Printed Invoice #{invoiceNumber}', { invoiceNumber: sale.invoice_number }), 'success'),
    failed: (_sale, error) => showBillingToast(tr('Bill saved, but it did not print: {error}', { error }), 'error'),
  });

  // Silent Instant Thermal Print State
  const [silentPrint, setSilentPrint] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('kamai_silent_print') === 'true';
    }
    return false;
  });

  const setAutoPrint = (next: boolean) => {
    setSilentPrint(next);
    if (typeof window !== 'undefined') localStorage.setItem('kamai_silent_print', String(next));
    showBillingToast(next ? tr('⚡ Silent Print: Active (Direct Thermal)') : tr('Silent Print: Off (Preview Dialog)'), 'info');
  };
  const [isBillPrinterOpen, setIsBillPrinterOpen] = useState(false);
  // The Printers window (status bar / Home) can flip "print straight away" while Billing is open.
  useEffect(() => {
    const onSilentPrint = () => setSilentPrint(localStorage.getItem(SILENT_PRINT_KEY) === 'true');
    window.addEventListener(SILENT_PRINT_EVENT, onSilentPrint);
    return () => window.removeEventListener(SILENT_PRINT_EVENT, onSilentPrint);
  }, []);

  const { tabs, setTabs, activeTabId, setActiveTabId, activeTab, cart, selectedCustomerId, paymentMethod, amountReceivedInput, splitCash, splitUpi, splitCard, splitCredit, billDiscountType, billDiscountValue, priceMode, priceModeRef, activeTabIdRef, updateActiveTab, setCart, customerDraft, setCustomerDraft, setPaymentMethod, setAmountReceivedInput, setSplitCash, setSplitUpi, setSplitCard, setSplitCredit, setBillDiscountType, setBillDiscountValue, handleCreateNewTab, handleHoldActiveTab, discardedBill, setDiscardedBill, keepForUndo, handleClearCart, billScrollRef, handleCloseTab } = usePosBillTabs();

  // Mobile Bottom Drawer State
  const [isMobileCartOpen, setIsMobileCartOpen] = useState<boolean>(false);

  // Item Editing State
  const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null);
  const [editItemQty, setEditItemQty] = useState<string>('');
  const [editItemPrice, setEditItemPrice] = useState<string>('');
  const [editItemDiscount, setEditItemDiscount] = useState<string>('0');
  const [editItemDiscountType, setEditItemDiscountType] = useState<'flat' | 'percentage'>('flat');
  
  // Modals
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [activeSaleForInvoice, setActiveSaleForInvoice] = useState<Sale | null>(null);
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
  const [scannedUnknownBarcode, setScannedUnknownBarcode] = useState<string | null>(null);
  const [quickAddPrice, setQuickAddPrice] = useState('');
  const [quickAddName, setQuickAddName] = useState('');
  const [completedSaleDetails, setCompletedSaleDetails] = useState<any>(null);



  // Live Dynamic UPI QR Code States
  const [posQrDataUrl, setPosQrDataUrl] = useState<string>('');
  const [isEnlargeQrModalOpen, setIsEnlargeQrModalOpen] = useState<boolean>(false);
  const [selectedUpiIndex, setSelectedUpiIndex] = useState<number>(0);

  const [isSeedingProducts, setIsSeedingProducts] = useState(false);

  useEffect(() => {
    const ensureInitialData = async () => {
      try {
        await ensureStarterBusinessIfEmpty();
      } catch (err) {
        console.warn('Billing initial data check warning:', err);
      }
    };
    ensureInitialData();
  }, []);

  const handleLoadSampleProducts = async () => {
    setIsSeedingProducts(true);
    try {
      const biz = business || (await ensureStarterBusinessIfEmpty());
      await seedBusinessStarterData(biz.id);
      showBillingToast(tr('✅ Loaded default catalog products!'), 'success');
    } catch (err: any) {
      showBillingToast(tr('Failed to load sample products: {message}', { message: err?.message }), 'error');
    } finally {
      setIsSeedingProducts(false);
    }
  };

  const business = useBusiness();
  // Settings → Features → Khata off (v4.81.0): no Credit / Udhar on the counter — a bill left
  // on Credit (or with an udhar part in Split) from before goes back to a paid mode.
  const khataOn = useFeatureSwitches().khata;
  const paymentKeysOn = useFeatureSwitches().payment_keys;
  const wholesaleOn = useFeatureSwitches().wholesale_price;
  useEffect(() => {
    if (khataOn) return;
    if (paymentMethod === 'credit') setPaymentMethod('cash');
    if ((parseFloat(splitCredit || '0') || 0) > 0) setSplitCredit('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [khataOn, paymentMethod, splitCredit]);
  const { categories, customers, totalProductCount, categoryCounts, variantInfo, products, variantPick, setVariantPick } = usePosCatalogData({
    searchQuery, selectedCategory, business,
  });

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  const { getTotalCartQuantityForProduct, calculateItemTax, retotalLine, getAvailableStockForProduct, addToCart, updateQuantity, removeFromCart, handleOpenEditItem, handleSaveEditItem } = createCartActions({
    showBillingToast, tabs, cart, priceModeRef, setCart, setEditingCartItem,
    editingCartItem, setEditItemQty, editItemQty, setEditItemPrice, editItemPrice, setEditItemDiscount,
    editItemDiscount, setEditItemDiscountType, editItemDiscountType, business, products, setVariantPick,
  });

  const { handleBarcodeScanned, focusProductSearch, handleSaveQuickAddItem } = usePosScanning({
    setSearchQuery, searchInputRef, isBillPrinterOpen, isInvoiceModalOpen, setIsInvoiceModalOpen, setActiveSaleForInvoice,
    setIsQuickAddModalOpen, setScannedUnknownBarcode, scannedUnknownBarcode, setQuickAddPrice, quickAddPrice, setQuickAddName,
    quickAddName, business, categories, variantPick, addToCart,
  });

  // These three read values set up further down (customers, calculateItemTax, focusProductSearch),
  // so they stay here, after them; usePosBillTabs keeps the rest of the bill tabs (v4.104.0, K-D23).
  // Picking a saved customer (or going back to walk-in) replaces whatever was typed.
  const setSelectedCustomerId = (id: string) => {
    updateActiveTab((tab) => ({ ...tab, selectedCustomerId: id, customerName: '', customerPhone: '' }));
    // A customer marked "wholesale" turns the bill to wholesale prices (v4.87.0).
    if (isFeatureOn('wholesale_price') && priceModeRef.current !== 'wholesale' && modeForCustomer(customers.find((c) => c.id === id)) === 'wholesale') {
      void setPriceMode('wholesale');
    }
  };

  // Retail ↔ wholesale: the cart's items move to that price; a rate typed by hand stays.
  const setPriceMode = async (mode: PriceMode) => {
    const ids = Array.from(new Set(cart.map((line) => line.product_id)));
    const found = (await db.products.bulkGet(ids)).filter((p): p is Product => Boolean(p));
    updateActiveTab((tab) => ({ ...tab, priceMode: mode, cart: repriceCart(tab.cart, found, tab.priceMode || 'retail', mode, calculateItemTax) }));
  };

  const handleUndoDiscard = () => {
    if (!discardedBill) return;
    const next = tabsAfterUndo(tabs, discardedBill, `tab_${Date.now()}`);
    setTabs(next.tabs);
    setActiveTabId(next.activeTabId);
    setDiscardedBill(null);
    focusProductSearch();
  };

  // Calculations
  // Items = bill lines, as on the bill and in "Sale completed"; units = the quantities added up
  // (v4.99.0, K-D39 — a 7-line bill said "Cart Items (8)", and 1.5 kg of sugar made "1.5 items").
  const totalItemCount = cart.length;
  const totalUnits = Math.round(cart.reduce((acc, item) => acc + item.quantity, 0) * 1000) / 1000;

  // Bill-level discount: a % or flat amount off the lines' own amounts (MRP for
  // tax-inclusive items, base rate for tax-exclusive ones), like a line discount.
  const linesAmountPaise = cart.reduce((acc, item) => acc + Math.max(0, item.total_amount), 0);
  let billDiscountPaise = 0;
  if (billDiscountValue && parseFloat(billDiscountValue) > 0) {
    if (billDiscountType === 'percentage') {
      const pct = Math.min(100, Math.max(0, parseFloat(billDiscountValue) || 0));
      billDiscountPaise = Math.round((linesAmountPaise * pct) / 100);
    } else {
      const flat = Math.max(0, parseFloat(billDiscountValue) || 0);
      billDiscountPaise = Math.min(linesAmountPaise, Math.round(flat * 100));
    }
  }

  // The bill discount is spread over the lines and GST recomputed on what is
  // actually charged, so the totals shown, the saved bill and the GST report agree.
  const billLines = allocateBillDiscount(cart, billDiscountPaise);
  const billTotals = computeBillTotals(billLines);
  const itemsValuePaise = billLines.reduce((acc, item) => acc + Math.round(item.quantity * item.unit_price), 0);
  const discountTotalPaise = billTotals.discountTotal;
  const subtotalPaise = billTotals.subtotal;
  const taxTotalPaise = billTotals.taxTotal;
  const grandTotalPaise = billTotals.grandTotal;
  const addedGstPaise = billLines.filter((i) => !isLineTaxInclusive(i)).reduce((acc, i) => acc + (i.tax_amount || 0), 0);
  const includedGstPaise = taxTotalPaise - addedGstPaise;

  usePosUpiQr({
    paymentMethod, splitUpi, setPosQrDataUrl, selectedUpiIndex, business, grandTotalPaise,
  });

  // No automatic "payment received → complete sale" on desktop. The Android app reads
  // UPI notifications; a PC cannot, and the only thing that ever fed this path here was
  // a "Test Pay Received" button that saved the bill as UPI-paid with no money received.

  const handleCompleteSale = async () => {
    if (cart.length === 0) return;
    // An item without a price (imported without one, v4.87.0) is never billed at ₹0: ask for it.
    const unpriced = cart.find((line) => !(line.unit_price > 0));
    if (unpriced) {
      playBeepSound('alert');
      showBillingToast(tr('Enter the price of "{name}" — it has no price yet.', { name: unpriced.product_name }), 'error');
      handleOpenEditItem(unpriced);
      return;
    }
    // A double Enter / double click must never save the same cart twice
    // (two bills, stock deducted twice, same invoice number).
    if (completingSaleRef.current) return;
    completingSaleRef.current = true;
    try {
      await completeSale();
    } finally {
      completingSaleRef.current = false;
    }
  };

  const { completeSale, handleSaveEstimate } = createSaleActions({
    searchInputRef, completingSaleRef, showBillingToast, billPrint, silentPrint, tabs,
    setTabs, activeTabId, setActiveTabId, cart, selectedCustomerId, paymentMethod,
    amountReceivedInput, splitCash, splitUpi, splitCard, splitCredit, priceMode,
    activeTabIdRef, customerDraft, setIsMobileCartOpen, setIsInvoiceModalOpen, setActiveSaleForInvoice, setCompletedSaleDetails,
    business, selectedCustomer, retotalLine, handleOpenEditItem, focusProductSearch, billLines,
    discountTotalPaise, subtotalPaise, taxTotalPaise, grandTotalPaise,
  });

  // The highlighted (or first) search result goes into the bill.
  const addHighlightedResult = () => {
    const targetProd = (highlightedIndex >= 0 && products[highlightedIndex]) || (products.length > 0 ? products[0] : null);
    if (!targetProd) return;
    const stockNum = Number(targetProd.current_stock ?? 0);
    const isOutOfStock = !targetProd.has_variants && !targetProd.is_unlimited_stock && stockNum <= 0;
    if (targetProd.has_variants) {
      // Opens the size / colour picker; the chosen variant is added from there.
      addToCart(targetProd, 1);
      setSearchQuery('');
      setHighlightedIndex(-1);
    } else if (isOutOfStock) {
      playBeepSound('alert');
      showBillingToast(tr('Out of Stock: "{name}"', { name: targetProd.name }), 'error');
    } else {
      addToCart(targetProd, 1);
      playBeepSound('success');
      showBillingToast(tr('Added: {name}', { name: targetProd.name }), 'success');
      setSearchQuery('');
      setHighlightedIndex(-1);
    }
  };

  // Enter in the product search box (v4.72.0 — see lib/billing/scanInput.ts): an empty box
  // finishes the bill, a scanned code adds its item (or offers to add a new one), typed words
  // add the highlighted result. The box's own text is read, so a code is never cut short.
  const handleSearchEnter = async () => {
    const text = (searchInputRef.current?.value || '').trim();
    let exact: Product | undefined;
    if (text) {
      try {
        exact = await db.products.where('barcode').equals(text).first();
      } catch {}
    }
    const action = searchEnterAction(text, cart.length, Boolean(exact), products.length);
    // Under "Sale completed" only a scanned code counts (it closes the window and starts the
    // next bill); an Enter on its own never finishes the bill waiting underneath.
    if (isInvoiceModalOpen && action !== 'add-exact' && action !== 'unknown-code') return;
    if (action === 'complete-sale') return handleCompleteSale();
    if (action === 'add-exact' || action === 'unknown-code') {
      setSearchQuery('');
      setHighlightedIndex(-1);
      return handleBarcodeScanned(text);
    }
    if (action === 'add-highlighted') addHighlightedResult();
  };

  // A window on top of the counter (sale completed, item edit, bill printer, big QR,
  // unknown barcode) owns the keyboard: Enter / F10 pressed
  // there must never complete the bill waiting underneath.
  const counterCovered = isInvoiceModalOpen || Boolean(editingCartItem) || isQuickAddModalOpen || isEnlargeQrModalOpen || isBillPrinterOpen;
  // Only "Sale completed" is open: a scan typed into the search box behind it still counts.
  const onlySaleWindowOpen = isInvoiceModalOpen && !(Boolean(editingCartItem) || isQuickAddModalOpen || isEnlargeQrModalOpen || isBillPrinterOpen);

  usePosKeyboard({
    searchQuery, setSearchQuery, searchInputRef, setHighlightedIndex, highlightedIndex, showBillingToast,
    tabs, setActiveTabId, activeTabId, cart, setPaymentMethod, handleCreateNewTab,
    products, variantPick, handleCompleteSale, handleSearchEnter, counterCovered, onlySaleWindowOpen,
  });

  // Reusable Checkout Panel Component for Desktop side-panel and Mobile Bottom Drawer
  const posCheckoutPanelProps: PosCheckoutPanelProps = {
    searchInputRef, billPrint, silentPrint, setAutoPrint, setIsBillPrinterOpen, tabs,
    activeTabId, setActiveTabId, activeTab, cart, selectedCustomerId, paymentMethod,
    amountReceivedInput, splitCash, splitUpi, splitCard, splitCredit, billDiscountType,
    billDiscountValue, priceMode, setSelectedCustomerId, setPriceMode, customerDraft, setCustomerDraft,
    setPaymentMethod, setAmountReceivedInput, setSplitCash, setSplitUpi, setSplitCard, setSplitCredit,
    setBillDiscountType, setBillDiscountValue, handleCreateNewTab, handleHoldActiveTab, discardedBill, setDiscardedBill,
    handleUndoDiscard, handleClearCart, billScrollRef, handleCloseTab, setIsInvoiceModalOpen, setActiveSaleForInvoice,
    posQrDataUrl, setIsEnlargeQrModalOpen, business, khataOn, paymentKeysOn, wholesaleOn,
    customers, selectedCustomer, updateQuantity, removeFromCart, handleOpenEditItem, totalItemCount,
    totalUnits, billDiscountPaise, itemsValuePaise, discountTotalPaise, grandTotalPaise, addedGstPaise,
    includedGstPaise, handleCompleteSale, handleSaveEstimate,
  };

  // v4.92.0 — Scan mode hides the product list while the gun types (lib/billing/posLayout.ts).
  const listVisible = showProductList(posLayout, searchQuery);

  return (
    <div className="relative pb-40 lg:pb-2 h-full flex flex-col">
      <PosSplitLayout
        layout={posLayout}
        onLayoutChange={setPosLayout}
        onDone={focusProductSearch}
        catalog={
          <PosCatalogPanel
            {...{
              searchQuery, setSearchQuery, selectedCategory, setSelectedCategory, posLayout, setPosLayout,
              searchInputRef, highlightedIndex, showBillingToast, cart, isSeedingProducts, handleLoadSampleProducts,
              categories, totalProductCount, categoryCounts, variantInfo, products, getAvailableStockForProduct,
              addToCart, focusProductSearch, totalItemCount, grandTotalPaise, listVisible,
            }}
          />
        }
        checkout={
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full min-h-0 overflow-hidden">
            <PosCheckoutPanel {...posCheckoutPanelProps} />
          </div>
        }
      />

      {/* Mobile Floating Bottom Sticky Cart Button (Elevated cleanly above bottom nav bar) */}
      <PosMobileCart
        {...{
          tabs, activeTab, cart, setIsMobileCartOpen, isMobileCartOpen, totalItemCount,
          grandTotalPaise, posCheckoutPanelProps,
        }}
      />

      {/* Variant picker: which size / colour of a parent product */}
      <PosCounterDialogs
        {...{
          silentPrint, setAutoPrint, isBillPrinterOpen, setIsBillPrinterOpen, paymentMethod, splitUpi,
          customerDraft, editingCartItem, setEditingCartItem, editItemQty, setEditItemQty, editItemPrice,
          setEditItemPrice, editItemDiscount, setEditItemDiscount, editItemDiscountType, setEditItemDiscountType, isInvoiceModalOpen,
          setIsInvoiceModalOpen, activeSaleForInvoice, setActiveSaleForInvoice, isQuickAddModalOpen, setIsQuickAddModalOpen, scannedUnknownBarcode,
          quickAddPrice, setQuickAddPrice, quickAddName, setQuickAddName, completedSaleDetails, posQrDataUrl,
          isEnlargeQrModalOpen, setIsEnlargeQrModalOpen, business, variantPick, setVariantPick, selectedCustomer,
          getTotalCartQuantityForProduct, addToCart, handleSaveEditItem, focusProductSearch, handleSaveQuickAddItem, grandTotalPaise,
        }}
      />

      {/* Floating In-App Toast Notification */}
      <BillingToast toast={billingToast} />
    </div>
  );
}
