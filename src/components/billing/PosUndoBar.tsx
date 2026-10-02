'use client';

import React, { useEffect } from 'react';
import { RotateCcw, X } from 'lucide-react';
import type { DiscardedBill } from '@/lib/billing/billTabs';
import { tr } from '@/lib/i18n/core';

/** How long the Undo stays on the counter after ✕ / Clear. */
export const UNDO_SECONDS = 8;

/**
 * v4.93.0 — ✕ on a bill tab or "Clear" used to drop 20 scanned items with no way back.
 * The bill is kept for a few seconds; Undo puts it back (lib/billing/billTabs.ts tabsAfterUndo).
 * Clicking Undo never takes the focus from the search box (the barcode gun types there).
 */
export function PosUndoBar({ discarded, onUndo, onDismiss }: { discarded: DiscardedBill | null; onUndo: () => void; onDismiss: () => void }) {
  useEffect(() => {
    if (!discarded) return;
    const timer = window.setTimeout(onDismiss, UNDO_SECONDS * 1000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discarded]);

  if (!discarded) return null;
  const items = discarded.tab.cart.length;
  const text =
    discarded.kind === 'cleared'
      ? tr('Bill cleared — {count} items removed', { count: items })
      : tr('Bill #{tabNumber} closed — {count} items', { tabNumber: discarded.tab.tabNumber, count: items });

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-md animate-in fade-in slide-in-from-top-1 duration-200" role="status" data-pos-undo>
      <span className="truncate">{text}</span>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onUndo}
          className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 hover:bg-amber-300 font-black flex items-center gap-1 cursor-pointer"
          data-pos-undo-button
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {tr('Undo')}
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onDismiss}
          className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
          aria-label={tr('Dismiss')}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
