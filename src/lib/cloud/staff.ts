import { getCloudAccount } from '@/lib/cloud/cloudAccount';
import { tr } from '@/lib/i18n/core';
import type { VerticalId } from '@/lib/business/verticalProfile';
import { reportError } from '@/lib/diagnostics/errorReporter';

/*
 * Staff sign-in (v4.144.0, Rahul 2026-10-10): the shop's staff join from their own phone with a one-time
 * code — never with the owner's Google account. The owner keeps the list in
 * `businesses/{biz}/staff/{staffId}` ({ name, role, active }); the `staff` Cloud Function (KamaiPlus
 * Android functions/staff_core.js) turns a code into the staff member's own sign-in, and firestore.rules
 * "STAFF" lets each role touch only its work. Removing a member (active: false) signs that phone out.
 */

export type StaffRoleId = 'waiter' | 'captain' | 'cashier' | 'kitchen' | 'billing' | 'stock' | 'delivery' | 'salesperson' | 'godown';

export interface StaffRole {
  id: StaffRoleId;
  label: string;
  /** What the staff phone shows, in the shop's words. */
  does: string;
  /** false = planned; shown as "Coming next". */
  available: boolean;
}

/** The roles of each kind of shop. Only `available` ones can be given today (the server knows them). */
export function staffRolesFor(vertical: VerticalId | null | undefined): StaffRole[] {
  const r = (id: StaffRoleId, label: string, does: string, available = true): StaffRole => ({ id, label, does, available });
  switch (vertical) {
    case 'restaurant':
      return [
        r('waiter', tr('Waiter'), tr('Tables, taking orders, sending KOTs. No bills or money.'), true),
        r('captain', tr('Captain'), tr('A waiter who can also move tables and cancel items.'), true),
        r('cashier', tr('Cashier'), tr('Bill & pay, today’s cash.'), true),
        // Not yet: the phone has no kitchen screen, so a kitchen member could not sign in (v4.171.0).
        r('kitchen', tr('Kitchen'), tr('Incoming KOTs on a kitchen screen, mark ready.'), false),
      ];
    case 'pharmacy':
      return [
        r('billing', tr('Billing staff'), tr('Counter bills with batch / expiry.'), true),
        r('stock', tr('Stock staff'), tr('Goods in, expiry list, low stock.'), true),
      ];
    case 'clothing':
      return [
        r('salesperson', tr('Salesperson'), tr('Customer’s cart on the floor; the counter bills it. Sales counted per person.'), true),
        r('cashier', tr('Cashier'), tr('Bills, returns and exchanges.'), true),
      ];
    case 'hardware':
      return [
        r('salesperson', tr('Salesman'), tr('Quotations with the customer; the counter bills them.'), true),
        r('godown', tr('Godown staff'), tr('Goods in and out, stock.'), true),
      ];
    default:
      return [
        r('billing', tr('Billing staff'), tr('Counter bills, scanning, UPI QR. Discount up to a limit.'), true),
        r('stock', tr('Stock staff'), tr('Goods in, labels, stock count.'), true),
        r('delivery', tr('Delivery staff'), tr('Home-delivery orders, cash collected.'), true),
      ];
  }
}

export interface StaffPermissions {
  canDiscount?: boolean;
  maxDiscountPct?: number;
  canCancelItem?: boolean;
  canChangeTable?: boolean;
  canViewReports?: boolean;
  canAccessCashDrawer?: boolean;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  active: boolean;
  createdAt: string;
  joinedAt?: string;
  deviceName?: string;
  lastSeenAt?: string;
  monthlySalaryPaise?: number;
  permissions?: StaffPermissions;
}

export const STAFF_FUNCTION_URL = 'https://us-central1-kamaiplus.cloudfunctions.net/staff';
export const ONLINE_MS = 5 * 60 * 1000;

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** A staff document → a member (bad data never crashes the page). */
export function parseStaff(id: string, d: Record<string, unknown> | undefined | null): StaffMember | null {
  if (!d || !/^[A-Za-z0-9_-]{4,40}$/.test(id)) return null;
  const name = text(d.name, 40);
  if (!name) return null;
  const monthlySalaryPaise = typeof d.monthly_salary_paise === 'number' && Number.isFinite(d.monthly_salary_paise)
    ? Math.max(0, Math.round(d.monthly_salary_paise))
    : undefined;
  const perm = d.permissions && typeof d.permissions === 'object' ? (d.permissions as Record<string, unknown>) : null;
  const permissions: StaffPermissions | undefined = perm ? {
    canDiscount: perm.can_discount === true,
    maxDiscountPct: typeof perm.max_discount_pct === 'number' ? Math.max(0, Math.min(100, perm.max_discount_pct)) : undefined,
    canCancelItem: perm.can_cancel_item === true,
    canChangeTable: perm.can_change_table === true,
    canViewReports: perm.can_view_reports === true,
    canAccessCashDrawer: perm.can_access_cash_drawer === true,
  } : undefined;
  return {
    id,
    name,
    role: text(d.role, 40) || 'staff',
    active: d.active === true,
    createdAt: text(d.created_at, 40),
    ...(text(d.joined_at, 40) ? { joinedAt: text(d.joined_at, 40) } : {}),
    ...(text(d.device_name, 60) ? { deviceName: text(d.device_name, 60) } : {}),
    ...(text(d.last_seen_at, 40) ? { lastSeenAt: text(d.last_seen_at, 40) } : {}),
    ...(monthlySalaryPaise !== undefined ? { monthlySalaryPaise } : {}),
    ...(permissions ? { permissions } : {}),
  };
}

