/*
 * v4.185.0 (Rahul 2026-11-15): with this PC's WhatsApp linked (Settings → WhatsApp → Connect, main
 * process waLink.js), a bill with the customer's mobile goes by itself — the A4 PDF with the bill
 * message as its caption, from the shop's own number, no WhatsApp window, no Send press.
 *
 * Called after the bill is saved (counter Complete Sale, restaurant Settle) and NEVER awaited there:
 * the counter never waits for WhatsApp (Bible §6.1). It starts a moment later, so the bill's own
 * print job goes first. The result per bill is kept (localStorage, last 300) for the bill window:
 * "Sent on WhatsApp ✓" / "Not sent … Send again".
 */

import type { Business, Sale } from '@/types';
import { db } from '@/lib/db';
import { getDesktopApi } from '@/lib/desktop/desktopBridge';
import { reportError } from '@/lib/diagnostics/errorReporter';
import { getLanguage } from '@/lib/i18n/core';
import { getPrimaryUpiVpa } from '@/lib/invoices/invoiceDocument';
import { isEstimate } from '@/lib/sales/saleMath';
import { billMessage } from './customerMessages';
import { messageShop } from './whatsappDrafts';
import { getWhatsAppSettings } from './whatsappSettings';

export type WaSendState = 'sending' | 'sent' | 'failed';

export interface WaSendRecord {
  state: WaSendState;
  phone: string;
  at: string;
  error?: string;
}

export const WA_AUTO_SENT_KEY = 'kamai_wa_auto_sent';
export const WA_AUTO_SENT_EVENT = 'kamai_wa_auto_sent_changed';
const KEEP = 300;
/** Wait after the bill is saved, so its own print / PDF job goes first. */
export const AUTO_SEND_DELAY_MS = 1500;

/** Why a bill does not go by itself ('' = it goes). */
export function autoSendSkip(sale: Pick<Sale, 'status' | 'invoice_number'>, o: { autoSend: boolean; linked: boolean; phone: string }): string {
  if (!o.autoSend) return 'off';
  if (!o.linked) return 'not-linked';
  if (isEstimate(sale)) return 'estimate';
  if (String(o.phone || '').replace(/\D/g, '').length < 10) return 'no-mobile';
  return '';
}

/** Newest `keep` records only (by time). */
export function trimSendLog(log: Record<string, WaSendRecord>, keep = KEEP): Record<string, WaSendRecord> {
  const entries = Object.entries(log);
  if (entries.length <= keep) return log;
  return Object.fromEntries(entries.sort((a, b) => b[1].at.localeCompare(a[1].at)).slice(0, keep));
}

export function readSendLog(): Record<string, WaSendRecord> {
  try {
    const raw = JSON.parse(localStorage.getItem(WA_AUTO_SENT_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

export function waSendRecord(saleId: string): WaSendRecord | undefined {
  return readSendLog()[saleId];
}

function writeRecord(saleId: string, record: WaSendRecord) {
  try {
    localStorage.setItem(WA_AUTO_SENT_KEY, JSON.stringify(trimSendLog({ ...readSendLog(), [saleId]: record })));
  } catch (e) {
    reportError('storage', e, 'WhatsApp send log not saved');
  }
  try {
    window.dispatchEvent(new CustomEvent(WA_AUTO_SENT_EVENT, { detail: { saleId } }));
  } catch { /* not in a browser */ }
}

/**
 * Sends one bill through the linked WhatsApp. `byHand` = the shop pressed "Send again" (the
 * auto-send switch does not matter then). Never throws.
 */
export async function sendBillByLink(sale: Sale, business: Business, byHand = false): Promise<WaSendRecord | null> {
  const api = getDesktopApi();
  if (!api?.waLinkSend || !api.waLinkStatus) return null;
  const settings = getWhatsAppSettings();
  const customer = sale.customer_id ? await db.customers.get(sale.customer_id) : undefined;
  const phone = sale.customer_phone || customer?.phone || '';
  const status = await api.waLinkStatus();
  const skip = autoSendSkip(sale, { autoSend: byHand || settings.autoSendBills, linked: Boolean(status.linked), phone });
  if (skip) return null;
  writeRecord(sale.id, { state: 'sending', phone, at: new Date().toISOString() });
  try {
    const { saveInvoicePdf } = await import('@/lib/invoices/invoiceOutput');
    const pdf = await saveInvoicePdf({ sale, business, customer, upiVpa: getPrimaryUpiVpa(business) });
    const text = billMessage(sale, messageShop(business), { lang: settings.lang || getLanguage(), payLink: settings.payLink, signOff: settings.signOff });
    const res = await api.waLinkSend({ phone, text, file: pdf.ok && pdf.path ? pdf.path : undefined, fileName: `Bill_${sale.invoice_number}.pdf` });
    const record: WaSendRecord = res.ok
      ? { state: 'sent', phone, at: new Date().toISOString() }
      : { state: 'failed', phone, at: new Date().toISOString(), error: res.error || 'error' };
    writeRecord(sale.id, record);
    return record;
  } catch (e) {
    const record: WaSendRecord = { state: 'failed', phone, at: new Date().toISOString(), error: (e instanceof Error && e.message) || 'error' };
    writeRecord(sale.id, record);
    reportError('whatsapp', e, `Bill ${sale.invoice_number} not sent by the linked WhatsApp`);
    return record;
  }
}

/** After a bill is saved: send it by itself when this PC's WhatsApp is linked and the switch is on. */
export function autoSendBill(sale: Sale, business: Business | null | undefined): void {
  if (!business || !getWhatsAppSettings().autoSendBills || !getDesktopApi()?.waLinkSend) return;
  setTimeout(() => { void sendBillByLink(sale, business); }, AUTO_SEND_DELAY_MS);
}
