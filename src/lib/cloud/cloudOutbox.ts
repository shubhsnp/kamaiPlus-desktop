import type { DBCore, DBCoreTransaction, Middleware } from 'dexie';
import { CLOUD_TABLES, CloudTable } from '@/lib/cloud/cloudContract';
import { reportError } from '@/lib/diagnostics/errorReporter';

/**
 * Cloud outbox (Step 3 v4.85.0, Step 4 v4.86.0).
 *
 * Every database write goes through Dexie's DBCore `mutate`, so one pass-through
 * middleware (registered in lib/db/index.ts, like the backup's) notes WHICH record of
 * WHICH table changed — no screen has to report its own writes. cloudPush.ts later reads
 * those records and sends them through the cloud data contract. The list is kept in
 * localStorage so a change made offline, or just before the app closes, is still sent.
 * Notes are taken only while the shop has cloud sync switched on.
 *
 * Counters (Step 4): stock and udhar balance are changed by the phone AND this computer at
 * the same time, so they never travel as a value (the last writer would wipe the other's
 * bills). The middleware reads the row before the write and keeps the CHANGE
 * (`deltas`: +5 stock, −₹120 udhar); cloudPush sends it as a Firestore increment, once.
 *
 * Echo: rows written because the cloud changed (cloudPull.ts) run in a transaction marked
 * with `markFromCloud` — they are not noted, so nothing bounces back.
 */

export type OutboxOp = 'put' | 'del';

/** Local field → cloud field of the two counters. */
export const COUNTER_FIELDS = {
  products: { local: 'current_stock', cloud: 'stock_quantity' },
  customers: { local: 'current_balance', cloud: 'current_balance_paise' },
} as const;
export type CounterTable = keyof typeof COUNTER_FIELDS;

export interface Outbox {
  /** table → record id → what to do in the cloud. */
  items: Partial<Record<CloudTable, Record<string, OutboxOp>>>;
  /** Tables emptied in one go (clear / deleteRange): sent again in full. */
  full: CloudTable[];
  /** Counter changes not yet in the cloud: table → record id → change (stock, or paise). */
  deltas: Partial<Record<CounterTable, Record<string, number>>>;
  /** Poison-pill protection: table → record id → failed retry count */
  retries?: Partial<Record<CloudTable, Record<string, number>>>;
}

export const OUTBOX_KEY = 'kamai_cloud_outbox';
/** Fired after a change is noted (CloudSyncScheduler sends it a few seconds later). */
export const OUTBOX_EVENT = 'kamai_cloud_outbox_changed';
const TABLES = new Set<string>(CLOUD_TABLES);
const COUNTERS = new Set<string>(Object.keys(COUNTER_FIELDS));

let recording = false;
let outbox: Outbox = emptyOutbox();
let loaded = false;

export function emptyOutbox(): Outbox {
  return { items: {}, full: [], deltas: {} };
}

/** Float noise (0.1 + 0.2) must not leave a 0.0000000001 kg delta behind. */
const round = (n: number) => Math.round(n * 1e6) / 1e6;

