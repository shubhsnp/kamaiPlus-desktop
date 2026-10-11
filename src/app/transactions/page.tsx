'use client';
import { showAlert } from '@/lib/ui/dialogs';

import { useEffect, useState } from 'react';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { useTranslation } from '@/lib/i18n';
import { formatINR } from '@/lib/utils';
import { Sale } from '@/types';
import { generateTallyPrimeXML } from '@/lib/tally/tallyXmlGenerator';
import { exportTransactionsCSV } from '@/lib/reports/transactionsCsv';
import { generateBulkInvoicesPDF } from '@/lib/reports/bulkInvoiceReport';
import { Receipt } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// Modular Sub-components
import { TransactionHeaderActions } from '@/components/transactions/TransactionHeaderActions';
import { TransactionMetricsRibbon } from '@/components/transactions/TransactionMetricsRibbon';
import { TransactionFilterToolbar } from '@/components/transactions/TransactionFilterToolbar';
import { TransactionBillCard } from '@/components/transactions/TransactionBillCard';
import { TransactionModals } from '@/components/transactions/TransactionModals';
import { useTransactionFilters, DatePreset, PaymentFilter, SortOption } from '@/components/transactions/useTransactionFilters';
import { tr } from '@/lib/i18n/core';
import { createConvertEstimate } from '@/components/transactions/convertEstimate';

export type { DatePreset, PaymentFilter, SortOption };

// Bill cards rendered per page. Rendering a shop's whole history at once (thousands
// of cards) made this screen lag; totals above still cover every filtered bill.
const TX_PAGE_SIZE = 100;

