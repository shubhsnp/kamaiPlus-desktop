'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { formatINR } from '@/lib/utils';
import { 
  Package, 
  AlertTriangle, 
  TrendingUp, 
  Layers 
} from 'lucide-react';
import { ProfitMask } from '@/components/privacy/ProfitMask';
import { tr } from '@/lib/i18n/core';

interface ProductMetricsRibbonProps {
  totalProducts: number;
  lowStockCount: number;
  totalStockValuePaise: number;
  totalCategories: number;
}

export const ProductMetricsRibbon: React.FC<ProductMetricsRibbonProps> = ({
  totalProducts,
  lowStockCount,
  totalStockValuePaise,
  totalCategories,
}) => {
  return (
    <Card className="p-2.5 sm:p-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs rounded-2xl">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800">
        {/* 1. Total Products */}
        <div className="px-2 py-1 sm:py-0 sm:first:pl-1">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold">
            <span className="flex items-center gap-1 text-sky-700 dark:text-sky-400">
              <Package className="w-3.5 h-3.5 text-sky-600" />
              <span>{tr('Catalog Items')}</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">{tr('Master')}</span>
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-slate-900 dark:text-slate-100 mt-0.5 leading-tight">
            {totalProducts}
          </div>
          <div className="text-[10px] text-slate-400 truncate mt-0.5">
            {tr('Registered products')}
          </div>
        </div>

        {/* 2. Low Stock Alert */}
        <div className="px-2 pt-2 sm:pt-0 sm:px-3">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold">
            <span className="flex items-center gap-1 text-rose-700 dark:text-rose-400">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>{tr('Low Stock Alerts')}</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">{tr('Reorder')}</span>
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-rose-600 dark:text-rose-400 mt-0.5 leading-tight">
            {lowStockCount}
          </div>
          <div className="text-[10px] text-slate-400 truncate mt-0.5">
            {tr('Below safety threshold')}
          </div>
        </div>

        {/* 3. Total Stock Valuation */}
        <div className="px-2 pt-2 sm:pt-0 sm:px-3">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold">
            <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>{tr('Inventory Asset')}</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">{tr('Valuation')}</span>
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 leading-tight">
            <ProfitMask value={formatINR(totalStockValuePaise)} />
          </div>
          <div className="text-[10px] text-slate-400 truncate mt-0.5">
            {tr('Stock at cost price')}
          </div>
        </div>

        {/* 4. Active Categories */}
        <div className="px-2 pt-2 sm:pt-0 sm:pl-3">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold">
            <span className="flex items-center gap-1 text-purple-700 dark:text-purple-400">
              <Layers className="w-3.5 h-3.5 text-purple-600" />
              <span>{tr('Categories')}</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">{tr('Groups')}</span>
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-purple-600 dark:text-purple-400 mt-0.5 leading-tight">
            {totalCategories}
          </div>
          <div className="text-[10px] text-slate-400 truncate mt-0.5">
            {tr('Product groups')}
          </div>
        </div>
      </div>
    </Card>
  );
};
