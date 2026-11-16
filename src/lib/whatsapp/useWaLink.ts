'use client';

import { useEffect, useState } from 'react';
import { getDesktopApi, WaLinkStatus } from '@/lib/desktop/desktopBridge';

/*
 * v4.185.0 — the state of this PC's linked WhatsApp (waLink.js), live. `available` is false in a
 * browser or an older desktop build: the screens then show nothing about it.
 */

export const WA_LINK_IDLE: WaLinkStatus = { state: 'idle', me: '', qr: '', error: '', linked: false };

/** "919525512020" → "+91 95255 12020". */
export function formatWaNumber(me: string): string {
  const d = String(me || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  return d ? `+${d}` : '';
}

export function useWaLink(): { available: boolean; status: WaLinkStatus } {
  const api = getDesktopApi();
  const available = Boolean(api?.waLinkStatus);
  const [status, setStatus] = useState<WaLinkStatus>(WA_LINK_IDLE);

  useEffect(() => {
    const desktop = getDesktopApi();
    if (!desktop?.waLinkStatus) return;
    let alive = true;
    desktop.waLinkStatus().then((s) => { if (alive) setStatus(s); }).catch(() => {});
    // An event carries the worker's state; whether a session is saved is asked again.
    const off = desktop.onWaLinkEvent?.((s) => {
      if (!alive) return;
      setStatus((prev) => ({ ...prev, ...s }));
      desktop.waLinkStatus?.().then((full) => { if (alive) setStatus(full); }).catch(() => {});
    });
    return () => {
      alive = false;
      off?.();
    };
  }, []);

  return { available, status };
}
