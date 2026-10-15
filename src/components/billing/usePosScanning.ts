import React from 'react';
import { db } from '@/lib/db';
import { Product } from '@/types';
import { useHardwareBarcodeScanner } from '@/lib/hardware/barcodeScannerListener';
import { parseWeighedBarcode, weighedQuantity } from '@/lib/barcode/weighedBarcode';
import { parseScaleEan13 } from '@/lib/billing/scanInput';
import { useStaffCartPickup, type StaffCartPickupDeps } from '@/components/billing/useStaffCartPickup';
import { generalCategoryId } from '@/lib/products/defaultCategory';
import type { Business, Category, Sale } from '@/types';

export interface UsePosScanningDeps extends Omit<StaffCartPickupDeps, 'addToCart' | 'business' | 'categories'> {
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  searchInputRef: React.RefObject<HTMLInputElement>;
  isBillPrinterOpen: boolean;
  isInvoiceModalOpen: boolean;
  setIsInvoiceModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveSaleForInvoice: React.Dispatch<React.SetStateAction<Sale | null>>;
  setIsQuickAddModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setScannedUnknownBarcode: React.Dispatch<React.SetStateAction<string | null>>;
  scannedUnknownBarcode: string | null;
  setQuickAddPrice: React.Dispatch<React.SetStateAction<string>>;
  quickAddPrice: string;
  setQuickAddName: React.Dispatch<React.SetStateAction<string>>;
  quickAddName: string;
  business: Business | undefined;
  categories: Category[];
  variantPick: { parent: Product; qty: number; } | null;
  addToCart: (product: Product, quantityToAdd?: number) => void;
}

/**
 * Scanning at the counter (v4.104.0, K-D23 — moved out of app/billing/page.tsx unchanged): a code from
 * the gun, camera or search box (weighed-item codes too) adds its item or offers "add new item"; the
 * key-timing scanner listener; saving that new item from the quick-add window.
 */
export function usePosScanning(deps: UsePosScanningDeps) {
  const {
    setSearchQuery, searchInputRef, isBillPrinterOpen, isInvoiceModalOpen, setIsInvoiceModalOpen, setActiveSaleForInvoice,
    setIsQuickAddModalOpen, setScannedUnknownBarcode, scannedUnknownBarcode, setQuickAddPrice, quickAddPrice, setQuickAddName,
    quickAddName, business, categories, variantPick, addToCart,
  } = deps;
  // A cart sent from a staff phone arrives like a scan: into a new bill (v4.173.0).
  useStaffCartPickup(deps);
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
      // A weighing scale's own EAN-13 (prefix 20 / 21: item code + grams). The grams become the
      // item's own unit — 0.25 for a kg item, 250 for a gram item (v4.171.0; it was always kg).
      const scaleBar = parseScaleEan13(clean);
      if (scaleBar) {
        let scaleProduct: Product | undefined;
        for (const candidate of scaleBar.pluCandidates) {
          scaleProduct = await db.products.where('barcode').equals(candidate).first();
          if (scaleProduct) break;
        }
        const scaleQty = scaleProduct ? weighedQuantity(scaleProduct.unit, scaleBar.grams) : null;
        if (scaleProduct && scaleQty) {
          addToCart(scaleProduct, scaleQty);
          focusProductSearch();
          return;
        }
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

  return { handleBarcodeScanned, focusProductSearch, handleSaveQuickAddItem };
}
