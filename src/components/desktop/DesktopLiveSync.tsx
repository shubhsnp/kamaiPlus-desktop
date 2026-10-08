'use client';

import { useEffect } from 'react';
import { startDesktopLiveListener } from '@/lib/desktop/desktopLiveListener';

/**
 * ⚡ DesktopLiveSync Component
 *
 * Runs the Firestore Realtime Listener for instant (~1s) Admin Console synchronization:
 * - Remote wipe and reset
 * - PC lock and maintenance mode
 * - Feature switches
 * - Remote restart and updates
 * - Admin broadcasts and popup alerts
 *
 * Mounted in RootLayout so it remains active across all app states (active, expired, locked).
 */
export function DesktopLiveSync() {
  useEffect(() => {
    return startDesktopLiveListener();
  }, []);

  return null;
}
