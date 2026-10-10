'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { useTranslation } from '@/lib/i18n';
import { Sale, Product } from '@/types';
import { cloudSyncSoon } from '@/lib/firebase/lazyCloud';
import { tracksOwnStock } from '@/lib/products/variants';
import dynamic from 'next/dynamic';
import { AdvancedAnalyticsBanner } from '@/components/dashboard/AdvancedAnalyticsBanner';
import { getLocalDayRange, getSaleNetTotal, isRevenueSale } from '@/lib/sales/saleMath';
import { computeDrawerSummary, dayOpeningFloat, localDateKey } from '@/lib/reports/cashDrawer';
import { buildAdvancedReport, isProfitPartial } from '@/lib/reports/advancedReports';
import { isRestaurantMode, useFeatureSwitches } from '@/lib/features/featureSwitches';
import { billStats, showProfitCard } from '@/lib/dashboard/homeTiles';
import { openPrintersWindow } from '@/lib/hardware/printerWatch';

const DayEndClosingReportModal = dynamic(
  () => import('@/components/reports/DayEndClosingReportModal').then((m) => m.DayEndClosingReportModal),
  { ssr: false }
);
const FastBarcodeInwardModal = dynamic(
  () => import('@/components/inward/FastBarcodeInwardModal').then((m) => m.FastBarcodeInwardModal),
  { ssr: false }
);

// Modular Dashboard Sub-components
import { TodayBusinessPulse } from '@/components/dashboard/TodayBusinessPulse';
import { QuickActionDock } from '@/components/dashboard/QuickActionDock';
import { QuickToolsGrid } from '@/components/dashboard/QuickToolsGrid';
import { TodayInsights } from '@/components/dashboard/TodayInsights';

import { DashboardStockWatchlist } from '@/components/dashboard/DashboardStockWatchlist';
import { DashboardRecentSales } from '@/components/dashboard/DashboardRecentSales';
import { tr } from '@/lib/i18n/core';


