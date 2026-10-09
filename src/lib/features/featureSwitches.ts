'use client';

import { useEffect, useState } from 'react';
import { msg } from '@/lib/i18n/core';
import { readVerticalProfile, verticalSwitches } from '@/lib/business/verticalProfile';

/*
 * Feature switches (v4.69.0). Turning one off only HIDES a screen or field, the data stays.
 *
 * Screens never branch on business_type (Bible §9, Suite 9) — they read a switch. Since v4.118.0 a
 * shop set up with a business category gets its switches from that category's vertical profile
 * (lib/business/verticalProfile.ts); a shop set up before keeps its stored switches. Stored per
 * computer in localStorage, like the other counter settings (one licence = one computer).
 */

export type FeatureId =
  | 'profit_privacy'
  | 'khata'
  | 'customers'
  | 'inventory'
  | 'barcode_studio'
  | 'cash_register'
  | 'purchases'
  | 'suppliers'
  | 'gst_reports'
  | 'sales_reports'
  | 'invoice_designer'
  | 'product_selling_price'
  | 'product_cost_price'
  | 'product_hsn'
  | 'product_gst_rate'
  | 'product_size_colour'
  | 'product_variants'
  | 'whatsapp'
  | 'payment_keys'
  | 'wholesale_price'
  | 'stock_counting'
  | 'product_barcode'
  | 'product_batch_expiry'
  | 'bill_prescription';

export type FeatureSwitches = Record<FeatureId, boolean>;

export interface FeatureInfo {
  id: FeatureId;
  group: 'screens' | 'product_form' | 'tools' | 'privacy';
  label: string;
  description: string;
}

export const FEATURE_SWITCHES_KEY = 'kamai_feature_switches';
export const FEATURE_SWITCHES_EVENT = 'feature_switches_changed';
/**
 * v4.105.0: switches the KamaiPlus Admin Console forces on / off for this computer (remote
 * control, lib/admin/adminControl.ts). They win over the shop's own choice, which is kept and
 * comes back when the Admin lets go. Empty / missing = the shop decides everything.
 */
export const ADMIN_FEATURES_KEY = 'kamai_admin_feature_overrides';

/**
 * A new shop starts simple: Cash Register, Purchases, Suppliers, GST and the extra product
 * fields are off; profit privacy is on. The switches added in v4.81.0 (Khata … WhatsApp) start
 * ON — those screens and buttons were always there, so nobody loses anything they used.
 * A value saved on this computer (or in a backup) wins; a missing key takes this default.
 * Billing, Products, Transactions, Backup and Settings have no switch: a shop cannot work
 * (or turn things back on) without them.
 */
export const DEFAULT_FEATURE_SWITCHES: FeatureSwitches = {
  profit_privacy: true,
  khata: true,
  customers: true,
  inventory: true,
  barcode_studio: true,
  cash_register: false,
  purchases: false,
  suppliers: false,
  gst_reports: false,
  sales_reports: true,
  invoice_designer: true,
  product_selling_price: false,
  product_cost_price: false,
  product_hsn: false,
  product_gst_rate: false,
  product_size_colour: false,
  product_variants: false,
  whatsapp: true,
  // v4.85.0 (Rahul): F4 / F8 / F9 pick Cash / UPI / Credit only when a shop turns them on.
  payment_keys: false,
  // v4.87.0 (first client): a second price for wholesale bills — off until a shop needs it.
  wholesale_price: false,
  // v4.108.0: stock numbers everywhere and the barcode box — ON, every shop has always had them.
  // Restaurant mode turns both off (a dish is not counted or scanned).
  stock_counting: true,
  product_barcode: true,
  // v4.126.0 (AU-22): pharmacy — on for the pharmacy category (lib/business/verticalProfile.ts).
  product_batch_expiry: false,
  bill_prescription: false,
};

