import React, { CSSProperties } from 'react';
import type { Sale, SalesReturn } from '@/types';
import { formatINR } from '@/lib/utils';
import {
  AdvancedReportsData,
  PartySalesSummary,
  formatReportQty,
  isDeadStock,
  isProfitPartial,
  marginPercent,
} from '@/lib/reports/advancedReports';
import { getLineGrossPaise, getNetPaymentBreakdown, getReturnedQtyByLine, getSaleNetTotal, isRevenueSale } from '@/lib/sales/saleMath';
import { C, PRINT_FONT, right, text, tint } from '@/components/invoices/print/invoiceStyles';

/**
 * Printable Sales Analytics documents (port of the Android
 * AdvancedReportPdfService): the owner's period report and the customer
 * account statement. The statement is sent to customers, so it never shows
 * cost or profit; the period report shows profit only when unlocked.
 */

export interface ReportLetterhead {
  storeName: string;
  phone: string;
  address: string;
  gstin: string;
  accent: string;
}

interface Kpi {
  label: string;
  value: string;
  color?: string;
}

const pct = (v: number) => `${v.toFixed(1)}%`;

function Letterhead({ lh, title, periodLabel, dateSpan }: { lh: ReportLetterhead; title: string; periodLabel: string; dateSpan: string }) {
  const stamp = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (
    <div>
      <div style={{ height: 5, background: lh.accent, borderRadius: 2 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 10 }}>
        <div>
          <div style={text(18, 800, C.slate900)}>{lh.storeName}</div>
          {lh.address && <div style={text(10.5, 400, C.slate600)}>{lh.address}</div>}
          <div style={text(10.5, 400, C.slate600)}>{[lh.phone && `Ph: ${lh.phone}`, lh.gstin && `GSTIN: ${lh.gstin}`].filter(Boolean).join('   ')}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: 5,
              background: tint(lh.accent, 24),
              border: `1px solid ${tint(lh.accent, 70)}`,
              ...text(12, 800, lh.accent, { letterSpacing: 0.6 }),
            }}
          >
            {title}
          </div>
          <div style={text(11, 700, C.slate900, { marginTop: 5 })}>
            {periodLabel} • {dateSpan}
          </div>
          <div style={text(9.5, 400, C.slate500)}>Generated {stamp}</div>
        </div>
      </div>
      <div style={{ height: 1, background: C.slate200, marginTop: 10 }} />
    </div>
  );
}

function KpiRibbon({ kpis, accent }: { kpis: Kpi[]; accent: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
      {kpis.map((k) => (
        <div key={k.label} style={{ flex: 1, background: C.slate50, border: `1px solid ${C.slate200}`, borderTop: `3px solid ${accent}`, borderRadius: 6, padding: '7px 9px' }}>
          <div style={text(9.5, 700, C.slate500, { textTransform: 'uppercase', letterSpacing: 0.3 })}>{k.label}</div>
          <div style={{ ...text(13, 800, k.color || C.slate900), marginTop: 2 }}>{k.value}</div>
        </div>
      ))}
    </div>
  );
}

function Section({ title, accent }: { title: string; accent: string }) {
  return <div style={{ ...text(12.5, 800, accent), marginTop: 16, marginBottom: 6, paddingBottom: 3, borderBottom: `2px solid ${tint(accent, 60)}` }}>{title}</div>;
}

function Note({ children }: { children: React.ReactNode }) {
  return <div style={text(10.5, 400, C.slate500, { fontStyle: 'italic', marginTop: 6 })}>{children}</div>;
}

