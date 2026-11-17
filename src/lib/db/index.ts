import Dexie, { Table } from 'dexie';
import {
  Business,
  Product,
  Category,
  Customer,
  Supplier,
  Sale,
  InventoryMovement,
  LedgerTransaction,
  CashRegister,
  CashExpense,
  SalesReturn,
  MarketingTemplate,
  AuditLog,
  PurchaseBill,
  BusinessType,
} from '@/types';
import {
  RoomType,
  Room,
  Guest,
  Booking,
  StayRecord,
  Folio,
  FolioEntry,
  StayPayment,
  HousekeepingTask,
  StaySettings,
  StayAuditLog,
} from '@/lib/stay/types';
import { STARTER_CATEGORY } from '@/lib/constants/storeProfiles';
import { readVerticalProfile } from '@/lib/business/verticalProfile';
import { seedCategoryDefaultProducts } from '@/lib/constants/defaultProducts';
import { backupChangeMiddleware } from '@/lib/backup/backupChanges';
import { cloudOutboxMiddleware } from '@/lib/cloud/cloudOutbox';

export class VyaparSetuDatabase extends Dexie {
  businesses!: Table<Business, string>;
  categories!: Table<Category, string>;
  products!: Table<Product, string>;
  customers!: Table<Customer, string>;
  suppliers!: Table<Supplier, string>;
  sales!: Table<Sale, string>;
  inventory_movements!: Table<InventoryMovement, string>;
  ledger_transactions!: Table<LedgerTransaction, string>;
  cash_registers!: Table<CashRegister, string>;
  cash_expenses!: Table<CashExpense, string>;
  sales_returns!: Table<SalesReturn, string>;
  marketing_templates!: Table<MarketingTemplate, string>;
  audit_logs!: Table<AuditLog, string>;
  purchase_bills!: Table<PurchaseBill, string>;

  // ── Stay / Hospitality module tables ──────────────────────────────────────
  room_types!: Table<RoomType, string>;
  rooms!: Table<Room, string>;
  stay_guests!: Table<Guest, string>;
  stay_bookings!: Table<Booking, string>;
  stay_records!: Table<StayRecord, string>;
  stay_folios!: Table<Folio, string>;
  stay_folio_entries!: Table<FolioEntry, string>;
  stay_payments!: Table<StayPayment, string>;
  stay_housekeeping!: Table<HousekeepingTask, string>;
  stay_settings!: Table<StaySettings, string>;
  stay_audit_logs!: Table<StayAuditLog, string>;

