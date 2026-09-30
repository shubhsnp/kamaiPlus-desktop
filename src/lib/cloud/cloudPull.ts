import { collection, doc, getDoc, getDocs, onSnapshot, query, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/db';
import { getFirestoreDb } from '@/lib/firebase/config';
import { CLOUD_TABLES, CloudTable, fromCloud } from './cloudContract';
import { COUNTER_FIELDS, CounterTable, markFromCloud, pendingDelta } from './cloudOutbox';

/**
 * Step 4 (v4.86.0) — the cloud into this computer: what the phone (or another counter)
 * changed comes here. Loaded only while cloud sync is on (dynamic import).
 *
 * Rules:
 * - Rows are merged over what this computer has (contract R7); products / customers /
 *   suppliers / sales take the cloud copy only when it is newer (`updated_at`).
 * - Stock and udhar (COUNTER_FIELDS) are the cloud's value PLUS this computer's changes not
 *   yet sent — never "newest wins", or a bill here and one on the phone would erase each other.
 * - A row the cloud sent is written in a transaction marked `markFromCloud`, so the outbox
 *   does not send it back (no echo).
 * - New rows get THIS computer's shop id (`business_id`), not the cloud's `biz_<uid>` — the
 *   screens filter by it.
 * - A product / customer / category / supplier deleted on the phone is deleted here too.
 */

type Row = Record<string, any>;
export interface PullContext {
  /** `biz_<uid>` — the cloud shop. */
  bizId: string;
  /** This computer's own shop id (db.businesses). */
  localBizId: string;
}

const DATA_TABLES = CLOUD_TABLES.filter((t) => t !== 'businesses') as Exclude<CloudTable, 'businesses'>[];
const NEWER_WINS = new Set<CloudTable>(['products', 'customers', 'suppliers', 'sales']);
/** Changed by the phone without `synced_at` (stock increments), and small: listened to whole. */
const WHOLE = new Set<CloudTable>(['products', 'customers', 'categories', 'suppliers']);
const FOLLOW_DELETES = WHOLE;

export const PULL_CURSOR_KEY = 'kamai_cloud_pull_cursor';
/** Listeners re-read this much before the last change seen (clock differences, slow writes). */
const OVERLAP_MS = 10 * 60 * 1000;

const round = (n: number) => Math.round(n * 1e6) / 1e6;

function readCursors(): Partial<Record<CloudTable, number>> {
  try {
    const v = JSON.parse(localStorage.getItem(PULL_CURSOR_KEY) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

function saveCursor(table: CloudTable, ms: number): void {
  const all = readCursors();
  if ((all[table] || 0) >= ms) return;
  all[table] = ms;
  try {
    localStorage.setItem(PULL_CURSOR_KEY, JSON.stringify(all));
  } catch {}
}

export function clearPullCursors(): void {
  try {
    localStorage.removeItem(PULL_CURSOR_KEY);
  } catch {}
}

/** Same content, whatever the key order. */
function sameRow(a: Row | undefined, b: Row): boolean {
  if (!a) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of Array.from(keys)) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) return false;
  return true;
}

function cloudIsNewer(cloud: Row, local: Row | undefined, strictly: boolean): boolean {
  if (!local || !local.updated_at || !cloud.updated_at) return true;
  const c = new Date(cloud.updated_at).getTime();
  const l = new Date(local.updated_at).getTime();
  if (!Number.isFinite(c) || !Number.isFinite(l)) return true;
  return strictly ? c > l : c >= l;
}

/** Pure: the row this computer should hold after the cloud sent `cloudDoc` (null = leave it). */
export function mergedRow(table: CloudTable, cloudDoc: Row, local: Row | undefined, ctx: PullContext, strictly: boolean, pending = 0): Row | null {
  const row = fromCloud(table, cloudDoc, local, { bizId: ctx.bizId });
  if (!local && table !== 'marketing_templates') row.business_id = ctx.localBizId;
  const newer = !NEWER_WINS.has(table) || cloudIsNewer(row, local, strictly);
  const counter = (COUNTER_FIELDS as Record<string, { local: string; cloud: string } | undefined>)[table];
  let next: Row;
  if (!local) next = row;
  else next = newer ? row : { ...local };
  if (counter && Object.prototype.hasOwnProperty.call(cloudDoc, counter.cloud)) {
    next[counter.local] = round((Number(row[counter.local]) || 0) + pending);
  } else if (counter && local) {
    next[counter.local] = local[counter.local];
  }
  return sameRow(local, next) ? null : next;
}

/** Cloud documents (and deletions) of one table into Dexie, echo-free. Returns rows written. */
export async function mergeCloudDocs(table: CloudTable, docs: Row[], ctx: PullContext, removedIds: string[] = [], strictly = true): Promise<number> {
  const withId = docs.filter((d) => d && d.id);
  const dexie = db.table(table);
  const locals = withId.length ? ((await dexie.bulkGet(withId.map((d) => String(d.id)))) as (Row | undefined)[]) : [];
  const counter = table in COUNTER_FIELDS ? (table as CounterTable) : null;
  const rows: Row[] = [];
  withId.forEach((d, i) => {
    const pending = counter ? pendingDelta(counter, String(d.id)) : 0;
    const next = mergedRow(table, d, locals[i], ctx, strictly, pending);
    if (next) rows.push(next);
  });
  const dels = FOLLOW_DELETES.has(table) ? removedIds.filter(Boolean) : [];
  if (rows.length === 0 && dels.length === 0) return 0;
  await db.transaction('rw', dexie, async (tx) => {
    markFromCloud(tx.idbtrans);
    if (rows.length) await dexie.bulkPut(rows);
    if (dels.length) await dexie.bulkDelete(dels);
  });
  return rows.length + dels.length;
}

/** The shop document (name, address, GSTIN…) onto THIS computer's shop row. */
export async function mergeShopDoc(data: Row, ctx: PullContext): Promise<boolean> {
  if (!data || !data.name) return false;
  const local = (await db.businesses.get(ctx.localBizId)) as Row | undefined;
  if (!local) return false;
  const row = fromCloud('businesses', data, local, { bizId: ctx.bizId });
  row.id = ctx.localBizId;
  if (sameRow(local, row)) return false;
  await db.transaction('rw', db.businesses, async (tx) => {
    markFromCloud(tx.idbtrans);
    await db.businesses.put(row as any);
  });
  return true;
}

function fs() {
  const f = getFirestoreDb();
  if (!f) throw new Error('not_configured');
  return f;
}

/** Everything the cloud shop has, once (the first time sync is switched on for an account). */
export async function pullEverything(ctx: PullContext): Promise<Record<string, number>> {
  const firestore = fs();
  const started = Date.now();
  const stats: Record<string, number> = {};
  const shop = await getDoc(doc(firestore, 'businesses', ctx.bizId));
  if (shop.exists()) await mergeShopDoc(shop.data(), ctx);
  for (const table of DATA_TABLES) {
    const snap = await getDocs(collection(firestore, `businesses/${ctx.bizId}/${table}`));
    const docs: Row[] = [];
    snap.forEach((d) => docs.push({ ...d.data(), id: d.id }));
    stats[table] = await mergeCloudDocs(table, docs, ctx, [], false);
  }
  for (const table of DATA_TABLES) saveCursor(table, started);
  return stats;
}

/**
 * Live: the shop document, the small tables whole, the others from their last change
 * (`synced_at` ≥ cursor − 10 min). Our own writes that the cloud has not confirmed yet are
 * skipped (`hasPendingWrites`). Returns a stop function.
 */
export function listenToCloud(ctx: PullContext, handlers: { onChange?: (table: CloudTable | 'businesses', n: number) => void; onError?: (err: Error) => void; onShop?: (data: Row) => void } = {}): () => void {
  const firestore = fs();
  const stops: (() => void)[] = [];
  const queues = new Map<string, Promise<unknown>>();
  const serial = (key: string, job: () => Promise<unknown>) => {
    const next = (queues.get(key) || Promise.resolve()).then(job).catch((e) => handlers.onError?.(e));
    queues.set(key, next);
  };

  stops.push(onSnapshot(doc(firestore, 'businesses', ctx.bizId), (snap) => {
    const data = snap.data();
    if (!data || snap.metadata.hasPendingWrites) return;
    handlers.onShop?.(data);
    serial('businesses', async () => { if (await mergeShopDoc(data, ctx)) handlers.onChange?.('businesses', 1); });
  }, (e) => handlers.onError?.(e)));

  const cursors = readCursors();
  for (const table of DATA_TABLES) {
    const ref = collection(firestore, `businesses/${ctx.bizId}/${table}`);
    const since = Math.max(0, (cursors[table] || 0) - OVERLAP_MS);
    const source = WHOLE.has(table) ? ref : query(ref, where('synced_at', '>=', Timestamp.fromMillis(since)));
    stops.push(onSnapshot(source, (snap) => {
      const docs: Row[] = [];
      const removed: string[] = [];
      let newest = 0;
      for (const c of snap.docChanges()) {
        if (c.doc.metadata.hasPendingWrites) continue;
        if (c.type === 'removed') {
          removed.push(c.doc.id);
          continue;
        }
        const data = c.doc.data();
        const t = data.synced_at as Timestamp | undefined;
        if (t && typeof t.toMillis === 'function') newest = Math.max(newest, t.toMillis());
        docs.push({ ...data, id: c.doc.id });
      }
      if (!docs.length && !removed.length) return;
      serial(table, async () => {
        const n = await mergeCloudDocs(table, docs, ctx, removed, true);
        if (newest) saveCursor(table, newest);
        if (n) handlers.onChange?.(table, n);
      });
    }, (e) => handlers.onError?.(e)));
  }
  return () => stops.forEach((s) => s());
}
