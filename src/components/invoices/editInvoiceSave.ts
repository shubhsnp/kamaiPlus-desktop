import React from 'react';
import { showAlert } from '@/lib/ui/dialogs';
import { db } from '@/lib/db';
import { Sale } from '@/types';
import { msg, tr } from '@/lib/i18n/core';
import { validateIndianPhone } from '@/lib/validation/validators';
import { newId } from '@/lib/ids';
import type { CartItem, PaymentMethod } from '@/types';

export interface CreateEditInvoiceSaveDeps {
  onClose: () => void;
  sale: Sale;
  onSaved: ((updatedSale: Sale) => void) | undefined;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: CartItem[];
  paymentMethod: PaymentMethod;
  notes: string;
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>;
  estimate: boolean;
  discountTotalPaise: number;
  taxTotalPaise: number;
  subtotalPaise: number;
  grandTotalPaise: number;
  enteredReceivedPaise: number;
  balanceDuePaise: number;
  changeReturnedPaise: number;
}

/**
 * Saving an edited bill (v4.104.0, K-D23 — moved out of EditInvoiceModal unchanged): stock moves by the
 * difference of each line, the customer's khata by the difference in udhar, and the bill keeps its number.
 */
export function createEditInvoiceSave(deps: CreateEditInvoiceSaveDeps) {
  const {
    onClose, sale, onSaved, invoiceNumber, customerName, customerPhone,
    customerAddress, items, paymentMethod, notes, setIsSaving, estimate,
    discountTotalPaise, taxTotalPaise, subtotalPaise, grandTotalPaise, enteredReceivedPaise, balanceDuePaise,
    changeReturnedPaise,
  } = deps;
  // Save changes handler with inventory & ledger reconciliation
  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      showAlert(tr('Invoice must have at least 1 item.'));
      return;
    }
    // v4.150.0: a typed mobile must be a real one (the bill is sent to it on WhatsApp).
    const phoneCheck = validateIndianPhone(customerPhone, false, msg('Phone Number'));
    if (!phoneCheck.isValid) {
      showAlert(phoneCheck.error as string);
      return;
    }
    if (sale.status === 'returned' || sale.status === 'partial_return') {
      showAlert(tr('This bill has a sales return against it, so it cannot be edited. The return already adjusted stock and khata.'));
      return;
    }
    const requestedNumber = invoiceNumber.trim();
    if (requestedNumber && requestedNumber !== sale.invoice_number) {
      const clash = await db.sales.where('invoice_number').equals(requestedNumber).first();
      if (clash && clash.id !== sale.id) {
        showAlert(tr('Invoice number {requestedNumber} is already used by another bill.', { requestedNumber: requestedNumber }));
        return;
      }
    }

    setIsSaving(true);
    try {
      const now = new Date().toISOString();

      // Estimates never moved stock or khata, so editing one must not either.
      if (!estimate) {
      // 1. Inventory Stock Reconciliation:
      // Compare old items vs new items and adjust stock accordingly
      const oldQtyMap = new Map<string, number>();
      sale.items.forEach((item) => {
        oldQtyMap.set(item.product_id, (oldQtyMap.get(item.product_id) || 0) + item.quantity);
      });

      const newQtyMap = new Map<string, number>();
      items.forEach((item) => {
        newQtyMap.set(item.product_id, (newQtyMap.get(item.product_id) || 0) + item.quantity);
      });

      // All unique product IDs involved
      const allProductIds = new Set([...Array.from(oldQtyMap.keys()), ...Array.from(newQtyMap.keys())]);

      for (const prodId of Array.from(allProductIds)) {
        const oldQty = oldQtyMap.get(prodId) || 0;
        const newQty = newQtyMap.get(prodId) || 0;
        const diff = newQty - oldQty; // if positive: more sold -> reduce stock; if negative: items returned -> increase stock

        if (diff !== 0) {
          const prod = await db.products.get(prodId);
          if (prod && !prod.is_unlimited_stock) {
            const prevStock = prod.current_stock;
            const updatedStock = Math.max(0, prevStock - diff);

            await db.products.update(prod.id, {
              current_stock: updatedStock,
              updated_at: now,
            });

            await db.inventory_movements.put({
              id: `mov_${Date.now()}_${prod.id}`,
              business_id: sale.business_id,
              product_id: prod.id,
              product_name: prod.name,
              movement_type: 'ADJUSTMENT',
              quantity: Math.abs(diff),
              previous_stock: prevStock,
              new_stock: updatedStock,
              reference_id: sale.id,
              reason: `Edited Invoice #${sale.invoice_number} (Qty: ${oldQty} → ${newQty})`,
              created_by: 'owner',
              created_at: now,
            });
          }
        }
      }

      // 2. Khata Ledger Reconciliation if credit was involved
      const oldBalanceDue = sale.balance_due || 0;
      const newBalanceDue = balanceDuePaise;
      const balanceDelta = newBalanceDue - oldBalanceDue;

      if (sale.customer_id && balanceDelta !== 0) {
        const cust = await db.customers.get(sale.customer_id);
        if (cust) {
          const updatedCustBalance = cust.current_balance + balanceDelta;
          await db.customers.update(cust.id, {
            current_balance: updatedCustBalance,
            updated_at: now,
          });

          await db.ledger_transactions.put({
            id: newId('ledg'),
            business_id: sale.business_id,
            party_type: 'customer',
            party_id: cust.id,
            party_name: cust.name,
            transaction_type: balanceDelta > 0 ? 'CREDIT_SALE' : 'PAYMENT_RECEIVED',
            amount: Math.abs(balanceDelta),
            balance_after: updatedCustBalance,
            reference_id: sale.id,
            notes: `Invoice #${sale.invoice_number} Edited (Credit adjusted by ₹${(Math.abs(balanceDelta) / 100).toFixed(2)})`,
            created_at: now,
          });
        }
      }
      }

      // 3. Update Sale Record in Dexie DB
      const finalInvoiceNumber = invoiceNumber.trim() || sale.invoice_number;
      const updatedSale: Sale = {
        ...sale,
        invoice_number: finalInvoiceNumber,
        customer_name: customerName.trim() || 'Cash Customer',
        customer_phone: phoneCheck.cleanedValue || undefined,
        customer_address: customerAddress.trim() || undefined,
        items: [...items],
        subtotal: subtotalPaise,
        discount_total: discountTotalPaise,
        tax_total: taxTotalPaise,
        grand_total: grandTotalPaise,
        payment_method: paymentMethod,
        payment_split:
          paymentMethod === 'split' && sale.payment_split
            ? {
                ...sale.payment_split,
                cash_amount: Math.max(0, grandTotalPaise - balanceDuePaise - (sale.payment_split.upi_amount || 0) - (sale.payment_split.card_amount || 0)),
                credit_amount: balanceDuePaise,
              }
            : undefined,
        amount_received: estimate ? 0 : enteredReceivedPaise,
        balance_due: balanceDuePaise,
        // A bill already part-settled from khata keeps its counter udhar, shifted by this edit only.
        balance_due_at_sale: sale.balance_due_at_sale !== undefined
          ? Math.max(0, sale.balance_due_at_sale + (balanceDuePaise - (sale.balance_due || 0)))
          : undefined,
        change_returned: changeReturnedPaise,
        payment_status: estimate ? 'unpaid' : balanceDuePaise === 0 ? 'paid' : balanceDuePaise < grandTotalPaise ? 'partial' : 'unpaid',
        notes: notes.trim() || undefined,
        updated_at: now,
      };

      await db.sales.put(updatedSale);

      if (onSaved) {
        onSaved(updatedSale);
      }

      onClose();
    } catch (err: any) {
      console.error('Error saving edited invoice:', err);
      showAlert(tr('Failed to save invoice changes. Please try again.'));
    } finally {
      setIsSaving(false);
    }
  };

  return { handleSaveInvoice };
}
