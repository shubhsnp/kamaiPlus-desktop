import { createFullBackupPayload } from '@/lib/backup/cloudBackupService';
import { clearDataChanged, dataChangedSinceBackup, markDataChanged } from '@/lib/backup/backupChanges';
import { autoBackupDecision } from '@/lib/backup/backupSchedule';
import { BackupWriteResult, getDesktopApi } from '@/lib/desktop/desktopBridge';

/**
 * Automatic backup. Cloud sync is off in the desktop app, so this file on the shop's
 * own disk (plus an optional pen-drive copy) is what saves them from a dead computer.
 * The page builds the same JSON as "Export Full Backup"; the main process (backup.js)
 * writes it to Documents/KamaiPlus/Backups — one file per day, refreshed at most hourly
 * while data changes (backupSchedule.ts) — and keeps 30 days.
 */

export type AutoBackupOutcome =
  | { status: 'saved'; result: BackupWriteResult }
  | { status: 'skipped'; reason: 'not-desktop' | 'no-changes' | 'too-soon' | 'counter-busy' | 'empty-shop' | 'busy' }
  | { status: 'failed'; error: string };

let running: Promise<AutoBackupOutcome> | null = null;

/**
 * `force` (Backup Now, the safety copy before a restore) writes regardless of the schedule.
 * `msSinceLastInput` is how long the counter has been left alone (the scheduler tracks it).
 */
export function runAutoBackup(opts: { force?: boolean; msSinceLastInput?: number } = {}): Promise<AutoBackupOutcome> {
  if (running) return Promise.resolve({ status: 'skipped', reason: 'busy' });
  running = doBackup(Boolean(opts.force), opts.msSinceLastInput ?? Infinity).finally(() => {
    running = null;
  });
  return running;
}

async function doBackup(force: boolean, msSinceLastInput: number): Promise<AutoBackupOutcome> {
  const api = getDesktopApi();
  if (!api) return { status: 'skipped', reason: 'not-desktop' };
  try {
    if (!force) {
      const info = await api.getBackupInfo();
      const decision = autoBackupDecision({
        hasTodaysBackup: info.hasTodaysBackup,
        lastBackupAt: info.lastBackupAt,
        changedSinceBackup: dataChangedSinceBackup(),
        msSinceLastInput,
        now: Date.now(),
      });
      if (decision !== 'backup') return { status: 'skipped', reason: decision };
    }
    // Cleared before reading: a bill saved while the backup is being built marks it
    // again, so the next hourly run picks it up.
    clearDataChanged();
    const payload = await createFullBackupPayload();
    if (!payload.businesses?.length) {
      markDataChanged();
      return { status: 'skipped', reason: 'empty-shop' };
    }

    const result = await api.writeBackup({
      json: JSON.stringify(payload),
      shopName: payload.metadata.business_name,
    });
    if (!result.ok) {
      markDataChanged();
      return { status: 'failed', error: result.error || 'Backup failed.' };
    }

    try {
      localStorage.setItem('kamai_last_backup_time', new Date().toISOString());
      localStorage.setItem('kamai_last_backup_type', 'auto_local');
    } catch {}
    window.dispatchEvent(new Event('auto_backup_saved'));
    return { status: 'saved', result };
  } catch (err: any) {
    markDataChanged();
    return { status: 'failed', error: err?.message || 'Backup failed.' };
  }
}
