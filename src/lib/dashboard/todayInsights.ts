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

/** Day Summary "counter pace" (v4.93.0): average bill, the busiest hour, the first and last bill. */
export interface CounterPace {
  bills: number;
  averagePaise: number;
  busiestHour: number | null;
  busiestBills: number;
  firstAt: Date | null;
  lastAt: Date | null;
}

export function counterPace(sales: Pick<Sale, 'created_at'>[], netSalesPaise: number): CounterPace {
  const times = sales.map((s) => new Date(s.created_at)).filter((d) => !isNaN(d.getTime())).sort((a, b) => a.getTime() - b.getTime());
  const perHour = new Map<number, number>();
  times.forEach((d) => perHour.set(d.getHours(), (perHour.get(d.getHours()) || 0) + 1));
  let busiestHour: number | null = null;
  let busiestBills = 0;
  Array.from(perHour.entries()).sort((a, b) => a[0] - b[0]).forEach(([h, n]) => {
    if (n > busiestBills) {
      busiestHour = h;
      busiestBills = n;
    }
  });
  return {
    bills: times.length,
    averagePaise: times.length ? Math.round(netSalesPaise / times.length) : 0,
    busiestHour,
    busiestBills,
    firstAt: times[0] || null,
    lastAt: times[times.length - 1] || null,
  };
}

/** 18 → "6 pm–7 pm" (the earliest hour wins a tie). */
export function hourRangeLabel(h: number): string {
  const f = (x: number) => `${((x + 11) % 12) + 1} ${x % 24 < 12 ? 'am' : 'pm'}`;
  return `${f(h)}–${f((h + 1) % 24)}`;
}