export type StaffStatus = 'online' | 'joined' | 'not_joined' | 'removed';

export function staffStatus(m: StaffMember, now = Date.now()): StaffStatus {
  if (!m.active) return 'removed';
  if (!m.joinedAt) return 'not_joined';
  const seen = Date.parse(m.lastSeenAt || '');
  return Number.isFinite(seen) && now - seen < ONLINE_MS ? 'online' : 'joined';
}

/** Active first, then by name. */
export function sortStaff(list: StaffMember[]): StaffMember[] {
  return [...list].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
}

export function newStaffId(rand: () => number = Math.random): string {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += abc[Math.floor(rand() * abc.length) % abc.length];
  return `st_${s}`;
}

/** The new member's document with custom role and initial permissions, or why not. */
export function staffDraft(
  name: string,
  role: string,
  vertical: VerticalId | null | undefined,
  nowIso: string,
  options?: StaffPermissions | { permissions?: StaffPermissions; isCustom?: boolean },
): { ok: true; doc: Record<string, unknown> } | { ok: false; error: string } {
  const cleanName = name.replace(/\s+/g, ' ').trim();
  if (cleanName.length < 2) return { ok: false, error: tr('Type the staff member’s name.') };
  if (cleanName.length > 40) return { ok: false, error: tr('Keep the name under 40 letters.') };

  const cleanRole = role.replace(/\s+/g, ' ').trim();
  if (cleanRole.length < 2) return { ok: false, error: tr('Type or pick a role (e.g. Waiter, Helper, Chef).') };
  if (cleanRole.length > 40) return { ok: false, error: tr('Keep the role under 40 letters.') };

  const isCustom = typeof options === 'object' && options !== null && 'isCustom' in options && (options as { isCustom?: boolean }).isCustom === true;
  const permissions: StaffPermissions | undefined =
    typeof options === 'object' && options !== null && 'permissions' in options
      ? (options as { permissions?: StaffPermissions }).permissions
      : (options as StaffPermissions | undefined);

  const preset = staffRolesFor(vertical).find(
    (x) => x.id.toLowerCase() === cleanRole.toLowerCase() || x.label.toLowerCase() === cleanRole.toLowerCase(),
  );

  if (!preset && !isCustom) {
    return { ok: false, error: tr('Pick a role.') };
  }
  if (preset && !preset.available) return { ok: false, error: tr('This role cannot sign in on the phone yet. Pick another role.') };

  const finalRole = preset ? preset.id : cleanRole;

  const permDoc: Record<string, unknown> = {};
  if (permissions) {
    if (permissions.canDiscount !== undefined) permDoc.can_discount = permissions.canDiscount;
    if (permissions.maxDiscountPct !== undefined) permDoc.max_discount_pct = permissions.maxDiscountPct;
    if (permissions.canCancelItem !== undefined) permDoc.can_cancel_item = permissions.canCancelItem;
    if (permissions.canChangeTable !== undefined) permDoc.can_change_table = permissions.canChangeTable;
    if (permissions.canViewReports !== undefined) permDoc.can_view_reports = permissions.canViewReports;
    if (permissions.canAccessCashDrawer !== undefined) permDoc.can_access_cash_drawer = permissions.canAccessCashDrawer;
  }

  return {
    ok: true,
    doc: {
      name: cleanName,
      role: finalRole,
      active: true,
      created_at: nowIso,
      ...(Object.keys(permDoc).length > 0 ? { permissions: permDoc } : {}),
    },
  };
}

function bizOrThrow(): string {
  const a = getCloudAccount();
  if (!a || a.stub) throw new Error('no_account');
  return a.bizId;
}

/** Live list of this shop's staff. Returns a stop function. */
export async function watchStaff(onList: (list: StaffMember[]) => void, onError?: (e: unknown) => void): Promise<() => void> {
  const bizId = bizOrThrow();
  const [{ getFirestoreDb, getFirebaseAuth }, fs] = await Promise.all([import('@/lib/firebase/config'), import('firebase/firestore')]);
  const auth = getFirebaseAuth();
  if (auth) await auth.authStateReady();
  const db = getFirestoreDb();
  if (!db) throw new Error('not_configured');
  return fs.onSnapshot(fs.collection(db, `businesses/${bizId}/staff`), (snap) => {
    onList(sortStaff(snap.docs.map((d) => parseStaff(d.id, d.data())).filter((m): m is StaffMember => Boolean(m))));
  }, (e) => onError?.(e));
}

