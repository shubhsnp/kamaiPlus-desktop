'use client';

import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { Product, Supplier } from '@/types';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { tracksOwnStock } from '@/lib/products/variants';

// Modular Sub-components
import { InventoryHeaderActions } from '@/components/inventory/InventoryHeaderActions';
import { InventoryMetricsRibbon } from '@/components/inventory/InventoryMetricsRibbon';
import { InventoryNavTabs, InventoryTabType } from '@/components/inventory/InventoryNavTabs';
import { ReorderAlertsList } from '@/components/inventory/ReorderAlertsList';
import { StockMovementsList } from '@/components/inventory/StockMovementsList';
import { tr } from '@/lib/i18n/core';

// Lazy-load heavy modals
const ExcelInventoryImporter = dynamic(
  () => import('@/components/inventory/ExcelInventoryImporter').then((m) => m.ExcelInventoryImporter),
  { ssr: false }
);

export default function InventoryPage() {
  const [isExcelImporterOpen, setIsExcelImporterOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<InventoryTabType>('reorder');
  const [invToast, setInvToast] = useState<{ message: string; type?: 'success' | 'info' | 'error' } | null>(null);

  const showInvToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setInvToast({ message, type });
    setTimeout(() => setInvToast(null), 4000);
  };

  const business = useBusiness();
  const products = useLiveQuery(async () => {
    const all = await db.products.toArray();
    return all.filter((p) => p.is_active !== false);
  }) || [];
  const suppliers = useLiveQuery(async () => db.suppliers.toArray()) || [];
  const movements = useLiveQuery(async () => db.inventory_movements.reverse().limit(100).toArray()) || [];

  // Low stock products
  const lowStockProducts = useMemo(() => {
    return products.filter((p) => tracksOwnStock(p) && p.current_stock <= (p.min_stock_level || 5));
  }, [products]);



  // Inventory asset valuation
  const totalAssetValuePaise = useMemo(() => {
    return products.reduce((acc, p) => {
      if (p.is_unlimited_stock) return acc;
      const cost = p.purchase_price || p.selling_price || 0;
      return acc + (cost * Math.max(0, p.current_stock));
    }, 0);
  }, [products]);

  // Quick Restock Handler
  const handleQuickRestock = async (product: Product, quantity: number) => {
    const newStock = product.current_stock + quantity;
    await db.products.update(product.id, {
      current_stock: newStock,
      updated_at: new Date().toISOString(),
    });

    await db.inventory_movements.put({
      id: `mov_${Date.now()}`,
      business_id: business?.id || 'biz_default',
      product_id: product.id,
      product_name: product.name,
      movement_type: 'PURCHASE',
      quantity,
      previous_stock: product.current_stock,
      new_stock: newStock,
      reason: '1-Tap quick restock',
      created_by: 'owner',
      created_at: new Date().toISOString(),
    });

    showInvToast(tr('✅ Restocked +{quantity} units for {name}!', { quantity: quantity, name: product.name }));
  };


  return (
    <div className="space-y-3.5 pb-20 sm:pb-8 animate-in fade-in duration-150">
      {/* 1. Header Actions */}
      <InventoryHeaderActions
        totalItems={products.length}
        onOpenExcelImporter={() => setIsExcelImporterOpen(true)}
      />

      {/* 2. Metrics Ribbon */}
      <InventoryMetricsRibbon
        totalItems={products.length}
        totalAssetValuePaise={totalAssetValuePaise}
        lowStockCount={lowStockProducts.length}
      />

      {/* 3. Navigation Tabs */}
      <InventoryNavTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        lowStockCount={lowStockProducts.length}
      />

      {/* 4. Active Tab Content */}
      {activeTab === 'reorder' && (
        <ReorderAlertsList
          lowStockProducts={lowStockProducts}
          suppliers={suppliers}
          onQuickRestock={handleQuickRestock}
        />
      )}


      {activeTab === 'movements' && (
        <StockMovementsList
          movements={movements}
        />
      )}

      {/* ---------------- MODALS ---------------- */}
      <ExcelInventoryImporter
        isOpen={isExcelImporterOpen}
        onClose={() => setIsExcelImporterOpen(false)}
        businessId={business?.id || 'biz_default'}
      />

      {/* Floating Toast */}
      {invToast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-2xl bg-slate-900/95 border border-slate-700 text-white text-xs font-bold shadow-2xl animate-in slide-in-from-bottom-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{invToast.message}</span>
        </div>
      )}
    </div>
  );
}
