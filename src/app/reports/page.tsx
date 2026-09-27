'use client';

import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookOpen, Eye, EyeOff, FileDown, LineChart, PieChart, Search, TrendingUp, Wallet, X } from 'lucide-react';
import { db } from '@/lib/db';
import { Sale } from '@/types';
import { formatINR, cn } from '@/lib/utils';
import {
  CategorySalesSummary,
  PartySalesSummary,
  REPORT_PERIOD_LABELS,
  ReportSort,
  buildAdvancedReport,
  isDeadStock,
  isProfitPartial,
  marginPercent,
  periodSpanText,
  resolveReportPeriod,
  sortReport,
} from '@/lib/reports/advancedReports';
import { saveGeneralReportPdf, savePartyStatementPdf } from '@/lib/reports/reportOutput';
import { getDesktopApi } from '@/lib/desktop/desktopBridge';
import { OwnerPinPrompt } from '@/components/privacy/OwnerPinPrompt';
import { useFeatureSwitches } from '@/lib/features/featureSwitches';
import { CategoryList, DeadStockList, ItemList, PartyList, ProfitView, profitText } from '@/components/reports/analytics/AnalyticsLists';
import { PartyDetailModal } from '@/components/reports/analytics/PartyDetailModal';
import { CategoryDetailModal } from '@/components/reports/analytics/CategoryDetailModal';
import { msg, tr } from '@/lib/i18n/core';

type Tab = 'parties' | 'categories' | 'items' | 'dead';

const SORTS: { id: ReportSort; label: string }[] = [
  { id: 'sales', label: msg('Sales (High to Low)') },
  { id: 'profit', label: msg('Profit (High to Low)') },
  { id: 'qty', label: msg('Quantity Sold') },
];

/**
 * Advanced Sales Analytics — desktop port of the Android AdvancedSalesReportsScreen:
 * period chips, sort, revenue / profit / cash / udhar ribbon, search and the
 * Parties, Categories, Items and Dead Stock tabs, with PDF exports.
 */
