/*
 * WhatsApp message choices on this computer (v4.79.0): the language customers get, whether bills
 * and reminders carry a tap-to-pay UPI link, the shop's own sign-off, and the owner / CA numbers
 * that day reports and GST figures go to (asked once, then remembered).
 */

import type { SupportedLanguage } from '@/types';
import { reportError } from '@/lib/diagnostics/errorReporter';

export type WaLang = SupportedLanguage;

export interface WhatsAppSettings {
  /** Language of customer messages ('' = the app's language). */
  lang: WaLang | '';
  /** Add a "Pay by UPI" link when money is due. */
  payLink: boolean;
  /** Last line of customer messages ('' = the standard thank-you). */
  signOff: string;
  /** Send the bill PDF with a bill (copied as a file: Ctrl+V in the chat). On unless the shop turned it off (v4.133.0). */
  attachPdf: boolean;
  ownerPhone: string;
  caPhone: string;
}

export const WHATSAPP_SETTINGS_KEY = 'kamai_whatsapp_settings';

export const DEFAULT_WHATSAPP_SETTINGS: WhatsAppSettings = {
  lang: '',
  payLink: true,
  signOff: '',
  attachPdf: true,
  ownerPhone: '',
  caPhone: '',
};

const LANGS: WaLang[] = ['en', 'hi', 'mr'];

export function parseWhatsAppSettings(raw: string | null | undefined): WhatsAppSettings {
  const d = DEFAULT_WHATSAPP_SETTINGS;
  if (!raw) return { ...d };
  try {
    const s = JSON.parse(raw) || {};
    return {
      lang: LANGS.includes(s.lang) ? s.lang : '',
      payLink: typeof s.payLink === 'boolean' ? s.payLink : d.payLink,
      signOff: typeof s.signOff === 'string' ? s.signOff.slice(0, 200) : '',
      attachPdf: typeof s.attachPdf === 'boolean' ? s.attachPdf : d.attachPdf,
      ownerPhone: typeof s.ownerPhone === 'string' ? s.ownerPhone : '',
      caPhone: typeof s.caPhone === 'string' ? s.caPhone : '',
    };
  } catch {
    return { ...d };
  }
}

export function getWhatsAppSettings(): WhatsAppSettings {
  try {
    return parseWhatsAppSettings(localStorage.getItem(WHATSAPP_SETTINGS_KEY));
  } catch {
    return { ...DEFAULT_WHATSAPP_SETTINGS };
  }
}

export function saveWhatsAppSettings(patch: Partial<WhatsAppSettings>): WhatsAppSettings {
  const next = { ...getWhatsAppSettings(), ...patch };
  try {
    localStorage.setItem(WHATSAPP_SETTINGS_KEY, JSON.stringify(next));
  } catch (e) {
    reportError('storage', e, 'WhatsApp settings not saved');
  }
  return next;
}

/*
 * v4.181.0: numbers a bill PDF was put into WhatsApp for (number → time). WhatsApp keeps a file
 * preview the shop did not Send / ✕ in that chat, and a new PDF then does not go in — the window
 * says so when the same number gets another bill within a day.
 */
export const WHATSAPP_PREPARED_KEY = 'kamai_wa_prepared';
const PREPARED_MS = 24 * 60 * 60 * 1000;

function readPrepared(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(WHATSAPP_PREPARED_KEY) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

export function markBillPrepared(number: string, now = Date.now()) {
  const kept = Object.fromEntries(Object.entries(readPrepared()).filter(([, t]) => typeof t === 'number' && now - t < PREPARED_MS));
  try {
    localStorage.setItem(WHATSAPP_PREPARED_KEY, JSON.stringify({ ...kept, [number]: now }));
  } catch {}
}

export function billPreparedRecently(number: string | null, now = Date.now()): boolean {
  if (!number) return false;
  const t = readPrepared()[number];
  return typeof t === 'number' && now - t < PREPARED_MS;
}
