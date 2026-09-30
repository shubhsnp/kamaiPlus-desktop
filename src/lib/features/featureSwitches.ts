'use client';

import { useEffect, useState } from 'react';
import { msg } from '@/lib/i18n/core';

/*
 * Feature switches (v4.69.0) — Settings → Features. Each shop turns screens and
 * form fields on or off; turning one off only HIDES it, the data stays.
 *
 * This is per feature, never per trade: nothing here (or anywhere) may branch on
 * business_type (Bible §9, Suite 9). Stored per computer in localStorage, like the
 * other counter settings (one licence = one computer).
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
  | 'payment_keys';

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
  { id: 'product_variants', group: 'product_form', label: msg('Variants (Size / Colour)'), description: msg('One item in many sizes or colours, each with its own price and stock.') },
  { id: 'payment_keys', group: 'tools', label: msg('Payment keys F4 / F8 / F9'), description: msg('Cash (F4), UPI (F8) and Credit (F9) keys on the billing counter. Off: choose the payment with the mouse.') },
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

export function readFeatureSwitches(): FeatureSwitches {
  if (typeof window === 'undefined') return { ...DEFAULT_FEATURE_SWITCHES };
  try {
    return parseFeatureSwitches(localStorage.getItem(FEATURE_SWITCHES_KEY));
  } catch {
    return { ...DEFAULT_FEATURE_SWITCHES };
  }
}

export const isFeatureOn = (id: FeatureId): boolean => readFeatureSwitches()[id];

export function setFeatureSwitch(id: FeatureId, on: boolean) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(FEATURE_SWITCHES_KEY, JSON.stringify({ ...readFeatureSwitches(), [id]: on }));
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
