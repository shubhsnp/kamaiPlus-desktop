import { collection, doc, getDoc, getDocs, increment, runTransaction, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { readVerticalProfile } from '@/lib/business/verticalProfile';
import { getFirestoreDb } from '@/lib/firebase/config';
import { sanitizeForFirestore } from '@/lib/firebase/firestoreSync';
import { CloudTable, CLOUD_TABLES, toCloud } from './cloudContract';
import { COUNTER_FIELDS, CounterTable, Outbox } from './cloudOutbox';

/**
 * What the Desktop writes to the shop's cloud (Step 3 / 4, v4.86.0). Loaded only when
 * sending (cloudPush imports it dynamically — Firebase never slows the counter's start).
 *
 * - Every document goes through the cloud data contract (`toCloud`) and gets `synced_at`
 *   (server time) — the other devices' listeners read changes after their last one.
 * - Stock / udhar (`COUNTER_FIELDS`) go as a value only in the first full send; after that a
 *   row is written WITHOUT them and the change travels as `increment()` (applyCounterDeltas),
 *   so a bill on the phone and one here never wipe each other.
 */

type Row = Record<string, any>;
const BATCH = 400;

function firestore() {
  const fs = getFirestoreDb();
  if (!fs) throw new Error('not_configured');
  return fs;
}

/** The cloud shop document: exists? marked deleted by the Admin Console? */
export async function cloudShopState(bizId: string): Promise<{ exists: boolean; deleted: boolean }> {
  const fs = firestore();
  const [shop, tomb] = await Promise.all([getDoc(doc(fs, 'businesses', bizId)), getDoc(doc(fs, 'deleted_businesses', bizId)).catch(() => null)]);
  return { exists: shop.exists(), deleted: Boolean(tomb?.exists()) };
}

export function cloudDocFor(table: CloudTable, row: Row, bizId: string, absolute: boolean): Row {
  const out = sanitizeForFirestore(toCloud(table, row, { bizId }));
  const counter = (COUNTER_FIELDS as Record<string, { cloud: string } | undefined>)[table];
  if (counter && !absolute) delete out[counter.cloud];
  return out;
}

/** The shop document. A shop new to the cloud gets 'grocery' (the phone never overwrites its own vertical). */
const NEW_SHOP_TYPES = new Set(['grocery', 'pharmacy', 'clothing', 'hardware', 'restaurant', 'retail']);

export async function writeShopDoc(bizId: string, row: Row, isNewShop: boolean): Promise<void> {
  const shop = cloudDocFor('businesses', row, bizId, true);
  // A new cloud shop takes this shop's category (v4.137.0 — it was always 'grocery', so a PC chemist
  // opened on the phone as a kirana). Both apps use the same six ids.
  if (isNewShop) {
    shop.business_type = NEW_SHOP_TYPES.has(row?.business_type) ? row.business_type : 'grocery';
    // v4.141.0: when the category was chosen — the phone follows the newer choice (lib/cloud/shopCategory.ts).
    shop.business_type_set_at = readVerticalProfile()?.at || new Date().toISOString();
  }
  else delete shop.business_type;
  await setDoc(doc(firestore(), 'businesses', bizId), { ...shop, synced_at: serverTimestamp() }, { merge: true });
}

/** Rows of one table (merge writes). `absolute`: counters as values (first full send only). */
export async function writeRows(bizId: string, table: CloudTable, rows: Row[], absolute: boolean): Promise<number> {
  const fs = firestore();
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = writeBatch(fs);
    for (const row of rows.slice(i, i + BATCH)) {
      if (!row?.id) continue;
      batch.set(doc(fs, `businesses/${bizId}/${table}/${row.id}`), { ...cloudDocFor(table, row, bizId, absolute), synced_at: serverTimestamp() }, { merge: true });
    }
    await batch.commit();
  }
  return rows.length;
}

export async function deleteRows(bizId: string, table: CloudTable, ids: string[]): Promise<void> {
  const fs = firestore();
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = writeBatch(fs);
    for (const id of ids.slice(i, i + BATCH)) batch.delete(doc(fs, `businesses/${bizId}/${table}/${id}`));
    await batch.commit();
  }
}

/**
 * Permanently wipes all documents from a specific subcollection in Cloud Firestore.
 * Used during data reset so deleted local items are not resurrected on next sync.
 */
export async function wipeCloudTable(bizId: string, table: CloudTable): Promise<number> {
  const fs = firestore();
  const colRef = collection(fs, `businesses/${bizId}/${table}`);
  const snap = await getDocs(colRef);
  if (snap.empty) return 0;

  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += BATCH) {
    const batch = writeBatch(fs);
    for (const d of docs.slice(i, i + BATCH)) {
      batch.delete(d.ref);
    }
    await batch.commit();
  }
  return docs.length;
}

/**
 * Permanently wipes all operational retail tables for a shop in Cloud Firestore,
 * while strictly preserving the root `businesses/${bizId}` profile document.
 */
export async function wipeAllCloudOperationalData(bizId: string): Promise<Record<string, number>> {
  const results: Record<string, number> = {};
  for (const table of CLOUD_TABLES) {
    if (table === 'businesses') continue;
    try {
      results[table] = await wipeCloudTable(bizId, table);
    } catch (err) {
      console.error(`Failed to wipe cloud table ${table}:`, err);
    }
  }
  return results;
}

/**
 * One round of counter changes, applied at most once: each chunk runs in a transaction that
 * first checks `sync_ops/{roundId}_{n}` — present = already applied (a retry), skipped.
 * A record deleted in the cloud meanwhile is left alone (no half-empty document is made).
 */
export async function applyCounterDeltas(bizId: string, roundId: string, deltas: Outbox['deltas'], device: string): Promise<{ applied: number; skipped: number }> {
  const fs = firestore();
  const list: { table: CounterTable; id: string; d: number }[] = [];
  for (const [table, recs] of Object.entries(deltas) as [CounterTable, Record<string, number>][]) {
    for (const [id, d] of Object.entries(recs || {})) if (d) list.push({ table, id, d });
  }
  let applied = 0;
  let skipped = 0;
  const CHUNK = 150; // each change needs a read in the transaction (limit 500 writes)
  for (let n = 0; n * CHUNK < list.length; n++) {
    const part = list.slice(n * CHUNK, (n + 1) * CHUNK);
    const opRef = doc(fs, `businesses/${bizId}/sync_ops/${roundId}_${n}`);
    const done = await runTransaction(fs, async (tx) => {
      if ((await tx.get(opRef)).exists()) return -1;
      const refs = part.map((c) => doc(fs, `businesses/${bizId}/${c.table}/${c.id}`));
      const snaps = await Promise.all(refs.map((r) => tx.get(r)));
      let count = 0;
      snaps.forEach((s, k) => {
        if (!s.exists()) return;
        tx.update(refs[k], { [COUNTER_FIELDS[part[k].table].cloud]: increment(part[k].d), synced_at: serverTimestamp() });
        count++;
      });
      tx.set(opRef, { at: serverTimestamp(), device, changes: part.length });
      return count;
    });
    if (done < 0) skipped += part.length;
    else applied += done;
  }
  return { applied, skipped };
}