export function parseOutbox(raw: string | null): Outbox {
  try {
    const o = raw ? JSON.parse(raw) : null;
    if (!o || typeof o !== 'object' || typeof o.items !== 'object' || !Array.isArray(o.full)) return emptyOutbox();
    const items: Outbox['items'] = {};
    for (const [t, recs] of Object.entries(o.items as Record<string, Record<string, string>>)) {
      if (!TABLES.has(t) || !recs || typeof recs !== 'object') continue;
      const clean: Record<string, OutboxOp> = {};
      for (const [id, op] of Object.entries(recs)) if (op === 'put' || op === 'del') clean[id] = op;
      items[t as CloudTable] = clean;
    }
    const deltas: Outbox['deltas'] = {};
    for (const [t, recs] of Object.entries((o.deltas || {}) as Record<string, Record<string, unknown>>)) {
      if (!COUNTERS.has(t) || !recs || typeof recs !== 'object') continue;
      const clean: Record<string, number> = {};
      for (const [id, d] of Object.entries(recs)) if (typeof d === 'number' && Number.isFinite(d) && d !== 0) clean[id] = d;
      deltas[t as CounterTable] = clean;
    }
    const retries: Outbox['retries'] = {};
    if (o.retries && typeof o.retries === 'object') {
      for (const [t, recs] of Object.entries(o.retries as Record<string, Record<string, unknown>>)) {
        if (!TABLES.has(t) || !recs || typeof recs !== 'object') continue;
        const clean: Record<string, number> = {};
        for (const [id, count] of Object.entries(recs)) {
          if (typeof count === 'number' && Number.isFinite(count) && count > 0) clean[id] = count;
        }
        if (Object.keys(clean).length > 0) retries[t as CloudTable] = clean;
      }
    }
    const result: Outbox = { items, full: (o.full as string[]).filter((t) => TABLES.has(t)) as CloudTable[], deltas };
    if (Object.keys(retries).length > 0) result.retries = retries;
    return result;
  } catch {
    return emptyOutbox();
  }
}

function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    outbox = parseOutbox(localStorage.getItem(OUTBOX_KEY));
  } catch {
    outbox = emptyOutbox();
  }
}

function save(): void {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
  } catch (e) {
    reportError('storage', e, 'cloud outbox not saved');
  }
}

function announce(): void {
  try {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(OUTBOX_EVENT));
  } catch {}
}

/** Start / stop noting changes (the scheduler turns it on only while sync is on). */
export function setOutboxRecording(on: boolean): void {
  recording = on;
}

export function isOutboxRecording(): boolean {
  return recording;
}

/** Pure: an outbox with one more change noted. A later write of the same record replaces an earlier one. */
export function noteChange(box: Outbox, table: string, op: OutboxOp | 'all', ids: string[]): Outbox {
  if (!TABLES.has(table)) return box;
  const t = table as CloudTable;
  if (op === 'all') return box.full.includes(t) ? box : { ...box, full: [...box.full, t] };
  const recs = { ...(box.items[t] || {}) };
  for (const id of ids) if (id) recs[String(id)] = op;
  return { ...box, items: { ...box.items, [t]: recs } };
}

/** Pure: one more counter change for a record (changes add up until sent). */
export function noteDelta(box: Outbox, table: CounterTable, id: string, delta: number): Outbox {
  if (!id || !Number.isFinite(delta) || delta === 0) return box;
  const recs = { ...(box.deltas[table] || {}) };
  const next = round((recs[id] || 0) + delta);
  if (next === 0) delete recs[id];
  else recs[id] = next;
  return { ...box, deltas: { ...box.deltas, [table]: recs } };
}

export function recordChange(table: string, op: OutboxOp | 'all', ids: string[]): void {
  if (!recording) return;
  load();
  outbox = noteChange(outbox, table, op, ids);
  save();
  announce();
}

export function recordDeltas(table: CounterTable, changes: [string, number][]): void {
  if (!recording || changes.length === 0) return;
  load();
  for (const [id, d] of changes) outbox = noteDelta(outbox, table, id, d);
  save();
}

/** What is waiting to be sent (a copy). */
export function peekOutbox(): Outbox {
  load();
  return JSON.parse(JSON.stringify(outbox));
}

// ── Counter changes on their way out ─────────────────────────────────────────
// Before sending, the waiting counter changes move to an "in flight" round with its own id.
// The cloud applies a round only once (cloudWrite.applyCounterDeltas keeps the round id), so
// a send that went through but was not confirmed here (app closed, network cut) is simply
// sent again with the same id and skipped. New changes meanwhile wait in `deltas`.
export const INFLIGHT_KEY = 'kamai_cloud_inflight';

export interface InflightDeltas {
  id: string;
  deltas: Outbox['deltas'];
}

