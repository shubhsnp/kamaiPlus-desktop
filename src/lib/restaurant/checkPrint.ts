import QRCode from 'qrcode';
import { buildPrintHtml, printHtml } from '@/lib/print/printDocument';
import { getPrintSettings, printerForFormat } from '@/lib/hardware/printSettings';
import { formatINR, generateUPILink } from '@/lib/utils';
import type { Business } from '@/types';
import { RestOrder, lineTitle, liveLines, lineUnitPaise, orderRef, orderTotals } from '@/lib/restaurant/model';
import type { RestaurantSettings } from '@/lib/restaurant/settings';
import { kotPaper } from '@/lib/restaurant/kot';

/*
 * The table's bill before paying (v4.108.0) — "bill lao" in every restaurant: what was eaten, the
 * charges, GST and the total, with the shop's UPI QR for that exact amount so the guest can pay from
 * the table. It is NOT the tax invoice (no bill number, nothing saved): Bill & Pay makes that.
 */

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/** The shop's UPI ID (the default one, else the first, else the single old field). */
export function shopUpiId(business?: Pick<Business, 'upi_ids' | 'upi_id'> | null): string {
  if (!business) return '';
  const list = business.upi_ids || [];
  return (list.find((u) => u.is_default) || list[0])?.upi_id || business.upi_id || '';
}

const CHECK_CSS = `
.chk{font-family:'Segoe UI',Arial,sans-serif;color:#000;padding:3mm 3mm 5mm;font-size:12px;}
.chk .shop{text-align:center;font-size:15px;font-weight:900;}
.chk .sub{text-align:center;font-size:10.5px;}
.chk .big{text-align:center;font-size:20px;font-weight:900;margin:2mm 0 1mm;}
.chk .meta{display:flex;justify-content:space-between;border-top:1.5px solid #000;border-bottom:1.5px solid #000;padding:1mm 0;margin-bottom:1.5mm;}
.chk table{width:100%;border-collapse:collapse;}
.chk td{padding:.8mm 0;vertical-align:top;}
.chk td.n{text-align:right;white-space:nowrap;padding-left:2mm;}
.chk tr.l td{border-bottom:1px dashed #000;}
.chk .tot td{font-weight:700;}
.chk .grand td{font-size:17px;font-weight:900;border-top:1.5px solid #000;padding-top:1.5mm;}
.chk .qr{text-align:center;margin-top:3mm;}
.chk .qr img{width:34mm;height:34mm;}
.chk .end{text-align:center;font-size:10.5px;margin-top:2.5mm;border-top:1px dashed #000;padding-top:1.5mm;}
`;

export interface CheckInput {
  order: RestOrder;
  settings: RestaurantSettings;
  business?: Partial<Pick<Business, 'name' | 'phone' | 'gstin' | 'upi_ids' | 'upi_id'>> | null;
  now?: Date;
  /** data: URL of the UPI QR (built by printCheck). */
  qrDataUrl?: string;
}

export function buildCheckBody({ order, settings, business, now = new Date(), qrDataUrl }: CheckInput): string {
  const t = orderTotals(order, settings);
  const who = orderRef(order);
  const g = order.guest;
  const guestLines = [g?.name, g?.phone, g?.address].filter(Boolean).map((v) => `<div class="sub">${esc(String(v))}</div>`).join('');
  const when = now.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const rows = liveLines(order)
    .map((l) => `<tr class="l"><td>${l.qty} × ${esc(lineTitle(l))}</td><td class="n">${formatINR(Math.round(l.qty * lineUnitPaise(l)))}</td></tr>`)
    .join('');
  const extra = [
    t.serviceChargePaise > 0 ? `<tr class="tot"><td>Service charge ${settings.serviceChargePercent}%</td><td class="n">${formatINR(t.serviceChargePaise)}</td></tr>` : '',
    t.packingPaise > 0 ? `<tr class="tot"><td>Packing charge</td><td class="n">${formatINR(t.packingPaise)}</td></tr>` : '',
    t.deliveryPaise > 0 ? `<tr class="tot"><td>Delivery charge</td><td class="n">${formatINR(t.deliveryPaise)}</td></tr>` : '',
    `<tr><td>GST ${settings.gstRate}% ${settings.gstInclusive ? '(included)' : '(added)'}</td><td class="n">${formatINR(t.taxTotal)}</td></tr>`,
  ].join('');
  return `<div class="chk">
<div class="shop">${esc(business?.name || 'Restaurant')}</div>
${business?.phone ? `<div class="sub">${esc(business.phone)}</div>` : ''}${business?.gstin ? `<div class="sub">GSTIN ${esc(business.gstin)}</div>` : ''}
<div class="big">${esc(who)}</div>
${guestLines}
<div class="meta"><span>${esc(when)}</span><span>${t.pieces} pcs</span></div>
<table>${rows}${extra}<tr class="grand"><td>TOTAL</td><td class="n">${formatINR(t.grandTotal)}</td></tr></table>
${qrDataUrl ? `<div class="qr"><img src="${qrDataUrl}" alt="UPI"/><div>Scan to pay ${formatINR(t.grandTotal)}</div></div>` : ''}
<div class="end">Bill for checking — not a tax invoice.<br/>Your GST bill is given when you pay.</div>
</div>`;
}

export async function printCheck(input: Omit<CheckInput, 'qrDataUrl'>): Promise<{ ok: boolean; error?: string }> {
  const total = orderTotals(input.order, input.settings).grandTotal;
  if (total <= 0) return { ok: false, error: 'empty' };
  let qrDataUrl = '';
  const upi = shopUpiId(input.business);
  if (upi) {
    const ref = orderRef(input.order);
    qrDataUrl = await QRCode.toDataURL(generateUPILink(upi, input.business?.name || 'KamaiPlus', total, ref), { width: 260, margin: 1 }).catch(() => '');
  }
  const paper = kotPaper();
  const html = buildPrintHtml(buildCheckBody({ ...input, qrDataUrl }), `Bill ${input.order.label}`, paper, CHECK_CSS);
  const res = await printHtml(html, paper, { deviceName: printerForFormat(getPrintSettings(), paper) || undefined, silent: true });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}
