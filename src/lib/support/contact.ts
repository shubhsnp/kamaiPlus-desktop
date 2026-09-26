import { APP_VERSION } from '@/lib/constants/version';

/*
 * KamaiPlus support contacts — the one place they are written down. Every screen
 * that shows "contact support" (licence, lockout, forgotten password, Help &
 * Support) takes them from here, and so does site/index.html (by hand).
 *
 * Links are plain https so Electron's window-open handler hands them to the
 * system browser (WhatsApp Desktop / Web, Gmail) — see main.js.
 */

export const SUPPORT_PHONE_DIGITS = '918669997711';
export const SUPPORT_PHONE_DISPLAY = '+91 86699 97711';
export const SUPPORT_EMAIL = 'kamaiplus.app@gmail.com';

/** wa.me caps what a link can carry; long error reports are cut to this. */
const MAX_LINK_TEXT = 1800;

function clip(text: string): string {
  return text.length > MAX_LINK_TEXT ? `${text.slice(0, MAX_LINK_TEXT)}\n…` : text;
}

/** Opens a WhatsApp chat with support, message already typed. */
export function supportWhatsAppUrl(message: string): string {
  return `https://wa.me/${SUPPORT_PHONE_DIGITS}?text=${encodeURIComponent(clip(message))}`;
}

/** Opens a Gmail compose window to support (works without a mail app on the PC). */
export function supportEmailUrl(subject: string, body: string): string {
  const q = new URLSearchParams({ view: 'cm', fs: '1', to: SUPPORT_EMAIL, su: subject, body: clip(body) });
  return `https://mail.google.com/mail/?${q.toString()}`;
}

/** First line of every support message: who is writing, from which version. */
export function supportGreeting(shopName?: string | null): string {
  const shop = shopName && shopName.trim() ? ` — ${shopName.trim()}` : '';
  return `Namaste KamaiPlus team${shop}. KamaiPlus Desktop v${APP_VERSION}.`;
}
