'use client';

import { useEffect } from 'react';
import { runAutoBackup } from '@/lib/backup/autoBackup';

const FIRST_RUN_MS = 2 * 60 * 1000;
const CHECK_EVERY_MS = 5 * 60 * 1000;

/**
 * Keeps the automatic backup fresh: the first run 2 minutes after the app opens (so it
 * never competes with the first bill), then a check every 5 minutes. autoBackup.ts
 * decides (backupSchedule.ts): the day's file is written once, then refreshed at most
 * hourly while data changes and the counter is free. A PC left on overnight still backs
 * up the new day. The check itself is a cheap folder listing in the main process.
 */
export function AutoBackupScheduler() {
  useEffect(() => {
    // A key (the barcode gun types keys too) or a click means someone is at the counter.
    let lastInputAt = 0;
    const onInput = () => {
      lastInputAt = Date.now();
    };
    window.addEventListener('keydown', onInput, { capture: true, passive: true });
    window.addEventListener('pointerdown', onInput, { capture: true, passive: true });

    const run = () => {
      const ric = (window as any).requestIdleCallback as ((cb: () => void, o?: { timeout: number }) => number) | undefined;
      const go = () => { void runAutoBackup({ msSinceLastInput: Date.now() - lastInputAt }); };
      if (ric) ric(go, { timeout: 10000 });
      else go();
    };
    const first = window.setTimeout(run, FIRST_RUN_MS);
    const every = window.setInterval(run, CHECK_EVERY_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
      window.removeEventListener('keydown', onInput, { capture: true });
      window.removeEventListener('pointerdown', onInput, { capture: true });
    };
  }, []);

  return null;
}
