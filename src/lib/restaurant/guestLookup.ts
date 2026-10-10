import type { Sale } from '@/types';
import { cleanGuestPhone } from '@/lib/restaurant/settle';

/*
 * "New delivery" (v4.143.0): a mobile number the shop has delivered to before fills the name and the last
 * address by itself. A paid delivery is saved as customer_name "Ramesh · Delivery DL-04" and notes
 * "Delivery DL-04 · <address>" (settle.ts); a khata customer with that mobile counts too.
 */

export interface KnownGuest {
  name: string;
  address: string;
}

/** The address of a paid delivery bill, or '' (a table / takeaway bill has none). */
export function deliveryAddressOf(notes?: string): string {
  const m = /^Delivery [^·]+ · (.+)$/.exec((notes || '').trim());
  return m ? m[1].trim() : '';
}

/** The guest's own name from "Ramesh · Delivery DL-04" ('' when the bill had only the order's name). */
export function guestNameOf(customerName?: string): string {
  const parts = (customerName || '').split(' · ');
  return parts.length > 1 ? parts[0].trim() : '';
}

/** Newest first: the last delivery to this mobile, else a customer with it. Pure — the caller reads Dexie. */
export function pickKnownGuest(phone: string, sales: Pick<Sale, 'customer_phone' | 'customer_name' | 'notes' | 'created_at'>[], customers: { name?: string; phone?: string; address?: string }[]): KnownGuest | null {
  const p = cleanGuestPhone(phone);
  if (!p) return null;
  const last = sales
    .filter((s) => cleanGuestPhone(s.customer_phone) === p && deliveryAddressOf(s.notes))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
  const customer = customers.find((c) => cleanGuestPhone(c.phone) === p);
  if (!last && !customer) return null;
  return {
    name: (last && guestNameOf(last.customer_name)) || customer?.name?.trim() || '',
    address: (last && deliveryAddressOf(last.notes)) || customer?.address?.trim() || '',
  };
}

/** Reads the last 400 bills and the customers with this mobile. Never throws. */
export async function findKnownGuest(phone: string): Promise<KnownGuest | null> {
  const p = cleanGuestPhone(phone);
  if (!p) return null;
  try {
    const { db } = await import('@/lib/db');
    const [sales, customers] = await Promise.all([
      db.sales.orderBy('created_at').reverse().limit(400).toArray(),
      db.customers.where('phone').anyOf([p, `+91${p}`, `91${p}`, `0${p}`]).toArray(),
    ]);
    return pickKnownGuest(p, sales, customers);
  } catch {
    return null;
  }
}
