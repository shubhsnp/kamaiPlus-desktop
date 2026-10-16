import React from 'react';
import { db } from '@/lib/db';
import type { Business, Category, Product } from '@/types';
import { BillTab, makeEmptyTab } from '@/lib/billing/billTabs';
import { buildCustomItem } from '@/lib/billing/customItem';
import { isFeatureOn } from '@/lib/features/featureSwitches';
import { countsStockAtCounter } from '@/lib/billing/stockRule';
import { linesShortOfStock, parseStaffCart, STAFF_CART_OPEN_EVENT, STAFF_CART_PENDING_KEY, type StaffCart } from '@/lib/cloud/counterCarts';
import { tr } from '@/lib/i18n/core';

export interface StaffCartPickupDeps {
  setTabs: React.Dispatch<React.SetStateAction<BillTab[]>>;
  setActiveTabId: (id: string) => void;
  activeTabId: string;
  addToCart: (product: Product, quantityToAdd?: number) => void;
  business: Business | undefined;
  categories: Category[];
  showBillingToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

/** The cart the counter took (StaffCartInbox), read once; null when there is none. */
export function takePendingStaffCart(): StaffCart | null {
  try {
    const raw = localStorage.getItem(STAFF_CART_PENDING_KEY);
    localStorage.removeItem(STAFF_CART_PENDING_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    return parseStaffCart(String(c?.id || ''), {
      staff_id: c.staffId, staff_name: c.staffName, created_at: c.createdAt, total_paise: c.totalPaise,
      customer_name: c.customerName, customer_phone: c.customerPhone, status: c.status,
      lines: (c.lines || []).map((l: any) => ({ product_id: l.productId, name: l.name, qty: l.qty, unit_price_paise: l.unitPricePaise, unit: l.unit })),
    });
  } catch {
    return null;
  }
}

/**
 * "Send to counter" (v4.173.0): a cart from a staff phone opens here as a NEW bill — the bill the
 * counter was on stays as it was. Items go in through the counter's own addToCart (this PC's price,
 * GST, stock checks); an item this PC does not have becomes a Custom Item at the phone's price.
 */
export function useStaffCartPickup(deps: StaffCartPickupDeps) {
  const { setTabs, setActiveTabId, activeTabId, addToCart, business, categories, showBillingToast } = deps;
  const [pending, setPending] = React.useState<{ tabId: string; cart: StaffCart } | null>(null);

  React.useEffect(() => {
    const pick = () => {
      const cart = takePendingStaffCart();
      if (!cart) return;
      const tabId = `tab_staff_${Date.now()}`;
      setTabs((prev) => {
        const tab = makeEmptyTab(tabId, prev.reduce((m, t) => Math.max(m, t.tabNumber), 0) + 1);
        return [...prev, { ...tab, customerName: cart.customerName || '', customerPhone: cart.customerPhone || '' }];
      });
      setActiveTabId(tabId);
      setPending({ tabId, cart });
    };
    pick();
    window.addEventListener(STAFF_CART_OPEN_EVENT, pick);
    return () => window.removeEventListener(STAFF_CART_OPEN_EVENT, pick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!pending || activeTabId !== pending.tabId) return;
    const { cart } = pending;
    setPending(null);
    void (async () => {
      const found = (await db.products.bulkGet(cart.lines.map((l) => l.productId || '-'))) as (Product | undefined)[];
      const products = cart.lines.map((line, i) => (found[i] && found[i]!.is_active !== false ? found[i]! : null));
      const stockOn = isFeatureOn('stock_counting');
      const short = linesShortOfStock(cart.lines, (i) => {
        const p = products[i];
        return p && !p.has_variants && countsStockAtCounter(p, stockOn) ? Number(p.current_stock ?? 0) : null;
      });
      cart.lines.forEach((line, i) => {
        const product = products[i] || buildCustomItem({
          name: line.name, pricePaise: line.unitPricePaise, businessId: business?.id || '', categories, save: false,
        });
        addToCart(product, line.qty);
      });
      // A line this PC's stock could not take is told in the last toast — it used to hide that one.
      if (short.length) showBillingToast(tr("{name}'s cart is open — not added (low stock here): {items}. Check the stock and add them by hand.", { name: cart.staffName, items: short.join(', ') }), 'error');
      else showBillingToast(tr("{name}'s cart is open as a new bill — check it and complete the sale.", { name: cart.staffName }), 'success');
    })();
  }, [pending, activeTabId, addToCart, business, categories, showBillingToast]);
}
