/*
 * Messages the shop sends to its business contacts (v4.79.0) — a restock order to a supplier, a
 * balance note to a supplier, the GST figures to the CA, the cash count to the owner. English,
 * like the Android app (suppliers and CAs work in English); the text can be edited before sending.
 */

import { formatINR } from '@/lib/utils';
import { formatQty } from '@/lib/invoices/invoiceDocument';
import { messageDate, MessageShop } from './customerMessages';

const SEP = '------------------------------';

function shopLines(shop: MessageShop): string[] {
  return [`🏪 *${shop.name}*`, ...(shop.phone ? [`📞 ${shop.phone}`] : [])];
}

/** What to order for a low item: back up to twice its alert level (at least 1). */
export function suggestedOrderQty(p: { current_stock?: number; min_stock_level?: number }): number {
  const min = Number(p.min_stock_level ?? 5) || 5;
  return Math.max(1, Math.ceil(min * 2 - Math.max(0, Number(p.current_stock ?? 0))));
}

export interface RestockLine {
  name: string;
  qty: number;
  unit: string;
  stock?: number;
}

/** Low-stock items as an order to a supplier / wholesaler. */
export function restockOrderMessage(input: { shop: MessageShop; supplierName?: string; items: RestockLine[]; date?: Date }): string {
  const items = input.items.filter((i) => i.qty > 0);
  const lines = ['📦 *RESTOCK ORDER*', ...shopLines(input.shop), `📅 ${messageDate(input.date || new Date())}`, SEP];
  lines.push(`Dear ${input.supplierName?.trim() || 'Supplier'},`, 'Please send the following items:', '');
  items.forEach((it, i) => {
    const unit = it.unit && it.unit !== 'piece' ? ` ${it.unit}` : ' pcs';
    const stock = it.stock !== undefined ? ` (in stock: ${formatQty(Math.max(0, it.stock))})` : '';
    lines.push(`${i + 1}. *${it.name}* — ${formatQty(it.qty)}${unit}${stock}`);
  });
  lines.push('', `📊 *${items.length} item${items.length === 1 ? '' : 's'}*`, SEP, 'Please confirm the rates and the delivery date. Thank you!', `— ${input.shop.name}`);
  return lines.join('\n');
}

/** A note to a supplier about where the account stands. */
export function supplierMessage(input: { shop: MessageShop; supplierName: string; balancePaise: number }): string {
  const bal = input.balancePaise || 0;
  const lines = [`Dear ${input.supplierName},`, '', `Greetings from *${input.shop.name}*.`];
  if (bal > 0) lines.push(`As per our books, ${formatINR(bal)} is due to you. We will clear it soon.`);
  else if (bal < 0) lines.push(`As per our books, we have an advance of ${formatINR(-bal)} with you.`);
  else lines.push('As per our books, our account with you is settled.');
  lines.push('', 'Thank you!', `— ${input.shop.name}${input.shop.phone ? ` • ${input.shop.phone}` : ''}`);
  return lines.join('\n');
}

export interface GstFigures {
  periodLabel: string;
  gstin?: string;
  invoices: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
}

/** The period's GST figures for the CA (the files themselves go from Data Backup & Tax Reports). */
export function gstForCaMessage(shop: MessageShop, f: GstFigures): string {
  const total = f.cgstPaise + f.sgstPaise + f.igstPaise;
  const lines = ['Hello Sir / Madam,', `Sharing our GST figures for *${f.periodLabel}*:`, '', `🏪 *${shop.name}*`, `🆔 GSTIN: ${f.gstin?.trim() || 'Not registered'}`, SEP];
  lines.push(`🧾 Invoices: ${f.invoices}`, `💰 Taxable value: ${formatINR(f.taxablePaise)}`);
  if (f.cgstPaise || f.sgstPaise) lines.push(`• CGST: ${formatINR(f.cgstPaise)}`, `• SGST: ${formatINR(f.sgstPaise)}`);
  if (f.igstPaise) lines.push(`• IGST: ${formatINR(f.igstPaise)}`);
  lines.push(`🧾 *Total GST: ${formatINR(total)}*`, SEP, 'The GSTR-1 file / Excel register will follow. Kindly confirm the filing.', `— ${shop.name}${shop.phone ? ` • ${shop.phone}` : ''}`);
  return lines.join('\n');
}

/** Notes and coins counted in the drawer, against what should be there. */
export function cashTallyMessage(input: { shop: MessageShop; counts: { value: number; count: number }[]; countedPaise: number; expectedPaise?: number }): string {
  const lines = ['🧾 *CASH COUNT*', `🏪 *${input.shop.name}*`, `📅 ${messageDate(new Date())}`, SEP];
  const used = input.counts.filter((c) => c.count > 0);
  used.forEach((c) => lines.push(`• ₹${c.value} × ${c.count} = ₹${(c.value * c.count).toLocaleString('en-IN')}`));
  if (!used.length) lines.push('• Nothing counted');
  lines.push(SEP, `💰 *Counted: ${formatINR(input.countedPaise)}*`);
  if (input.expectedPaise !== undefined) {
    const diff = input.countedPaise - input.expectedPaise;
    lines.push(`🎯 Expected: ${formatINR(input.expectedPaise)}`);
    lines.push(`📊 ${diff === 0 ? 'Matches exactly ✓' : diff > 0 ? `Extra: ${formatINR(diff)}` : `Short: ${formatINR(-diff)}`}`);
  }
  lines.push(`— ${input.shop.name}`);
  return lines.join('\n');
}
