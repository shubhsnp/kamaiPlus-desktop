import type { Customer, Sale } from '@/types';

/** Home "Today at a glance" (v4.93.0): what sold most today and who owes the most. */

export interface TopItem {
  productId: string;
  name: string;
  unit: string;
  quantity: number;
  amountPaise: number;
}

/** Today's bills' lines added up per item, biggest takings first (ties: more sold first). */
export function topItemsToday(sales: Pick<Sale, 'items'>[], limit = 5): TopItem[] {
  const byItem = new Map<string, TopItem>();
  for (const sale of sales) {
    for (const line of sale.items || []) {
      const key = line.product_id || line.product_name;
      const row = byItem.get(key) || { productId: line.product_id, name: line.product_name, unit: line.unit || '', quantity: 0, amountPaise: 0 };
      row.quantity = Math.round((row.quantity + (Number(line.quantity) || 0)) * 1000) / 1000;
      row.amountPaise += Math.round(Number(line.total_amount) || 0);
      byItem.set(key, row);
    }
  }
  return Array.from(byItem.values())
    .filter((r) => r.amountPaise > 0)
    .sort((a, b) => b.amountPaise - a.amountPaise || b.quantity - a.quantity)
    .slice(0, limit);
}

/** Customers with udhar, biggest first. */
export function topDebtors(customers: Pick<Customer, 'id' | 'name' | 'phone' | 'current_balance'>[], limit = 5) {
  return customers
    .filter((c) => (c.current_balance || 0) > 0)
    .sort((a, b) => (b.current_balance || 0) - (a.current_balance || 0))
    .slice(0, limit);
}
