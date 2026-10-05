'use client';
import { showAlert } from '@/lib/ui/dialogs';

import React, { useState, useEffect } from 'react';
import { db, ensureStarterBusinessIfEmpty, seedBusinessStarterData } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from '@/lib/i18n';
import { Product, CartItem, PaymentMethod, ProductUnit, LedgerTransaction } from '@/types';
import { formatINR, parseRupeesToPaise, generateUPILink, cn } from '@/lib/utils';
import { allocateBillDiscount, computeBillTotals, isLineTaxInclusive } from '@/lib/sales/saleMath';
import QRCode from 'qrcode';
import { playBeepSound } from '@/lib/voice/speechParser';
import { getNextUniqueInvoiceNumber, commitNextInvoiceNumber, formatInvoiceNumber, warmInvoiceNumberCache } from '@/lib/invoices/invoiceNumberService';
import { useDebounce } from 'use-debounce';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { VirtuosoGrid } from 'react-virtuoso';
import { 
  Search, 
  Receipt, 
  Plus, 
  QrCode, 
  Printer, 
  Share2, 
  CheckCircle2, 
  User, 
  Star,
  FileText,
  Sparkles,
  ArrowRight,
  IndianRupee,
  CreditCard,
  Banknote,
  BookOpen,
  Mic,
  Barcode,
  Globe,
  X,
  Settings2,
  ShoppingCart,
  ChevronUp,
  ChevronDown,
  Bluetooth,
  Usb,
  PauseCircle,
  PlayCircle,
  Lock
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import dynamic from 'next/dynamic';
import { useHardwareBarcodeScanner } from '@/lib/hardware/barcodeScannerListener';

import { focusPosCustomerName, PosCustomerRow } from '@/components/billing/PosCustomerRow';
import { PosPriceModeToggle } from '@/components/billing/PosPriceModeToggle';
import { quickRestockProduct } from '@/lib/inventory/quickRestock';
import { modeForCustomer, PriceMode, repriceCart, unitPriceFor } from '@/lib/billing/priceMode';
import { searchEnterAction } from '@/lib/billing/scanInput';
import { parseWeighedBarcode, weighedQuantity } from '@/lib/barcode/weighedBarcode';
import { allowsFractionalQty, roundQty } from '@/lib/billing/unitQuantity';
import { searchProducts } from '@/lib/search/productSearch';
import { BillPrinterSetup } from '@/components/billing/BillPrinterSetup';
import { SILENT_PRINT_EVENT, SILENT_PRINT_KEY } from '@/lib/hardware/printerWatch';
import { buildBillCustomer, CustomerDraft, isDraftEmpty, resolveBillCustomer } from '@/lib/billing/billCustomer';
import { Sale } from '@/types';

import { cloudMerge, cloudSyncSoon, cloudTrackInvoice, prewarmCloud } from '@/lib/firebase/lazyCloud';
import { getDesktopApi } from '@/lib/desktop/desktopBridge';
import { resolveInvoiceConfig } from '@/lib/invoices/themeDefaults';
import { getPrintSettings, printerForFormat } from '@/lib/hardware/printSettings';
import { newId } from '@/lib/ids';

// Lazy-load non-critical heavy modals
const InvoiceModal = dynamic(
  () => import('@/components/invoices/InvoiceModal').then((m) => m.InvoiceModal),
  { ssr: false }
);
import { PosItemEditModal } from '@/components/billing/PosItemEditModal';
import { VariantPickerModal } from '@/components/billing/VariantPickerModal';
import { PosProductCard } from '@/components/billing/PosProductCard';
import { PosSplitLayout, usePosLayout } from '@/components/billing/PosSplitLayout';
import { PosScanModeButton, PosScanPanel } from '@/components/billing/PosScanPanel';
import { PosCategoryTabs } from '@/components/billing/PosCategoryTabs';
import { PosCartLines } from '@/components/billing/PosCartLines';
import { PosUndoBar } from '@/components/billing/PosUndoBar';
import { PosBillDiscount } from '@/components/billing/PosBillDiscount';
import { showProductList } from '@/lib/billing/posLayout';
import { scrollIntoContainer } from '@/lib/billing/cartFocus';
import { generalCategoryId } from '@/lib/products/defaultCategory';
import { BillingToast, BillingToastData, FullscreenUpiQrModal, QuickAddScannedProductModal } from '@/components/billing/PosDialogs';
import { CashTenderPanel, SplitPaymentPanel, UpiQrCard } from '@/components/billing/PosPaymentPanels';
import { BillTab, DiscardedBill, getInitialTabs, makeEmptyTab, nextBillTabId, tabsAfterClosing, tabsAfterSale, tabsAfterUndo, tabsForNewBill, TABS_STORAGE_KEY } from '@/lib/billing/billTabs';
import { isFeatureOn, useFeatureSwitches } from '@/lib/features/featureSwitches';
import { PrintFailureBar, useBackgroundBillPrint, warmBillPrinting } from '@/components/billing/BillPrintQueue';
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

  // Multi-Bill Tabs State
  const [tabs, setTabs] = useState<BillTab[]>(() => getInitialTabs().tabs);
  const [activeTabId, setActiveTabId] = useState<string>(() => getInitialTabs().activeTabId);

  // Sync active tab state helpers
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const cart = activeTab.cart;
  const selectedCustomerId = activeTab.selectedCustomerId;
  const paymentMethod = activeTab.paymentMethod;
  const amountReceivedInput = activeTab.amountReceivedInput;
  const splitCash = activeTab.splitCash;
  const splitUpi = activeTab.splitUpi;
  const splitCard = activeTab.splitCard;
  const splitCredit = activeTab.splitCredit;
  const billDiscountType = activeTab.billDiscountType || 'flat';
  const billDiscountValue = activeTab.billDiscountValue || '';
  // Retail / wholesale prices for this bill (v4.87.0, lib/billing/priceMode.ts). The ref lets the
  // scan / keyboard handlers that were set up earlier read the bill's current mode.
  const priceMode: PriceMode = activeTab.priceMode || 'retail';
  const priceModeRef = React.useRef<PriceMode>(priceMode);
  priceModeRef.current = priceMode;
  // Persist tabs in localStorage
  useEffect(() => {
    try {
      localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(tabs));
    } catch {}
  }, [tabs]);

  // The bill the counter is on right now — read when an item is added, so a scan never
  // lands in a bill that was just completed (v4.74.0: such items used to vanish).
  const activeTabIdRef = React.useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

  const updateActiveTab = (updater: (prevTab: BillTab) => BillTab) => {
    const id = activeTabIdRef.current;
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? updater(t) : t))
    );
  };

  const setCart = (action: CartItem[] | ((prev: CartItem[]) => CartItem[])) => {
    updateActiveTab((tab) => ({
      ...tab,
      cart: typeof action === 'function' ? action(tab.cart) : action,
    }));
  };

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

  const customerDraft: CustomerDraft = { name: activeTab.customerName || '', phone: activeTab.customerPhone || '' };
  const setCustomerDraft = (draft: CustomerDraft) => {
    updateActiveTab((tab) => ({ ...tab, customerName: draft.name, customerPhone: draft.phone }));
  };

  const setPaymentMethod = (method: PaymentMethod) => {
    updateActiveTab((tab) => ({ ...tab, paymentMethod: method }));
  };

  const setAmountReceivedInput = (val: string) => {
    updateActiveTab((tab) => ({ ...tab, amountReceivedInput: val }));
  };

  const setSplitCash = (val: string | ((p: string) => string)) => {
    updateActiveTab((tab) => ({ ...tab, splitCash: typeof val === 'function' ? val(tab.splitCash) : val }));
  };

  const setSplitUpi = (val: string | ((p: string) => string)) => {
    updateActiveTab((tab) => ({ ...tab, splitUpi: typeof val === 'function' ? val(tab.splitUpi) : val }));
  };

  const setSplitCard = (val: string | ((p: string) => string)) => {
    updateActiveTab((tab) => ({ ...tab, splitCard: typeof val === 'function' ? val(tab.splitCard) : val }));
  };

  const setSplitCredit = (val: string | ((p: string) => string)) => {
    updateActiveTab((tab) => ({ ...tab, splitCredit: typeof val === 'function' ? val(tab.splitCredit) : val }));
  };

  const setBillDiscountType = (val: 'flat' | 'percentage') => {
    updateActiveTab((tab) => ({ ...tab, billDiscountType: val }));
  };

  const setBillDiscountValue = (val: string) => {
    updateActiveTab((tab) => ({ ...tab, billDiscountValue: val }));
  };

  // Tab Actions: Create New Tab, Hold Tab, Close Tab
  // F1 from any other page opens Billing as /billing?new=1: start on a fresh bill (v4.78.0).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('new') !== '1') return;
    const next = tabsForNewBill(tabs, activeTabId, `tab_${Date.now()}`);
    setTabs(next.tabs);
    setActiveTabId(next.activeTabId);
    window.history.replaceState(null, '', window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateNewTab = () => {
    const nextNum = (tabs.reduce((max, t) => Math.max(max, t.tabNumber), 0) || tabs.length) + 1;
    const newTabId = `tab_${Date.now()}`;
    const newTab: BillTab = makeEmptyTab(newTabId, nextNum);
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTabId);
  };

  const handleHoldActiveTab = () => {
    updateActiveTab((tab) => ({
      ...tab,
      isHeld: true,
      heldAt: new Date().toISOString(),
    }));

    // Find if another unheld tab exists, otherwise open a fresh one
    const otherUnheld = tabs.find((t) => t.id !== activeTabId && !t.isHeld);
    if (otherUnheld) {
      setActiveTabId(otherUnheld.id);
    } else {
      handleCreateNewTab();
    }
  };

  // ✕ / Clear keep the bill a few seconds for Undo (v4.93.0, components/billing/PosUndoBar.tsx).
  const [discardedBill, setDiscardedBill] = useState<DiscardedBill | null>(null);
  const keepForUndo = (tab: BillTab | undefined, kind: DiscardedBill['kind']) => {
    if (tab && tab.cart.length > 0) setDiscardedBill({ tab, index: tabs.findIndex((t) => t.id === tab.id), kind });
  };
  const handleUndoDiscard = () => {
    if (!discardedBill) return;
    const next = tabsAfterUndo(tabs, discardedBill, `tab_${Date.now()}`);
    setTabs(next.tabs);
    setActiveTabId(next.activeTabId);
    setDiscardedBill(null);
    focusProductSearch();
  };
  const handleClearCart = () => {
    keepForUndo(activeTab, 'cleared');
    setCart([]);
  };

  // UPI / Split / Credit picked (click or F8 / F9): their details (QR, amounts, khata preview)
  // sit below the bill lines — bring them into view.
  const billScrollRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (paymentMethod === 'cash') return;
    const box = billScrollRef.current;
    scrollIntoContainer(box, box?.querySelector<HTMLElement>('[data-pos-pay-details]') ?? null);
  }, [paymentMethod, activeTabId]);

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    keepForUndo(tabs.find((t) => t.id === tabId), 'closed');
    if (tabs.length === 1) {
      // Reset single tab
      setTabs([makeEmptyTab('tab_1', 1)]);
      setActiveTabId('tab_1');
      return;
    }

    if (activeTabId === tabId) {
      const next = tabsAfterClosing(tabs, tabId, `tab_${Date.now()}`);
      setTabs(next.tabs);
      setActiveTabId(next.activeTabId);
    } else {
      setTabs(tabs.filter((t) => t.id !== tabId));
    }
  };

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
  const categories = useLiveQuery(async () => db.categories.toArray()) || [];
  const customers = useLiveQuery(async () => db.customers.toArray()) || [];

  const totalProductCount = useLiveQuery(() => db.products.count()) || 0;

  // One indexed pass over the category column instead of one count() query per
  // category (a shop with 30 categories used to fire 30 serial IndexedDB reads
  // every time the counter screen opened). Category counts and each variant parent's
  // "from ₹X" are worked out when the NUMBER of items changes — not after every write
  // (v4.97.0): a sale only changes stock, and as live queries they re-read the whole
  // catalogue after every bill line (16 full passes for an 8-line bill, ~2 s on 5,000 items).
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [variantInfo, setVariantInfo] = useState<Record<string, { count: number; minPricePaise: number }>>({});
  useEffect(() => {
    let alive = true;
    void (async () => {
      const counts: Record<string, number> = {};
      await db.products.orderBy('category_id').eachKey((key) => {
        const id = String(key);
        counts[id] = (counts[id] || 0) + 1;
      });
      const children = await db.products.filter((p) => Boolean(p.parent_id) && p.is_active !== false).toArray();
      const map: Record<string, { count: number; minPricePaise: number }> = {};
      for (const c of children) {
        const cur = map[c.parent_id!];
        map[c.parent_id!] = cur
          ? { count: cur.count + 1, minPricePaise: Math.min(cur.minPricePaise, c.selling_price) }
          : { count: 1, minPricePaise: c.selling_price };
      }
      if (alive) {
        setCategoryCounts(counts);
        setVariantInfo(map);
      }
    })();
    return () => {
      alive = false;
    };
  }, [totalProductCount]);

  const [debouncedSearch] = useDebounce(searchQuery, 300);
  
  const [products, setProducts] = useState<any[]>([]);

  // Variant picker (products with sizes / colours); each parent's "from ₹X" is worked out above.
  const [variantPick, setVariantPick] = useState<{ parent: Product; qty: number } | null>(null);

  // Pull the cloud-sync bundle in while the cashier is still picking items, so
  // the first bill of the day does not wait for it.
  useEffect(() => {
    prewarmCloud();
    // Same idea for invoice numbering: scan the invoice-number index once now, so
    // the first "Complete Sale" of the session uses the cache.
    const warm = () => { void warmInvoiceNumberCache(); warmBillPrinting(business); };
    const ric = (window as any).requestIdleCallback as ((cb: () => void, opts?: { timeout: number }) => number) | undefined;
    if (ric) ric(warm, { timeout: 3000 });
    else window.setTimeout(warm, 1000);
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function fetchProducts() {
      try {
        // Variants live under their parent (picker on tap); a search finds them directly.
        const searching = Boolean(debouncedSearch.trim());
        let prods = db.products.filter(p => p.is_active !== false && (searching || !p.parent_id));

        // Filter by Category
        if (selectedCategory !== 'all') {
          prods = prods.filter(p => p.category_id === selectedCategory);
        }

        // No limit needed now that we are using Virtualization (Phase 1)
        const all = await prods.toArray();
        // Name, barcode or category — typed in English or हिंदी / मराठी (lib/search/productSearch.ts),
        // best matches first.
        const data = searching ? searchProducts(all, debouncedSearch, { category: true }) : all;
        if (isMounted) {
          setProducts(data);
        }
      } catch (err) {
        console.error('Error fetching POS products:', err);
      }
    }
    fetchProducts();
    return () => { isMounted = false; };
  }, [debouncedSearch, selectedCategory]);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

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
    if (product.is_unlimited_stock) return 999999;
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

    // Out-of-Stock and Maximum Stock Enforcement
    if (!product.is_unlimited_stock) {
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

    if (delta > 0 && !product.is_unlimited_stock) {
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
    if (product && !product.is_unlimited_stock && qty > product.current_stock) {
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

  // Barcode scanned handler (gun, camera, rapid scan, or a code typed into the search box)
  const handleBarcodeScanned = async (barcode: string) => {
    const clean = barcode.trim();
    if (!clean) return;
    // The next customer's first scan closes the "Sale completed" window (v4.72.0).
    if (isInvoiceModalOpen) {
      setIsInvoiceModalOpen(false);
      setActiveSaleForInvoice(null);
    }
    // A gun types into whatever has focus: never leave the code behind in the search box.
    if (searchInputRef.current && searchInputRef.current.value.includes(clean)) setSearchQuery('');

    try {
      const product = await db.products.where('barcode').equals(clean).first();
      if (product) {
        addToCart(product, 1);
        focusProductSearch();
        return;
      }
      // A loose pack weighed in the shop: its code carries the item and the weight (v4.77.0).
      const pack = parseWeighedBarcode(clean);
      const packItem = pack ? await db.products.where('barcode').equals(pack.itemBarcode).first() : undefined;
      const packQty = pack && packItem ? weighedQuantity(packItem.unit, pack.amount) : null;
      if (packItem && packQty) {
        addToCart(packItem, packQty);
        focusProductSearch();
        return;
      }
    } catch (err) {
      console.warn('Barcode scan check error:', err);
    }

    // Step C: Auto-Learning Fallback -> Trigger Quick Add Modal for Shopkeeper
    setScannedUnknownBarcode(clean);
    setQuickAddName('');
    setQuickAddPrice('');
    setIsQuickAddModalOpen(true);
  };

  // Back to the product search box, ready for the next scan.
  const focusProductSearch = () => window.setTimeout(() => searchInputRef.current?.focus(), 0);
  // The search box reads a whole scanned code on Enter itself (handleSearchEnter), so the
  // key-timing listener stands aside while it has focus.
  // The search box reads scans itself; the WhatsApp window (v4.79.0) is for typing a number / message.
  const searchBoxHasFocus = React.useCallback(
    () => document.activeElement === searchInputRef.current || Boolean(document.querySelector('[data-whatsapp-composer]')),
    []
  );

  useHardwareBarcodeScanner({
    onScan: handleBarcodeScanned,
    // Off while the variant picker is open: scanner digits would pick variants 1–9.
    // On while "Sale completed" is open: the next scan closes it and starts the next bill.
    enabled: !variantPick && !isBillPrinterOpen,
    ignore: searchBoxHasFocus,
  });

  const handleSaveQuickAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddName.trim() || !quickAddPrice) return;

    const businessId = business?.id || 'biz_default';
    const pricePaise = Math.round(parseFloat(quickAddPrice) * 100);
    const prodId = `prod_learn_${Date.now()}`;
    const now = new Date().toISOString();

    const newProd: Product = {
      id: prodId,
      business_id: businessId,
      name: quickAddName.trim(),
      category_id: generalCategoryId(categories),
      category_name: 'General',
      unit: 'packet',
      purchase_price: 0, // unknown until the shopkeeper enters it — never guessed
      selling_price: pricePaise,
      mrp: pricePaise,
      tax_rate: 0,
      is_tax_inclusive: true,
      current_stock: 50,
      min_stock_level: 5,
      barcode: scannedUnknownBarcode || undefined,
      is_favorite: false,
      is_active: true,
      created_at: now,
      updated_at: now,
      sync_status: 'synced',
    };

    // Permanently memorize in local Dexie.js for future scans
    await db.products.put(newProd);
    addToCart(newProd, 1);

    setIsQuickAddModalOpen(false);
    setQuickAddPrice('');
    setQuickAddName('');
    setScannedUnknownBarcode(null);
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

  // Real-Time Dynamic Amount UPI QR Generation (e.g. ₹848.00 auto-fills in GPay / PhonePe / Paytm)
  useEffect(() => {
    if (!business) return;

    const availableUpis = business.upi_ids && business.upi_ids.length > 0
      ? business.upi_ids
      : business.upi_id
      ? [{ id: 'def', label: tr('Primary Counter'), upi_id: business.upi_id, is_default: true }]
      : [];

    const activeUpi = availableUpis[selectedUpiIndex] || availableUpis[0];

    if (activeUpi?.upi_id && grandTotalPaise > 0) {
      const nextNum = business.next_invoice_number || 1;
      const invPrefix = business.invoice_prefix || 'INV-';
      const invCode = `${invPrefix}${String(nextNum).padStart(3, '0')}`;

      // Calculate effective payable amount for UPI (handles split payment as well)
      let payablePaise = grandTotalPaise;
      if (paymentMethod === 'split') {
        const splitUpiPaise = splitUpi ? Math.round(parseFloat(splitUpi) * 100) : 0;
        payablePaise = splitUpiPaise > 0 ? splitUpiPaise : grandTotalPaise;
      }

      const upiUrl = generateUPILink(
        activeUpi.upi_id,
        business.name,
        payablePaise,
        invCode
      );

      QRCode.toDataURL(upiUrl, {
        width: 320,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
      })
        .then(setPosQrDataUrl)
        .catch(() => setPosQrDataUrl(''));
    } else {
      setPosQrDataUrl('');
    }
  }, [business, grandTotalPaise, paymentMethod, splitUpi, selectedUpiIndex]);

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

  const completeSale = async () => {
    // What this bill is at the moment Enter was pressed — scans after this are the next customer's.
    const soldTabId = activeTabId;
    const soldCart = cart;
    // Resolve target customer reliably from state or Dexie
    let targetCustomer = selectedCustomer;
    if (!targetCustomer && selectedCustomerId) {
      targetCustomer = await db.customers.get(selectedCustomerId);
    }

    // Nobody picked from the list: the name / mobile typed on the counter row is a saved
    // customer (same mobile / only one with that name) or someone new, saved with the bill.
    const typed = targetCustomer || isDraftEmpty(customerDraft) ? null : resolveBillCustomer(await db.customers.toArray(), customerDraft);
    if (typed?.kind === 'error') {
      playBeepSound('alert');
      showBillingToast(typed.message, 'error');
      focusPosCustomerName(typed.field);
      return;
    }
    if (typed?.kind === 'existing') targetCustomer = typed.customer;
    const newCustomer = typed?.kind === 'new' ? typed : null;
    const hasCustomer = Boolean(targetCustomer || newCustomer);

    // MANDATORY CUSTOMER VALIDATION FOR CREDIT / UDHAR PAYMENT MODE
    const isCreditMode = paymentMethod === 'credit' || (paymentMethod === 'split' && parseFloat(splitCredit || '0') > 0);
    // Khata switched off (Settings → Features): no udhar at all — read now, not from the render.
    const udharAllowed = isFeatureOn('khata');
    if (isCreditMode && !udharAllowed) {
      playBeepSound('alert');
      showBillingToast(tr('Khata (Udhar) is switched off in Settings → Features. Take the full payment.'), 'error');
      return;
    }
    if (isCreditMode && !hasCustomer) {
      playBeepSound('alert');
      showBillingToast(tr('Customer name is mandatory for Credit (Udhar) sale. Type the customer name or mobile number.'), 'error');
      focusPosCustomerName();
      return;
    }

    // Cash "received" is typed only in cash mode; in UPI / card / credit a value left
    // over from cash mode is not on screen and must not change what is recorded.
    const typedCashPaise = paymentMethod === 'cash' && amountReceivedInput
      ? Math.round((parseFloat(amountReceivedInput) || 0) * 100)
      : null;
    if (typedCashPaise !== null && typedCashPaise < grandTotalPaise && (!hasCustomer || !udharAllowed)) {
      playBeepSound('alert');
      showBillingToast(udharAllowed
        ? tr('Cash received is {v1} short. Correct the amount, or select a customer to put the rest on udhar.', { v1: formatINR(grandTotalPaise - typedCashPaise) })
        : tr('Cash received is {v1} short. Correct the amount.', { v1: formatINR(grandTotalPaise - typedCashPaise) }), 'error');
      return;
    }

    // Split: more than the bill is only possible as change from the cash part.
    if (paymentMethod === 'split') {
      const parts = [splitCash, splitUpi, splitCard, splitCredit].map((v) => (v ? Math.round((parseFloat(v) || 0) * 100) : 0));
      const excess = parts.reduce((a, b) => a + b, 0) - grandTotalPaise;
      if (excess > parts[0]) {
        playBeepSound('alert');
        showBillingToast(tr('Split amounts are {v1} more than the bill. Only the cash part can include change — please correct the split.', { v1: formatINR(excess) }), 'error');
        return;
      }
    }

    try {
      const currentBiz = business || (await ensureStarterBusinessIfEmpty());
      const businessId = currentBiz?.id || 'biz_default';

      // 0. Save the customer typed on the counter row (someone new, or a missing mobile filled in).
      const custNow = new Date().toISOString();
      if (newCustomer) {
        targetCustomer = buildBillCustomer(newId('cust'), businessId, newCustomer.name, newCustomer.phone, custNow);
        await db.customers.put(targetCustomer);
      } else if (targetCustomer && typed?.kind === 'existing' && typed.addPhone) {
        await db.customers.update(targetCustomer.id, { phone: typed.addPhone, updated_at: custNow });
        targetCustomer = { ...targetCustomer, phone: typed.addPhone };
      }

      const { invoiceNumber, nextSeq } = await getNextUniqueInvoiceNumber(businessId);
      const now = new Date().toISOString();

      const finalInvoiceNumber = invoiceNumber;

      const finalMethod: PaymentMethod = paymentMethod;
      let receivedPaise = 0;
      let balanceDuePaise = 0;
      let changeReturnedPaise = 0;
      let paymentSplitData: any = undefined;

      if (paymentMethod === 'split') {
        const cashP = splitCash ? Math.round(parseFloat(splitCash) * 100) : 0;
        const upiP = splitUpi ? Math.round(parseFloat(splitUpi) * 100) : 0;
        const cardP = splitCard ? Math.round(parseFloat(splitCard) * 100) : 0;
        const creditP = splitCredit ? Math.round(parseFloat(splitCredit) * 100) : 0;
        
        const allocatedP = cashP + upiP + cardP + creditP;
        const unassigned = Math.max(0, grandTotalPaise - allocatedP);
        // Overpaid (checked above to fit inside the cash part) = change handed back.
        const excessP = Math.max(0, allocatedP - grandTotalPaise);
        // What is not split goes on the customer's khata — or is taken as cash (no customer, or Khata off).
        const udharTarget = Boolean(targetCustomer) && udharAllowed;
        const finalCreditP = creditP + (udharTarget ? unassigned : 0);
        const finalCashP = cashP - excessP + (!udharTarget ? unassigned : 0);

        receivedPaise = finalCashP + upiP + cardP;
        balanceDuePaise = finalCreditP;
        changeReturnedPaise = excessP;
        paymentSplitData = {
          cash_amount: finalCashP,
          upi_amount: upiP,
          card_amount: cardP,
          credit_amount: finalCreditP,
        };
      } else {
        receivedPaise = typedCashPaise ?? (paymentMethod === 'credit' ? 0 : grandTotalPaise);
        const isCredit = paymentMethod === 'credit' || receivedPaise < grandTotalPaise;
        balanceDuePaise = isCredit ? Math.max(0, grandTotalPaise - receivedPaise) : 0;
        changeReturnedPaise = !isCredit && receivedPaise > grandTotalPaise ? receivedPaise - grandTotalPaise : 0;
      }

      const saleId = newId('sale');

      const newSale: Sale = {
        id: saleId,
        business_id: businessId,
        invoice_number: finalInvoiceNumber,
        customer_id: targetCustomer?.id,
        customer_name: targetCustomer?.name || 'Cash Customer',
        customer_phone: targetCustomer?.phone,
        customer_address: targetCustomer?.address,
        customer_gstin: targetCustomer?.gstin,
        items: billLines,
        subtotal: subtotalPaise,
        discount_total: discountTotalPaise,
        tax_total: taxTotalPaise,
        grand_total: grandTotalPaise,
        payment_method: finalMethod,
        payment_split: paymentSplitData,
        amount_received: receivedPaise,
        balance_due: balanceDuePaise,
        change_returned: changeReturnedPaise,
        payment_status: balanceDuePaise === 0 ? 'paid' : balanceDuePaise < grandTotalPaise ? 'partial' : 'unpaid',
        status: 'completed',
        // A wholesale bill says so (Transactions, the cloud) — v4.87.0.
        ...(isFeatureOn('wholesale_price') && priceMode === 'wholesale' ? { price_mode: 'wholesale' as const } : {}),
        created_by: 'owner',
        created_at: now,
        updated_at: now,
        sync_status: 'synced',
      };

      // 1. Save Sale in Dexie DB
      await db.sales.put(newSale);

      // Track sale creation in Firebase Analytics for Platform Owner (safe non-blocking)
      void cloudTrackInvoice({
        invoiceNumber: newSale.invoice_number,
        totalAmountPaise: newSale.grand_total,
        paymentMode: newSale.payment_method,
        itemCount: newSale.items.length,
        businessId: newSale.business_id,
        isGstBill: (newSale.tax_total || 0) > 0,
      });

      // Trigger instant background sync to Firestore for WhatsApp Bot & Cloud backup
      if (newSale.business_id) {
        void cloudSyncSoon(newSale.business_id);
      }

      // 2. Increment business invoice number counter reliably
      if (currentBiz?.id) {
        await commitNextInvoiceNumber(currentBiz.id, nextSeq);
      }

      // 3. Deduct product inventory stock — every line in ONE transaction (v4.97.0). Each separate
      // write made the counter's live queries re-read the whole catalogue: an 8-line bill on a
      // 5,000-item shop took ~2 s. One commit = one refresh, and a bill never leaves half its
      // stock deducted. Cloud copies go after the commit (never inside a Dexie transaction).
      const stockForCloud: Product[] = [];
      await db.transaction('rw', db.products, db.inventory_movements, async () => {
        for (const item of cart) {
        let prod = await db.products.get(item.product_id);
        if (!prod && item.barcode) {
          prod = await db.products.where('barcode').equals(item.barcode).first();
        }
        if (!prod && item.product_name) {
          prod = await db.products.where('name').equalsIgnoreCase(item.product_name).first();
        }

        if (prod && !prod.is_unlimited_stock) {
          const prevStock = Number(prod.current_stock ?? 0);
          const newStock = Math.max(0, prevStock - item.quantity);
          const updatedProd: Product = {
            ...prod,
            current_stock: newStock,
            updated_at: now,
          };
          // Persist using put to guarantee index rewrite and reactive LiveQuery updates
          await db.products.put(updatedProd);

          await db.inventory_movements.put({
            id: `mov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${prod.id}`,
            business_id: businessId,
            product_id: prod.id,
            product_name: prod.name,
            movement_type: 'SALE',
            quantity: item.quantity,
            previous_stock: prevStock,
            new_stock: newStock,
            reference_id: saleId,
            reason: `Sold on Invoice #${invoiceNumber}`,
            created_by: 'owner',
            created_at: now,
          });
          stockForCloud.push(updatedProd);
        }
      }
      });
      // Direct cloud sync to prevent stale overwrite from cloud background sync
      if (businessId && businessId !== 'biz_default') {
        for (const p of stockForCloud) void cloudMerge(`businesses/${businessId}/products/${p.id}`, p);
      }

      // Trigger background sync debounce for full backup
      void cloudSyncSoon(businessId);

      // 4. If Udhar / Credit, update customer balance & write ledger entry (Skip for quotations)
      if (targetCustomer && balanceDuePaise > 0) {
        const freshCust = (await db.customers.get(targetCustomer.id)) || targetCustomer;
        const updatedBalance = (freshCust.current_balance || 0) + balanceDuePaise;
        
        await db.customers.update(targetCustomer.id, {
          current_balance: updatedBalance,
          updated_at: now,
        });

        const itemsSummary = cart.map((i) => `${i.quantity}x ${i.product_name}`).join(', ');

        const ledgerTxId = newId('ledg');
        const newLedgerTx: LedgerTransaction = {
          id: ledgerTxId,
          business_id: businessId,
          party_type: 'customer',
          party_id: targetCustomer.id,
          party_name: targetCustomer.name,
          transaction_type: 'CREDIT_SALE',
          amount: balanceDuePaise,
          balance_after: updatedBalance,
          reference_id: saleId,
          notes: `Invoice #${invoiceNumber} • ${itemsSummary}`,
          created_at: now,
          sync_status: 'synced',
        };

        await db.ledger_transactions.put(newLedgerTx);

        // Direct cloud sync to Firestore for multi-device realtime Khata
        if (businessId && businessId !== 'biz_default') {
          void cloudMerge(`businesses/${businessId}/customers/${targetCustomer.id}`, {
            ...freshCust,
            current_balance: updatedBalance,
            updated_at: now,
          });
          void cloudMerge(`businesses/${businessId}/ledger_transactions/${ledgerTxId}`, newLedgerTx);
        }
      }

      // 5. The counter moves on to the next bill now — it never waits for the printer — and
      // anything scanned for the next customer while this bill was being saved goes with it.
      const newTabId = `tab_${Date.now()}`;
      const nextTabId = tabsAfterClosing(tabs, soldTabId, newTabId).activeTabId;
      setTabs((prev) => tabsAfterSale(prev, soldTabId, soldCart, newTabId, retotalLine).tabs);
      setActiveTabId(nextTabId);
      activeTabIdRef.current = nextTabId;
      setIsMobileCartOpen(false);

      // 6. "Sale completed", or straight to the bill printer in the background (BillPrintQueue).
      setActiveSaleForInvoice(newSale);
      setCompletedSaleDetails({
        invoiceNumber,
        customerName: targetCustomer?.name,
        customerPhone: targetCustomer?.phone,
        grandTotalPaise,
        balanceDuePaise,
        items: [...soldCart],
      });
      if (silentPrint && getDesktopApi() && currentBiz) {
        billPrint.print({ sale: newSale, business: currentBiz, customer: targetCustomer });
        focusProductSearch();
      } else {
        // Focus leaves the search box so the next scan reaches the scanner listener,
        // which closes this window and starts the next bill.
        searchInputRef.current?.blur();
        setIsInvoiceModalOpen(true);
      }
    } catch (saleErr) {
      console.error('Sale completion encountered an error:', saleErr);
      showAlert(tr('Encountered an unexpected error completing the sale. Please verify inventory.'));
    }
  };

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

  // Desktop POS High-Speed Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // The variant picker owns the keyboard while open — otherwise Enter on a
      // focused variant would also run "Complete sale".
      if (variantPick) return;
      const searchFocused = document.activeElement === searchInputRef.current;
      if (searchFocused && e.key === 'Enter' && (!counterCovered || onlySaleWindowOpen)) {
        e.preventDefault();
        void handleSearchEnter();
        return;
      }
      if (counterCovered) return;

      // Tab switching via Ctrl + 1..9
      if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '9') {
        const tabIdx = parseInt(e.key, 10) - 1;
        if (tabs[tabIdx]) {
          e.preventDefault();
          setActiveTabId(tabs[tabIdx].id);
          showBillingToast(tr('Switched to Bill #{tabNumber}', { tabNumber: tabs[tabIdx].tabNumber }), 'info');
          return;
        }
      }

      const target = e.target as HTMLElement;
      const isSearchActive = searchInputRef.current && (target === searchInputRef.current || document.activeElement === searchInputRef.current);
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      // Arrow navigation inside product search bar
      if (isSearchActive && products.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setHighlightedIndex((prev) => (prev < products.length - 1 ? prev + 1 : 0));
          return;
        }

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : products.length - 1));
          return;
        }

      }

      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (e.key === 'F1') {
        e.preventDefault();
        handleCreateNewTab();
        showBillingToast(tr('Created New Bill Tab [F1]'), 'info');
        return;
      }

      // F2 (v4.85.0, Rahul): the next open bill — or a new one when only one is open. Search is '/'.
      if (e.key === 'F2') {
        e.preventDefault();
        const nextId = nextBillTabId(tabs, activeTabId);
        if (!nextId) {
          handleCreateNewTab();
          showBillingToast(tr('Created New Bill Tab [F2]'), 'info');
        } else {
          setActiveTabId(nextId);
          showBillingToast(tr('Switched to Bill #{tabNumber}', { tabNumber: tabs.find((t) => t.id === nextId)?.tabNumber ?? '' }), 'info');
        }
        return;
      }

      if (e.key === '/' && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // F4 / F8 / F9 pick the payment only when Settings → Features → "Payment keys" is on (default off).
      if ((e.key === 'F4' || e.key === 'F8' || e.key === 'F9') && !isFeatureOn('payment_keys')) return;

      if (e.key === 'F4') {
        e.preventDefault();
        setPaymentMethod('cash');
        showBillingToast(tr('Selected Cash Payment [F4]'), 'info');
        return;
      }

      if (e.key === 'F8') {
        e.preventDefault();
        setPaymentMethod('upi');
        showBillingToast(tr('Selected UPI Payment [F8]'), 'info');
        return;
      }

      if (e.key === 'F9') {
        e.preventDefault();
        if (!isFeatureOn('khata')) return; // Khata off: no Credit (Udhar) key either
        setPaymentMethod('credit');
        showBillingToast(tr('Selected Credit (Udhar) [F9]'), 'info');
        return;
      }

      if (e.key === 'F10') {
        e.preventDefault();
        if (cart.length > 0) {
          handleCompleteSale();
        }
        return;
      }

      if (e.key === 'Escape') {
        if (searchQuery) {
          e.preventDefault();
          setSearchQuery('');
          setHighlightedIndex(-1);
          searchInputRef.current?.blur();
        }
        return;
      }

      if (e.key === 'Enter' && !isInput) {
        if (cart.length > 0) {
          e.preventDefault();
          handleCompleteSale();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, searchQuery, handleCompleteSale, products, highlightedIndex, tabs, variantPick, counterCovered, onlySaleWindowOpen]);

  // Reusable Checkout Panel Component for Desktop side-panel and Mobile Bottom Drawer
  const renderCheckoutPanel = () => (
    <div className="flex flex-col flex-1 min-h-0">
      {/* v4.93.0 — the bill tabs, the customer and the cart header stay put; only the bill's
          lines and the payment details below them scroll; the payment mode, grand total and
          Complete Sale are pinned at the bottom. A scan scrolls its line into view. */}
      <div className="flex-shrink-0 space-y-2 pb-2">
        {/* Multi-Bill Tab Bar */}
        <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 overflow-x-auto border border-slate-200">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const count = tab.cart.reduce((s, i) => s + i.quantity, 0);
            const cust = customers.find((c) => c.id === tab.selectedCustomerId);
            const typedName = (tab.customerName || '').trim() || (tab.customerPhone || '').trim();
            const tabTitle = cust ? cust.name.split(' ')[0] : typedName ? typedName.split(' ')[0] : tr('Bill #{tabNumber}', { tabNumber: tab.tabNumber });

            return (
              <div
                key={tab.id}
                data-bill-tab={tab.id}
                data-active-bill={isActive ? 'true' : undefined}
                onClick={() => setActiveTabId(tab.id)}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer select-none transition-all flex-shrink-0',
                  isActive
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-300'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                )}
              >
                <span>{tabTitle}</span>
                {count > 0 && (
                  <span className={cn(
                    'px-1.5 py-0.2 rounded-full text-[10px] font-extrabold',
                    isActive ? 'bg-amber-400 text-slate-950' : 'bg-slate-200 text-slate-700'
                  )}>
                    {count}
                  </span>
                )}
                {tab.isHeld && (
                  <span className="text-[10px] text-amber-600" title={tr('Bill is on hold')}>
                    ⏸️
                  </span>
                )}
                {tabs.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => handleCloseTab(tab.id, e)}
                    className="hover:text-rose-600 text-slate-400 p-0.5 rounded-full"
                    title={tr('Close this bill tab')}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Add New Tab Button */}
          <button
            type="button"
            onClick={handleCreateNewTab}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-950 hover:bg-slate-200 text-xs font-bold flex items-center gap-1 flex-shrink-0 transition-colors cursor-pointer"
            title={tr('Open New Parallel Bill Cart')}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">{tr('New')}</span>
          </button>

          {/* Silent Instant Print Quick Toggle */}
          <div className="ml-auto flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                const next = !silentPrint;
                // First time on with no bill printer chosen: pick it first (else it prints to the Windows default).
                const ps = getPrintSettings();
                if (next && !printerForFormat(ps, ps.defaultFormat)) {
                  setIsBillPrinterOpen(true);
                  return;
                }
                setAutoPrint(next);
              }}
              className={cn(
                "px-2 py-1 rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer border",
                silentPrint
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
              )}
              title={tr('Toggle Instant Silent Print (Direct Thermal Print without preview dialog)')}
            >
              <Printer className="w-3 h-3" />
              <span>{silentPrint ? tr('⚡ Silent: ON') : tr('Silent: OFF')}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsBillPrinterOpen(true)}
              className="p-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 cursor-pointer"
              title={tr('Bill printer')}
              aria-label={tr('Bill printer')}
              data-bill-printer-open
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <PrintFailureBar
          failed={billPrint.failed}
          onRetry={(job) => billPrint.print(job)}
          onOpen={(job) => {
            setActiveSaleForInvoice(job.sale);
            searchInputRef.current?.blur();
            setIsInvoiceModalOpen(true);
          }}
          onDismiss={billPrint.dismiss}
        />

        <PosUndoBar discarded={discardedBill} onUndo={handleUndoDiscard} onDismiss={() => setDiscardedBill(null)} />

        {/* Customer: one row, no pop-up — name / mobile, saved customers show underneath */}
        {selectedCustomer && (selectedCustomer.current_balance || 0) > 0 && (
          <span className="inline-flex px-2 py-0.5 rounded-full bg-rose-100 border border-rose-300 text-rose-700 text-[10.5px] font-black items-center gap-1 shadow-2xs">
            <span>{tr('⚠️ Old Khata:')}</span>
            <span className="font-mono">{formatINR(selectedCustomer.current_balance)}</span>
          </span>
        )}
        <PosCustomerRow
          customers={customers}
          selectedCustomer={selectedCustomer}
          draft={customerDraft}
          onDraftChange={setCustomerDraft}
          onSelect={setSelectedCustomerId}
        />

        {/* Credit Mode Mandatory Customer Alert Banner */}
        {paymentMethod === 'credit' && !selectedCustomerId && isDraftEmpty(customerDraft) && (
          <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-950 flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-base flex-shrink-0">⚠️</span>
              <span className="font-bold truncate">{tr('Customer Name is compulsory for Credit (Udhar)')}</span>
            </div>
            <button
              type="button"
              onClick={() => focusPosCustomerName()}
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] cursor-pointer flex-shrink-0 transition shadow-xs"
            >
              {tr('+ Add Customer')}
            </button>
          </div>
        )}

        {/* Cart Header: count, Retail / Wholesale, Hold, Clear */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
            <span>{tr('Cart Items (')}{totalItemCount})</span>
            {activeTab.isHeld && (
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                {tr('⏸️ On Hold')}
              </span>
            )}
          </span>

          <div className="flex items-center gap-2">
            {wholesaleOn && <PosPriceModeToggle compact mode={priceMode} onChange={(m) => void setPriceMode(m)} />}
            {cart.length > 0 && (
              <button
                type="button"
                onClick={handleHoldActiveTab}
                className="text-[11px] font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1 cursor-pointer transition-colors"
                title={tr('Park / Hold this bill and start a new one')}
              >
                <PauseCircle className="w-3 h-3" />
                <span>{tr('Hold Bill')}</span>
              </button>
            )}

            {cart.length > 0 && (
              <button
                type="button"
                onClick={handleClearCart}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer transition-colors"
                data-pos-clear
              >
                {tr('Clear')}
              </button>
            )}
          </div>
        </div>

        {cart.length > 0 && (
          <div className="grid grid-cols-12 text-[10px] uppercase font-extrabold tracking-wider text-slate-400 px-2.5 py-0.5 bg-slate-100/90 rounded-lg select-none">
            <span className="col-span-6">{tr('Item & Details')}</span>
            <span className="col-span-3 text-center">{tr('Qty')}</span>
            <span className="col-span-3 text-right">{tr('Total (₹)')}</span>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 -mr-1" data-pos-bill-scroll ref={billScrollRef}>
        <PosCartLines cart={cart} billId={activeTab.id} onQuantity={updateQuantity} onEdit={handleOpenEditItem} onRemove={removeFromCart} />

        <div className="space-y-3" data-pos-pay-details>
          {/* Credit Mode Live Customer Balance Insight */}
          {paymentMethod === 'credit' && selectedCustomer && (
            <div className="p-2.5 bg-amber-50/90 border border-amber-300 rounded-xl text-xs text-amber-950 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1 text-amber-900">
                  <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                  <span>{tr('Khata Credit Preview (')}{selectedCustomer.name}):</span>
                </span>
                <span className="font-mono text-[11px] text-slate-500">{tr('Udhar Sale')}</span>
              </div>
              <div className="grid grid-cols-3 gap-1 pt-1 border-t border-amber-200/80 text-center font-mono">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">{tr('Old Balance')}</span>
                  <span className="font-bold text-slate-800">
                    {formatINR(selectedCustomer.current_balance || 0)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">{tr('This Bill')}</span>
                  <span className="font-bold text-rose-600">
                    +{formatINR(grandTotalPaise)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">{tr('New Balance')}</span>
                  <span className="font-black text-rose-700">
                    ={formatINR((selectedCustomer.current_balance || 0) + grandTotalPaise)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* If Split / Multi-Mode Payment: Render Breakdown Inputs */}
          {paymentMethod === 'split' && cart.length > 0 && (
            <SplitPaymentPanel
              grandTotalPaise={grandTotalPaise}
              splitCash={splitCash} setSplitCash={setSplitCash}
              splitUpi={splitUpi} setSplitUpi={setSplitUpi}
              splitCard={splitCard} setSplitCard={setSplitCard}
              splitCredit={splitCredit} setSplitCredit={setSplitCredit}
              creditAllowed={khataOn}
            />
          )}

          {/* If Cash: Amount Received Input for Change calculation with Quick Tender Chips */}
          {paymentMethod === 'cash' && cart.length > 0 && (
            <CashTenderPanel
              grandTotalPaise={grandTotalPaise}
              amountReceivedInput={amountReceivedInput}
              setAmountReceivedInput={setAmountReceivedInput}
            />
          )}

          {/* If UPI (or Split with UPI): Real-Time Dynamic Amount QR Code Card */}
          {((paymentMethod === 'upi') || (paymentMethod === 'split' && parseFloat(splitUpi || '0') > 0)) && cart.length > 0 && (
            <UpiQrCard
              paymentMethod={paymentMethod}
              splitUpi={splitUpi}
              grandTotalPaise={grandTotalPaise}
              posQrDataUrl={posQrDataUrl}
              business={business}
              setIsEnlargeQrModalOpen={setIsEnlargeQrModalOpen}
            />
          )}

          {cart.length > 0 && (
            <PosBillDiscount type={billDiscountType} value={billDiscountValue} onTypeChange={setBillDiscountType} onValueChange={setBillDiscountValue} />
          )}
        </div>
      </div>

      {/* Bottom Total & Checkout Button (always visible) */}
      <div className="pt-2.5 mt-2.5 border-t border-slate-200 space-y-2 flex-shrink-0">
        {/* Payment mode stays in sight above the total (F4 / F8 / F9 change it) */}
        {/* Payment Method Selector */}
        <div data-pos-pay-modes aria-label={tr('Payment Mode')}>
          <div className={cn('grid gap-1.5 sm:gap-2', khataOn ? 'grid-cols-4' : 'grid-cols-3')}>
            {[
              { id: 'cash', label: tr('Cash'), icon: Banknote, shortcut: 'F4' },
              { id: 'upi', label: tr('UPI / QR'), icon: QrCode, shortcut: 'F8' },
              { id: 'credit', label: tr('Credit'), icon: BookOpen, shortcut: 'F9' },
              { id: 'split', label: tr('Split'), icon: CreditCard },
            ].filter((m) => khataOn || m.id !== 'credit').map((m) => {
              const Icon = m.icon;
              const isSelected = paymentMethod === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setPaymentMethod(m.id as PaymentMethod);
                    if (m.id === 'split' && !splitCash && !splitUpi) {
                      setSplitCash((grandTotalPaise / 200).toString());
                      setSplitUpi((grandTotalPaise / 200).toString());
                    }
                    if (m.id === 'credit' && !selectedCustomerId && isDraftEmpty(customerDraft)) {
                      focusPosCustomerName();
                    }
                  }}
                  className={cn(
                    'py-1.5 px-1 rounded-lg border text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 transition-all text-center cursor-pointer relative',
                    isSelected
                      ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  )}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{m.label}</span>
                  {m.shortcut && paymentKeysOn && (
                    <span className={cn(
                      "text-[10px] font-mono px-1 py-0.2 rounded font-bold hidden sm:inline-block",
                      isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                    )}>
                      {m.shortcut}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {(discountTotalPaise > 0 || addedGstPaise > 0) && (
          <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>{tr('Items Total')}</span>
              <span className="font-semibold text-slate-800 font-mono">{formatINR(itemsValuePaise)}</span>
            </div>
            {discountTotalPaise > 0 && (
              <div className="flex items-center justify-between text-xs text-emerald-700 font-medium">
                <span>
                  {tr('Total Discount')}
                  {billDiscountPaise > 0 && (
                    <span className="text-[10px] ml-1 font-mono text-emerald-600">
                      {tr('(Bill: -')}{formatINR(billDiscountPaise)})
                    </span>
                  )}
                </span>
                <span className="font-semibold font-mono">-{formatINR(discountTotalPaise)}</span>
              </div>
            )}
            {addedGstPaise > 0 && (
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>{tr('GST (added)')}</span>
                <span className="font-semibold text-slate-800 font-mono">+{formatINR(addedGstPaise)}</span>
              </div>
            )}
            {includedGstPaise > 0 && (
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>{tr('Incl. GST in prices')}</span>
                <span className="font-mono">{formatINR(includedGstPaise)}</span>
              </div>
            )}
          </div>
        )}
        {/* High-Contrast POS Grand Total & Tender Card */}
        <div className="p-3 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white rounded-2xl border border-slate-800 shadow-md space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                {tr('Total Payable')}
              </span>
              <span className="text-[11px] font-mono text-slate-400 font-medium">
                {totalItemCount} {totalItemCount === 1 ? tr('item') : tr('items')} • {totalUnits} {tr('units')}
              </span>
            </div>
            <div className="text-right">
              <div className="text-3xl sm:text-4xl font-black font-mono text-emerald-400 tracking-tight leading-none drop-shadow-sm">
                {formatINR(grandTotalPaise)}
              </div>
              {includedGstPaise > 0 && (
                <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                  {tr('(Incl.')} {formatINR(includedGstPaise)} GST)
                </span>
              )}
            </div>
          </div>

          {/* Cash Mode Tender & Return Change Display */}
          {paymentMethod === 'cash' && amountReceivedInput && (() => {
            const tenderedPaise = Math.round((parseFloat(amountReceivedInput) || 0) * 100);
            const returnChangePaise = tenderedPaise - grandTotalPaise;

            if (returnChangePaise > 0) {
              return (
                <div className="pt-2 mt-1 border-t border-slate-800/80">
                  <div className="p-2.5 bg-emerald-950/70 border border-emerald-500/40 rounded-xl flex items-center justify-between shadow-inner">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">💵</span>
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 block leading-tight">
                          {tr('Return Change')}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {tr('Tendered:')} {formatINR(tenderedPaise)}
                        </span>
                      </div>
                    </div>
                    <span className="font-mono font-black text-amber-300 text-xl sm:text-2xl tracking-tight">
                      {formatINR(returnChangePaise)}
                    </span>
                  </div>
                </div>
              );
            } else if (returnChangePaise === 0) {
              return (
                <div className="pt-1.5 mt-1 border-t border-slate-800/80 flex items-center justify-between text-xs text-emerald-400 font-bold">
                  <span>{tr('✓ Exact Cash Tendered')}</span>
                  <span className="font-mono">{formatINR(tenderedPaise)}</span>
                </div>
              );
            } else {
              return (
                <div className="pt-1.5 mt-1 border-t border-slate-800/80 flex items-center justify-between text-xs text-rose-400 font-bold">
                  <span>{tr('⚠️ Short by:')}</span>
                  <span className="font-mono">{formatINR(Math.abs(returnChangePaise))}</span>
                </div>
              );
            }
          })()}
        </div>

        {/* Customer Balance Warning Banner if Selected Customer has Pending Udhar */}
        {selectedCustomer && (selectedCustomer.current_balance || 0) > 0 && (
          <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-950 font-bold shadow-2xs">
            <span className="flex items-center gap-1.5">
              <span>{tr('⚠️ Previous Udhar Due:')}</span>
              <span className="text-slate-600 font-normal">({selectedCustomer.name})</span>
            </span>
            <span className="font-mono font-black text-rose-700 text-sm">
              {formatINR(selectedCustomer.current_balance)}
            </span>
          </div>
        )}

        <Button
          size="lg"
          disabled={cart.length === 0}
          onClick={() => handleCompleteSale()}
          className={cn(
            'w-full text-xs sm:text-sm font-black py-3 sm:py-3.5 shadow-md cursor-pointer transition-all flex items-center justify-center gap-2 rounded-xl',
            'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-emerald-600/20'
          )}
        >
          <Receipt className="w-4 h-4 mr-1 text-white" />
          <span>{tr('Complete Sale & Print')}</span>
          <kbd className="ml-1 px-1.5 py-0.5 rounded bg-emerald-700 text-emerald-100 font-mono text-[10px] font-bold border border-emerald-500">Enter ↵</kbd>
        </Button>
      </div>
    </div>
  );

  // v4.92.0 — Scan mode hides the product list while the gun types (lib/billing/posLayout.ts).
  const listVisible = showProductList(posLayout, searchQuery);

  return (
    <div className="relative pb-40 lg:pb-2 h-full flex flex-col">
      <PosSplitLayout
        layout={posLayout}
        onLayoutChange={setPosLayout}
        onDone={focusProductSearch}
        catalog={
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
              <PosCategoryTabs categories={categories} categoryCounts={categoryCounts} selectedCategory={selectedCategory} onSelect={setSelectedCategory} totalProductCount={totalProductCount} />
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
                        const isOutOfStock = !variants && !p.is_unlimited_stock && (stockNum <= 0 || availableStock <= 0);
                        const isLowStock = !variants && !p.is_unlimited_stock && !isOutOfStock && availableStock <= (p.min_stock_level || 5);
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
        }
        checkout={
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full min-h-0 overflow-hidden">
            {renderCheckoutPanel()}
          </div>
        }
      />

      {/* Mobile Floating Bottom Sticky Cart Button (Elevated cleanly above bottom nav bar) */}
      <div className="lg:hidden fixed bottom-[88px] left-3 right-3 sm:left-6 sm:right-6 max-w-md mx-auto p-3 bg-white/95 backdrop-blur-md border border-slate-300 rounded-2xl z-30 shadow-2xl shadow-slate-900/15 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black relative flex-shrink-0 shadow-xs">
            <ShoppingCart className="w-5 h-5" />
            {totalItemCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-black flex items-center justify-center border-2 border-white">
                {totalItemCount}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-slate-500 font-bold truncate">
              {tabs.length > 1 ? tr('Bill #{tabNumber} • ', { tabNumber: activeTab.tabNumber }) : ''}{totalItemCount} {totalItemCount === 1 ? tr('item') : tr('items')}
            </div>
            <div className="text-base font-black text-slate-900 font-mono leading-tight">
              {formatINR(grandTotalPaise)}
            </div>
          </div>
        </div>

        <Button
          size="md"
          disabled={cart.length === 0}
          onClick={() => setIsMobileCartOpen(true)}
          className="bg-amber-400 hover:bg-amber-500 active:scale-95 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl border-none shadow-md shadow-amber-400/25 flex-shrink-0 cursor-pointer"
        >
          <span>{tr('View Cart & Pay')}</span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      {/* Mobile Checkout Drawer Modal */}
      <Modal
        isOpen={isMobileCartOpen}
        onClose={() => setIsMobileCartOpen(false)}
        title={tr('POS Checkout — Bill #{tabNumber}', { tabNumber: activeTab.tabNumber })}
        size="lg"
      >
        <div className="p-1 h-full flex flex-col">
          {renderCheckoutPanel()}
        </div>
      </Modal>

      {/* Variant picker: which size / colour of a parent product */}
      {variantPick && (
        <VariantPickerModal
          parent={variantPick.parent}
          inCart={(id) => getTotalCartQuantityForProduct(id)}
          onClose={() => setVariantPick(null)}
          onPick={(variant) => {
            const qty = variantPick.qty;
            setVariantPick(null);
            addToCart(variant, qty);
          }}
        />
      )}

      {/* Quick Edit Cart Item Modal */}
      <PosItemEditModal
        editingCartItem={editingCartItem}
        setEditingCartItem={setEditingCartItem}
        business={business}
        editItemQty={editItemQty}
        setEditItemQty={setEditItemQty}
        editItemPrice={editItemPrice}
        setEditItemPrice={setEditItemPrice}
        editItemDiscountType={editItemDiscountType}
        setEditItemDiscountType={setEditItemDiscountType}
        editItemDiscount={editItemDiscount}
        setEditItemDiscount={setEditItemDiscount}
        handleSaveEditItem={handleSaveEditItem}
      />

      {/* Bill printer setup (size, printer, Enter prints straight away, test print) */}
      {isBillPrinterOpen && (
        <BillPrinterSetup
          onClose={() => {
            setIsBillPrinterOpen(false);
            focusProductSearch();
          }}
          business={business}
          autoPrint={silentPrint}
          onAutoPrintChange={setAutoPrint}
        />
      )}

      {/* Quick Add Scanned Product Modal */}
      <QuickAddScannedProductModal
        isOpen={isQuickAddModalOpen}
        onClose={() => setIsQuickAddModalOpen(false)}
        onSubmit={handleSaveQuickAddItem}
        barcode={scannedUnknownBarcode}
        name={quickAddName}
        setName={setQuickAddName}
        price={quickAddPrice}
        setPrice={setQuickAddPrice}
      />

      {/* Invoice Modal for Completed Sale (Success Modal Mode with Dropdown PDF) */}
      {activeSaleForInvoice && (
        <InvoiceModal
          isOpen={isInvoiceModalOpen}
          onClose={() => {
            setIsInvoiceModalOpen(false);
            setActiveSaleForInvoice(null);
            focusProductSearch();
          }}
          onNewBill={() => {
            // The finished bill was already cleared when it was saved. Do not touch
            // the cart here: the tab now on screen may be another customer's bill.
            setIsInvoiceModalOpen(false);
            setActiveSaleForInvoice(null);
            focusProductSearch();
          }}
          sale={activeSaleForInvoice}
          business={business || null}
          initialPhone={completedSaleDetails?.customerPhone || activeSaleForInvoice.customer_phone || ''}
          isPostSaleSuccess={true}
        />
      )}

      {/* Customer Fullscreen Dynamic UPI QR Modal */}
      <FullscreenUpiQrModal
        isOpen={isEnlargeQrModalOpen}
        onClose={() => setIsEnlargeQrModalOpen(false)}
        amountPaise={paymentMethod === 'split' ? Math.round(parseFloat(splitUpi || '0') * 100) : grandTotalPaise}
        businessName={business?.name}
        upiId={business?.upi_id}
        qrDataUrl={posQrDataUrl}
        customerName={selectedCustomer?.name || customerDraft.name}
        customerPhone={selectedCustomer?.phone || customerDraft.phone}
      />

      {/* Floating In-App Toast Notification */}
      <BillingToast toast={billingToast} />
    </div>
  );
}
