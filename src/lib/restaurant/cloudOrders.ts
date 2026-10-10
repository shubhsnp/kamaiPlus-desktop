import type { RestOrder } from '@/lib/restaurant/model';
import { hasUnsentItems, localDay, markKotSent } from '@/lib/restaurant/model';
import { RESTAURANT_CHANGED_EVENT, loadRestaurantSettings } from '@/lib/restaurant/settings';
import { RestState, loadRestState, parseRestState, saveRestState } from '@/lib/restaurant/store';

/*
 * Running restaurant orders on every device of the shop (v4.140.0, Rahul 2026-10-10, R1): the waiter's
 * phone and the counter PC see the same tables. Each running order is one document
 * `businesses/{biz}/restaurant_orders/{orderId}` in the shape both apps keep (lib/restaurant/model.ts,
 * the phone's restaurant_model.dart). A change here goes up at once; a paid / cancelled order's
 * document is deleted, so it leaves every device. Newer `updatedAt` wins, per order.
 *
 * A table's order id comes from the table name (`table_t4`), so two devices opening table T4 at the
 * same moment open ONE order. A device with no kitchen printer asks for the KOT (`kotRequestedAt`);
 * the PC set to "Print other devices' KOTs" prints it and marks it sent.
 */

export const RESTAURANT_ORDERS = 'restaurant_orders';

/** The order id of a table: the same on every device. */
export const tableOrderId = (label: string): string =>
  `table_${label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'x'}`;

/** An order nobody has put anything on yet stays on this device (an empty table card is not shared). */
export const isShared = (o: RestOrder): boolean => o.lines.length > 0 || o.kotRounds > 0;

const time = (iso?: string): number => {
  const t = Date.parse(iso || '');
  return Number.isFinite(t) ? t : 0;
};

/** RestOrder → cloud document (no undefined values; the server time is added by the writer). */
export function orderToCloud(o: RestOrder, device: string): Record<string, unknown> {
  return JSON.parse(JSON.stringify({ ...o, device }));
}

/** Cloud document → RestOrder, cleaned like a stored order; null when it is not a valid order. */
export function orderFromCloud(doc: Record<string, unknown>, id: string): RestOrder | null {
  const order = parseRestState({ orders: [{ ...doc, id }] }).orders[0];
  return order || null;
}

/** "TA-07" / "DL-07" → 7 (the day's parcel count), else 0. */
export const tokenNumber = (label: string): number => {
  const m = /^(?:TA|DL)-(\d+)$/.exec(label);
  return m ? parseInt(m[1], 10) : 0;
};

/**
 * A cloud order into this device's state. Added when new; replaced when its `updatedAt` is newer;
 * otherwise unchanged (our own write coming back). A newer parcel token moves this device's count
 * on, so the next token here does not repeat it.
 */
export function mergeCloudOrder(state: RestState, remote: RestOrder, now: Date = new Date()): RestState {
  const local = state.orders.find((o) => o.id === remote.id);
  if (local && time(local.updatedAt) >= time(remote.updatedAt)) return state;
  const orders = local ? state.orders.map((o) => (o.id === remote.id ? remote : o)) : [...state.orders, remote];
  let token = state.token;
  const n = tokenNumber(remote.label);
  const day = localDay(now);
  if (n > 0 && localDay(new Date(remote.openedAt)) === day && (!token || token.day !== day || token.last < n)) token = { day, last: n };
  return { ...state, orders, token };
}

/** A cloud order deleted (paid or cancelled on another device): it leaves this device too. */
export function removeCloudOrder(state: RestState, id: string): RestState {
  return state.orders.some((o) => o.id === id) ? { ...state, orders: state.orders.filter((o) => o.id !== id) } : state;
}

/** What to send: shared orders changed since last sent; ids sent before that are gone (or emptied). */
export function ordersToSend(sent: Map<string, string>, orders: RestOrder[]): { put: RestOrder[]; del: string[] } {
  const shared = orders.filter(isShared);
  const put = shared.filter((o) => sent.get(o.id) !== o.updatedAt);
  const live = new Set(shared.map((o) => o.id));
  const del = Array.from(sent.keys()).filter((id) => !live.has(id));
  return { put, del };
}

/** This PC prints the KOTs other devices asked for (Set-up switch), for orders with something unsent. */
export const kotToPrintHere = (o: RestOrder, printRemoteKots: boolean): boolean =>
  printRemoteKots && Boolean(o.kotRequestedAt) && hasUnsentItems(o);

// ── Runtime (Firebase loaded only when this runs) ────────────────────────────────────────────────