export async function addStaff(doc: Record<string, unknown>): Promise<string> {
  const bizId = bizOrThrow();
  const [{ getFirestoreDb }, fs] = await Promise.all([import('@/lib/firebase/config'), import('firebase/firestore')]);
  const db = getFirestoreDb();
  if (!db) throw new Error('not_configured');
  // Offline the write waits for the internet and "Saving…" stayed for ever (v4.175.0): say so at once.
  // (No timeout: the queued write would still land later and a retry would add the person twice.)
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('offline');
  const id = newStaffId();
  await fs.setDoc(fs.doc(db, `businesses/${bizId}/staff/${id}`), doc);
  return id;
}

/** Remove (false) — the phone is signed out at once — or add back (true; it joins again with a new code). */
export async function setStaffActive(staffId: string, active: boolean): Promise<void> {
  const bizId = bizOrThrow();
  const [{ getFirestoreDb }, fs] = await Promise.all([import('@/lib/firebase/config'), import('firebase/firestore')]);
  const db = getFirestoreDb();
  if (!db) throw new Error('not_configured');
  await fs.updateDoc(fs.doc(db, `businesses/${bizId}/staff/${staffId}`), active ? { active: true } : { active: false, removed_at: new Date().toISOString() });
}

/** Permanently erase a staff member from Firestore. */
export async function deleteStaff(staffId: string): Promise<void> {
  const bizId = bizOrThrow();
  const [{ getFirestoreDb }, fs] = await Promise.all([import('@/lib/firebase/config'), import('firebase/firestore')]);
  const db = getFirestoreDb();
  if (!db) throw new Error('not_configured');
  await fs.deleteDoc(fs.doc(db, `businesses/${bizId}/staff/${staffId}`));
}

/** Update permissions and role limits for a staff member. */
export async function updateStaffPermissions(staffId: string, permissions: StaffPermissions): Promise<void> {
  const bizId = bizOrThrow();
  const [{ getFirestoreDb }, fs] = await Promise.all([import('@/lib/firebase/config'), import('firebase/firestore')]);
  const db = getFirestoreDb();
  if (!db) throw new Error('not_configured');
  await fs.updateDoc(fs.doc(db, `businesses/${bizId}/staff/${staffId}`), {
    permissions: {
      can_discount: permissions.canDiscount ?? false,
      max_discount_pct: permissions.maxDiscountPct ?? 10,
      can_cancel_item: permissions.canCancelItem ?? false,
      can_change_table: permissions.canChangeTable ?? false,
      can_view_reports: permissions.canViewReports ?? false,
      can_access_cash_drawer: permissions.canAccessCashDrawer ?? false,
    },
  });
}

/** Update base monthly salary in paise for a staff member. */
export async function updateStaffSalary(staffId: string, monthlySalaryPaise: number): Promise<void> {
  const bizId = bizOrThrow();
  const [{ getFirestoreDb }, fs] = await Promise.all([import('@/lib/firebase/config'), import('firebase/firestore')]);
  const db = getFirestoreDb();
  if (!db) throw new Error('not_configured');
  await fs.updateDoc(fs.doc(db, `businesses/${bizId}/staff/${staffId}`), {
    monthly_salary_paise: Math.max(0, Math.round(monthlySalaryPaise)),
  });
}

export interface JoinCode {
  code: string;
  qr: string;
  expiresAt: string;
}

export function joinCodeMessage(error: string): string {
  if (error === 'signed_out') return tr('Sign in with the Google account again (Backup & Restore), then try again.');
  if (error === 'staff_removed') return tr('This staff member was removed. Add them back first.');
  if (error === 'bad_role') return tr('This role cannot sign in yet.');
  if (/network|fetch|Failed/i.test(error)) return tr('No internet connection. Connect to the internet and try again.');
  return tr('Could not make a code ({code}). Please try again.', { code: error });
}

/** A one-time join code (15 minutes) for one staff member. */
export async function createJoinCode(staffId: string, fetchImpl: typeof fetch = fetch): Promise<{ ok: true; code: JoinCode } | { ok: false; error: string }> {
  const account = getCloudAccount();
  if (!account || account.stub) return { ok: false, error: joinCodeMessage('signed_out') };
  let token = '';
  try {
    const { getFirebaseAuth } = await import('@/lib/firebase/config');
    const auth = getFirebaseAuth();
    if (auth) {
      await auth.authStateReady();
      if (auth.currentUser?.uid === account.uid) token = await auth.currentUser.getIdToken();
    }
  } catch (e) {
    reportError('staff', e, 'sign-in token not read');
  }
  if (!token) return { ok: false, error: joinCodeMessage('signed_out') };
  try {
    const res = await fetchImpl(STAFF_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'create_code', staff_id: staffId }),
    });
    const body = await res.json().catch(() => ({}));
    // A refusal answers { error, code: "<reason>" }; success { code: "123456", … }.
    if (!res.ok || !/^\d{6}$/.test(String(body?.code))) return { ok: false, error: joinCodeMessage(String(body?.code || res.status)) };
    return { ok: true, code: { code: String(body.code), qr: String(body.qr || `KPSTAFF:${body.code}`), expiresAt: String(body.expires_at || '') } };
  } catch (e: any) {
    return { ok: false, error: joinCodeMessage(String(e?.message || 'network')) };
  }
}
