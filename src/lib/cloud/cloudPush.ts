import { CloudTable } from '@/lib/cloud/cloudContract';
import { getCloudAccount } from '@/lib/cloud/cloudAccount';
import { markSent, Outbox, OutboxOp, outboxSize, peekOutbox, setOutboxRecording } from '@/lib/cloud/cloudOutbox';
import { tr } from '@/lib/i18n/core';

/**
 * Step 3 — the Desktop sends its shop to the cloud (one way), v4.85.0.
 *
 * The first time for a Google account everything goes (the same full push as
 * firestoreSync.syncLocalDexieToFirestore, through the cloud data contract); after that
 * only what the outbox noted (cloudOutbox.ts). Nothing here ever blocks billing: it runs
 * from CloudSyncScheduler on idle, is single-flight, and an offline or failed send keeps
 * the outbox for the next try. Firebase is loaded only when sending (dynamic import).
 *
 * Switched on per computer (Backup → Google Account → "Send this shop to the cloud"),
 * default OFF, and only with a real Google account — until the privacy policy covers the
 * desktop app (tracker K-P13) it is for test shops only.
 */

export const CLOUD_SEND_KEY = 'kamai_cloud_sync_on';
export const CLOUD_FULL_PUSH_KEY = 'kamai_cloud_full_push';
export const CLOUD_STATUS_KEY = 'kamai_cloud_sync_status';
export const CLOUD_STATUS_EVENT = 'cloud_sync_status';

export interface CloudSendStatus {
  lastSentAt: string | null;
  lastError: string | null;
  sending: boolean;
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
  } catch {}
};

/** A real Google account is connected (the Electron E2E stand-in never sends). */
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

/** The first send for this account (everything) has not happened yet. */
export function needsFullPush(): boolean {
  const a = getCloudAccount();
  return Boolean(a) && read(CLOUD_FULL_PUSH_KEY) !== a!.bizId;
}

export function getCloudSendStatus(): CloudSendStatus & { pending: number } {
  let s: Partial<CloudSendStatus> = {};
  try {
    s = JSON.parse(read(CLOUD_STATUS_KEY) || '{}');
  } catch {}
  return { lastSentAt: s.lastSentAt ?? null, lastError: s.lastError ?? null, sending: Boolean(s.sending), pending: outboxSize() };
}

function setStatus(patch: Partial<CloudSendStatus>): void {
  const { pending: _p, ...now } = getCloudSendStatus();
  void _p;
  write(CLOUD_STATUS_KEY, JSON.stringify({ ...now, ...patch }));
  window.dispatchEvent(new Event(CLOUD_STATUS_EVENT));
}

export function setCloudSendOn(on: boolean): void {
  write(CLOUD_SEND_KEY, on ? '1' : null);
  setOutboxRecording(on && canSendToCloud());
  setStatus({ lastError: null });
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
  return { full: [...box.full], tables };
}

export function cloudSendMessage(code: string): string {
  if (code === 'offline') return tr('No internet — the changes will be sent when it is back.');
  if (code === 'signed_out') return tr('The Google account is signed out on this computer. Connect it again (Backup → Google Account).');
  if (code === 'deleted_in_cloud') return tr('This shop was deleted in the cloud. Contact KamaiPlus support.');
  if (/permission/i.test(code)) return tr('The cloud refused the data (permission). Contact KamaiPlus support.');
  return tr('Could not send to the cloud ({code}). It will try again.', { code });
}

let running: Promise<{ ok: boolean; sent: number; error?: string }> | null = null;

/** Sends what is waiting now (single-flight). */
export function sendToCloudNow(): Promise<{ ok: boolean; sent: number; error?: string }> {
  if (running) return running;
  running = doSend().finally(() => {
    running = null;
  });
  return running;
}

async function doSend(): Promise<{ ok: boolean; sent: number; error?: string }> {
  const account = getCloudAccount();
  if (!cloudSendActive() || !account) return { ok: false, sent: 0, error: 'off' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setStatus({ lastError: cloudSendMessage('offline') });
    return { ok: false, sent: 0, error: 'offline' };
  }
  setStatus({ sending: true });
  let sent = 0;
  try {
    const [{ getFirebaseAuth }, fsync, { db }] = await Promise.all([
      import('@/lib/firebase/config'),
      import('@/lib/firebase/firestoreSync'),
      import('@/lib/db'),
    ]);
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('not_configured');
    await auth.authStateReady();
    if (auth.currentUser?.uid !== account.uid) throw new Error('signed_out');

    if (needsFullPush()) {
      const before = peekOutbox();
      const localBiz = await db.businesses.toCollection().first();
      const r = await fsync.syncLocalDexieToFirestore(account.bizId, { localBusinessId: localBiz?.id, onTombstone: 'stop' });
      if (!r.success) throw new Error(r.error || 'full_push_failed');
      write(CLOUD_FULL_PUSH_KEY, account.bizId);
      markSent(before); // what changed during the full push stays for the next round
      sent += Object.values(r.stats).reduce((a, b) => a + b, 0);
    }

    const box = peekOutbox();
    const plan = splitOutbox(box);
    for (const table of plan.full) {
      const rows = (await db.table(table).toArray()) as Record<string, any>[];
      await fsync.writeRecordsToFirestore(account.bizId, table, rows, []);
      sent += rows.length;
    }
    for (const { table, putIds, delIds } of plan.tables) {
      const found = (await db.table(table).bulkGet(putIds)) as (Record<string, any> | undefined)[];
      const rows = found.filter((r): r is Record<string, any> => Boolean(r));
      // A record noted as written but no longer here was deleted since: delete it in the cloud too.
      const gone = putIds.filter((_id, i) => !found[i]);
      await fsync.writeRecordsToFirestore(account.bizId, table, rows, [...delIds, ...gone]);
      sent += rows.length + delIds.length + gone.length;
    }
    markSent(box);
    setStatus({ sending: false, lastSentAt: new Date().toISOString(), lastError: null });
    return { ok: true, sent };
  } catch (e: any) {
    const code = String(e?.code || e?.message || 'error');
    setStatus({ sending: false, lastError: cloudSendMessage(code) });
    return { ok: false, sent, error: code };
  }
}
