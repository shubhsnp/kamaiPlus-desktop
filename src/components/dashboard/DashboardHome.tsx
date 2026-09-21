'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from '@/lib/i18n';
import { Sale, Product } from '@/types';
import { triggerBackgroundSync } from '@/lib/firebase/backgroundSync';
import { InvoiceModal } from '@/components/invoices/InvoiceModal';
import { AdvancedAnalyticsBanner } from '@/components/dashboard/AdvancedAnalyticsBanner';
import { getLocalDayRange, getSaleNetTotal, isRevenueSale } from '@/lib/sales/saleMath';
import { computeDrawerSummary } from '@/lib/reports/cashDrawer';
import { buildAdvancedReport, isProfitPartial } from '@/lib/reports/advancedReports';
import { DayEndClosingReportModal } from '@/components/reports/DayEndClosingReportModal';

// Modular Dashboard Sub-components
import { TodayBusinessPulse } from '@/components/dashboard/TodayBusinessPulse';
import { QuickActionDock } from '@/components/dashboard/QuickActionDock';
import { QuickToolsGrid } from '@/components/dashboard/QuickToolsGrid';

import { DashboardStockWatchlist } from '@/components/dashboard/DashboardStockWatchlist';
import { DashboardRecentSales } from '@/components/dashboard/DashboardRecentSales';