export default function DashboardHome() {
  const { t } = useTranslation();
  const [selectedSaleForInvoice, setSelectedSaleForInvoice] = useState<Sale | null>(null);
  const [isClosingReportOpen, setIsClosingReportOpen] = useState<boolean>(false);
  const [restockToast, setRestockToast] = useState<string | null>(null);
  const [isFastInwardOpen, setIsFastInwardOpen] = useState(false);
  const switches = useFeatureSwitches();

  const business = useBusiness();

  // ── Batched query 1: Products (single subscription) ──
  const products = useLiveQuery(async () => db.products.toArray()) || [];
  const activeProducts = useMemo(() => products.filter((p) => p.is_active !== false), [products]);

  // ── Batched query 2: Today's activity — sales, returns, ledger, expenses in ONE subscription ──
  const todayData = useLiveQuery(async () => {
    const { start, end } = getLocalDayRange();
    const [sales, returns, ledger, expenses, shifts] = await Promise.all([
      db.sales.where('created_at').between(start, end, true, false).toArray(),
      db.sales_returns.where('created_at').aboveOrEqual(start).toArray(),
      db.ledger_transactions.where('created_at').between(start, end, true, false).toArray(),
      db.cash_expenses.where('created_at').between(start, end, true, false).toArray(),
      db.cash_registers.where('opened_at').between(start, end, true, false).toArray(),
    ]);
    return { sales, returns, ledger, expenses, openingFloat: dayOpeningFloat(shifts, localDateKey(new Date())) };
  });
  const todaysSales = todayData?.sales || [];
  const todaysReturns = todayData?.returns || [];
  const todaysLedger = todayData?.ledger || [];
  const todaysExpenses = todayData?.expenses || [];
  const todaysOpeningFloat = todayData?.openingFloat || 0;

  // Revenue bills only: estimates and fully returned bills are not sales; partial returns count net.
  const todaysRevenueSales = useMemo(() => todaysSales.filter(isRevenueSale), [todaysSales]);
  const todaysBillTotals = useMemo(
    () => todaysRevenueSales.map((s) => getSaleNetTotal(s, todaysReturns.filter((r) => r.original_sale_id === s.id))),
    [todaysRevenueSales, todaysReturns]
  );
  const todaysSalesTotal = useMemo(() => todaysBillTotals.reduce((acc, n) => acc + n, 0), [todaysBillTotals]);
  const todaysBillStats = useMemo(() => billStats(todaysBillTotals), [todaysBillTotals]);

  // Cash in hand: the morning float (Cash Register) + cash kept from sales (no change, split cash
  // included) + khata cash − cash expenses & refunds — what the drawer holds (float added in v4.99.0, K-D38).
  const netCashInHand = useMemo(() => {
    const drawer = computeDrawerSummary({ sales: todaysSales, expenses: todaysExpenses, ledger: todaysLedger, openingCash: todaysOpeningFloat });
    return Math.max(0, drawer.expectedCash);
  }, [todaysSales, todaysExpenses, todaysLedger, todaysOpeningFloat]);

  // Profit only over lines with a frozen buying price — same rule as Sales Analytics.
  const todaysProfit = useMemo(
    () => buildAdvancedReport({ sales: todaysSales, returns: todaysReturns, products, categories: [] }),
    [todaysSales, todaysReturns, products]
  );
  const todaysGrossProfit = todaysProfit.totalProfitPaise;
  // No buying prices anywhere (cost field off, none imported): profit would always be ₹0.
  const showProfit = showProfitCard({
    costPriceOn: switches.product_cost_price,
    anyProductHasCost: products.some((p) => Number(p.purchase_price) > 0),
    costedRevenuePaise: todaysProfit.costedRevenuePaise,
    restaurant: isRestaurantMode(),
  });

  // ── Batched query 3: Khata debtors + Recent sales in ONE subscription ──
  const dashLists = useLiveQuery(async () => {
    const [debtors, recent] = await Promise.all([
      db.customers.where('current_balance').above(0).toArray(),
      db.sales.orderBy('created_at').reverse().limit(50).toArray(),
    ]);
    return { debtors, recent };
  });
  const customersWithCredit = dashLists?.debtors || [];
  const recentSales = dashLists?.recent || [];

  const totalOutstandingCredit = useMemo(() => {
    return customersWithCredit.reduce((acc, c) => acc + (c.current_balance > 0 ? c.current_balance : 0), 0);
  }, [customersWithCredit]);

  // Stock Watchlist (Out of stock & low stock)
  const outOfStockProducts = useMemo(() => {
    return activeProducts.filter(
      (p) => tracksOwnStock(p) && Number(p.current_stock ?? 0) <= 0
    );
  }, [activeProducts]);

  const lowStockProducts = useMemo(() => {
    return activeProducts.filter(
      (p) => tracksOwnStock(p) && (Number(p.current_stock ?? 0) <= Number(p.min_stock_level ?? 5) || Number(p.current_stock ?? 0) <= 0)
    );
  }, [activeProducts]);

  const stockWatchlist = useMemo(() => {
    return [...lowStockProducts].sort((a, b) => {
      const stockA = Number(a.current_stock ?? 0);
      const stockB = Number(b.current_stock ?? 0);
      return stockA - stockB;
    });
  }, [lowStockProducts]);
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

      void cloudSyncSoon(activeBizId);

      setRestockToast(tr('✅ Added +{quantityToAdd} {v2} to {name}!', { quantityToAdd: quantityToAdd, v2: product.unit || 'units', name: product.name }));
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
        showProfit={showProfit}
        averageBillPaise={todaysBillStats.averagePaise}
        biggestBillPaise={todaysBillStats.biggestPaise}
      />

      {/* 2. 1-TAP QUICK ACTION DOCK (POS, Khata, Inward, Closing, Printers) */}
      <QuickActionDock
        onOpenClosingReport={() => setIsClosingReportOpen(true)}
        onOpenFastInward={() => setIsFastInwardOpen(true)}
        onOpenPrinters={openPrintersWindow}
      />

      {/* 3. ADVANCED ANALYTICS BANNER (Android Home parity) */}
      {switches.sales_reports && <AdvancedAnalyticsBanner />}



      {/* 3b. TODAY AT A GLANCE — top items sold today, biggest udhar (v4.93.0) */}
      <TodayInsights sales={todaysRevenueSales} debtors={customersWithCredit} khataOn={switches.khata} />

      {/* 4. LOW STOCK & OUT OF STOCK WATCHLIST ACCORDION (v4.108.0: only when the shop counts stock) */}
      {switches.stock_counting && <DashboardStockWatchlist
        stockWatchlist={stockWatchlist}
        outOfStockProducts={outOfStockProducts}
        lowStockProducts={lowStockProducts}
        onQuickRestock={handleQuickRestock}
      />}

      {/* 5. SHOP MANAGEMENT TOOLS (Compact 8-Tool Grid) */}
      <QuickToolsGrid productsCount={products.length} />
      {/* Day-End Closing Z-Report Modal (Loaded on-demand only when opened) */}
      {isClosingReportOpen && (
        <DayEndClosingReportModal
          isOpen={isClosingReportOpen}
          onClose={() => setIsClosingReportOpen(false)}
          business={business}
          sales={todaysSales}
          expenses={todaysExpenses}
          ledger={todaysLedger}
          openingCash={todaysOpeningFloat}
          returns={todaysReturns}
        />
      )}
      {isFastInwardOpen && <FastBarcodeInwardModal onClose={() => setIsFastInwardOpen(false)} />}
    </div>
  );
}
