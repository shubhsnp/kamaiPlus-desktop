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
import { STARTER_CATEGORIES } from '@/lib/constants/storeProfiles';
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

  // If business exists but products table is empty, auto-seed default products unless manually cleared
  try {
    const isManuallyCleared = typeof window !== 'undefined' && localStorage.getItem('kamai_products_manually_cleared') === 'true';
    const prodCount = await db.products.count();
    if (prodCount === 0 && !isManuallyCleared) {
      await seedBusinessStarterData(existing.id);
    }
  } catch (err) {
    console.warn('Auto-seed products check notice:', err);
  }

  return existing;
}

/**
 * Completely clean all product and stock inventory data from local database.
 * Retains customers, sales records, and business settings.
 */
export async function clearAllProductData(): Promise<{ success: boolean; deletedCount: number }> {
  const count = await db.products.count();
  await db.products.clear();
  await db.inventory_movements.clear();
  if (typeof window !== 'undefined') {
    localStorage.setItem('kamai_products_manually_cleared', 'true');
  }
  return { success: true, deletedCount: count };
}

/**
 * Re-seed starter sample products for testing or fresh catalog setup.
 */
export async function restoreStarterProductCatalog(businessId: string): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('kamai_products_manually_cleared');
  }
  await seedBusinessStarterData(businessId);
}

// Starter categories, sample products and marketing templates for a new shop.
export async function seedBusinessStarterData(businessId: string) {
  const now = new Date().toISOString();

  // 1. Seed the universal starter categories
  for (let i = 0; i < STARTER_CATEGORIES.length; i++) {
    const catId = `cat_${Date.now()}_${i}`;
    await db.categories.put({
      id: catId,
      business_id: businessId,
      name: STARTER_CATEGORIES[i],
      icon: 'package',
      created_at: now,
    });
  }

  // 2. Seed starter retail products into db.products (stock = 10, no barcode)
  await seedCategoryDefaultProducts(businessId);

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