export default function SalesAnalyticsPage() {
  const [periodLabel, setPeriodLabel] = useState<string>('This Month');
  const [sort, setSort] = useState<ReportSort>('sales');
  const [tab, setTab] = useState<Tab>('parties');
  const [search, setSearch] = useState('');
  const [pinUnlocked, setUnlocked] = useState(false);
  // Settings → Features → "Hide profit from staff" off: profit is always shown, no PIN.
  const privacyOn = useFeatureSwitches().profit_privacy;
  const unlocked = pinUnlocked || !privacyOn;
  const [pinOpen, setPinOpen] = useState(false);
  const [openParty, setOpenParty] = useState<PartySalesSummary | null>(null);
  const [openCategory, setOpenCategory] = useState<CategorySalesSummary | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string; path?: string } | null>(null);

  const period = useMemo(() => resolveReportPeriod(periodLabel), [periodLabel]);
  const startIso = period.start.toISOString();
  const endIso = period.end.toISOString();

  const business = useLiveQuery(() => db.businesses.toCollection().first());
  const sales = useLiveQuery(() => db.sales.where('created_at').between(startIso, endIso, true, false).toArray(), [startIso, endIso]);
  const returns = useLiveQuery(() => db.sales_returns.toArray());
  const products = useLiveQuery(() => db.products.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());

  const data = useMemo(() => {
    if (!sales || !returns || !products || !categories) return null;
    return sortReport(buildAdvancedReport({ sales, returns, products, categories }), sort);
  }, [sales, returns, products, categories, sort]);

  const view: ProfitView = { unlocked, onRequestUnlock: () => setPinOpen(true) };
  const dateSpan = periodSpanText(period.start, period.end);
  const q = search.trim().toLowerCase();

  const parties = (data?.partyData || []).filter((p) => !q || p.partyName.toLowerCase().includes(q) || p.partyPhone.includes(q));
  const cats = (data?.categoryData || []).filter((c) => !q || c.categoryName.toLowerCase().includes(q));
  const sold = (data?.itemData || []).filter((i) => !isDeadStock(i) && (!q || i.itemName.toLowerCase().includes(q) || i.categoryName.toLowerCase().includes(q)));
  const dead = (data?.itemData || []).filter((i) => isDeadStock(i) && (!q || i.itemName.toLowerCase().includes(q) || i.categoryName.toLowerCase().includes(q)));

  const report = (res: { ok: boolean; path?: string; error?: string }, label: string) => {
    if (res.ok) setNotice({ tone: 'ok', text: res.path ? tr('{label} saved.', { label: label }) : tr('Choose "Save as PDF" in the print dialog.'), path: res.path });
    else setNotice({ tone: 'err', text: res.error || tr('Could not create the {label}.', { label: label.toLowerCase() }) });
  };

  const exportGeneral = async () => {
    if (!data) return;
    setExporting('general');
    try {
      report(await saveGeneralReportPdf({ data, periodLabel, dateSpan, business, includeProfit: unlocked, start: period.start }), tr('Sales report PDF'));
    } finally {
      setExporting(null);
    }
  };

  const exportParty = async (party: PartySalesSummary, invoices?: Sale[]) => {
    if (!sales || !returns) return;
    setExporting(party.partyId);
    try {
      const bills = invoices || sales.filter((s) => (s.customer_id || 'walkin') === party.partyId);
      report(await savePartyStatementPdf({ party, invoices: bills, returns, periodLabel, dateSpan, business }), tr('Account statement PDF'));
    } finally {
      setExporting(null);
    }
  };

  const ps = data?.paymentSummary;
  const desktop = getDesktopApi();
  const tabs: { id: Tab; label: string }[] = [
    { id: 'parties', label: tr('Parties ({v1})', { v1: data?.partyData.length ?? 0 }) },
    { id: 'categories', label: tr('Categories ({v1})', { v1: data?.categoryData.length ?? 0 }) },
    { id: 'items', label: tr('Items ({v1})', { v1: data?.itemData.filter((i) => !isDeadStock(i)).length ?? 0 }) },
    { id: 'dead', label: tr('Dead Stock ({v1})', { v1: data?.itemData.filter(isDeadStock).length ?? 0 }) },
  ];

  return (
    <div className="space-y-3.5 pb-16">
      <div className="bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-950 text-indigo-200 flex items-center justify-center">
            <LineChart className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-black text-slate-900 leading-tight">{tr('Sales Analytics')}</h1>
            <p className="text-xs text-slate-500">{!data ? tr('Analyzing counter sales…') : `${tr(periodLabel)} • ${dateSpan} • ${formatINR(ps?.totalPaise || 0)}`}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {privacyOn && (
            <button
              type="button"
              onClick={() => (unlocked ? setUnlocked(false) : setPinOpen(true))}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer hover:bg-slate-50"
              title={unlocked ? tr('Hide profit') : tr('Show profit (owner PIN)')}
            >
              {unlocked ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />} {unlocked ? tr('Hide Profit') : tr('Show Profit')}
            </button>
          )}
          <button
            type="button"
            onClick={exportGeneral}
            disabled={!data || exporting !== null}
            className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <FileDown className="w-4 h-4 text-amber-300" /> {exporting === 'general' ? tr('Saving…') : tr('PDF Report')}
          </button>
        </div>
      </div>

      {notice && (
        <div className={cn('p-2.5 rounded-xl text-xs font-bold border flex flex-wrap items-center gap-2', notice.tone === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800')}>
          <span className="flex-1">{notice.text}</span>
          {notice.path && desktop && (
            <>
              <button type="button" onClick={() => desktop.openPath(notice.path!)} className="px-2 py-1 rounded-lg bg-white border border-emerald-300 cursor-pointer">{tr('Open')}</button>
              <button type="button" onClick={() => desktop.showItemInFolder(notice.path!)} className="px-2 py-1 rounded-lg bg-white border border-emerald-300 cursor-pointer">{tr('Show in folder')}</button>
            </>
          )}
          <button type="button" onClick={() => setNotice(null)} className="p-1 cursor-pointer" aria-label={tr('Dismiss')}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {REPORT_PERIOD_LABELS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriodLabel(p)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer transition',
                periodLabel === p ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
            >
              {tr(p)}
            </button>
          ))}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as ReportSort)} className="text-xs font-bold border border-slate-200 rounded-full px-3 py-1.5 bg-white text-slate-700">
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {tr('Sort:')} {tr(s.label)}
            </option>
          ))}
        </select>
      </div>

      {data && ps && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <Metric icon={TrendingUp} tone="text-emerald-600" title={tr('Total Revenue')} tag={tr('Turnover')} value={formatINR(ps.totalPaise)} valueTone="text-emerald-700" sub={tr('{invoiceCount} bills • net of returns', { invoiceCount: data.invoiceCount })} />
          <button type="button" className="text-left" onClick={unlocked ? undefined : () => setPinOpen(true)}>
            <Metric
              icon={PieChart}
              tone={isProfitPartial(data) ? 'text-amber-600' : 'text-indigo-600'}
              title={tr('Est. Profit')}
              tag={!unlocked ? 'PIN' : isProfitPartial(data) ? tr('Partial') : `${marginPercent(data).toFixed(1)}%`}
              value={profitText(data.totalProfitPaise, view)}
              sub={!unlocked ? tr('Tap to unlock with owner PIN') : isProfitPartial(data) ? tr('{uncostedLineCount} line(s) lack buying price', { uncostedLineCount: data.uncostedLineCount }) : tr('Sales − buying cost')}
            />
          </button>
          <Metric icon={Wallet} tone="text-sky-600" title={tr('Cash & UPI')} tag={tr('Liquid')} value={formatINR(ps.totalCashPaise + ps.totalUpiPaise + ps.totalCardPaise)} valueTone="text-sky-700" sub={tr('Cash: {v1}', { v1: formatINR(ps.totalCashPaise) })} />
          <Metric icon={BookOpen} tone="text-orange-600" title={tr('Udhar Given')} tag={tr('Credit')} value={formatINR(ps.totalCreditPaise)} valueTone={ps.totalCreditPaise > 0 ? 'text-orange-600' : 'text-slate-900'} sub={tr('Credit sales in period')} />
        </div>
      )}

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tr('Filter by customer, category or product…')}
          className="w-full pl-9 pr-9 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-slate-400"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer" aria-label={tr('Clear search')}>
            <X className="w-4 h-4 text-slate-400" />
          </button>
        )}
      </div>

      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'px-3.5 py-2 text-sm font-bold border-b-[3px] -mb-px whitespace-nowrap cursor-pointer',
              tab === t.id ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            )}
          >
            {tr(t.label)}
          </button>
        ))}
      </div>

      {!data ? (
        <div className="py-16 text-center text-sm text-slate-500">{tr('Loading analytics…')}</div>
      ) : tab === 'parties' ? (
        <PartyList parties={parties} view={view} exportingId={exporting} onOpen={setOpenParty} onExport={(p) => exportParty(p)} />
      ) : tab === 'categories' ? (
        <CategoryList categories={cats} view={view} onOpen={setOpenCategory} />
      ) : tab === 'items' ? (
        <ItemList items={sold} view={view} />
      ) : (
        <DeadStockList items={dead} periodLabel={tr(periodLabel)} />
      )}

      <PartyDetailModal
        party={openParty}
        periodSales={sales || []}
        returns={returns || []}
        periodLabel={tr(periodLabel)}
        business={business}
        view={view}
        exporting={openParty ? exporting === openParty.partyId : false}
        onClose={() => setOpenParty(null)}
        onExport={exportParty}
      />
      <CategoryDetailModal
        category={openCategory}
        items={(data?.itemData || []).filter((i) => !isDeadStock(i) && i.categoryName === openCategory?.categoryName)}
        periodLabel={tr(periodLabel)}
        view={view}
        onClose={() => setOpenCategory(null)}
      />
      <OwnerPinPrompt isOpen={pinOpen} onClose={() => setPinOpen(false)} onUnlocked={() => setUnlocked(true)} />
    </div>
  );
}

function Metric({
  icon: Icon,
  tone,
  title,
  tag,
  value,
  valueTone = 'text-slate-900',
  sub,
}: {
  icon: React.ElementType;
  tone: string;
  title: string;
  tag: string;
  value: string;
  valueTone?: string;
  sub: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3 h-full">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
          <Icon className={cn('w-3.5 h-3.5', tone)} /> {title}
        </span>
        <span className={cn('px-1.5 py-0.5 rounded bg-slate-50 text-[9.5px] font-black', tone)}>{tag}</span>
      </div>
      <div className={cn('text-lg font-black font-mono mt-1 truncate', valueTone)}>{value}</div>
      <div className="text-[10.5px] text-slate-400 truncate">{sub}</div>
    </div>
  );
}
