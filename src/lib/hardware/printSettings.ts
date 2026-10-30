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
}

const KEY = 'kamai_print_settings';

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  defaultFormat: 'a4',
  a4Printer: '',
  thermalPrinter: '',
  silent: false,
  autoPrintAfterSale: false,
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
