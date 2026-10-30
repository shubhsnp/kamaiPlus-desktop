// Local database backup (JSON snapshot) and restore for KamaiPlus.
import { db } from '@/lib/db';
import { tr } from '@/lib/i18n/core';
import { FEATURE_SWITCHES_EVENT, FEATURE_SWITCHES_KEY, parseFeatureSwitches } from '@/lib/features/featureSwitches';
import { getLabelSettings, parseLabelSettings, saveLabelSettings } from '@/lib/labels/labelSettings';
import { reportError } from '@/lib/diagnostics/errorReporter';

/** Every table of the shop's database, in restore order. */
export const BACKUP_TABLES = [
  'businesses', 'categories', 'products', 'customers', 'suppliers', 'sales', 'cash_registers', 'cash_expenses',
  'sales_returns', 'inventory_movements', 'ledger_transactions', 'purchase_bills', 'marketing_templates', 'audit_logs',
] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

/** Tables older backups do not carry (purchase bills before v4.46.0, the last two before v4.78.0). */
const OPTIONAL_TABLES = new Set<BackupTable>(['purchase_bills', 'marketing_templates', 'audit_logs']);

export interface BackupMetadata {
  version: string;
  created_at: string;
  business_name: string;
  business_gstin?: string;
  counts: Partial<Record<BackupTable, number>>;
  _integrityHash?: string;
}

/** Shop choices kept per computer that a new computer needs too (v4.78.0). */
export interface BackupSettings {
  feature_switches?: Record<string, boolean>;
  /** Label size and what the label shows — not the printer (that belongs to the computer). */
  label_settings?: Record<string, unknown>;
}

export type FullBackupPayload = { metadata: BackupMetadata; settings?: BackupSettings } & { [K in BackupTable]?: any[] };

export function computeBackupIntegrityHash(data: Record<string, unknown>): string {
  try {
    const cryptoMod = typeof require === 'function' ? require('crypto') : null;
    if (cryptoMod && typeof cryptoMod.createHash === 'function') {
      const hash = cryptoMod.createHash('sha256');
      for (const t of BACKUP_TABLES) {
        if (Array.isArray(data[t])) {
          hash.update(`${t}:${JSON.stringify(data[t])};`);
        }
      }
      return hash.digest('hex');
    }
  } catch {}
  return '';
}

/** The whole database as one JSON-able object. */
export async function createFullBackupPayload(): Promise<FullBackupPayload> {
  const rows = await Promise.all(BACKUP_TABLES.map((t) => db.table(t).toArray()));
  const payload: FullBackupPayload = { metadata: { version: '2.1.0', created_at: new Date().toISOString(), business_name: 'My Store', counts: {} } };
  BACKUP_TABLES.forEach((t, i) => {
    payload[t] = rows[i];
    payload.metadata.counts[t] = rows[i].length;
  });
  const biz = rows[0][0];
  payload.metadata.business_name = biz?.name || 'My Store';
  payload.metadata.business_gstin = biz?.gstin || undefined;
  try {
    const { printer: _printer, ...label } = getLabelSettings();
    payload.settings = { feature_switches: parseFeatureSwitches(localStorage.getItem(FEATURE_SWITCHES_KEY)), label_settings: label };
  } catch (e) {
    reportError('backup', e, 'settings left out of the backup');
  }
  const hash = computeBackupIntegrityHash(payload as unknown as Record<string, unknown>);
  if (hash) payload.metadata._integrityHash = hash;
  return payload;
}

export function backupFileName(shopName: string, date = new Date()): string {
  const safe = (shopName || 'Store').replace(/[^a-zA-Z0-9]/g, '_');
  return `KamaiPlus_Backup_${safe}_${date.toISOString().split('T')[0]}.json`;
}

/** Download the backup as a dated JSON file (a Save dialog in the desktop app). */
export async function downloadBackupJSON(): Promise<string> {
  const payload = await createFullBackupPayload();
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const filename = backupFileName(payload.metadata.business_name);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  try {
    localStorage.setItem('kamai_last_backup_time', new Date().toISOString());
    localStorage.setItem('kamai_last_backup_type', 'local_file');
  } catch {}
  return filename;
}

export type BackupCheck =
  | { ok: true; payload: FullBackupPayload; counts: Record<BackupTable, number>; shopName: string; createdAt: string }
  | { ok: false; error: string };

/**
 * Is this a KamaiPlus backup that can be restored? Every table in it must be a list of
 * records with an id (a damaged or foreign file is refused before anything is touched).
 * Counts come from the file's own lists, not from what its header claims.
 */
