'use client';
import { showAlert } from '@/lib/ui/dialogs';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { Sale, SalesReturn } from '@/types';
import { formatINR } from '@/lib/utils';
import { getLineRefundPaise, getReturnedQtyByLine, isEstimate } from '@/lib/sales/saleMath';
import { RotateCcw, Search, CheckCircle2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { tr } from '@/lib/i18n/core';
import { createSalesReturnSave } from '@/components/sales/salesReturnSave';

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

  // Every opening starts fresh (v4.129.0): the window stays mounted, so without this the last
  // return's "Sales Return Completed" (or the last bill) showed again — even for a different bill.
  useEffect(() => {
    if (!isOpen) return;
    setCompletedReturn(null);
    setSelectedSale(null);
    setSearchInvoice('');
    setReturnReason('');
    setRefundMethod('cash');
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
      showAlert(tr('Invoice #{searchInvoice} not found.', { searchInvoice: searchInvoice }));
    }
  };

  const handleSelectSale = async (sale: Sale) => {
    if (isEstimate(sale)) {
      showAlert(tr('This is an estimate / quotation — nothing was sold, so there is nothing to return.'));
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

  const { handleProcessReturn } = createSalesReturnSave({
    onReturnCompleted, selectedSale, returnQuantities, restockFlags, alreadyReturned, refundMethod,
    returnReason, setIsProcessing, setCompletedReturn, maxReturnable, totalRefundPaise,
  });

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
          <span>{tr('Sales Return & Credit Notes')}</span>
        </div>
      }
      description={tr('Process customer returns, restock inventory items, and issue cash refunds or customer credit notes.')}
      size="lg"
    >
      <div className="space-y-4 text-xs">
        {/* SUCCESS CONFIRMATION STATE */}
        {completedReturn ? (
          <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <div>
              <h3 className="text-base font-black text-emerald-950">{tr('Sales Return Completed!')}</h3>
              <p className="text-xs text-emerald-800 mt-0.5">
                {tr('Credit Note #')}{completedReturn.return_number} {tr('generated for')} {formatINR(completedReturn.refund_amount)}
              </p>
            </div>

            <div className="flex justify-center gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={handleReset}>
                {tr('Process Another Return')}
              </Button>
              <Button size="sm" onClick={onClose} className="bg-emerald-600 text-white font-bold">
                {tr('Done')}
              </Button>
            </div>
          </div>
        ) : !selectedSale ? (
          /* SEARCH INVOICE STEP */
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder={tr('Enter Invoice Number (e.g. INV-1001)...')}
                value={searchInvoice}
                onChange={(e) => setSearchInvoice(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold font-mono text-xs focus:bg-white focus:outline-none focus:border-slate-900"
                autoFocus
              />
              <Button onClick={handleSearch} size="sm" className="bg-slate-900 text-white font-bold">
                <Search className="w-3.5 h-3.5 mr-1" />
                <span>{tr('Search')}</span>
              </Button>
            </div>

            <p className="text-[11px] text-slate-500">
              {tr('Tip: You can also initiate a return directly from the Transaction History table.')}
            </p>
          </div>
        ) : (
          /* RETURN ITEM DETAILS */
          <div className="space-y-4">
            {/* Invoice Info Bar */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="font-extrabold text-slate-900 block">
                  {tr('Invoice #')}{selectedSale.invoice_number}
                </span>
                <span className="text-[11px] text-slate-500">
                  {selectedSale.customer_name || tr('Cash Customer')} • {new Date(selectedSale.created_at).toLocaleDateString('en-IN')}
                </span>
              </div>
              <button
                onClick={() => setSelectedSale(null)}
                className="text-[11px] text-slate-500 hover:text-slate-800 font-bold"
              >
                {tr('Change Invoice')}
              </button>
            </div>

            {/* Items Table with Return Steppers */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-[10px] uppercase">
                  <tr>
                    <th className="py-2 px-3">{tr('Item Description')}</th>
                    <th className="py-2 px-2 text-center">{tr('Sold Qty')}</th>
                    <th className="py-2 px-2 text-center">{tr('Return Qty')}</th>
                    <th className="py-2 px-2 text-center">{tr('Restock?')}</th>
                    <th className="py-2 px-3 text-right">{tr('Refund Amount')}</th>
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
                            <div className="text-[10.5px] text-rose-600 font-bold">{alreadyReturned[idx]} {tr('returned')}</div>
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
                  {tr('Refund Method')}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { id: 'cash', label: tr('Cash Refund') },
                    { id: 'upi', label: tr('UPI Online') },
                    { id: 'store_credit', label: tr('Store Credit') },
                    { id: 'khata_deduction', label: tr('Credit Balance -') },
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
                <span>{tr('Total Refund Amount:')}</span>
                <span className="font-mono text-base text-rose-700">{formatINR(totalRefundPaise)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <Button variant="outline" size="sm" onClick={onClose}>
                {tr('Cancel')}
              </Button>
              <Button
                onClick={handleProcessReturn}
                disabled={totalRefundPaise <= 0 || isProcessing}
                size="sm"
                className="bg-slate-900 text-white font-bold"
              >
                {isProcessing ? tr('Processing...') : tr('Issue Return ({v1})', { v1: formatINR(totalRefundPaise) })}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
