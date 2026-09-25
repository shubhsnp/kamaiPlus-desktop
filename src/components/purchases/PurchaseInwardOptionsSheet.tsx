'use client';
import { showAlert } from '@/lib/ui/dialogs';

import React, { useEffect, useState, useRef } from 'react';
import {
  FileSpreadsheet,
  PackagePlus,
  X,
  ArrowRight,
  Loader2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Product, PurchaseBillLineItem } from '@/types';
import { matchExtractedItemsWithProducts } from '@/lib/purchases/matchProductByName';
import { BillScanReviewModal } from './BillScanReviewModal';

interface PurchaseInwardOptionsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  businessId?: string;
  existingProducts: Product[];
  onManualInwardClick: () => void;
  onRapidBarcodeClick?: () => void;
  onScanSuccess?: (billId: string, updatedCount: number, createdCount: number) => void;
}

export function PurchaseInwardOptionsSheet({
  isOpen,
  onClose,
  businessId = 'biz_default',
  existingProducts,
  onManualInwardClick,
  onRapidBarcodeClick,
  onScanSuccess,
}: PurchaseInwardOptionsSheetProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [reviewData, setReviewData] = useState<{
    supplier_name_raw?: string;
    bill_number?: string;
    bill_date?: string;
    total_amount: number;
    line_items: PurchaseBillLineItem[];
    ai_model_used: string;
    raw_ai_response: string;
  } | null>(null);

  const csvInputRef = useRef<HTMLInputElement>(null);

  // Esc closes the options sheet (the review modal handles Esc itself).
  useEffect(() => {
    if (!isOpen || reviewData || isProcessing) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, reviewData, isProcessing, onClose]);

  if (!isOpen && !reviewData) return null;

  // CSV / Excel File Direct Parser
  const handleCsvSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsProcessing(true);
    setProcessingStatus('Parsing CSV / Excel items...');

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

      if (rawRows.length === 0) {
        showAlert('The uploaded spreadsheet contains no data rows.');
        return;
      }

      const items: PurchaseBillLineItem[] = [];
      for (const row of rawRows) {
        const findVal = (possibleKeys: string[]) => {
          for (const key of Object.keys(row)) {
            const cleanKey = key.trim().toLowerCase();
            if (possibleKeys.some((pk) => cleanKey.includes(pk.toLowerCase()))) {
              return row[key];
            }
          }
          return undefined;
        };

        const rawName = String(findVal(['item name', 'name', 'product', 'description', 'title', 'item']) || '').trim();
        if (!rawName) continue;

        const qty = Number(findVal(['quantity', 'qty', 'units', 'count', 'stock']) || 1);
        const rawCost = Number(findVal(['purchase price', 'cost price', 'rate', 'cost', 'buy price', 'pp']) || 0);
        const rawSell = Number(findVal(['selling price', 'mrp', 'price', 'sale price', 'sp']) || (rawCost > 0 ? rawCost * 1.25 : 0));
        const rawUnit = String(findVal(['unit', 'uom', 'pack']) || 'piece').trim().toLowerCase();

        const costPaise = Math.round(rawCost * 100);
        const sellPaise = Math.round(rawSell * 100);

        items.push({
          raw_name: rawName,
          is_new_product: true,
          quantity: isNaN(qty) || qty <= 0 ? 1 : qty,
          unit: rawUnit || 'piece',
          unit_price: costPaise,
          total_price: costPaise * (isNaN(qty) || qty <= 0 ? 1 : qty),
          selling_price: sellPaise || Math.round(costPaise * 1.25),
          confidence: 'high',
        });
      }

      if (items.length === 0) {
        showAlert('Could not find item names in the file. Please check column headers.');
        return;
      }

      const enrichedItems = matchExtractedItemsWithProducts(items, existingProducts);
      const totalAmountPaise = enrichedItems.reduce((sum, i) => sum + i.total_price, 0);

      setReviewData({
        supplier_name_raw: file.name.replace(/\.[^/.]+$/, ''),
        bill_number: `CSV_${Date.now().toString().slice(-4)}`,
        bill_date: new Date().toISOString().split('T')[0],
        total_amount: totalAmountPaise,
        line_items: enrichedItems,
        ai_model_used: 'csv-direct-parser',
        raw_ai_response: JSON.stringify({ source: 'csv_upload', count: items.length }),
      });
      onClose();
    } catch (err: any) {
      console.error('CSV parse error:', err);
      showAlert('Failed to read CSV/Excel file. Please check format.');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  return (
    <>
      {/* Hidden File Input */}
      <input
        ref={csvInputRef}
        type="file"
        accept=".csv, .xlsx, .xls"
        onChange={handleCsvSelected}
        className="hidden"
      />

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={onClose}
        >
          {/* Bottom Sheet Drawer on Mobile, Centered Modal on Desktop */}
          <div
            className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in slide-in-from-bottom-5 duration-250"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Handle Pill (Mobile) */}
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto sm:hidden mb-1" />

            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-black text-slate-900 dark:text-white">
                    {'Wholesale Bill Inward'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {'Upload an Excel / CSV bill to add products, prices & stock in one go.'}
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Processing Overlay */}
            {isProcessing ? (
              <div className="py-10 text-center space-y-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl border border-amber-300/40">
                <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
                <div className="space-y-0.5">
                  <p className="text-sm font-black text-slate-900 dark:text-white">
                    {processingStatus || 'Reading file...'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {'Reading products, quantities & cost rates from the file'}
                  </p>
                </div>
              </div>
            ) : (
              /* Smart Adaptive Options Grid */
              <div className="space-y-2.5">
                {/* 1. Upload a CSV / Excel File */}
                <div
                  onClick={() => csvInputRef.current?.click()}
                  className="p-3.5 rounded-2xl border border-emerald-300 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/20 hover:bg-emerald-100/70 hover:border-emerald-400 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-between gap-3 group shadow-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                          Upload Excel / CSV File
                        </span>
                        <span className="px-1.5 py-0.2 rounded-md bg-emerald-600 text-white text-[9px] font-black uppercase tracking-tight">
                          Bulk
                        </span>
                      </div>
                      <div className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium truncate mt-0.5">
                        Spreadsheet with item names, prices &amp; stock
                      </div>
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 text-emerald-700 dark:text-emerald-400 group-hover:translate-x-1 transition-transform shrink-0" />
                </div>

                {/* 2. Add Manually (Single Item) */}
                <div
                  onClick={() => {
                    onClose();
                    onManualInwardClick();
                  }}
                  className="p-3.5 rounded-2xl border border-purple-300 dark:border-purple-900/60 bg-purple-50/70 dark:bg-purple-950/20 hover:bg-purple-100/70 hover:border-purple-400 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-between gap-3 group shadow-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                      <PackagePlus className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                          {'Add Single Item Manually'}
                        </span>
                        <span className="px-1.5 py-0.2 rounded-md bg-purple-600 text-white text-[9px] font-black uppercase tracking-tight">
                          Manual Form
                        </span>
                      </div>
                      <div className="text-[11px] text-purple-800 dark:text-purple-300 font-medium truncate mt-0.5">
                        Fill in product name, rate, category and stock individually
                      </div>
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 text-purple-700 dark:text-purple-400 group-hover:translate-x-1 transition-transform shrink-0" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Review & Confirm Inward Modal */}
      {reviewData && (
        <BillScanReviewModal
          isOpen={!!reviewData}
          onClose={() => setReviewData(null)}
          onSuccess={(billId, updatedCount, createdCount) => {
            setReviewData(null);
            if (onScanSuccess) {
              onScanSuccess(billId, updatedCount, createdCount);
            }
          }}
          initialBillData={reviewData}
          existingProducts={existingProducts}
          businessId={businessId}
        />
      )}
    </>
  );
}