export interface RestaurantCloudHooks {
  /** Print the KOT of an order another device asked for; true when it printed. */
  printKot: (order: RestOrder) => Promise<boolean>;
  onError?: (e: unknown) => void;
}

export const RESTAURANT_SENT_KEY = 'kamai_restaurant_cloud_sent';

/**
 * The first full read from the server: an order this device sent before that is no longer in the cloud
 * was paid / cancelled on another device while this one was closed — it goes here too (it must not be
 * sent back and come alive again). One never sent (made here offline) stays and goes up.
 */
export function reconcileFirstRead(state: RestState, sentBefore: Map<string, string>, cloudIds: Set<string>): RestState {
  const gone = state.orders.filter((o) => sentBefore.has(o.id) && !cloudIds.has(o.id)).map((o) => o.id);
  return gone.length ? { ...state, orders: state.orders.filter((o) => !gone.includes(o.id)) } : state;
}

function readSent(): Map<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(RESTAURANT_SENT_KEY) || '{}');
    return new Map(Object.entries(raw && typeof raw === 'object' ? raw : {}).filter(([, v]) => typeof v === 'string') as [string, string][]);
  } catch {
    return new Map();
  }
}

function writeSent(sent: Map<string, string>) {
  try {
    localStorage.setItem(RESTAURANT_SENT_KEY, JSON.stringify(Object.fromEntries(sent)));
  } catch {}
}

/** Listens to the shop's running orders and sends this device's changes. Returns a stop function. */
export async function startRestaurantCloud(bizId: string, device: string, hooks: RestaurantCloudHooks): Promise<() => void> {
  const [{ getFirestoreDb }, fs] = await Promise.all([import('@/lib/firebase/config'), import('firebase/firestore')]);
  const db = getFirestoreDb();
  if (!db) return () => {};
  const col = fs.collection(db, `businesses/${bizId}/${RESTAURANT_ORDERS}`);
  const sent = readSent();
  const printing = new Set<string>();
  let stopped = false;
  // Nothing goes up before the first read from the server (reconcileFirstRead).
  let ready = false;

  const push = () => {
    if (stopped || !ready) return;
    const { put, del } = ordersToSend(sent, loadRestState().orders);
    if (!put.length && !del.length) return;
    for (const o of put) {
      sent.set(o.id, o.updatedAt);
      fs.setDoc(fs.doc(col, o.id), { ...orderToCloud(o, device), synced_at: fs.serverTimestamp() }).catch((e) => hooks.onError?.(e));
    }
    for (const id of del) {
      sent.delete(id);
      fs.deleteDoc(fs.doc(col, id)).catch((e) => hooks.onError?.(e));
    }
    writeSent(sent);
  };

  const printAsked = async (o: RestOrder) => {
    if (printing.has(o.id) || !kotToPrintHere(o, loadRestaurantSettings().printRemoteKots)) return;
    printing.add(o.id);
    try {
      if (await hooks.printKot(o)) {
        const s = loadRestState();
        if (s.orders.some((x) => x.id === o.id)) saveRestState({ ...s, orders: s.orders.map((x) => (x.id === o.id ? markKotSent(x, new Date().toISOString()) : x)) });
      }
    } finally {
      printing.delete(o.id);
    }
  };

  const unsub = fs.onSnapshot(col, { includeMetadataChanges: true }, (snap) => {
    let state = loadRestState();
    const before = state;
    if (!ready) {
      if (snap.metadata.fromCache) return; // wait for the server's answer
      state = reconcileFirstRead(state, sent, new Set(snap.docs.map((d) => d.id)));
    }
    const asked: RestOrder[] = [];
    for (const c of snap.docChanges()) {
      if (c.doc.metadata.hasPendingWrites) continue;
      if (c.type === 'removed') {
        state = removeCloudOrder(state, c.doc.id);
        sent.delete(c.doc.id);
        continue;
      }
      const remote = orderFromCloud(c.doc.data() as Record<string, unknown>, c.doc.id);
      if (!remote) continue;
      const next = mergeCloudOrder(state, remote);
      if (next !== state) sent.set(remote.id, remote.updatedAt);
      state = next;
      const mine = state.orders.find((x) => x.id === remote.id);
      if (mine) asked.push(mine);
    }
    const first = !ready;
    ready = true;
    if (state !== before) saveRestState(state);
    writeSent(sent);
    if (first) push();
    for (const o of asked) void printAsked(o);
  }, (e) => hooks.onError?.(e));

  window.addEventListener(RESTAURANT_CHANGED_EVENT, push);
  return () => {
    stopped = true;
    unsub();
    window.removeEventListener(RESTAURANT_CHANGED_EVENT, push);
  };
}
