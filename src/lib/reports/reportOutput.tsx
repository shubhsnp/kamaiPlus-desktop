import React from 'react';
import { Business, Sale, SalesReturn } from '@/types';
import { AdvancedReportsData, PartySalesSummary } from '@/lib/reports/advancedReports';
import { resolveInvoiceConfig } from '@/lib/invoices/themeDefaults';
import { GeneralReportDocument, PartyStatementDocument, ReportLetterhead } from '@/components/reports/print/ReportDocuments';
import { buildPrintHtml, FLOWING_A4_CSS, renderElementToHtml, safeFileName, saveHtmlAsPdf, printHtml } from '@/lib/print/printDocument';

/** Store details on every report, themed with the Invoice Themes colour (Android parity). */
export function reportLetterhead(business?: Business | null): ReportLetterhead {
  return {
    storeName: business?.name || 'My Store',
    phone: business?.phone || '',
    address: business?.address || '',
    gstin: business?.gstin || '',
    accent: resolveInvoiceConfig(business).primary_color,
  };
}

function yyyymmdd(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export function renderGeneralReportHtml(params: {
  data: AdvancedReportsData;
  periodLabel: string;
  dateSpan: string;
  business?: Business | null;
  includeProfit: boolean;
}): string {
  const body = renderElementToHtml(
    <GeneralReportDocument
      data={params.data}
      periodLabel={params.periodLabel}
      dateSpan={params.dateSpan}
      letterhead={reportLetterhead(params.business)}
      includeProfit={params.includeProfit}
    />
  );
  return buildPrintHtml(body, `Sales Report - ${params.periodLabel}`, 'a4', FLOWING_A4_CSS);
}

export async function saveGeneralReportPdf(params: Parameters<typeof renderGeneralReportHtml>[0] & { start: Date }) {
  const html = renderGeneralReportHtml(params);
  return saveHtmlAsPdf(html, `Sales_Report_${safeFileName(params.periodLabel, 'Period')}_${yyyymmdd(params.start)}.pdf`, 'Reports');
}

export function renderPartyStatementHtml(params: {
  party: PartySalesSummary;
  invoices: Sale[];
  returns: SalesReturn[];
  periodLabel: string;
  dateSpan: string;
  business?: Business | null;
}): string {
  const body = renderElementToHtml(
    <PartyStatementDocument
      party={params.party}
      invoices={params.invoices}
      returns={params.returns}
      periodLabel={params.periodLabel}
      dateSpan={params.dateSpan}
      letterhead={reportLetterhead(params.business)}
    />
  );
  return buildPrintHtml(body, `Statement - ${params.party.partyName}`, 'a4', FLOWING_A4_CSS);
}

export async function savePartyStatementPdf(params: Parameters<typeof renderPartyStatementHtml>[0]) {
  const html = renderPartyStatementHtml(params);
  return saveHtmlAsPdf(
    html,
    `Statement_${safeFileName(params.party.partyName, 'Customer')}_${safeFileName(params.periodLabel, 'Period')}.pdf`,
    'Statements'
  );
}

export async function printPartyStatement(params: Parameters<typeof renderPartyStatementHtml>[0]) {
  return printHtml(renderPartyStatementHtml(params), 'a4');
}
