'use client';

import { useEffect } from 'react';
import { getDesktopApi } from '@/lib/desktop/desktopBridge';
import { collectShopCounts } from '@/lib/admin/shopCounts';

const FIRST_MS = 30 * 1000;
const EVERY_MS = 30 * 60 * 1000;

/**
 * Hands the shop's counts (bills today / 7 days, items, customers, last bill) to the main
 * process, which sends them with the next hourly licence check-in for the Admin Console's
 * health view (v4.98.0). Out of the first page load and the busy counter (Bible §8.9): the
 * first count 30 s after opening, then every 30 min, each at an idle moment.
 */
export function ShopHealthReporter() {
  useEffect(() => {
    const api = getDesktopApi();
    if (!api?.reportHealth) return;
    let alive = true;
    const run = () => {
      const ric = (window as any).requestIdleCallback as ((cb: () => void, o?: { timeout: number }) => number) | undefined;
      const go = () => {
        void collectShopCounts()
          .then((counts) => (alive ? api.reportHealth?.(counts) : undefined))
          .catch(() => {});
      };
      if (ric) ric(go, { timeout: 10000 });
      else go();
    };
    const first = window.setTimeout(run, FIRST_MS);
    const every = window.setInterval(run, EVERY_MS);
    return () => {
      alive = false;
      window.clearTimeout(first);
      window.clearInterval(every);
    };
  }, []);

  return null;
}
