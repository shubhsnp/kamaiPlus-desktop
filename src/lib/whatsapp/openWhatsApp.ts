/*
 * Opening WhatsApp (v4.79.0). In the desktop app the main process opens WhatsApp Desktop straight
 * away when it is installed (whatsapp://), else wa.me in the browser (WhatsApp Web); a message too
 * long for a link is copied instead and the chat opened empty — paste with Ctrl+V. In a plain
 * browser: wa.me in a new tab. Anything in the app asks for the WhatsApp window with
 * `openWhatsAppComposer(request)`; <WhatsAppHost> in the shell shows it.
 */

import type { LedgerTransaction, Sale } from '@/types';
import { getDesktopApi } from '@/lib/desktop/desktopBridge';
import { WHATSAPP_URL_LIMIT, whatsAppWebUrl } from './whatsappLinks';

export interface WhatsAppOpenResult {
  ok: boolean;
  /** 'app' = WhatsApp Desktop, 'web' = browser / WhatsApp Web. */
  via: 'app' | 'web';
  /** The text was put on the clipboard (too long for a link). */
  copied: boolean;
  error?: string;
}

export async function openWhatsApp(number: string | null, text: string): Promise<WhatsAppOpenResult> {
  const api = getDesktopApi();
  if (api?.openWhatsApp) {
    try {
      return await api.openWhatsApp({ phone: number || '', text });
    } catch (err: any) {
      return { ok: false, via: 'web', copied: false, error: err?.message || 'Could not open WhatsApp' };
    }
  }
  let url = whatsAppWebUrl(number, text);
  let copied = false;
  if (url.length > WHATSAPP_URL_LIMIT) {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {}
    url = whatsAppWebUrl(number, '');
  }
  // 'noopener' makes window.open return null even when the tab opened.
  window.open(url, '_blank', 'noopener');
  return { ok: true, via: 'web', copied };
}

/** What the WhatsApp window is asked to send. */
export type WhatsAppRequest =
  | { kind: 'bill'; sale: Sale }
  | { kind: 'khata'; customerId: string }
  | { kind: 'customer'; customerId: string }
  | { kind: 'slip'; entry: LedgerTransaction }
  | { kind: 'supplier'; supplierId: string }
  | { kind: 'payment'; amountPaise: number; customerName?: string; phone?: string }
  | {
      kind: 'text';
      title: string;
      message: string;
      phone?: string;
      recipientName?: string;
      /** Remember the number typed here as the owner's / CA's (Settings → WhatsApp). */
      remember?: 'owner' | 'ca';
    };

export const WHATSAPP_EVENT = 'kamai_open_whatsapp';

export function openWhatsAppComposer(request: WhatsAppRequest) {
  window.dispatchEvent(new CustomEvent<WhatsAppRequest>(WHATSAPP_EVENT, { detail: request }));
}