function readInflight(): InflightDeltas | null {
  try {
    const v = JSON.parse(localStorage.getItem(INFLIGHT_KEY) || 'null');
    if (!v || typeof v.id !== 'string') return null;
    return { id: v.id, deltas: parseOutbox(JSON.stringify({ items: {}, full: [], deltas: v.deltas })).deltas };
  } catch {
    return null;
  }
}

/** The round to send now: the unconfirmed one again, or the waiting changes as a new round. */
export function takeDeltasForSend(newRoundId: string): InflightDeltas | null {
  const open = readInflight();
  if (open) return open;
  load();
  if (!Object.values(outbox.deltas).some((recs) => recs && Object.keys(recs).length)) return null;
  const round: InflightDeltas = { id: newRoundId, deltas: outbox.deltas };
  try {
    localStorage.setItem(INFLIGHT_KEY, JSON.stringify(round));
  } catch {
    return null;
  }
  outbox = { ...outbox, deltas: {} };
  save();
  return round;
}

/** The cloud has the round: forget it. */
export function finishInflight(): void {
  try {
    localStorage.removeItem(INFLIGHT_KEY);
  } catch (e) {
    reportError('storage', e, 'cloud inflight mark not cleared');
  }
}

/** A counter change of this record still on its way to the cloud (waiting + in flight; 0 when none). */
export function pendingDelta(table: CounterTable, id: string): number {
  load();
  return round((outbox.deltas[table]?.[id] || 0) + (readInflight()?.deltas[table]?.[id] || 0));
}

export function outboxSize(box: Outbox = peekOutbox()): number {
  const inflight = readInflight();
  return Object.values(box.items).reduce((n, recs) => n + Object.keys(recs || {}).length, 0) + box.full.length
    + Object.values(box.deltas).reduce((n, recs) => n + Object.keys(recs || {}).length, 0)
    + (inflight ? Object.values(inflight.deltas).reduce((n, recs) => n + Object.keys(recs || {}).length, 0) : 0);
}

export const MAX_OUTBOX_RETRIES = 5;

/** Record a failed push attempt for poison-pill protection: retries = (retries ?? 0) + 1 */
export function recordRetry(table: CloudTable, id: string): number {
  load();
  if (!outbox.retries) outbox.retries = {};
  if (!outbox.retries[table]) outbox.retries[table] = {};
  const current = outbox.retries[table]![id] ?? 0;
  const next = current + 1;
  outbox.retries[table]![id] = next;
  if (next >= MAX_OUTBOX_RETRIES) {
    if (outbox.items[table]?.[id]) {
      delete outbox.items[table]![id];
      if (Object.keys(outbox.items[table]!).length === 0) {
        delete outbox.items[table];
      }
    }
  }
  save();
  return next;
}

export function getRetries(table: CloudTable, id: string): number {
  load();
  return outbox.retries?.[table]?.[id] ?? 0;
}

export function clearRetry(table: CloudTable, id: string): void {
  load();
  if (!outbox.retries?.[table]?.[id]) return;
  const tableRetries = { ...outbox.retries[table] };
  delete tableRetries[id];
  outbox = {
    ...outbox,
    retries: {
      ...outbox.retries,
      [table]: tableRetries,
    },
  };
  save();
}

/**
 * Pure: the outbox after `sent` went out. A record written AGAIN while it was being sent
 * (a different op now, or noted after the send started) is kept for the next round; a
 * counter keeps only what changed after the send read it.
 */