  constructor() {
    super('VyaparSetuDB');
    
    this.version(2).stores({
      businesses: 'id, name, business_type, phone, created_at',
      categories: 'id, business_id, name, created_at',
      products: 'id, business_id, name, barcode, category_id, is_active, is_favorite, current_stock, min_stock_level',
      customers: 'id, business_id, name, phone, current_balance, customer_type, last_visit_date',
      suppliers: 'id, business_id, name, phone, current_balance',
      sales: 'id, business_id, invoice_number, customer_id, payment_method, status, created_at',
      inventory_movements: 'id, business_id, product_id, movement_type, reference_id, created_at',
      ledger_transactions: 'id, business_id, party_type, party_id, transaction_type, created_at',
      cash_registers: 'id, business_id, status, opened_at, closed_at',
      cash_expenses: 'id, business_id, category, payment_mode, created_at',
      sales_returns: 'id, business_id, return_number, original_sale_id, original_invoice_number, customer_id, created_at',
      marketing_templates: 'id, category, language, is_custom',
      audit_logs: 'id, business_id, action, entity_type, entity_id, created_at',
    });

    this.version(3).stores({
      businesses: 'id, name, business_type, phone, created_at',
      categories: 'id, business_id, name, created_at',
      products: 'id, business_id, name, barcode, category_id, is_active, is_favorite, current_stock, min_stock_level',
      customers: 'id, business_id, name, phone, current_balance, customer_type, last_visit_date',
      suppliers: 'id, business_id, name, phone, current_balance',
      sales: 'id, business_id, invoice_number, customer_id, payment_method, status, created_at',
      inventory_movements: 'id, business_id, product_id, movement_type, reference_id, created_at',
      ledger_transactions: 'id, business_id, party_type, party_id, transaction_type, created_at',
      cash_registers: 'id, business_id, status, opened_at, closed_at',
      cash_expenses: 'id, business_id, category, payment_mode, created_at',
      sales_returns: 'id, business_id, return_number, original_sale_id, original_invoice_number, customer_id, created_at',
      marketing_templates: 'id, category, language, is_custom',
      audit_logs: 'id, business_id, action, entity_type, entity_id, created_at',
      purchase_bills: 'id, business_id, supplier_id, status, created_at',
    }).upgrade(() => {
      // Clean upgrade, no manual data transformation required
    });

    this.version(4).stores({
      businesses: 'id, name, business_type, phone, created_at, updated_at',
      categories: 'id, business_id, name, created_at, updated_at',
      products: 'id, business_id, name, barcode, category_id, is_active, is_favorite, current_stock, min_stock_level, updated_at, [business_id+is_active], [business_id+category_id], [business_id+barcode]',
      customers: 'id, business_id, name, phone, current_balance, customer_type, last_visit_date, updated_at, [business_id+phone]',
      suppliers: 'id, business_id, name, phone, current_balance, updated_at',
      sales: 'id, business_id, invoice_number, customer_id, payment_method, status, created_at, updated_at, [business_id+created_at], [business_id+customer_id]',
      inventory_movements: 'id, business_id, product_id, movement_type, reference_id, created_at, updated_at, [business_id+created_at], [product_id+created_at]',
      ledger_transactions: 'id, business_id, party_type, party_id, transaction_type, created_at, updated_at, [business_id+created_at], [party_id+created_at]',
      cash_registers: 'id, business_id, status, opened_at, closed_at, updated_at',
      cash_expenses: 'id, business_id, category, payment_mode, created_at, updated_at, [business_id+created_at]',
      sales_returns: 'id, business_id, return_number, original_sale_id, original_invoice_number, customer_id, created_at, updated_at',
      marketing_templates: 'id, category, language, is_custom, updated_at',
      audit_logs: 'id, business_id, action, entity_type, entity_id, created_at, updated_at',
      purchase_bills: 'id, business_id, supplier_id, status, created_at, updated_at',
    }).upgrade(() => {
      // High-speed compound indexes upgrade, non-destructive
    });

    // ── Version 5: Stay / Hospitality module ────────────────────────────────
    this.version(5).stores({
      // Carry all existing tables forward unchanged
      businesses: 'id, name, business_type, phone, created_at, updated_at',
      categories: 'id, business_id, name, created_at, updated_at',
      products: 'id, business_id, name, barcode, category_id, is_active, is_favorite, current_stock, min_stock_level, updated_at, [business_id+is_active], [business_id+category_id], [business_id+barcode]',
      customers: 'id, business_id, name, phone, current_balance, customer_type, last_visit_date, updated_at, [business_id+phone]',
      suppliers: 'id, business_id, name, phone, current_balance, updated_at',
      sales: 'id, business_id, invoice_number, customer_id, payment_method, status, created_at, updated_at, [business_id+created_at], [business_id+customer_id]',
      inventory_movements: 'id, business_id, product_id, movement_type, reference_id, created_at, updated_at, [business_id+created_at], [product_id+created_at]',
      ledger_transactions: 'id, business_id, party_type, party_id, transaction_type, created_at, updated_at, [business_id+created_at], [party_id+created_at]',
      cash_registers: 'id, business_id, status, opened_at, closed_at, updated_at',
      cash_expenses: 'id, business_id, category, payment_mode, created_at, updated_at, [business_id+created_at]',
      sales_returns: 'id, business_id, return_number, original_sale_id, original_invoice_number, customer_id, created_at, updated_at',
      marketing_templates: 'id, category, language, is_custom, updated_at',
      audit_logs: 'id, business_id, action, entity_type, entity_id, created_at, updated_at',
      purchase_bills: 'id, business_id, supplier_id, status, created_at, updated_at',
      // ── NEW: Stay tables ──
      room_types: 'id, business_id, name, code, is_active',
      rooms: 'id, business_id, room_type_id, number, floor, status, is_active',
      stay_guests: 'id, business_id, name, phone, created_at',
      stay_bookings: 'id, business_id, booking_reference, room_id, room_type_id, primary_guest_id, status, check_in_date, check_out_date, created_at',
      stay_records: 'id, business_id, booking_id, room_id, status, created_at',
      stay_folios: 'id, business_id, booking_id, stay_record_id, status',
      stay_folio_entries: 'id, business_id, folio_id, entry_type, entry_date, created_at',
      stay_payments: 'id, business_id, folio_id, booking_id, paid_at, is_advance, is_refund',
      stay_housekeeping: 'id, business_id, room_id, task_type, status, created_at',
      stay_settings: 'id, business_id',
      stay_audit_logs: 'id, business_id, entity_type, entity_id, created_at',
    }).upgrade(() => {
      // Non-destructive: adds new Stay tables only, existing data untouched
    });
  }
}

export const db = new VyaparSetuDatabase();
// Tells the hourly automatic backup that data changed (lib/backup/backupChanges.ts).
// Must be registered before the database opens; it passes every write on unchanged.
db.use(backupChangeMiddleware);
// Notes which records changed for the cloud (lib/cloud/cloudOutbox.ts) — only while the
// shop has "Send this shop to the cloud" on. Same rule: registered before open, pass-through.
db.use(cloudOutboxMiddleware);