/** Order and texts of Settings → Features (msg ids, translated where shown). */
export const FEATURES: FeatureInfo[] = [
  { id: 'khata', group: 'screens', label: msg('Khata (Udhar)'), description: msg('Customer udhar ledger and reminders. Off: no Credit / Udhar payment at the counter either — every bill is paid in full.') },
  { id: 'customers', group: 'screens', label: msg('Customers'), description: msg('Customer list with details and Excel / PDF. Off: a bill can still carry the customer’s name and mobile.') },
  { id: 'inventory', group: 'screens', label: msg('Inventory & Stock'), description: msg('Low-stock alerts, reorder list and the stock movement history.') },
  { id: 'barcode_studio', group: 'screens', label: msg('Barcode Studio & Labels'), description: msg('Barcode label printing. Off: no label buttons on Products, Purchases, inward or import either.') },
  { id: 'cash_register', group: 'screens', label: msg('Cash Register'), description: msg('Open / close the shift, count notes, record expenses.') },
  { id: 'purchases', group: 'screens', label: msg('Purchase & Restock Orders'), description: msg('Stock inward from suppliers, Excel / CSV purchase bills.') },
  { id: 'suppliers', group: 'screens', label: msg('Suppliers'), description: msg('Supplier accounts: what you owe, purchases on credit, payments.') },
  { id: 'gst_reports', group: 'screens', label: msg('GST Reports & CA Tax Filing'), description: msg('GSTR-1, HSN summary and the files for your CA.') },
  { id: 'sales_reports', group: 'screens', label: msg('Sales Analytics'), description: msg('Party, category and item-wise sales with profit, and the dead-stock list.') },
  { id: 'invoice_designer', group: 'screens', label: msg('Invoice Themes'), description: msg('Colours and layout of your printed bills. Off: bills keep the look you chose.') },
  { id: 'product_selling_price', group: 'product_form', label: msg('Separate Selling Price'), description: msg('Off: items sell at their MRP. On: a Selling Price box next to MRP.') },
  { id: 'product_cost_price', group: 'product_form', label: msg('Purchase / Cost Price'), description: msg('What you paid — needed for profit figures.') },
  { id: 'product_hsn', group: 'product_form', label: msg('HSN / SAC Code'), description: msg('Printed on GST bills and used in the GSTR-1 HSN summary.') },
  { id: 'product_gst_rate', group: 'product_form', label: msg('GST Tax Rate (%)'), description: msg('Off: new items are saved without GST.') },
  { id: 'product_size_colour', group: 'product_form', label: msg('Size / Colour'), description: msg('Size and colour fields for clothes, shoes and similar items.') },
  { id: 'wholesale_price', group: 'product_form', label: msg('Wholesale price'), description: msg('A second price per item for wholesale customers. Billing gets a Retail / Wholesale switch; Excel import reads a "Wholesale" column.') },
  { id: 'stock_counting', group: 'product_form', label: msg('Stock counting'), description: msg('Stock numbers on items, low-stock alerts, stock value and dead stock. Off: every new item is unlimited and no stock is shown anywhere.') },
  { id: 'product_barcode', group: 'product_form', label: msg('Barcode on items'), description: msg('The Barcode box on Add Product and the Fast barcode inward button. Off: items are found by name.') },
  { id: 'product_batch_expiry', group: 'product_form', label: msg('Batch & expiry'), description: msg('Batch no. and expiry month on items, printed on the bill; a list of medicines expired or expiring in 90 days.') },
  { id: 'product_variants', group: 'product_form', label: msg('Variants (Size / Colour)'), description: msg('One item in many sizes or colours, each with its own price and stock.') },
  { id: 'payment_keys', group: 'tools', label: msg('Payment keys F4 / F8 / F9'), description: msg('Cash (F4), UPI (F8) and Credit (F9) keys on the billing counter. Off: choose the payment with the mouse.') },
  { id: 'bill_prescription', group: 'tools', label: msg('Doctor & patient on the bill'), description: msg('Patient and doctor name boxes on the counter, printed on the bill (medicines on prescription).') },
  { id: 'whatsapp', group: 'tools', label: msg('WhatsApp messages'), description: msg('WhatsApp buttons for bills, udhar reminders, khata slips, restock orders and reports.') },
  { id: 'profit_privacy', group: 'privacy', label: msg('Hide profit from staff (Privacy PIN)'), description: msg('"Cashier Privacy" button on every screen; profit and cost prices open only with the owner PIN.') },
];

