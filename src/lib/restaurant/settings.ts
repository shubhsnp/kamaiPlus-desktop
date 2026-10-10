/*
 * Restaurant mode — the shop's own set-up (v4.106.0). Per computer, localStorage, like the other
 * counter settings. Everything here can be changed by the shop at any time (Tables → Set-up).
 *
 * Money is integer paise; percentages are plain numbers (5 = 5 %).
 */

export interface RestAddOn {
  name: string;
  /** Extra charge for one piece, paise (0 = free, e.g. "Less spicy"). */
  pricePaise: number;
}

export interface RestaurantSettings {
  /** Table names shown on the Tables screen, in order ("T1", "T2", "Garden 1"…). */
  tables: string[];
  /** GST on the whole bill. 5 % (no input credit) is the usual restaurant rate. */
  gstRate: number;
  /** true = menu prices already include GST; false = GST is added on top. */
  gstInclusive: boolean;
  /** Service charge on the food value, in % (0 = none). */
  serviceChargePercent: number;
  /** Fixed packing charge added to every takeaway bill, paise (0 = none). */
  packingChargePaise: number;
  /** v4.139.0: fixed delivery charge on every delivery order, paise (0 = none). */
  deliveryChargePaise: number;
  /** Add-ons the waiter can pick from (a custom one can be typed too). */
  addOns: RestAddOn[];
  /**
   * v4.140.0: this PC prints the KOTs the shop's other devices (a waiter's phone) send to the kitchen.
   * One PC per shop — the one with the kitchen printer.
   */
  printRemoteKots: boolean;
}

export const RESTAURANT_SETTINGS_KEY = 'kamai_restaurant_settings';
export const RESTAURANT_CHANGED_EVENT = 'restaurant_changed';

export const MAX_TABLES = 60;
export const MAX_ADDONS = 40;

export const defaultTableNames = (count: number): string[] =>
  Array.from({ length: Math.min(Math.max(1, Math.floor(count) || 1), MAX_TABLES) }, (_, i) => `T${i + 1}`);

export const DEFAULT_RESTAURANT_SETTINGS: RestaurantSettings = {
  tables: defaultTableNames(10),
  gstRate: 5,
  gstInclusive: true,
  serviceChargePercent: 0,
  packingChargePaise: 0,
  deliveryChargePaise: 0,
  printRemoteKots: false,
  addOns: [
    { name: 'Extra cheese', pricePaise: 2000 },
    { name: 'Extra butter', pricePaise: 1000 },
    { name: 'Less spicy', pricePaise: 0 },
    { name: 'No onion', pricePaise: 0 },
  ],
};

const cleanName = (v: unknown, max: number): string => String(v ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const num = (v: unknown, fallback: number, min: number, max: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** Anything stored (or typed) → valid settings: unique non-empty table names, GST 0–28 %, sane charges. */
export function sanitizeRestaurantSettings(raw: unknown): RestaurantSettings {
  const d = DEFAULT_RESTAURANT_SETTINGS;
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const seen = new Set<string>();
  const tables: string[] = [];
  for (const t of Array.isArray(r.tables) ? r.tables : []) {
    const name = cleanName(t, 20);
    if (name && !seen.has(name.toLowerCase()) && tables.length < MAX_TABLES) {
      seen.add(name.toLowerCase());
      tables.push(name);
    }
  }
  const addSeen = new Set<string>();
  const addOns: RestAddOn[] = [];
  for (const a of Array.isArray(r.addOns) ? r.addOns : []) {
    const name = cleanName((a as RestAddOn)?.name, 30);
    if (name && !addSeen.has(name.toLowerCase()) && addOns.length < MAX_ADDONS) {
      addSeen.add(name.toLowerCase());
      addOns.push({ name, pricePaise: Math.round(num((a as RestAddOn)?.pricePaise, 0, 0, 1_000_000)) });
    }
  }
  return {
    tables: tables.length ? tables : d.tables,
    gstRate: Math.round(num(r.gstRate, d.gstRate, 0, 28) * 100) / 100,
    gstInclusive: typeof r.gstInclusive === 'boolean' ? r.gstInclusive : d.gstInclusive,
    serviceChargePercent: Math.round(num(r.serviceChargePercent, d.serviceChargePercent, 0, 30) * 100) / 100,
    packingChargePaise: Math.round(num(r.packingChargePaise, d.packingChargePaise, 0, 1_000_000)),
    deliveryChargePaise: Math.round(num(r.deliveryChargePaise, d.deliveryChargePaise, 0, 1_000_000)),
    printRemoteKots: r.printRemoteKots === true,
    // A missing list = the starter add-ons; an empty list saved on purpose stays empty.
    addOns: Array.isArray(r.addOns) ? addOns : d.addOns,
  };
}

export function loadRestaurantSettings(): RestaurantSettings {
  if (typeof window === 'undefined') return sanitizeRestaurantSettings(null);
  try {
    return sanitizeRestaurantSettings(JSON.parse(localStorage.getItem(RESTAURANT_SETTINGS_KEY) || 'null'));
  } catch {
    return sanitizeRestaurantSettings(null);
  }
}

export function saveRestaurantSettings(next: RestaurantSettings): RestaurantSettings {
  const clean = sanitizeRestaurantSettings(next);
  try {
    localStorage.setItem(RESTAURANT_SETTINGS_KEY, JSON.stringify(clean));
  } catch {}
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(RESTAURANT_CHANGED_EVENT));
  return clean;
}
