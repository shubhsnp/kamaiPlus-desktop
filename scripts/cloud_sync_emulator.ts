/**
 * Cloud sync (Step 3 + 4) against the REAL Firestore + Auth emulators, with the shop's
 * real Firestore rules (Android repo firestore.rules). Nothing touches the live project.
 *
 *   npm run test:cloud        (needs Java; starts / stops the emulators itself)
 *
 * "This computer" = the app's own Dexie database (fake-indexeddb) + cloudOutbox / cloudPush /
 * cloudPull. "The phone" = a second Firebase client signed in as the same Google account that
 * writes exactly what the Android app writes (CloudContract.saleToCloud / productToCloud,
 * `FieldValue.increment` on a bill).
 */
import 'fake-indexeddb/auto';

process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'demo-key';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-kamaiplus';
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'demo-kamaiplus.firebaseapp.com';
process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.NEXT_PUBLIC_AUTH_EMULATOR = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'}`;

// The browser pieces the app code uses.
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};
const bus = new EventTarget();
(globalThis as any).window = Object.assign(globalThis, {
  addEventListener: bus.addEventListener.bind(bus),
  removeEventListener: bus.removeEventListener.bind(bus),
  dispatchEvent: bus.dispatchEvent.bind(bus),
});

let passed = 0;
let failed = 0;
const check = (ok: boolean, label: string) => {
  if (ok) passed++;
  else failed++;
  console.log(`  ${ok ? '✅ [PASS]' : '❌ [FAIL]'} ${label}`);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(cond: () => Promise<boolean> | boolean, ms = 8000): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await cond()) return true;
    await sleep(150);
  }
  return false;
}

