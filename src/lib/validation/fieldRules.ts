import { msg, tr } from '@/lib/i18n/core';
import type { ValidationResult } from './validators';

/**
 * Field rules (v4.150.0): what each box lets in while typing, and the save-time checks for names,
 * birthdays, bank details and amounts. Re-exported by validators.ts.
 */

// -------------------------------------------------------------
// 1b. Typing filters (v4.150.0) — what a box lets in while the shopkeeper types
// -------------------------------------------------------------

/** Longest a box may grow; the save-time validators still check the exact shape. */
export const FIELD_MAX = {
  mobile: 10, pincode: 6, gstin: 15, pan: 10, ifsc: 11, bankAccount: 18, fssai: 14,
  name: 80, shopName: 100, email: 100, upi: 100, address: 250, year: 4,
} as const;

/** The digits of an Indian mobile: a leading +91 / 91 / 0 is dropped, nothing else. */
export function mobileDigits(v: string | null | undefined): string {
  const d = String(v ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) return d.slice(2);
  if (d.length === 11 && d.startsWith('0')) return d.slice(1);
  return d;
}

/** Mobile box: digits only, pasted "+91 98765 43210" becomes 9876543210, never more than 10. */
export function typeMobile(v: string): string {
  // "+91" / "0" typed in front (one key at a time) is dropped as it comes, not counted as digits.
  const raw = String(v ?? '').trim().replace(/^\+\s*9\s*1/, '').replace(/^\+\s*9?$/, '').replace(/^0+/, '');
  return mobileDigits(raw).slice(0, FIELD_MAX.mobile);
}

/** Digits only, at most `max` (pincode, FSSAI, bank account, year). */
export function typeDigits(v: string, max: number): string {
  return String(v ?? '').replace(/\D/g, '').slice(0, max);
}

/** GSTIN / PAN / IFSC box: capitals and digits only, at most `max`. */
export function typeCode(v: string, max: number): string {
  return String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, max);
}

/** Email / UPI box: no spaces, at most `max`. */
export function typeNoSpace(v: string, max: number = FIELD_MAX.email): string {
  return String(v ?? '').replace(/\s/g, '').slice(0, max);
}

/** Name box: no line breaks or double spaces, at most `max`. */
export function typeName(v: string, max: number = FIELD_MAX.name): string {
  return String(v ?? '').replace(/[\r\n\t]/g, ' ').replace(/ {2,}/g, ' ').replace(/^ +/, '').slice(0, max);
}

/** A person's or shop's name: 2+ letters, not only digits or symbols. */
export function validatePersonName(
  name: string | null | undefined,
  required = true,
  fieldLabel: string = msg('Name'),
  max: number = FIELD_MAX.name
): ValidationResult {
  const clean = String(name ?? '').trim().replace(/\s+/g, ' ');
  if (!clean) {
    if (!required) return { isValid: true, cleanedValue: '' };
    return { isValid: false, error: tr('{fieldLabel} is required.', { fieldLabel: tr(fieldLabel) }) };
  }
  if (clean.length < 2) return { isValid: false, error: tr('{fieldLabel} must be at least 2 characters long.', { fieldLabel: tr(fieldLabel) }) };
  if (clean.length > max) return { isValid: false, error: tr('{fieldLabel} cannot be longer than {max} characters.', { fieldLabel: tr(fieldLabel), max }) };
  if (!HAS_LETTER.test(clean)) return { isValid: false, error: tr('{fieldLabel} must have letters, not only numbers or symbols.', { fieldLabel: tr(fieldLabel) }) };
  return { isValid: true, cleanedValue: clean };
}

// Any script's letters (Hindi / Marathi names too); built at runtime because tsconfig targets ES5.
const HAS_LETTER = new RegExp('\\p{L}', 'u');

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * A stored birthday / anniversary → its parts. Reads YYYY-MM-DD (PC), MM-DD (the phone keeps
 * no year) and the old free-text DD-MM-YYYY / DD/MM/YYYY. Unreadable → null.
 */
export function parseDayMonth(v: string | null | undefined): { day: number; month: number; year?: number } | null {
  const s = String(v ?? '').trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return okDayMonth(+m[3], +m[2], +m[1]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m) return okDayMonth(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return okDayMonth(+m[2], +m[1]);
  return null;
}

function okDayMonth(day: number, month: number, year?: number) {
  if (month < 1 || month > 12 || day < 1 || day > DAYS_IN_MONTH[month - 1]) return null;
  if (year !== undefined && month === 2 && day === 29 && !(year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0))) return null;
  return year === undefined ? { day, month } : { day, month, year };
}

/**
 * Birthday / anniversary from day + month (+ optional year). Stored as YYYY-MM-DD, or MM-DD
 * without a year — the cloud sends MM-DD to the phone either way.
 */