/** Screens a switch hides (menu, dashboard tiles, direct links). */
export const ROUTE_FEATURES: Record<string, FeatureId> = {
  '/khata': 'khata',
  '/customers': 'customers',
  '/inventory': 'inventory',
  '/barcode-generator': 'barcode_studio',
  '/cash-register': 'cash_register',
  '/purchases': 'purchases',
  '/suppliers': 'suppliers',
  '/gst-reports': 'gst_reports',
  '/reports': 'sales_reports',
  '/invoice-designer': 'invoice_designer',
};

/** Stored JSON → switches. Unknown keys and non-boolean values are ignored. */
export function parseFeatureSwitches(raw: string | null | undefined): FeatureSwitches {
  const result: FeatureSwitches = { ...DEFAULT_FEATURE_SWITCHES };
  if (!raw) return result;
  try {
    const stored = JSON.parse(raw);
    if (stored && typeof stored === 'object') {
      for (const id of Object.keys(DEFAULT_FEATURE_SWITCHES) as FeatureId[]) {
        if (typeof stored[id] === 'boolean') result[id] = stored[id];
      }
    }
  } catch {}
  return result;
}

/** The Admin's forced switches (known features only). */
export function parseAdminOverrides(raw: string | null | undefined): Partial<FeatureSwitches> {
  const out: Partial<FeatureSwitches> = {};
  if (!raw) return out;
  try {
    const stored = JSON.parse(raw);
    if (stored && typeof stored === 'object') {
      for (const id of Object.keys(DEFAULT_FEATURE_SWITCHES) as FeatureId[]) {
        if (typeof stored[id] === 'boolean') out[id] = stored[id];
      }
    }
  } catch {}
  return out;
}

/**
 * Restaurant mode (v4.106.0) is switched on ONLY from the Admin Console (Remote control → Features →
 * "Restaurant mode"): it is not a FeatureId, has no row in Settings → Features and a shop cannot turn
 * it on. It lives in the Admin's forced features (ADMIN_FEATURES_KEY) under this id.
 */
export const RESTAURANT_MODE_ID = 'restaurant_mode';

export function restaurantModeFromRaw(rawAdmin: string | null | undefined): boolean {
  if (!rawAdmin) return false;
  try {
    return JSON.parse(rawAdmin)?.[RESTAURANT_MODE_ID] === true;
  } catch {
    return false;
  }
}

/**
 * How a restaurant uses the app (v4.106.0, widened in v4.107.0): no stock counting, labels, supplier
 * purchases, wholesale, size / colour or counter payment keys; GST and HSN come from Restaurant
 * Set-up, not from each dish; one price per dish, with Half / Full as variants. The Admin's forced
 * switches still win over this.
 */
export const RESTAURANT_PRESET: Partial<FeatureSwitches> = {
  inventory: false,
  barcode_studio: false,
  purchases: false,
  suppliers: false,
  wholesale_price: false,
  product_size_colour: false,
  product_selling_price: false,
  product_hsn: false,
  product_gst_rate: false,
  payment_keys: false,
  stock_counting: false,
  product_barcode: false,
  product_variants: true,
};
export const RESTAURANT_PRESET_OFF = (Object.keys(RESTAURANT_PRESET) as FeatureId[]).filter((id) => RESTAURANT_PRESET[id] === false);

export function applyRestaurantPreset(switches: FeatureSwitches, restaurantOn: boolean): FeatureSwitches {
  if (!restaurantOn) return switches;
  return { ...switches, ...RESTAURANT_PRESET };
}

/** The Admin's own choice for Restaurant mode: true / false when set, undefined = "shop decides". */
export function adminRestaurantChoice(rawAdmin: string | null | undefined): boolean | undefined {
  if (!rawAdmin) return undefined;
  try {
    const v = JSON.parse(rawAdmin)?.[RESTAURANT_MODE_ID];
    return typeof v === 'boolean' ? v : undefined;
  } catch {
    return undefined;
  }
}

/**
 * v4.118.0: a shop set up as "Cafe / Restaurant" is in Restaurant mode by itself; the Admin can still
 * switch it on (any shop) or off. A shop without a vertical profile: Admin only, as before.
 */
