import type { DBCore, Middleware } from 'dexie';
import { CLOUD_TABLES, CloudTable } from '@/lib/cloud/cloudContract';

/**
 * Cloud outbox (v4.85.0, Step 3 — Desktop → cloud, one way).
 *
 * Every database write goes through Dexie's DBCore `mutate`, so one pass-through
 * middleware (registered in lib/db/index.ts, like the backup's) notes WHICH record of
 * WHICH table changed — no screen has to report its own writes. cloudPush.ts later reads
 * those records and sends them through the cloud data contract. The list is kept in
 * localStorage so a change made offline, or just before the app closes, is still sent.
 * Notes are taken only while the shop has cloud sending switched on.
 */

export type OutboxOp = 'put' | 'del';

export interface Outbox {
  /** table → record id → what to do in the cloud. */
  items: Partial<Record<CloudTable, Record<string, OutboxOp>>>;
  /** Tables emptied in one go (clear / deleteRange): sent again in full. */
  full: CloudTable[];
}

export const OUTBOX_KEY = 'kamai_cloud_outbox';
const TABLES = new Set<string>(CLOUD_TABLES);

let recording = false;
let outbox: Outbox = { items: {}, full: [] };
let loaded = false;

export function emptyOutbox(): Outbox {
  return { items: {}, full: [] };
}

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
    return { items, full: (o.full as string[]).filter((t) => TABLES.has(t)) as CloudTable[] };
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
  } catch {}
}

/** Start / stop noting changes (the scheduler turns it on only while sending is on). */
export function setOutboxRecording(on: boolean): void {
  recording = on;
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

export function recordChange(table: string, op: OutboxOp | 'all', ids: string[]): void {
  if (!recording) return;
  load();
  outbox = noteChange(outbox, table, op, ids);
  save();
}

/** What is waiting to be sent (a copy). */
export function peekOutbox(): Outbox {
  load();
  return JSON.parse(JSON.stringify(outbox));
}

export function outboxSize(box: Outbox = peekOutbox()): number {
  return Object.values(box.items).reduce((n, recs) => n + Object.keys(recs || {}).length, 0) + box.full.length;
}

/**
 * Pure: the outbox after `sent` went out. A record written AGAIN while it was being sent
 * (a different op now, or noted after the send started) is kept for the next round.
 */
export function withoutSent(box: Outbox, sent: Outbox): Outbox {
  const items: Outbox['items'] = {};
  for (const [t, recs] of Object.entries(box.items) as [CloudTable, Record<string, OutboxOp>][]) {
    const left: Record<string, OutboxOp> = {};
    for (const [id, op] of Object.entries(recs)) if (sent.items[t]?.[id] !== op) left[id] = op;
    if (Object.keys(left).length) items[t] = left;
  }
  return { items, full: box.full.filter((t) => !sent.full.includes(t)) };
}

export function markSent(sent: Outbox): void {
  load();
  outbox = withoutSent(outbox, sent);
  save();
}

/** After a full push everything that was waiting is in the cloud. */
export function clearOutbox(): void {
  outbox = emptyOutbox();
  loaded = true;
  save();
}

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
      return {
        ...table,
        mutate: (req) =>
          table.mutate(req).then((res) => {
            if (recording) {
              if (req.type === 'deleteRange') recordChange(tableName, 'all', []);
              else if (req.type === 'delete') recordChange(tableName, 'del', (req.keys || []).map(String));
              else {
                const keys = req.keys || (res.results as unknown[] | undefined) ||
                  (typeof keyPath === 'string' ? req.values.map((v: any) => v?.[keyPath]) : []);
                recordChange(tableName, 'put', (keys || []).map(String));
              }
            }
            return res;
          }),
      };
    },
  }),
};
