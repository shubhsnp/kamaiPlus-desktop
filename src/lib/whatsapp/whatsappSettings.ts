/*
 * WhatsApp message choices on this computer (v4.79.0): the language customers get, whether bills
 * and reminders carry a tap-to-pay UPI link, the shop's own sign-off, and the owner / CA numbers
 * that day reports and GST figures go to (asked once, then remembered).
 */

import type { SupportedLanguage } from '@/types';

export type WaLang = SupportedLanguage;

export interface WhatsAppSettings {
  /** Language of customer messages ('' = the app's language). */
  lang: WaLang | '';
  /** Add a "Pay by UPI" link when money is due. */
  payLink: boolean;
  /** Last line of customer messages ('' = the standard thank-you). */
  signOff: string;
  /** Save the bill PDF (to drag into the chat) when sending a bill. */
  attachPdf: boolean;
  ownerPhone: string;
  caPhone: string;
}

export const WHATSAPP_SETTINGS_KEY = 'kamai_whatsapp_settings';

export const DEFAULT_WHATSAPP_SETTINGS: WhatsAppSettings = {
  lang: '',
  payLink: true,
  signOff: '',
  attachPdf: false,
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
      attachPdf: s.attachPdf === true,
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
  } catch {}
  return next;
}
