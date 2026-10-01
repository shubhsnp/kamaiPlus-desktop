import { barcodeSVG } from '@/lib/barcode/barcodeGenerator';
import { formatINR } from '@/lib/utils';
import { LabelContent, LabelStock, labelPageMm, labelsPerPage } from './labelSettings';
import { encodeCostCode } from './labelExtras';

/*
 * One standalone HTML document for a run of barcode labels (v4.71.0). The same
 * HTML is the on-screen preview and what the printer gets: a roll prints one row
 * of labels per page (page = row width × label height), an A4 sheet one sheet per
 * page. Sizes are in mm; names render in the Windows Devanagari font.
 */

export interface LabelData {
  name: string;
  barcode: string;
  pricePaise: number;
  mrpPaise?: number;
  /** Purchase price — printed only as the cost code (v4.77.0). */
  costPaise?: number;
  /** Size / colour line (v4.77.0). */
  detail?: string;
}

const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

function labelHtml(l: LabelData, content: LabelContent, shopName: string, dateText: string, qrUrl?: string, costCodeWord = ''): string {
  const parts: string[] = [];
  if (content.shopName && shopName) parts.push(`<div class="shop">${esc(shopName)}</div>`);
  if (content.itemName) parts.push(`<div class="name">${esc(l.name)}</div>`);
  if (content.detail && l.detail) parts.push(`<div class="detail">${esc(l.detail)}</div>`);
  parts.push(qrUrl ? `<div class="bars qr"><img src="${qrUrl}" alt=""></div>` : `<div class="bars">${barcodeSVG(l.barcode, { showText: false, height: 60 })}</div>`);
  if (content.code) parts.push(`<div class="code">${esc(l.barcode)}</div>`);
  const prices: string[] = [];
  // An item with no price yet (₹0, e.g. imported without one — v4.87.0): no price on the label.
  const priced = l.pricePaise > 0;
  if (priced && content.mrp && l.mrpPaise && l.mrpPaise > l.pricePaise) prices.push(`<span class="mrp">MRP ${esc(formatINR(l.mrpPaise))}</span>`);
  if (priced && content.price) prices.push(`<span class="price">${esc(formatINR(l.pricePaise))}</span>`);
  const cost = content.costCode ? encodeCostCode(l.costPaise, costCodeWord) : '';
  if (cost) prices.push(`<span class="cc">${esc(cost)}</span>`);
  if (prices.length) parts.push(`<div class="prices">${prices.join('')}</div>`);
  if (content.date && dateText) parts.push(`<div class="date">${esc(dateText)}</div>`);
  return `<div class="label">${parts.join('')}</div>`;
}

export interface LabelHtmlOptions {
  shopName?: string;
  dateText?: string;
  /** Screen preview only: magnify and outline the labels. Printing ignores it. */
  previewZoom?: number;
  /** QR images (data URLs) by code, when content.qr is on. */
  qrDataUrls?: Record<string, string>;
  /** The shop's cost code word, when content.costCode is on. */
  costCodeWord?: string;
  /** Bar height in mm (v4.80.0); 0 / missing = the bars fill the space left. */
  barHeightMm?: number;
  /** Print position nudge in mm (v4.80.0): + right / down. Every label moves the same. */
  offsetMm?: { x: number; y: number };
  /** Size & position check (v4.80.0): each label prints only a frame, its size and its column. */
  alignment?: boolean;
}

/** Alignment frame inset: past the 1.25 mm a label driver may leave unprinted at each side. */
const FRAME_INSET_MM = 1.5;

function alignmentLabelHtml(stock: LabelStock, index: number): string {
  const col = (index % stock.across) + 1;
  return `<div class="label align"><div class="al-size">${stock.widthMm} × ${stock.heightMm} mm</div>${stock.across > 1 ? `<div class="al-col">${col} / ${stock.across}</div>` : ''}</div>`;
}

