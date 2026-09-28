import { CartItem, PaymentMethod } from '@/types';

/** Open POS bills (tabs) and their localStorage persistence — moved out of app/billing/page.tsx. */
export interface BillTab {
  id: string;
  tabNumber: number;
  cart: CartItem[];
  selectedCustomerId: string;
  /** Typed on the counter row when no saved customer is picked; saved with the bill. */
  customerName?: string;
  customerPhone?: string;
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
    customerName: '',
    customerPhone: '',
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

/** A cart line at a new quantity, its totals worked out again (the POS supplies the tax rule). */
export type RetotalLine = (line: CartItem, quantity: number) => CartItem;

/**
 * What is in the bill beyond what was sold — items scanned for the next customer while
 * the finished bill was still being saved (v4.74.0). A line sold as 2 and now 3 gives 1.
 */
export function cartBeyond(current: CartItem[], sold: CartItem[], retotal: RetotalLine): CartItem[] {
  const out: CartItem[] = [];
  for (const line of current) {
    const soldQty = sold.filter((s) => s.product_id === line.product_id).reduce((a, s) => a + s.quantity, 0);
    const extra = Math.round((line.quantity - soldQty) * 1000) / 1000;
    if (extra <= 0) continue;
    out.push(soldQty > 0 ? retotal({ ...line, discount_amount: 0 }, extra) : line);
  }
  return out;
}

/**
 * Close a finished bill (like tabsAfterClosing) without losing anything scanned while it
 * was being saved: those items move into the bill the counter goes to next.
 */
export function tabsAfterSale(tabs: BillTab[], doneId: string, sold: CartItem[], newId: string, retotal: RetotalLine): { tabs: BillTab[]; activeTabId: string } {
  const done = tabs.find((t) => t.id === doneId);
  const extra = done ? cartBeyond(done.cart, sold, retotal) : [];
  const next = tabsAfterClosing(tabs, doneId, newId);
  if (extra.length === 0) return next;
  return {
    activeTabId: next.activeTabId,
    tabs: next.tabs.map((t) => {
      if (t.id !== next.activeTabId) return t;
      let cart = t.cart;
      for (const line of extra) {
        const same = cart.find((c) => c.product_id === line.product_id);
        cart = same ? cart.map((c) => (c === same ? retotal(c, c.quantity + line.quantity) : c)) : [...cart, line];
      }
      return { ...t, cart };
    }),
  };
}

/** A bill with nothing typed into it yet (no items, customer, discount or cash). */
export const isBlankTab = (t: BillTab) =>
  t.cart.length === 0 && !(t.customerName || '').trim() && !(t.customerPhone || '').trim() && !t.selectedCustomerId && !t.billDiscountValue && !t.amountReceivedInput;

/**
 * F1 from any page (v4.78.0): the counter opens on a fresh bill. A blank, not-held bill that
 * is already open is used (no pile of empty tabs); otherwise a new bill is added and the
 * others — a waiting customer's bill, held bills — stay as they are.
 */
export function tabsForNewBill(tabs: BillTab[], activeTabId: string, newId: string): { tabs: BillTab[]; activeTabId: string } {
  const active = tabs.find((t) => t.id === activeTabId);
  if (active && !active.isHeld && isBlankTab(active)) return { tabs, activeTabId };
  const blank = tabs.find((t) => !t.isHeld && isBlankTab(t));
  if (blank) return { tabs, activeTabId: blank.id };
  const tabNumber = tabs.reduce((max, t) => Math.max(max, t.tabNumber), 0) + 1;
  return { tabs: [...tabs, makeEmptyTab(newId, tabNumber)], activeTabId: newId };
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
