import { ProductUnit } from '@/types';

/**
 * KamaiPlus is a single, universal retail product.
 *
 * This file used to carry one "store profile" per business vertical (kirana,
 * pharmacy, restaurant, apparel, electronics, hardware…), each with its own
 * module list, feature toggles, placeholders and sample catalogue. Every screen
 * then branched on the shop's `business_type`. All of that is gone: there is one
 * POS, and what is left here is the shared unit master and the starter
 * categories used when a brand new shop is seeded.
 */

export interface UnitOption {
  id: ProductUnit;
  labelEn: string;
  labelHi: string;
  symbol: string;
  isDecimalAllowed?: boolean;
}

export const MASTER_UNITS: UnitOption[] = [
  { id: 'piece', labelEn: 'Piece / Item (pc)', labelHi: 'पीस / नग (pc)', symbol: 'pc' },
  { id: 'kg', labelEn: 'Kilogram (kg)', labelHi: 'किलोग्राम (kg / किलो)', symbol: 'kg', isDecimalAllowed: true },
  { id: 'gram', labelEn: 'Gram (gm)', labelHi: 'ग्राम (gm)', symbol: 'gm', isDecimalAllowed: true },
  { id: 'litre', labelEn: 'Litre (ltr)', labelHi: 'लीटर (ltr)', symbol: 'ltr', isDecimalAllowed: true },
  { id: 'ml', labelEn: 'Millilitre (ml)', labelHi: 'मिलीलीटर (ml)', symbol: 'ml' },
  { id: 'packet', labelEn: 'Packet / Pouch (pkt)', labelHi: 'पैकेट / पाउच (pkt)', symbol: 'pkt' },
  { id: 'box', labelEn: 'Box / Carton (box)', labelHi: 'डिब्बा / बॉक्स (box)', symbol: 'box' },
  { id: 'pair', labelEn: 'Pair / Shoes (pair)', labelHi: 'जोड़ी (pair)', symbol: 'pair' },
  { id: 'set', labelEn: 'Set / Combo (set)', labelHi: 'सेट / कॉम्बो (set)', symbol: 'set' },
  { id: 'dozen', labelEn: 'Dozen (dz)', labelHi: 'दर्जन (dz)', symbol: 'dz' },
  { id: 'meter', labelEn: 'Meter (mtr)', labelHi: 'मीटर (mtr)', symbol: 'm', isDecimalAllowed: true },
  { id: 'foot', labelEn: 'Feet / Running Ft (ft)', labelHi: 'फीट (ft)', symbol: 'ft', isDecimalAllowed: true },
  { id: 'sqft', labelEn: 'Square Feet (sq.ft)', labelHi: 'स्क्वायर फीट (sq.ft)', symbol: 'sq.ft', isDecimalAllowed: true },
  { id: 'bundle', labelEn: 'Bundle (bdl)', labelHi: 'बंडल (bdl)', symbol: 'bdl' },
  // Same units as the Android app (cloud data contract, D3).
  { id: 'bottle', labelEn: 'Bottle (btl)', labelHi: 'बोतल (btl)', symbol: 'btl' },
  { id: 'can', labelEn: 'Can / Tin (can)', labelHi: 'कैन / टिन (can)', symbol: 'can' },
  { id: 'bag', labelEn: 'Bag / Sack (bag)', labelHi: 'थैला / बोरी (bag)', symbol: 'bag' },
  // v4.121.0 (AU-21): units the cloud contract already had (§4.1) — medicine strips, restaurant plates.
  { id: 'strip', labelEn: 'Strip / Tablets (strip)', labelHi: 'पत्ता / स्ट्रिप (strip)', symbol: 'strip' },
  { id: 'plate', labelEn: 'Plate (plate)', labelHi: 'प्लेट (plate)', symbol: 'plate' },
  { id: 'portion', labelEn: 'Portion / Serving', labelHi: 'पोर्शन / सर्विंग', symbol: 'portion' },
  { id: 'custom', labelEn: 'Custom Unit', labelHi: 'अन्य / कस्टम', symbol: 'unit' },
];

/** Default unit offered when a new product is created. */
export const DEFAULT_UNIT: ProductUnit = 'piece';

/** Units surfaced first in pickers, before the full master list. */
export const RECOMMENDED_UNITS: ProductUnit[] = ['piece', 'packet', 'kg', 'box'];

/**
 * The one category every shop starts with. v4.175.0: the generic list ('General', 'FMCG', 'Loose Items',
 * 'Apparel', 'Accessories') went into every vertical (a restaurant with "Apparel"); a shop's own
 * categories now come with its vertical's sample items (lib/products/verticalCatalog.ts).
 */
export const STARTER_CATEGORY = 'General';
