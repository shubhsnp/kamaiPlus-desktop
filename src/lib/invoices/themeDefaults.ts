import { Business, InvoiceThemeConfig, InvoiceThemeId } from '@/types';
import { msg } from '@/lib/i18n/core';

export interface InvoicePaletteColor {
  label: string;
  hex: string;
  themeId: InvoiceThemeId;
}

/** Invoice colour palette — the same seven colours as the Android Invoice Themes screen. */
export const INVOICE_PALETTE: InvoicePaletteColor[] = [
  { label: msg('Navy Slate'), hex: '#0F172A', themeId: 'vyapar_classic' },
  { label: msg('Sky Blue'), hex: '#0284C7', themeId: 'pharma_care' },
  { label: msg('Emerald Green'), hex: '#059669', themeId: 'modern_emerald' },
  { label: msg('Terracotta Amber'), hex: '#B45309', themeId: 'golden_elegance' },
  { label: msg('Royal Purple'), hex: '#7E22CE', themeId: 'compact_kirana' },
  { label: msg('Teal'), hex: '#0D9488', themeId: 'royal_blue' },
  { label: msg('Charcoal'), hex: '#334155', themeId: 'thermal_minimal' },
];

/** Document headings offered in Invoice Themes (Android parity). */
export const INVOICE_HEADINGS = ['TAX INVOICE', 'RETAIL INVOICE', 'CASH MEMO', 'ESTIMATE / BILL'] as const;

export const DEFAULT_INVOICE_COLOR = '#0284C7';
export const DEFAULT_INVOICE_HEADING = 'TAX INVOICE';
export const DEFAULT_INVOICE_TERMS =
  '1. Goods once sold cannot be taken back or exchanged.\n2. Electronic invoice generated via Kamai+ POS System.';
export const DEFAULT_INVOICE_FOOTER = 'Thank you for shopping with us! Visit again.';

export const DEFAULT_INVOICE_THEME_CONFIG: InvoiceThemeConfig = {
  theme_id: 'pharma_care',
  primary_color: DEFAULT_INVOICE_COLOR,
  header_style: 'standard',
  show_logo: true,
  show_tagline: true,
  show_owner: true,
  show_upi_qr: true,
  show_upi_qr_thermal: true,
  show_signature: true,
  show_gst_breakup: true,
  show_hsn_code: true,
  show_mrp_savings: false,
  show_terms: true,
  show_pharmacy_rx: false,
  drug_license_no: '',
  pharmacist_reg_no: '',
  custom_title: DEFAULT_INVOICE_HEADING,
  custom_footer: DEFAULT_INVOICE_FOOTER,
  custom_terms: DEFAULT_INVOICE_TERMS,
};

function isHexColor(value?: string): value is string {
  return Boolean(value && /^#[0-9a-f]{6}$/i.test(value.trim()));
}

/**
 * The invoice settings actually in force for a business: saved Invoice Themes
 * values, then the Settings-page terms / footer, then the defaults. Every bill
 * renderer (A4, thermal, ESC/POS, reports letterhead) reads this one function.
 */
export function resolveInvoiceConfig(business?: Business | null): InvoiceThemeConfig {
  const saved = business?.invoice_theme_config;
  const merged: InvoiceThemeConfig = { ...DEFAULT_INVOICE_THEME_CONFIG, ...(saved || {}) };
  merged.primary_color = isHexColor(merged.primary_color) ? merged.primary_color : DEFAULT_INVOICE_COLOR;
  merged.custom_title = (merged.custom_title || '').trim() || DEFAULT_INVOICE_HEADING;
  merged.custom_terms = (saved?.custom_terms || business?.terms_conditions || DEFAULT_INVOICE_TERMS).trim();
  merged.custom_footer = (saved?.custom_footer || business?.footer_message || DEFAULT_INVOICE_FOOTER).trim();
  merged.drug_license_no = (merged.drug_license_no || business?.drug_license_no || '').trim();
  merged.pharmacist_reg_no = (merged.pharmacist_reg_no || business?.pharmacist_reg_no || '').trim();
  merged.fssai_license_no = (merged.fssai_license_no || business?.fssai_license_no || '').trim();
  return merged;
}

export function themeIdForColor(hex: string): InvoiceThemeId {
  const match = INVOICE_PALETTE.find((p) => p.hex.toLowerCase() === hex.toLowerCase());
  return match ? match.themeId : 'modern_emerald';
}
