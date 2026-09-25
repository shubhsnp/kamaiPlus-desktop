'use client';
import { showAlert } from '@/lib/ui/dialogs';

import React, { useState, useEffect } from 'react';
import { db, ensureStarterBusinessIfEmpty, seedBusinessStarterData } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from '@/lib/i18n';
import { Product, Customer, CartItem, PaymentMethod, ProductUnit, LedgerTransaction } from '@/types';
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
  Trash2, 
  Plus, 
  Minus, 
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
  Camera,
  Mic,
  Barcode,
  Globe,
  Tag,
  Edit2,
  UserPlus,
  X,
  ShoppingCart,
  ChevronUp,
  ChevronDown,
  Sliders,
  Bluetooth,
  Usb,
  PauseCircle,
  PlayCircle,
  Lock, PackageOpen
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import dynamic from 'next/dynamic';
import { useHardwareBarcodeScanner } from '@/lib/hardware/barcodeScannerListener';

import { CustomerSearchAutocomplete } from '@/components/customers/CustomerSearchAutocomplete';
import { Sale } from '@/types';

import { paymentBridge } from '@/lib/payments/paymentBridge';
import { ParsedPaymentEvent } from '@/lib/payments/notificationParser';
import { cloudMerge, cloudSyncSoon, cloudTrackInvoice, prewarmCloud } from '@/lib/firebase/lazyCloud';
import { getDesktopApi } from '@/lib/desktop/desktopBridge';
import { resolveInvoiceConfig } from '@/lib/invoices/themeDefaults';
import { getPrimaryUpiVpa, buildInvoiceDocument } from '@/lib/invoices/invoiceDocument';
import { renderInvoiceHtml } from '@/lib/invoices/invoiceOutput';
import { getPrintSettings, printerForFormat } from '@/lib/hardware/printSettings';

// Lazy-load non-critical heavy modals
const BarcodeScannerModal = dynamic(
  () => import('@/components/barcode/BarcodeScannerModal').then((m) => m.BarcodeScannerModal),
  { ssr: false }
);
const RapidScanMode = dynamic(
  () => import('@/components/billing/RapidScanMode').then((m) => m.RapidScanMode),
  { ssr: false }
);
const HardwareManagerModal = dynamic(
  () => import('@/components/hardware/HardwareManagerModal').then((m) => m.HardwareManagerModal),
  { ssr: false }
);
const InvoiceModal = dynamic(
  () => import('@/components/invoices/InvoiceModal').then((m) => m.InvoiceModal),
  { ssr: false }
);
const PaymentCelebrationModal = dynamic(
  () => import('@/components/payments/PaymentCelebrationModal').then((m) => m.PaymentCelebrationModal),
  { ssr: false }
);
import { PosItemEditModal } from '@/components/billing/PosItemEditModal';
import { VariantPickerModal } from '@/components/billing/VariantPickerModal';

export interface BillTab {
  id: string;
  tabNumber: number;
  cart: CartItem[];
  selectedCustomerId: string;
  paymentMethod: PaymentMethod;
  amountReceivedInput: string;
  splitCash: string;
  splitUpi: string;
  splitCard: string;
  splitCredit: string;
  billDiscountType?: 'flat' | 'percentage';
  billDiscountValue?: string;
  isHeld: boolean;
  heldAt?: string;
  holdNote?: string;
}

const TABS_STORAGE_KEY = 'kamai_pos_tabs';

function getInitialTabs(): { tabs: BillTab[]; activeTabId: string } {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(TABS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return { tabs: parsed, activeTabId: parsed[0].id };
        }
      }
    } catch {}
  }
  const defaultTab: BillTab = {
    id: 'tab_1',
    tabNumber: 1,
    cart: [],
    selectedCustomerId: '',
    paymentMethod: 'cash',
    amountReceivedInput: '',
    splitCash: '',
    splitUpi: '',
    splitCard: '',
    splitCredit: '',
    billDiscountType: 'flat',
    billDiscountValue: '',
    isHeld: false,
  };
  return { tabs: [defaultTab], activeTabId: 'tab_1' };
}

// Memoized Product Card to prevent re-rendering the entire 200-item grid on every cart update
const PosProductCard = React.memo(({
  p,
  idx,
  inCartQuantity,
  availableStock,
  stockNum,
  isOutOfStock,
  isLowStock,
  isHighlighted,
  variants,
  onAdd
}: {
  p: any;
  idx: number;
  inCartQuantity: number;
  availableStock: number;
  stockNum: number;
  isOutOfStock: boolean;
  isLowStock: boolean;
  isHighlighted: boolean;
  /** Set for a parent with sizes / colours: how many, and the cheapest price. */
  variants?: { count: number; minPricePaise: number };
  onAdd: (p: any) => void;
}) => {
  return (
    <button
      type="button"
      onClick={() => onAdd(p)}
      className={cn(
        'p-2.5 rounded-xl border text-left flex flex-col justify-between relative transition-all min-h-[105px] sm:min-h-[110px] h-full',
        isOutOfStock
          ? 'border-rose-300/80 bg-rose-50/40 opacity-70 hover:border-rose-400 cursor-not-allowed select-none'
          : isHighlighted
          ? 'cursor-pointer bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500 shadow-md scale-[1.01]'
          : inCartQuantity > 0 && !isOutOfStock
          ? 'cursor-pointer bg-amber-50/40 border-amber-400 ring-1.5 ring-amber-400/50 shadow-2xs active:scale-[0.98]'
          : 'cursor-pointer bg-white hover:border-slate-400 hover:shadow-2xs border-slate-200 shadow-2xs active:scale-[0.98]'
      )}
    >
      {isOutOfStock ? (
        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-rose-600 text-white text-[9px] font-black uppercase tracking-wider shadow-xs">
          Out of Stock
        </div>
      ) : isHighlighted ? (
        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[9px] font-black font-mono shadow-xs">
          ↵ Enter
        </div>
      ) : inCartQuantity > 0 ? (
        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.2 rounded-md bg-amber-400 text-slate-950 text-[9px] font-black shadow-xs">
          {inCartQuantity} in cart
        </div>
      ) : null}

      <div className="pr-12">
        <span className="text-[9px] uppercase font-extrabold tracking-wider block leading-tight text-slate-400">
          {p.category_name || 'Item'}
        </span>
        <h4 className={cn(
          "text-xs sm:text-sm font-bold line-clamp-2 mt-0.5 leading-snug",
          isOutOfStock ? "text-slate-500 line-through" : "text-slate-900"
        )}>
          {p.name}
        </h4>
      </div>

      <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-baseline justify-between gap-1">
        <div className="truncate">
          {variants && <span className="text-[10px] text-slate-500 font-medium mr-0.5">from</span>}
          <span className={cn(
            "text-xs sm:text-sm font-black font-mono",
            isOutOfStock ? "text-slate-400 line-through" : "text-slate-900"
          )}>
            {formatINR(variants ? variants.minPricePaise : p.selling_price)}
          </span>
          {!variants && <span className="text-[10px] text-slate-500 font-medium ml-0.5">/{p.unit}</span>}
        </div>
        {variants ? (
          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 bg-indigo-100 text-indigo-700">
            {variants.count} Variants ▾
          </span>
        ) : (
        <span className={cn(
          "text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-md shrink-0 flex items-center gap-1",
          isOutOfStock ? "bg-rose-100 text-rose-700" : isLowStock ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
        )}>
          {p.is_unlimited_stock ? '∞' : stockNum}
        </span>
        )}
      </div>
    </button>
  );
});

