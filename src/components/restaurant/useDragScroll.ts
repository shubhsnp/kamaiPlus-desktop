'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import { DRAG_START_PX } from '@/lib/restaurant/tableStrip';

const calmMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A row that scrolls sideways by hand (v4.183.0): hold and drag with the mouse (it glides on a little
 * when let go), roll the wheel, or swipe on a touch screen. A press that does not move stays a normal
 * click on what is under it; a drag never clicks anything.
 */
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean; lastX: number; lastT: number; speed: number } | null>(null);
  const skipClick = useRef(false);
  const glideId = useRef<number | null>(null);
  // Which sides have more to scroll to: the row fades there, so it is plain that it goes on.
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdges((cur) => (cur.left === left && cur.right === right ? cur : { left, right }));
  }, []);

  const stopGlide = () => {
    if (glideId.current !== null) cancelAnimationFrame(glideId.current);
    glideId.current = null;
  };

  const glide = (el: HTMLElement, pxPerMs: number) => {
    if (calmMotion()) return;
    let step = pxPerMs * 16;
    const run = () => {
      if (Math.abs(step) < 0.4) {
        glideId.current = null;
        return;
      }
      el.scrollLeft += step;
      step *= 0.93;
      glideId.current = requestAnimationFrame(run);
    };
    glideId.current = requestAnimationFrame(run);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const resized = new ResizeObserver(measure);
    resized.observe(el);
    // Not React's onWheel: that one is passive, and the page behind must not move too.
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      stopGlide();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      resized.disconnect();
      el.removeEventListener('wheel', onWheel);
      stopGlide();
    };
  }, [measure]);

  const handlers = {
    onPointerDown: (e: React.PointerEvent<T>) => {
      if (e.pointerType === 'touch' || e.button !== 0) return; // A finger scrolls the row by itself.
      stopGlide();
      drag.current = { x: e.clientX, left: e.currentTarget.scrollLeft, moved: false, lastX: e.clientX, lastT: e.timeStamp, speed: 0 };
    },
    onPointerMove: (e: React.PointerEvent<T>) => {
      const d = drag.current;
      if (!d) return;
      const el = e.currentTarget;
      const dx = e.clientX - d.x;
      if (!d.moved) {
        if (Math.abs(dx) < DRAG_START_PX) return;
        d.moved = true;
        el.setPointerCapture(e.pointerId);
        el.style.cursor = 'grabbing';
      }
      el.scrollLeft = d.left - dx;
      const dt = e.timeStamp - d.lastT;
      if (dt > 0) {
        d.speed = (d.lastX - e.clientX) / dt;
        d.lastX = e.clientX;
        d.lastT = e.timeStamp;
      }
    },
    onPointerUp: (e: React.PointerEvent<T>) => {
      const d = drag.current;
      drag.current = null;
      if (!d?.moved) return;
      const el = e.currentTarget;
      el.style.cursor = '';
      // The click that ends a drag is dropped. It comes right after this; a later real click must count.
      skipClick.current = true;
      window.setTimeout(() => { skipClick.current = false; }, 0);
      glide(el, d.speed);
    },
    onClickCapture: (e: React.MouseEvent<T>) => {
      if (!skipClick.current) return;
      skipClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
    onScroll: measure,
  };

  return { ref, edges, measure, handlers };
}
