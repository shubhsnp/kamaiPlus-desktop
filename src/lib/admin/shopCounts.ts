import { db } from '@/lib/db';
import { isEstimate } from '@/lib/sales/saleMath';
import { cloudSendActive } from '@/lib/cloud/cloudPush';
import type { ShopCounts } from '@/lib/desktop/desktopBridge';

/**
 * The counts this computer reports to the Admin Console at its hourly licence check-in
 * (v4.98.0, adminLink.js). Counts only — never names, amounts or bills. Estimates are not
 * bills. Bills are read by the created_at index (today / last 7 days), so a big history
 * costs nothing.
 */
export async function collectShopCounts(now: Date = new Date()): Promise<ShopCounts> {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
  const realBill = (s: { status?: string; invoice_number?: string }) => !isEstimate(s as never);
  const [billsToday, bills7d, products, customers, newest] = await Promise.all([
    db.sales.where('created_at').aboveOrEqual(startOfToday.toISOString()).filter(realBill).count(),
    db.sales.where('created_at').aboveOrEqual(weekAgo.toISOString()).filter(realBill).count(),
    db.products.count(),
    db.customers.count(),
    db.sales.orderBy('created_at').last(),
  ]);
  return {
    bills_today: billsToday,
    bills_7d: bills7d,
    products,
    customers,
    last_bill_at: newest?.created_at || null,
    cloud_sync: cloudSendActive(),
  };
}
