// Domain Types for the KamaiPlus Platform
// Note: All monetary amounts (prices, totals, discounts, balances) are stored as integer PAISE (1 INR = 100 paise)

export type BusinessType = string;

export interface ProductAttributeDefinition {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'date' | 'select';
  required?: boolean;
  visible?: boolean;
  searchable?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: { value: string; label: string }[];
}

export type SupportedLanguage = 'en' | 'hi' | 'mr';

export type UserRole = 'OWNER' | 'MANAGER' | 'CASHIER' | 'STAFF';

export type InvoiceThemeId = 
  | 'vyapar_classic' 
  | 'modern_emerald' 
  | 'royal_blue' 
  | 'golden_elegance' 
  | 'compact_kirana' 
  | 'pharma_care'
  | 'thermal_minimal';

export interface UpiAccount {
  id: string;
  label: string;
  upi_id: string;
  is_default: boolean;
}

export interface InvoiceThemeConfig {
  theme_id: InvoiceThemeId;
  primary_color: string;
  header_style: 'standard' | 'banner' | 'centered' | 'modern';
  show_logo: boolean;
  show_tagline: boolean;
  show_owner: boolean;
  show_upi_qr: boolean;
  /** UPI QR also on 58 / 80 mm thermal slips (v4.91.0). Missing = on, as before. */
  show_upi_qr_thermal?: boolean;
  show_gst_breakup: boolean;
  show_hsn_code: boolean;
  show_mrp_savings: boolean;
  show_terms: boolean;
  show_signature: boolean;
  show_pharmacy_rx?: boolean;
  drug_license_no?: string;
  pharmacist_reg_no?: string;
  fssai_license_no?: string;
  show_ad_banner?: boolean;
  custom_ad_banner_text?: string;
  custom_ad_banner_subtext?: string;
  custom_title?: string;
  custom_footer?: string;
  custom_terms?: string;
}

export interface Business {
  id: string; // UUID v4
  name: string;
  tagline?: string;
  logo_url?: string;
  business_type: BusinessType;
  owner_name: string;
  phone: string;
  /** Second shop contact number, printed next to `phone` on bills (v4.91.0). */
  phone2?: string;
  email?: string;
  address: string;
  pincode?: string;
  gstin?: string;
  drug_license_no?: string;
  pharmacist_reg_no?: string;
  fssai_license_no?: string;
  upi_id?: string;
  upi_ids?: UpiAccount[];
  bank_name?: string;
  bank_account_no?: string;
  bank_ifsc?: string;
  bank_account_name?: string;
  currency: string; // 'INR'
  language: SupportedLanguage;
  invoice_prefix: string;
  next_invoice_number: number;
  terms_conditions?: string;
  footer_message?: string;
  invoice_theme_config?: InvoiceThemeConfig;
  gst_pricing_mode?: 'exclusive' | 'inclusive';
  subscription_tier?: 'free' | 'pro' | 'enterprise';
  subscription_valid_until?: string;
  is_onboarded: boolean;
  created_at: string;
  updated_at: string;
  sync_status: 'synced' | 'pending';
}

export type ProductUnit = 
  | 'piece'
  | 'kg'
  | 'gram'
  | 'litre'
  | 'ml'
  | 'box'
  | 'packet'
  | 'strip'
  | 'plate'
  | 'portion'
  | 'pair'
  | 'set'
  | 'bundle'
  | 'dozen'
  | 'meter'
  | 'foot'
  | 'sqft'
  | 'bottle'
  | 'can'
  | 'bag'
  | 'custom';

export interface Category {
  id: string;
  business_id: string;
  name: string;
  icon?: string;
  color?: string;
  created_at: string;
}

export interface Product {
  id: string;
  business_id: string;
  name: string;
  sku?: string;
  barcode?: string;
  category_id: string;
  category_name?: string;
  unit: ProductUnit;
  purchase_price: number; // in paise
  selling_price: number; // in paise (Selling Price / MRP)
  /** Second selling price for wholesale bills (paise; 0 / missing = none) — v4.87.0, lib/billing/priceMode.ts. */
  wholesale_price?: number;
  is_loose_item?: boolean; // Kirana loose item sold by open weight
  allow_decimal?: boolean; // allows decimal quantities (0.25 kg, 0.5 kg, etc.)
  is_unlimited_stock?: boolean; // bypasses zero stock block
  mrp: number; // in paise
  tax_rate: number; // percentage (0, 5, 12, 18, 28)
  is_tax_inclusive: boolean;
  hsn_code?: string;

