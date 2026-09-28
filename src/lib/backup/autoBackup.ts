import { createFullBackupPayload } from '@/lib/backup/cloudBackupService';
import { BackupWriteResult, getDesktopApi } from '@/lib/desktop/desktopBridge';

/**
 * Daily automatic backup. Cloud sync is off in the desktop app, so this file on
 * the shop's own disk (plus an optional pen-drive copy) is what saves them from a
 * dead computer. The page builds the same JSON as "Export Full Backup"; the main
 * process (backup.js) writes it to Documents/KamaiPlus/Backups and keeps 30 days.
 */

export type AutoBackupOutcome =
  | { status: 'saved'; result: BackupWriteResult }
  | { status: 'skipped'; reason: 'not-desktop' | 'already-today' | 'empty-shop' | 'busy' }
  | { status: 'failed'; error: string };

let running: Promise<AutoBackupOutcome> | null = null;

export function runAutoBackup(opts: { force?: boolean } = {}): Promise<AutoBackupOutcome> {
  if (running) return Promise.resolve({ status: 'skipped', reason: 'busy' });
  running = doBackup(Boolean(opts.force)).finally(() => {
    running = null;
  });
  return running;
}

async function doBackup(force: boolean): Promise<AutoBackupOutcome> {
  const api = getDesktopApi();
  if (!api) return { status: 'skipped', reason: 'not-desktop' };
  try {
    if (!force) {
      const info = await api.getBackupInfo();
      if (info.hasTodaysBackup) return { status: 'skipped', reason: 'already-today' };
    }
    const payload = await createFullBackupPayload();
    if (!payload.businesses?.length) return { status: 'skipped', reason: 'empty-shop' };

    const result = await api.writeBackup({
      json: JSON.stringify(payload),
      shopName: payload.metadata.business_name,
    });
    if (!result.ok) return { status: 'failed', error: result.error || 'Backup failed.' };

    try {
      localStorage.setItem('kamai_last_backup_time', new Date().toISOString());
      localStorage.setItem('kamai_last_backup_type', 'auto_local');
    } catch {}
    window.dispatchEvent(new Event('auto_backup_saved'));
    return { status: 'saved', result };
  } catch (err: any) {
    return { status: 'failed', error: err?.message || 'Backup failed.' };
  }
}
