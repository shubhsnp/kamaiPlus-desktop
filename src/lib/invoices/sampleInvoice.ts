import { Business, CartItem, Sale } from '@/types';
import { calculateLineTax, computeBillTotals } from '@/lib/sales/saleMath';

/**
 * The sample GST bill used by Invoice Themes' live preview and "Sample PDF" —
 * the same B2B wholesale bill the Android Invoice Themes screen renders.
 */

function line(name: string, hsn: string, qty: number, unit: CartItem['unit'], ratePaise: number, taxRate: number): CartItem {
  const total = ratePaise * qty;
  return {
    product_id: `sample_${hsn}`,
    product_name: name,
    hsn_code: hsn,
    quantity: qty,
    unit,
    unit_price: ratePaise,
    mrp: ratePaise,
    discount_amount: 0,
    tax_rate: taxRate,
    tax_amount: calculateLineTax(total, taxRate, true),
    total_amount: total,
    is_tax_inclusive: true,
  };
}

export function buildSampleSale(business?: Business | null): Sale {
  const items: CartItem[] = [
    line('Aashirvaad Shudh Chakki Atta (10kg)', '1101', 10, 'packet', 42000, 5),
    line('Fortune Sunlite Sunflower Oil (15L Tin)', '1512', 4, 'box', 185000, 5),
    line('Dettol Antiseptic Liquid (500ml)', '3004', 12, 'piece', 19500, 18),
    line('Cadbury Dairy Milk Silk Chocolate (Pack)', '1806', 6, 'piece', 17500, 18),
  ];
  const totals = computeBillTotals(items);
  const now = new Date().toISOString();
  return {
    id: 'sample_invoice',
    business_id: business?.id || 'sample',
    invoice_number: `${business?.invoice_prefix || 'INV-'}2026-0842`,
    customer_name: 'Arihant Retail Traders Pvt Ltd',
    customer_phone: '9890198765',
    customer_address: 'MIDC Industrial Area, Pune',
    customer_gstin: '27AAACA1234F1Z8',
    items,
    subtotal: totals.subtotal,
    discount_total: 0,
    tax_total: totals.taxTotal,
    grand_total: totals.grandTotal,
    payment_method: 'upi',
    amount_received: totals.grandTotal,
    balance_due: 0,
    change_returned: 0,
    payment_status: 'paid',
    status: 'completed',
    created_by: 'owner',
    created_at: now,
    updated_at: now,
    sync_status: 'synced',
  };
}

/** The store as it should appear on the sample: the real profile, with placeholders for blanks. */
export function sampleBusiness(business?: Business | null): Business {
  const now = new Date().toISOString();
  const base: Business = business || {
    id: 'sample',
    name: '',
    business_type: 'grocery',
    owner_name: '',
    phone: '',
    address: '',
    currency: 'INR',
    language: 'en',
    invoice_prefix: 'INV-',
    next_invoice_number: 1,
    is_onboarded: true,
    created_at: now,
    updated_at: now,
    sync_status: 'synced',
  };
  // Placeholders only for blank text fields. Never a made-up phone number or UPI
  // ID: a sample bill printed with someone's real VPA in its QR would take money.
  return {
    ...base,
    name: base.name || 'Your Store Name',
    address: base.address || 'Shop address appears here',
    gstin: base.gstin || '27AAAAA0000A1Z5',
  };
}
