import React from 'react';
import { db } from '@/lib/db';
import { Sale, Product } from '@/types';
import { getNextUniqueInvoiceNumber, commitNextInvoiceNumber } from '@/lib/invoices/invoiceNumberService';
import { tr } from '@/lib/i18n/core';
import type { Business } from '@/types';

export interface CreateConvertEstimateDeps {
  setActiveSaleForInvoice: React.Dispatch<React.SetStateAction<Sale | null>>;
  setIsInvoiceModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  business: Business | undefined;
  showTxToast: (message: string, type?: "success" | "info" | "error") => void;
}

/**
 * Transactions → "Convert to Bill" (v4.104.0, K-D23 — moved out of app/transactions/page.tsx unchanged):
 * an estimate gets the next bill number, stock goes down, udhar goes on the khata, and the bill opens.
 */
export function createConvertEstimate(deps: CreateConvertEstimateDeps) {
  const {
    setActiveSaleForInvoice, setIsInvoiceModalOpen, business, showTxToast,
  } = deps;
  // 1-Tap Convert Quotation / Estimate to Official Tax Invoice
  const handleConvertToInvoice = async (sale: Sale) => {
    try {
      const bizId = business?.id || 'biz_default';
      const { invoiceNumber, nextSeq } = await getNextUniqueInvoiceNumber(bizId);
      await commitNextInvoiceNumber(bizId, nextSeq);

      const now = new Date().toISOString();

      // Deduct product inventory stock & record inventory movements
      for (const item of sale.items || []) {
        let prod = await db.products.get(item.product_id);
        if (!prod && item.barcode) {
          prod = await db.products.where('barcode').equals(item.barcode).first();
        }
        if (!prod && item.product_name) {
          prod = await db.products.where('name').equalsIgnoreCase(item.product_name).first();
        }
        if (prod && !prod.is_unlimited_stock) {
          const prevStock = Number(prod.current_stock ?? 0);
          const newStock = Math.max(0, prevStock - item.quantity);
          const updatedProd: Product = {
            ...prod,
            current_stock: newStock,
            updated_at: now,
          };
          await db.products.put(updatedProd);

          await db.inventory_movements.put({
            id: `mov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${prod.id}`,
            business_id: bizId,
            product_id: prod.id,
            product_name: prod.name,
            movement_type: 'SALE',
            quantity: item.quantity,
            previous_stock: prevStock,
            new_stock: newStock,
            reference_id: sale.id,
            reason: `Converted Estimate #${sale.invoice_number} to Bill #${invoiceNumber}`,
            created_by: 'owner',
            created_at: now,
          });
        }
      }

      // If credit, adjust customer khata balance & ledger
      if (sale.customer_id && sale.balance_due && sale.balance_due > 0) {
        const cust = await db.customers.get(sale.customer_id);
        if (cust) {
          const prevBal = Number(cust.current_balance || 0);
          const newBal = prevBal + sale.balance_due;
          await db.customers.update(cust.id, {
            current_balance: newBal,
            updated_at: now,
          });
          await db.ledger_transactions.put({
            id: `ledg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            business_id: bizId,
            party_type: 'customer',
            party_id: cust.id,
            party_name: cust.name,
            transaction_type: 'CREDIT_SALE',
            amount: sale.balance_due,
            balance_after: newBal,
            reference_id: sale.id,
            notes: `Converted to Tax Invoice #${invoiceNumber}`,
            created_at: now,
            sync_status: 'synced',
          });
        }
      }

      // Update sale status to completed with official Tax Invoice #. An estimate
      // carried no payment, so the converted bill is recorded as paid in full.
      const productsNow = await db.products.bulkGet((sale.items || []).map((i) => i.product_id));
      const updatedSale: Sale = {
        ...sale,
        invoice_number: invoiceNumber,
        status: 'completed',
        items: (sale.items || []).map((item, idx) => {
          const cost = productsNow[idx]?.purchase_price || 0;
          return item.cost_price || cost <= 0 ? item : { ...item, cost_price: cost };
        }),
        amount_received: sale.grand_total - (sale.balance_due || 0),
        payment_status: (sale.balance_due || 0) > 0 ? 'partial' : 'paid',
        notes: sale.notes === 'ESTIMATE / QUOTATION' ? undefined : sale.notes,
        created_at: now,
        updated_at: now,
      };
      await db.sales.put(updatedSale);

      showTxToast(tr('🎉 Estimate converted to Tax Invoice #{invoiceNumber}! Inventory updated.', { invoiceNumber: invoiceNumber }), 'success');
      setActiveSaleForInvoice(updatedSale);
      setIsInvoiceModalOpen(true);
    } catch (err) {
      console.error('Failed to convert estimate to invoice:', err);
      showTxToast(tr('Failed to convert estimate to tax invoice.'), 'error');
    }
  };

  return { handleConvertToInvoice };
}
