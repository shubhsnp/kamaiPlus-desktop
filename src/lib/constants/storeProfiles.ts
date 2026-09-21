import { BusinessType, ProductUnit, ModuleId } from '@/types';

export interface StoreProfileProduct {
  name: string;
  category: string;
  unit: ProductUnit;
  selling_price: number; // in paise
  purchase_price: number; // in paise
  mrp: number; // in paise
  tax_rate: number; // percentage
  is_loose_item?: boolean;
  batch_number?: string;
  expiry_date?: string;
  size?: string;
  color?: string;
  warranty_period_months?: number;
  barcode?: string;
}

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
  { id: 'custom', labelEn: 'Custom Unit', labelHi: 'अन्य / कस्टम', symbol: 'unit' },
];

export interface StoreProfile {
  id: BusinessType;
  name: string;
  shortName: string;
  iconName: string;
  emoji: string;
  tagline: string;
  description: string;
  accentColor: string;
  badgeBg: string;
  
  // Enabled Modules
  modules: ModuleId[];

  // Dynamic UI Feature Toggles
  featureToggles: {
    showBarcode: boolean;
    showWeightUnits: boolean;
    showBatchExpiry: boolean;
    showTableOrderType: boolean;
    showSizeVariants: boolean;
    showImeiWarranty: boolean;
    showDoctorPrescription: boolean;
    showKOTToken: boolean;
    hasBillScan: boolean;
    showQuotationEstimate: boolean;
  };

  // Dynamic Input Placeholders
  placeholders: {
    searchProduct: string;
    newProductName: string;
    customerSearch: string;
    customerNotes: string;
    invoiceFooterNote: string;
  };

  defaultUnit: ProductUnit;
  recommendedUnits: ProductUnit[];
  quickCategories: string[];
  sampleProducts: StoreProfileProduct[];
}

export const RETAIL_PROFILE: StoreProfile = {
  id: 'retail',
  name: 'Retail POS',
  shortName: 'Retail',
  iconName: 'store',
  emoji: '🛍️',
  tagline: 'General Retail POS',
  description: 'Smart billing & inventory for all retail stores.',
  accentColor: 'blue',
  badgeBg: 'bg-blue-100 text-blue-800',
  modules: [
    'POS', 'INVENTORY', 'KHATA', 'CUSTOMERS', 
    'SUPPLIERS', 'GST', 'BARCODE', 'WEIGHT', 
    'BATCH_EXPIRY', 'REPORTS', 'PURCHASES', 'EXPENSES'
  ],
  featureToggles: {
    showBarcode: true,
    showWeightUnits: true,
    showBatchExpiry: true,
    showTableOrderType: false,
    showSizeVariants: true,
    showImeiWarranty: false,
    showDoctorPrescription: false,
    showKOTToken: false,
    hasBillScan: true,
    showQuotationEstimate: false,
  },
  placeholders: {
    searchProduct: 'Search products by name or barcode (F3)...',
    newProductName: 'e.g. Rice 1kg, T-Shirt, Soap...',
    customerSearch: 'Search Customer by Mobile or Name...',
    customerNotes: 'Add remarks for customer bill...',
    invoiceFooterNote: 'Thank you for shopping! Visit Again.',
  },
  defaultUnit: 'piece',
  recommendedUnits: ['piece', 'packet', 'kg', 'box'],
  quickCategories: ['General', 'FMCG', 'Loose Items', 'Apparel', 'Accessories'],
  sampleProducts: [
    {
      name: 'Sample Item (Box)',
      category: 'General',
      unit: 'box',
      selling_price: 15000,
      purchase_price: 12000,
      mrp: 19900,
      tax_rate: 18,
    }
  ]
};

/**
 * Returns the StoreProfile configuration for a given business type.
 * Always returns RETAIL_PROFILE now to enforce generic retail standard.
 */
export function getStoreProfile(businessType?: string | null): StoreProfile {
  return RETAIL_PROFILE;
}

export function hasModule(businessType: BusinessType | string | null | undefined, moduleId: ModuleId): boolean {
  return RETAIL_PROFILE.modules.includes(moduleId);
}

export function isModuleEnabled(profile: StoreProfile, moduleId: ModuleId): boolean {
  return profile.modules ? profile.modules.includes(moduleId) : false;
}

export function getAllStoreProfiles(): StoreProfile[] {
  return [RETAIL_PROFILE];
}

export function getCategoryRecommendedUnits(businessType?: string | null): ProductUnit[] {
  return RETAIL_PROFILE.recommendedUnits;
}

export function getCategoryPlaceholders(businessType?: string | null): StoreProfile['placeholders'] {
  return RETAIL_PROFILE.placeholders;
}
