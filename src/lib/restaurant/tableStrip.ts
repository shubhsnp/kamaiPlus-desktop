import { OrderKind, RestOrder, hasUnsentItems, minutesOpen, orderTotals, pieceCount } from '@/lib/restaurant/model';
import type { RestaurantSettings } from '@/lib/restaurant/settings';

/*
 * The table strip on the order screen (v4.183.0, Rahul's "Option A"): every table stays in sight while
 * an order is open, one click changes table. Pure, so the suite can run it. With many tables the strip
 * starts on the running ones and "All" lists the rest (hold and drag, wheel or swipe: useDragScroll).
 */

export type StripView = 'all' | 'running';

export interface StripChip {
  label: string;
  /** No order yet = undefined (a free table). */
  orderId?: string;
  kind: OrderKind;
  running: boolean;
  current: boolean;
  /** Dishes not sent to the kitchen yet. */
  pending: boolean;
  /** Open for over an hour: someone may be waiting for the bill. */
  long: boolean;
  totalPaise: number;
  pieces: number;
  minutes: number;
}

export const LONG_OPEN_MINUTES = 60;
/** More tables than this: the Running / All switch shows. */
export const STRIP_TOGGLE_ABOVE = 12;
/** More tables than this: the strip starts on Running, so it fits one line. */
export const STRIP_RUNNING_ABOVE = 16;
/** A press that moves less than this is a click, not a drag. */
export const DRAG_START_PX = 6;

export const defaultStripView = (tableCount: number): StripView => (tableCount > STRIP_RUNNING_ABOVE ? 'running' : 'all');

/** An order worth keeping: an empty one is dropped when the table is left, so the table is free again. */
export const keepsOrder = (o: Pick<RestOrder, 'lines' | 'kotRounds'>): boolean => o.lines.length > 0 || o.kotRounds > 0;

/** ₹950, or ₹950.50 when there are paise: the chip has little room. */
export function chipAmount(paise: number): string {
  const digits = paise % 100 ? 2 : 0;
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function toChip(label: string, order: RestOrder | undefined, settings: RestaurantSettings, currentId: string | null, now: number): StripChip {
  const running = Boolean(order && keepsOrder(order));
  const pieces = order ? pieceCount(order) : 0;
  const minutes = order ? minutesOpen(order, now) : 0;
  return {
    label,
    orderId: order?.id,
    kind: order?.kind ?? 'table',
    running,
    current: Boolean(order && order.id === currentId),
    pending: Boolean(order && running && pieces > 0 && hasUnsentItems(order)),
    long: running && minutes >= LONG_OPEN_MINUTES,
    totalPaise: order && running ? orderTotals(order, settings).grandTotal : 0,
    pieces,
    minutes,
  };
}

/**
 * The chips, tables in the shop's own order (they never reshuffle, so a table stays where the hand
 * expects it). The table on screen always shows, whichever view. `view` null = the default for the
 * shop's size.
 */
export function stripChips(orders: RestOrder[], settings: RestaurantSettings, currentId: string | null, view: StripView | null, now: number = Date.now()) {
  const tableOrders = new Map(orders.filter((o) => o.kind === 'table').map((o) => [o.label, o]));
  // A table taken out of the set-up while it still has an order shows until it is billed (as on Tables).
  const labels = [...settings.tables, ...Array.from(tableOrders.keys()).filter((l) => !settings.tables.includes(l))];
  const all = labels.map((label) => toChip(label, tableOrders.get(label), settings, currentId, now));
  const shownView = view ?? defaultStripView(labels.length);
  return {
    view: shownView,
    tables: shownView === 'all' ? all : all.filter((c) => c.running || c.current),
    parcels: orders.filter((o) => o.kind !== 'table').sort((a, b) => a.openedAt.localeCompare(b.openedAt)).map((o) => toChip(o.label, o, settings, currentId, now)),
    tableCount: labels.length,
    runningCount: all.filter((c) => c.running).length,
  };
}
