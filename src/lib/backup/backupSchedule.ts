/**
 * When should the automatic backup run? Pure, so the test suite can check it.
 *
 * The day's backup file is written once as the app opens (as before v4.82.0) and then
 * refreshed at most once an hour while the shop's data keeps changing — so a disk that
 * dies in the evening loses at most about an hour of bills, not the whole day.
 * Building a backup reads every table, so it waits until the counter has been left
 * alone for a moment; in a rush that never lets up it runs anyway once the file is
 * two hours old.
 */

export const REFRESH_EVERY_MS = 60 * 60 * 1000;
export const QUIET_FOR_MS = 30 * 1000;
export const MAX_WAIT_MS = 2 * REFRESH_EVERY_MS;

export type BackupDecision = 'backup' | 'no-changes' | 'too-soon' | 'counter-busy';

export function autoBackupDecision(s: {
  hasTodaysBackup: boolean;
  lastBackupAt: string | null;
  changedSinceBackup: boolean;
  msSinceLastInput: number;
  now: number;
}): BackupDecision {
  if (!s.hasTodaysBackup) return 'backup';
  if (!s.changedSinceBackup) return 'no-changes';
  const last = s.lastBackupAt ? Date.parse(s.lastBackupAt) : NaN;
  // A file "from the future" (the PC clock was put back) counts as old, never as fresh.
  const age = Number.isFinite(last) && last <= s.now ? s.now - last : Infinity;
  if (age < REFRESH_EVERY_MS) return 'too-soon';
  if (s.msSinceLastInput < QUIET_FOR_MS && age < MAX_WAIT_MS) return 'counter-busy';
  return 'backup';
}
