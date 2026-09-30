import { getFirestoreDb } from './config';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  writeBatch,
  onSnapshot,
  query,
  orderBy,
  limit,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '@/lib/db';
import { CLOUD_TABLES, CloudTable, fromCloud, toCloud } from '@/lib/cloud/cloudContract';
import { Sale } from '@/types';

/**
 * Full push / pull between Dexie and Firestore. Every document goes through the cloud data
 * contract (lib/cloud/cloudContract.ts, docs/CLOUD_DATA_CONTRACT.md) — never a raw Dexie row —
 * so the Android app reads the same shop. Cloud sync is off until the Desktop has a Firebase
 * login (CLOUD_SYNC_ENABLED); nothing here runs before that.
 */

/** Every table except the shop document itself, in the order they are pushed / pulled. */
const DATA_TABLES = CLOUD_TABLES.filter((t) => t !== 'businesses') as Exclude<CloudTable, 'businesses'>[];

/** Tables whose rows carry `updated_at`: the cloud copy only wins when it is newer. */
const NEWER_WINS = new Set<CloudTable>(['products', 'customers', 'suppliers', 'sales']);

/**
 * Sanitizes any data structure to remove `undefined` values that Firestore rejects
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as any;
  }
  try {
    // JSON stringify cleanly and recursively removes all undefined object keys
    const jsonString = JSON.stringify(data, (_, value) => (value === undefined ? undefined : value));
    if (!jsonString) return {} as any;
    return JSON.parse(jsonString);
  } catch (e) {
    // Fallback object recursion
    if (Array.isArray(data)) {
      return data.filter((x) => x !== undefined).map((x) => sanitizeForFirestore(x)) as any;
    }
    if (typeof data === 'object') {
      const cleaned: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          cleaned[key] = sanitizeForFirestore(value);
        }
      }
      return cleaned as T;
    }
    return data;
  }
}

/** Cloud copy newer than (or as new as) the local row? Rows without a time always take the cloud copy. */
function cloudIsNewer(cloud: Record<string, any>, local: Record<string, any> | undefined, strictly: boolean): boolean {
  if (!local || !local.updated_at || !cloud.updated_at) return true;
  const c = new Date(cloud.updated_at).getTime();
  const l = new Date(local.updated_at).getTime();
  if (!Number.isFinite(c) || !Number.isFinite(l)) return true;
  return strictly ? c > l : c >= l;
}

/** Cloud documents → Dexie rows for one table, merged over the local rows (R7). */
async function mergeIntoDexie(table: CloudTable, docs: Record<string, any>[], bizId: string, strictly: boolean): Promise<number> {
  const withId = docs.filter((d) => d && d.id);
  if (withId.length === 0) return 0;
  const locals = (await db.table(table).bulkGet(withId.map((d) => String(d.id)))) as (Record<string, any> | undefined)[];
  const rows: Record<string, any>[] = [];
  withId.forEach((d, i) => {
    const row = fromCloud(table, d, locals[i], { bizId });
    if (!NEWER_WINS.has(table) || cloudIsNewer(row, locals[i], strictly)) rows.push(row);
  });
  if (rows.length > 0) await db.table(table).bulkPut(rows);
  return rows.length;
}

/**
 * Helper to commit items in Firestore batches (max 450 per batch)
 */
async function commitBatchInChunks(firestore: any, table: CloudTable, items: Record<string, any>[], bizId: string): Promise<number> {
  if (!items || items.length === 0) return 0;

  const CHUNK_SIZE = 450;
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(firestore);
    for (const item of chunk) {
      const ref = doc(firestore, `businesses/${bizId}/${table}/${item.id}`);
      batch.set(ref, sanitizeForFirestore(toCloud(table, item, { bizId })), { merge: true });
    }
    await batch.commit();
  }
  return items.length;
}

/**
 * Pushes entire local Dexie database to Cloud Firestore for backup & multi-device sync.
 * `businessId` is the CLOUD id (`biz_<uid>`); `opts.localBusinessId` is this computer's own
 * shop id when it differs (v4.85.0: the Google-linked shop keeps its local id).
 * `opts.onTombstone: 'stop'` (the Step 3 sender) never wipes this computer when the cloud
 * says the shop was deleted — it only stops and reports it.
 */
