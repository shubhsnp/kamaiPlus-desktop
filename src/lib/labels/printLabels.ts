import { printHtml } from '@/lib/print/printDocument';
import { buildLabelHtml, LabelData, LabelHtmlOptions } from './labelSheet';
import { LabelSettings, labelPageMm, stockFor } from './labelSettings';
import { calibrateBeforeFirstPrint } from './autoCalibrate';

/**
 * Prints barcode labels with this computer's label setup: straight to the chosen
 * label printer (no dialog) when one is set, otherwise through the print dialog.
 * A roll goes out as one page per row at the label size; an A4 sheet as A4.
 */
export async function printLabels(labels: LabelData[], settings: LabelSettings, shopName: string, extra: Pick<LabelHtmlOptions, 'alignment'> = {}) {
  if (labels.length === 0) return { ok: false, error: 'Nothing to print.' };
  const stock = stockFor(settings);
  const page = labelPageMm(stock);
  const html = buildLabelHtml(labels, stock, settings.content, {
    shopName,
    dateText: new Date().toLocaleDateString('en-IN'),
    qrDataUrls: settings.content.qr && !extra.alignment ? await qrImages(labels.map((l) => l.barcode)) : undefined,
    costCodeWord: settings.costCodeWord,
    barHeightMm: settings.barHeightMm,
    offsetMm: settings.offsetMm,
    alignment: extra.alignment,
  });
  // First print to this printer at this label size: the printer learns the gap first (v4.89.0).
  // The calibration and the labels go to the same print queue, in this order.
  await calibrateBeforeFirstPrint(settings);
  return printHtml(html, stock.kind === 'sheet' ? 'a4' : 'label', {
    pageSizeMm: stock.kind === 'sheet' ? undefined : { width: page.widthMm, height: page.heightMm },
    deviceName: settings.printer || undefined,
    silent: settings.silent && Boolean(settings.printer),
  });
}

/** Size & position check (v4.80.0): one row of framed labels — every column of the roll / sheet. */
export function printAlignmentTest(settings: LabelSettings) {
  const across = stockFor(settings).across;
  return printLabels(Array.from({ length: across }, () => ({ name: '', barcode: '', pricePaise: 0 })), settings, '', { alignment: true });
}

/** QR images for the codes (qrcode is loaded only when QR labels are chosen). */
export async function qrImages(codes: string[]): Promise<Record<string, string>> {
  const QRCode = (await import('qrcode')).default;
  const out: Record<string, string> = {};
  for (const code of Array.from(new Set(codes))) out[code] = await QRCode.toDataURL(code, { margin: 0, width: 160 });
  return out;
}

/** Every item repeated by its number of copies, in list order. */
export function expandCopies<T extends LabelData & { copies: number }>(items: T[]): LabelData[] {
  const out: LabelData[] = [];
  for (const it of items) for (let i = 0; i < Math.max(0, Math.floor(it.copies)); i++) out.push(it);
  return out;
}