  size?: string; // Clothing size (e.g. S, M, L, XL, 32, 34)
  color?: string; // Clothing / Mobile color
  // Variants (same model as the Android app): a PARENT has has_variants = true and
  // is never sold itself; each CHILD is a full product (own price, stock, barcode)
  // with parent_id pointing at the parent and variant_label like "XL" or "Red".
  parent_id?: string;
  has_variants?: boolean;
  variant_label?: string;
  imei_serial?: string; // Electronics IMEI or device serial number
  warranty_period_months?: number; // Brand warranty period
  batch_number?: string; // v4.126.0 pharmacy batch / lot no. (cloud contract §3.2)
  expiry_date?: string; // v4.126.0 expiry month 'YYYY-MM' (lib/products/expiry.ts)
  /** v4.138.0 restaurant: 'veg' | 'egg' | 'nonveg' (lib/restaurant/dish.ts); same field on the phone. */
  food_type?: string;
  /** v4.138.0 restaurant "Aaj khatam": the local day (YYYY-MM-DD) the dish ran out; '' = available. */
  sold_out_on?: string;
  current_stock: number;
  min_stock_level: number;
  supplier_id?: string;
  is_favorite: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  sync_status: 'synced' | 'pending';
}

export type CustomerType = 'new' | 'regular' | 'vip' | 'inactive' | 'credit';

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  gstin?: string;
  date_of_birth?: string; // YYYY-MM-DD or MM-DD
  anniversary_date?: string; // YYYY-MM-DD or MM-DD
  opening_balance: number; // in paise (+ = owes us/Udhar, - = advance payment)
  current_balance: number; // in paise
  loyalty_points: number;
  total_spent: number; // in paise
  total_visits: number;
  last_visit_date?: string;
  customer_type: CustomerType;
  /** Buys at wholesale prices: picking this customer turns the bill to wholesale (v4.87.0). */
  is_wholesale?: boolean;
  /** Udhar limit in paise; 0 / unset = none. The counter warns past it (v4.102.0; Android `credit_limit_paise`). */
  credit_limit?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  sync_status: 'synced' | 'pending';
}

export interface Supplier {
  id: string;
  business_id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  gstin?: string;
  opening_balance: number; // in paise (+ = we owe supplier, - = advance paid)
  current_balance: number; // in paise
  notes?: string;
  created_at: string;
  updated_at: string;
  sync_status: 'synced' | 'pending';
}

export interface CartItem {
  product_id: string;
  product_name: string;
  hsn_code?: string;
  barcode?: string;

  size?: string;
  color?: string;
  imei_serial?: string;
  warranty_period_months?: number;
  /** v4.126.0: the item's batch / expiry, frozen on the bill line. */
  batch_number?: string;
  expiry_date?: string;
  quantity: number;
  unit: ProductUnit;
  unit_price: number; // in paise
  mrp: number; // in paise
  discount_amount: number; // in paise per line
  tax_rate: number;
  tax_amount: number; // in paise
  total_amount: number; // in paise
  is_tax_inclusive?: boolean;
  notes?: string;
  cost_price?: number; // in paise per unit — buying rate frozen at sale time (0/undefined = unknown)
  bill_discount_amount?: number; // in paise — this line's share of a bill-level discount (already inside discount_amount)
  returned_quantity?: number; // quantity taken back through Sales Return
}

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'credit' | 'split';
export type PaymentStatus = 'paid' | 'partial' | 'unpaid';
export type SaleStatus = 'completed' | 'cancelled' | 'returned' | 'partial_return' | 'draft';

export interface PaymentSplit {
  cash_amount: number; // in paise
  upi_amount: number; // in paise
  card_amount: number; // in paise
  credit_amount: number; // in paise
  notes?: string;
}

