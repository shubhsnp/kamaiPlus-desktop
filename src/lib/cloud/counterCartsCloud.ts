import * as fs from 'firebase/firestore';
import { getFirestoreDb } from '@/lib/firebase/config';
import { COUNTER_CARTS, parseStaffCart, TAKEN_KEEP_MS, type StaffCart } from './counterCarts';

/**
 * "Send to counter" on the cloud (v4.173.0) — loaded only by StaffCartInbox (dynamic import), so
 * Firebase never slows the counter's start. Rules: Android repo firestore.rules `counter_carts`.
 */
/** Listens to the carts waiting for the counter (newest last). Returns a stop function. */
export async function startCartInbox(bizId: string, onCarts: (carts: StaffCart[]) => void, onError?: (e: unknown) => void): Promise<() => void> {
  const db = getFirestoreDb();
  if (!db) return () => {};
  const col = fs.collection(db, `businesses/${bizId}/${COUNTER_CARTS}`);
  // Taken carts are history only for the phone's "Sent today" — gone after two days.
  void fs.getDocs(fs.query(col, fs.where('status', '==', 'taken'))).then((snap) => {
    const old = Date.now() - TAKEN_KEEP_MS;
    snap.forEach((d) => {
      const at = Date.parse(String(d.data().taken_at || d.data().created_at || ''));
      if (Number.isFinite(at) && at < old) void fs.deleteDoc(d.ref).catch(() => {});
    });
  }).catch(() => {});
  return fs.onSnapshot(fs.query(col, fs.where('status', '==', 'sent')), (snap) => {
    const carts = snap.docs.map((d) => parseStaffCart(d.id, d.data())).filter((c): c is StaffCart => Boolean(c));
    onCarts(carts.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  }, (e) => onError?.(e));
}

/** Takes a cart for this counter (once — another counter that took it first wins). Null when gone. */
export async function takeCart(bizId: string, id: string, device: string): Promise<StaffCart | null> {
  const db = getFirestoreDb();
  if (!db) return null;
  const ref = fs.doc(db, `businesses/${bizId}/${COUNTER_CARTS}/${id}`);
  return fs.runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const cart = snap.exists() ? parseStaffCart(snap.id, snap.data()) : null;
    if (!cart || cart.status !== 'sent') return null;
    tx.update(ref, { status: 'taken', taken_at: new Date().toISOString(), taken_by: device });
    return cart;
  });
}
