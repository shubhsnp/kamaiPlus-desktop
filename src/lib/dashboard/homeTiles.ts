/*
 * Home screen tiles (v4.78.0). The tiles are built from a list, so a screen switched off in
 * Settings → Features does not leave a hole: its tile is swapped for one that does the same
 * job without that screen, and the rows re-flow to stay full.
 */

import type { FeatureSwitches } from '@/lib/features/featureSwitches';
import { NEW_BILL_HREF } from '@/lib/ui/globalShortcuts';

/** Tiles that open a window on Home instead of going to a page. */
export type HomeAction = 'fast_inward' | 'printers' | 'day_summary';

export type QuickActionId = 'new_bill' | 'khata' | 'stock_inward' | 'fast_inward' | 'day_summary' | 'printers';

export interface QuickActionSpec {
  id: QuickActionId;
  href?: string;
  action?: HomeAction;
}

/**
 * Quick Actions row: New bill, Khata, stock inward (or its stand-in), Day summary, Printers.
 * Khata switched off (v4.81.0): its tile goes and the others grow into the room.
 * Inventory AND purchases off (v4.107.0, e.g. Restaurant mode): no stock comes in, so no inward tile.
 */
export function quickActionsFor(switches: Pick<FeatureSwitches, 'purchases'> & Partial<Pick<FeatureSwitches, 'khata' | 'inventory'>>): QuickActionSpec[] {
  const tiles: (QuickActionSpec | null)[] = [
    { id: 'new_bill', href: NEW_BILL_HREF },
    switches.khata === false ? null : { id: 'khata', href: '/khata' },
    // Purchases off: stock still comes in — by scanning it in, right here on Home.
    switches.purchases ? { id: 'stock_inward', href: '/purchases' } : switches.inventory === false ? null : { id: 'fast_inward', action: 'fast_inward' },
    { id: 'day_summary', action: 'day_summary' },
    { id: 'printers', action: 'printers' },
  ];
  return tiles.filter((t): t is QuickActionSpec => t !== null);
}

/** GST Reports off: the CA / Tally exports still live in Settings → Data Backup & Tax Reports. */
export const GST_STAND_IN_HREF = '/settings?tab=data';

/**
 * "Today's Profit" means something only when buying prices exist: the cost-price field is on,
 * some item has a buying price, or today's sales carried one. Otherwise the card shows the
 * average bill instead of a profit that is always ₹0.
 */
export function showProfitCard(input: { costPriceOn: boolean; anyProductHasCost: boolean; costedRevenuePaise?: number }): boolean {
  return input.costPriceOn || input.anyProductHasCost || (input.costedRevenuePaise || 0) > 0;
}

/** Average and biggest bill of the day (paise, whole paise). */
export function billStats(billTotalsPaise: number[]): { averagePaise: number; biggestPaise: number } {
  const bills = billTotalsPaise.filter((n) => Number.isFinite(n));
  if (!bills.length) return { averagePaise: 0, biggestPaise: 0 };
  const sum = bills.reduce((a, n) => a + n, 0);
  return { averagePaise: Math.round(sum / bills.length), biggestPaise: Math.max(...bills) };
}
