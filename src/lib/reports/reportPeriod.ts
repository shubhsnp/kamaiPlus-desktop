import { msg, tr } from '@/lib/i18n/core';

/* Report periods for Sales Analytics (own file since v4.104.0, K-D23; advancedReports re-exports them). */

// ---------------------------------------------------------------------------
// Periods
// ---------------------------------------------------------------------------

export const REPORT_PERIOD_LABELS = [msg('Today'), msg('Yesterday'), msg('7 Days'), msg('This Month'), msg('Last Month')] as const;
export type ReportPeriodLabel = (typeof REPORT_PERIOD_LABELS)[number];

export interface ReportPeriod {
  label: string;
  start: Date;
  end: Date;
}

export function resolveReportPeriod(label: string, now: Date = new Date()): ReportPeriod {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const today = new Date(y, m, d);
  const tomorrow = new Date(y, m, d + 1);
  switch (label) {
    case 'Today':
      return { label, start: today, end: tomorrow };
    case 'Yesterday':
      return { label, start: new Date(y, m, d - 1), end: today };
    case '7 Days':
      // Today plus the six days before it.
      return { label, start: new Date(y, m, d - 6), end: tomorrow };
    case 'Last Month':
      return { label, start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
    case 'This Month':
    default:
      return { label: tr('This Month'), start: new Date(y, m, 1), end: new Date(y, m + 1, 1) };
  }
}

/** "1 Sep 2026 - 19 Sep 2026" — the last day shown is capped at today. */
export function periodSpanText(start: Date, end: Date, now: Date = new Date()): string {
  let last = new Date(end.getTime() - 1);
  if (last > now) last = now;
  const fmt = (x: Date) => x.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const a = fmt(start);
  const b = fmt(last);
  return a === b ? a : `${a} - ${b}`;
}

/** "12", "2.5", "0.25" — whole numbers without decimals, loose quantities kept. */
export function formatReportQty(q: number): string {
  if (Number.isInteger(q)) return String(q);
  return q.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}
