'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { BillPrinterSetup } from '@/components/billing/BillPrinterSetup';
import { PosItemEditModal } from '@/components/billing/PosItemEditModal';
import { VariantPickerModal } from '@/components/billing/VariantPickerModal';
import { FullscreenUpiQrModal, QuickAddScannedProductModal } from '@/components/billing/PosDialogs';
import type { CustomerDraft } from '@/lib/billing/billCustomer';
import type { Business, CartItem, Customer, PaymentMethod, Product, Sale } from '@/types';

// "Sale completed" is a heavy window: loaded the first time it opens.
const InvoiceModal = dynamic(
  () => import('@/components/invoices/InvoiceModal').then((m) => m.InvoiceModal),
  { ssr: false }
);

export interface PosCounterDialogsProps {
  silentPrint: boolean;
  setAutoPrint: (next: boolean) => void;
  isBillPrinterOpen: boolean;
  setIsBillPrinterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  paymentMethod: PaymentMethod;
  splitUpi: string;
  customerDraft: CustomerDraft;
  editingCartItem: CartItem | null;
  setEditingCartItem: React.Dispatch<React.SetStateAction<CartItem | null>>;
  editItemQty: string;
  setEditItemQty: React.Dispatch<React.SetStateAction<string>>;
  editItemPrice: string;
  setEditItemPrice: React.Dispatch<React.SetStateAction<string>>;
  editItemDiscount: string;
  setEditItemDiscount: React.Dispatch<React.SetStateAction<string>>;
  editItemDiscountType: "flat" | "percentage";
  setEditItemDiscountType: React.Dispatch<React.SetStateAction<"flat" | "percentage">>;
  isInvoiceModalOpen: boolean;
  setIsInvoiceModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeSaleForInvoice: Sale | null;
  setActiveSaleForInvoice: React.Dispatch<React.SetStateAction<Sale | null>>;
  isQuickAddModalOpen: boolean;
  setIsQuickAddModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  scannedUnknownBarcode: string | null;
  quickAddPrice: string;
  setQuickAddPrice: React.Dispatch<React.SetStateAction<string>>;
  quickAddName: string;
  setQuickAddName: React.Dispatch<React.SetStateAction<string>>;
  completedSaleDetails: any;
  posQrDataUrl: string;
  isEnlargeQrModalOpen: boolean;
  setIsEnlargeQrModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  business: Business | undefined;
  variantPick: { parent: Product; qty: number; } | null;
  setVariantPick: React.Dispatch<React.SetStateAction<{ parent: Product; qty: number; } | null>>;
  selectedCustomer: Customer | undefined;
  getTotalCartQuantityForProduct: (productId: string, productName?: string | undefined) => number;
  addToCart: (product: Product, quantityToAdd?: number) => void;
  handleSaveEditItem: (extra?: Pick<CartItem, 'imei_serial' | 'warranty_period_months'>) => void;
  focusProductSearch: () => number;
  handleSaveQuickAddItem: (e: React.FormEvent) => Promise<void>;
  grandTotalPaise: number;
}

/**
 * The windows that open over the counter (v4.104.0, K-D23 — moved out of app/billing/page.tsx
 * unchanged): size / colour picker, line edit, bill printer setup, add-a-scanned-item, "Sale
 * completed" (InvoiceModal) and the big UPI QR.
 */
export function PosCounterDialogs(props: PosCounterDialogsProps) {
  const {
    silentPrint, setAutoPrint, isBillPrinterOpen, setIsBillPrinterOpen, paymentMethod, splitUpi,
    customerDraft, editingCartItem, setEditingCartItem, editItemQty, setEditItemQty, editItemPrice,
    setEditItemPrice, editItemDiscount, setEditItemDiscount, editItemDiscountType, setEditItemDiscountType, isInvoiceModalOpen,
    setIsInvoiceModalOpen, activeSaleForInvoice, setActiveSaleForInvoice, isQuickAddModalOpen, setIsQuickAddModalOpen, scannedUnknownBarcode,
    quickAddPrice, setQuickAddPrice, quickAddName, setQuickAddName, completedSaleDetails, posQrDataUrl,
    isEnlargeQrModalOpen, setIsEnlargeQrModalOpen, business, variantPick, setVariantPick, selectedCustomer,
    getTotalCartQuantityForProduct, addToCart, handleSaveEditItem, focusProductSearch, handleSaveQuickAddItem, grandTotalPaise,
  } = props;
  return (
    <>
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
    </>
  );
}