export function buildLabelHtml(labels: LabelData[], stock: LabelStock, content: LabelContent, opts: LabelHtmlOptions = {}): string {
  const page = labelPageMm(stock);
  const per = labelsPerPage(stock);
  const w = stock.widthMm;
  const h = stock.heightMm;
  // Type scales with the label (50 × 25 mm = 1).
  const k = Math.max(0.7, Math.min(2.2, Math.min(w / 50, h / 25)));
  const pt = (n: number) => `${(n * k).toFixed(2)}pt`;
  const sheet = stock.kind === 'sheet';

  const pages: string[] = [];
  for (let i = 0; i < labels.length; i += per) {
    pages.push(`<div class="page">${labels.slice(i, i + per).map((l, n) => (opts.alignment ? alignmentLabelHtml(stock, n) : labelHtml(l, content, opts.shopName || '', opts.dateText || '', content.qr ? opts.qrDataUrls?.[l.barcode] : undefined, opts.costCodeWord))).join('')}</div>`);
  }
  // Size & position check: a frame just inside each label — fully printed = size and position
  // are right; cut at a side = move the print; across two labels = another label size.
  const alignCss = opts.alignment
    ? `.label.align { position: relative; justify-content: center; gap: ${(0.8 * k).toFixed(2)}mm; }
.label.align::after { content: ''; position: absolute; inset: ${FRAME_INSET_MM}mm; border: 0.3mm solid #000; border-radius: 0.8mm; }
.al-size { font-size: ${pt(9)}; font-weight: 900; line-height: 1; }
.al-col { font-size: ${pt(6)}; font-weight: 700; line-height: 1; }`
    : '';

  const zoom = opts.previewZoom || 0;
  const screenCss = zoom
    ? `@media screen {
        html { zoom: ${zoom}; background: #e2e8f0; }
        body { width: auto; padding: 3mm; }
        .page { margin: 0 auto 2mm; background: #fff; box-shadow: 0 0 0 0.3mm #94a3b8; }
        .label { outline: 0.2mm dashed #cbd5e1; outline-offset: -0.2mm; }
      }`
    : '';
  // A set bar height: the label's lines sit in the middle; only the bars give way (to 3 mm)
  // when a long name needs the room, so the price is never cut off.
  const barH = opts.barHeightMm && opts.barHeightMm > 0 ? opts.barHeightMm : 0;
  const barHeightCss = barH
    ? `.label { justify-content: center; }
.label > * { flex-shrink: 0; }
.bars { flex: 0 1 ${barH}mm; }`
    : '';
  // A printer that starts a little high / to one side (driver margins, gap sensing): the whole
  // print is moved; what goes past the page edge is cut, as the printer would.
  const ox = opts.offsetMm?.x || 0;
  const oy = opts.offsetMm?.y || 0;
  const offsetCss = ox || oy ? `.label { position: relative; left: ${ox}mm; top: ${oy}mm; }` : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Labels</title><style>
@page { size: ${page.widthMm}mm ${page.heightMm}mm; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #fff; color: #000; font-family: 'Nirmala UI', 'Mukta', 'Noto Sans Devanagari', 'Segoe UI', Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { width: ${page.widthMm}mm; }
.page { width: ${page.widthMm}mm; height: ${page.heightMm}mm; overflow: hidden; display: grid;
  grid-template-columns: repeat(${stock.across}, ${w}mm); grid-auto-rows: ${h}mm;
  column-gap: ${stock.gapMm}mm; row-gap: ${sheet ? stock.rowGapMm || 0 : 0}mm;
  padding: ${sheet ? `${stock.topMm || 0}mm 0 0 ${stock.leftMm || 0}mm` : '0'};
  break-after: page; page-break-after: always; }
.page:last-child { break-after: auto; page-break-after: auto; }
.label { width: ${w}mm; height: ${h}mm; overflow: hidden; padding: ${(0.8 * k).toFixed(2)}mm ${(1.4 * k).toFixed(2)}mm; display: flex; flex-direction: column; align-items: center; text-align: center; }
.shop { font-size: ${pt(6)}; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; line-height: 1.15; }
.name { font-size: ${pt(7.2)}; font-weight: 800; line-height: 1.12; max-width: 100%; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-word; }
.bars { flex: 1 1 0; min-height: 3mm; width: 100%; margin: ${(0.4 * k).toFixed(2)}mm 0 0; }
.bars svg { display: block; width: 100%; height: 100%; }
.bars.qr img { display: block; height: 100%; margin: 0 auto; image-rendering: pixelated; }
.code { font-family: Consolas, 'Courier New', monospace; font-size: ${pt(5.8)}; font-weight: 700; letter-spacing: 0.4pt; line-height: 1.1; }
.prices { display: flex; align-items: baseline; justify-content: center; gap: ${(1.5 * k).toFixed(2)}mm; line-height: 1.1; }
.price { font-size: ${pt(9.5)}; font-weight: 900; }
.mrp { font-size: ${pt(6)}; text-decoration: line-through; }
.detail { font-size: ${pt(6.2)}; font-weight: 700; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.cc { font-size: ${pt(5.5)}; font-weight: 700; letter-spacing: 0.3pt; }
.date { font-size: ${pt(5)}; line-height: 1.1; }
${barHeightCss}
${alignCss}
${offsetCss}
${screenCss}
</style></head><body>${pages.join('')}</body></html>`;
}
