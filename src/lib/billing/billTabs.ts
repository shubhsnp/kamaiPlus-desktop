import { CartItem, PaymentMethod } from '@/types';

/** Open POS bills (tabs) and their localStorage persistence — moved out of app/billing/page.tsx. */
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

export const TABS_STORAGE_KEY = 'kamai_pos_tabs';

/** A blank bill: no items, no customer, cash, no split amounts, no discount. */
export function makeEmptyTab(id: string, tabNumber: number): BillTab {
  return {
    id,
    tabNumber,
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
}

/**
 * After a bill is completed (or closed): drop it and show a bill that is waiting
 * — never a held one, whose items would otherwise get mixed into the next sale —
 * or a fresh blank bill. Nothing of the finished bill (customer, discount, split
 * amounts, payment mode) carries over to the next customer.
 */
export function tabsAfterClosing(tabs: BillTab[], doneId: string, newId: string): { tabs: BillTab[]; activeTabId: string } {
  const remaining = tabs.filter((t) => t.id !== doneId);
  const waiting = remaining.find((t) => !t.isHeld);
  if (waiting) return { tabs: remaining, activeTabId: waiting.id };
  const nextNumber = remaining.length ? Math.max(...remaining.map((t) => t.tabNumber)) + 1 : 1;
  const fresh = makeEmptyTab(newId, nextNumber);
  return { tabs: [...remaining, fresh], activeTabId: fresh.id };
}

export function getInitialTabs(): { tabs: BillTab[]; activeTabId: string } {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(TABS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Open on a bill that is waiting, not on a held one.
          const waiting = parsed.find((t: BillTab) => !t.isHeld);
          return { tabs: parsed, activeTabId: (waiting || parsed[0]).id };
        }
      }
    } catch {}
  }
  return { tabs: [makeEmptyTab('tab_1', 1)], activeTabId: 'tab_1' };
}
