import { Customer } from '@/types';
import { formatINR } from '@/lib/utils';
import { makeProductQuery, productSearchScore } from '@/lib/search/productSearch';

/*
 * Customer Directory (v4.78.0): sort orders, and the list as it is shown (after search /
 * filter / sort) exported to Excel and PDF. Pure — the page loads xlsx and the PDF
 * printer only when a button is pressed. Exported files stay English (saved documents).
 */

export type CustomerSort = 'due' | 'name' | 'spent' | 'recent';
export type CustomerView = 'grid' | 'list';

export const CUSTOMER_VIEW_KEY = 'kamai_customers_view_mode';

const time = (iso?: string) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : 0;
};

/**
 * The Customers page search box (FS-25, v4.182.0): name, phone (with or without spaces), address or
 * GSTIN contains the text — or the name SOUNDS like it, so `ramesh` finds रमेश (Bible §9.6).
 */
export function customerMatchesSearch(c: Customer, query: string): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return true;
  const digits = q.replace(/\D/g, '');
  const phoneDigits = (c.phone || '').replace(/\D/g, '');
  if (digits && phoneDigits.includes(digits)) return true;
  if (c.phone?.toLowerCase().includes(q) || c.address?.toLowerCase().includes(q) || c.gstin?.toLowerCase().includes(q)) return true;
  return productSearchScore({ name: c.name }, makeProductQuery(query)) >= 0;
}

/** A new sorted list: most udhar first (default), name A–Z, most bought, latest visit. */
export function sortCustomers(list: Customer[], sort: CustomerSort): Customer[] {
  const out = [...list];
  const byName = (a: Customer, b: Customer) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
  if (sort === 'name') out.sort(byName);
  else if (sort === 'spent') out.sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0) || byName(a, b));
  else if (sort === 'recent') out.sort((a, b) => time(b.last_visit_date) - time(a.last_visit_date) || byName(a, b));
  else out.sort((a, b) => (b.current_balance || 0) - (a.current_balance || 0) || byName(a, b));
  return out;
}

/** "Udhar" (owes the shop), "Advance" (the shop owes) or "Settled". */
export function balanceKind(c: Pick<Customer, 'current_balance'>): 'Udhar' | 'Advance' | 'Settled' {
  if ((c.current_balance || 0) > 0) return 'Udhar';
  if ((c.current_balance || 0) < 0) return 'Advance';
  return 'Settled';
}

/** dd-mm-yyyy, '' for none. */
export function shortDate(iso?: string): string {
  const t = time(iso);
  if (!t) return '';
  const d = new Date(t);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

const rupees = (paise: number) => Math.round(paise || 0) / 100;

/** Excel sheet: headings + one row per customer; money in ₹ as numbers (+ udhar, − advance). */
export function customerSheetRows(customers: Customer[]): (string | number)[][] {
  const head = ['Name', 'Mobile', 'Email', 'Address', 'GSTIN', 'Type', 'Balance (Rs)', 'Balance', 'Total bought (Rs)', 'Visits', 'Last visit', 'Loyalty points', 'Birthday', 'Anniversary'];
  const rows = customers.map((c) => [
    c.name,
    c.phone || '',
    c.email || '',
    c.address || '',
    c.gstin || '',
    c.customer_type || 'regular',
    rupees(c.current_balance),
    balanceKind(c),
    rupees(c.total_spent),
    c.total_visits || 0,
    shortDate(c.last_visit_date),
    c.loyalty_points || 0,
    c.date_of_birth || '',
    c.anniversary_date || '',
  ]);
  return [head, ...rows];
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string));

/** The body of the PDF list (A4, table headings repeat on every page). */
export function customerListHtmlBody(customers: Customer[], meta: { shopName: string; view: string; printedOn: string }): string {
  const due = customers.reduce((n, c) => n + Math.max(0, c.current_balance || 0), 0);
  const advance = customers.reduce((n, c) => n + Math.max(0, -(c.current_balance || 0)), 0);
  const rows = customers.map((c, i) => {
    const kind = balanceKind(c);
    const bal = kind === 'Settled' ? '—' : `${esc(formatINR(Math.abs(c.current_balance)))} ${kind === 'Udhar' ? 'Dr' : 'Cr'}`;
    return `<tr><td>${i + 1}</td><td><b>${esc(c.name)}</b>${c.gstin ? `<div class="sub">GSTIN ${esc(c.gstin)}</div>` : ''}${c.address ? `<div class="sub">${esc(c.address)}</div>` : ''}</td>`
      + `<td>${esc(c.phone || '')}</td><td>${esc((c.customer_type || 'regular').toUpperCase())}</td>`
      + `<td class="num ${kind === 'Udhar' ? 'dr' : ''}">${bal}</td><td class="num">${esc(formatINR(c.total_spent || 0))}</td>`
      + `<td class="num">${c.total_visits || 0}</td><td>${esc(shortDate(c.last_visit_date))}</td></tr>`;
  });
  return `<style>
.cl-head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0f172a; padding-bottom: 6px; margin-bottom: 8px; }
.cl-head h1 { font-size: 16pt; margin: 0; } .cl-head .meta { font-size: 8.5pt; color: #475569; text-align: right; }
.cl-sum { display: flex; gap: 18px; font-size: 9pt; margin: 0 0 8px; } .cl-sum b { font-size: 10.5pt; }
table.cl { width: 100%; border-collapse: collapse; font-size: 8.5pt; } table.cl th { background: #f1f5f9; text-align: left; padding: 5px 6px; border-bottom: 1px solid #cbd5e1; }
table.cl td { padding: 4px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; } table.cl .num { text-align: right; white-space: nowrap; }
table.cl .dr { color: #be123c; font-weight: 700; } table.cl .sub { color: #64748b; font-size: 7.5pt; } table.cl tr { break-inside: avoid; }
</style>
<div class="cl-head"><div><h1>${esc(meta.shopName || 'Customer List')}</h1><div>Customer list — ${esc(meta.view)}</div></div><div class="meta">Printed ${esc(meta.printedOn)}</div></div>
<div class="cl-sum"><span>Customers: <b>${customers.length}</b></span><span>Udhar to collect: <b>${esc(formatINR(due))}</b></span><span>Advance held: <b>${esc(formatINR(advance))}</b></span></div>
<table class="cl"><thead><tr><th>#</th><th>Customer</th><th>Mobile</th><th>Type</th><th class="num">Balance</th><th class="num">Total bought</th><th class="num">Visits</th><th>Last visit</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
}
