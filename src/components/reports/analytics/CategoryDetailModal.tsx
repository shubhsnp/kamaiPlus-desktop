'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { formatINR } from '@/lib/utils';
import { CategorySalesSummary, ItemSalesSummary, formatReportQty, marginPercent } from '@/lib/reports/advancedReports';
import { ItemList, ProfitView, profitText } from './AnalyticsLists';

/** Items sold in one category — port of the Android CategoryReportDetailScreen. */
export function CategoryDetailModal({
  category,
  items,
  periodLabel,
  view,
  onClose,
}: {
  category: CategorySalesSummary | null;
  items: ItemSalesSummary[];
  periodLabel: string;
  view: ProfitView;
  onClose: () => void;
}) {
  if (!category) return null;
  return (
    <Modal isOpen onClose={onClose} title={category.categoryName} description={`${periodLabel} • ${items.length} item(s) sold`} size="lg">
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5">
            <div className="text-[11px] font-semibold text-emerald-800">Category Sales</div>
            <div className="font-black font-mono text-slate-900">{formatINR(category.totalSalesPaise)}</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
            <div className="text-[11px] font-semibold text-slate-500">Qty Sold</div>
            <div className="font-black font-mono text-slate-900">{formatReportQty(category.quantitySold)}</div>
          </div>
          <button type="button" onClick={view.unlocked ? undefined : view.onRequestUnlock} className="text-left bg-indigo-50 border border-indigo-200 rounded-xl p-2.5">
            <div className="text-[11px] font-semibold text-indigo-800">Est. Profit</div>
            <div className="font-black font-mono text-slate-900">{profitText(category.totalProfitPaise, view)}</div>
            {view.unlocked && <div className="text-[10px] text-slate-500">{marginPercent(category).toFixed(1)}% margin</div>}
          </button>
        </div>
        <ItemList items={items} view={view} />
      </div>
    </Modal>
  );
}
