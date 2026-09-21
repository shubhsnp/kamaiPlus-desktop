'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, FileDown, Package, SearchX } from 'lucide-react';
import { formatINR, cn } from '@/lib/utils';
import {
  CategorySalesSummary,
  ItemSalesSummary,
  PartySalesSummary,
  ProfitCoverage,
  formatReportQty,
  marginPercent,
} from '@/lib/reports/advancedReports';

export interface ProfitView {
  unlocked: boolean;
  onRequestUnlock: () => void;
}

export function profitText(paise: number, view: ProfitView): string {
  return view.unlocked ? formatINR(paise) : '₹ ••••';
}

function Margin({ p, view }: { p: ProfitCoverage; view: ProfitView }) {
  if (!view.unlocked) return null;
  return <span className="text-slate-400 font-medium"> ({marginPercent(p).toFixed(1)}%)</span>;
}

function ProfitCell({ p, view }: { p: ProfitCoverage; view: ProfitView }) {
  return (
    <button
      type="button"
      onClick={view.unlocked ? undefined : view.onRequestUnlock}
      className={cn('text-[11.5px] font-bold text-emerald-700 whitespace-nowrap', !view.unlocked && 'cursor-pointer hover:text-amber-600')}
      title={view.unlocked ? (p.uncostedLineCount > 0 ? `${p.uncostedLineCount} line(s) have no buying price` : 'Sales − buying cost') : 'Enter owner PIN to see profit'}
    >
      Profit: {profitText(p.totalProfitPaise, view)}
      <Margin p={p} view={view} />
      {view.unlocked && p.uncostedLineCount > 0 && <span className="ml-1 text-[10px] text-amber-600 font-black">PARTIAL</span>}
    </button>
  );
}

function RankBadge({ index }: { index: number }) {
  return (
    <span
      className={cn(
        'w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-black shrink-0',
        index === 0 ? 'bg-amber-100 text-amber-700' : index === 1 ? 'bg-slate-100 text-slate-600' : 'bg-slate-50 text-slate-500'
      )}
    >
      #{index + 1}
    </span>
  );
}

function Bar({ fraction, color }: { fraction: number; color: string }) {
  return (
    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
      <div className={cn('h-full rounded-full', color)} style={{ width: `${Math.max(2, Math.round(fraction * 100))}%` }} />
    </div>
  );
}

export function EmptyState({ title, subtitle, positive }: { title: string; subtitle: string; positive?: boolean }) {
  return (
    <div className="py-14 text-center">
      <div className={cn('w-14 h-14 rounded-2xl mx-auto flex items-center justify-center', positive ? 'bg-emerald-50' : 'bg-slate-100')}>
        {positive ? <CheckCircle2 className="w-7 h-7 text-emerald-600" /> : <SearchX className="w-7 h-7 text-slate-400" />}
      </div>
      <h3 className="mt-3 text-sm font-black text-slate-700">{title}</h3>
      <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
    </div>
  );
}

