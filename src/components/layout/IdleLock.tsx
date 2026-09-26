'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getIdleLockMinutes, IDLE_LOCK_CHANGED_EVENT, shouldIdleLock } from '@/lib/auth/idleLock';
import { hasMasterPassword, lockApp } from '@/lib/auth/masterPassword';

// Anything a person (or a barcode scanner) does at the counter counts as use.
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;
const CHECK_EVERY_MS = 15_000;

/**
 * Locks the app after the idle time chosen in the store menu (default 10 min).
 * Rendered once inside the unlocked shell; renders nothing.
 */
export function IdleLock() {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const [minutes, setMinutes] = useState(getIdleLockMinutes);

  useEffect(() => {
    const onChange = () => setMinutes(getIdleLockMinutes());
    window.addEventListener(IDLE_LOCK_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(IDLE_LOCK_CHANGED_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (!minutes || !hasMasterPassword()) return;
    let last = Date.now();
    const touch = () => {
      last = Date.now();
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, touch, { capture: true, passive: true }));
    // Compared against the clock, so a PC that slept past the limit locks on wake too.
    const timer = window.setInterval(() => {
      if (shouldIdleLock(last, Date.now(), minutes)) lockApp(pathRef.current);
    }, CHECK_EVERY_MS);
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, touch, { capture: true }));
      window.clearInterval(timer);
    };
  }, [minutes]);

  return null;
}
