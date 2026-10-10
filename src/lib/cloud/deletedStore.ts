/**
 * "This shop was deleted by the KamaiPlus Admin" (Firestore `deleted_businesses/<id>`) — v4.122.0, AU-01.
 *
 * v4.117.0 emptied the PC the moment a tombstone was seen, with no backup, and the app's start
 * waited for the answer. Now:
 *  - only ids that really belong to this PC are checked: its own shop id, and the cloud shop only
 *    when this PC syncs with it (`isCloudSendOn`) — a deleted phone shop no longer empties a PC that
 *    merely signed in with the same Google account;
 *  - before anything is emptied, today's backup file is written (`runAutoBackup({ force: true })`);
 *    if it cannot be written, NOTHING is deleted (the shop keeps working, the error is logged);
 *  - callers run it in the background — the counter never waits for the cloud.
 * Firebase is loaded on demand (performance contract §8).
 */

export type CloudDeleteOutcome = 'wiped' | 'kept-no-backup' | 'not-deleted';

/** The ids to check on this PC: its own shop, plus the cloud shop it syncs with. */
export async function idsToCheckOnThisPc(localBizId: string): Promise<string[]> {
  const ids = [localBizId].filter(Boolean);
  try {
    const [{ isCloudSendOn }, { getCloudAccount }] = await Promise.all([import('@/lib/cloud/cloudPush'), import('@/lib/cloud/cloudAccount')]);
    const acc = getCloudAccount();
    if (isCloudSendOn() && acc?.bizId && !ids.includes(acc.bizId)) ids.push(acc.bizId);
  } catch {}
  return ids;
}

/** True only when the cloud answers that one of these shops was deleted. Offline / no answer = false. */
export async function storeDeletedInCloud(ids: string[]): Promise<boolean> {
  if (!ids.length || (typeof navigator !== 'undefined' && !navigator.onLine)) return false;
  try {
    const [{ getFirestoreDb, getFirebaseAuth }, { doc, getDoc }] = await Promise.all([import('@/lib/firebase/config'), import('firebase/firestore')]);
    const fs = getFirestoreDb();
    if (!fs) return false;
    // v4.134.0: the check ran before the saved Google session was back — a signed-out read is refused,
    // the error became "not deleted", and a deleted shop's PC kept going (and sending its data up).
    const auth = getFirebaseAuth();
    if (auth) await auth.authStateReady();
    const snaps = await Promise.all(ids.map((id) => getDoc(doc(fs, 'deleted_businesses', id)).catch(() => null)));
    return snaps.some((s) => Boolean(s?.exists()));
  } catch {
    return false;
  }
}

/** A backup that keeps the shop's data safe: written now, or there was nothing to keep. */
export function backupIsSafe(outcome: { status: string; reason?: string }): boolean {
  return outcome.status === 'saved' || (outcome.status === 'skipped' && outcome.reason === 'empty-shop');
}

/** Backup first, then empty this PC and go to the sign-in page. No backup = nothing deleted. */
export async function wipeAfterCloudDelete(): Promise<CloudDeleteOutcome> {
  const { runAutoBackup } = await import('@/lib/backup/autoBackup');
  let outcome = await runAutoBackup({ force: true });
  if (outcome.status === 'skipped' && outcome.reason === 'busy') {
    await new Promise((r) => setTimeout(r, 4000));
    outcome = await runAutoBackup({ force: true });
  }
  if (!backupIsSafe(outcome)) {
    console.warn('🛑 Shop deleted in the cloud, but no backup could be written — local data kept.', outcome);
    return 'kept-no-backup';
  }
  console.warn('🛑 Shop deleted in the cloud. Backup written; emptying this computer.');
  const { purgeLocalDeviceData } = await import('@/lib/auth');
  await purgeLocalDeviceData().catch(() => {});
  if (typeof window !== 'undefined') window.location.href = '/auth?deleted=true';
  return 'wiped';
}
