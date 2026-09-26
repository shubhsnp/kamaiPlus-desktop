'use client';

import React, { useState, useMemo } from 'react';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { formatINR } from '@/lib/utils';
import {
  generateGSTR1Report,
  GSTR1ReportData
} from '@/lib/gst/gstr1Generator';
import { buildGstr1Json, gstPeriodRange, GSTPeriodPreset, Gstr1JsonIssue } from '@/lib/gst/gstr1Json';
import { showAlert, showConfirm } from '@/lib/ui/dialogs';
import { generateTallyPrimeXML } from '@/lib/tally/tallyXmlGenerator';
import { generateCASalesRegisterCSV } from '@/lib/tally/caExcelGenerator';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';

// Modular Sub-components
import { GstHeaderActions } from '@/components/gst/GstHeaderActions';
import { GstMetricsRibbon } from '@/components/gst/GstMetricsRibbon';
import { GstNavTabs, GstTabType } from '@/components/gst/GstNavTabs';
import { GstHsnSummaryTable } from '@/components/gst/GstHsnSummaryTable';
import { ProfitMask } from '@/components/privacy/ProfitMask';
import { tr } from '@/lib/i18n/core';

/** One line per problem the GST portal would reject, for the confirm dialog before download. */
function describeIssue(issue: Gstr1JsonIssue): string {
  const eg = issue.examples.length ? ` (${issue.examples.join(', ')}${issue.count > issue.examples.length ? ', …' : ''})` : '';
  switch (issue.kind) {
    case 'no_gstin':
      return tr('• Your shop GSTIN is missing or not valid — add it in Settings → Store & GST Profile.');
    case 'missing_hsn':
      return tr('• {count} item(s) have no HSN code{eg} — add HSN in Products.', { count: issue.count, eg });
    case 'bad_buyer_gstin':
      return tr('• {count} bill(s) have a wrong customer GSTIN{eg} — they were counted as B2C.', { count: issue.count, eg });
    case 'long_invoice_no':
      return tr('• {count} B2B invoice number(s) are longer than 16 characters or use other symbols{eg}.', { count: issue.count, eg });
  }
}

