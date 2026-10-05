import React, { useEffect } from 'react';
import { nextBillTabId } from '@/lib/billing/billTabs';
import { isFeatureOn } from '@/lib/features/featureSwitches';
import { tr } from '@/lib/i18n/core';
import type { BillTab } from '@/lib/billing/billTabs';
import type { CartItem, PaymentMethod, Product } from '@/types';

export interface UsePosKeyboardDeps {
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  searchInputRef: React.RefObject<HTMLInputElement>;
  setHighlightedIndex: React.Dispatch<React.SetStateAction<number>>;
  highlightedIndex: number;
  showBillingToast: (message: string, type?: "success" | "info" | "error") => void;
  tabs: BillTab[];
  setActiveTabId: React.Dispatch<React.SetStateAction<string>>;
  activeTabId: string;
  cart: CartItem[];
  setPaymentMethod: (method: PaymentMethod) => void;
  handleCreateNewTab: () => void;
  products: any[];
  variantPick: { parent: Product; qty: number; } | null;
  handleCompleteSale: () => Promise<void>;
  handleSearchEnter: () => Promise<void>;
  counterCovered: boolean;
  onlySaleWindowOpen: boolean;
}

/**
 * The counter's keyboard (v4.104.0, K-D23 — moved out of app/billing/page.tsx unchanged): F1 / F2 /
 * Ctrl+1…9 bills, / search, F4 / F8 / F9 payment (with the switch on), F10 / Enter complete, Esc,
 * arrows in the results, 1–9 in the variant picker. Nothing fires while a window covers the counter.
 */
export function usePosKeyboard(deps: UsePosKeyboardDeps) {
  const {
    searchQuery, setSearchQuery, searchInputRef, setHighlightedIndex, highlightedIndex, showBillingToast,
    tabs, setActiveTabId, activeTabId, cart, setPaymentMethod, handleCreateNewTab,
    products, variantPick, handleCompleteSale, handleSearchEnter, counterCovered, onlySaleWindowOpen,
  } = deps;
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
}
