'use client';

import React, { useEffect, useRef, useState } from 'react';
import { DRAG_THRESHOLD_PX, DRAWER_TAB_DEFAULT, DRAWER_TAB_KEY, parseTabY, shareFromCenter, tabCenterPx } from '@/lib/ui/drawerTab';

/**
 * A right-edge pull-tab the shop can drag up or down (v4.78.0) — so it never sits on a
 * button it needs. A press without movement opens (click / Enter / Space); a drag moves it;
 * ↑ / ↓ move it from the keyboard; right-click puts it back in the middle. The place is
 * remembered on this computer (localStorage `kamai_drawer_tab_y`).
 */
export function DraggablePullTab({ onOpen, title, className, children }: { onOpen: () => void; title: string; className: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startCenter: number; moved: boolean } | null>(null);
  const [share, setShare] = useState(DRAWER_TAB_DEFAULT);
  const [viewportH, setViewportH] = useState(0);
  const [dragCenter, setDragCenter] = useState<number | null>(null);

  useEffect(() => {
    try {
      setShare(parseTabY(localStorage.getItem(DRAWER_TAB_KEY)));
    } catch {}
    const onResize = () => setViewportH(window.innerHeight);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const save = (next: number) => {
    setShare(next);
    try {
      localStorage.setItem(DRAWER_TAB_KEY, String(next));
    } catch {}
  };

  const tabH = ref.current?.offsetHeight || 120;
  const center = dragCenter ?? (viewportH ? tabCenterPx(share, viewportH, tabH) : null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    drag.current = { startY: e.clientY, startCenter: center ?? window.innerHeight / 2, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dy) < DRAG_THRESHOLD_PX) return;
    d.moved = true;
    setDragCenter(tabCenterPx((d.startCenter + dy) / window.innerHeight, window.innerHeight, tabH));
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) return onOpen();
    const endCenter = tabCenterPx((d.startCenter + (e.clientY - d.startY)) / window.innerHeight, window.innerHeight, tabH);
    save(shareFromCenter(endCenter, window.innerHeight, tabH));
    setDragCenter(null);
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const h = window.innerHeight;
      save(shareFromCenter((center ?? h / 2) + (e.key === 'ArrowUp' ? -40 : 40), h, tabH));
    }
  };

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      title={title}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { drag.current = null; setDragCenter(null); }}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => { e.preventDefault(); save(DRAWER_TAB_DEFAULT); }}
      style={{ top: center ?? '50%', touchAction: 'none' }}
      className={`fixed right-0 -translate-y-1/2 z-40 select-none ${dragCenter !== null ? 'cursor-grabbing' : 'cursor-grab'} ${className}`}
      data-transactions-tab
    >
      {children}
    </div>
  );
}
