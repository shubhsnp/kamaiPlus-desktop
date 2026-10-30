'use client';

import { useEffect, useState } from 'react';
import type { DesktopPrinter, KamaiDesktopApi } from '@/lib/desktop/desktopBridge';
import type { PrinterFacts } from '@/lib/hardware/printerDetect';
import { reportError } from '@/lib/diagnostics/errorReporter';

/*
 * The printers Windows has right now, shared by the printer watcher (AppShell) and the
 * status bar (v4.78.0) — one look every few seconds for the whole app, not one per widget.
 */

export const PRINTERS_SEEN_EVENT = 'kamai_printers_seen';
export const OPEN_PRINTERS_EVENT = 'kamai_open_printers';
/** The counter's "Enter prints straight away" switch (Billing reads it on mount and on this event). */
export const SILENT_PRINT_KEY = 'kamai_silent_print';
export const SILENT_PRINT_EVENT = 'kamai_silent_print_changed';

let latest: PrinterFacts[] | null = null;

export function publishPrinters(list: PrinterFacts[]) {
  latest = list;
  window.dispatchEvent(new Event(PRINTERS_SEEN_EVENT));
}

/** Opens the Printers window (bill + label printer) from anywhere. */
export function openPrintersWindow() {
  window.dispatchEvent(new Event(OPEN_PRINTERS_EVENT));
}

/** Last printers seen (null = not looked yet / not the desktop app). */
export function usePrinterFacts(): PrinterFacts[] | null {
  const [list, setList] = useState<PrinterFacts[] | null>(latest);
  useEffect(() => {
    const on = () => setList(latest);
    on();
    window.addEventListener(PRINTERS_SEEN_EVENT, on);
    return () => window.removeEventListener(PRINTERS_SEEN_EVENT, on);
  }, []);
  return list;
}

/** Electron's quick list, with driver / port / offline from Windows when it can say. */
export async function loadPrinterFacts(api: KamaiDesktopApi, quick: DesktopPrinter[]): Promise<PrinterFacts[]> {
  const status = api.getPrinterStatus ? await api.getPrinterStatus().catch(() => null) : null;
  if (!status) return quick.map((p) => ({ name: p.name, displayName: p.displayName, isDefault: p.isDefault }));
  const byName = new Map(quick.map((p) => [p.name, p]));
  return status.map((s) => ({
    ...s,
    displayName: byName.get(s.name)?.displayName || s.name,
    isDefault: Boolean(byName.get(s.name)?.isDefault),
  }));
}

export function readSilentPrint(): boolean {
  try {
    return localStorage.getItem(SILENT_PRINT_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveSilentPrint(on: boolean) {
  try {
    localStorage.setItem(SILENT_PRINT_KEY, String(on));
  } catch (e) {
    reportError('storage', e, 'silent print setting not saved');
  }
  window.dispatchEvent(new Event(SILENT_PRINT_EVENT));
}
