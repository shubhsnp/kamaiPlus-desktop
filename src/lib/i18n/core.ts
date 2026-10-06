import type { SupportedLanguage } from '@/types';

/*
 * Translation core — plain module (no 'use client'), so every component and
 * helper can call `tr()`, including files that also render on the prerender pass.
 *
 * The English text is the message id: tr('Complete Sale & Print').
 * src/locales/hi.json / mr.json map it to the translation; a missing entry shows
 * English, so a new string never breaks a screen. Placeholders:
 * tr('Only {n} left', { n: 3 }). The I18nProvider remounts the app when the
 * language changes, so every tr() on screen re-runs.
 */

export type Messages = Record<string, string>;
export type TVars = Record<string, string | number | null | undefined>;

export const LANGUAGE_STORAGE_KEY = 'vyapar_language';
export const LANGUAGES: { code: SupportedLanguage; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'mr', label: 'मराठी' },
];

const loaders: Record<Exclude<SupportedLanguage, 'en'>, () => Promise<Messages>> = {
  hi: () => import('@/locales/hi.json').then((m) => ((m as { default?: Messages }).default || m) as Messages),
  mr: () => import('@/locales/mr.json').then((m) => ((m as { default?: Messages }).default || m) as Messages),
};
const cache: Partial<Record<SupportedLanguage, Messages>> = {};

/** The Hindi / Marathi table, fetched only when that language is chosen (null for English). */
export async function loadMessages(lang: SupportedLanguage): Promise<Messages | null> {
  if (lang === 'en') return null;
  if (!cache[lang]) cache[lang] = await loaders[lang]();
  return cache[lang] || null;
}

export function translate(table: Messages | null, text: string, vars?: TVars): string {
  let out = (table && table[text]) || text;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k] ?? '') : m));
  return out;
}

let currentLanguage: SupportedLanguage = 'en';
let currentTable: Messages | null = null;
// v4.107.0: a shop's own words (Restaurant mode: "Products" → "Menu"), applied before translating.
let currentWords: Messages | null = null;

/** Called by I18nProvider when the language (and its table) is ready. */
export function setActiveLanguage(lang: SupportedLanguage, table: Messages | null): void {
  currentLanguage = lang;
  currentTable = table;
}

/** Called by I18nProvider: the word swaps of the shop's mode (null = the app's own words). */
export function setActiveWords(words: Messages | null): void {
  currentWords = words;
}

/** The text with the shop's word swap applied (still English — translate it after). */
export const withWords = (text: string): string => (currentWords && currentWords[text]) || text;

/** Translate a UI text into the shop's chosen language. */
export function tr(text: string, vars?: TVars): string {
  return translate(currentTable, withWords(text), vars);
}

/**
 * Marks a text for translation where it is defined (e.g. a constant list); translate it with tr() where shown.
 * Generic so a `[msg('Today'), msg('7 Days')] as const` list keeps its literal types.
 */
export function msg<T extends string>(text: T): T {
  return text;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: msg('Cash'),
  upi: 'UPI',
  card: msg('Card'),
  bank_transfer: msg('Bank'),
  bank: msg('Bank'),
  credit: msg('Udhar'),
  split: msg('Split'),
  cheque: msg('Cheque'),
};

/** "cash" → "Cash" / "नकद" — for the payment badges on bills and ledger rows. */
export function paymentMethodLabel(method?: string | null): string {
  if (!method) return '';
  const label = PAYMENT_METHOD_LABELS[method];
  return label ? tr(label) : method.replace(/_/g, ' ');
}

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  tea_snacks: msg('Tea & Snacks'),
  delivery_fuel: msg('Delivery & Fuel'),
  transport: msg('Delivery & Fuel'),
  utilities: msg('Electricity'),
  electricity: msg('Electricity'),
  salary: msg('Staff Salary'),
  staff_salary: msg('Staff Salary'),
  vendor_payment: msg('Supplier Payment'),
  supplier_payout: msg('Supplier Payment'),
  cleaning: msg('Shop Maintenance'),
  shop_maintenance: msg('Shop Maintenance'),
  refund: msg('Refund'),
  misc: msg('Other'),
  other: msg('Other'),
};

/** "tea_snacks" → "Tea & Snacks" / "चाय-नाश्ता" — for the cash-register expense badges. */
export function expenseCategoryLabel(category?: string | null): string {
  if (!category) return '';
  const label = EXPENSE_CATEGORY_LABELS[category];
  return label ? tr(label) : category.replace(/_/g, ' ');
}

export function getLanguage(): SupportedLanguage {
  return currentLanguage;
}

export function readSavedLanguage(): SupportedLanguage {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return saved === 'hi' || saved === 'mr' ? saved : 'en';
  } catch {
    return 'en';
  }
}
