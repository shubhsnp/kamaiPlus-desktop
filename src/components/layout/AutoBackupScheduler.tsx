'use client';

import { useEffect } from 'react';
import { runAutoBackup } from '@/lib/backup/autoBackup';

const FIRST_RUN_MS = 2 * 60 * 1000;
const CHECK_EVERY_MS = 30 * 60 * 1000;

/**
 * Takes the day's automatic backup: 2 minutes after the app opens (so it never
 * competes with the first bill), then re-checks every 30 minutes so a PC left on
 * overnight still backs up the new day. Only one backup per calendar day is
 * written; the check itself is a cheap folder listing in the main process.
 */
export function AutoBackupScheduler() {
  useEffect(() => {
    const run = () => {
      const ric = (window as any).requestIdleCallback as ((cb: () => void, o?: { timeout: number }) => number) | undefined;
      const go = () => { void runAutoBackup(); };
      if (ric) ric(go, { timeout: 10000 });
      else go();
    };
    const first = window.setTimeout(run, FIRST_RUN_MS);
    const every = window.setInterval(run, CHECK_EVERY_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
    };
  }, []);

  return null;
}
