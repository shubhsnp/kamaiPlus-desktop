'use client';
import { showAlert } from '@/lib/ui/dialogs';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Product, PurchaseBillLineItem } from '@/types';
import { formatINR } from '@/lib/utils';
import { 
  AlertTriangle, 
  Plus, 
  Sparkles, 
  Check, 
} from 'lucide-react';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { applyBillInward, BillInwardResult } from '@/lib/purchases/billInwardDb';
import { billLineProblem } from '@/lib/purchases/billSheet';
import { saveLabelHandoff } from '@/lib/labels/labelSettings';
import { BillInwardDone } from './BillInwardDone';
import { BillLineRow } from './BillLineRow';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { tr } from '@/lib/i18n/core';

interface BillScanReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (billId: string, updatedCount: number, createdCount: number) => void;
  initialBillData: {
    supplier_name_raw?: string;
    bill_number?: string;
    bill_date?: string;
    total_amount: number;
    line_items: PurchaseBillLineItem[];
    ai_model_used: string;
    raw_ai_response: string;
  };
  existingProducts: Product[];
  businessId: string;
}

export function BillScanReviewModal({
  isOpen,
  onClose,
  onSuccess,
  initialBillData,
  existingProducts,
  businessId,
}: BillScanReviewModalProps) {
  const [supplierName, setSupplierName] = useState(initialBillData.supplier_name_raw || '');
  const [billNumber, setBillNumber] = useState(initialBillData.bill_number || '');
  const [billDate, setBillDate] = useState(
    initialBillData.bill_date || new Date().toISOString().split('T')[0]
  );
  const [items, setItems] = useState<PurchaseBillLineItem[]>(initialBillData.line_items || []);
  const [isSaving, setIsSaving] = useState(false);
  const [showProblems, setShowProblems] = useState(false);
  // Saved: the window shows what happened and offers the labels.
  const [done, setDone] = useState<BillInwardResult | null>(null);
  const business = useBusiness();
  const router = useRouter();

  // Update a single item field
  const handleUpdateItem = (index: number, updates: Partial<PurchaseBillLineItem>) => {
    setItems((prev) => {
      const next = [...prev];
      const current = next[index];
      const updated = { ...current, ...updates };

      // Recalculate total price if qty or unit price changes
      if (updates.quantity !== undefined || updates.unit_price !== undefined) {
        const qty = updates.quantity !== undefined ? updates.quantity : current.quantity;
        const price = updates.unit_price !== undefined ? updates.unit_price : current.unit_price;
        updated.total_price = Math.round(qty * price);
      }

      next[index] = updated;
      return next;
    });
  };

  // Remove row
  const handleRemoveRow = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Add empty row
  const handleAddRow = () => {
    const newItem: PurchaseBillLineItem = {
      raw_name: '',
      is_new_product: true,
      quantity: 1,
      unit: 'piece',
      unit_price: 0,
      total_price: 0,
      selling_price: 0,
      confidence: 'high',
    };
    setItems((prev) => [...prev, newItem]);
  };

  // Calculate totals
  const totalAmountPaise = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
  const matchedCount = items.filter((i) => !i.is_new_product && i.matched_product_id).length;
  const newProductCount = items.filter((i) => i.is_new_product).length;

  // Rows that must be fixed before saving (a new item needs its selling price).
  const problems = items.map((item) => billLineProblem(item));
  const problemCount = problems.filter(Boolean).length;

  // Confirm: one transaction for the whole bill (lib/purchases/billInwardDb.ts).
  const handleConfirmInward = async () => {
    if (items.filter((i) => i.raw_name.trim()).length === 0) {
      showAlert(tr('No items to inward. Please add at least one line item.'));
      return;
    }
    setShowProblems(true);
    if (problemCount > 0) return;

    setIsSaving(true);
    try {
      const result = await applyBillInward({
        businessId,
        taxInclusive: business?.gst_pricing_mode !== 'exclusive',
        supplierName,
        billNumber,
        billDate,
        items,
        rawResponse: initialBillData.raw_ai_response,
        modelUsed: initialBillData.ai_model_used,
      });
      setDone(result);
    } catch (err: any) {
      console.error('Failed to confirm bill inward:', err);
      showAlert(tr('Error recording purchase bill: {error}', { error: err.message || tr('Unknown error') }));
    } finally {
      setIsSaving(false);
    }
  };

  const finish = () => {
    if (done) onSuccess(done.billId, done.restocked, done.created);
  };

  // "Print labels": Barcode Studio opens with these items, one label per piece.
  const printLabelsForBill = () => {
    if (!done) return;
    saveLabelHandoff(done.labels);
    finish();
    router.push('/barcode-generator?from=inward');
  };

  return (
    <Modal isOpen={isOpen} onClose={done ? finish : onClose} size="xl" title={tr('Purchase Bill Review & Stock Inward')}>
      {done ? (
        <BillInwardDone result={done} onClose={finish} onPrintLabels={printLabelsForBill} />
      ) : (
      <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
        {/* Header summary banner */}
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-400/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-900 font-bold">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{items.length} {tr('items read from your bill file. Review & confirm below.')}</span>
          </div>
          <div className="flex items-center gap-2 font-mono shrink-0">
            <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-800 font-bold">
              {matchedCount} {tr('Matched')}
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-amber-400/20 text-amber-800 font-bold">
              {newProductCount} {tr('New')}
            </span>
          </div>
        </div>

        {/* Bill Metadata Form */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
              {tr('Supplier / Wholesaler Name')}
            </label>
            <input
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder={tr('e.g. Balaji Distributors')}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-medium"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
              {tr('Bill / Invoice Number')}
            </label>
            <input
              type="text"
              value={billNumber}
              onChange={(e) => setBillNumber(e.target.value)}
              placeholder={tr('e.g. INV-9902')}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
              {tr('Invoice Date')}
            </label>
            <input
              type="date"
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-mono"
            />
          </div>
        </div>

        {/* Line Items Table */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 font-bold text-[11px] border-b border-slate-200 dark:border-slate-800">
                  <th className="py-2.5 px-3">{tr('Product Description')}</th>
                  <th className="py-2.5 px-3">{tr('Match Status')}</th>
                  <th className="py-2.5 px-3 w-20">{tr('Qty')}</th>
                  <th className="py-2.5 px-3 w-24">{tr('Unit')}</th>
                  <th className="py-2.5 px-3 w-28">{tr('Cost Price (₹)')}</th>
                  <th className="py-2.5 px-3 w-28">{tr('Selling Price (₹)')}</th>
                  <th className="py-2.5 px-3 text-right">{tr('Total (₹)')}</th>
                  <th className="py-2.5 px-2 text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 bg-white dark:bg-slate-950">
                {items.map((item, idx) => (
                  <BillLineRow
                    key={idx}
                    item={item}
                    existingProducts={existingProducts}
                    problem={showProblems ? problems[idx] : undefined}
                    onUpdate={(updates) => handleUpdateItem(idx, updates)}
                    onRemove={() => handleRemoveRow(idx)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Row Button */}
        <div className="flex justify-between items-center pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddRow}
            className="text-xs font-bold gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{tr('Add Another Item')}</span>
          </Button>

          <div className="text-right">
            <span className="text-xs text-slate-500 mr-2">{tr('Grand Total:')}</span>
            <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
              {formatINR(totalAmountPaise)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
          {showProblems && problemCount > 0 && (
            <span className="mr-auto text-xs font-bold text-rose-700 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> {tr('Rows to fix: {count}', { count: problemCount })}
            </span>
          )}
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
            {tr('Cancel')}
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={isSaving || items.length === 0}
            onClick={handleConfirmInward}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 shadow-md"
          >
            <Check className="w-4 h-4" />
            <span>{isSaving ? tr('Inwarding Inventory...') : tr('Confirm & Inward Stock')}</span>
          </Button>
        </div>
      </div>
      )}
    </Modal>
  );
}