export function withoutSent(box: Outbox, sent: Outbox): Outbox {
  const items: Outbox['items'] = {};
  for (const [t, recs] of Object.entries(box.items) as [CloudTable, Record<string, OutboxOp>][]) {
    const left: Record<string, OutboxOp> = {};
    for (const [id, op] of Object.entries(recs)) if (sent.items[t]?.[id] !== op) left[id] = op;
    if (Object.keys(left).length) items[t] = left;
  }
  let result: Outbox = { items, full: box.full.filter((t) => !sent.full.includes(t)), deltas: box.deltas };
  for (const [t, recs] of Object.entries(sent.deltas || {}) as [CounterTable, Record<string, number>][]) {
    for (const [id, d] of Object.entries(recs)) result = noteDelta(result, t, id, -d);
  }
  if (box.retries) {
    const retries: Outbox['retries'] = {};
    for (const [t, recs] of Object.entries(box.retries) as [CloudTable, Record<string, number>][]) {
      const remaining: Record<string, number> = {};
      for (const [id, count] of Object.entries(recs || {})) {
        if (items[t]?.[id]) remaining[id] = count;
      }
      if (Object.keys(remaining).length) retries[t] = remaining;
    }
    result.retries = retries;
  }
  return result;
}

export function markSent(sent: Outbox): void {
  load();
  outbox = withoutSent(outbox, sent);
  save();
}

/** Everything that was waiting is in the cloud (or the shop left the cloud). */
export function clearOutbox(): void {
  outbox = emptyOutbox();
  loaded = true;
  save();
  finishInflight();
}

// ── Echo guard ────────────────────────────────────────────────────────────────
const FROM_CLOUD = '__kpFromCloud';

/** Marks a Dexie transaction as "writing what the cloud sent" (pass `tx.idbtrans`). */
export function markFromCloud(idbtrans: unknown): void {
  if (idbtrans && typeof idbtrans === 'object') (idbtrans as Record<string, unknown>)[FROM_CLOUD] = true;
}

const isFromCloud = (trans: DBCoreTransaction | undefined) => Boolean(trans && (trans as unknown as Record<string, unknown>)[FROM_CLOUD]);

/** Registered in lib/db/index.ts before the database opens. Changes nothing it passes on. */
export const cloudOutboxMiddleware: Middleware<DBCore> = {
  stack: 'dbcore',
  name: 'cloudOutbox',
  create: (down) => ({
    ...down,
    table: (tableName) => {
      const table = down.table(tableName);
      if (!TABLES.has(tableName)) return table;
      const keyPath = table.schema.primaryKey.keyPath;
      const counter = COUNTERS.has(tableName) ? COUNTER_FIELDS[tableName as CounterTable] : null;
      const keysOf = (req: { keys?: unknown[]; values?: readonly unknown[] }) =>
        (req.keys as unknown[] | undefined) || (typeof keyPath === 'string' && req.values ? req.values.map((v: any) => v?.[keyPath]) : []);

      return {
        ...table,
        mutate: (req) => {
          if (!recording || isFromCloud(req.trans)) return table.mutate(req);
          // Counters: read the rows first (same transaction) to know how much they change.
          const needsBefore = counter && (req.type === 'put' || req.type === 'add');
          const before: Promise<unknown[]> = needsBefore
            ? table.getMany({ trans: req.trans, keys: keysOf(req as any) as any[] })
            : Promise.resolve([]);
          return before.then((olds) =>
            table.mutate(req).then((res) => {
              if (req.type === 'deleteRange') recordChange(tableName, 'all', []);
              else if (req.type === 'delete') recordChange(tableName, 'del', (req.keys || []).map(String));
              else {
                const keys = req.keys || (res.results as unknown[] | undefined) || keysOf(req as any);
                recordChange(tableName, 'put', (keys || []).map(String));
                if (counter) {
                  const changes: [string, number][] = [];
                  req.values.forEach((v: any, i: number) => {
                    const id = String((keys || [])[i] ?? v?.id ?? '');
                    const was = Number((olds[i] as any)?.[counter.local]) || 0;
                    const now = Number(v?.[counter.local]) || 0;
                    if (id && now !== was) changes.push([id, now - was]);
                  });
                  recordDeltas(tableName as CounterTable, changes);
                }
              }
              return res;
            })
          );
        },
      };
    },
  }),
};
