/*
 * Messages a customer gets on WhatsApp (v4.79.0) — bill, udhar reminder, khata slip, greeting,
 * payment request. Same content as the Android app, plus: quantities with their unit, the payment
 * split, what is still due with a tap-to-pay UPI link, and the language the shop picks.
 */

import type { CartItem, LedgerTransaction, Sale } from '@/types';
import { formatINR } from '@/lib/utils';
import { formatQty } from '@/lib/invoices/invoiceDocument';
import { getSalePaymentBreakdown, isEstimate } from '@/lib/sales/saleMath';
import { upiPayLink } from './whatsappLinks';
import { fill, WA_WORDS, WaWords } from './whatsappText';
import type { WaLang } from './whatsappSettings';

export interface MessageShop {
  name: string;
  phone?: string;
  upiId?: string;
}

export interface MessageOptions {
  lang: WaLang;
  payLink: boolean;
  /** The shop's own last line ('' = the standard thank-you). */
  signOff?: string;
}

export type ReminderTone = 'friendly' | 'formal';

const SEP = '--------------------------';
/** More lines than this make a link too long to open; the rest is summed up. */
export const MAX_BILL_LINES = 25;

export function messageDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

function footer(shop: MessageShop, w: WaWords, o: MessageOptions): string[] {
  return ['', (o.signOff || '').trim() || w.thanks, `— ${shop.name}${shop.phone ? ` • ${shop.phone}` : ''}`];
}

/** "Pay by UPI" link + UPI ID lines for money still due. */
function payLines(shop: MessageShop, w: WaWords, o: MessageOptions, duePaise: number, note: string): string[] {
  const upi = (shop.upiId || '').trim();
  if (!upi) return [];
  const lines: string[] = [];
  if (o.payLink && duePaise > 0) lines.push(`👉 ${w.payLink}: ${upiPayLink({ upiId: upi, payeeName: shop.name, amountPaise: duePaise, note })}`);
  lines.push(`📌 ${w.upiId}: ${upi}`);
  return lines;
}

function itemLine(it: CartItem): string {
  const unit = it.unit && it.unit !== 'piece' ? ` ${it.unit}` : '';
  return `• ${formatQty(it.quantity)}${unit} × ${it.product_name} = ${formatINR(it.total_amount)}`;
}

/** The bill as a WhatsApp message. */
export function billMessage(sale: Sale, shop: MessageShop, o: MessageOptions): string {
  const w = WA_WORDS[o.lang];
  const estimate = isEstimate(sale);
  const items = sale.items || [];
  const lines = [`🧾 *${estimate ? w.estimate : w.invoice} #${sale.invoice_number}*`, `🏪 *${shop.name}*`];
  if (sale.customer_name) lines.push(`👤 ${w.customer}: ${sale.customer_name}`);
  lines.push(`📅 ${w.date}: ${messageDate(sale.created_at)}`, SEP);
  items.slice(0, MAX_BILL_LINES).forEach((it) => lines.push(itemLine(it)));
  if (items.length > MAX_BILL_LINES) lines.push(fill(w.moreItems, { count: items.length - MAX_BILL_LINES }));
  lines.push(SEP);
  if ((sale.discount_total || 0) > 0) lines.push(`${w.discount}: -${formatINR(sale.discount_total)}`);
  lines.push(`💰 *${w.total}: ${formatINR(sale.grand_total)}*`);
  if (!estimate) {
    const pay = getSalePaymentBreakdown(sale);
    const parts = (['cash', 'upi', 'card'] as const).filter((k) => pay[k] > 0).map((k) => `${w.methods[k]} ${formatINR(pay[k])}`);
    if (parts.length) lines.push(`💳 ${w.paid}: ${parts.join(' • ')}`);
    else if (pay.credit > 0) lines.push(`💳 ${w.methods.credit}`);
  }
  if ((sale.returned_amount || 0) > 0) lines.push(`↩ ${w.returned}: -${formatINR(sale.returned_amount || 0)}`);
  const due = estimate ? 0 : Math.max(0, sale.balance_due || 0);
  if (due > 0) lines.push(`🔴 *${w.due}: ${formatINR(due)}*`);
  lines.push(...payLines(shop, w, o, due, `Bill ${sale.invoice_number}`));
  return [...lines, ...footer(shop, w, o)].join('\n');
}