export default function GSTReportsPage() {
  const business = useBusiness();
  const customers = useLiveQuery(async () => db.customers.toArray()) || [];

  // Filter States
  const [periodPreset, setPeriodPreset] = useState<GSTPeriodPreset>('this_month');
  const [activeTab, setActiveTab] = useState<GstTabType>('hsn');
  const [hsnSearch, setHsnSearch] = useState('');
  const [isTallyGuideOpen, setIsTallyGuideOpen] = useState(false);

  // Date boundaries (Indian financial year; quarters are their latest occurrence) and the GSTR-1 period.
  const dateRange = useMemo(() => {
    const { start, end, fp } = gstPeriodRange(periodPreset);
    return { start, end, fp, startStr: start.toISOString(), endStr: end.toISOString() };
  }, [periodPreset]);

  // Query sales in selected period (cancelled bills only count in GSTR-1 "documents issued")
  const periodSales = useLiveQuery(
    async () => db.sales.where('created_at').between(dateRange.startStr, dateRange.endStr, true, true).toArray(),
    [dateRange]
  );
  const sales = useMemo(() => (periodSales || []).filter((s) => s.status !== 'cancelled'), [periodSales]);

  // Generate GSTR-1 Data
  const gstr1Data: GSTR1ReportData = useMemo(() => {
    return generateGSTR1Report(sales, customers, business || ({} as any), periodPreset);
  }, [sales, customers, business, periodPreset]);

  // B2B rows are one per invoice *and* tax rate; the count shown is distinct invoices.
  const b2bInvoiceCount = useMemo(
    () => new Set(gstr1Data.b2b_invoices.map((b) => b.invoice_number)).size,
    [gstr1Data]
  );

  // Export Handlers
  const handleExportCSV = () => {
    const { csv, filename } = generateCASalesRegisterCSV({
      business,
      sales,
      periodName: periodPreset,
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportTallyXML = () => {
    const { xml, filename } = generateTallyPrimeXML({
      business,
      sales,
      customers,
    });
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = async () => {
    if (!dateRange.fp) {
      await showAlert(tr('GSTR-1 is filed for one month (or one quarter under QRMP). Choose a month or a quarter, then download the JSON.'), { title: tr('GSTR-1 JSON') });
      return;
    }
    const { json, issues, fileName } = buildGstr1Json({ sales: periodSales || [], customers, business: business || { gstin: '', name: '' }, fp: dateRange.fp });
    if (issues.length) {
      const go = await showConfirm(
        `${tr('Please fix these before filing on the GST portal:')}\n\n${issues.map(describeIssue).join('\n')}\n\n${tr('Download the JSON anyway?')}`,
        { title: tr('Check before filing'), confirmLabel: tr('Download anyway'), cancelLabel: tr('Cancel') }
      );
      if (!go) return;
    }
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3.5 pb-20 sm:pb-8 animate-in fade-in duration-150">
      {/* 1. Header Actions */}
      <GstHeaderActions
        periodPreset={periodPreset}
        periodStart={dateRange.start}
        periodEnd={dateRange.end}
        returnPeriod={dateRange.fp}
        onPeriodChange={setPeriodPreset}
        onExportCsv={handleExportCSV}
        onExportTally={handleExportTallyXML}
        onExportJson={handleExportJSON}
        onOpenTallyGuide={() => setIsTallyGuideOpen(true)}
      />

      {/* 2. Metrics Ribbon */}
      <GstMetricsRibbon
        totalTaxableTurnoverPaise={gstr1Data.total_taxable_value}
        totalGstTaxPaise={gstr1Data.total_cgst + gstr1Data.total_sgst + gstr1Data.total_igst}
        totalCgstPaise={gstr1Data.total_cgst}
        totalSgstPaise={gstr1Data.total_sgst}
        b2bInvoicesCount={b2bInvoiceCount}
      />

      {/* 3. Navigation Tabs */}
      <GstNavTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hsnCount={gstr1Data.hsn_summary.length}
        b2bCount={b2bInvoiceCount}
        b2csCount={gstr1Data.b2cs_summary.length}
      />

      {/* 4. Active Tab Content */}
      {activeTab === 'hsn' && (
        <GstHsnSummaryTable
          hsnSummary={gstr1Data.hsn_summary}
          searchQuery={hsnSearch}
          onSearchChange={setHsnSearch}
        />
      )}

      {activeTab === 'b2b' && (
        <Card className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
              {tr('Table 4: B2B Tax Invoices (GSTIN Registered Buyers)')}
            </h3>
            <span className="text-xs font-mono text-slate-400">
              {b2bInvoiceCount} {tr('Invoices')}
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {gstr1Data.b2b_invoices.map((inv, idx) => (
              <div key={inv.invoice_number || idx} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                      {inv.customer_name || tr('B2B Client')}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9.5px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {inv.customer_gstin}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 truncate font-mono">
                    {tr('Inv:')} {inv.invoice_number} {tr('• Date:')} {inv.invoice_date}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-black font-mono text-slate-900 dark:text-slate-100">
                    <ProfitMask value={formatINR(inv.invoice_value)} />
                  </div>
                  <div className="text-[10px] text-emerald-600 font-mono">
                    {tr('Tax:')} {formatINR(inv.cgst_amount + inv.sgst_amount + inv.igst_amount)}
                  </div>
                </div>
              </div>
            ))}

            {gstr1Data.b2b_invoices.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-400">
                {tr('No B2B invoices recorded in this period. Add GSTIN to customer profiles to file B2B invoices.')}
              </div>
            )}
          </div>
        </Card>
      )}

      {activeTab === 'b2cs' && (
        <Card className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
              {tr('Table 7: B2C Small (Retail Consumer Sales)')}
            </h3>
            <span className="text-xs font-mono text-slate-400">
              {gstr1Data.b2cs_summary.length} {tr('Rate Slabs')}
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {gstr1Data.b2cs_summary.map((item, idx) => (
              <div key={idx} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                    {tr('GST Rate:')} {item.tax_rate}{tr('% (Intra-State Retail)')}
                  </span>
                  <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                    {tr('POS retail cash & UPI bills')}
                  </div>
                </div>

                <div className="text-right shrink-0 font-mono">
                  <div className="text-xs font-black text-slate-900 dark:text-slate-100">
                    <ProfitMask value={formatINR(item.taxable_value)} />
                  </div>
                  <div className="text-[10px] text-emerald-600">
                    {tr('Tax:')} {formatINR(item.cgst_amount + item.sgst_amount)}
                  </div>
                </div>
              </div>
            ))}

            {gstr1Data.b2cs_summary.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-400">
                {tr('No retail sales recorded for this period.')}
              </div>
            )}
          </div>
        </Card>
      )}

      {activeTab === 'doc_issue' && (
        <Card className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
              {tr('Table 13: Documents Issued (Invoice Series)')}
            </h3>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-center justify-between">
              <span className="text-slate-500">{tr('Invoice Series:')}</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{gstr1Data.doc_from_num || tr('INV-001')} ➔ {gstr1Data.doc_to_num || tr('INV-001')}</span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-center justify-between">
              <span className="text-slate-500">{tr('Total Invoices Issued:')}</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{gstr1Data.total_invoices_count}</span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-center justify-between">
              <span className="text-slate-500">{tr('Cancelled / Void Bills:')}</span>
              <span className="font-bold text-rose-600">{gstr1Data.doc_cancelled_count}</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