export interface Sale {
  id: string;
  business_id: string;
  invoice_number: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  /** v4.126.0 pharmacy (Schedule H): prescribing doctor and patient, printed on the bill. */
  doctor_name?: string;
  patient_name?: string;
  customer_address?: string;
  customer_gstin?: string;
  items: CartItem[];
  subtotal: number; // in paise
  discount_total: number; // in paise
  tax_total: number; // in paise
  grand_total: number; // in paise
  payment_method: PaymentMethod;
  payment_split?: PaymentSplit;
  amount_received: number; // in paise
  balance_due: number; // in paise (added to Udhar Khata) — what is still owed now
  /**
   * Udhar left on the bill when it was sold. Set the first time a later khata
   * payment settles the bill, so the day's payment split (cash drawer, reports)
   * keeps what happened at the counter instead of counting the later payment as
   * a cash sale on the bill's date (the payment is counted as khata cash on its own day).
   */
  balance_due_at_sale?: number; // in paise
  change_returned: number; // in paise
  payment_status: PaymentStatus;
  status: SaleStatus;
  has_return?: boolean;
  returned_amount?: number; // in paise
  return_id?: string;
  notes?: string;
  /** 'wholesale' when the bill was made at wholesale prices (v4.87.0); missing = retail. */
  price_mode?: 'wholesale';
  created_by: string;
  created_at: string;
  updated_at: string;
  sync_status: 'synced' | 'pending';
}

export interface CashExpense {
  id: string;
  business_id: string;
  category: 'tea_snacks' | 'shop_maintenance' | 'staff_salary' | 'transport' | 'supplier_payout' | 'electricity' | 'refund' | 'other';
  title: string;
  amount: number; // in paise
  paid_to?: string;
  payment_mode: 'cash' | 'upi';
  created_by: string;
  created_at: string;
  notes?: string;
}

export type MovementType = 'SALE' | 'PURCHASE' | 'RETURN' | 'ADJUSTMENT' | 'DAMAGE';

export interface InventoryMovement {
  id: string;
  business_id?: string;
  product_id: string;
  product_name: string;
  movement_type: MovementType;
  quantity: number; // positive or negative
  previous_stock: number;
  new_stock: number;
  reference_id?: string; // sale_id or purchase_id
  reason?: string;
  created_by?: string;
  created_at: string;
  sync_status?: 'synced' | 'pending';
}

export type LedgerPartyType = 'customer' | 'supplier';
export type LedgerTransactionType = 
  | 'CREDIT_SALE'
  | 'PAYMENT_RECEIVED'
  | 'CREDIT_PURCHASE'
  | 'SUPPLIER_PAYMENT'
  | 'OPENING_BALANCE'
  | 'ADJUSTMENT';

export interface LedgerTransaction {
  id: string;
  business_id: string;
  party_type: LedgerPartyType;
  party_id: string;
  party_name: string;
  transaction_type: LedgerTransactionType;
  amount: number; // in paise
  payment_method?: string;
  reference_id?: string;
  notes?: string;
  balance_after: number; // in paise
  /** Bills this payment cleared (oldest first), so deleting / editing it can undo that. */
  bill_allocations?: BillAllocation[];
  created_at: string;
  sync_status?: 'synced' | 'pending';
}

export interface BillAllocation {
  sale_id: string;
  amount: number; // in paise
}

export interface CashRegister {
  id: string;
  business_id: string;
  opened_at: string;
  closed_at?: string;
  opening_cash: number; // in paise
  cash_sales: number; // in paise
  upi_sales: number; // in paise
  credit_sales: number; // in paise
  cash_in: number; // in paise
  cash_out: number; // in paise
  expected_closing_cash: number; // in paise
  actual_closing_cash?: number; // in paise
  difference?: number; // in paise (actual - expected)
  status: 'open' | 'closed';
  notes?: string;
  opened_by: string;
  closed_by?: string;
  sync_status?: 'synced' | 'pending';
}

// Returns, templates, audit log, supplier documents (v4.104.0, K-D23).
export * from './records';
