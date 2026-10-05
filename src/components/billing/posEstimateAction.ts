import React from 'react';
import { showAlert } from '@/lib/ui/dialogs';
import { buildEstimateSale, ESTIMATE_PREFIX, nextEstimateNumber } from '@/lib/billing/estimate';
import { db, ensureStarterBusinessIfEmpty } from '@/lib/db';
import { playBeepSound } from '@/lib/voice/speechParser';
import { focusPosCustomerName } from '@/components/billing/PosCustomerRow';
import { isDraftEmpty, resolveBillCustomer } from '@/lib/billing/billCustomer';
import { cloudSyncSoon } from '@/lib/firebase/lazyCloud';
import { newId } from '@/lib/ids';
import { tabsAfterClosing, tabsAfterSale } from '@/lib/billing/billTabs';
import { isFeatureOn } from '@/lib/features/featureSwitches';
import { tr } from '@/lib/i18n/core';
import type { CustomerDraft } from '@/lib/billing/billCustomer';
import type { BillTab } from '@/lib/billing/billTabs';
import type { PriceMode } from '@/lib/billing/priceMode';
import type { Business, CartItem, Customer, Sale } from '@/types';

/** The last estimate number handed out on this PC (see nextEstimateNumber). */
export const ESTIMATE_SEQ_KEY = 'kamai_last_estimate_seq';


export interface CreateEstimateActionDeps {
  completingSaleRef: React.MutableRefObject<boolean>;
  showBillingToast: (message: string, type?: "success" | "info" | "error" | undefined) => void;
  tabs: BillTab[];
  searchInputRef: React.RefObject<HTMLInputElement>;
  cart: CartItem[];
  activeTabId: string;
  selectedCustomerId: string;
  setTabs: React.Dispatch<React.SetStateAction<BillTab[]>>;
  setActiveTabId: React.Dispatch<React.SetStateAction<string>>;
  priceMode: PriceMode;
  customerDraft: CustomerDraft;
  activeTabIdRef: React.MutableRefObject<string>;
  setIsMobileCartOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCompletedSaleDetails: React.Dispatch<any>;
  setActiveSaleForInvoice: React.Dispatch<React.SetStateAction<Sale | null>>;
  setIsInvoiceModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleOpenEditItem: (item: CartItem) => void;
  selectedCustomer: Customer | undefined;
  business: Business | undefined;
  billLines: CartItem[];
  retotalLine: (line: CartItem, quantity: number) => CartItem;
  subtotalPaise: number;
  discountTotalPaise: number;
  taxTotalPaise: number;
  grandTotalPaise: number;
}

/**
 * Estimate / quotation from the counter (v4.102.0, K-D07; own file since v4.104.0, K-D23):
 * the bill as priced, saved with an EST- number — no stock, khata or cash.
 */
export function createEstimateAction(deps: CreateEstimateActionDeps) {
  const {
    completingSaleRef, showBillingToast, tabs, searchInputRef, cart, activeTabId,
    selectedCustomerId, setTabs, setActiveTabId, priceMode, customerDraft, activeTabIdRef,
    setIsMobileCartOpen, setCompletedSaleDetails, setActiveSaleForInvoice, setIsInvoiceModalOpen, handleOpenEditItem, selectedCustomer,
    business, billLines, retotalLine, subtotalPaise, discountTotalPaise, taxTotalPaise,
    grandTotalPaise,
  } = deps;
  // Estimate / quotation (v4.102.0, K-D07, lib/billing/estimate.ts): the bill as priced, saved with an
  // EST- number — no stock, khata or cash. Transactions → "Convert to Bill" makes it a tax invoice.
  const handleSaveEstimate = async () => {
    if (cart.length === 0 || completingSaleRef.current) return;
    const unpriced = cart.find((line) => !(line.unit_price > 0));
    if (unpriced) {
      playBeepSound('alert');
      showBillingToast(tr('Enter the price of "{name}" — it has no price yet.', { name: unpriced.product_name }), 'error');
      handleOpenEditItem(unpriced);
      return;
    }
    completingSaleRef.current = true;
    try {
      const soldTabId = activeTabId;
      const soldCart = cart;
      let customer: Parameters<typeof buildEstimateSale>[0]['customer'] = selectedCustomer || (selectedCustomerId ? await db.customers.get(selectedCustomerId) : undefined);
      if (!customer && !isDraftEmpty(customerDraft)) {
        const typed = resolveBillCustomer(await db.customers.toArray(), customerDraft);
        if (typed.kind === 'error') {
          playBeepSound('alert');
          showBillingToast(typed.message, 'error');
          focusPosCustomerName(typed.field);
          return;
        }
        // Someone new is only named on the estimate — saved as a customer when it becomes a bill.
        customer = typed.kind === 'existing' ? typed.customer : undefined;
        if (typed.kind === 'new') customer = { name: typed.name, phone: typed.phone || undefined };
      }
      const currentBiz = business || (await ensureStarterBusinessIfEmpty());
      const businessId = currentBiz?.id || 'biz_default';
      let floor = 0;
      try { floor = Number(localStorage.getItem(ESTIMATE_SEQ_KEY)) || 0; } catch { /* no storage: the saved estimates decide */ }
      const est = nextEstimateNumber((await db.sales.where('invoice_number').startsWithIgnoreCase(ESTIMATE_PREFIX).keys()) as string[], floor);
      const estimate = buildEstimateSale({
        id: newId('sale'), businessId, estimateNumber: est.number, customer,
        items: billLines, subtotal: subtotalPaise, discountTotal: discountTotalPaise, taxTotal: taxTotalPaise, grandTotal: grandTotalPaise,
        priceMode: isFeatureOn('wholesale_price') ? priceMode : 'retail', now: new Date().toISOString(),
      });
      await db.sales.put(estimate);
      try { localStorage.setItem(ESTIMATE_SEQ_KEY, String(est.seq)); } catch { /* see above */ }
      void cloudSyncSoon(businessId);

      const newTabId = `tab_${Date.now()}`;
      const nextTabId = tabsAfterClosing(tabs, soldTabId, newTabId).activeTabId;
      setTabs((prev) => tabsAfterSale(prev, soldTabId, soldCart, newTabId, retotalLine).tabs);
      setActiveTabId(nextTabId);
      activeTabIdRef.current = nextTabId;
      setIsMobileCartOpen(false);
      setCompletedSaleDetails({ invoiceNumber: est.number, customerName: customer?.name, customerPhone: customer?.phone, grandTotalPaise, balanceDuePaise: 0, items: [...soldCart] });
      setActiveSaleForInvoice(estimate);
      searchInputRef.current?.blur();
      setIsInvoiceModalOpen(true);
    } catch (estErr) {
      console.error('Saving the estimate failed:', estErr);
      showAlert(tr('Could not save the estimate. Please try again.'));
    } finally {
      completingSaleRef.current = false;
    }
  };

  return { handleSaveEstimate };
}
