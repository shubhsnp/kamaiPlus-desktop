import type { PaperFormat } from '@/lib/desktop/desktopBridge';
import { reportError } from '@/lib/diagnostics/errorReporter';

/**
 * Per-computer print preferences (printers belong to the machine, not the store,
 * so they live in localStorage rather than the synced business record).
 */
export interface PrintSettings {
  /** Format used by the one "Print Bill" button. */
  defaultFormat: PaperFormat;
  /** Windows printer names; '' = system default printer. */
  a4Printer: string;
  thermalPrinter: string;
  /** Print straight to the selected printer without the system dialog. */
  silent: boolean;
  /** Print the bill automatically as soon as a sale is completed. */
  autoPrintAfterSale: boolean;
  /**
   * v4.186.0 (Rahul): the kitchen's own printer for KOTs, cancel slips and reprints (Restaurant mode).
   * '' = the bill's thermal printer, as before (one printer for both).
   */
  kotPrinter: string;
  /** KOT paper: '' = follows the bill (80 mm unless the bill is 58 mm), as before. */
  kotFormat: '' | 'thermal-80' | 'thermal-58';
}

const KEY = 'kamai_print_settings';

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  defaultFormat: 'a4',
  a4Printer: '',
  thermalPrinter: '',
  silent: false,
  autoPrintAfterSale: false,
  kotPrinter: '',
  kotFormat: '',
};

export function getPrintSettings(): PrintSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_PRINT_SETTINGS };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PRINT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PRINT_SETTINGS, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch {
    return { ...DEFAULT_PRINT_SETTINGS };
  }
}

export function savePrintSettings(next: PrintSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('print_settings_changed'));
  } catch (e) {
    reportError('storage', e, 'print settings not saved');
  }
}

export function printerForFormat(settings: PrintSettings, format: PaperFormat): string {
  return format === 'a4' ? settings.a4Printer : settings.thermalPrinter;
}

/**
 * v4.186.0 — where a KOT goes: the kitchen printer and its paper; nothing chosen = the bill's thermal
 * printer and size, exactly as before (one printer for bills and KOTs).
 */
export function kotTarget(settings: PrintSettings): { paper: 'thermal-80' | 'thermal-58'; deviceName: string; ownPrinter: boolean } {
  const paper = settings.kotFormat || (settings.defaultFormat === 'thermal-58' ? 'thermal-58' : 'thermal-80');
  const own = (settings.kotPrinter || '').trim();
  return { paper, deviceName: own || printerForFormat(settings, paper), ownPrinter: Boolean(own) };
}

/**
 * v4.186.0 (Rahul: "set once, never ask again"): "Print Bill" goes straight to the printer chosen for
 * the bill size; the Windows print dialog only when no printer is chosen (or "Print directly" was on).
 */
export function printBillSilently(settings: PrintSettings, format: PaperFormat): boolean {
  return settings.silent || Boolean(printerForFormat(settings, format));
}
