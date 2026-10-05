import React, { useEffect, useState } from 'react';
import { CartItem, PaymentMethod } from '@/types';
import { PriceMode } from '@/lib/billing/priceMode';
import { CustomerDraft } from '@/lib/billing/billCustomer';
import { scrollIntoContainer } from '@/lib/billing/cartFocus';
import { BillTab, DiscardedBill, getInitialTabs, makeEmptyTab, tabsAfterClosing, tabsForNewBill, TABS_STORAGE_KEY } from '@/lib/billing/billTabs';

/**
 * The open bills on the counter (v4.104.0, K-D23 — moved out of app/billing/page.tsx unchanged): the
 * tabs (kept in localStorage), the active bill's fields and their setters, new / hold / close / clear
 * (with Undo), F1-from-another-page, and scrolling the payment details into view.
 */
export function usePosBillTabs() {
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

  return { tabs, setTabs, activeTabId, setActiveTabId, activeTab, cart, selectedCustomerId, paymentMethod, amountReceivedInput, splitCash, splitUpi, splitCard, splitCredit, billDiscountType, billDiscountValue, priceMode, priceModeRef, activeTabIdRef, updateActiveTab, setCart, customerDraft, setCustomerDraft, setPaymentMethod, setAmountReceivedInput, setSplitCash, setSplitUpi, setSplitCard, setSplitCredit, setBillDiscountType, setBillDiscountValue, handleCreateNewTab, handleHoldActiveTab, discardedBill, setDiscardedBill, keepForUndo, handleClearCart, billScrollRef, handleCloseTab };
}
