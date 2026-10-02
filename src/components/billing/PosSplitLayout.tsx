'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import {
  activeBillShare,
  BILL_SHARE_STEP,
  billShareFromPointer,
  DEFAULT_POS_LAYOUT,
  loadPosLayout,
  MAX_BILL_SHARE,
  MIN_BILL_SHARE,
  PosLayout,
  resetBillShare,
  savePosLayout,
  withBillShare,
} from '@/lib/billing/posLayout';

/**
 * The counter's layout (v4.92.0): product list on the left, the bill on the right, a line in
 * between that can be dragged. The saved layout is read after mount (the page is pre-rendered,
 * so the first paint is the default 7 : 5 and never a hydration mismatch).
 */
export function usePosLayout(): [PosLayout, (next: PosLayout, persist?: boolean) => void] {
  const [layout, setLayout] = useState<PosLayout>(DEFAULT_POS_LAYOUT);
  useEffect(() => {
    setLayout(loadPosLayout());
  }, []);
  const update = useCallback((next: PosLayout, persist = true) => {
    setLayout(next);
    if (persist) savePosLayout(next);
  }, []);
  return [layout, update];
}

interface Props {
  layout: PosLayout;
  onLayoutChange: (next: PosLayout, persist?: boolean) => void;
  catalog: React.ReactNode;
  checkout: React.ReactNode;
  /** Back to the product search after a drag (a gun types into whatever has focus). */
  onDone?: () => void;
}

export function PosSplitLayout({ layout, onLayoutChange, catalog, checkout, onDone }: Props) {
  const rowRef = useRef<HTMLDivElement>(null);
  const latest = useRef(layout);
  latest.current = layout;
  // The layout under the pointer while a drag runs (null = no drag). Kept here, not read back
  // from a render: on a slow PC the last moves are not rendered yet when the button comes up,
  // and saving the rendered layout snapped the bill back to an early step of the drag.
  const drag = useRef<PosLayout | null>(null);
  const [dragging, setDragging] = useState(false);
  const share = activeBillShare(layout);

  // A drag that ends outside the window (or a lost capture) must not leave the page stuck.
  useEffect(() => {
    if (!dragging) return;
    const body = document.body.style;
    const prev = { cursor: body.cursor, userSelect: body.userSelect };
    body.cursor = 'col-resize';
    body.userSelect = 'none';
    return () => {
      body.cursor = prev.cursor;
      body.userSelect = prev.userSelect;
    };
  }, [dragging]);

  const moveTo = (clientX: number) => {
    const rect = rowRef.current?.getBoundingClientRect();
    if (!drag.current || !rect) return;
    const next = withBillShare(drag.current, billShareFromPointer(rect.left, rect.width, clientX));
    drag.current = next;
    onLayoutChange(next, false);
  };

  // Button up, cancelled, or the capture lost (e.g. Alt+Tab mid-drag): save where it ended.
  const finish = (e: React.PointerEvent<HTMLDivElement>) => {
    const final = drag.current;
    if (!final) return;
    drag.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    setDragging(false);
    onLayoutChange(final, true);
    onDone?.();
  };

  return (
    <div ref={rowRef} className="flex flex-col lg:flex-row h-full flex-1 min-h-0 gap-3.5 lg:gap-0" data-pos-layout={layout.scanMode ? 'scan' : 'list'}>
      <div className="flex flex-col h-full min-h-0 min-w-0 lg:flex-1">{catalog}</div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={tr('Drag to make the bill wider or narrower. Double-click to reset.')}
        aria-valuemin={Math.round(MIN_BILL_SHARE * 100)}
        aria-valuemax={Math.round(MAX_BILL_SHARE * 100)}
        aria-valuenow={Math.round(share * 100)}
        title={tr('Drag to make the bill wider or narrower. Double-click to reset.')}
        data-pos-divider
        // preventDefault keeps the focus in the product search box (where the barcode gun types).
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = latest.current;
          setDragging(true);
        }}
        onPointerMove={(e) => moveTo(e.clientX)}
        onPointerUp={finish}
        onPointerCancel={finish}
        onLostPointerCapture={finish}
        onDoubleClick={() => {
          onLayoutChange(resetBillShare(latest.current), true);
          onDone?.();
        }}
        onKeyDown={(e) => {
          // Reachable only by a screen reader / deliberate focus — never in the Tab order of the counter.
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            const delta = e.key === 'ArrowLeft' ? BILL_SHARE_STEP : -BILL_SHARE_STEP;
            onLayoutChange(withBillShare(latest.current, share + delta), true);
          }
        }}
        className="hidden lg:flex w-3.5 shrink-0 items-center justify-center cursor-col-resize group touch-none select-none"
      >
        <div
          className={cn(
            'w-1 h-14 rounded-full transition-colors',
            dragging ? 'bg-sky-500' : 'bg-slate-300 group-hover:bg-sky-400'
          )}
        />
      </div>

      <div
        className={cn('hidden lg:flex flex-col h-full min-h-0 shrink-0', !dragging && 'transition-[width] duration-200 ease-out')}
        style={{ width: `${share * 100}%` }}
        data-pos-bill-panel
      >
        {checkout}
      </div>
    </div>
  );
}
