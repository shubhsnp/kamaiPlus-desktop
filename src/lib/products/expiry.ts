/**
 * Batch / expiry for medicines (v4.126.0, AU-22 — docs/VERTICAL_PLAN.md A5). Same field names as the
 * Android app and the cloud contract (§3.2 `batch_number`, `expiry_date`).
 *
 * A medicine pack prints the expiry as a month (MM/YY or MM/YYYY), so it is kept as 'YYYY-MM'; a full
 * date from the phone ('YYYY-MM-DD') is read as its month. The item is good until the end of that month.
 */

/** 'YYYY-MM' (or '' when the value is not a month). Accepts 'YYYY-MM', 'YYYY-MM-DD', 'MM/YY', 'MM/YYYY'. */
export function cleanExpiry(value: string | undefined | null): string {
  const v = String(value || '').trim();
  let m = /^(\d{4})-(\d{2})(?:-\d{2})?/.exec(v);
  if (m) return Number(m[2]) >= 1 && Number(m[2]) <= 12 ? `${m[1]}-${m[2]}` : '';
  m = /^(\d{1,2})\s*[/.-]\s*(\d{2}|\d{4})$/.exec(v);
  if (m) {
    const month = Number(m[1]);
    const year = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
    return month >= 1 && month <= 12 ? `${year}-${String(month).padStart(2, '0')}` : '';
  }
  return '';
}

/** '2027-01' → '01/27' (as printed on the pack); '' when unknown. */
export function formatExpiry(value: string | undefined | null): string {
  const clean = cleanExpiry(value);
  return clean ? `${clean.slice(5, 7)}/${clean.slice(2, 4)}` : '';
}

export type ExpiryState = 'expired' | 'soon' | 'ok' | 'none';

/** Expired after the last day of its month; "soon" within `soonDays` of that. */
export function expiryState(value: string | undefined | null, now: Date = new Date(), soonDays = 90): ExpiryState {
  const clean = cleanExpiry(value);
  if (!clean) return 'none';
  const end = new Date(Number(clean.slice(0, 4)), Number(clean.slice(5, 7)), 0, 23, 59, 59); // last day of the month
  if (now.getTime() > end.getTime()) return 'expired';
  return end.getTime() - now.getTime() <= soonDays * 86400000 ? 'soon' : 'ok';
}
