'use client';

import React, { useMemo, useState } from 'react';
import { BookOpen, Eye, FileDown, Phone, PieChart, Printer, Receipt, TrendingUp, BarChart3 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Business, Sale, SalesReturn } from '@/types';
import { formatINR, cn } from '@/lib/utils';
import { PartySalesSummary, marginPercent, partyIdOf, summarizeParty } from '@/lib/reports/advancedReports';
import { getSaleNetTotal } from '@/lib/sales/saleMath';
import { printInvoice } from '@/lib/invoices/invoiceOutput';
import { InvoiceModal } from '@/components/invoices/InvoiceModal';
import { ProfitView, profitText } from './AnalyticsLists';
import { paymentMethodLabel, tr } from '@/lib/i18n/core';

interface Props {
  party: PartySalesSummary | null;
  periodSales: Sale[];
  returns: SalesReturn[];
  periodLabel: string;
  business?: Business | null;
  view: ProfitView;
  exporting: boolean;
  onClose: () => void;
  onExport: (party: PartySalesSummary, invoices: Sale[]) => void;
}

/** One customer's bills in the period — port of the Android PartyReportDetailScreen. */
export function PartyDetailModal({ party, periodSales, returns, periodLabel, business, view, exporting, onClose, onExport }: Props) {
  const [openSale, setOpenSale] = useState<Sale | null>(null);
  const [search, setSearch] = useState('');
  const [printingId, setPrintingId] = useState<string | null>(null);

  const invoices = useMemo(
    () =>
      party
        ? periodSales.filter((s) => partyIdOf(s) === party.partyId).sort((a, b) => b.created_at.localeCompare(a.created_at))
        : [],
    [party, periodSales]
  );
  // Recomputed from live data, so a return made from a bill here updates the header at once.
  const summary = useMemo(
    () => (party ? summarizeParty(party.partyId, invoices, returns, { name: party.partyName, phone: party.partyPhone }) : null),
    [party, invoices, returns]
  );
  const returnsBySale = useMemo(() => {
    const map = new Map<string, SalesReturn[]>();
    returns.forEach((r) => map.set(r.original_sale_id, [...(map.get(r.original_sale_id) || []), r]));
    return map;
  }, [returns]);

  if (!party || !summary) return null;

  const visible = invoices.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return s.invoice_number.toLowerCase().includes(q) || s.items.some((i) => i.product_name.toLowerCase().includes(q));
  });
  const avgBill = summary.invoiceCount > 0 ? Math.round(summary.totalSalesPaise / summary.invoiceCount) : 0;

  const handlePrint = async (sale: Sale) => {
    if (!business) return;
    setPrintingId(sale.id);
    try {
      await printInvoice({ sale, business });
    } finally {
      setPrintingId(null);
    }
  };

  return (
    <>
      <Modal isOpen onClose={onClose} title={summary.partyName} description={tr('{periodLabel} • {invoiceCount} bill(s)', { periodLabel: periodLabel, invoiceCount: summary.invoiceCount })} size="xl">
        <div className="space-y-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 font-black text-lg flex items-center justify-center">
                {(summary.partyName[0] || '?').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-black text-slate-900 truncate">{summary.partyName}</div>
                <div className="text-xs text-slate-500 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {summary.partyPhone || tr('No phone')}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onExport(summary, invoices)}
                disabled={exporting}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black cursor-pointer disabled:opacity-50"
              >
                <FileDown className="w-4 h-4" /> {exporting ? tr('Saving…') : tr('PDF Statement')}
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <Tile icon={TrendingUp} color="text-emerald-600" title={tr('Total Sales')} value={formatINR(summary.totalSalesPaise)} />
              <button type="button" onClick={view.unlocked ? undefined : view.onRequestUnlock} className="text-left">
                <Tile
                  icon={PieChart}
                  color="text-indigo-600"
                  title={tr('Est. Profit')}
                  value={profitText(summary.totalProfitPaise, view)}
                  sub={view.unlocked ? tr('{pct}% margin', { pct: marginPercent(summary).toFixed(1) }) + (summary.uncostedLineCount ? tr(' • partial') : '') : tr('Owner PIN')}
                />
              </button>
              <Tile icon={Receipt} color="text-sky-600" title={tr('Invoices Billed')} value={String(summary.invoiceCount)} />
              <Tile icon={BarChart3} color="text-amber-600" title={tr('Avg Bill Size')} value={formatINR(avgBill)} />
            </div>
            {summary.creditPaise > 0 && (
              <div className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" /> {formatINR(summary.creditPaise)} {tr('of these bills was given on udhar.')}
              </div>
            )}
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr('Search invoice # or item…')}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-slate-400"
          />

          <div className="space-y-2">
            {visible.length === 0 && <div className="py-10 text-center text-xs text-slate-500">{tr('No invoices found.')}</div>}
            {visible.map((sale) => {
              const returned = sale.status === 'returned';
              const partial = sale.status === 'partial_return';
              const mode = paymentMethodLabel(sale.payment_method).toUpperCase();
              const names = sale.items.slice(0, 2).map((i) => `${i.quantity}x ${i.product_name}`).join(', ');
              const more = sale.items.length > 2 ? tr(' +{count} more', { count: sale.items.length - 2 }) : '';
              return (
                <div
                  key={sale.id}
                  className={cn(
                    'rounded-2xl border p-3 flex items-center gap-3',
                    returned ? 'bg-rose-50/60 border-rose-200' : partial ? 'bg-amber-50/60 border-amber-200' : 'bg-white border-slate-200'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 text-sm">#{sale.invoice_number}</span>
                      <span
                        className={cn(
                          'px-1.5 py-0.5 rounded text-[10.5px] font-black',
                          returned ? 'bg-rose-100 text-rose-700' : sale.balance_due > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'
                        )}
                      >
                        {returned ? tr('RETURNED') : partial ? tr('{mode} • RET', { mode: mode }) : mode}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {new Date(sale.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} • {names}
                      {more}
                    </div>
                  </div>
                  <div className={cn('font-black font-mono text-sm', returned ? 'line-through text-rose-500' : 'text-slate-900')}>
                    {formatINR(returned ? sale.grand_total : getSaleNetTotal(sale, returnsBySale.get(sale.id)))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenSale(sale)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 inline-flex items-center gap-1 cursor-pointer hover:bg-slate-50"
                  >
                    <Eye className="w-3.5 h-3.5" /> {tr('View Bill')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrint(sale)}
                    disabled={printingId === sale.id}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Printer className="w-3.5 h-3.5" /> {tr('Print')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>

      <InvoiceModal isOpen={Boolean(openSale)} onClose={() => setOpenSale(null)} sale={openSale} business={business} onInvoiceUpdated={(s) => setOpenSale(s)} />
    </>
  );
}

function Tile({ icon: Icon, color, title, value, sub }: { icon: React.ElementType; color: string; title: string; value: string; sub?: string }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
        <Icon className={cn('w-3.5 h-3.5', color)} /> {title}
      </div>
      <div className="font-black text-slate-900 font-mono mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
    </div>
  );
}
