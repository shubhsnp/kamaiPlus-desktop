import React from 'react';
import { showAlert } from '@/lib/ui/dialogs';
import { db } from '@/lib/db';
import { SalesReturn, ReturnItem, CashExpense } from '@/types';
import { getLineRefundPaise } from '@/lib/sales/saleMath';
import { tr } from '@/lib/i18n/core';
import type { Sale } from '@/types';

export interface CreateSalesReturnSaveDeps {
  onReturnCompleted: ((salesReturn: SalesReturn) => void) | undefined;
  selectedSale: Sale | null;
  returnQuantities: { [line: number]: number; };
  restockFlags: { [line: number]: boolean; };
  alreadyReturned: number[];
  refundMethod: "cash" | "upi" | "store_credit" | "khata_deduction";
  returnReason: string;
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  setCompletedReturn: React.Dispatch<React.SetStateAction<SalesReturn | null>>;
  maxReturnable: (idx: number) => number;
  totalRefundPaise: number;
}

/**
 * Saving a sales return (v4.104.0, K-D23 — moved out of SalesReturnModal unchanged): stock back, refund
 * by cash / UPI / store credit (khata), the return record with its number, and the bill's status.
 */
export function createSalesReturnSave(deps: CreateSalesReturnSaveDeps) {
  const {
    onReturnCompleted, selectedSale, returnQuantities, restockFlags, alreadyReturned, refundMethod,
    returnReason, setIsProcessing, setCompletedReturn, maxReturnable, totalRefundPaise,
  } = deps;
  const handleProcessReturn = async () => {
    if (!selectedSale || totalRefundPaise <= 0) return;
    const needsCustomer = refundMethod === 'khata_deduction' || refundMethod === 'store_credit';
    if (needsCustomer && !selectedSale.customer_id) {
      showAlert(tr('Store credit / khata adjustment needs a customer on the bill. Choose Cash or UPI refund for a walk-in sale.'));
      return;
    }

    setIsProcessing(true);
    try {
      const sale = selectedSale;
      const now = new Date().toISOString();
      const stamp = Date.now();
      const returnId = `ret_${stamp}`;
      const priorCount = await db.sales_returns.count();
      const returnNumber = `RET-${String(priorCount + 1).padStart(4, '0')}-${stamp.toString(36).slice(-3).toUpperCase()}`;
      const returnItems: ReturnItem[] = [];
      const newReturned = sale.items.map((_, idx) => (alreadyReturned[idx] || 0) + (returnQuantities[idx] || 0));
      let saved: SalesReturn | null = null;

      await db.transaction(
        'rw',
        [db.products, db.inventory_movements, db.customers, db.ledger_transactions, db.sales_returns, db.sales, db.cash_expenses],
        async () => {
          for (let idx = 0; idx < sale.items.length; idx++) {
            const item = sale.items[idx];
            const qty = Math.min(returnQuantities[idx] || 0, maxReturnable(idx));
            if (qty <= 0) continue;
            const restock = restockFlags[idx] ?? true;
            returnItems.push({
              product_id: item.product_id,
              product_name: item.product_name,
              quantity: qty,
              unit: item.unit,
              unit_price: item.unit_price,
              tax_rate: item.tax_rate,
              total_amount: getLineRefundPaise(item, qty),
              restock_to_inventory: restock,
              reason: returnReason,
            });

            // 1. Restock to inventory if selected
            if (restock) {
              const prod = await db.products.get(item.product_id);
              if (prod && !prod.is_unlimited_stock) {
                const prev = Number(prod.current_stock ?? 0);
                const next = prev + qty;
                await db.products.update(prod.id, { current_stock: next, updated_at: now });
                await db.inventory_movements.put({
                  id: `mov_${stamp}_${idx}_${prod.id}`,
                  business_id: sale.business_id,
                  product_id: prod.id,
                  product_name: prod.name,
                  movement_type: 'RETURN',
                  quantity: qty,
                  previous_stock: prev,
                  new_stock: next,
                  reference_id: returnNumber,
                  reason: `Sales Return on Inv #${sale.invoice_number}`,
                  created_by: 'owner',
                  created_at: now,
                });
              }
            }
          }

          // 2. Money back: khata / store credit reduce what the customer owes (may go into advance);
          //    cash and UPI refunds are recorded as refund outflows (cash ones leave the drawer).
          if (needsCustomer && sale.customer_id) {
            const cust = await db.customers.get(sale.customer_id);
            if (cust) {
              const updatedBal = (cust.current_balance || 0) - totalRefundPaise;
              await db.customers.update(cust.id, { current_balance: updatedBal, updated_at: now });
              await db.ledger_transactions.put({
                id: `ledg_${stamp}`,
                business_id: sale.business_id,
                party_type: 'customer',
                party_id: cust.id,
                party_name: cust.name,
                transaction_type: 'PAYMENT_RECEIVED',
                amount: totalRefundPaise,
                balance_after: updatedBal,
                reference_id: returnNumber,
                notes: `Credit Note ${returnNumber} / Return on Inv #${sale.invoice_number}`,
                created_at: now,
              });
            }
          } else {
            const refund: CashExpense = {
              id: `exp_refund_${stamp}`,
              business_id: sale.business_id,
              category: 'refund',
              title: tr('{v1} Refund: {returnNumber} (Inv #{invoice_number})', { v1: refundMethod === 'upi' ? 'UPI' : 'Cash', returnNumber: returnNumber, invoice_number: sale.invoice_number }),
              amount: totalRefundPaise,
              paid_to: sale.customer_name,
              payment_mode: refundMethod === 'upi' ? 'upi' : 'cash',
              created_by: 'owner',
              created_at: now,
              notes: returnReason || undefined,
            };
            await db.cash_expenses.put(refund);
          }

          // 3. Save the return record
          const newReturn: SalesReturn = {
            id: returnId,
            business_id: sale.business_id,
            return_number: returnNumber,
            original_sale_id: sale.id,
            original_invoice_number: sale.invoice_number,
            customer_id: sale.customer_id,
            customer_name: sale.customer_name,
            customer_phone: sale.customer_phone,
            items: returnItems,
            refund_amount: totalRefundPaise,
            refund_method: refundMethod,
            notes: returnReason,
            created_by: 'owner',
            created_at: now,
          };
          await db.sales_returns.put(newReturn);

          // 4. Mark the bill: per-line returned quantity, total refunded, full / partial status
          const isFullReturn = sale.items.every((item, idx) => newReturned[idx] >= item.quantity);
          await db.sales.update(sale.id, {
            items: sale.items.map((item, idx) => ({ ...item, returned_quantity: newReturned[idx] || undefined })),
            has_return: true,
            returned_amount: (sale.returned_amount || 0) + totalRefundPaise,
            status: isFullReturn ? 'returned' : 'partial_return',
            return_id: returnId,
            updated_at: now,
          });

          saved = newReturn;
        }
      );
      if (saved) {
        setCompletedReturn(saved);
        onReturnCompleted?.(saved);
      }
    } catch (err) {
      console.error('Failed to process sales return:', err);
      showAlert(tr('Return processing failed. Nothing was changed.'));
    } finally {
      setIsProcessing(false);
    }
  };

  return { handleProcessReturn };
}