/** Udhar reminder (or "settled" / "advance" when nothing is due). */
export function khataReminderMessage(customer: { name: string; balancePaise: number }, shop: MessageShop, o: MessageOptions, tone: ReminderTone): string {
  const w = WA_WORDS[o.lang];
  const bal = customer.balancePaise || 0;
  const lines = [fill(w.dear, { name: customer.name }), ''];
  if (bal > 0) {
    lines.push(fill(tone === 'formal' ? w.reminderFormal : w.reminderFriendly, { store: shop.name, amount: formatINR(bal) }));
    const pay = payLines(shop, w, o, bal, `Khata ${customer.name}`);
    if (pay.length) lines.push('', ...pay);
  } else if (bal < 0) {
    lines.push(fill(w.advance, { store: shop.name, amount: formatINR(-bal) }));
  } else {
    lines.push(fill(w.settled, { store: shop.name }));
  }
  if (bal > 0) lines.push('', w.reminderThanks);
  lines.push(`— ${shop.name}${shop.phone ? ` • ${shop.phone}` : ''}`);
  return lines.join('\n');
}

/** A friendly hello from the shop (with the balance line when something is due). */
export function customerGreetingMessage(customer: { name: string; balancePaise: number }, shop: MessageShop, o: MessageOptions): string {
  const w = WA_WORDS[o.lang];
  const lines = [fill(w.dear, { name: customer.name }), '', fill(w.greeting, { store: shop.name })];
  if (customer.balancePaise > 0) lines.push(fill(w.reminderFriendly, { store: shop.name, amount: formatINR(customer.balancePaise) }));
  return [...lines, ...footer(shop, w, o)].join('\n');
}

/** One khata entry as a slip: what happened and the balance after it. */
export function ledgerSlipMessage(entry: LedgerTransaction, customerName: string, shop: MessageShop, o: MessageOptions): string {
  const w = WA_WORDS[o.lang];
  const credit = entry.transaction_type === 'CREDIT_SALE' || entry.transaction_type === 'OPENING_BALANCE';
  const lines = [`🧾 *${w.slipTitle}*`, `🏪 *${shop.name}*`, `👤 ${w.customer}: ${customerName}`, `📅 ${w.date}: ${messageDate(entry.created_at)}`, SEP];
  lines.push(`${credit ? `🔴 ${w.creditGiven}` : `🟢 ${w.paymentReceived}`}: ${formatINR(entry.amount)}`);
  if (entry.notes) lines.push(`📝 ${w.note}: ${entry.notes}`);
  lines.push(SEP);
  const bal = entry.balance_after || 0;
  lines.push(bal < 0 ? fill(w.advance, { store: shop.name, amount: formatINR(-bal) }) : `💰 *${w.balance}: ${formatINR(bal)}*`);
  if (bal > 0) lines.push(...payLines(shop, w, o, bal, `Khata ${customerName}`));
  return [...lines, ...footer(shop, w, o)].join('\n');
}

/** "Please pay ₹X" with the tap-to-pay link — from the UPI QR on the counter. */
export function paymentRequestMessage(customerName: string, amountPaise: number, shop: MessageShop, o: MessageOptions): string {
  const w = WA_WORDS[o.lang];
  const lines = [fill(w.dear, { name: customerName }), '', `🏪 *${shop.name}*`, `💰 *${w.amountToPay}: ${formatINR(amountPaise)}*`];
  lines.push(...payLines(shop, w, { ...o, payLink: true }, amountPaise, 'Bill payment'));
  return [...lines, '', w.reminderThanks, `— ${shop.name}${shop.phone ? ` • ${shop.phone}` : ''}`].join('\n');
}
