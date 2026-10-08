'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { Package, Receipt, Users, HardDrive } from 'lucide-react';
import { tr } from '@/lib/i18n/core';

interface DataHealthSummaryCardsProps {
  productCount: number;
  salesCount: number;
  customerCount: number;
  movementCount: number;
}

export const DataHealthSummaryCards: React.FC<DataHealthSummaryCardsProps> = ({
  productCount,
  salesCount,
  customerCount,
  movementCount,
}) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
      <Card className="p-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {tr('Products')}
            </div>
            <div className="text-lg font-mono font-black text-slate-900 dark:text-slate-100">
              {productCount}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {tr('Sales Bills')}
            </div>
            <div className="text-lg font-mono font-black text-slate-900 dark:text-slate-100">
              {salesCount}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-sky-600">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {tr('Customers')}
            </div>
            <div className="text-lg font-mono font-black text-slate-900 dark:text-slate-100">
              {customerCount}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {tr('Stock Movements')}
            </div>
            <div className="text-lg font-mono font-black text-slate-900 dark:text-slate-100">
              {movementCount}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