export default function TransactionsPage() {
  const { t } = useTranslation();

  // Modals State
  const [activeSaleForInvoice, setActiveSaleForInvoice] = useState<Sale | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnSaleId, setReturnSaleId] = useState<string | undefined>(undefined);
  const [editSale, setEditSale] = useState<Sale | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isClearHistoryModalOpen, setIsClearHistoryModalOpen] = useState(false);

  // Queries
  const business = useBusiness();
  const customers = useLiveQuery(async () => db.customers.toArray()) || [];

  // v4.97.0: the newest bills show at once; the whole history (for "All dates", the totals,
  // search and the exports) follows right after. Reading a year of bills took 1–1.5 s before
  // anything showed. Until it is in, totals show "…" and the exports are off — they never
  // work on part of the history.
  const recentSales = useLiveQuery(() => db.sales.orderBy('created_at').reverse().limit(TX_PAGE_SIZE).toArray());
  const fullSales = useLiveQuery(async () => {
    // Every bill: date filters used to silently miss anything older than the latest 500.
    // Newest first. Read in index order (one fast bulk read) and turned round here — a
    // reversed read walks a cursor bill by bill: ~2× slower on a year of bills (v4.97.0).
    return (await db.sales.orderBy('created_at').toArray()).reverse();
  });
  const historyLoading = fullSales === undefined;
  const allSales = fullSales ?? recentSales ?? [];

  // Filter & KPI Logic
  const {
    searchQuery,
    setSearchQuery,
    datePreset,
    setDatePreset,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    paymentFilter,
    setPaymentFilter,
    selectedCustomerId,
    setSelectedCustomerId,
    sortBy,
    setSortBy,
    filteredSales,
    totalRevenuePaise,
    totalCashPaise,
    totalUpiPaise,
    totalCreditPaise,
    revenueBillCount,
    clearAllFilters,
  } = useTransactionFilters(allSales, customers);

  // Back to the first page whenever the filters change.
  const [visibleCount, setVisibleCount] = useState(TX_PAGE_SIZE);
  useEffect(() => {
    setVisibleCount(TX_PAGE_SIZE);
  }, [searchQuery, datePreset, startDate, endDate, paymentFilter, selectedCustomerId, sortBy]);

  // Export Filtered Records to CSV
  const handleExportCSV = () => {
    if (historyLoading) return;
    exportTransactionsCSV(filteredSales);
  };

  // Bulk Multi-Invoice Continuous PDF Download
  const handleBulkDownloadInvoices = async () => {
    if (!business || filteredSales.length === 0 || historyLoading) return;
    const selectedCustomerObj = customers.find((c) => c.id === selectedCustomerId);
    const dateLabel = datePreset === 'custom'
      ? `${startDate || 'Start'} to ${endDate || 'End'}`
      : datePreset.toUpperCase();
    const res = await generateBulkInvoicesPDF({
      sales: filteredSales,
      business,
      dateRangeLabel: dateLabel,
      customerName: selectedCustomerObj?.name,
    });
    if (res.ok) {
      showTxToast(res.path ? tr('Bulk Invoices PDF saved to Documents folder!') : tr('Print/PDF dialog opened.'), 'success');
    } else {
      showTxToast(res.error || tr('Failed to generate bulk PDF.'), 'error');
    }
  };

  const [txToast, setTxToast] = useState<{ message: string; type?: 'success' | 'info' | 'error' } | null>(null);

  const showTxToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setTxToast({ message, type });
    setTimeout(() => setTxToast(null), 4000);
  };

  const { handleConvertToInvoice } = createConvertEstimate({
    setActiveSaleForInvoice, setIsInvoiceModalOpen, business, showTxToast,
  });

  const handleOpenInvoice = (sale: Sale) => {
    setActiveSaleForInvoice(sale);
    setIsInvoiceModalOpen(true);
  };


  // Export 1-Click Tally Prime XML
  const handleExportTallyXML = async () => {
    if (historyLoading) return;
    if (filteredSales.length === 0) {
      showAlert(tr('No transactions to export.'));
      return;
    }
    const { xml, filename } = generateTallyPrimeXML({
      business,
      sales: filteredSales,
      customers,
      returns: await db.sales_returns.toArray(),
    });
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Clear All Transaction History. The invoice counter is deliberately NOT reset:
  // restarting at INV-001 would reissue numbers already given to customers / filed in GST.
  const handleClearAllHistory = async () => {
    try {
      await db.sales.clear();
      await db.sales_returns.clear();
      showTxToast(tr('All transaction history cleared successfully.'), 'success');
    } catch (err) {
      console.error('Failed to clear history:', err);
      showTxToast(tr('Failed to clear transaction history.'), 'error');
    }
  };

  return (
    <div className="space-y-3.5 pb-20 sm:pb-8 animate-in fade-in duration-150">
      {/* 1. Header & Quick Actions */}
      <TransactionHeaderActions
        filteredCount={historyLoading ? 0 : filteredSales.length}
        totalSalesCount={historyLoading ? 0 : allSales.length}
        onOpenSalesReturn={() => {
          setReturnSaleId(undefined);
          setIsReturnModalOpen(true);
        }}
        onExportCSV={handleExportCSV}
        onExportTallyXML={handleExportTallyXML}
        onBulkDownloadInvoices={handleBulkDownloadInvoices}
        onOpenClearHistory={() => setIsClearHistoryModalOpen(true)}
      />

      {/* 2. Key Metrics Summary Ribbon */}
      <TransactionMetricsRibbon
        totalRevenuePaise={totalRevenuePaise}
        totalCashPaise={totalCashPaise}
        totalUpiPaise={totalUpiPaise}
        totalCreditPaise={totalCreditPaise}
        salesCount={revenueBillCount}
        loading={historyLoading}
      />

      {/* 3. Filter & Search Toolbar */}
      <TransactionFilterToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        datePreset={datePreset}
        onDatePresetChange={setDatePreset}
        startDate={startDate}
        onStartDateChange={setStartDate}
        endDate={endDate}
        onEndDateChange={setEndDate}
        paymentFilter={paymentFilter}
        onPaymentFilterChange={setPaymentFilter}
        selectedCustomerId={selectedCustomerId}
        onCustomerChange={setSelectedCustomerId}
        sortBy={sortBy}
        onSortChange={setSortBy}
        customers={customers}
        totalSalesCount={allSales.length}
        filteredCount={filteredSales.length}
        onClearAllFilters={clearAllFilters}
      />

      {/* 4. Transactions List Container */}
      <Card className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
        <div className="p-3 sm:p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
            {tr('Transactions (')}{historyLoading ? '…' : filteredSales.length})
          </span>
          <span className="text-[11px] text-slate-400 font-medium">
            {tr('Tap any row to view & print the bill')}
          </span>
        </div>

        {/* Active Customer Filter Banner */}
        {selectedCustomerId !== 'all' && (
          <div className="px-3.5 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-950 dark:text-amber-200">
                {tr('Filtered Customer:')} <span className="font-black underline">{selectedCustomerId === 'walk-in' ? tr('Walk-in (Unregistered)') : (customers.find((c) => c.id === selectedCustomerId)?.name || selectedCustomerId)}</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 font-bold text-[11px]">
                {filteredSales.length} {filteredSales.length === 1 ? tr('Bill') : tr('Bills')} {tr('• Total:')} {formatINR(totalRevenuePaise)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCustomerId('all')}
              className="text-xs text-amber-800 dark:text-amber-300 hover:underline font-bold cursor-pointer"
            >
              {tr('Clear Filter ✕')}
            </button>
          </div>
        )}

        {filteredSales.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <Receipt className="w-8 h-8 mx-auto text-slate-400 opacity-60" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{tr('No matching transactions found')}</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {tr('Try adjusting your date range, customer selection, or payment mode filters.')}
            </p>
            <Button size="sm" variant="outline" onClick={clearAllFilters} className="mt-2 text-xs rounded-xl">
              {tr('Reset All Filters')}
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredSales.slice(0, visibleCount).map((sale) => (
              <TransactionBillCard
                key={sale.id}
                sale={sale}
                onOpenInvoice={handleOpenInvoice}
                onConvertToInvoice={handleConvertToInvoice}
                onEditSale={(s) => {
                  setEditSale(s);
                  setIsEditModalOpen(true);
                }}
                onReturnSale={(sId) => {
                  setReturnSaleId(sId);
                  setIsReturnModalOpen(true);
                }}

              />
            ))}
            {filteredSales.length > visibleCount && (
              <div className="p-3 flex items-center justify-center gap-3">
                <span className="text-[11px] text-slate-500 font-medium">
                  {tr('Showing')} {visibleCount} {tr('of')} {filteredSales.length}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setVisibleCount((n) => n + TX_PAGE_SIZE)}
                  className="text-xs rounded-xl cursor-pointer"
                >
                  {tr('Show')} {Math.min(TX_PAGE_SIZE, filteredSales.length - visibleCount)} {tr('more')}
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ---------------- MODALS & FLOATING TOASTS ---------------- */}
      <TransactionModals
        business={business}
        isInvoiceModalOpen={isInvoiceModalOpen}
        setIsInvoiceModalOpen={setIsInvoiceModalOpen}
        activeSaleForInvoice={activeSaleForInvoice}
        isEditModalOpen={isEditModalOpen}
        setIsEditModalOpen={setIsEditModalOpen}
        editSale={editSale}
        setEditSale={setEditSale}
        isReturnModalOpen={isReturnModalOpen}
        setIsReturnModalOpen={setIsReturnModalOpen}
        returnSaleId={returnSaleId}
        setReturnSaleId={setReturnSaleId}
        isClearHistoryModalOpen={isClearHistoryModalOpen}
        setIsClearHistoryModalOpen={setIsClearHistoryModalOpen}
        allSalesCount={allSales.length}
        totalRevenuePaise={totalRevenuePaise}
        onConfirmClear={handleClearAllHistory}
        txToast={txToast}
      />
    </div>
  );
}