export async function syncLocalDexieToFirestore(
  businessId: string,
  opts: { localBusinessId?: string; onTombstone?: 'purge' | 'stop' } = {}
): Promise<{ success: boolean; stats: Record<string, number>; error?: string }> {
  const firestore = getFirestoreDb();
  if (!firestore) {
    throw new Error('Firestore is not configured. Please check Firebase credentials.');
  }

  const stats: Record<string, number> = {};

  // PREVENT RESURRECTION OF DELETED STORES: Verify business exists in cloud before sync!
  const bizRef = doc(firestore, 'businesses', businessId);
  let cloudShopExists = true;
  try {
    const [bizSnap, tombSnap] = await Promise.all([
      getDoc(bizRef).catch(() => null),
      getDoc(doc(firestore, 'deleted_businesses', businessId)).catch(() => null),
    ]);
    if (bizSnap) cloudShopExists = bizSnap.exists();

    if (tombSnap?.exists() && opts.onTombstone === 'stop') {
      return { success: false, stats, error: 'deleted_in_cloud' };
    }
    if (tombSnap?.exists()) {
      console.warn(`🛑 Business ${businessId} was deleted in cloud. Aborting sync and wiping device.`);
      const { purgeLocalDeviceData } = await import('@/lib/auth');
      await purgeLocalDeviceData().catch(() => {});
      if (typeof window !== 'undefined') {
        window.location.href = '/auth?deleted=true';
      }
      return { success: false, stats };
    }
  } catch (checkErr) {
    console.warn('Sync cloud existence check notice:', checkErr);
  }

  // 1. Shop profile. The Desktop never overwrites the Android vertical; a new cloud shop gets 'grocery'.
  const biz = await db.businesses.get(opts.localBusinessId || businessId);
  if (biz) {
    const shopDoc = toCloud('businesses', biz, { bizId: businessId });
    if (!cloudShopExists) shopDoc.business_type = 'grocery';
    await setDoc(bizRef, sanitizeForFirestore(shopDoc), { merge: true });
  }

  // 2. Every other table (D1: khata, suppliers, expenses, stock history… all of it).
  for (const table of DATA_TABLES) {
    const rows = (await db.table(table).toArray()) as Record<string, any>[];
    stats[table] = await commitBatchInChunks(firestore, table, rows, businessId);
  }

  return { success: true, stats };
}

/**
 * Step 3 outbox: writes these records of one table (through the contract) and deletes
 * `deleteIds`, in batches of 450. The shop document itself is `businesses/{bizId}`.
 */
export async function writeRecordsToFirestore(
  bizId: string,
  table: CloudTable,
  rows: Record<string, any>[],
  deleteIds: string[]
): Promise<void> {
  const firestore = getFirestoreDb();
  if (!firestore) throw new Error('Firestore is not configured.');
  if (table === 'businesses') {
    for (const row of rows) await setDoc(doc(firestore, 'businesses', bizId), sanitizeForFirestore(toCloud('businesses', row, { bizId })), { merge: true });
    return;
  }
  await commitBatchInChunks(firestore, table, rows, bizId);
  for (let i = 0; i < deleteIds.length; i += 450) {
    const batch = writeBatch(firestore);
    for (const id of deleteIds.slice(i, i + 450)) batch.delete(doc(firestore, `businesses/${bizId}/${table}/${id}`));
    await batch.commit();
  }
}

/**
 * Restores all data from Cloud Firestore into local Dexie IndexedDB
 */
export async function restoreFirestoreToLocalDexie(businessId: string): Promise<{ success: boolean; stats: Record<string, number> }> {
  const firestore = getFirestoreDb();
  if (!firestore) {
    throw new Error('Firestore is not configured.');
  }

  const stats: Record<string, number> = {};

  // 0. Business Profile Document (name, phone, address… — never this computer's invoice counter)
  try {
    const bizSnap = await getDoc(doc(firestore, 'businesses', businessId));
    const data = bizSnap.exists() ? bizSnap.data() : null;
    if (data && data.name) {
      const local = await db.businesses.get(businessId);
      await db.businesses.put(fromCloud('businesses', data, local, { bizId: businessId }) as any);
    }
  } catch (bizErr) {
    console.warn('Business profile cloud restore notice:', bizErr);
  }

  for (const table of DATA_TABLES) {
    const snap = await getDocs(collection(firestore, `businesses/${businessId}/${table}`));
    const docs: Record<string, any>[] = [];
    snap.forEach((d) => docs.push({ id: d.id, ...d.data() }));
    stats[table] = await mergeIntoDexie(table, docs, businessId, false);
  }

  return { success: true, stats };
}