export default function BillingPage() {
  const { language, t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [billingToast, setBillingToast] = useState<{ message: string; type?: 'success' | 'info' | 'error' } | null>(null);

  const showBillingToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setBillingToast({ message, type });
    setTimeout(() => setBillingToast(null), 4000);
  };

  // Silent Instant Thermal Print State
  const [silentPrint, setSilentPrint] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('kamai_silent_print') === 'true';
    }
    return false;
  });

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
  // Persist tabs in localStorage
  useEffect(() => {
    try {
      localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(tabs));
    } catch {}
  }, [tabs]);

  const updateActiveTab = (updater: (prevTab: BillTab) => BillTab) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? updater(t) : t))
    );
  };

  const setCart = (action: CartItem[] | ((prev: CartItem[]) => CartItem[])) => {
    updateActiveTab((tab) => ({
      ...tab,
      cart: typeof action === 'function' ? action(tab.cart) : action,
    }));
  };

  const setSelectedCustomerId = (id: string) => {
    updateActiveTab((tab) => ({ ...tab, selectedCustomerId: id }));
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
  const handleCreateNewTab = () => {
    const nextNum = (tabs.reduce((max, t) => Math.max(max, t.tabNumber), 0) || tabs.length) + 1;
    const newTabId = `tab_${Date.now()}`;
    const newTab: BillTab = {
      id: newTabId,
      tabNumber: nextNum,
      cart: [],
      selectedCustomerId: '',
      paymentMethod: 'cash',
      amountReceivedInput: '',
      splitCash: '',
      splitUpi: '',
      splitCard: '',
      splitCredit: '',
      isHeld: false,
    };
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

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) {
      // Reset single tab
      setTabs([{
        id: 'tab_1',
        tabNumber: 1,
        cart: [],
        selectedCustomerId: '',
        paymentMethod: 'cash',
        amountReceivedInput: '',
        splitCash: '',
        splitUpi: '',
        splitCard: '',
        splitCredit: '',
        isHeld: false,
      }]);
      setActiveTabId('tab_1');
      return;
    }

    const remaining = tabs.filter((t) => t.id !== tabId);
    setTabs(remaining);
    if (activeTabId === tabId) {
      setActiveTabId(remaining[0].id);
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
  
  // Quick Add Customer State
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');

  // Hardware Modals
  const [isHardwareModalOpen, setIsHardwareModalOpen] = useState<boolean>(false);

  // Modals
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [activeSaleForInvoice, setActiveSaleForInvoice] = useState<Sale | null>(null);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [isRapidScanModeOpen, setIsRapidScanModeOpen] = useState(false);
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
  const [scannedUnknownBarcode, setScannedUnknownBarcode] = useState<string | null>(null);
  const [quickAddPrice, setQuickAddPrice] = useState('');
  const [quickAddName, setQuickAddName] = useState('');
  const [completedSaleDetails, setCompletedSaleDetails] = useState<any>(null);



  // Live Dynamic UPI QR Code States
  const [posQrDataUrl, setPosQrDataUrl] = useState<string>('');
  const [isEnlargeQrModalOpen, setIsEnlargeQrModalOpen] = useState<boolean>(false);
  const [selectedUpiIndex, setSelectedUpiIndex] = useState<number>(0);

  // Real-Time Payment Bridge & Celebration States
  const [celebrationPayment, setCelebrationPayment] = useState<ParsedPaymentEvent | null>(null);
  const [isCelebrationOpen, setIsCelebrationOpen] = useState<boolean>(false);

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
      showBillingToast('✅ Loaded default catalog products!', 'success');
    } catch (err: any) {
      showBillingToast(`Failed to load sample products: ${err?.message}`, 'error');
    } finally {
      setIsSeedingProducts(false);
    }
  };

  const business = useBusiness();
  const categories = useLiveQuery(async () => db.categories.toArray()) || [];
  const customers = useLiveQuery(async () => db.customers.toArray()) || [];

  const totalProductCount = useLiveQuery(() => db.products.count()) || 0;

  // One indexed pass over the category column instead of one count() query per
  // category (a shop with 30 categories used to fire 30 serial IndexedDB reads
  // every time the counter screen opened).
  const categoryCounts = useLiveQuery(async () => {
    const counts: Record<string, number> = {};
    await db.products.orderBy('category_id').eachKey((key) => {
      const id = String(key);
      counts[id] = (counts[id] || 0) + 1;
    });
    return counts;
  }, []) || {};

  const [debouncedSearch] = useDebounce(searchQuery, 300);
  
  const [products, setProducts] = useState<any[]>([]);

  // Variant picker (products with sizes / colours) and each parent's "from ₹X"
  const [variantPick, setVariantPick] = useState<{ parent: Product; qty: number } | null>(null);
  const variantInfo = useLiveQuery(async () => {
    const children = await db.products.filter((p) => Boolean(p.parent_id) && p.is_active !== false).toArray();
    const map: Record<string, { count: number; minPricePaise: number }> = {};
    for (const c of children) {
      const cur = map[c.parent_id!];
      map[c.parent_id!] = cur
        ? { count: cur.count + 1, minPricePaise: Math.min(cur.minPricePaise, c.selling_price) }
        : { count: 1, minPricePaise: c.selling_price };
    }
    return map;
  }, []) || {};

  // Pull the cloud-sync bundle in while the cashier is still picking items, so
  // the first bill of the day does not wait for it.
  useEffect(() => {
    prewarmCloud();
    // Same idea for invoice numbering: scan the invoice-number index once now, so
    // the first "Complete Sale" of the session uses the cache.
    const warm = () => { void warmInvoiceNumberCache(); };
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

        // Filter by Search Query
        if (debouncedSearch.trim()) {
          const q = debouncedSearch.toLowerCase();
          prods = prods.filter(
            (p) =>
              Boolean(
                p.name.toLowerCase().includes(q) ||
                (p.barcode && p.barcode.includes(q)) ||
                (p.category_name && p.category_name.toLowerCase().includes(q))
              )
          );
        }
        
        // No limit needed now that we are using Virtualization (Phase 1)
        const data = await prods.toArray();
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

  const getAvailableStockForProduct = (product: Product) => {
    if (product.is_unlimited_stock) return 999999;
    const stock = Number(product.current_stock ?? 0);
    const reservedQty = getTotalCartQuantityForProduct(product.id, product.name);
    return Math.max(0, stock - reservedQty);
  };

  // Instant POS Quick Restock and Add to Cart
  const handleRestockAndAddToCart = async (product: Product, restockQty: number = 10, billQty: number = 1) => {
    try {
      const now = new Date().toISOString();
      const current = Number(product.current_stock ?? 0);
      const newStock = current + restockQty;

      const updatedProduct: Product = {
        ...product,
        current_stock: newStock,
        updated_at: now,
      };

      await db.products.put(updatedProduct);

      await db.inventory_movements.put({
        id: `mov_pos_restock_${Date.now()}_${product.id}`,
        business_id: product.business_id || business?.id || 'biz_default',
        product_id: product.id,
        product_name: product.name,
        movement_type: 'PURCHASE',
        quantity: restockQty,
        previous_stock: current,
        new_stock: newStock,
        reason: `POS Quick Restock (+${restockQty} ${product.unit || 'units'}) during billing`,
        created_by: 'cashier',
        created_at: now,
      });

      // Direct cloud sync to prevent stale overwrite (never blocks the cart)
      const bizId = product.business_id || business?.id;
      if (bizId && bizId !== 'biz_default') {
        void cloudMerge(`businesses/${bizId}/products/${product.id}`, updatedProduct);
      }

      addToCart(updatedProduct, billQty);
    } catch (err) {
      console.error('Failed to quick restock from POS:', err);
      showAlert('Failed to restock item. Please check inventory.');
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
        showBillingToast(`Out of Stock: "${product.name}" has 0 stock remaining.`, 'error');
        return;
      }

      const currentInCart = getCartQuantityForProduct(product.id, product.name);
      if (currentInCart + quantityToAdd > currentStock) {
        playBeepSound('alert');
        showBillingToast(`Insufficient Stock: Only ${currentStock} ${product.unit || 'units'} available for "${product.name}".`, 'error');
        return;
      }
    }

    playBeepSound('success');
    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      const allowedQty = quantityToAdd;

      if (allowedQty <= 0) {
        return prev;
      }

      if (existing) {
        const newQty = existing.quantity + allowedQty;
        const price = product.selling_price;
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
                is_tax_inclusive: product.is_tax_inclusive,
              }
            : item
        );
      } else {
        const price = product.selling_price;
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
            is_tax_inclusive: product.is_tax_inclusive,
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
        showBillingToast(`Max stock reached (${currentStock} ${product.unit || 'units'}) for "${product.name}".`, 'error');
        return;
      }
    }

    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product_id === productId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            const price = product.selling_price;
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

    const qty = parseFloat(editItemQty);
    const unitPricePaise = Math.round((parseFloat(editItemPrice) || 0) * 100);

    if (isNaN(qty) || qty <= 0 || isNaN(unitPricePaise) || unitPricePaise < 0) {
      showAlert('Please enter valid numeric values.');
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
    if (product && !product.is_unlimited_stock && qty > product.current_stock) {
      showAlert(`Entered quantity (${qty}) exceeds available stock (${product.current_stock}).`);
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

  // Quick Add Customer Handler
  const handleSaveQuickCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;

    const newId = `cust_${Date.now()}`;
    const newCust: Customer = {
      id: newId,
      business_id: business?.id || 'biz_default',
      name: newCustName.trim(),
      phone: newCustPhone.trim() || '',
      address: newCustAddress.trim() || undefined,
      opening_balance: 0,
      current_balance: 0,
      loyalty_points: 0,
      total_spent: 0,
      total_visits: 1,
      customer_type: 'regular',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: 'synced',
    };

    await db.customers.put(newCust);
    setSelectedCustomerId(newId);
    setIsAddCustomerModalOpen(false);
    setNewCustName('');
    setNewCustPhone('');
    setNewCustAddress('');
  };

  // Barcode scanned handler
  const handleBarcodeScanned = async (barcode: string) => {
    const clean = barcode.trim();
    if (!clean) return;

    try {
      const product = await db.products.where('barcode').equals(clean).first();
      if (product) {
        addToCart(product, 1);
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

  useHardwareBarcodeScanner({
    onScan: handleBarcodeScanned,
    // Off while the variant picker is open: scanner digits would pick variants 1–9.
    enabled: !isBarcodeModalOpen && !isRapidScanModeOpen && !isInvoiceModalOpen && !variantPick,
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
      category_id: 'cat_general',
      category_name: 'General Store',
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
  const totalItemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

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
      ? [{ id: 'def', label: 'Primary Counter', upi_id: business.upi_id, is_default: true }]
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

  // Live Payment Bridge: Automatically matches incoming UPI payments with active cart amount
  useEffect(() => {
    if (cart.length === 0) return;

    const unsubscribe = paymentBridge.subscribe((incomingPayment) => {
      // Calculate target payable amount for UPI
      let targetPaise = grandTotalPaise;
      if (paymentMethod === 'split') {
        const splitUpiPaise = splitUpi ? Math.round(parseFloat(splitUpi) * 100) : 0;
        if (splitUpiPaise > 0) targetPaise = splitUpiPaise;
      }

      // Check if incoming payment matches active cart amount
      if (incomingPayment.amountPaise === targetPaise) {
        // 1. Open Top-Tier Celebration Modal
        setCelebrationPayment(incomingPayment);
        setIsCelebrationOpen(true);

        // 3. Complete sale automatically
        handleCompleteSale(incomingPayment);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [cart, grandTotalPaise, paymentMethod, splitUpi, business, selectedCustomer, products]);

  const handleCompleteSale = async (explicitPayment?: ParsedPaymentEvent) => {
    if (cart.length === 0) return;

    // Resolve target customer reliably from state or Dexie
    let targetCustomer = selectedCustomer;
    if (!targetCustomer && selectedCustomerId) {
      targetCustomer = await db.customers.get(selectedCustomerId);
    }

    // MANDATORY CUSTOMER VALIDATION FOR CREDIT / UDHAR PAYMENT MODE
    const isCreditMode = paymentMethod === 'credit' || (paymentMethod === 'split' && parseFloat(splitCredit || '0') > 0);
    if (isCreditMode && !targetCustomer) {
      playBeepSound('alert');
      showBillingToast('Customer name is mandatory for Credit (Udhar) sale. Please select or add a customer.', 'error');
      setIsAddCustomerModalOpen(true);
      return;
    }

    try {
      const currentBiz = business || (await ensureStarterBusinessIfEmpty());
      const businessId = currentBiz?.id || 'biz_default';
      const { invoiceNumber, nextSeq } = await getNextUniqueInvoiceNumber(businessId);
      const now = new Date().toISOString();

      const finalInvoiceNumber = invoiceNumber;

      let finalMethod: PaymentMethod = explicitPayment ? 'upi' : paymentMethod;
      let receivedPaise = 0;
      let balanceDuePaise = 0;
      let changeReturnedPaise = 0;
      let paymentSplitData: any = undefined;

      if (explicitPayment) {
        receivedPaise = grandTotalPaise;
        balanceDuePaise = 0;
        changeReturnedPaise = 0;
      } else if (paymentMethod === 'split') {
        const cashP = splitCash ? Math.round(parseFloat(splitCash) * 100) : 0;
        const upiP = splitUpi ? Math.round(parseFloat(splitUpi) * 100) : 0;
        const cardP = splitCard ? Math.round(parseFloat(splitCard) * 100) : 0;
        const creditP = splitCredit ? Math.round(parseFloat(splitCredit) * 100) : 0;
        
        const allocatedP = cashP + upiP + cardP + creditP;
        const unassigned = Math.max(0, grandTotalPaise - allocatedP);
        const finalCreditP = creditP + (targetCustomer ? unassigned : 0);
        const finalCashP = cashP + (!targetCustomer ? unassigned : 0);

        receivedPaise = finalCashP + upiP + cardP;
        balanceDuePaise = finalCreditP;
        paymentSplitData = {
          cash_amount: finalCashP,
          upi_amount: upiP,
          card_amount: cardP,
          credit_amount: finalCreditP,
        };
      } else {
        receivedPaise = amountReceivedInput ? Math.round(parseFloat(amountReceivedInput) * 100) : (paymentMethod === 'credit' ? 0 : grandTotalPaise);
        const isCredit = paymentMethod === 'credit' || receivedPaise < grandTotalPaise;
        balanceDuePaise = isCredit ? Math.max(0, grandTotalPaise - receivedPaise) : 0;
        changeReturnedPaise = !isCredit && receivedPaise > grandTotalPaise ? receivedPaise - grandTotalPaise : 0;
      }

      const saleId = `sale_${Date.now()}`;

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
        notes: explicitPayment?.referenceNumber
          ? `UPI Ref / UTR: ${explicitPayment.referenceNumber} (${explicitPayment.sourceApp})`
          : undefined,
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

      // 3. Deduct product inventory stock
      {
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

          // Direct cloud sync to prevent stale overwrite from cloud background sync
          if (businessId && businessId !== 'biz_default') {
            void cloudMerge(`businesses/${businessId}/products/${prod.id}`, updatedProd);
          }
        }
      }
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

        const ledgerTxId = `ledg_${Date.now()}`;
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

      // 5. Open detailed Invoice & thermal receipt modal (or Silent Print directly)
      setActiveSaleForInvoice(newSale);
      setCompletedSaleDetails({
        invoiceNumber,
        customerName: targetCustomer?.name,
        customerPhone: targetCustomer?.phone,
        grandTotalPaise,
        balanceDuePaise,
        items: [...cart],
      });

      const desktopApi = getDesktopApi();
      if (silentPrint && desktopApi) {
        try {
          const printSettings = getPrintSettings();
          const format = printSettings.defaultFormat || 'thermal-80';
          const vpa = getPrimaryUpiVpa(currentBiz);
          const html = await renderInvoiceHtml(
            { sale: newSale, business: currentBiz, customer: targetCustomer, upiVpa: vpa },
            format
          );
          await desktopApi.print({
            html,
            paper: format,
            deviceName: printerForFormat(printSettings, format) || undefined,
            silent: true,
          });
          showBillingToast(`⚡ Silent Printed Invoice #${invoiceNumber}`, 'success');
        } catch (silentErr) {
          console.warn('Silent print notice, opening modal:', silentErr);
          setIsInvoiceModalOpen(true);
        }
      } else {
        setIsInvoiceModalOpen(true);
      }
      setIsMobileCartOpen(false);

      // 7. Remove completed tab or reset if single
      if (tabs.length > 1) {
        const remainingTabs = tabs.filter((t) => t.id !== activeTabId);
        setTabs(remainingTabs);
        setActiveTabId(remainingTabs[0].id);
      } else {
        setCart([]);
        setAmountReceivedInput('');
      }
    } catch (saleErr) {
      console.error('Sale completion encountered an error:', saleErr);
      showAlert('Encountered an unexpected error completing the sale. Please verify inventory.');
    }
  };

  // Desktop POS High-Speed Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // The variant picker owns the keyboard while open — otherwise Enter on a
      // focused variant would also run "Complete sale".
      if (variantPick) return;

      // Tab switching via Ctrl + 1..9
      if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '9') {
        const tabIdx = parseInt(e.key, 10) - 1;
        if (tabs[tabIdx]) {
          e.preventDefault();
          setActiveTabId(tabs[tabIdx].id);
          showBillingToast(`Switched to Bill #${tabs[tabIdx].tabNumber}`, 'info');
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

        if (e.key === 'Enter') {
          e.preventDefault();
          const targetProd = (highlightedIndex >= 0 && products[highlightedIndex]) || (products.length > 0 ? products[0] : null);
          if (targetProd) {
            const stockNum = Number(targetProd.current_stock ?? 0);
            const isOutOfStock = !targetProd.has_variants && !targetProd.is_unlimited_stock && stockNum <= 0;
            if (targetProd.has_variants) {
              // Opens the size / colour picker; the chosen variant is added from there.
              addToCart(targetProd, 1);
              setSearchQuery('');
              setHighlightedIndex(-1);
            } else if (isOutOfStock) {
              playBeepSound('alert');
              showBillingToast(`Out of Stock: "${targetProd.name}"`, 'error');
            } else {
              addToCart(targetProd, 1);
              playBeepSound('success');
              showBillingToast(`Added: ${targetProd.name}`, 'success');
              setSearchQuery('');
              setHighlightedIndex(-1);
            }
          }
          return;
        }
      }

      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (e.key === 'F1') {
        e.preventDefault();
        handleCreateNewTab();
        showBillingToast('Created New Bill Tab [F1]', 'info');
        return;
      }

      if (e.key === 'F2' || (e.key === '/' && !isInput)) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === 'F4') {
        e.preventDefault();
        setPaymentMethod('cash');
        showBillingToast('Selected Cash Payment [F4]', 'info');
        return;
      }

      if (e.key === 'F8') {
        e.preventDefault();
        setPaymentMethod('upi');
        showBillingToast('Selected UPI Payment [F8]', 'info');
        return;
      }

      if (e.key === 'F9') {
        e.preventDefault();
        setPaymentMethod('credit');
        showBillingToast('Selected Credit (Udhar) [F9]', 'info');
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
  }, [cart, searchQuery, handleCompleteSale, products, highlightedIndex, tabs, variantPick]);

  // Reusable Checkout Panel Component for Desktop side-panel and Mobile Bottom Drawer
  const renderCheckoutPanel = () => (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Everything above the tender card scrolls. The grand total and the
          Complete Sale button are pinned below it, so a long bill can never
          push the pay button out of the panel. */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 -mr-1">
      {/* Multi-Bill Tab Bar */}
      <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 overflow-x-auto border border-slate-200">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const count = tab.cart.reduce((s, i) => s + i.quantity, 0);
          const cust = customers.find((c) => c.id === tab.selectedCustomerId);
          const tabTitle = cust ? cust.name.split(' ')[0] : `Bill #${tab.tabNumber}`;

          return (
            <div
              key={tab.id}
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
                <span className="text-[10px] text-amber-600" title="Bill is on hold">
                  ⏸️
                </span>
              )}
              {tabs.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => handleCloseTab(tab.id, e)}
                  className="hover:text-rose-600 text-slate-400 p-0.5 rounded-full"
                  title="Close this bill tab"
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
          title="Open New Parallel Bill Cart"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="text-[11px] hidden sm:inline">New</span>
        </button>

        {/* Silent Instant Print Quick Toggle */}
        <div className="ml-auto flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              const next = !silentPrint;
              setSilentPrint(next);
              if (typeof window !== 'undefined') localStorage.setItem('kamai_silent_print', String(next));
              showBillingToast(next ? '⚡ Silent Print: Active (Direct Thermal)' : 'Silent Print: Off (Preview Dialog)', 'info');
            }}
            className={cn(
              "px-2 py-1 rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer border",
              silentPrint
                ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
            )}
            title="Toggle Instant Silent Print (Direct Thermal Print without preview dialog)"
          >
            <Printer className="w-3 h-3" />
            <span>{silentPrint ? '⚡ Silent: ON' : 'Silent: OFF'}</span>
          </button>
        </div>
      </div>

      {/* Customer Picker & Quick Add */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Customer
            </label>
            {selectedCustomer && (selectedCustomer.current_balance || 0) > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-100 border border-rose-300 text-rose-700 text-[10px] font-black flex items-center gap-1 shadow-2xs">
                <span>⚠️ Old Khata:</span>
                <span className="font-mono">{formatINR(selectedCustomer.current_balance)}</span>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsAddCustomerModalOpen(true)}
            className="text-[11px] font-bold text-slate-700 hover:text-slate-950 flex items-center gap-1 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ New Customer</span>
          </button>
        </div>

        <CustomerSearchAutocomplete
          customers={customers}
          selectedCustomerId={selectedCustomerId}
          onSelectCustomer={setSelectedCustomerId}
          onOpenNewCustomerModal={(initialPhone) => {
            if (initialPhone) {
              setNewCustPhone(initialPhone);
            }
            setIsAddCustomerModalOpen(true);
          }}
        />
      </div>

      {/* Cart Header with Hold Bill Button */}
      <div className="flex items-center justify-between pt-1 flex-shrink-0">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
          <span>Cart Items ({totalItemCount})</span>
          {activeTab.isHeld && (
            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
              ⏸️ On Hold
            </span>
          )}
        </span>

        <div className="flex items-center gap-2">
          {cart.length > 0 && (
            <button
              type="button"
              onClick={handleHoldActiveTab}
              className="text-[11px] font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1 cursor-pointer transition-colors"
              title="Park / Hold this bill and start a new one"
            >
              <PauseCircle className="w-3 h-3" />
              <span>Hold Bill</span>
            </button>
          )}

          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Cart Column Header Bar for Spacious Table View */}
      {cart.length > 0 && (
        <div className="grid grid-cols-12 text-[10px] uppercase font-extrabold tracking-wider text-slate-400 px-2.5 py-1 bg-slate-100/90 rounded-lg flex-shrink-0 select-none">
          <span className="col-span-6">Item &amp; Details</span>
          <span className="col-span-3 text-center">Qty</span>
          <span className="col-span-3 text-right">Total (₹)</span>
        </div>
      )}

      {/* Cart Items List with Inline / Popover Edit */}
      <div className="border-t border-b border-slate-100 py-2 space-y-2 min-h-[60px]">
        {cart.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400 font-medium space-y-1.5">
            <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-600">Cart is empty</p>
            <p className="text-[11px] text-slate-400">Tap products on the left or scan barcode to add</p>
          </div>
        ) : (
          cart.map((item) => (
            <div 
              key={item.product_id} 
              className="p-2 sm:p-2.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs transition-all flex items-center justify-between gap-2 text-xs"
            >
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-900 truncate">
                  {item.product_name}
                </div>

                {/* Dynamic Category Attributes */}
                <div className="flex flex-wrap gap-1 my-0.5">
                  {(item.size || item.color) && (
                    <span className="text-[9px] bg-indigo-50 text-indigo-900 border border-indigo-200 px-1 py-0.2 rounded font-medium">
                      {item.size && <span>Size: {item.size} </span>}
                      {item.color && <span>• {item.color}</span>}
                    </span>
                  )}

                  {(item.imei_serial || item.warranty_period_months) && (
                    <span className="text-[9px] bg-cyan-50 text-cyan-900 border border-cyan-200 px-1 py-0.2 rounded font-mono">
                      {item.imei_serial && <span>SN:{item.imei_serial} </span>}
                      {item.warranty_period_months && <span>• {item.warranty_period_months}M</span>}
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-slate-500 font-mono flex items-center flex-wrap gap-1.5">
                  <span>{formatINR(item.unit_price)} × {item.quantity} {item.unit}</span>
                  {item.discount_amount ? (
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1 rounded">
                      -₹{(item.discount_amount / 100).toFixed(0)} off
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Quantity Stepper & Edit Button */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateQuantity(item.product_id, -1)}
                  className="w-6 h-6 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer active:scale-95 transition-all"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="font-bold font-mono text-xs w-6 text-center text-slate-900">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.product_id, 1)}
                  className="w-6 h-6 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer active:scale-95 transition-all"
                >
                  <Plus className="w-3 h-3" />
                </button>

                {/* Edit Price/Quantity/Discount Button */}
                <button
                  onClick={() => handleOpenEditItem(item)}
                  title="Edit Price, Quantity or Item Discount"
                  className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 ml-0.5 cursor-pointer transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5 text-slate-700" />
                </button>

                {/* Remove Button */}
                <button
                  onClick={() => removeFromCart(item.product_id)}
                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 ml-0.5 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="w-16 text-right font-extrabold font-mono text-xs text-slate-900">
                {formatINR(item.total_amount)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Payment Method Selector */}
      <div>
        <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block mb-1">
          Payment Mode
        </label>
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
          {[
            { id: 'cash', label: 'Cash', icon: Banknote, shortcut: 'F4' },
            { id: 'upi', label: 'UPI / QR', icon: QrCode, shortcut: 'F8' },
            { id: 'credit', label: 'Credit', icon: BookOpen },
            { id: 'split', label: 'Split', icon: CreditCard },
          ].map((m) => {
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
                  if (m.id === 'credit' && !selectedCustomerId) {
                    setIsAddCustomerModalOpen(true);
                  }
                }}
                className={cn(
                  'py-2 px-1 rounded-lg border text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 transition-all text-center cursor-pointer relative',
                  isSelected
                    ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                )}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{m.label}</span>
                {m.shortcut && (
                  <span className={cn(
                    "text-[9px] font-mono px-1 py-0.2 rounded font-bold hidden sm:inline-block",
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

      {/* Credit Mode Mandatory Customer Alert Banner */}
      {paymentMethod === 'credit' && !selectedCustomerId && (
        <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-950 flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-base flex-shrink-0">⚠️</span>
            <span className="font-bold truncate">Customer Name is compulsory for Credit (Udhar)</span>
          </div>
          <button
            type="button"
            onClick={() => setIsAddCustomerModalOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] cursor-pointer flex-shrink-0 transition shadow-xs"
          >
            + Add Customer
          </button>
        </div>
      )}

      {/* Credit Mode Live Customer Balance Insight */}
      {paymentMethod === 'credit' && selectedCustomer && (
        <div className="p-2.5 bg-amber-50/90 border border-amber-300 rounded-xl text-xs text-amber-950 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between font-bold">
            <span className="flex items-center gap-1 text-amber-900">
              <BookOpen className="w-3.5 h-3.5 text-amber-600" />
              <span>Khata Credit Preview ({selectedCustomer.name}):</span>
            </span>
            <span className="font-mono text-[11px] text-slate-500">Udhar Sale</span>
          </div>
          <div className="grid grid-cols-3 gap-1 pt-1 border-t border-amber-200/80 text-center font-mono">
            <div>
              <span className="text-[9px] uppercase font-bold text-slate-500 block">Old Balance</span>
              <span className="font-bold text-slate-800">
                {formatINR(selectedCustomer.current_balance || 0)}
              </span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-slate-500 block">This Bill</span>
              <span className="font-bold text-rose-600">
                +{formatINR(grandTotalPaise)}
              </span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-slate-500 block">New Balance</span>
              <span className="font-black text-rose-700">
                ={formatINR((selectedCustomer.current_balance || 0) + grandTotalPaise)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* If Split / Multi-Mode Payment: Render Breakdown Inputs */}
      {paymentMethod === 'split' && cart.length > 0 && (() => {
        const cVal = parseFloat(splitCash || '0') || 0;
        const uVal = parseFloat(splitUpi || '0') || 0;
        const crVal = parseFloat(splitCredit || '0') || 0;
        const cardVal = parseFloat(splitCard || '0') || 0;
        const allocatedPaise = Math.round((cVal + uVal + crVal + cardVal) * 100);
        const remainingPaise = grandTotalPaise - allocatedPaise;

        return (
          <div className="p-3 bg-slate-50 border border-slate-300 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between font-bold text-slate-800 pb-1 border-b border-slate-200">
              <span>Split Payment Breakdown:</span>
              <span className={remainingPaise === 0 ? 'text-emerald-700 font-extrabold' : 'text-amber-800 font-extrabold'}>
                {remainingPaise === 0 ? '✓ Matched Exactly' : remainingPaise > 0 ? `₹${(remainingPaise / 100).toFixed(2)} Remaining` : `₹${Math.abs(remainingPaise / 100).toFixed(2)} Overpaid`}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-0.5">Cash (₹)</label>
                <input
                  type="number"
                  step="1"
                  placeholder="0"
                  value={splitCash}
                  onChange={(e) => setSplitCash(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-slate-900 font-mono font-bold text-xs rounded p-1.5 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-0.5">UPI / QR (₹)</label>
                <input
                  type="number"
                  step="1"
                  placeholder="0"
                  value={splitUpi}
                  onChange={(e) => setSplitUpi(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-slate-900 font-mono font-bold text-xs rounded p-1.5 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-0.5">Card (₹)</label>
                <input
                  type="number"
                  step="1"
                  placeholder="0"
                  value={splitCard}
                  onChange={(e) => setSplitCard(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-slate-900 font-mono font-bold text-xs rounded p-1.5 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-0.5">Credit / Udhar (₹)</label>
                <input
                  type="number"
                  step="1"
                  placeholder="0"
                  value={splitCredit}
                  onChange={(e) => setSplitCredit(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-slate-900 font-mono font-bold text-xs rounded p-1.5 focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>

            {/* Quick Split Presets */}
            <div className="flex items-center gap-1.5 pt-0.5 overflow-x-auto scrollbar-none">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Preset:</span>
              <button
                type="button"
                onClick={() => {
                  const half = Math.round(grandTotalPaise / 200);
                  const rem = Math.round((grandTotalPaise - half * 100) / 100);
                  setSplitCash(half.toString());
                  setSplitUpi(rem.toString());
                  setSplitCard('0');
                  setSplitCredit('0');
                }}
                className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 rounded-md border border-slate-300 text-[10px] font-bold cursor-pointer"
              >
                50% Cash + 50% UPI
              </button>
              <button
                type="button"
                onClick={() => {
                  setSplitCash((grandTotalPaise / 100).toString());
                  setSplitUpi('0');
                  setSplitCard('0');
                  setSplitCredit('0');
                }}
                className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 rounded-md border border-slate-300 text-[10px] font-bold cursor-pointer"
              >
                All Cash
              </button>
              <button
                type="button"
                onClick={() => {
                  setSplitCash('0');
                  setSplitUpi((grandTotalPaise / 100).toString());
                  setSplitCard('0');
                  setSplitCredit('0');
                }}
                className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 rounded-md border border-slate-300 text-[10px] font-bold cursor-pointer"
              >
                All UPI
              </button>
            </div>
          </div>
        );
      })()}

      {/* If Cash: Amount Received Input for Change calculation with Quick Tender Chips */}
      {paymentMethod === 'cash' && cart.length > 0 && (() => {
        const totalRupees = Math.ceil(grandTotalPaise / 100);
        const chips: number[] = [totalRupees];
        if (totalRupees % 50 !== 0) {
          const next50 = Math.ceil(totalRupees / 50) * 50;
          if (next50 > totalRupees && !chips.includes(next50)) chips.push(next50);
        } else if (totalRupees % 100 !== 0) {
          const next100 = Math.ceil(totalRupees / 100) * 100;
          if (next100 > totalRupees && !chips.includes(next100)) chips.push(next100);
        }
        const commonNotes = [100, 200, 500, 1000, 2000];
        for (const n of commonNotes) {
          if (n > totalRupees && !chips.includes(n) && chips.length < 5) {
            chips.push(n);
          }
        }

        return (
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700">Cash Tendered / Received:</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="1"
                  placeholder={totalRupees.toString()}
                  value={amountReceivedInput}
                  onChange={(e) => setAmountReceivedInput(e.target.value)}
                  className="w-24 bg-white border border-slate-300 text-slate-900 text-right font-mono font-bold text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-slate-900"
                />
                {amountReceivedInput && (
                  <button
                    type="button"
                    onClick={() => setAmountReceivedInput('')}
                    className="text-slate-400 hover:text-slate-600 text-[10px] font-bold"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Quick Currency Tender Chips */}
            <div className="flex items-center gap-1.5 pt-0.5 overflow-x-auto scrollbar-none">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Tender:</span>
              {chips.map((chip, idx) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setAmountReceivedInput(chip.toString())}
                  className={cn(
                    "px-2 py-0.5 rounded-md font-mono text-[11px] font-bold transition cursor-pointer border shadow-2xs",
                    amountReceivedInput === chip.toString()
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 hover:bg-slate-100 border-slate-300"
                  )}
                >
                  {idx === 0 ? `Exact ₹${chip}` : `₹${chip}`}
                </button>
              ))}
            </div>

            {amountReceivedInput && parseFloat(amountReceivedInput) * 100 > grandTotalPaise && (
              <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center justify-between font-bold text-emerald-900">
                <span>💵 Return Change to Customer:</span>
                <span className="font-mono text-sm font-black text-emerald-700">
                  {formatINR(Math.round(parseFloat(amountReceivedInput) * 100 - grandTotalPaise))}
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {/* If UPI (or Split with UPI): Real-Time Dynamic Amount QR Code Card */}
      {((paymentMethod === 'upi') || (paymentMethod === 'split' && parseFloat(splitUpi || '0') > 0)) && cart.length > 0 && (
        <div className="p-3 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-white rounded-xl border border-slate-700 shadow-md space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
              <QrCode className="w-4 h-4 text-amber-400" />
              <span>Dynamic UPI Payment QR</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-black text-[10px]">
              Exact {formatINR(paymentMethod === 'split' ? Math.round(parseFloat(splitUpi || '0') * 100) : grandTotalPaise)}
            </span>
          </div>

          {posQrDataUrl ? (
            <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-2.5 rounded-lg text-slate-900">
              <div 
                onClick={() => setIsEnlargeQrModalOpen(true)}
                className="relative group cursor-pointer flex-shrink-0"
                title="Click to enlarge QR on counter display"
              >
                <img
                  src={posQrDataUrl}
                  alt="Dynamic UPI QR"
                  className="w-24 h-24 sm:w-28 sm:h-28 object-contain rounded border border-slate-200"
                />
                <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 rounded flex items-center justify-center text-white text-[10px] font-bold transition-opacity">
                  <span>Enlarge 📺</span>
                </div>
              </div>

              <div className="space-y-1 text-center sm:text-left flex-1 min-w-0">
                <div className="text-[11px] font-bold text-slate-800 truncate">
                  Pay to: <b>{business?.name}</b>
                </div>
                <div className="text-xs font-mono font-black text-emerald-700 truncate">
                  {business?.upi_id || ''}
                </div>
                <div className="text-[10px] text-slate-500 font-medium leading-tight">
                  Customer scans with Google Pay, PhonePe, Paytm or BHIM — <b>amount auto-fills instantly</b>.
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEnlargeQrModalOpen(true)}
                    className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-[10.5px] inline-flex items-center gap-1 cursor-pointer transition shadow-2xs"
                  >
                    <QrCode className="w-3 h-3 text-slate-700" />
                    <span>Fullscreen 📺</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const simAmt = (paymentMethod === 'split' ? Math.round(parseFloat(splitUpi || '0') * 100) : grandTotalPaise) / 100;
                      paymentBridge.simulatePayment(simAmt, 'Rahul Sharma', 'PhonePe');
                    }}
                    className="px-2 py-1 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-bold text-[10.5px] inline-flex items-center gap-1 cursor-pointer transition shadow-2xs"
                    title="Simulate incoming PhonePe / Bank SMS payment"
                  >
                    <Sparkles className="w-3 h-3 text-emerald-700" />
                    <span>⚡ Test Pay Received</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-800/80 rounded-lg text-center text-xs text-slate-300 space-y-1">
              <p className="font-bold text-amber-300">No UPI Address Configured</p>
              <p className="text-[11px] text-slate-400">
                Add your UPI ID in Settings to enable real-time dynamic amount QR codes.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Bill-Level Discount Field */}
      {cart.length > 0 && (
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-emerald-600" />
              <span>Bill Discount</span>
            </span>
            <div className="flex items-center p-0.5 bg-slate-200/80 rounded-lg">
              <button
                type="button"
                onClick={() => setBillDiscountType('flat')}
                className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer',
                  billDiscountType === 'flat'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                ₹ Flat
              </button>
              <button
                type="button"
                onClick={() => setBillDiscountType('percentage')}
                className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer',
                  billDiscountType === 'percentage'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                % Percent
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                step="any"
                min="0"
                max={billDiscountType === 'percentage' ? 100 : undefined}
                placeholder={billDiscountType === 'percentage' ? 'e.g. 5 or 10%' : 'e.g. 50'}
                value={billDiscountValue}
                onChange={(e) => setBillDiscountValue(e.target.value)}
                className="w-full bg-white border border-slate-300 text-slate-900 text-xs rounded-lg pl-6 pr-2 py-1.5 focus:outline-none focus:border-slate-900 font-mono font-bold"
              />
              <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">
                {billDiscountType === 'percentage' ? '%' : '₹'}
              </span>
            </div>
            {billDiscountValue && (
              <button
                type="button"
                onClick={() => setBillDiscountValue('')}
                className="text-[11px] text-rose-600 font-bold hover:text-rose-700 px-1.5 py-1 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick Percent Chips */}
          {billDiscountType === 'percentage' && (
            <div className="flex items-center gap-1 pt-0.5">
              {['5', '10', '15', '20'].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setBillDiscountValue(pct)}
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-bold transition-all border cursor-pointer',
                    billDiscountValue === pct
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  )}
                >
                  {pct}%
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      </div>

      {/* Bottom Total & Checkout Button (always visible) */}
      <div className="pt-2.5 mt-2.5 border-t border-slate-200 space-y-2 flex-shrink-0">
        <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>Items Total</span>
            <span className="font-semibold text-slate-800 font-mono">{formatINR(itemsValuePaise)}</span>
          </div>
          {discountTotalPaise > 0 && (
            <div className="flex items-center justify-between text-xs text-emerald-700 font-medium">
              <span>
                Total Discount
                {billDiscountPaise > 0 && (
                  <span className="text-[10px] ml-1 font-mono text-emerald-600">
                    (Bill: -{formatINR(billDiscountPaise)})
                  </span>
                )}
              </span>
              <span className="font-semibold font-mono">-{formatINR(discountTotalPaise)}</span>
            </div>
          )}
          {addedGstPaise > 0 && (
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>GST (added)</span>
              <span className="font-semibold text-slate-800 font-mono">+{formatINR(addedGstPaise)}</span>
            </div>
          )}
          {includedGstPaise > 0 && (
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Incl. GST in prices</span>
              <span className="font-mono">{formatINR(includedGstPaise)}</span>
            </div>
          )}
        </div>

        {/* High-Contrast POS Grand Total & Tender Card */}
        <div className="p-3.5 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white rounded-2xl border border-slate-800 shadow-md space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Total Payable
              </span>
              <span className="text-[11px] font-mono text-slate-400 font-medium">
                {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'} • {cart.reduce((s, i) => s + i.quantity, 0)} units
              </span>
            </div>
            <div className="text-right">
              <div className="text-3xl sm:text-4xl font-black font-mono text-emerald-400 tracking-tight leading-none drop-shadow-sm">
                {formatINR(grandTotalPaise)}
              </div>
              {includedGstPaise > 0 && (
                <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                  (Incl. {formatINR(includedGstPaise)} GST)
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
                          Return Change
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Tendered: {formatINR(tenderedPaise)}
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
                  <span>✓ Exact Cash Tendered</span>
                  <span className="font-mono">{formatINR(tenderedPaise)}</span>
                </div>
              );
            } else {
              return (
                <div className="pt-1.5 mt-1 border-t border-slate-800/80 flex items-center justify-between text-xs text-rose-400 font-bold">
                  <span>⚠️ Short by:</span>
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
              <span>⚠️ Previous Udhar Due:</span>
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
          <span>Complete Sale &amp; Print</span>
          <kbd className="ml-1 px-1.5 py-0.5 rounded bg-emerald-700 text-emerald-100 font-mono text-[10px] font-bold border border-emerald-500">Enter ↵</kbd>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="relative pb-40 lg:pb-2 h-full flex flex-col">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 h-full flex-1 min-h-0">
        {/* Left: Product Selection Catalog */}
        <div className="lg:col-span-7 flex flex-col h-full min-h-0">
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full min-h-0 space-y-3">
            {/* Search & Actions Bar */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="relative flex-1">
                <Input
                  ref={searchInputRef}
                  placeholder="Search products by name, barcode or category... [F2]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search className="w-4 h-4 text-slate-400" />}
                  autoFocus
                />
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 pointer-events-none">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-500 font-mono text-[10px] font-bold">F2</kbd>
                </div>
              </div>

              {/* Barcode Camera Scanner Button (Shown if BARCODE module enabled) */}
              {(
                <button
                  type="button"
                  onClick={() => setIsBarcodeModalOpen(true)}
                  className="p-2 min-h-[38px] min-w-[38px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 flex items-center justify-center cursor-pointer transition-colors"
                  title="Scan Barcode via Camera"
                >
                  <Camera className="w-4 h-4 text-slate-800" />
                </button>
              )}
              
              {(
                <button
                  type="button"
                  onClick={() => setIsRapidScanModeOpen(true)}
                  className="px-3 min-h-[38px] rounded-lg border border-emerald-500 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 flex items-center gap-1.5 font-bold text-xs cursor-pointer shadow-sm transition-all shadow-emerald-500/10"
                  title="Rapid Scan Mode"
                >
                  <PackageOpen className="w-4 h-4" />
                  <span>Rapid</span>
                </button>
              )}

              {/* Hardware Manager Button */}
              <button
                type="button"
                onClick={() => setIsHardwareModalOpen(true)}
                className="p-2 min-h-[38px] min-w-[38px] rounded-lg border border-slate-300 bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center cursor-pointer relative transition-colors"
                title="POS Hardware (Bluetooth Printer, Laser Scanner)"
              >
                <Sliders className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 flex-shrink-0 scrollbar-none">
              <button
                onClick={() => setSelectedCategory('all')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5',
                  selectedCategory === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                )}
              >
                <span>All Items</span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold",
                  selectedCategory === 'all' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                )}>
                  {totalProductCount}
                </span>
              </button>
              {categories.map((cat) => {
                const count = categoryCounts[cat.id] || 0;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 cursor-pointer transition-all',
                      selectedCategory === cat.id
                        ? 'bg-slate-900 text-white font-bold shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    )}
                  >
                    <Tag className="w-3 h-3 text-slate-400" />
                    <span>{cat.name}</span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold",
                      selectedCategory === cat.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Responsive Products Grid */}
            <div className="flex-1 min-h-0" style={{ height: '100%' }}>
              {products.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 border border-dashed border-slate-300 rounded-2xl bg-white p-6 space-y-2.5">
                  <div className="font-bold text-slate-800 text-sm">
                    {totalProductCount === 0 ? 'No products in store catalog' : 'No items match your search'}
                  </div>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    {totalProductCount === 0
                      ? 'Your inventory is currently empty. Click below to load pre-configured starter items.'
                      : 'Try clearing your search query or selecting "All Items".'}
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
                      <span>{isSeedingProducts ? 'Loading Default Items...' : '✨ Load Default Products'}</span>
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
                            showBillingToast(`Out of Stock: "${prod.name}" has 0 stock remaining.`, 'error');
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
          </div>
        </div>

        {/* Right: Checkout Side Panel (Desktop only, 5 cols) */}
        <div className="hidden lg:flex lg:col-span-5 flex-col h-full min-h-0">
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full min-h-0 overflow-hidden">
            {renderCheckoutPanel()}
          </div>
        </div>
      </div>

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
              {tabs.length > 1 ? `Bill #${activeTab.tabNumber} • ` : ''}{totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}
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
          <span>View Cart & Pay</span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      {/* Mobile Checkout Drawer Modal */}
      <Modal
        isOpen={isMobileCartOpen}
        onClose={() => setIsMobileCartOpen(false)}
        title={`POS Checkout — Bill #${activeTab.tabNumber}`}
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

      {/* Quick Add Customer Modal */}
      <Modal
        isOpen={isAddCustomerModalOpen}
        onClose={() => setIsAddCustomerModalOpen(false)}
        title="Quick Add Customer"
        size="md"
      >
        <form onSubmit={handleSaveQuickCustomer} className="space-y-3 p-1">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Customer Name *</label>
            <Input
              placeholder="e.g. Anil Verma"
              value={newCustName}
              onChange={(e) => setNewCustName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">WhatsApp / Phone Number</label>
            <Input
              placeholder="e.g. 9876543210"
              value={newCustPhone}
              onChange={(e) => setNewCustPhone(e.target.value)}
              type="tel"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Address / Landmark</label>
            <Input
              placeholder="e.g. Flat 201, Green Society"
              value={newCustAddress}
              onChange={(e) => setNewCustAddress(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsAddCustomerModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold">
              Save & Select Customer
            </Button>
          </div>
        </form>
      </Modal>

      {/* Quick Add Scanned Product Modal */}
      <Modal
        isOpen={isQuickAddModalOpen}
        onClose={() => setIsQuickAddModalOpen(false)}
        title={`Add Scanned Barcode (${scannedUnknownBarcode || ''})`}
        size="md"
      >
        <form onSubmit={handleSaveQuickAddItem} className="space-y-3 p-1">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Product Name *</label>
            <Input
              value={quickAddName}
              onChange={(e) => setQuickAddName(e.target.value)}
              placeholder="e.g. Parle-G Biscuit 250g"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Selling Price (₹) *</label>
            <Input
              type="number"
              step="0.01"
              value={quickAddPrice}
              onChange={(e) => setQuickAddPrice(e.target.value)}
              placeholder="e.g. 25"
              required
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsQuickAddModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold">
              Save to Catalog & Add to Cart
            </Button>
          </div>
        </form>
      </Modal>

      {/* Barcode Camera Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isBarcodeModalOpen}
        onClose={() => setIsBarcodeModalOpen(false)}
        onScan={handleBarcodeScanned}
      />

      {/* Rapid Scan Mode Screen */}
      <RapidScanMode
        isOpen={isRapidScanModeOpen}
        onClose={() => setIsRapidScanModeOpen(false)}
        onScan={handleBarcodeScanned}
        cart={activeTab.cart}
      />



      {/* Hardware Manager Modal */}
      <HardwareManagerModal
        isOpen={isHardwareModalOpen}
        onClose={() => setIsHardwareModalOpen(false)}
      />

      {/* Invoice Modal for Completed Sale (Success Modal Mode with Dropdown PDF) */}
      {activeSaleForInvoice && (
        <InvoiceModal
          isOpen={isInvoiceModalOpen}
          onClose={() => {
            setIsInvoiceModalOpen(false);
            setActiveSaleForInvoice(null);
          }}
          onNewBill={() => {
            setIsInvoiceModalOpen(false);
            setActiveSaleForInvoice(null);
            setCart([]);
            setAmountReceivedInput('');
            setSelectedCustomerId('');
          }}
          sale={activeSaleForInvoice}
          business={business || null}
          initialPhone={completedSaleDetails?.customerPhone || activeSaleForInvoice.customer_phone || ''}
          isPostSaleSuccess={true}
        />
      )}

      {/* Customer Fullscreen Dynamic UPI QR Modal */}
      <Modal
        isOpen={isEnlargeQrModalOpen}
        onClose={() => setIsEnlargeQrModalOpen(false)}
        title="UPI Payment Counter QR"
        size="md"
      >
        <div className="p-4 flex flex-col items-center text-center space-y-4">
          <div className="space-y-1">
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-950 text-xs font-black uppercase tracking-wider">
              Scan to Pay Exact Amount
            </span>
            <div className="text-3xl font-black text-slate-900 font-mono tracking-tight pt-1">
              {formatINR(paymentMethod === 'split' ? Math.round(parseFloat(splitUpi || '0') * 100) : grandTotalPaise)}
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Paying to: <b className="text-slate-900">{business?.name}</b>{business?.upi_id ? ` (${business.upi_id})` : ''}
            </p>
          </div>

          {posQrDataUrl && (
            <div className="p-3 bg-white rounded-2xl border-2 border-slate-900 shadow-lg">
              <img
                src={posQrDataUrl}
                alt="Dynamic UPI QR"
                className="w-64 h-64 sm:w-72 sm:h-72 object-contain"
              />
            </div>
          )}

          {/* Supported UPI Apps Row */}
          <div className="space-y-1.5 w-full pt-1">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Accepted on Any UPI App
            </div>
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-700 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">Google Pay</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">PhonePe</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">Paytm</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">BHIM</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">CRED</span>
            </div>
          </div>

          <div className="w-full pt-2 flex justify-center">
            <Button
              onClick={() => setIsEnlargeQrModalOpen(false)}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-6 py-2 rounded-xl"
            >
              Done / Payment Received
            </Button>
          </div>
        </div>
      </Modal>

      {/* Top-Tier Payment Celebration Modal */}
      {celebrationPayment && (
        <PaymentCelebrationModal
          isOpen={isCelebrationOpen}
          onClose={() => {
            setIsCelebrationOpen(false);
            setCelebrationPayment(null);
          }}
          payment={celebrationPayment}
          storeName={business?.name || 'Your Store'}
          invoiceNumber={activeSaleForInvoice?.invoice_number}
          onPrintReceipt={() => {
            if (activeSaleForInvoice) {
              setIsInvoiceModalOpen(true);
            }
          }}
        />
      )}

      {/* Floating In-App Toast Notification */}
      {billingToast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-bold flex items-center gap-2.5 animate-in slide-in-from-bottom-3 duration-200 ${
          billingToast.type === 'success'
            ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-100 shadow-emerald-950/40'
            : billingToast.type === 'info'
            ? 'bg-slate-900/95 border-slate-700 text-slate-100 shadow-slate-950/40'
            : 'bg-rose-950/95 border-rose-500/50 text-rose-100 shadow-rose-950/40'
        }`}>
          {billingToast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {billingToast.type === 'info' && <Sparkles className="w-4 h-4 text-sky-400 shrink-0 animate-pulse" />}
          {billingToast.type === 'error' && <span className="text-sm shrink-0">⚠️</span>}
          <span>{billingToast.message}</span>
        </div>
      )}
    </div>
  );
}
