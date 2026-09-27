import { Customer } from '@/types';
import { tr } from '@/lib/i18n/core';
import { validateIndianPhone } from '@/lib/validation/validators';

/**
 * The customer typed on the POS counter row (name and / or mobile) when nobody was
 * picked from the list. No pop-up: it is resolved when the bill is completed —
 *
 *   mobile a saved customer already has          → that customer
 *   name exactly one saved customer has           → that customer (their missing mobile is filled in)
 *   name several saved customers have, no mobile  → refused: pick one or add the mobile
 *   anything else                                 → a new customer, saved with the bill
 *
 * A number typed in the name box counts as the mobile, so one box is enough.
 */
export interface CustomerDraft {
  name: string;
  phone: string;
}

export type BillCustomerResolution =
  | { kind: 'none' }
  | { kind: 'existing'; customer: Customer; addPhone?: string }
  | { kind: 'new'; name: string; phone: string }
  | { kind: 'error'; message: string; field: 'name' | 'phone' };

const digits = (s?: string) => (s || '').replace(/\D/g, '');
const cleanName = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

/** A saved customer's mobile as its last 10 digits ('' when it has none). */
export const mobileKey = (phone?: string): string => {
  const d = digits(phone);
  return d.length >= 10 ? d.slice(-10) : '';
};

/** Name and mobile digits from the two boxes; digits typed in the name box are the mobile. */
export function splitDraft(draft: CustomerDraft): { name: string; phoneDigits: string } {
  const name = (draft.name || '').trim();
  const phoneDigits = digits(draft.phone);
  if (!phoneDigits && /^[\d\s+-]+$/.test(name) && digits(name).length >= 3) {
    return { name: '', phoneDigits: digits(name) };
  }
  return { name, phoneDigits };
}

export const isDraftEmpty = (draft: CustomerDraft): boolean => {
  const { name, phoneDigits } = splitDraft(draft);
  return !name && !phoneDigits;
};

/** Saved customers matching what is typed: exact mobile / name first, then starts-with, then contains. */
export function suggestCustomers(customers: Customer[], draft: CustomerDraft, limit = 8): Customer[] {
  const { name, phoneDigits } = splitDraft(draft);
  const q = cleanName(name);
  if (!q && !phoneDigits) return [];
  const scored: { c: Customer; score: number }[] = [];
  for (const c of customers) {
    let score = 0;
    const cDigits = digits(c.phone);
    if (phoneDigits && cDigits) {
      if (phoneDigits.length >= 10 && mobileKey(c.phone) === phoneDigits.slice(-10)) score = 100;
      else if (cDigits.includes(phoneDigits)) score = 60;
    }
    if (q) {
      const cName = cleanName(c.name || '');
      if (cName === q) score = Math.max(score, 90);
      else if (cName.startsWith(q)) score = Math.max(score, 70);
      else if (cName.includes(q)) score = Math.max(score, 50);
    }
    if (score > 0) scored.push({ c, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name))
    .slice(0, limit)
    .map((s) => s.c);
}

export function resolveBillCustomer(customers: Customer[], draft: CustomerDraft): BillCustomerResolution {
  const { name, phoneDigits } = splitDraft(draft);
  if (!name && !phoneDigits) return { kind: 'none' };

  const sameName = name ? customers.filter((c) => cleanName(c.name || '') === cleanName(name)) : [];

  if (phoneDigits) {
    const check = validateIndianPhone(phoneDigits, true);
    if (!check.isValid) return { kind: 'error', field: 'phone', message: check.error || tr('Please enter a valid 10-digit mobile number.') };
    const phone = String(check.cleanedValue);
    const byPhone = customers.find((c) => mobileKey(c.phone) === phone);
    if (byPhone) return { kind: 'existing', customer: byPhone };
    // "Ramesh" saved from the khata without a number, now typed with one: same person.
    const noPhone = sameName.filter((c) => !mobileKey(c.phone));
    if (sameName.length === 1 && noPhone.length === 1) return { kind: 'existing', customer: noPhone[0], addPhone: phone };
    return { kind: 'new', name: name || phone, phone };
  }

  if (sameName.length === 1) return { kind: 'existing', customer: sameName[0] };
  if (sameName.length > 1) {
    return { kind: 'error', field: 'name', message: tr('More than one saved customer is named "{name}". Pick one from the list, or add the mobile number.', { name }) };
  }
  return { kind: 'new', name, phone: '' };
}

/** The customer row saved when a bill is completed for someone new. */
export function buildBillCustomer(id: string, businessId: string, name: string, phone: string, now: string): Customer {
  return {
    id,
    business_id: businessId,
    name: name.trim(),
    phone,
    opening_balance: 0,
    current_balance: 0,
    loyalty_points: 0,
    total_spent: 0,
    total_visits: 1,
    customer_type: 'regular',
    created_at: now,
    updated_at: now,
    sync_status: 'synced',
  };
}