/**
 * Completely clears local IndexedDB tables and pulls fresh datasets from Cloud
 */
export async function clearLocalDexieAndFreshSync(
  businessId: string
): Promise<{ success: boolean; stats: Record<string, number> }> {
  // 1. Wipe local tables
  await Promise.all([
    db.products.clear(),
    db.categories.clear(),
    db.customers.clear(),
    db.suppliers.clear(),
    db.sales.clear(),
    db.ledger_transactions.clear(),
    db.cash_expenses.clear(),
    db.inventory_movements.clear(),
    db.purchase_bills.clear(),
    db.cash_registers.clear(),
    db.sales_returns.clear(),
  ]);

  // 2. Fresh restore from Cloud Database
  return await restoreFirestoreToLocalDexie(businessId);
}

/**
 * Subscribes to real-time sales stream in Firestore for live Owner Mobile Dashboard
 */
export function subscribeToLiveSales(
  businessId: string,
  onSalesUpdate: (sales: Sale[]) => void
): Unsubscribe | null {
  const firestore = getFirestoreDb();
  if (!firestore) return null;

  const salesQuery = query(
    collection(firestore, `businesses/${businessId}/sales`),
    orderBy('created_at', 'desc'),
    limit(50)
  );

  return onSnapshot(salesQuery, (snapshot) => {
    const list: Sale[] = [];
    snapshot.forEach((d) => list.push(fromCloud('sales', { id: d.id, ...d.data() }, null, { bizId: businessId }) as Sale));
    onSalesUpdate(list);
  });
}

/**
 * Subscribes to all real-time collections to pull changes from other counters / devices into local Dexie
 */
export function subscribeToMultiDeviceSync(businessId: string): Unsubscribe[] {
  const firestore = getFirestoreDb();
  if (!firestore || !businessId) return [];

  const unsubs: Unsubscribe[] = [];

  try {
    // 0. Business Profile live stream (name / address changes, and the admin's kill-switch)
    const bizDocUnsub = onSnapshot(
      doc(firestore, `businesses/${businessId}`),
      async (snapshot) => {
        const data = snapshot.exists() ? snapshot.data() : null;
        if (data && data.name) {
          // 1. Instant Real-time Freeze / Block Lockout (`account_disabled` is the Admin Console's switch)
          if (data.account_disabled === true || data.is_active === false) {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('account_frozen', {
                detail: { message: 'Your merchant store has been blocked/frozen by the platform administrator.' }
              }));
            }
          } else if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('account_unfrozen'));
          }

          const local = await db.businesses.get(businessId);
          await db.businesses.put(fromCloud('businesses', data, local, { bizId: businessId }) as any);
        }
      },
      (err) => console.warn('Realtime business sync notice:', err.message)
    );
    unsubs.push(bizDocUnsub);

    // 1. Every table: other counters' / the phone's changes into this computer (sales: the latest 100).
    for (const table of ['products', 'customers', 'sales', 'categories', 'ledger_transactions', 'cash_expenses', 'suppliers', 'cash_registers'] as CloudTable[]) {
      const ref = collection(firestore, `businesses/${businessId}/${table}`);
      const source = table === 'sales' ? query(ref, orderBy('created_at', 'desc'), limit(100)) : ref;
      const unsub = onSnapshot(
        source,
        async (snapshot) => {
          const changed = snapshot.docChanges()
            .filter((c) => c.type === 'added' || c.type === 'modified')
            .map((c) => ({ id: c.doc.id, ...c.doc.data() }));
          await mergeIntoDexie(table, changed, businessId, true);
        },
        (err) => console.warn(`Realtime ${table} sync notice:`, err.message)
      );
      unsubs.push(unsub);
    }
  } catch (e) {
    console.warn('Multi-device sync listener setup notice:', e);
  }

  return unsubs;
}
