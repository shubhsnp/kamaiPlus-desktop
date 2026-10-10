/*
 * A dish's restaurant marks (v4.138.0, Rahul 2026-10-10) — pure, no database, the same fields as the
 * Android app (cloud contract §3.2, they ride on the product document):
 *  - `food_type`: 'veg' | 'egg' | 'nonveg' — the green / yellow / brown mark on the menu, KOT and bill.
 *  - `sold_out_on`: the shop's day (YYYY-MM-DD, local) a dish was marked "Aaj khatam". It is sold out
 *    on that day only and comes back by itself the next day — nobody has to remember to switch it on.
 */

export type FoodType = 'veg' | 'egg' | 'nonveg';
export const FOOD_TYPES: FoodType[] = ['veg', 'egg', 'nonveg'];

export function foodTypeOf(p?: { food_type?: unknown } | null): FoodType | null {
  const v = String(p?.food_type ?? '').toLowerCase().replace(/[^a-z]/g, '');
  if (v === 'veg') return 'veg';
  if (v === 'egg' || v === 'eggetarian') return 'egg';
  if (v === 'nonveg') return 'nonveg';
  return null;
}

/** The shop's day as YYYY-MM-DD in local time (a dish sold out at 11 pm stays out until midnight here). */
export function localDay(now: Date = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

export function isSoldOutToday(p?: { sold_out_on?: unknown } | null, now: Date = new Date()): boolean {
  return typeof p?.sold_out_on === 'string' && p.sold_out_on === localDay(now);
}

/**
 * The change to save for "Aaj khatam" on / off. Off is '' (not undefined) so the cloud copy is
 * cleared too — the phone must see the dish come back.
 */
export function soldOutPatch(soldOut: boolean, now: Date = new Date()): { sold_out_on: string; updated_at: string } {
  return { sold_out_on: soldOut ? localDay(now) : '', updated_at: now.toISOString() };
}
