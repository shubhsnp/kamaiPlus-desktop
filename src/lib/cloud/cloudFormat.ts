/**
 * The shared rules of the cloud data contract (docs/CLOUD_DATA_CONTRACT.md §1) and the
 * generic Dexie row <-> Firestore document mapper that cloudContract.ts drives with one
 * spec per table. Pure: no Firebase, no Dexie — the test suite runs it directly.
 */

/** R9 — paid-plan / kill-switch fields. No app ever writes them; they never come into Dexie. */
export const PRO_FIELDS: ReadonlySet<string> = new Set([
  'is_pro', 'pro_plan', 'pro_expiry', 'pro_activated_at', 'pro_granted_by',
  'subscription_tier', 'subscription_expires_at', 'subscription_valid_until',
  'razorpay_payment_id', 'coupon_code_used', 'account_disabled',
]);

/** Server / telemetry times written with serverTimestamp() — never copied into Dexie. */
const SERVER_KEYS: ReadonlySet<string> = new Set(['synced_at', 'last_synced_at', 'lastSyncedAt']);

export interface FieldSpec {
  /** Dexie field in paise → `<field>_paise` in the cloud (R2). */
  money?: string[];
  /** Dexie field → cloud field, for everything else that is named differently. */
  rename?: Record<string, string>;
  /** Stays on this computer: never sent, never overwritten from the cloud (R10). */
  local?: string[];
  /** Dexie fields a table hook writes itself (left out of the generic copy out). */
  custom?: string[];
  /** Cloud keys a table hook reads itself, or that are other apps' copies (left out of the copy in). */
  ignoreIn?: string[];
  /** Booleans: `1` / `0` from older writers read as true / false (R5). */
  bools?: string[];
  /** ISO 8601 UTC both ways (R3). */
  dates?: string[];
}

/** Firestore Timestamp (or its plain {seconds, nanoseconds} copy), ms, or a date string → ISO UTC. */
export function toIsoUtc(value: unknown): unknown {
  if (value === null || value === undefined || value === '') return value;
  if (typeof value === 'object') {
    const v = value as { toDate?: () => Date; seconds?: number; nanoseconds?: number };
    if (typeof v.toDate === 'function') return v.toDate().toISOString();
    if (typeof v.seconds === 'number') return new Date(v.seconds * 1000 + Math.round((v.nanoseconds || 0) / 1e6)).toISOString();
    return value;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? new Date(value).toISOString() : value;
  if (typeof value === 'string') {
    // A bare local time ("2026-09-30T18:00:00.000", Android before the contract) is read as this
    // computer's local time — the same clock the bill was made on.
    const t = Date.parse(value);
    return Number.isFinite(t) && /^\d{4}-\d{2}-\d{2}T/.test(value) ? new Date(t).toISOString() : value;
  }
  return value;
}

function looksLikeTimestamp(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const v = value as { toDate?: unknown; seconds?: unknown; nanoseconds?: unknown };
  return typeof v.toDate === 'function' || (typeof v.seconds === 'number' && typeof v.nanoseconds === 'number');
}

export function toBool(value: unknown): unknown {
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return value;
}

/** Whole paise from whatever number arrived (a float from an older writer is rounded). */
export function paiseInt(value: unknown): number | undefined {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : undefined;
}

/** Dexie row (or nested object) → cloud document, by a field spec. `undefined` never goes out. */
export function specToCloud(spec: FieldSpec, row: Record<string, any>): Record<string, any> {
  const skip = new Set([...(spec.local || []), ...(spec.custom || []), 'sync_status']);
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === undefined || skip.has(key) || PRO_FIELDS.has(key)) continue;
    if (spec.money?.includes(key)) out[spec.rename?.[key] ?? `${key}_paise`] = paiseInt(value) ?? value;
    else if (spec.rename?.[key]) out[spec.rename[key]] = value;
    else if (spec.dates?.includes(key)) out[key] = toIsoUtc(value);
    else out[key] = value;
  }
  return out;
}

/**
 * Cloud document → Dexie row, merged over what this computer already has (R7): a key the
 * document does not carry keeps the local value; a key it carries wins. Fields another app
 * owns (Android's batch_number, credit_limit_paise…) ride along untouched so a later save
 * from this computer sends them back unchanged. An old copy of a renamed field (Android's
 * `current_stock` next to `stock_quantity`) is never read — only the contract name counts.
 */
export function specFromCloud(spec: FieldSpec, doc: Record<string, any>, local?: Record<string, any> | null): Record<string, any> {
  const inverse: Record<string, string> = {};
  for (const f of spec.money || []) inverse[spec.rename?.[f] ?? `${f}_paise`] = f;
  for (const [f, c] of Object.entries(spec.rename || {})) inverse[c] = f;
  const renamedDexieNames = new Set(Object.values(inverse).filter((f) => !(f in inverse)));
  const skip = new Set([...(spec.local || []), ...(spec.ignoreIn || []), 'sync_status']);

  const row: Record<string, any> = { ...(local || {}) };
  for (const [key, raw] of Object.entries(doc)) {
    if (raw === undefined || PRO_FIELDS.has(key) || SERVER_KEYS.has(key) || skip.has(key)) continue;
    const field = inverse[key];
    if (field) {
      if (skip.has(field)) continue;
      row[field] = spec.money?.includes(field) ? paiseInt(raw) ?? raw : raw;
    } else if (!renamedDexieNames.has(key)) {
      row[key] = raw;
    }
  }
  for (const f of spec.bools || []) if (f in row) row[f] = toBool(row[f]);
  for (const f of spec.dates || []) if (f in row) row[f] = toIsoUtc(row[f]);
  for (const [key, value] of Object.entries(row)) if (looksLikeTimestamp(value)) row[key] = toIsoUtc(value);
  return row;
}