export default function DashboardHome() {
  const { t } = useTranslation();
  const [selectedSaleForInvoice, setSelectedSaleForInvoice] = useState<Sale | null>(null);
  const [isClosingReportOpen, setIsClosingReportOpen] = useState<boolean>(false);
  const [restockToast, setRestockToast] = useState<string | null>(null);

  const business = useLiveQuery(async () => db.businesses.toCollection().first());
  const businessType = business?.business_type || 'grocery';

  // Live Database Queries
  const products = useLiveQuery(async () => db.products.toArray()) || [];
  const activeProducts = useMemo(() => products.filter((p) => p.is_active !== false), [products]);

  // Today's Sales (local calendar day, half-open)
  const todaysSales = useLiveQuery(async () => {
    const { start, end } = getLocalDayRange();
    return db.sales.where('created_at').between(start, end, true, false).toArray();
  }) || [];
  const todaysReturns = useLiveQuery(async () => {
    const { start } = getLocalDayRange();
    // Returns of today's bills can only have been made today or later.
    return db.sales_returns.where('created_at').aboveOrEqual(start).toArray();
  }) || [];
  const todaysLedger = useLiveQuery(async () => {
    const { start, end } = getLocalDayRange();
    return db.ledger_transactions.where('created_at').between(start, end, true, false).toArray();
  }) || [];

  // Revenue bills only: estimates and fully returned bills are not sales; partial returns count net.
  const todaysRevenueSales = useMemo(() => todaysSales.filter(isRevenueSale), [todaysSales]);
  const todaysSalesTotal = useMemo(() => {
    return todaysRevenueSales.reduce(
      (acc, s) => acc + getSaleNetTotal(s, todaysReturns.filter((r) => r.original_sale_id === s.id)),
      0
    );
  }, [todaysRevenueSales, todaysReturns]);

  // Today's Cash Expenses
  const todaysExpenses = useLiveQuery(async () => {
    const { start, end } = getLocalDayRange();
    return db.cash_expenses.where('created_at').between(start, end, true, false).toArray();
  }) || [];

  // Cash in hand: cash kept from sales (no change, split cash included) + khata cash − cash expenses & refunds
  const netCashInHand = useMemo(() => {
    const drawer = computeDrawerSummary({ sales: todaysSales, expenses: todaysExpenses, ledger: todaysLedger });
    return Math.max(0, drawer.expectedCash);
  }, [todaysSales, todaysExpenses, todaysLedger]);

  // Profit only over lines with a frozen buying price — same rule as Sales Analytics.
  const todaysProfit = useMemo(
    () => buildAdvancedReport({ sales: todaysSales, returns: todaysReturns, products, categories: [] }),
    [todaysSales, todaysReturns, products]
  );
  const todaysGrossProfit = todaysProfit.totalProfitPaise;

  // Outstanding Khata Debtors
  const customersWithCredit = useLiveQuery(async () => {
    return db.customers.where('current_balance').above(0).toArray();
  }) || [];
  const totalOutstandingCredit = useMemo(() => {
    return customersWithCredit.reduce((acc, c) => acc + (c.current_balance > 0 ? c.current_balance : 0), 0);
  }, [customersWithCredit]);

  // Stock Watchlist (Out of stock & low stock)
  const outOfStockProducts = useMemo(() => {
    return activeProducts.filter(
      (p) => !p.is_unlimited_stock && Number(p.current_stock ?? 0) <= 0
    );
  }, [activeProducts]);

  const lowStockProducts = useMemo(() => {
    return activeProducts.filter(
      (p) => !p.is_unlimited_stock && (Number(p.current_stock ?? 0) <= Number(p.min_stock_level ?? 5) || Number(p.current_stock ?? 0) <= 0)
    );
  }, [activeProducts]);

  const stockWatchlist = useMemo(() => {
    return [...lowStockProducts].sort((a, b) => {
      const stockA = Number(a.current_stock ?? 0);
      const stockB = Number(b.current_stock ?? 0);
      return stockA - stockB;
    });
  }, [lowStockProducts]);

  // Recent Sales list
  const recentSales = useLiveQuery(async () => {
    return await db.sales.orderBy('created_at').reverse().limit(50).toArray();
  }) || [];

  // Niche Metric Computations


  const looseItemsCount = useMemo(() => {
    return products.filter((p) => p.is_loose_item || ['kg', 'gram', 'litre'].includes(p.unit)).length;
  }, [products]);

  // 1-Tap Quick Restock Handler
  const handleQuickRestock = async (product: Product, quantityToAdd: number = 10) => {
    try {
      const now = new Date().toISOString();
      const current = Number(product.current_stock ?? 0);
      const newStock = current + quantityToAdd;
      const activeBizId = business?.id || product.business_id || 'biz_default';

      await db.products.update(product.id, {
        current_stock: newStock,
        updated_at: now,
      });

      await db.inventory_movements.put({
        id: `mov_dash_restock_${Date.now()}_${product.id}`,
        business_id: activeBizId,
        product_id: product.id,
        product_name: product.name,
        movement_type: 'PURCHASE',
        quantity: quantityToAdd,
        previous_stock: current,
        new_stock: newStock,
        reason: `Quick Dashboard Restock (+${quantityToAdd} ${product.unit || 'units'})`,
        created_by: 'owner',
        created_at: now,
      });

      try {
        triggerBackgroundSync(activeBizId);
      } catch {}

      setRestockToast(`✅ Added +${quantityToAdd} ${product.unit || 'units'} to ${product.name}!`);
      setTimeout(() => setRestockToast(null), 3500);
    } catch (err) {
      console.error('Failed to quick restock item:', err);
    }
  };


  return (
    <div className="space-y-4 pb-20 sm:pb-6 animate-in fade-in duration-150">
      {/* Restock Toast Notification */}
      {restockToast && (
        <div className="fixed bottom-16 sm:bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl border border-slate-800 shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in">
          <span>{restockToast}</span>
        </div>
      )}


      {/* 1. TODAY'S BUSINESS PULSE (4-Stat Realtime Metric Ribbon) */}
      <TodayBusinessPulse
        todaysSalesTotal={todaysSalesTotal}
        todaysSalesCount={todaysRevenueSales.length}
        todaysGrossProfit={todaysGrossProfit}
        profitCoveredRevenue={todaysProfit.costedRevenuePaise}
        isProfitPartial={isProfitPartial(todaysProfit)}
        netCashInHand={netCashInHand}
        totalOutstandingCredit={totalOutstandingCredit}
        customersWithCreditCount={customersWithCredit.length}
      />

      {/* 2. 1-TAP QUICK ACTION DOCK (POS, Khata, Inward, Closing) */}
      <QuickActionDock
        onOpenClosingReport={() => setIsClosingReportOpen(true)}
      />

      {/* 3. ADVANCED ANALYTICS BANNER (Android Home parity) */}
      <AdvancedAnalyticsBanner />



      {/* 4. LOW STOCK & OUT OF STOCK WATCHLIST ACCORDION */}
      <DashboardStockWatchlist
        stockWatchlist={stockWatchlist}
        outOfStockProducts={outOfStockProducts}
        lowStockProducts={lowStockProducts}
        onQuickRestock={handleQuickRestock}
      />

      {/* 5. SHOP MANAGEMENT TOOLS (Compact 8-Tool Grid) */}
      <QuickToolsGrid productsCount={products.length} />

      {/* 6. RECENT TRANSACTIONS STREAM WITH 1-CLICK ACTIONS */}
      <DashboardRecentSales
        sales={recentSales}
        onSelectSaleForInvoice={(sale) => setSelectedSaleForInvoice(sale)}
        business={business}
      />

      {/* ---------------- MODALS ---------------- */}
      {/* Day-End Closing Z-Report Modal */}
      <DayEndClosingReportModal
        isOpen={isClosingReportOpen}
        onClose={() => setIsClosingReportOpen(false)}
        business={business}
        sales={todaysSales}
        expenses={todaysExpenses}
      />

      {/* Tax Invoice Full Bill Preview Modal */}
      <InvoiceModal
        isOpen={Boolean(selectedSaleForInvoice)}
        onClose={() => setSelectedSaleForInvoice(null)}
        sale={selectedSaleForInvoice}
        business={business}
      />
    </div>
  );
}
