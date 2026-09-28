/*
 * WhatsApp links (v4.79.0) — the same rules as the Android app (AppValidators.formatWhatsAppPhone,
 * buildClickableUpiLink), so a customer gets the same message from the phone and the counter.
 */

/** Longer links fail to open on Windows; the text is then copied and the chat opened without it. */
export const WHATSAPP_URL_LIMIT = 2000;

/** First-party page that turns a tappable https link into the phone's UPI app (Android repo: pay_redirect/). */
export const UPI_PAY_PAGE = 'https://kamaiplus-pay.web.app/';

/**
 * A number WhatsApp understands: 91 + a 10-digit Indian mobile (leading 0 / +91 / spaces removed),
 * or a number typed with + (another country, 8–15 digits). Anything else → null.
 */
export function toWhatsAppNumber(raw: string | null | undefined): string | null {
  const text = String(raw || '').trim();
  let digits = text.replace(/\D/g, '');
  if (!digits) return null;
  if (text.startsWith('+') && !digits.startsWith('91')) return digits.length >= 8 && digits.length <= 15 ? digits : null;
  digits = digits.replace(/^0+/, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  return digits.length === 10 && /^[6-9]/.test(digits) ? `91${digits}` : null;
}

/** 91XXXXXXXXXX → "+91 98765 43210" for the screen. */
export function displayWhatsAppNumber(number: string): string {
  return /^91\d{10}$/.test(number) ? `+91 ${number.slice(2, 7)} ${number.slice(7)}` : `+${number}`;
}

/** wa.me link: with a number opens that chat, without one lets the shop pick the chat. */
export function whatsAppWebUrl(number: string | null, text: string): string {
  const base = number ? `https://wa.me/${number}` : 'https://wa.me/';
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** Rupees with 2 decimals as the UPI `am` field wants it ("150.00"). */
export function upiAmount(paise: number): string {
  return (Math.max(0, Math.round(paise)) / 100).toFixed(2);
}

/**
 * A tappable UPI payment link for message text — WhatsApp does not link `upi://`, so it goes
 * through the shop-owned pay page, which opens the customer's UPI app with the amount filled.
 */
export function upiPayLink(input: { upiId: string; payeeName: string; amountPaise?: number; note?: string }): string {
  const upiId = input.upiId.trim();
  if (!upiId) return '';
  const amount = input.amountPaise && input.amountPaise > 0 ? upiAmount(input.amountPaise) : '';
  let upi = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(input.payeeName)}`;
  if (amount) upi += `&am=${amount}`;
  upi += '&cu=INR';
  if (input.note) upi += `&tn=${encodeURIComponent(input.note)}`;
  const q = [`u=${encodeURIComponent(upi)}`, `s=${encodeURIComponent(input.payeeName)}`];
  if (amount) q.push(`a=${amount}`);
  return `${UPI_PAY_PAGE}?${q.join('&')}`;
}
