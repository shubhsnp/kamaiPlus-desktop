import type { ProductUnit, SupportedLanguage } from './index';

/*
 * Returns, marketing templates, the audit log and supplier documents (purchase bills, debit notes,
 * purchase orders). Own file since v4.104.0 (K-D23); `@/types` re-exports everything here, so every
 * import stays `from '@/types'`.
 */

export interface ReturnItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit: ProductUnit;
  unit_price: number; // in paise
  tax_rate: number;
  total_amount: number; // in paise
  restock_to_inventory: boolean;
  reason?: string;
}

export interface SalesReturn {
  id: string;
  business_id: string;
  return_number: string;
  original_sale_id: string;
  original_invoice_number: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  items: ReturnItem[];
  refund_amount: number; // in paise
  refund_method: 'cash' | 'upi' | 'store_credit' | 'khata_deduction';
  notes?: string;
  created_by: string;
  created_at: string;
}

export interface MarketingTemplate {
  id: string;
  title: string;
  category: 'festival' | 'sale' | 'new_arrival' | 'discount' | 'loyalty' | 'reminder' | 'appreciation';
  language: SupportedLanguage;
  template_text: string;
  is_custom: boolean;
}

export interface AuditLog {
  id: string;
  business_id: string;
  user_id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
  created_at: string;
}

export interface PurchaseBillLineItem {
  raw_name: string;                 // exact text extracted from bill
  matched_product_id?: string;      // filled after fuzzy-match against existing products
  is_new_product: boolean;
  quantity: number;
  unit?: string;                    // kg, pcs, box, strip, etc
  unit_price: number;               // in paise
  total_price: number;              // in paise
  selling_price?: number;           // in paise (recommended or user entered)
  mrp?: number;                     // in paise, from the bill's MRP column
  barcode?: string;                 // EAN / UPC from the bill (finds the saved item; kept on a new one)
  tax_rate?: number;                // GST % from the bill (new items)
  hsn_code?: string;                // HSN from the bill (new items)
  confidence: 'high' | 'medium' | 'low';
}

export interface PurchaseBill {
  id: string;
  business_id: string;
  supplier_id?: string;
  supplier_name_raw?: string;      // as read from bill, before matching
  bill_number?: string;
  bill_date?: string;               // YYYY-MM-DD
  image_url?: string;
  raw_ai_response: string;          // JSON string for audit/debug
  line_items: PurchaseBillLineItem[];
  total_amount: number;             // in paise
  /**
   * v4.102.0 (K-D21, lib/purchases/supplierDocs.ts): unset = a supplier's bill (stock in);
   * 'debit_note' = goods returned to the supplier (bill_number DN-001); 'order' = a purchase
   * order sent to the supplier (PO-001) — status pending_review = open, confirmed = received,
   * discarded = cancelled.
   */
  kind?: 'bill' | 'debit_note' | 'order';
  notes?: string;
  status: 'pending_review' | 'confirmed' | 'discarded';
  ai_model_used: string;
  created_at: string;
  confirmed_at?: string;
  sync_status: 'synced' | 'pending';
}