async function main() {
  // require(), not import(): the same Firebase build the app modules load (tsx runs them as CommonJS) —
  // one SDK instance, or Firestore refuses the other copy's references.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initializeApp } = require('firebase/app') as typeof import('firebase/app');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getAuth, connectAuthEmulator, signInWithCredential, GoogleAuthProvider } = require('firebase/auth') as typeof import('firebase/auth');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fsdk = require('firebase/firestore') as typeof import('firebase/firestore');
  const { getFirebaseAuth, getFirestoreDb } = await import('../src/lib/firebase/config');
  const { db } = await import('../src/lib/db');
  const outbox = await import('../src/lib/cloud/cloudOutbox');
  const push = await import('../src/lib/cloud/cloudPush');
  const pull = await import('../src/lib/cloud/cloudPull');
  const cw = await import('../src/lib/cloud/cloudWrite');

  console.log('================================================================');
  console.log('☁️  Cloud sync (Desktop ↔ phone) on the Firebase emulators');
  console.log('================================================================');

  // ── Sign in: this computer and the phone, the same Google account ──
  const googleToken = JSON.stringify({ sub: 'rahul-e2e', email: 'rahul.e2e@example.com', email_verified: true, name: 'Rahul' });
  const deskAuth = getFirebaseAuth()!;
  const cred = await signInWithCredential(deskAuth, GoogleAuthProvider.credential(googleToken));
  const uid = cred.user.uid;
  const bizId = `biz_${uid}`;
  localStorage.setItem('kamai_cloud_account', JSON.stringify({ uid, email: 'rahul.e2e@example.com', name: 'Rahul', photoURL: null, bizId, linkedAt: new Date().toISOString() }));

  const phoneApp = initializeApp({ apiKey: 'demo-key', projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, authDomain: 'x' }, 'phone');
  const phoneAuth = getAuth(phoneApp);
  connectAuthEmulator(phoneAuth, process.env.NEXT_PUBLIC_AUTH_EMULATOR!, { disableWarnings: true });
  await signInWithCredential(phoneAuth, GoogleAuthProvider.credential(googleToken));
  const phone = fsdk.getFirestore(phoneApp);
  const [ph, pp] = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR!.split(':');
  fsdk.connectFirestoreEmulator(phone, ph, Number(pp));
  const pdoc = (path: string) => fsdk.doc(phone, path);
  const nowIso = () => new Date().toISOString();

  // A stranger's account must not read this shop (rules).
  const strangerApp = initializeApp({ apiKey: 'demo-key', projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, authDomain: 'x' }, 'stranger');
  const strangerAuth = getAuth(strangerApp);
  connectAuthEmulator(strangerAuth, process.env.NEXT_PUBLIC_AUTH_EMULATOR!, { disableWarnings: true });
  await signInWithCredential(strangerAuth, GoogleAuthProvider.credential(JSON.stringify({ sub: 'someone-else', email: 'x@example.com', email_verified: true })));
  const stranger = fsdk.getFirestore(strangerApp);
  fsdk.connectFirestoreEmulator(stranger, ph, Number(pp));

  // ── The phone's shop already in the cloud (Android made it) ──
  await fsdk.setDoc(pdoc(`businesses/${bizId}`), { id: bizId, business_id: bizId, owner_uid: uid, name: 'Sharma Kirana', business_type: 'kirana', phone: '9876543210', updated_at: nowIso() });
  await fsdk.setDoc(pdoc(`businesses/${bizId}/products/prod_phone_1`), {
    id: 'prod_phone_1', business_id: bizId, name: 'Parle-G 80g', barcode: '8901719101037', category_id: 'cat_phone', unit: 'piece',
    selling_price_paise: 1000, mrp_paise: 1000, purchase_price_paise: 800, stock_quantity: 7, tax_rate: 0, is_tax_inclusive: true,
    is_loose_item: false, is_favorite: false, has_variants: false, business_type: 'kirana', updated_at: nowIso(), synced_at: fsdk.serverTimestamp(),
  });
  await fsdk.setDoc(pdoc(`businesses/${bizId}/sales/sale_phone_1`), {
    id: 'sale_phone_1', business_id: bizId, invoice_number: 'M-001', customer_name: null, subtotal_paise: 2000, tax_amount_paise: 0, discount_paise: 0,
    line_discount_paise: 0, total_amount_paise: 2000, payment_method: 'cash', split_cash_paise: 0, split_upi_paise: 0, split_card_paise: 0, split_credit_paise: 0,
    status: 'completed', items: [{ product_id: 'prod_phone_1', name: 'Parle-G 80g', quantity: 2, unit_price_paise: 1000, total_paise: 2000 }],
    created_at: nowIso(), timestamp: Date.now(), source: 'mobile_native_pos', updated_at: nowIso(), synced_at: fsdk.serverTimestamp(),
  });

  // ── This computer: its own shop id, items, a customer ──
  const LOCAL = 'biz_desk_1234';
  const t0 = nowIso();
  await db.businesses.put({ id: LOCAL, name: 'Sharma Kirana (PC)', owner_name: 'Rahul', phone: '9876543210', next_invoice_number: 12, created_at: t0, updated_at: t0 } as any);
  await db.categories.put({ id: 'cat_desk', business_id: LOCAL, name: 'Biscuits', created_at: t0 } as any);
  const product = (id: string, name: string, stock: number) => ({
    id, business_id: LOCAL, name, barcode: id.toUpperCase(), category_id: 'cat_desk', unit: 'piece', selling_price: 2500, mrp: 2500, purchase_price: 2000,
    current_stock: stock, min_stock_level: 2, tax_rate: 0, is_tax_inclusive: true, is_active: true, is_favorite: false, created_at: t0, updated_at: t0,
  });
  await db.products.bulkPut([product('prod_desk_a', 'Rocket 10 Shot', 10), product('prod_desk_b', 'Anar Big', 5)] as any);
  await db.customers.put({ id: 'cust_desk_1', business_id: LOCAL, name: 'Ramesh', phone: '9811111111', opening_balance: 0, current_balance: 0, loyalty_points: 0, total_spent: 0, total_visits: 0, customer_type: 'regular', created_at: t0, updated_at: t0 } as any);

  // ── 1. Switch on → first sync: the phone's shop comes in, then everything goes up ──
  push.setCloudSendOn(true);
  check(push.cloudSendActive() && push.needsFullPush(), 'Sync switched on for a real Google account; the first sync is waiting');
  const first = await push.sendToCloudNow();
  const phoneProd = await db.products.get('prod_phone_1');
  const phoneSale = await db.sales.get('sale_phone_1');
  const localShop = await db.businesses.get(LOCAL);
  check(first.ok && !push.needsFullPush() && phoneProd?.current_stock === 7 && phoneProd?.selling_price === 1000 && phoneProd?.business_id === LOCAL
    && phoneSale?.grand_total === 2000 && phoneSale?.business_id === LOCAL && (await db.businesses.count()) === 1 && localShop?.next_invoice_number === 12,
    `First sync: the phone's item (stock 7, ₹10) and bill came in under THIS computer's shop id; still one shop row; this PC's bill counter kept (${first.error || 'ok'})`);
  const cloudA = (await fsdk.getDoc(pdoc(`businesses/${bizId}/products/prod_desk_a`))).data();
  const cloudShop = (await fsdk.getDoc(pdoc(`businesses/${bizId}`))).data();
  check(cloudA?.stock_quantity === 10 && cloudA?.selling_price_paise === 2500 && cloudA?.business_id === bizId && cloudShop?.business_type === 'kirana'
    && (await fsdk.getDoc(pdoc(`businesses/${bizId}/customers/cust_desk_1`))).exists() && (await fsdk.getDoc(pdoc(`businesses/${bizId}/categories/cat_desk`))).exists(),
    "First sync: this computer's items / customer / category are in the cloud in the contract's format; the phone's shop type was not overwritten");
  check(outbox.outboxSize() === 0, 'First sync: nothing left waiting (the rows that came from the phone were not sent back as changes)');

  const stop = pull.listenToCloud({ bizId, localBizId: LOCAL });
  await sleep(1500);

  // ── 2. Stock: a bill here and a bill on the phone at the same time ──
  await db.transaction('rw', db.products, db.sales, async () => {
    await db.sales.put({ id: 'sale_desk_1', business_id: LOCAL, invoice_number: 'INV-012', grand_total: 5000, subtotal: 5000, tax_total: 0, discount_total: 0, amount_received: 5000, payment_method: 'cash', status: 'completed', items: [], created_at: nowIso(), updated_at: nowIso() } as any);
    const p = await db.products.get('prod_desk_a');
    await db.products.put({ ...p!, current_stock: p!.current_stock - 2, updated_at: nowIso() });
  });
  await fsdk.updateDoc(pdoc(`businesses/${bizId}/products/prod_desk_a`), { stock_quantity: fsdk.increment(-3) }); // the phone's bill (pushSaleToCloud)
  check(outbox.pendingDelta('products', 'prod_desk_a') === -2, 'A bill here notes the stock CHANGE (−2), not the new value');
  await until(async () => (await db.products.get('prod_desk_a'))?.current_stock === 5);
  const midLocal = (await db.products.get('prod_desk_a'))?.current_stock;
  check(midLocal === 5, `Before sending, this computer already shows the phone's bill too: 10 − 3 (phone) − 2 (here, waiting) = 5 (got ${midLocal})`);
  await push.sendToCloudNow();
  const cloudStock = (await fsdk.getDoc(pdoc(`businesses/${bizId}/products/prod_desk_a`))).data()?.stock_quantity;
  await sleep(800);
  const localStock = (await db.products.get('prod_desk_a'))?.current_stock;
  check(cloudStock === 5 && localStock === 5 && outbox.pendingDelta('products', 'prod_desk_a') === 0,
    `Both bills count: cloud stock ${cloudStock}, this computer ${localStock} (10 − 2 − 3 = 5) — nobody's bill was overwritten`);
  const cloudSale = (await fsdk.getDoc(pdoc(`businesses/${bizId}/sales/sale_desk_1`))).data();
  check(cloudSale?.total_amount_paise === 5000 && cloudSale?.invoice_number === 'INV-012', "This computer's bill is in the cloud for the phone (₹50 as 5000 paise)");

  // ── 3. A send that went through but was not confirmed here is not applied twice ──
  const p2 = await db.products.get('prod_desk_b');
  await db.products.put({ ...p2!, current_stock: p2!.current_stock - 1, updated_at: nowIso() });
  const round = outbox.takeDeltasForSend('round_crash_test');
  await cw.applyCounterDeltas(bizId, round!.id, round!.deltas, 'desk_test'); // …and the app "closed" before finishInflight()
  const afterCrash = (await fsdk.getDoc(pdoc(`businesses/${bizId}/products/prod_desk_b`))).data()?.stock_quantity;
  await push.sendToCloudNow(); // next start: the same round again
  const afterRetry = (await fsdk.getDoc(pdoc(`businesses/${bizId}/products/prod_desk_b`))).data()?.stock_quantity;
  check(afterCrash === 4 && afterRetry === 4 && localStorage.getItem('kamai_cloud_inflight') === null,
    `A stock change sent but not confirmed is sent again with the same round id and skipped: 5 → ${afterCrash} → ${afterRetry}`);

  // ── 4. Udhar: a credit bill here (+₹500) and a payment on the phone (−₹200) ──
  const c = await db.customers.get('cust_desk_1');
  await db.customers.put({ ...c!, current_balance: 50000, updated_at: nowIso() });
  await fsdk.updateDoc(pdoc(`businesses/${bizId}/customers/cust_desk_1`), { current_balance_paise: fsdk.increment(-20000) });
  await push.sendToCloudNow();
  await sleep(800);
  const cloudBal = (await fsdk.getDoc(pdoc(`businesses/${bizId}/customers/cust_desk_1`))).data()?.current_balance_paise;
  const localBal = (await db.customers.get('cust_desk_1'))?.current_balance;
  check(cloudBal === 30000 && localBal === 30000, `Udhar adds up from both: ₹500 − ₹200 = ₹300 (cloud ${cloudBal}, here ${localBal} paise)`);

  // ── 5. The phone's changes come here live ──
  await fsdk.setDoc(pdoc(`businesses/${bizId}/products/prod_phone_1`), { selling_price_paise: 1200, updated_at: new Date(Date.now() + 1000).toISOString(), synced_at: fsdk.serverTimestamp() }, { merge: true });
  await fsdk.setDoc(pdoc(`businesses/${bizId}/products/prod_phone_2`), {
    id: 'prod_phone_2', business_id: bizId, name: 'Maggi 70g', barcode: '8901058851298', category_id: 'cat_phone', unit: 'piece', selling_price_paise: 1400, mrp_paise: 1400,
    purchase_price_paise: 1200, stock_quantity: 24, tax_rate: 0, is_tax_inclusive: true, updated_at: nowIso(), synced_at: fsdk.serverTimestamp(),
  });
  await fsdk.setDoc(pdoc(`businesses/${bizId}/sales/sale_phone_2`), {
    id: 'sale_phone_2', business_id: bizId, invoice_number: 'M-002', subtotal_paise: 1400, tax_amount_paise: 0, discount_paise: 0, total_amount_paise: 1400, payment_method: 'upi',
    status: 'completed', items: [{ product_id: 'prod_phone_2', name: 'Maggi 70g', quantity: 1, unit_price_paise: 1400, total_paise: 1400 }], created_at: nowIso(), updated_at: nowIso(), synced_at: fsdk.serverTimestamp(),
  });
  const live = await until(async () => (await db.products.get('prod_phone_1'))?.selling_price === 1200 && (await db.products.get('prod_phone_2'))?.current_stock === 24 && Boolean(await db.sales.get('sale_phone_2')));
  const s2 = await db.sales.get('sale_phone_2');
  check(live && s2?.grand_total === 1400 && s2?.payment_method === 'upi' && s2?.business_id === LOCAL,
    "Live from the phone: a new price (₹12), a new item (Maggi, 24), a new UPI bill (₹14) — all under this computer's shop id");
  await fsdk.deleteDoc(pdoc(`businesses/${bizId}/products/prod_phone_2`));
  const gone = await until(async () => !(await db.products.get('prod_phone_2')));
  check(gone, 'An item deleted on the phone is deleted here too');
  await sleep(500);
  check(outbox.outboxSize() === 0, 'Nothing from the phone bounced back into the outbox (no echo loop)');

  // ── 6. A change here that is older than the phone's newer edit does not win; a newer one does ──
  const pp1 = await db.products.get('prod_phone_1');
  await db.products.put({ ...pp1!, name: 'Parle-G 80g (PC)', updated_at: new Date(Date.now() + 5000).toISOString() });
  await push.sendToCloudNow();
  const cloudName = (await fsdk.getDoc(pdoc(`businesses/${bizId}/products/prod_phone_1`))).data()?.name;
  check(cloudName === 'Parle-G 80g (PC)', `A newer edit here reaches the phone ("${cloudName}")`);

  // ── 7. Deleted here → deleted on the phone ──
  await db.products.delete('prod_desk_b');
  await push.sendToCloudNow();
  // v4.169.0: a deletion is a tombstone (`deleted: true`) — an offline device / a synced_at reader still sees it.
  const tomb = (await fsdk.getDoc(pdoc(`businesses/${bizId}/products/prod_desk_b`))).data();
  check(tomb?.deleted === true && tomb?.is_deleted === true, 'An item deleted here is marked deleted in the cloud (tombstone — the phone deletes it too)');

  // ── 8. Rules: another Google account cannot read this shop ──
  let blocked = false;
  try {
    await fsdk.getDoc(fsdk.doc(stranger, `businesses/${bizId}/products/prod_desk_a`));
  } catch (e: any) {
    blocked = /permission/i.test(String(e?.code || e?.message));
  }
  check(blocked, "Firestore rules: another Google account cannot read this shop's items");

  // ── 9. Offline: nothing lost ──
  await fsdk.disableNetwork(getFirestoreDb()!);
  const pa = await db.products.get('prod_desk_a');
  await db.products.put({ ...pa!, current_stock: pa!.current_stock - 1, updated_at: nowIso() });
  const offlineTry = await Promise.race([push.sendToCloudNow(), sleep(4000).then(() => ({ ok: false, sent: 0, error: 'timeout' }))]);
  await fsdk.enableNetwork(getFirestoreDb()!);
  await push.sendToCloudNow();
  await sleep(800);
  const backOnline = (await fsdk.getDoc(pdoc(`businesses/${bizId}/products/prod_desk_a`))).data()?.stock_quantity;
  check(!offlineTry.ok && backOnline === 4 && (await db.products.get('prod_desk_a'))?.current_stock === 4,
    `No internet: the bill waits (${offlineTry.error}); back online it goes up once (stock 5 → ${backOnline})`);

  // ── 10. Rules (v4.171.0 / v4.173.0): audit trail, staff carts, staff never write bills ──
  const denied = async (p: Promise<unknown>) => { try { await p; return false; } catch (e: any) { return /permission/i.test(String(e?.code || e?.message)); } };
  const auditRef = pdoc(`businesses/${bizId}/audit_logs/audit_e2e_1`);
  await fsdk.setDoc(auditRef, { id: 'audit_e2e_1', business_id: bizId, action: 'PRICE_CHANGE', details: 'Parle-G 10 → 12', entity_type: 'product', entity_id: 'prod_phone_1', created_at: nowIso() });
  const resendOk = !(await denied(fsdk.setDoc(auditRef, { action: 'PRICE_CHANGE', synced_at: fsdk.serverTimestamp() }, { merge: true })));
  const tombOk = !(await denied(fsdk.setDoc(auditRef, { deleted: true, is_deleted: true, updated_at: nowIso() }, { merge: true })));
  const rewriteBlocked = await denied(fsdk.setDoc(auditRef, { details: 'nothing happened' }, { merge: true }));
  check(resendOk && tombOk && rewriteBlocked, 'Rules: the owner may send an audit log again (full sync) or tombstone it, never change what it says');

  // A staff phone: signed in with the server's custom claims (the emulator takes an unsigned token).
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const staffToken = (sid: string) => {
    const now = Math.floor(Date.now() / 1000);
    const sub = `kpst_${bizId.replace(/^biz_/, '')}_${sid}`;
    return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ iss: 'firebase-auth-emulator@example.com', sub: 'firebase-auth-emulator@example.com', aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit', iat: now, exp: now + 3600, uid: sub, claims: { kp_biz: bizId, kp_sid: sid, kp_role: 'billing' } })}.`;
  };
  await fsdk.setDoc(pdoc(`businesses/${bizId}/staff/st_raju01`), { name: 'Raju', role: 'billing', active: true, created_at: nowIso() });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { signInWithCustomToken } = require('firebase/auth') as typeof import('firebase/auth');
  const staffApp = initializeApp({ apiKey: 'demo-key', projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, authDomain: 'x' }, 'staff');
  const staffAuth = getAuth(staffApp);
  connectAuthEmulator(staffAuth, process.env.NEXT_PUBLIC_AUTH_EMULATOR!, { disableWarnings: true });
  await signInWithCustomToken(staffAuth, staffToken('st_raju01'));
  const staff = fsdk.getFirestore(staffApp);
  fsdk.connectFirestoreEmulator(staff, ph, Number(pp));
  const cartDoc = (id: string, staffId: string) => ({
    id, staff_id: staffId, staff_name: 'Raju', status: 'sent', created_at: nowIso(), total_paise: 2400,
    lines: [{ product_id: 'prod_phone_1', name: 'Parle-G 80g', qty: 2, unit_price_paise: 1200, unit: 'packet' }],
  });
  const ownCart = !(await denied(fsdk.setDoc(fsdk.doc(staff, `businesses/${bizId}/counter_carts/cart_e2e_1`), cartDoc('cart_e2e_1', 'st_raju01'))));
  const otherCart = await denied(fsdk.setDoc(fsdk.doc(staff, `businesses/${bizId}/counter_carts/cart_e2e_2`), cartDoc('cart_e2e_2', 'st_someone')));
  const staffBill = await denied(fsdk.setDoc(fsdk.doc(staff, `businesses/${bizId}/sales/sale_by_staff`), { id: 'sale_by_staff', grand_total: 100 }));
  const staffPrice = await denied(fsdk.setDoc(fsdk.doc(staff, `businesses/${bizId}/products/prod_phone_1`), { selling_price: 1 }, { merge: true }));
  const mine = await fsdk.getDocs(fsdk.query(fsdk.collection(staff, `businesses/${bizId}/counter_carts`), fsdk.where('staff_id', '==', 'st_raju01')));
  check(ownCart && otherCart && staffBill && staffPrice && mine.size === 1,
    'Rules: a staff phone sends a cart only in its own name and reads only its own; it can never write a bill or change an item');

  // v4.175.0: the waiter's phone reads its own bills (made at the counter) — never another's.
  const { staffDay } = await import('../src/lib/staff/staffDay');
  const day = staffDay('st_raju01', new Date());
  await fsdk.setDoc(pdoc(`businesses/${bizId}/sales/sale_raju_1`), { id: 'sale_raju_1', staff_id: 'st_raju01', staff_name: 'Raju', staff_day: day, total_amount_paise: 15000 });
  await fsdk.setDoc(pdoc(`businesses/${bizId}/sales/sale_amit_1`), { id: 'sale_amit_1', staff_id: 'st_amit02', staff_name: 'Amit', staff_day: staffDay('st_amit02', new Date()), total_amount_paise: 9000 });
  const myBills = await fsdk.getDocs(fsdk.query(fsdk.collection(staff, `businesses/${bizId}/sales`), fsdk.where('staff_id', '==', 'st_raju01'), fsdk.where('staff_day', '==', day)));
  const otherBill = await denied(fsdk.getDoc(fsdk.doc(staff, `businesses/${bizId}/sales/sale_amit_1`)));
  const allBills = await denied(fsdk.getDocs(fsdk.collection(staff, `businesses/${bizId}/sales`)));
  check(myBills.size === 1 && myBills.docs[0].id === 'sale_raju_1' && otherBill && allBills,
    "Rules: a staff phone reads its own bills of today (staff_day) — never another member's, never the whole list");

  // The counter takes the cart once (a second counter gets nothing).
  const carts = await import('../src/lib/cloud/counterCartsCloud');
  const taken = await carts.takeCart(bizId, 'cart_e2e_1', 'pc-1');
  const again = await carts.takeCart(bizId, 'cart_e2e_1', 'pc-2');
  const after = (await fsdk.getDoc(pdoc(`businesses/${bizId}/counter_carts/cart_e2e_1`))).data();
  check(taken?.staffName === 'Raju' && taken.lines[0].qty === 2 && again === null && after?.status === 'taken' && after?.taken_by === 'pc-1',
    'Send to counter: the counter takes the cart once (status taken); a second counter gets nothing');

  stop();
  push.setCloudSendOn(false);
  console.log('================================================================');
  console.log(`📊 CLOUD SYNC: ${passed}/${passed + failed} CHECKS PASSED (${failed} failures)`);
  console.log('================================================================');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('Cloud sync test crashed:', e);
  process.exit(1);
});
