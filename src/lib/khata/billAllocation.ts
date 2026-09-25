import { BillAllocation, Sale } from '@/types';
import { isEstimate } from '@/lib/sales/saleMath';

/*
 * A khata payment clears the customer's unpaid bills, oldest first, so each
 * bill's "Due" matches the khata. The payment itself is counted as khata cash on
 * the day it was received (cashDrawer.ts); the bill keeps its original udhar in
 * `balance_due_at_sale`, so it never turns into a cash sale on the bill's date.
 * All amounts are integer paise.
 */

/** Unpaid real bills of one customer, oldest first. */
export function openBillsOldestFirst(sales: Sale[], customerId: string): Sale[] {
  return sales
    .filter((s) => s.customer_id === customerId && !isEstimate(s) && s.status !== 'cancelled' && (s.balance_due || 0) > 0)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** How `amountPaise` spreads over the bills (any excess is advance, not allocated). */
export function planBillAllocation(openBills: Sale[], amountPaise: number): BillAllocation[] {
  const out: BillAllocation[] = [];
  let left = Math.max(0, Math.round(amountPaise));
  for (const sale of openBills) {
    if (left <= 0) break;
    const take = Math.min(left, sale.balance_due || 0);
    if (take > 0) {
      out.push({ sale_id: sale.id, amount: take });
      left -= take;
    }
  }
  return out;
}

/** A bill after `amountPaise` of it is paid (negative = a payment taken back). */
export function applyPaymentToBill(sale: Sale, amountPaise: number, now: string): Sale {
  const dueAtSale = sale.balance_due_at_sale ?? sale.balance_due ?? 0;
  const grand = Math.max(0, sale.grand_total || 0);
  const balanceDue = Math.min(grand, Math.max(0, (sale.balance_due || 0) - amountPaise));
  const received = Math.max(0, (sale.amount_received || 0) + ((sale.balance_due || 0) - balanceDue));
  return {
    ...sale,
    balance_due_at_sale: dueAtSale,
    balance_due: balanceDue,
    amount_received: received,
    payment_status: balanceDue === 0 ? 'paid' : balanceDue < grand ? 'partial' : 'unpaid',
    updated_at: now,
  };
}
