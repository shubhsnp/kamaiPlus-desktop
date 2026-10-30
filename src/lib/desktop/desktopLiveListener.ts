import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { getFirestoreDb } from '@/lib/firebase/config';
import { getDesktopApi } from '@/lib/desktop/desktopBridge';
import { reportError } from '@/lib/diagnostics/errorReporter';

/**
 * ⚡ KamaiPlus Desktop Realtime Listener (1-Second Instant Live Sync)
 *
 * Listens to lightweight timestamp signals from Firestore:
 * - `desktop_signals/{licenceKey}`: for shop-specific remote commands (wipe_and_reset,
 *   restart_app, backup_now, lock_pc, mode changes, feature switches, admin messages).
 * - `desktop_signals/global`: for broadcast messages, emergency maintenance, or platform updates.
 *
 * When an Admin triggers any action in the Admin Console, Firestore pushes the signal in
 * < 500ms. The listener immediately calls `refreshLicence()`, fetching the authentic,
 * Ed25519-signed control and commands payload from the Cloud Function.
 *
 * Invariants:
 * - Zero security compromise: commands are NEVER executed from the unverified signal doc;
 *   they are ALWAYS cryptographically validated via the private-key signed Cloud Function.
 * - Free tier friendly: 1 idle listener read on startup, 0 reads while quiet.
 * - Silent offline resilience: if the internet drops, billing continues at 0ms latency
 *   without popups or interruptions.
 */

let activeKeyUnsub: Unsubscribe | null = null;
let globalUnsub: Unsubscribe | null = null;
let offLicenceChanged: (() => void) | null = null;
let currentKey: string | null = null;
let lastSeenPing = 0;
let isRefreshing = false;
let pendingRefresh = false;
let isFirstKeySnap = true;
let isFirstGlobalSnap = true;

async function triggerLiveRefresh(reason: string): Promise<void> {
  const api = getDesktopApi();
  if (!api?.refreshLicence) return;

  if (isRefreshing) {
    pendingRefresh = true;
    return;
  }

  isRefreshing = true;
  try {
    await api.refreshLicence();
  } catch (err: any) {
    console.warn('[DesktopLive] Refresh error:', err?.message || err);
  } finally {
    isRefreshing = false;
    if (pendingRefresh) {
      pendingRefresh = false;
      void triggerLiveRefresh('queued');
    }
  }
}

function handleSignal(ping: number, reason: string, isFirstSnap: boolean): boolean {
  if (isFirstSnap) {
    lastSeenPing = Math.max(lastSeenPing, ping);
    if (reason === 'wipe_and_reset' || reason.includes('wipe')) {
      void triggerLiveRefresh(reason);
      return true;
    }
    return false;
  }
  if (ping > lastSeenPing) {
    lastSeenPing = ping;
    void triggerLiveRefresh(reason);
    return true;
  }
  return false;
}

export function startDesktopLiveListener(): () => void {
  if (typeof window === 'undefined') return () => {};

  const api = getDesktopApi();
  if (!api?.refreshLicence) {
    // Plain browser dev mode or non-electron environment: no main process to notify.
    return () => {};
  }

  let stopped = false;

  const attach = async () => {
    if (stopped) return;
    const db = getFirestoreDb();
    if (!db) {
      // Retry in 2s if Firebase config is still initializing
      window.setTimeout(attach, 2000);
      return;
    }

    // 1. Global listener (platform broadcasts, emergency locks)
    if (!globalUnsub) {
      isFirstGlobalSnap = true;
      globalUnsub = onSnapshot(
        doc(db, 'desktop_signals', 'global'),
        (snap) => {
          if (!snap.exists()) return;
          const data = snap.data();
          const ping = typeof data?.ping === 'number' ? data.ping : 0;
          const reason = String(data?.reason || 'global_broadcast');
          handleSignal(ping, reason, isFirstGlobalSnap);
          isFirstGlobalSnap = false;
        },
        (err) => {
          // Silent notice on network/permission issues
          console.warn('[DesktopLive] Global signal notice:', err?.message);
        }
      );
    }

    // 2. Helper to bind key-specific signal
    const bindKey = (key: string | undefined | null) => {
      const clean = (key || '').trim().toUpperCase();
      if (!clean || clean === currentKey) return;
      currentKey = clean;
      activeKeyUnsub?.();
      isFirstKeySnap = true;

      activeKeyUnsub = onSnapshot(
        doc(db, 'desktop_signals', clean),
        (snap) => {
          if (!snap.exists()) return;
          const data = snap.data();
          const ping = typeof data?.ping === 'number' ? data.ping : 0;
          const reason = String(data?.reason || 'admin_command');
          handleSignal(ping, reason, isFirstKeySnap);
          isFirstKeySnap = false;
        },
        (err) => {
          console.warn('[DesktopLive] Key signal notice:', err?.message);
        }
      );
    };

    // Initial licence status check
    try {
      const status = await api.getLicenceStatus();
      if (status && 'key' in status && status.key) {
        bindKey(status.key);
        void triggerLiveRefresh('startup');
      }
    } catch (e) {
      reportError('admin-live', e, 'listener not started');
    }

    // Listen for licence changes (key activation, key renewal, machine reset)
    offLicenceChanged = api.onLicenceChanged?.((status) => {
      if (status && 'key' in status && status.key) {
        bindKey(status.key);
      }
    }) || null;
  };

  void attach();

  return () => {
    stopped = true;
    activeKeyUnsub?.();
    globalUnsub?.();
    offLicenceChanged?.();
    activeKeyUnsub = null;
    globalUnsub = null;
    offLicenceChanged = null;
    currentKey = null;
  };
}
