import { db } from '@/lib/db';
import { CashExpense, LedgerTransaction, Supplier } from '@/types';

/**
 * Supplier (vendor) accounts — money is integer paise.
 *
 * `current_balance` > 0 means the shop OWES the supplier; < 0 means the shop has paid
 * in advance. Every change goes through one Dexie transaction that updates the
 * balance and writes a `ledger_transactions` row (party_type 'supplier'), so the
 * balance and its history can never drift apart. A CASH payment also writes a
 * `supplier_payout` cash expense, which is what takes it out of the cash drawer
 * (lib/reports/cashDrawer.ts counts cash expenses; it ignores supplier ledger rows).
 */

export type SupplierEntryKind = 'purchase' | 'payment';
export type SupplierPaymentMode = 'cash' | 'upi' | 'bank';

export function nextSupplierBalance(currentPaise: number, kind: SupplierEntryKind, amountPaise: number): number {
  const amount = Math.round(amountPaise);
  return kind === 'purchase' ? currentPaise + amount : currentPaise - amount;
}

const newId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export interface SupplierInput {
  name: string;
  phone: string;
  gstin?: string;
  address?: string;
  notes?: string;
}

export async function createSupplier(businessId: string, input: SupplierInput, openingBalancePaise = 0): Promise<Supplier> {
  const now = new Date().toISOString();
  const supplier: Supplier = {
    id: newId('sup'),
    business_id: businessId,
    name: input.name.trim(),
    phone: input.phone.trim(),
    gstin: input.gstin?.trim().toUpperCase() || undefined,
    address: input.address?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    opening_balance: Math.round(openingBalancePaise),
    current_balance: Math.round(openingBalancePaise),
    created_at: now,
    updated_at: now,
    sync_status: 'pending',
  };
  await db.transaction('rw', db.suppliers, db.ledger_transactions, async () => {
    await db.suppliers.put(supplier);
    if (supplier.opening_balance !== 0) {
      const tx: LedgerTransaction = {
        id: newId('ledg_sup'),
        business_id: businessId,
        party_type: 'supplier',
        party_id: supplier.id,
        party_name: supplier.name,
        transaction_type: 'OPENING_BALANCE',
        amount: Math.abs(supplier.opening_balance),
        balance_after: supplier.opening_balance,
        notes: supplier.opening_balance > 0 ? 'Opening balance (you owe)' : 'Opening advance paid',
        created_at: now,
        sync_status: 'pending',
      };
      await db.ledger_transactions.put(tx);
    }
  });
  return supplier;
}

export async function updateSupplier(id: string, input: SupplierInput): Promise<void> {
  const name = input.name.trim();
  await db.transaction('rw', db.suppliers, db.ledger_transactions, async () => {
    await db.suppliers.update(id, {
      name,
      phone: input.phone.trim(),
      gstin: input.gstin?.trim().toUpperCase() || undefined,
      address: input.address?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      updated_at: new Date().toISOString(),
      sync_status: 'pending',
    });
    // Keep the name on past entries in step (the ledger shows party_name).
    await db.ledger_transactions.where('party_id').equals(id).modify({ party_name: name });
  });
}

/** Only a settled supplier can be deleted — a balance must never silently vanish. */
export async function deleteSupplier(id: string): Promise<{ ok: boolean; error?: string }> {
  const s = await db.suppliers.get(id);
  if (!s) return { ok: true };
  if ((s.current_balance || 0) !== 0) {
    return { ok: false, error: 'This supplier still has a balance. Settle it to ₹0 before deleting.' };
  }
  await db.suppliers.delete(id);
  return { ok: true };
}

export interface SupplierEntryInput {
  supplierId: string;
  kind: SupplierEntryKind;
  amountPaise: number;
  paymentMode?: SupplierPaymentMode;
  note?: string;
  referenceId?: string;
  /** ISO date-time; defaults to now. */
  date?: string;
}

export async function recordSupplierEntry(input: SupplierEntryInput): Promise<{ ok: boolean; balance?: number; error?: string }> {
  const amount = Math.round(input.amountPaise);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Enter an amount greater than ₹0.' };

  const when = input.date || new Date().toISOString();
  let balanceAfter = 0;

  try {
    await db.transaction('rw', db.suppliers, db.ledger_transactions, db.cash_expenses, async () => {
      const supplier = await db.suppliers.get(input.supplierId);
      if (!supplier) throw new Error('Supplier not found.');

      balanceAfter = nextSupplierBalance(supplier.current_balance || 0, input.kind, amount);
      await db.suppliers.update(supplier.id, {
        current_balance: balanceAfter,
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
      });

      const mode = input.kind === 'payment' ? input.paymentMode || 'cash' : undefined;
      const ledgerId = newId('ledg_sup');
      await db.ledger_transactions.put({
        id: ledgerId,
        business_id: supplier.business_id,
        party_type: 'supplier',
        party_id: supplier.id,
        party_name: supplier.name,
        transaction_type: input.kind === 'purchase' ? 'CREDIT_PURCHASE' : 'SUPPLIER_PAYMENT',
        amount,
        payment_method: mode,
        reference_id: input.referenceId,
        notes: input.note?.trim() || undefined,
        balance_after: balanceAfter,
        created_at: when,
        sync_status: 'pending',
      });

      if (input.kind === 'payment' && mode === 'cash') {
        const expense: CashExpense = {
          id: newId('exp_sup'),
          business_id: supplier.business_id,
          category: 'supplier_payout',
          title: `Supplier payment: ${supplier.name}`,
          amount,
          paid_to: supplier.name,
          payment_mode: 'cash',
          created_by: 'owner',
          created_at: when,
          notes: `Ledger ${ledgerId}${input.note?.trim() ? ` • ${input.note.trim()}` : ''}`,
        };
        await db.cash_expenses.put(expense);
      }
    });
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Could not save the entry.' };
  }
  return { ok: true, balance: balanceAfter };
}