export function isRestaurantMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const admin = adminRestaurantChoice(localStorage.getItem(ADMIN_FEATURES_KEY));
    if (admin !== undefined) return admin;
    return readVerticalProfile()?.vertical === 'restaurant';
  } catch {
    return false;
  }
}

export function readAdminFeatureOverrides(): Partial<FeatureSwitches> {
  if (typeof window === 'undefined') return {};
  try {
    return parseAdminOverrides(localStorage.getItem(ADMIN_FEATURES_KEY));
  } catch {
    return {};
  }
}

export function readFeatureSwitches(): FeatureSwitches {
  if (typeof window === 'undefined') return { ...DEFAULT_FEATURE_SWITCHES };
  try {
    // v4.118.0: a shop with a vertical profile follows its category (+ GSTIN); only switches the app
    // itself turned on later (Excel import → wholesale) are layered on. No profile = the old path.
    const profile = readVerticalProfile();
    if (profile) {
      const own = { ...verticalSwitches(profile), ...parseAdminOverrides(localStorage.getItem(FEATURE_SWITCHES_KEY)) };
      return { ...applyRestaurantPreset(own, isRestaurantMode()), ...readAdminFeatureOverrides() };
    }
    // The shop's own switches, the restaurant preset (v4.106.0) when the Admin chose Restaurant mode,
    // and the Admin's forced ones on top (v4.105.0).
    return { ...applyRestaurantPreset(parseFeatureSwitches(localStorage.getItem(FEATURE_SWITCHES_KEY)), isRestaurantMode()), ...readAdminFeatureOverrides() };
  } catch {
    return { ...DEFAULT_FEATURE_SWITCHES };
  }
}

export const isFeatureOn = (id: FeatureId): boolean => readFeatureSwitches()[id];

/**
 * Since v4.107.0 the shop cannot change switches in the app (Settings → Features is read-only; KamaiPlus
 * support sets them from the Admin Console). Only the app itself still calls this — e.g. an Excel
 * import with a Wholesale column turns the wholesale price on.
 */
export function setFeatureSwitch(id: FeatureId, on: boolean) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(FEATURE_SWITCHES_KEY, JSON.stringify({ ...parseFeatureSwitches(localStorage.getItem(FEATURE_SWITCHES_KEY)), [id]: on }));
  } catch {}
  window.dispatchEvent(new Event(FEATURE_SWITCHES_EVENT));
}

/** The switch that hides a page ('' paths, query strings and a trailing slash allowed). */
export function featureForPath(path: string): FeatureId | undefined {
  const clean = (path || '').split('?')[0].replace(/\/+$/, '') || '/';
  return ROUTE_FEATURES[clean];
}

export function isPathEnabled(path: string, switches: FeatureSwitches): boolean {
  const id = featureForPath(path);
  return !id || switches[id];
}

/** Is Restaurant mode on (Admin Console only)? Re-renders when the Admin's control arrives. */
export function useRestaurantMode(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const refresh = () => setOn(isRestaurantMode());
    refresh();
    window.addEventListener(FEATURE_SWITCHES_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(FEATURE_SWITCHES_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return on;
}

/** Live switches for a component; re-renders when Settings → Features changes them. */
export function useFeatureSwitches(): FeatureSwitches {
  const [switches, setSwitches] = useState<FeatureSwitches>(readFeatureSwitches);
  useEffect(() => {
    const refresh = () => setSwitches(readFeatureSwitches());
    refresh();
    window.addEventListener(FEATURE_SWITCHES_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(FEATURE_SWITCHES_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return switches;
}

/**
 * Add / Edit Product: with "Separate Selling Price" off the form shows only MRP and
 * the item sells at MRP. An existing item whose selling price differs from its MRP
 * still shows both boxes, so saving it never changes its price behind the owner's back.
 */
export function showSellingPriceField(switchOn: boolean, editing?: { selling_price: number; mrp?: number } | null): boolean {
  if (switchOn) return true;
  return Boolean(editing && editing.selling_price !== (editing.mrp || editing.selling_price));
}
