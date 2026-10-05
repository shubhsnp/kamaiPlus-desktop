import React from 'react';
import { showConfirm } from '@/lib/ui/dialogs';
import { db } from '@/lib/db';
import { localDateKey } from '@/lib/reports/cashDrawer';
import { allocatePaymentToOpenBills, undoBillAllocations } from '@/lib/khata/billAllocationDb';
import { validateCustomerData } from '@/lib/validation/validators';
import { LedgerTransaction, Customer } from '@/types';
import { generateBulkMonthEndStatementPDF } from '@/lib/reports/bulkMonthEndStatement';
import { tr } from '@/lib/i18n/core';
import { newId } from '@/lib/ids';
import type { Business, Sale } from '@/types';

export interface CreateKhataActionsDeps {
  setSelectedCustomerId: React.Dispatch<React.SetStateAction<string | null>>;
  setIsMobileDetailOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsEntryModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setEntryType: React.Dispatch<React.SetStateAction<"CREDIT_SALE" | "PAYMENT_RECEIVED">>;
  entryType: "CREDIT_SALE" | "PAYMENT_RECEIVED";
  setEntryAmount: React.Dispatch<React.SetStateAction<string>>;
  entryAmount: string;
  setEntryNotes: React.Dispatch<React.SetStateAction<string>>;
  entryNotes: string;
  setEntryDate: React.Dispatch<React.SetStateAction<string>>;
  entryDate: string;
  setEntryPaymentMode: React.Dispatch<React.SetStateAction<"cash" | "upi" | "bank" | "other">>;
  entryPaymentMode: "cash" | "upi" | "bank" | "other";
  setIsAddCustomerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  newCustName: string;
  setNewCustName: React.Dispatch<React.SetStateAction<string>>;
  newCustPhone: string;
  setNewCustPhone: React.Dispatch<React.SetStateAction<string>>;
  newCustAddress: string;
  setNewCustAddress: React.Dispatch<React.SetStateAction<string>>;
  newCustOpeningBalance: string;
  setNewCustOpeningBalance: React.Dispatch<React.SetStateAction<string>>;
  setAddCustomerError: React.Dispatch<React.SetStateAction<string>>;
  editingTx: LedgerTransaction | null;
  setEditingTx: React.Dispatch<React.SetStateAction<LedgerTransaction | null>>;
  editTxAmount: string;
  editTxNotes: string;
  editTxType: "CREDIT_SALE" | "PAYMENT_RECEIVED";
  setIsClearAllModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  clearConfirmationText: string;
  setClearConfirmationText: React.Dispatch<React.SetStateAction<string>>;
  setViewingSale: React.Dispatch<React.SetStateAction<Sale | null>>;
  setIsInvoiceModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  showToast: (msg: string) => void;
  business: Business | undefined;
  allCustomers: Customer[];
  selectedCustomer: Customer | null;
}

/**
 * What the Khata page saves (v4.104.0, K-D23 — moved out of app/khata/page.tsx unchanged): a manual
 * entry (with bill-by-bill allocation of a payment), a new customer, editing / deleting an entry,
 * clearing a history, the month-end statements and opening a bill from an entry.
 */
