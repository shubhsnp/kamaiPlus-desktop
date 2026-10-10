import { buildPrintHtml, printHtml } from '@/lib/print/printDocument';
import { getDesktopApi } from '@/lib/desktop/desktopBridge';
import { tr } from '@/lib/i18n/core';
import { getPrintSettings, printerForFormat } from '@/lib/hardware/printSettings';
import type { PaperFormat } from '@/lib/desktop/desktopBridge';
import { KotLine, RestOrder, kotChanges } from '@/lib/restaurant/model';

/*
 * The kitchen slip (KOT — Kitchen Order Ticket), v4.106.0. Big, plain, black on white: table, time,
 * what to cook (ADD) and what to stop (CANCEL). Printed on the counter's thermal printer.
 */

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

const KOT_CSS = `
.kot{font-family:'Segoe UI',Arial,sans-serif;color:#000;padding:3mm 3mm 5mm;}
.kot .shop{text-align:center;font-size:11px;letter-spacing:.08em;text-transform:uppercase;}
.kot .big{text-align:center;font-size:30px;font-weight:900;line-height:1.1;margin:2mm 0 1mm;}
.kot .meta{display:flex;justify-content:space-between;font-size:12px;border-top:2px solid #000;border-bottom:2px solid #000;padding:1.2mm 0;margin-bottom:2mm;}
.kot .sec{font-size:12px;font-weight:900;letter-spacing:.1em;margin:3mm 0 1mm;}
.kot .row{display:flex;gap:3mm;font-size:17px;font-weight:700;padding:1.2mm 0;border-bottom:1px dashed #000;}
.kot .row .q{min-width:11mm;font-weight:900;}
.kot .row.cancel{text-decoration:line-through;}
.kot .note{font-size:12px;font-weight:600;padding-left:14mm;margin-top:-.8mm;}
.kot .end{text-align:center;font-size:11px;margin-top:3mm;}
`;

export interface KotInput {
  order: RestOrder;
  shopName?: string;
  /** Slip number of the day for this order: 1 = first slip, 2 = next round… */
  round: number;
  now?: Date;
  /** v4.108.0: 'cancel' = the whole order is cancelled (with the reason); 'reprint' = a lost slip again. */
  kind?: 'kot' | 'cancel' | 'reprint';
  reason?: string;
}

export function buildKotBody({ order, shopName, round, now = new Date(), kind = 'kot', reason }: KotInput, changes: KotLine[] = kotChanges(order)): string {
  const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const row = (l: KotLine, cancel: boolean) =>
    `<div class="row${cancel ? ' cancel' : ''}"><span class="q">${cancel ? '−' : ''}${Math.abs(l.delta)} ×</span><span>${esc(l.title)}</span></div>${l.note ? `<div class="note">${esc(l.note)}</div>` : ''}`;
  const adds = changes.filter((l) => l.delta > 0);
  const cancels = changes.filter((l) => l.delta < 0);
  return `<div class="kot">
<div class="shop">${esc(shopName || 'Kitchen')} · KOT</div>
<div class="big">${esc(order.label)}</div>
${order.kind !== 'table' ? `<div class="sec">${order.kind === 'delivery' ? 'DELIVERY' : 'TAKEAWAY'}${order.guest?.name ? ` · ${esc(order.guest.name)}` : ''}</div>` : ''}
<div class="meta"><span>${esc(time)}</span><span>${kind === 'cancel' ? 'ORDER CANCELLED' : kind === 'reprint' ? 'REPRINT' : round > 1 ? `Round ${round}` : 'New order'}</span></div>
${kind === 'cancel' && reason ? `<div class="sec">REASON: ${esc(reason)}</div>` : ''}
${adds.length ? `<div class="sec">${kind === 'reprint' ? 'IN KITCHEN' : 'ADD'}</div>${adds.map((l) => row(l, false)).join('')}` : ''}
${cancels.length ? `<div class="sec">CANCEL</div>${cancels.map((l) => row(l, true)).join('')}` : ''}
<div class="end">— ${esc(order.label)} —</div>
</div>`;
}

/** The thermal paper for the kitchen: the counter's thermal choice, 80 mm unless it is set to 58 mm. */
export function kotPaper(): PaperFormat {
  const f = getPrintSettings().defaultFormat;
  return f === 'thermal-58' ? 'thermal-58' : 'thermal-80';
}

/**
 * Prints what changed since the last slip (or, v4.108.0, the `changes` given: a cancel slip / a reprint).
 * `ok: false` = nothing to send, or the printer failed.
 */
export async function printKot(input: KotInput, given?: KotLine[]): Promise<{ ok: boolean; empty?: boolean; noPrinter?: boolean; error?: string }> {
  const changes = given || kotChanges(input.order);
  if (changes.length === 0) return { ok: false, empty: true };
  const paper = kotPaper();
  const settings = getPrintSettings();
  // v4.123.0 (AU-31): no printer chosen for the slip = it is NOT sent anywhere. Before, a silent job with
  // no printer name went to whatever Windows picked (a label printer, or nowhere) and the order said
  // "In kitchen". The caller asks the waiter instead.
  if (getDesktopApi() && !printerForFormat(settings, paper)) return { ok: false, noPrinter: true, error: tr('no kitchen printer chosen') };
  const html = buildPrintHtml(buildKotBody(input, changes), `KOT ${input.order.label}`, paper, KOT_CSS);
  // Silent: a kitchen slip must never open a print window in the waiter's face (the browser fallback ignores it).
  const res = await printHtml(html, paper, { deviceName: printerForFormat(settings, paper) || undefined, silent: true });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}
