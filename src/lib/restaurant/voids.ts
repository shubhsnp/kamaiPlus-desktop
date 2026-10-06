import { RestOrder, lineTitle, liveLines, orderTotals, piecesInKitchen, pieceCount } from '@/lib/restaurant/model';
import { RESTAURANT_CHANGED_EVENT, type RestaurantSettings } from '@/lib/restaurant/settings';

/*
 * Cancelled orders (v4.108.0) — a restaurant owner's "void report". Every order cancelled from the
 * order screen is written here with its amount, what the kitchen already had and the reason, so a
 * cancelled table can always be checked later. Kept on this computer (localStorage, last 300).
 */

export const RESTAURANT_VOIDS_KEY = 'kamai_restaurant_voids';
const MAX_VOIDS = 300;

export interface RestVoid {
  id: string;
  at: string;
  kind: RestOrder['kind'];
  label: string;
  pieces: number;
  /** Pieces the kitchen had already got (a cancel slip went for them). */
  inKitchen: number;
  amountPaise: number;
  reason: string;
  items: string[];
}

export const VOID_REASONS = ['Guest left', 'Ordered by mistake', 'Duplicate order', 'Kitchen could not make it'] as const;

export function voidFromOrder(order: RestOrder, settings: RestaurantSettings, reason: string, now: string): RestVoid {
  return {
    id: `${order.id}_${now}`,
    at: now,
    kind: order.kind,
    label: order.label,
    pieces: pieceCount(order),
    inKitchen: piecesInKitchen(order),
    amountPaise: orderTotals(order, settings).grandTotal,
    reason: reason.replace(/\s+/g, ' ').trim().slice(0, 80),
    items: liveLines(order).map((l) => `${l.qty} × ${lineTitle(l)}`).slice(0, 40),
  };
}

/** Whatever is stored → a clean list, newest first (a damaged entry is dropped). */
export function parseVoids(raw: unknown): RestVoid[] {
  if (!Array.isArray(raw)) return [];
  const out: RestVoid[] = [];
  for (const v of raw) {
    if (!v || typeof v !== 'object' || typeof v.at !== 'string' || typeof v.label !== 'string') continue;
    out.push({
      id: String(v.id || v.at), at: v.at, kind: v.kind === 'takeaway' ? 'takeaway' : 'table', label: String(v.label).slice(0, 30),
      pieces: Math.max(0, Number(v.pieces) || 0), inKitchen: Math.max(0, Number(v.inKitchen) || 0), amountPaise: Math.max(0, Math.round(Number(v.amountPaise) || 0)),
      reason: String(v.reason || '').slice(0, 80), items: Array.isArray(v.items) ? v.items.map(String).slice(0, 40) : [],
    });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, MAX_VOIDS);
}

export function loadVoids(): RestVoid[] {
  if (typeof window === 'undefined') return [];
  try {
    return parseVoids(JSON.parse(localStorage.getItem(RESTAURANT_VOIDS_KEY) || '[]'));
  } catch {
    return [];
  }
}

export function recordVoid(entry: RestVoid): void {
  try {
    localStorage.setItem(RESTAURANT_VOIDS_KEY, JSON.stringify(parseVoids([entry, ...loadVoids()])));
  } catch {}
  window.dispatchEvent(new Event(RESTAURANT_CHANGED_EVENT));
}

/** Entries of the local day that `now` falls in. */
export function voidsOfDay(list: RestVoid[], now: Date = new Date()): RestVoid[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return list.filter((v) => {
    const t = Date.parse(v.at);
    return t >= start.getTime() && t < end.getTime();
  });
}
