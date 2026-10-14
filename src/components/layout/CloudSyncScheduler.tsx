'use client';

import { useEffect } from 'react';
import { CLOUD_ACCOUNT_EVENT, getCloudAccount } from '@/lib/cloud/cloudAccount';
import { OUTBOX_EVENT, outboxSize, setOutboxRecording } from '@/lib/cloud/cloudOutbox';
import { CLOUD_STATUS_EVENT, cloudSendActive, deviceId, needsFullPush, sendToCloudNow, setCloudStatus } from '@/lib/cloud/cloudPush';
import { isRestaurantMode } from '@/lib/features/featureSwitches';

const FIRST_RUN_MS = 20 * 1000;
const CHECK_EVERY_MS = 60 * 1000;
/** A change made here goes up this soon after the counter is idle (not only on the minute). */
const SOON_MS = 5 * 1000;

/**
 * Cloud sync (Step 3 v4.85.0, Step 4 v4.86.0): while "Sync this shop with the cloud" is on
 * (Backup → Google Account) —
 * - notes every change (cloudOutbox) and sends what is waiting: 20 s after the app opens, a
 *   few seconds after a change, every minute, and as soon as the internet comes back;
 * - after the first sync, listens to the cloud (cloudPull.listenToCloud) so the phone's
 *   bills, items, stock and udhar show here within seconds.
 * Off = no notes, no listeners, no network. Never blocks the counter: sending is
 * single-flight and runs on idle; Firebase is loaded only when on.
 */
export function CloudSyncScheduler() {
  useEffect(() => {
    let stopListening: (() => void) | null = null;
    let listeningFor = '';
    // v4.140.0: running restaurant orders shared by the shop's devices (lib/restaurant/cloudOrders.ts).
    let stopRestaurant: (() => void) | null = null;
    let restaurantFor = '';
    let categoryBusy = false;
    let soon: number | undefined;

    const idle = (go: () => void) => {
      const ric = (window as any).requestIdleCallback as ((cb: () => void, o?: { timeout: number }) => number) | undefined;
      if (ric) ric(go, { timeout: 10000 });
      else go();
    };

    const syncRestaurant = async (want: string) => {
      const target = want && isRestaurantMode() ? want : '';
      if (target === restaurantFor) return;
      stopRestaurant?.();
      stopRestaurant = null;
      restaurantFor = target;
      if (!target) return;
      try {
        const [{ startRestaurantCloud }, { printKot }, { db }] = await Promise.all([
          import('@/lib/restaurant/cloudOrders'), import('@/lib/restaurant/kot'), import('@/lib/db'),
        ]);
        const stop = await startRestaurantCloud(target, deviceId(), {
          printKot: async (order) => {
            const biz = await db.businesses.toCollection().first();
            return (await printKot({ order, shopName: biz?.name, round: order.kotRounds + 1 })).ok;
          },
          onError: (e: any) => console.warn('Restaurant cloud notice:', e?.message),
        });
        if (restaurantFor === target) stopRestaurant = stop;
        else stop();
      } catch (e) {
        restaurantFor = '';
        console.warn('Restaurant cloud could not start:', e);
      }
    };

    const syncListeners = async () => {
      const account = getCloudAccount();
      const want = cloudSendActive() && account && !needsFullPush() ? account.bizId : '';
      void syncRestaurant(want);
      if (want === listeningFor) return;
      stopListening?.();
      stopListening = null;
      listeningFor = want;
      if (!want) return;
      try {
        const [{ listenToCloud }, { db }] = await Promise.all([import('@/lib/cloud/cloudPull'), import('@/lib/db')]);
        const local = await db.businesses.toCollection().first();
        if (!local || listeningFor !== want) return;
        stopListening = listenToCloud({ bizId: want, localBizId: local.id }, {
          onChange: () => setCloudStatus({ lastPulledAt: new Date().toISOString() }),
          onShop: (data) => {
            // v4.141.0: one shop, one category on every device (lib/cloud/shopCategory.ts).
            if (!categoryBusy) {
              categoryBusy = true;
              void (async () => {
                try {
                  const [{ syncShopCategory }, { getFirestoreDb }, { doc, setDoc }] = await Promise.all([
                    import('@/lib/cloud/shopCategory'), import('@/lib/firebase/config'), import('firebase/firestore'),
                  ]);
                  const fs = getFirestoreDb();
                  if (fs) await syncShopCategory(data, (fields) => setDoc(doc(fs, 'businesses', want), fields, { merge: true }));
                } catch (e: any) {
                  console.warn('Shop category sync notice:', e?.message);
                } finally {
                  categoryBusy = false;
                }
              })();
            }
            // The Admin Console's switch, as on the phone.
            window.dispatchEvent(data.account_disabled === true ? new CustomEvent('account_frozen', { detail: { message: 'Your store has been blocked by the platform administrator.' } }) : new Event('account_unfrozen'));
          },
          onError: (e) => console.warn('Cloud listen notice:', e?.message),
        });
      } catch (e) {
        listeningFor = '';
        console.warn('Cloud listen could not start:', e);
      }
    };

    const tick = () => {
      setOutboxRecording(cloudSendActive());
      void syncListeners();
      if (!cloudSendActive() || (outboxSize() === 0 && !needsFullPush())) return;
      idle(() => {
        void sendToCloudNow().then(() => syncListeners());
      });
    };

    // A write noted in the outbox: send it a few seconds later (debounced).
    const onLocalChange = () => {
      if (!cloudSendActive()) return;
      window.clearTimeout(soon);
      soon = window.setTimeout(tick, SOON_MS);
    };

    // Flush outbox immediately when closing or hiding window (beforeunload / visibilitychange)
    const onFlushNow = () => {
      if (cloudSendActive() && (outboxSize() > 0 || needsFullPush())) {
        void sendToCloudNow().catch(() => {});
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        onFlushNow();
      }
    };
    window.addEventListener('beforeunload', onFlushNow);
    document.addEventListener('visibilitychange', onVisibilityChange);
    const unhookIpc = (window as any).kamaiDesktop?.onFlushOutbox?.(() => onFlushNow());

    setOutboxRecording(cloudSendActive());
    const first = window.setTimeout(tick, FIRST_RUN_MS);
    const every = window.setInterval(tick, CHECK_EVERY_MS);
    window.addEventListener('online', tick);
    window.addEventListener(CLOUD_ACCOUNT_EVENT, tick);
    const applyRecording = () => setOutboxRecording(cloudSendActive());
    window.addEventListener(CLOUD_STATUS_EVENT, applyRecording);
    window.addEventListener(OUTBOX_EVENT, onLocalChange);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(soon);
      window.clearInterval(every);
      window.removeEventListener('online', tick);
      window.removeEventListener(CLOUD_ACCOUNT_EVENT, tick);
      window.removeEventListener(CLOUD_STATUS_EVENT, applyRecording);
      window.removeEventListener(OUTBOX_EVENT, onLocalChange);
      window.removeEventListener('beforeunload', onFlushNow);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      unhookIpc?.();
      stopListening?.();
    };
  }, []);

  return null;
}
