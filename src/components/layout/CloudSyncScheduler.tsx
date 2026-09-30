'use client';

import { useEffect } from 'react';
import { CLOUD_ACCOUNT_EVENT } from '@/lib/cloud/cloudAccount';
import { outboxSize, setOutboxRecording } from '@/lib/cloud/cloudOutbox';
import { CLOUD_STATUS_EVENT, cloudSendActive, needsFullPush, sendToCloudNow } from '@/lib/cloud/cloudPush';

const FIRST_RUN_MS = 20 * 1000;
const CHECK_EVERY_MS = 60 * 1000;

/**
 * Step 3 (v4.85.0): while "Send this shop to the cloud" is on (Backup → Google Account),
 * notes every change (cloudOutbox) and sends what is waiting — 20 s after the app opens,
 * then every minute on idle, and again as soon as the internet comes back. Off = no notes,
 * no network. Never blocks the counter: cloudPush is single-flight and runs on idle.
 */
export function CloudSyncScheduler() {
  useEffect(() => {
    const applyRecording = () => setOutboxRecording(cloudSendActive());
    applyRecording();

    const tick = () => {
      applyRecording();
      if (!cloudSendActive() || (outboxSize() === 0 && !needsFullPush())) return;
      const ric = (window as any).requestIdleCallback as ((cb: () => void, o?: { timeout: number }) => number) | undefined;
      const go = () => { void sendToCloudNow(); };
      if (ric) ric(go, { timeout: 10000 });
      else go();
    };
    const first = window.setTimeout(tick, FIRST_RUN_MS);
    const every = window.setInterval(tick, CHECK_EVERY_MS);
    window.addEventListener('online', tick);
    window.addEventListener(CLOUD_ACCOUNT_EVENT, applyRecording);
    window.addEventListener(CLOUD_STATUS_EVENT, applyRecording);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
      window.removeEventListener('online', tick);
      window.removeEventListener(CLOUD_ACCOUNT_EVENT, applyRecording);
      window.removeEventListener(CLOUD_STATUS_EVENT, applyRecording);
    };
  }, []);

  return null;
}
