import { CLOUD_TABLES, CloudTable } from '@/lib/cloud/cloudContract';
import { getCloudAccount } from '@/lib/cloud/cloudAccount';
import { finishInflight, markSent, MAX_OUTBOX_RETRIES, Outbox, OutboxOp, outboxSize, peekOutbox, setOutboxRecording, takeDeltasForSend } from '@/lib/cloud/cloudOutbox';
import { newId } from '@/lib/ids';
import { tr } from '@/lib/i18n/core';
import { reportError } from '@/lib/diagnostics/errorReporter';

/**
 * Cloud sync of this shop — Step 3 (Desktop → cloud, v4.85.0) + Step 4 (both ways, v4.86.0).
 *
 * The first time for a Google account: whatever the cloud shop already has (the phone's
 * items, bills, customers) comes here first (cloudPull.pullEverything), then everything
 * this computer has goes up in one consistent read. After that only what the outbox noted
 * (cloudOutbox.ts) goes up, stock / udhar as increments (cloudWrite.applyCounterDeltas),
 * and CloudSyncScheduler keeps listening for the phone's changes (cloudPull.listenToCloud).
 * Nothing here ever blocks billing: single-flight, on idle; offline or a failure keeps the
 * outbox for the next try. Firebase is loaded only when syncing (dynamic import).
 *
 * Switched on per computer (Backup → Google Account), default OFF, and only with a real
 * Google account.
 */

export const CLOUD_SEND_KEY = 'kamai_cloud_sync_on';
export const CLOUD_FULL_PUSH_KEY = 'kamai_cloud_full_push';
export const CLOUD_STATUS_KEY = 'kamai_cloud_sync_status';
export const CLOUD_STATUS_EVENT = 'cloud_sync_status';
export const CLOUD_DEVICE_KEY = 'kamai_cloud_device_id';

export interface CloudSendStatus {
  lastSentAt: string | null;
  lastError: string | null;
  sending: boolean;
  /** Last time something from the phone / another counter was merged here. */
  lastPulledAt?: string | null;
}

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch (e) {
    reportError('storage', e, key);
  }
};

/** This computer's name in the cloud's sync log (sync_ops). */
export function deviceId(): string {
  let id = read(CLOUD_DEVICE_KEY);
  if (!id) {
    id = newId('desk');
    write(CLOUD_DEVICE_KEY, id);
  }
  return id;
}

/** A real Google account is connected (the Electron E2E stand-in never syncs). */
export function canSendToCloud(): boolean {
  const a = getCloudAccount();
  return Boolean(a && !a.stub);
}

export function isCloudSendOn(): boolean {
  return read(CLOUD_SEND_KEY) === '1';
}

export function cloudSendActive(): boolean {
  return isCloudSendOn() && canSendToCloud();
}

/** The first sync (cloud in, then everything up) for this account has not happened yet. */
export function needsFullPush(): boolean {
  const a = getCloudAccount();
  return Boolean(a) && read(CLOUD_FULL_PUSH_KEY) !== a!.bizId;
}

export function getCloudSendStatus(): CloudSendStatus & { pending: number } {
  let s: Partial<CloudSendStatus> = {};
  try {
    s = JSON.parse(read(CLOUD_STATUS_KEY) || '{}');
  } catch {}
  return { lastSentAt: s.lastSentAt ?? null, lastError: s.lastError ?? null, sending: Boolean(s.sending), lastPulledAt: s.lastPulledAt ?? null, pending: outboxSize() };
}

export function setCloudStatus(patch: Partial<CloudSendStatus>): void {
  const { pending: _p, ...now } = getCloudSendStatus();
  void _p;
  write(CLOUD_STATUS_KEY, JSON.stringify({ ...now, ...patch }));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CLOUD_STATUS_EVENT));
}

export function setCloudSendOn(on: boolean): void {
  write(CLOUD_SEND_KEY, on ? '1' : null);
  setOutboxRecording(on && canSendToCloud());
  setCloudStatus({ lastError: null });
}

/** Pure: per table, which records to write and which to delete; tables to send in full. */
export function splitOutbox(box: Outbox): { full: CloudTable[]; tables: { table: CloudTable; putIds: string[]; delIds: string[] }[] } {
  const tables = (Object.entries(box.items) as [CloudTable, Record<string, OutboxOp>][])
    .filter(([t]) => !box.full.includes(t))
    .map(([table, recs]) => ({
      table,
      putIds: Object.keys(recs).filter((id) => recs[id] === 'put'),
      delIds: Object.keys(recs).filter((id) => recs[id] === 'del'),
    }))
    .filter((t) => t.putIds.length + t.delIds.length > 0);
  // The shop document first: a new cloud shop must exist before its rows.
  tables.sort((a, b) => (a.table === 'businesses' ? -1 : b.table === 'businesses' ? 1 : 0));
  return { full: [...box.full], tables };
}

export function cloudSendMessage(code: string): string {
  if (code === 'offline') return tr('No internet — the changes will be sent when it is back.');
  if (code === 'signed_out') return tr('The Google account is signed out on this computer. Connect it again (Backup → Google Account).');
  if (code === 'deleted_in_cloud') return tr('This shop was deleted in the cloud. Contact KamaiPlus support.');
  if (/permission/i.test(code)) return tr('The cloud refused the data (permission). Contact KamaiPlus support.');
  return tr('Could not send to the cloud ({code}). It will try again.', { code });
}

type SendResult = { ok: boolean; sent: number; error?: string };
let running: Promise<SendResult> | null = null;

/** Syncs what is waiting now (single-flight). */
export function sendToCloudNow(): Promise<SendResult> {
  if (running) return running;
  running = doSend().finally(() => {
    running = null;
  });
  return running;
}

