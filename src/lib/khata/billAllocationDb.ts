import { db } from '@/lib/db';
import { BillAllocation } from '@/types';
import { applyPaymentToBill, openBillsOldestFirst, planBillAllocation } from './billAllocation';

/** Clears the customer's unpaid bills (oldest first) with a khata payment; returns what went where. */
export async function allocatePaymentToOpenBills(customerId: string, amountPaise: number, now: string): Promise<BillAllocation[]> {
  const sales = await db.sales.where('customer_id').equals(customerId).toArray();
  const byId = new Map(sales.map((s) => [s.id, s]));
  const plan = planBillAllocation(openBillsOldestFirst(sales, customerId), amountPaise);
  for (const a of plan) {
    const sale = byId.get(a.sale_id);
    if (sale) await db.sales.put(applyPaymentToBill(sale, a.amount, now));
  }
  return plan;
}

/** Takes a deleted / edited payment back off the bills it had cleared. */
export async function undoBillAllocations(allocations: BillAllocation[] | undefined, now: string): Promise<void> {
  for (const a of allocations || []) {
    const sale = await db.sales.get(a.sale_id);
    if (sale) await db.sales.put(applyPaymentToBill(sale, -a.amount, now));
  }
}
