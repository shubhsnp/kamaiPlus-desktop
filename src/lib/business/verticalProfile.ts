import type { FeatureSwitches } from '@/lib/features/featureSwitches';

/**
 * Business vertical profile (v4.118.0, docs/VERTICAL_PLAN.md).
 *
 * A shop set up from v4.118.0 picks its business category in store setup; from then on the app is
 * shaped by that category (which screens and item fields show, Restaurant mode) and GST by whether
 * the shop has a GSTIN — not by switches the shop sets. The profile is kept per computer in
 * localStorage, like the feature switches it replaces.
 *
 * A shop set up before v4.118.0 has NO profile: `readVerticalProfile()` is null and every caller
 * keeps the old code path unchanged (Rahul, 2026-10-09: "purane customer par koi asar nahi").
 */
export const VERTICAL_PROFILE_KEY = 'kamai_vertical_profile';

export type VerticalId = 'grocery' | 'pharmacy' | 'clothing' | 'hardware' | 'restaurant' | 'retail';
export const VERTICAL_IDS: VerticalId[] = ['grocery', 'pharmacy', 'clothing', 'hardware', 'restaurant', 'retail'];

export interface VerticalProfile {
  v: 1;
  vertical: VerticalId;
  /** The shop has a GSTIN: GST rate / HSN on items, GST reports, tax invoices. */
  gst: boolean;
  /**
   * v4.141.0: when the category was chosen (ISO). Shared with the phone through the shop document's
   * `business_type_set_at` (lib/cloud/shopCategory.ts) — the newer choice wins. Missing on profiles saved
   * before v4.141.0.
   */
  at?: string;
}

export const isVerticalId = (v: unknown): v is VerticalId => typeof v === 'string' && (VERTICAL_IDS as string[]).includes(v);

/** Stored JSON → profile, or null (missing, damaged or an unknown category). */
export function parseVerticalProfile(raw: string | null | undefined): VerticalProfile | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (!p || typeof p !== 'object' || !isVerticalId(p.vertical)) return null;
    return { v: 1, vertical: p.vertical, gst: p.gst === true, ...(typeof p.at === 'string' && p.at ? { at: p.at } : {}) };
  } catch {
    return null;
  }
}

export function readVerticalProfile(): VerticalProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseVerticalProfile(localStorage.getItem(VERTICAL_PROFILE_KEY));
  } catch {
    return null;
  }
}

type Base = Omit<FeatureSwitches, 'product_gst_rate' | 'product_hsn' | 'gst_reports'>;

const SHOP: Base = {
  profit_privacy: true,
  khata: true,
  customers: true,
  inventory: true,
  barcode_studio: true,
  cash_register: true,
  purchases: true,
  suppliers: true,
  sales_reports: true,
  invoice_designer: true,
  product_selling_price: true,
  product_cost_price: true,
  product_size_colour: false,
  product_variants: false,
  whatsapp: true,
  payment_keys: false,
  wholesale_price: false,
  stock_counting: true,
  product_barcode: true,
  product_batch_expiry: false,
  bill_prescription: false,
  bill_serial_warranty: false,
};

/**
 * What each category uses (docs/VERTICAL_PLAN.md, "Preset"). GST switches are not here — they follow
 * the GSTIN (`verticalSwitches`). One table for store setup, cloud restore and the app (AU-07).
 */
export const VERTICAL_BASE: Record<VerticalId, Base> = {
  // Kirana: fast counter keys, wholesale price; items carry the maker's barcode — no label printing.
  grocery: { ...SHOP, barcode_studio: false, wholesale_price: true, payment_keys: true },
  // Medicines come with their own barcode; no labels.
  pharmacy: { ...SHOP, barcode_studio: false, product_batch_expiry: true, bill_prescription: true },
  // Price tags, sizes / colours.
  clothing: { ...SHOP, product_size_colour: true, product_variants: true },
  // Electronics & mobile: models in variants (128 GB / 256 GB, colour).
  hardware: { ...SHOP, product_variants: true, bill_serial_warranty: true },
  retail: { ...SHOP },
  // Tables & KOT; dishes are never counted; one GST % from Restaurant Set-up.
  restaurant: {
    ...SHOP,
    inventory: true,
    barcode_studio: false,
    purchases: true,
    suppliers: true,
    product_selling_price: false,
    product_cost_price: false,
    product_variants: true,
    stock_counting: false,
    product_barcode: false,
  },
};

/** The whole switch set of a category; GST screens and item fields only with a GSTIN. */
export function verticalSwitches(profile: Pick<VerticalProfile, 'vertical' | 'gst'>): FeatureSwitches {
  const restaurant = profile.vertical === 'restaurant';
  return {
    ...VERTICAL_BASE[profile.vertical],
    product_gst_rate: profile.gst && !restaurant,
    product_hsn: profile.gst && !restaurant,
    gst_reports: profile.gst,
  };
}

/** Store setup / cloud restore: this shop now follows its category. */
export function saveVerticalProfile(vertical: VerticalId, gst: boolean, at?: string) {
  if (typeof window === 'undefined') return;
  try {
    // The time of the choice stays when only GST changes (v4.141.0); a new category is stamped now.
    const prev = readVerticalProfile();
    const stamp = at || (prev && prev.vertical === vertical ? prev.at : undefined) || new Date().toISOString();
    localStorage.setItem(VERTICAL_PROFILE_KEY, JSON.stringify({ v: 1, vertical, gst, at: stamp } satisfies VerticalProfile));
  } catch {}
}

/**
 * The shop's GSTIN changed (Settings, a restored backup, the cloud): GST follows it. Only for a shop
 * with a profile; true when something changed (the caller tells the app).
 */
export function syncVerticalGst(hasGstin: boolean): boolean {
  const p = readVerticalProfile();
  if (!p || p.gst === hasGstin) return false;
  saveVerticalProfile(p.vertical, hasGstin);
  return true;
}

/**
 * May this shop's bills carry GST? (v4.120.0, AU-12 / AU-25.) A shop without a GSTIN cannot charge
 * GST or issue a tax invoice. A shop without a profile (set up before v4.118.0): yes, as before —
 * each item's own rate decides.
 */
export function gstAllowed(): boolean {
  const p = readVerticalProfile();
  return !p || p.gst;
}

/** The GST % a bill line takes from its item: 0 when the shop may not charge GST. */
export function lineGstRate(itemRate: number | undefined, allowed: boolean): number {
  return allowed ? itemRate || 0 : 0;
}

/** Restaurant Set-up GST for a shop with / without a GSTIN (restaurants: 5 %, no input credit). */
export const restaurantGstFor = (gst: boolean, current: number): number => (gst ? (current > 0 ? current : 5) : 0);