export function PartyList({
  parties,
  view,
  exportingId,
  onOpen,
  onExport,
}: {
  parties: PartySalesSummary[];
  view: ProfitView;
  exportingId: string | null;
  onOpen: (p: PartySalesSummary) => void;
  onExport: (p: PartySalesSummary) => void;
}) {
  if (parties.length === 0) return <EmptyState title="No Customer Sales" subtitle="Sales with customer information will be indexed here." />;
  return (
    <div className="space-y-2">
      {parties.map((p) => (
        <div
          key={p.partyId}
          role="button"
          tabIndex={0}
          onClick={() => onOpen(p)}
          onKeyDown={(e) => e.key === 'Enter' && onOpen(p)}
          className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center gap-3 hover:border-slate-300 hover:shadow-xs cursor-pointer transition"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 font-black flex items-center justify-center shrink-0">
            {(p.partyName[0] || '?').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-900 text-sm truncate">{p.partyName}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onExport(p);
                }}
                disabled={exportingId !== null}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black cursor-pointer disabled:opacity-50"
                title="Save this customer's account statement as PDF"
              >
                <FileDown className="w-3 h-3" /> {exportingId === p.partyId ? '…' : 'PDF'}
              </button>
            </div>
            <div className="text-[11.5px] text-slate-500 truncate">
              {p.invoiceCount} Bill{p.invoiceCount === 1 ? '' : 's'} • {p.partyPhone || 'Walk-in'}
              {p.creditPaise > 0 && <span className="text-amber-700 font-bold"> • Udhar {formatINR(p.creditPaise)}</span>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-black text-slate-900 font-mono">{formatINR(p.totalSalesPaise)}</div>
            <ProfitCell p={p} view={view} />
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function CategoryList({
  categories,
  view,
  onOpen,
}: {
  categories: CategorySalesSummary[];
  view: ProfitView;
  onOpen: (c: CategorySalesSummary) => void;
}) {
  if (categories.length === 0) return <EmptyState title="No Categories Found" subtitle="Category sales will appear here." />;
  const max = Math.max(...categories.map((c) => c.totalSalesPaise), 0);
  return (
    <div className="space-y-2">
      {categories.map((c, i) => (
        <div
          key={c.categoryName}
          role="button"
          tabIndex={0}
          onClick={() => onOpen(c)}
          onKeyDown={(e) => e.key === 'Enter' && onOpen(c)}
          className="bg-white border border-slate-200 rounded-2xl p-3 space-y-2 hover:border-slate-300 cursor-pointer transition"
        >
          <div className="flex items-center gap-2">
            <RankBadge index={i} />
            <span className="flex-1 font-black text-slate-900 text-sm truncate">{c.categoryName}</span>
            <span className="font-black text-slate-900 font-mono">{formatINR(c.totalSalesPaise)}</span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </div>
          <Bar fraction={max > 0 ? c.totalSalesPaise / max : 0} color="bg-emerald-500" />
          <div className="flex items-center justify-between text-[11.5px] text-slate-500">
            <span>Qty Sold: {formatReportQty(c.quantitySold)}</span>
            <ProfitCell p={c} view={view} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ItemList({ items, view }: { items: ItemSalesSummary[]; view: ProfitView }) {
  if (items.length === 0) return <EmptyState title="No Items Sold" subtitle="Product sales for this period will appear here." />;
  const max = Math.max(...items.map((c) => c.totalSalesPaise), 0);
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={it.itemId} className="bg-white border border-slate-200 rounded-2xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <RankBadge index={i} />
            <div className="flex-1 min-w-0">
              <div className="font-black text-slate-900 text-sm truncate">{it.itemName}</div>
              <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-500">{it.categoryName}</span>
            </div>
            <span className="font-black text-slate-900 font-mono">{formatINR(it.totalSalesPaise)}</span>
          </div>
          <Bar fraction={max > 0 ? it.totalSalesPaise / max : 0} color="bg-sky-500" />
          <div className="flex items-center justify-between text-[11.5px] text-slate-500">
            <span>Qty: {formatReportQty(it.quantitySold)} {it.unit || 'units'}</span>
            <ProfitCell p={it} view={view} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DeadStockList({ items, periodLabel }: { items: ItemSalesSummary[]; periodLabel: string }) {
  if (items.length === 0) {
    return <EmptyState positive title="Zero Dead Stock! 🎉" subtitle="Every single item in your store generated sales in this period." />;
  }
  return (
    <div className="space-y-2">
      <div className="px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        {items.length} item{items.length === 1 ? ' has' : 's have'} inventory but 0 sales in {periodLabel}.
      </div>
      {items.map((it) => (
        <div key={it.itemId} className="bg-white border border-rose-200 rounded-2xl p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
            <Package className="w-4 h-4 text-rose-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-black text-slate-900 text-sm truncate">{it.itemName}</div>
            <div className="text-[11.5px] text-slate-500">
              {it.categoryName} • {formatReportQty(it.stockQuantity)} {it.unit} in stock
            </div>
          </div>
          <span className="px-2 py-1 rounded-md bg-rose-50 text-rose-600 text-[10px] font-black">0 SOLD</span>
        </div>
      ))}
    </div>
  );
}
