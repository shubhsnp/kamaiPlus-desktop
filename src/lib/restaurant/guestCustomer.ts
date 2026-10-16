import { db } from '@/lib/db';
import { newId } from '@/lib/ids';
import { buildBillCustomer, resolveBillCustomer } from '@/lib/billing/billCustomer';
import { cloudMerge } from '@/lib/firebase/lazyCloud';
import type { Customer, LedgerTransaction, Sale } from '@/types';

/*
 * v4.175.0 — the restaurant bill's guest works like the counter's customer (posSaleActions.ts):
 * a mobile number saves / finds the customer (Customers, Khata, the next visit fills the name),
 * and "Udhar" puts the bill on that customer's khata. Before, the mobile was only printed on the
 * bill — the guest was never saved and a restaurant could not give udhar at all.
 */

/**
 * The customer for this bill, saved when new: with a valid mobile always, with only a name only for
 * udhar (a walk-in's name alone does not fill the customer list). Null = no customer on this bill.
 * Throws 'udhar-needs-guest' when udhar has no name / mobile to put it on.
 */
export async function guestCustomerFor(p: { businessId: string; name: string; phone: string; udhar: boolean; now: string }): Promise<Customer | null> {
  if (!p.phone && !p.udhar) return null;
  const r = resolveBillCustomer(await db.customers.toArray(), { name: p.name, phone: p.phone });
  if (r.kind === 'existing') {
    if (r.addPhone) {
      await db.customers.update(r.customer.id, { phone: r.addPhone, updated_at: p.now });
      return { ...r.customer, phone: r.addPhone };
    }
    return r.customer;
  }
  if (r.kind === 'new' && r.name.trim()) {
    const c = buildBillCustomer(newId('cust'), p.businessId, r.name, r.phone, p.now);
    await db.customers.put(c);
    return c;
  }
  if (p.udhar) throw new Error('udhar-needs-guest');
  return null;
}

/** Udhar: the bill's amount goes on the customer's khata (balance + a CREDIT_SALE entry), as at the counter. */
export async function addUdhar(sale: Sale, customer: Customer, itemsSummary: string): Promise<void> {
  const fresh = (await db.customers.get(customer.id)) || customer;
  const balance = (fresh.current_balance || 0) + sale.balance_due;
  await db.customers.update(customer.id, { current_balance: balance, updated_at: sale.created_at });
  const entry: LedgerTransaction = {
    id: newId('ledg'),
    business_id: sale.business_id,
    party_type: 'customer',
    party_id: customer.id,
    party_name: customer.name,
    transaction_type: 'CREDIT_SALE',
    amount: sale.balance_due,
    balance_after: balance,
    reference_id: sale.id,
    notes: `Invoice #${sale.invoice_number} • ${itemsSummary}`,
    created_at: sale.created_at,
    sync_status: 'synced',
  };
  await db.ledger_transactions.put(entry);
  if (sale.business_id && sale.business_id !== 'biz_default') {
    void cloudMerge(`businesses/${sale.business_id}/customers/${customer.id}`, { ...fresh, current_balance: balance, updated_at: sale.created_at });
    void cloudMerge(`businesses/${sale.business_id}/ledger_transactions/${entry.id}`, entry);
  }
}
