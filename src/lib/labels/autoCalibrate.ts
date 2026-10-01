import { getDesktopApi } from '@/lib/desktop/desktopBridge';
import { LabelSettings, labelPageMm, stockFor } from './labelSettings';

/**
 * Automatic label-printer calibration (v4.89.0, Customer Bug — first client's 50 × 25 mm roll).
 *
 * A label printer that has not learned where each label starts prints the first labels of a
 * run shifted — the price lands on the gap or the next label — and only lines up after a few
 * labels (photo from the client, 2026-10-01). "Calibrate printer" fixes it, but a shop does not
 * know to press it. So the FIRST label print to a printer at a given label size calibrates it
 * by itself (TSC & co: GAPDETECT — the printer feeds 2–3 blank labels and learns the gap), and
 * this computer remembers it. A new roll: Label setup → "Calibrate printer" (again marks it).
 */

export const LABEL_CALIBRATED_KEY = 'kamai_label_calibrated';

type CalibratedMap = Record<string, { at: string; result: 'done' | 'manual' }>;

/** One key per printer + label size (a different roll size needs its own calibration). */
export function calibrationKey(settings: Pick<LabelSettings, 'printer' | 'stockId' | 'custom'>): string {
  const stock = stockFor(settings as LabelSettings);
  const page = labelPageMm(stock);
  return `${settings.printer}|${stock.widthMm}x${stock.heightMm}x${stock.across}|${page.widthMm}`;
}

function readMap(): CalibratedMap {
  try {
    const v = JSON.parse(localStorage.getItem(LABEL_CALIBRATED_KEY) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

export function calibrationFor(settings: Pick<LabelSettings, 'printer' | 'stockId' | 'custom'>): { at: string; result: 'done' | 'manual' } | null {
  return readMap()[calibrationKey(settings)] || null;
}

export function markCalibrated(settings: Pick<LabelSettings, 'printer' | 'stockId' | 'custom'>, result: 'done' | 'manual'): void {
  const map = readMap();
  map[calibrationKey(settings)] = { at: new Date().toISOString(), result };
  try {
    localStorage.setItem(LABEL_CALIBRATED_KEY, JSON.stringify(map));
  } catch {}
}

/** Pure: should this print calibrate first? Only a named printer, a roll, and not done before. */
export function needsAutoCalibration(settings: LabelSettings, already: boolean, canCalibrate: boolean): boolean {
  return Boolean(settings.printer) && canCalibrate && stockFor(settings).kind === 'roll' && !already;
}

/**
 * Before a label print: calibrate once for this printer + size. Never blocks printing — a
 * printer the app has no command for (or an error) just prints as before.
 */
export async function calibrateBeforeFirstPrint(settings: LabelSettings): Promise<'done' | 'manual' | 'skipped' | 'failed'> {
  const desktop = getDesktopApi();
  if (!needsAutoCalibration(settings, Boolean(calibrationFor(settings)), Boolean(desktop?.calibrateLabelPrinter))) return 'skipped';
  try {
    const res = await desktop!.calibrateLabelPrinter!(settings.printer);
    if (res.ok) {
      markCalibrated(settings, 'done');
      return 'done';
    }
    if (res.manual) {
      // Unknown make: nothing the app can send; do not try again on every print.
      markCalibrated(settings, 'manual');
      return 'manual';
    }
    return 'failed';
  } catch {
    return 'failed';
  }
}