export function checkBackupPayload(json: unknown): BackupCheck {
  const bad = (error: string): BackupCheck => ({ ok: false, error });
  if (!json || typeof json !== 'object' || Array.isArray(json)) return bad(tr('This is not a KamaiPlus backup file.'));
  const data = json as Record<string, unknown>;
  const meta = data.metadata as Record<string, unknown> | undefined;
  if (!meta || typeof meta !== 'object' || !Array.isArray(data.products) || !Array.isArray(data.sales)) return bad(tr('This is not a KamaiPlus backup file.'));

  // If tamper-evident hash is present, verify file integrity. Older backups without hash are accepted normally.
  const integrityHash = (meta as Record<string, unknown>)?._integrityHash;
  if (typeof integrityHash === 'string' && integrityHash.length > 0) {
    const expected = computeBackupIntegrityHash(data);
    if (expected && integrityHash !== expected) {
      return bad(tr('Backup integrity verification failed: the file has been modified or corrupted.'));
    }
  }

  const counts = {} as Record<BackupTable, number>;
  for (const t of BACKUP_TABLES) {
    const list = data[t];
    if (list === undefined && OPTIONAL_TABLES.has(t)) {
      counts[t] = 0;
      continue;
    }
    if (!Array.isArray(list)) return bad(tr('The backup file is damaged ({table} missing).', { table: t }));
    if (list.some((r) => !r || typeof r !== 'object' || typeof (r as { id?: unknown }).id !== 'string' || !(r as { id: string }).id)) {
      return bad(tr('The backup file is damaged ({table}: a record without an id).', { table: t }));
    }
    counts[t] = list.length;
  }
  const businesses = data.businesses as { name?: string }[];
  return {
    ok: true,
    payload: data as FullBackupPayload,
    counts,
    shopName: String(meta.business_name || businesses[0]?.name || ''),
    createdAt: String(meta.created_at || ''),
  };
}

/**
 * Restore in ONE transaction — if any record fails, nothing changes (v4.78.0; before,
 * "Clean Replace" emptied every table first and a failure left the shop with half its data).
 *   clean — the database becomes exactly the backup (and its feature / label choices)
 *   merge — only records the shop does not have yet are added; nothing saved here is
 *           overwritten (before, "merge" put old balances, stock and prices back) and the
 *           shop profile is kept
 */
export async function restoreDatabaseFromPayload(
  payload: FullBackupPayload,
  mode: 'clean' | 'merge' = 'clean'
): Promise<{ success: boolean; message: string; added: Partial<Record<BackupTable, number>> }> {
  const check = checkBackupPayload(payload);
  if (!check.ok) throw new Error(check.error);
  const added: Partial<Record<BackupTable, number>> = {};

  await db.transaction('rw', BACKUP_TABLES.map((t) => db.table(t)), async () => {
    for (const t of BACKUP_TABLES) {
      const list = payload[t];
      const table = db.table(t);
      if (mode === 'clean') {
        // A table an older backup does not carry is left as it is.
        if (list === undefined && OPTIONAL_TABLES.has(t)) continue;
        await table.clear();
        if (list?.length) await table.bulkPut(list);
        added[t] = list?.length || 0;
      } else {
        if (t === 'businesses' || !list?.length) continue;
        const have = new Set((await table.toCollection().primaryKeys()).map(String));
        const fresh = list.filter((r) => !have.has(String(r.id)));
        if (fresh.length) await table.bulkAdd(fresh);
        added[t] = fresh.length;
      }
    }
  });

  if (mode === 'clean') applyBackupSettings(payload.settings);
  try {
    localStorage.setItem('kamai_last_restore_time', new Date().toISOString());
  } catch {}

  const message = mode === 'clean'
    ? tr('Restored {v1} products, {v2} customers, and {v3} sales successfully!', { v1: added.products || 0, v2: added.customers || 0, v3: added.sales || 0 })
    : tr('Added {v1} products, {v2} customers and {v3} bills that were missing. Nothing already here was changed.', { v1: added.products || 0, v2: added.customers || 0, v3: added.sales || 0 });
  return { success: true, message, added };
}

/** Feature switches and label setup from a backup (the label printer stays this computer's). */
function applyBackupSettings(settings?: BackupSettings) {
  if (!settings || typeof window === 'undefined') return;
  try {
    if (settings.feature_switches && typeof settings.feature_switches === 'object') {
      localStorage.setItem(FEATURE_SWITCHES_KEY, JSON.stringify(parseFeatureSwitches(JSON.stringify(settings.feature_switches))));
      window.dispatchEvent(new Event(FEATURE_SWITCHES_EVENT));
    }
    if (settings.label_settings && typeof settings.label_settings === 'object') {
      const printer = getLabelSettings().printer;
      saveLabelSettings({ ...parseLabelSettings(JSON.stringify(settings.label_settings)), printer });
    }
  } catch (e) {
    reportError('backup', e, 'settings from the backup not applied');
  }
}