export function validateDayMonth(
  input: { day: string; month: string; year?: string },
  fieldLabel: string = msg('Birthday')
): ValidationResult {
  const { day, month } = input;
  const year = (input.year || '').trim();
  if (!day && !month && !year) return { isValid: true, cleanedValue: '' };
  if (!day || !month) return { isValid: false, error: tr('{fieldLabel}: choose both the day and the month.', { fieldLabel: tr(fieldLabel) }) };
  const thisYear = new Date().getFullYear();
  if (year && (!/^\d{4}$/.test(year) || +year < 1900 || +year > thisYear)) {
    return { isValid: false, error: tr('{fieldLabel}: the year must be between 1900 and {thisYear}.', { fieldLabel: tr(fieldLabel), thisYear }) };
  }
  const p = okDayMonth(+day, +month, year ? +year : undefined);
  if (!p) return { isValid: false, error: tr('{fieldLabel}: this date does not exist.', { fieldLabel: tr(fieldLabel) }) };
  const mm = String(p.month).padStart(2, '0');
  const dd = String(p.day).padStart(2, '0');
  if (year) {
    const iso = `${year}-${mm}-${dd}`;
    const t = new Date();
    const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    if (iso > today) return { isValid: false, error: tr('{fieldLabel} cannot be in the future.', { fieldLabel: tr(fieldLabel) }) };
    return { isValid: true, cleanedValue: iso };
  }
  return { isValid: true, cleanedValue: `${mm}-${dd}` };
}

/** Biggest rupee amount one box takes (₹10 crore) — a stray extra zero is caught, not saved. */
export const MAX_AMOUNT_RUPEES = 10_00_00_000;

/** Amount box: digits, one dot, 2 paise digits; a leading minus only when `allowNegative`. */
export function typeAmount(v: string, allowNegative = false): string {
  let s = String(v ?? '').replace(allowNegative ? /[^\d.-]/g : /[^\d.]/g, '');
  const neg = allowNegative && s.startsWith('-');
  s = s.replace(/-/g, '');
  const [int = '', ...rest] = s.split('.');
  const out = int.slice(0, 9) + (rest.length ? '.' + rest.join('').slice(0, 2) : '');
  return (neg ? '-' : '') + out;
}

/** A typed rupee amount: a number, at most 2 paise digits, inside 0 (or -max) … ₹10 crore. */
export function validateAmount(
  text: string | null | undefined,
  opts: { label?: string; required?: boolean; allowNegative?: boolean; allowZero?: boolean } = {}
): ValidationResult {
  const label = opts.label || msg('Amount');
  const s = String(text ?? '').trim();
  if (!s) return opts.required ? { isValid: false, error: tr('{fieldLabel} is required.', { fieldLabel: tr(label) }) } : { isValid: true, cleanedValue: 0 };
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return { isValid: false, error: tr('{fieldLabel}: enter a number with at most 2 digits after the dot.', { fieldLabel: tr(label) }) };
  const n = Number(s);
  if (n < 0 && !opts.allowNegative) return { isValid: false, error: tr('{fieldLabel} cannot be negative.', { fieldLabel: tr(label) }) };
  if (n === 0 && opts.required && !opts.allowZero) return { isValid: false, error: tr('{fieldLabel} must be more than ₹0.', { fieldLabel: tr(label) }) };
  if (Math.abs(n) > MAX_AMOUNT_RUPEES) return { isValid: false, error: tr('{fieldLabel} looks too big (more than ₹10 crore). Check the zeros.', { fieldLabel: tr(label) }) };
  return { isValid: true, cleanedValue: Math.round(n * 100) };
}

/** Indian bank IFSC: 4 letters, 0, 6 letters/digits (e.g. SBIN0001234). */
export function validateIfsc(ifsc: string | null | undefined, required = false): ValidationResult {
  const clean = String(ifsc ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) return required ? { isValid: false, error: tr('IFSC code is required.') } : { isValid: true, cleanedValue: '' };
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(clean)) return { isValid: false, error: tr('Please enter a valid 11-character IFSC code (e.g. SBIN0001234).') };
  return { isValid: true, cleanedValue: clean };
}

/** Bank account number: 9 to 18 digits. */
export function validateBankAccount(acc: string | null | undefined, required = false): ValidationResult {
  const clean = String(acc ?? '').replace(/\D/g, '');
  if (!clean) return required ? { isValid: false, error: tr('Bank account number is required.') } : { isValid: true, cleanedValue: '' };
  if (clean.length < 9 || clean.length > 18) return { isValid: false, error: tr('Bank account number must be 9 to 18 digits.') };
  return { isValid: true, cleanedValue: clean };
}
