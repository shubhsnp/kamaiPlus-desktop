'use client';
import { showAlert } from '@/lib/ui/dialogs';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { Sale, SalesReturn, ReturnItem, CashExpense } from '@/types';
import { formatINR } from '@/lib/utils';
import { getLineRefundPaise, getReturnedQtyByLine, isEstimate } from '@/lib/sales/saleMath';
import { 
  RotateCcw, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Receipt, 
  Package, 
  DollarSign, 
  Printer, 
  ArrowLeft,
  FileText
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface SalesReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSaleId?: string;
  onReturnCompleted?: (salesReturn: SalesReturn) => void;
}

export const SalesReturnModal: React.FC<SalesReturnModalProps> = ({
  isOpen,
  onClose,
  initialSaleId,
  onReturnCompleted,
}) => {
  const [searchInvoice, setSearchInvoice] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  // Keyed by line index: the same product can appear on two lines of a bill.
  const [returnQuantities, setReturnQuantities] = useState<{ [line: number]: number }>({});
  const [restockFlags, setRestockFlags] = useState<{ [line: number]: boolean }>({});
  const [alreadyReturned, setAlreadyReturned] = useState<number[]>([]);
  const [refundMethod, setRefundMethod] = useState<'cash' | 'upi' | 'store_credit' | 'khata_deduction'>('cash');
  const [returnReason, setReturnReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedReturn, setCompletedReturn] = useState<SalesReturn | null>(null);

  useEffect(() => {
    if (initialSaleId) {
      db.sales.get(initialSaleId).then((sale) => {
        if (sale) {
          handleSelectSale(sale);
        }
      });
    }
  }, [initialSaleId, isOpen]);

  const handleSearch = async () => {
    if (!searchInvoice.trim()) return;
    const clean = searchInvoice.trim().toUpperCase();
    const found = await db.sales.where('invoice_number').equalsIgnoreCase(clean).first();
    if (found) {
      handleSelectSale(found);
    } else {
      showAlert(`Invoice #${searchInvoice} not found.`);
    }
  };

  const handleSelectSale = async (sale: Sale) => {
    if (isEstimate(sale)) {
      showAlert('This is an estimate / quotation — nothing was sold, so there is nothing to return.');
      return;
    }
    const previous = await db.sales_returns.where('original_sale_id').equals(sale.id).toArray();
    setAlreadyReturned(getReturnedQtyByLine(sale, previous));
    setSelectedSale(sale);
    const initialQty: { [line: number]: number } = {};
    const initialRestock: { [line: number]: boolean } = {};
    sale.items.forEach((_, idx) => {
      initialQty[idx] = 0;
      initialRestock[idx] = true;
    });
    setReturnQuantities(initialQty);
    setRestockFlags(initialRestock);
  };

  const maxReturnable = (idx: number) =>
    selectedSale ? Math.max(0, (selectedSale.items[idx]?.quantity || 0) - (alreadyReturned[idx] || 0)) : 0;

  // Refund = what was actually charged for those units (discounts and GST included).
  const totalRefundPaise = selectedSale
    ? selectedSale.items.reduce((acc, item, idx) => acc + getLineRefundPaise(item, returnQuantities[idx] || 0), 0)
    : 0;

  const totalReturnItemCount = Object.values(returnQuantities).reduce((acc, q) => acc + q, 0);

  const handleProcessReturn = async () => {
    if (!selectedSale || totalRefundPaise <= 0) return;
    const needsCustomer = refundMethod === 'khata_deduction' || refundMethod === 'store_credit';
    if (needsCustomer && !selectedSale.customer_id) {
      showAlert('Store credit / khata adjustment needs a customer on the bill. Choose Cash or UPI refund for a walk-in sale.');
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
              title: `${refundMethod === 'upi' ? 'UPI' : 'Cash'} Refund: ${returnNumber} (Inv #${sale.invoice_number})`,
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
      showAlert('Return processing failed. Nothing was changed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setSelectedSale(null);
    setCompletedReturn(null);
    setSearchInvoice('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-slate-800" />
          <span>Sales Return & Credit Notes</span>
        </div>
      }
      description="Process customer returns, restock inventory items, and issue cash refunds or customer credit notes."
      size="lg"
    >
      <div className="space-y-4 text-xs">
        {/* SUCCESS CONFIRMATION STATE */}
        {completedReturn ? (
          <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <div>
              <h3 className="text-base font-black text-emerald-950">Sales Return Completed!</h3>
              <p className="text-xs text-emerald-800 mt-0.5">
                Credit Note #{completedReturn.return_number} generated for {formatINR(completedReturn.refund_amount)}
              </p>
            </div>

            <div className="flex justify-center gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={handleReset}>
                Process Another Return
              </Button>
              <Button size="sm" onClick={onClose} className="bg-emerald-600 text-white font-bold">
                Done
              </Button>
            </div>
          </div>
        ) : !selectedSale ? (
          /* SEARCH INVOICE STEP */
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Enter Invoice Number (e.g. INV-1001)..."
                value={searchInvoice}
                onChange={(e) => setSearchInvoice(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold font-mono text-xs focus:bg-white focus:outline-none focus:border-slate-900"
                autoFocus
              />
              <Button onClick={handleSearch} size="sm" className="bg-slate-900 text-white font-bold">
                <Search className="w-3.5 h-3.5 mr-1" />
                <span>Search</span>
              </Button>
            </div>

            <p className="text-[11px] text-slate-500">
              Tip: You can also initiate a return directly from the Transaction History table.
            </p>
          </div>
        ) : (
          /* RETURN ITEM DETAILS */
          <div className="space-y-4">
            {/* Invoice Info Bar */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="font-extrabold text-slate-900 block">
                  Invoice #{selectedSale.invoice_number}
                </span>
                <span className="text-[11px] text-slate-500">
                  {selectedSale.customer_name || 'Cash Customer'} • {new Date(selectedSale.created_at).toLocaleDateString('en-IN')}
                </span>
              </div>
              <button
                onClick={() => setSelectedSale(null)}
                className="text-[11px] text-slate-500 hover:text-slate-800 font-bold"
              >
                Change Invoice
              </button>
            </div>

            {/* Items Table with Return Steppers */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-[10px] uppercase">
                  <tr>
                    <th className="py-2 px-3">Item Description</th>
                    <th className="py-2 px-2 text-center">Sold Qty</th>
                    <th className="py-2 px-2 text-center">Return Qty</th>
                    <th className="py-2 px-2 text-center">Restock?</th>
                    <th className="py-2 px-3 text-right">Refund Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {selectedSale.items.map((item, idx) => {
                    const retQty = returnQuantities[idx] || 0;
                    const isRestock = restockFlags[idx] ?? true;
                    const maxQty = maxReturnable(idx);

                    return (
                      <tr key={idx} className={maxQty <= 0 ? 'opacity-50' : undefined}>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {item.product_name}
                          <div className="text-[10px] text-slate-500 font-mono">
                            {formatINR(item.unit_price)} / {item.unit}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-slate-500">
                          {item.quantity}
                          {(alreadyReturned[idx] || 0) > 0 && (
                            <div className="text-[9.5px] text-rose-600 font-bold">{alreadyReturned[idx]} returned</div>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setReturnQuantities((prev) => ({
                                  ...prev,
                                  [idx]: Math.max(0, retQty - 1),
                                }))
                              }
                              className="w-5 h-5 rounded bg-slate-200 font-bold flex items-center justify-center text-slate-700"
                            >
                              -
                            </button>
                            <span className="w-6 text-center font-bold font-mono">{retQty}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setReturnQuantities((prev) => ({
                                  ...prev,
                                  [idx]: Math.min(maxQty, retQty + 1),
                                }))
                              }
                              className="w-5 h-5 rounded bg-slate-200 font-bold flex items-center justify-center text-slate-700"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={isRestock}
                            onChange={(e) =>
                              setRestockFlags((prev) => ({
                                ...prev,
                                [idx]: e.target.checked,
                              }))
                            }
                            className="rounded text-emerald-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {formatINR(getLineRefundPaise(item, retQty))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Refund Mode & Totals */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  Refund Method
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { id: 'cash', label: 'Cash Refund' },
                    { id: 'upi', label: 'UPI Online' },
                    { id: 'store_credit', label: 'Store Credit' },
                    { id: 'khata_deduction', label: 'Credit Balance -' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setRefundMethod(m.id as any)}
                      className={`p-1.5 rounded-lg border text-[11px] font-bold text-center transition-all ${
                        refundMethod === m.id
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-200 font-extrabold text-sm text-slate-900">
                <span>Total Refund Amount:</span>
                <span className="font-mono text-base text-rose-700">{formatINR(totalRefundPaise)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <Button variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleProcessReturn}
                disabled={totalRefundPaise <= 0 || isProcessing}
                size="sm"
                className="bg-slate-900 text-white font-bold"
              >
                {isProcessing ? 'Processing...' : `Issue Return (${formatINR(totalRefundPaise)})`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
