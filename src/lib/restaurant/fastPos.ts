import { RestOrder, nextToken, newOrder } from '@/lib/restaurant/model';
import type { RestState } from '@/lib/restaurant/store';

/*
 * Fast POS (v4.161.0, Rahul: "jinke pas tables nahi hai, jo sirf tokens denge"): a token counter for a
 * café, chai stall or QSR with no tables. Tap dishes → Pay → the bill prints with a token (TK-01… from
 * the same daily count as takeaway / delivery, so two tokens never share a number) and, with a kitchen
 * printer, a KOT. The cart lives only on the Fast POS screen: it is never a running order, so the Tables
 * screen, the waiters' phones and the cloud see nothing until it is an ordinary bill.
 */

export type RestaurantMode = 'tables' | 'fast';
export const RESTAURANT_MODE_KEY = 'kamai_restaurant_mode';

/** The screen this computer opened last (a token-only shop keeps landing on Fast POS). */
export function readRestaurantMode(): RestaurantMode {
  if (typeof window === 'undefined') return 'tables';
  try {
    return localStorage.getItem(RESTAURANT_MODE_KEY) === 'fast' ? 'fast' : 'tables';
  } catch {
    return 'tables';
  }
}

export function saveRestaurantMode(mode: RestaurantMode): void {
  try {
    localStorage.setItem(RESTAURANT_MODE_KEY, mode);
  } catch {}
}

/** The cart of the Fast POS screen: an order that is not in the shared list (label filled at Pay). */
export function newFastCart(dineIn: boolean, now: string, id: string): RestOrder {
  return { ...newOrder('takeaway', '', id, now), fast: { dineIn } };
}

/**
 * Takes the next token from the shared daily count and returns it with the new state. Called once per
 * cart, when Pay is pressed; the cart keeps its token if the payment window is closed and opened again.
 */
export function reserveFastToken(state: RestState, now: Date = new Date()): { label: string; state: RestState } {
  const t = nextToken(state.token, now, 'TK');
  return { label: t.label, state: { ...state, token: t.counter } };
}

/** The token the next cart will most likely get (shown on the empty screen; the real one is taken at Pay). */
export function previewFastToken(state: RestState, now: Date = new Date()): string {
  return nextToken(state.token, now, 'TK').label;
}