function Table({ headers, rows, numericFrom, accent, boldRows }: { headers: string[]; rows: string[][]; numericFrom: number; accent: string; boldRows?: Set<number> }) {
  const th: CSSProperties = { ...text(10, 800, '#fff', { textTransform: 'uppercase', letterSpacing: 0.3 }), padding: '6px 7px', background: accent };
  const td: CSSProperties = { ...text(10.5, 400, C.slate700), padding: '5px 7px', borderBottom: `1px solid ${C.slate100}`, verticalAlign: 'top' };
  return (
    <table style={{ width: '100%' }}>
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th key={h} style={{ ...th, ...(i >= numericFrom ? right : { textAlign: 'left' }) }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri} style={{ background: boldRows?.has(ri) ? C.slate100 : ri % 2 ? C.slate50 : '#fff' }}>
            {r.map((cell, ci) => (
              <td key={ci} style={{ ...td, ...(ci >= numericFrom ? right : {}), ...(boldRows?.has(ri) ? { fontWeight: 800, color: C.slate900 } : {}) }}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function GeneralReportDocument({
  data,
  periodLabel,
  dateSpan,
  letterhead,
  includeProfit,
}: {
  data: AdvancedReportsData;
  periodLabel: string;
  dateSpan: string;
  letterhead: ReportLetterhead;
  includeProfit: boolean;
}) {
  const ps = data.paymentSummary;
  const accent = letterhead.accent;
  const parties = [...data.partyData].sort((a, b) => b.totalSalesPaise - a.totalSalesPaise);
  const categories = [...data.categoryData].sort((a, b) => b.totalSalesPaise - a.totalSalesPaise);
  const items = data.itemData.filter((i) => !isDeadStock(i)).sort((a, b) => b.totalSalesPaise - a.totalSalesPaise);
  const dead = data.itemData.filter(isDeadStock).sort((a, b) => a.itemName.localeCompare(b.itemName));

  const kpis: Kpi[] = [
    { label: 'Total Revenue', value: formatINR(ps.totalPaise) },
    { label: 'Cash', value: formatINR(ps.totalCashPaise) },
    { label: 'UPI / Card', value: formatINR(ps.totalUpiPaise + ps.totalCardPaise) },
    { label: 'Udhar (Credit)', value: formatINR(ps.totalCreditPaise), color: ps.totalCreditPaise > 0 ? C.dueText : undefined },
  ];
  if (includeProfit) {
    kpis.push({
      label: isProfitPartial(data) ? 'Est. Profit (partial)' : 'Est. Gross Profit',
      value: `${formatINR(data.totalProfitPaise)} (${pct(marginPercent(data))})`,
    });
  }

  return (
    <div style={{ fontFamily: PRINT_FONT, color: C.slate900 }}>
      <Letterhead lh={letterhead} title="SALES ANALYTICS REPORT" periodLabel={periodLabel} dateSpan={dateSpan} />
      <KpiRibbon kpis={kpis} accent={accent} />
      {includeProfit && isProfitPartial(data) && (
        <Note>
          Profit covers only items with a buying price. {data.uncostedLineCount} sold line(s) had no buying price and are left out of the margin.
        </Note>
      )}

      <Section title={`Party-wise Sales (${parties.length})`} accent={accent} />
      {parties.length === 0 ? (
        <Note>No sales in this period.</Note>
      ) : (
        <Table
          accent={accent}
          numericFrom={3}
          headers={['#', 'Customer', 'Phone', 'Bills', 'Sales', 'Udhar', ...(includeProfit ? ['Profit'] : [])]}
          rows={parties.map((p, i) => [
            String(i + 1),
            p.partyName,
            p.partyPhone || '-',
            String(p.invoiceCount),
            formatINR(p.totalSalesPaise),
            p.creditPaise > 0 ? formatINR(p.creditPaise) : '-',
            ...(includeProfit ? [formatINR(p.totalProfitPaise)] : []),
          ])}
        />
      )}

      <Section title={`Category-wise Sales (${categories.length})`} accent={accent} />
      {categories.length === 0 ? (
        <Note>No items sold in this period.</Note>
      ) : (
        <Table
          accent={accent}
          numericFrom={2}
          headers={['#', 'Category', 'Qty Sold', 'Sales', ...(includeProfit ? ['Profit', 'Margin'] : [])]}
          rows={categories.map((c, i) => [
            String(i + 1),
            c.categoryName,
            formatReportQty(c.quantitySold),
            formatINR(c.totalSalesPaise),
            ...(includeProfit ? [formatINR(c.totalProfitPaise), pct(marginPercent(c))] : []),
          ])}
        />
      )}

      <Section title={`Item-wise Sales (${items.length})`} accent={accent} />
      {items.length === 0 ? (
        <Note>No items sold in this period.</Note>
      ) : (
        <Table
          accent={accent}
          numericFrom={3}
          headers={['#', 'Item', 'Category', 'Qty', 'Sales', ...(includeProfit ? ['Profit'] : [])]}
          rows={items.map((it, i) => [
            String(i + 1),
            it.itemName,
            it.categoryName,
            formatReportQty(it.quantitySold),
            formatINR(it.totalSalesPaise),
            ...(includeProfit ? [formatINR(it.totalProfitPaise)] : []),
          ])}
        />
      )}

      <Section title={`Dead Stock — in stock, 0 sold (${dead.length})`} accent={accent} />
      {dead.length === 0 ? (
        <Note>Every in-stock item sold at least once in this period.</Note>
      ) : (
        <Table
          accent={accent}
          numericFrom={3}
          headers={['#', 'Item', 'Category', 'In Stock']}
          rows={dead.map((d, i) => [String(i + 1), d.itemName, d.categoryName, `${formatReportQty(d.stockQuantity)} ${d.unit}`.trim()])}
        />
      )}
    </div>
  );
}

const MODE_LABEL: Record<string, string> = { credit: 'UDHAR', split: 'SPLIT' };

export function PartyStatementDocument({
  party,
  invoices,
  returns,
  periodLabel,
  dateSpan,
  letterhead,
}: {
  party: PartySalesSummary;
  invoices: Sale[];
  returns: SalesReturn[];
  periodLabel: string;
  dateSpan: string;
  letterhead: ReportLetterhead;
}) {
  const accent = letterhead.accent;
  const byId = new Map<string, SalesReturn[]>();
  returns.forEach((r) => byId.set(r.original_sale_id, [...(byId.get(r.original_sale_id) || []), r]));
  const bills = invoices.filter(isRevenueSale).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const billed = bills.reduce((acc, b) => acc + getSaleNetTotal(b, byId.get(b.id)), 0);
  const udhar = bills.reduce((acc, b) => acc + getNetPaymentBreakdown(b, byId.get(b.id) || []).credit, 0);

  const rows: string[][] = [];
  const totalRows = new Set<number>();
  let serial = 0;
  for (const bill of bills) {
    const saleReturns = byId.get(bill.id) || [];
    const returned = getReturnedQtyByLine(bill, saleReturns);
    const date = new Date(bill.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
    let first = true;
    (bill.items || []).forEach((it, idx) => {
      const sold = it.quantity || 0;
      const kept = Math.max(0, sold - (returned[idx] || 0));
      if (kept <= 0) return;
      const gross = getLineGrossPaise(it);
      const amount = kept === sold ? gross : Math.round((gross * kept) / sold);
      serial++;
      rows.push([
        String(serial),
        first ? date : '',
        first ? bill.invoice_number : '',
        (returned[idx] || 0) > 0 ? `${it.product_name} (returned ${formatReportQty(returned[idx])})` : it.product_name,
        formatReportQty(kept),
        it.unit_price > 0 ? formatINR(it.unit_price) : '-',
        formatINR(amount),
      ]);
      first = false;
    });
    totalRows.add(rows.length);
    rows.push([
      '',
      first ? date : '',
      first ? bill.invoice_number : '',
      `Bill total incl. tax & discount — ${MODE_LABEL[bill.payment_method] || bill.payment_method.toUpperCase()}`,
      '',
      '',
      formatINR(getSaleNetTotal(bill, saleReturns)),
    ]);
  }

  return (
    <div style={{ fontFamily: PRINT_FONT, color: C.slate900 }}>
      <Letterhead lh={letterhead} title="ACCOUNT STATEMENT" periodLabel={periodLabel} dateSpan={dateSpan} />
      <div style={{ marginTop: 12, background: C.slate50, border: `1px solid ${C.slate200}`, borderLeft: `4px solid ${accent}`, borderRadius: 6, padding: '8px 12px' }}>
        <div style={text(9.5, 800, C.slate500, { letterSpacing: 0.4 })}>STATEMENT FOR</div>
        <div style={text(13, 800, C.slate900)}>{party.partyName}</div>
        {party.partyPhone && <div style={text(10.5, 400, C.slate600)}>Ph: {party.partyPhone}</div>}
      </div>
      <KpiRibbon
        accent={accent}
        kpis={[
          { label: 'Bills', value: String(bills.length) },
          { label: 'Total Billed', value: formatINR(billed) },
          { label: 'Paid', value: formatINR(billed - udhar) },
          { label: 'Udhar (Credit)', value: formatINR(udhar), color: udhar > 0 ? C.dueText : undefined },
        ]}
      />
      <Section title="Itemised Bills" accent={accent} />
      {rows.length === 0 ? (
        <Note>No bills for this customer in the selected period.</Note>
      ) : (
        <Table accent={accent} numericFrom={4} headers={['#', 'Date', 'Invoice', 'Particulars', 'Qty', 'Rate', 'Amount']} rows={rows} boldRows={totalRows} />
      )}
      <div style={{ marginTop: 14, marginLeft: 'auto', width: 300, border: `1px solid ${C.slate200}`, borderRadius: 6, padding: '8px 12px' }}>
        {[
          ['Total Billed', formatINR(billed)],
          ['Paid', formatINR(billed - udhar)],
          ['Udhar Outstanding (these bills)', formatINR(udhar)],
        ].map(([k, v], i) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', ...(i === 2 ? { borderTop: `1px solid ${C.slate200}`, marginTop: 3, paddingTop: 5 } : {}) }}>
            <span style={text(11, i === 2 ? 800 : 400, C.slate600)}>{k}</span>
            <span style={{ ...text(11, 800, i === 2 && udhar > 0 ? C.dueText : C.slate900), ...right }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
