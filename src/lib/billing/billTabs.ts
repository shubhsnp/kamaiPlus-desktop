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

export function getInitialTabs(): { tabs: BillTab[]; activeTabId: string } {
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