import { getStoredUser } from '@/lib/auth';

// Ensure clean starter business & default products exist if DB is empty
export async function ensureStarterBusinessIfEmpty(): Promise<Business> {
  let existing = await db.businesses.toCollection().first();
  const now = new Date().toISOString();

  if (!existing) {
    const user = getStoredUser();
    const isRealMerchant = Boolean(user && user.business_id && user.business_id !== 'biz_pending');

    const businessId = isRealMerchant ? user!.business_id! : `biz_${Date.now()}`;
    const starterBiz: Business = {
      id: businessId,
      name: isRealMerchant ? (user!.business_name || user!.shop_name || 'My Retail Store') : 'My Retail Store',
      business_type: 'retail',
      owner_name: isRealMerchant ? (user!.name || 'Store Owner') : 'Store Owner',
      phone: isRealMerchant ? (user!.phone || '') : '',
      address: 'Main Market',
      pincode: '400001',
      currency: 'INR',
      language: 'hi',
      invoice_prefix: 'INV-',
      next_invoice_number: 1,
      terms_conditions: 'Thank you for your business! Goods once sold will be exchanged within 7 days.',
      footer_message: 'Powered by KamaiPlus',
      is_onboarded: true,
      created_at: now,
      updated_at: now,
      sync_status: 'synced',
    };

    await db.businesses.put(starterBiz);
    await seedBusinessStarterData(businessId);
    return starterBiz;
  }

  // A shop that exists but never had anything (no item, no category, no bill) gets its starter items
  // once. v4.175.0: before, ANY shop whose items were all deleted got the samples and the generic
  // categories back on the next bill / Billing visit — "it keeps coming back".
  try {
    const isManuallyCleared = typeof window !== 'undefined' && localStorage.getItem('kamai_products_manually_cleared') === 'true';
    const prodCount = await db.products.count();
    if (prodCount === 0 && !isManuallyCleared && (await db.categories.count()) === 0 && (await db.sales.count()) === 0) {
      await seedBusinessStarterData(existing.id);
    }
  } catch (err) {
    console.warn('Auto-seed products check notice:', err);
  }

  return existing;
}

export {
  clearAllProductData,
  clearSalesAndAnalyticsHistory,
  clearKhataAndCustomers,
  completeFactoryReset,
  restoreStarterProductCatalog,
} from './dataReset';


// Starter categories, sample products and marketing templates for a new shop.
export async function seedBusinessStarterData(businessId: string, categoryType?: string) {
  const now = new Date().toISOString();
  // v4.175.0: always the shop's own category (vertical) — callers without one (Billing "Load sample
  // items", Settings restore, a fresh shop) used to seed the generic list into every vertical.
  const vertical = categoryType || readVerticalProfile()?.vertical;

  // 1. "General" once (it was added again on every seed); the vertical's own categories come with its
  // sample items. The old generic starters (FMCG, Apparel…) are not seeded any more (AU-16, verticalCatalog.ts).
  const hasGeneral = await db.categories.filter((c) => c.name.trim().toLowerCase() === 'general').count();
  if (!hasGeneral) {
    await db.categories.put({
      id: `cat_${Date.now()}_0`,
      business_id: businessId,
      name: STARTER_CATEGORY,
      icon: 'package',
      created_at: now,
    });
  }

  // 2. Seed starter retail products into db.products (stock = 10, no barcode)
  await seedCategoryDefaultProducts(businessId, vertical);

  // 3. Marketing Templates for festival/growth
  const templates: Array<Omit<MarketingTemplate, 'id'>> = [
    {
      title: 'Festival Greeting & Special Offer',
      category: 'festival',
      language: 'en',
      template_text: 'Hello {{customer_name}}! 🪔 Warm greetings from {{business_name}}. Celebrate this festival with an exclusive {{discount}}% discount on your next visit! Visit us: {{business_phone}}',
      is_custom: false,
    },
    {
      title: 'Credit Payment Reminder',
      category: 'reminder',
      language: 'en',
      template_text: 'Dear {{customer_name}}, gentle reminder from {{business_name}} regarding pending balance of ₹{{amount}}. Kindly clear at your convenience via UPI: {{upi_id}}. Thank you!',
      is_custom: false,
    },
    {
      title: 'We Miss You! Inactive Customer Offer',
      category: 'discount',
      language: 'en',
      template_text: 'Hello {{customer_name}}, we noticed it has been a while since your last visit to {{business_name}}! Use coupon code {{coupon_code}} to get flat ₹{{discount}} off on your next purchase. See you soon!',
      is_custom: false,
    }
  ];

  for (let m = 0; m < templates.length; m++) {
    await db.marketing_templates.put({
      ...templates[m],
      id: `tmpl_${m + 1}`,
    });
  }
}
