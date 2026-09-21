import { Sale, Business } from '@/types';


export interface SharedInvoicePayload {
  b_name: string;
  b_tagline?: string;
  b_logo?: string;
  b_owner?: string;
  b_phone?: string;
  b_email?: string;
  b_address?: string;
  b_gstin?: string;
  b_upi?: string;
  b_terms?: string;
  s_inv: string;
  s_date: string;
  s_cust?: string;
  s_phone?: string;
  s_subtotal: number;
  s_discount?: number;
  s_tax: number;
  s_total: number;
  s_received: number;
  s_balance: number;
  s_method: string;
  s_status: string;
  items: Array<{
    name: string;
    qty: number;
    unit: string;
    price: number;
    tax: number;
    discount?: number;
    total: number;
  }>;
}

/**
 * Encodes an invoice into a compressed Base64 URL parameter
 */
export function encodeInvoiceForSharing(sale: Sale, business: Business): string {
  try {
    const payload: SharedInvoicePayload = {
      b_name: business.name,
      b_tagline: business.tagline,
      b_logo: business.logo_url,
      b_owner: business.owner_name,
      b_phone: business.phone,
      b_email: business.email,
      b_address: business.address,
      b_gstin: business.gstin,
      b_upi: business.upi_id,
      b_terms: business.terms_conditions,
      s_inv: sale.invoice_number,
      s_date: sale.created_at,
      s_cust: sale.customer_name,
      s_phone: sale.customer_phone,
      s_subtotal: sale.subtotal,
      s_discount: sale.discount_total,
      s_tax: sale.tax_total,
      s_total: sale.grand_total,
      s_received: sale.amount_received,
      s_balance: sale.balance_due,
      s_method: sale.payment_method,
      s_status: sale.payment_status,
      items: sale.items.map((i) => ({
        name: i.product_name,
        qty: i.quantity,
        unit: i.unit,
        price: i.unit_price,
        tax: i.tax_rate,
        discount: i.discount_amount,
        total: i.total_amount,
      })),
    };

    const json = JSON.stringify(payload);
    if (typeof window !== 'undefined') {
      return btoa(unescape(encodeURIComponent(json)));
    }
    return Buffer.from(json).toString('base64');
  } catch (err) {
    console.error('Failed to encode invoice payload:', err);
    return '';
  }
}

/**
 * Decodes a shared invoice payload from Base64 string
 */
export function decodeInvoicePayload(base64: string): SharedInvoicePayload | null {
  try {
    let json = '';
    if (typeof window !== 'undefined') {
      json = decodeURIComponent(escape(atob(base64)));
    } else {
      json = Buffer.from(base64, 'base64').toString('utf-8');
    }
    return JSON.parse(json) as SharedInvoicePayload;
  } catch (err) {
    console.error('Failed to decode invoice payload:', err);
    return null;
  }
}