async function doSend(): Promise<SendResult> {
  const account = getCloudAccount();
  if (!cloudSendActive() || !account) return { ok: false, sent: 0, error: 'off' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setCloudStatus({ lastError: cloudSendMessage('offline') });
    return { ok: false, sent: 0, error: 'offline' };
  }
  setCloudStatus({ sending: true });
  let sent = 0;
  try {
    const [{ getFirebaseAuth }, cw, pull, { db }] = await Promise.all([
      import('@/lib/firebase/config'),
      import('@/lib/cloud/cloudWrite'),
      import('@/lib/cloud/cloudPull'),
      import('@/lib/db'),
    ]);
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('not_configured');
    await auth.authStateReady();
    if (auth.currentUser?.uid !== account.uid) throw new Error('signed_out');

    const localBiz = await db.businesses.toCollection().first();
    if (!localBiz) throw new Error('no_shop');
    const ctx = { bizId: account.bizId, localBizId: localBiz.id };
    const shop = await cw.cloudShopState(account.bizId);
    if (shop.deleted) throw new Error('deleted_in_cloud');

    if (needsFullPush()) {
      // 1. The phone's shop comes here first (echo-free), 2. then everything goes up — read in
      //    ONE transaction together with the outbox, so no change is lost or counted twice.
      if (shop.exists) await pull.pullEverything(ctx);
      const tables = CLOUD_TABLES.filter((t) => t !== 'businesses');
      const snapshot: { box: Outbox; rows: Record<string, Record<string, any>[]> } = { box: peekOutbox(), rows: {} };
      await db.transaction('r', tables.map((t) => db.table(t)), async () => {
        for (const t of tables) snapshot.rows[t] = (await db.table(t).toArray()) as Record<string, any>[];
        snapshot.box = peekOutbox();
      });
      await cw.writeShopDoc(account.bizId, (await db.businesses.get(localBiz.id)) as Record<string, any>, !shop.exists);
      for (const t of tables) sent += await cw.writeRows(account.bizId, t, snapshot.rows[t], true);
      write(CLOUD_FULL_PUSH_KEY, account.bizId);
      markSent(snapshot.box); // later changes (and their stock / udhar deltas) stay for the next round
      finishInflight();
    }

    // 3. What changed since: rows (counters left out), deletions, tables emptied in one go.
    const box = peekOutbox();
    const plan = splitOutbox(box);
    for (const table of plan.full) {
      const rows = (await db.table(table).toArray()) as Record<string, any>[];
      sent += await cw.writeRows(account.bizId, table, rows, false);
    }
    for (const { table, putIds, delIds } of plan.tables) {
      if (table === 'businesses') {
        const row = await db.businesses.get(localBiz.id);
        if (row) await cw.writeShopDoc(account.bizId, row as Record<string, any>, false);
        sent++;
        continue;
      }
      const found = (await db.table(table).bulkGet(putIds)) as (Record<string, any> | undefined)[];
      const rows = found.filter((r): r is Record<string, any> => Boolean(r));
      // A record noted as written but no longer here was deleted since: delete it in the cloud too.
      const gone = putIds.filter((_id, i) => !found[i]);
      sent += await cw.writeRows(account.bizId, table, rows, false);
      if (delIds.length + gone.length) await cw.deleteRows(account.bizId, table, [...delIds, ...gone]);
      sent += delIds.length + gone.length;
    }
    const currentBox = peekOutbox();
    const sentItems: Outbox['items'] = {};
    for (const [t, recs] of Object.entries(box.items) as [CloudTable, Record<string, OutboxOp>][]) {
      const tableSent: Record<string, OutboxOp> = {};
      for (const [id, op] of Object.entries(recs || {})) {
        const retries = currentBox.retries?.[t]?.[id] ?? 0;
        if (retries === 0 || retries >= MAX_OUTBOX_RETRIES) {
          tableSent[id] = op;
        }
      }
      if (Object.keys(tableSent).length) sentItems[t] = tableSent;
    }
    markSent({ items: sentItems, full: plan.full, deltas: {} });

    // 4. Stock / udhar changes: one round, applied at most once, then this computer takes the
    //    cloud's new value (+ anything changed meanwhile) so it matches the phone exactly.
    const round = takeDeltasForSend(newId('round'));
    if (round) {
      const r = await cw.applyCounterDeltas(account.bizId, round.id, round.deltas, deviceId());
      finishInflight();
      sent += r.applied;
      await realign(ctx, round.deltas);
    }

    setCloudStatus({ sending: false, lastSentAt: new Date().toISOString(), lastError: null });
    return { ok: true, sent };
  } catch (e: any) {
    const code = String(e?.code || e?.message || 'error');
    setCloudStatus({ sending: false, lastError: cloudSendMessage(code) });
    return { ok: false, sent, error: code };
  }
}

/** After counter increments: read those documents back and merge them (stock = cloud + pending). */
async function realign(ctx: { bizId: string; localBizId: string }, deltas: Outbox['deltas']): Promise<void> {
  const [{ doc, getDoc }, { getFirestoreDb }, { mergeCloudDocs }] = await Promise.all([
    import('firebase/firestore'),
    import('@/lib/firebase/config'),
    import('@/lib/cloud/cloudPull'),
  ]);
  const fs = getFirestoreDb();
  if (!fs) return;
  for (const [table, recs] of Object.entries(deltas) as [CloudTable, Record<string, number>][]) {
    const ids = Object.keys(recs || {});
    const docs: Record<string, any>[] = [];
    for (const id of ids) {
      const snap = await getDoc(doc(fs, `businesses/${ctx.bizId}/${table}/${id}`)).catch(() => null);
      if (snap?.exists()) docs.push({ ...snap.data(), id });
    }
    if (docs.length) await mergeCloudDocs(table, docs, ctx, [], false);
  }
}