export function createKhataActions(deps: CreateKhataActionsDeps) {
  const {
    setSelectedCustomerId, setIsMobileDetailOpen, setIsEntryModalOpen, setEntryType, entryType, setEntryAmount,
    entryAmount, setEntryNotes, entryNotes, setEntryDate, entryDate, setEntryPaymentMode,
    entryPaymentMode, setIsAddCustomerOpen, newCustName, setNewCustName, newCustPhone, setNewCustPhone,
    newCustAddress, setNewCustAddress, newCustOpeningBalance, setNewCustOpeningBalance, setAddCustomerError, editingTx,
    setEditingTx, editTxAmount, editTxNotes, editTxType, setIsClearAllModalOpen, clearConfirmationText,
    setClearConfirmationText, setViewingSale, setIsInvoiceModalOpen, showToast, business, allCustomers,
    selectedCustomer,
  } = deps;
  // Recalculate customer balance by summing ledger transactions
  const recalculateCustomerBalance = async (customerId: string) => {
    const allTx = await db.ledger_transactions.where('party_id').equals(customerId).toArray();
    let computedBalance = 0;
    for (const tx of allTx) {
      if (
        tx.transaction_type === 'CREDIT_SALE' || 
        tx.transaction_type === 'OPENING_BALANCE' || 
        tx.transaction_type === 'CREDIT_PURCHASE'
      ) {
        computedBalance += tx.amount;
      } else if (
        tx.transaction_type === 'PAYMENT_RECEIVED' || 
        tx.transaction_type === 'SUPPLIER_PAYMENT'
      ) {
        computedBalance -= tx.amount;
      } else if (tx.transaction_type === 'ADJUSTMENT') {
        computedBalance += tx.amount;
      }
    }
    await db.customers.update(customerId, {
      current_balance: computedBalance,
      updated_at: new Date().toISOString(),
    });
  };

  // Open Entry Modal with preset type
  const handleOpenEntryModal = (type: 'CREDIT_SALE' | 'PAYMENT_RECEIVED') => {
    if (!selectedCustomer) {
      showToast(tr('Please select or add a customer first'));
      return;
    }
    setEntryType(type);
    setEntryAmount('');
    setEntryNotes('');
    setEntryDate(localDateKey(new Date()));
    setEntryPaymentMode('cash');
    setIsEntryModalOpen(true);
  };

  // Generate Bulk Month-End Khata Statement PDF for All Customers
  const handleBulkMonthEndStatement = async () => {
    if (!business || allCustomers.length === 0) return;
    const res = await generateBulkMonthEndStatementPDF({
      customers: allCustomers,
      business,
    });
    if (res.ok) {
      showToast(res.path ? tr('Bulk Month-End Statement saved to Documents!') : tr('Statement opened in print/PDF dialog.'));
    } else {
      showToast(res.error || tr('Failed to generate statement.'));
    }
  };

  // Save New Khata Transaction
  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    const amountPaise = Math.round(parseFloat(entryAmount || '0') * 100);
    if (!amountPaise || amountPaise <= 0) {
      showToast(tr('Please enter a valid amount'));
      return;
    }

    const now = new Date().toISOString();
    // Today's entries keep the real time; a back-dated entry is stamped at local noon of that day
    // (parsing "YYYY-MM-DD" directly gives UTC midnight — the previous day before 5:30 AM IST).
    const txDate = !entryDate || entryDate === localDateKey(new Date())
      ? now
      : (() => {
          const [y, m, d] = entryDate.split('-').map(Number);
          return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0).toISOString();
        })();
    const currentBal = selectedCustomer.current_balance || 0;
    const balanceAfter = entryType === 'CREDIT_SALE'
      ? currentBal + amountPaise
      : currentBal - amountPaise;

    // A payment clears the customer's unpaid bills, oldest first.
    const billAllocations = entryType === 'PAYMENT_RECEIVED'
      ? await allocatePaymentToOpenBills(selectedCustomer.id, amountPaise, now)
      : undefined;

    const newTx: LedgerTransaction = {
      id: newId('ledg'),
      business_id: business?.id || 'biz_default',
      party_type: 'customer',
      party_id: selectedCustomer.id,
      party_name: selectedCustomer.name,
      transaction_type: entryType,
      amount: amountPaise,
      payment_method: entryType === 'PAYMENT_RECEIVED' ? entryPaymentMode : undefined,
      notes: entryNotes.trim() || undefined,
      balance_after: balanceAfter,
      bill_allocations: billAllocations && billAllocations.length ? billAllocations : undefined,
      created_at: txDate,
      sync_status: 'synced',
    };

    await db.ledger_transactions.put(newTx);
    await db.customers.update(selectedCustomer.id, {
      current_balance: balanceAfter,
      updated_at: now,
    });

    setIsEntryModalOpen(false);

    showToast(
      entryType === 'CREDIT_SALE' 
        ? tr('Added ₹{v1} Udhar for {name}', { v1: (amountPaise / 100).toFixed(2), name: selectedCustomer.name })
        : tr('Recorded ₹{v1} payment from {name}', { v1: (amountPaise / 100).toFixed(2), name: selectedCustomer.name })
    );
  };

  // Quick Add Customer to Khata
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddCustomerError('');

    const validation = validateCustomerData({
      name: newCustName,
      phone: newCustPhone,
    });

    if (!validation.isValid) {
      setAddCustomerError(validation.error || tr('Please enter valid customer details.'));
      return;
    }

    const opBalPaise = newCustOpeningBalance ? Math.round(parseFloat(newCustOpeningBalance) * 100) : 0;
    const now = new Date().toISOString();
    const custId = newId('cust');

    const newCustomer: Customer = {
      id: custId,
      business_id: business?.id || 'biz_default',
      name: validation.cleanedValue?.name || newCustName.trim(),
      phone: validation.cleanedValue?.phone || newCustPhone.trim(),
      address: newCustAddress.trim() || undefined,
      customer_type: opBalPaise > 0 ? 'credit' : 'regular',
      opening_balance: opBalPaise,
      current_balance: opBalPaise,
      loyalty_points: 0,
      total_spent: 0,
      total_visits: 0,
      created_at: now,
      updated_at: now,
      sync_status: 'synced',
    };

    await db.customers.put(newCustomer);

    if (opBalPaise > 0) {
      await db.ledger_transactions.put({
        id: newId('ledg'),
        business_id: business?.id || 'biz_default',
        party_type: 'customer',
        party_id: custId,
        party_name: newCustName.trim(),
        transaction_type: 'OPENING_BALANCE',
        amount: opBalPaise,
        balance_after: opBalPaise,
        notes: 'Initial opening balance',
        created_at: now,
        sync_status: 'synced',
      });
    }

    setSelectedCustomerId(custId);
    setIsMobileDetailOpen(true);
    setIsAddCustomerOpen(false);
    setNewCustName('');
    setNewCustPhone('');
    setNewCustAddress('');
    setNewCustOpeningBalance('');
    showToast(tr('Added {name} to Khata', { name: newCustomer.name }));
  };

  // Edit Existing Transaction
  const handleSaveEditTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx || !selectedCustomer) return;

    const newAmountPaise = Math.round(parseFloat(editTxAmount || '0') * 100);
    if (!newAmountPaise || newAmountPaise <= 0) return;

    // Undo what the old entry cleared on bills, then clear bills for the new amount.
    const now = new Date().toISOString();
    await undoBillAllocations(editingTx.bill_allocations, now);
    const billAllocations = editTxType === 'PAYMENT_RECEIVED'
      ? await allocatePaymentToOpenBills(selectedCustomer.id, newAmountPaise, now)
      : [];

    await db.ledger_transactions.update(editingTx.id, {
      amount: newAmountPaise,
      transaction_type: editTxType,
      notes: editTxNotes.trim() || undefined,
      bill_allocations: billAllocations.length ? billAllocations : undefined,
    });

    await recalculateCustomerBalance(selectedCustomer.id);
    setEditingTx(null);
    showToast(tr('Updated ledger entry'));
  };

  // Delete Transaction
  const handleDeleteTx = async (txId: string) => {
    if (!selectedCustomer) return;
    if (!await showConfirm(tr('Are you sure you want to delete this ledger entry?'), { danger: true, confirmLabel: tr('Delete') })) return;

    // A deleted payment no longer pays the bills it had cleared.
    const tx = await db.ledger_transactions.get(txId);
    await undoBillAllocations(tx?.bill_allocations, new Date().toISOString());
    await db.ledger_transactions.delete(txId);
    await recalculateCustomerBalance(selectedCustomer.id);
    showToast(tr('Deleted ledger entry'));
  };

  // Wipe / Clear Customer History
  const handleClearCustomerKhata = async () => {
    if (!selectedCustomer) return;
    if (clearConfirmationText.toUpperCase() !== 'DELETE') return;

    await db.ledger_transactions.where('party_id').equals(selectedCustomer.id).delete();
    await db.customers.update(selectedCustomer.id, {
      current_balance: 0,
      opening_balance: 0,
      updated_at: new Date().toISOString(),
    });

    setIsClearAllModalOpen(false);
    setClearConfirmationText('');
    showToast(tr('Cleared Khata history for {name}', { name: selectedCustomer.name }));
  };

  // Open Full Tax Invoice Modal from reference or notes
  const handleOpenSaleInvoice = async (referenceId?: string, notes?: string) => {
    try {
      if (referenceId) {
        const sale = await db.sales.get(referenceId);
        if (sale) {
          setViewingSale(sale);
          setIsInvoiceModalOpen(true);
          return;
        }
      }
      if (notes) {
        const match = notes.match(/#([A-Z0-9-]+)/i);
        if (match && match[1]) {
          const invNum = match[1];
          const sale = await db.sales.where('invoice_number').equalsIgnoreCase(invNum).first();
          if (sale) {
            setViewingSale(sale);
            setIsInvoiceModalOpen(true);
            return;
          }
        }
      }
      showToast(tr('Full invoice bill not found for this entry.'));
    } catch (err) {
      console.warn('Failed to lookup invoice:', err);
    }
  };


  return { recalculateCustomerBalance, handleOpenEntryModal, handleBulkMonthEndStatement, handleSaveEntry, handleCreateCustomer, handleSaveEditTx, handleDeleteTx, handleClearCustomerKhata, handleOpenSaleInvoice };
}
