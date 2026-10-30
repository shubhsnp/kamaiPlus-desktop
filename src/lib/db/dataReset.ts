import { db, seedBusinessStarterData } from './index';
import { reportError } from '@/lib/diagnostics/errorReporter';

/**
 * Completely clean all product and stock inventory data from local database.
 * Retains customers, sales records, and business settings.
 */
export async function clearAllProductData(options?: {
  wipeCloud?: boolean;
  clearCategories?: boolean;
}): Promise<{ success: boolean; deletedCount: number }> {
  const count = await db.products.count();
  await db.transaction('rw', [db.products, db.inventory_movements, db.categories], async () => {
    await db.products.clear();
    await db.inventory_movements.clear();
    if (options?.clearCategories) {
      await db.categories.clear();
    }
  });
  if (typeof window !== 'undefined') {
    localStorage.setItem('kamai_products_manually_cleared', 'true');
    window.dispatchEvent(new Event('kamai_products_cleared'));
  }
  if (options?.wipeCloud) {
    try {
      const { getCloudAccount } = await import('@/lib/cloud/cloudAccount');
      const account = getCloudAccount();
      if (account?.bizId) {
        const { wipeCloudTable } = await import('@/lib/cloud/cloudWrite');
        await wipeCloudTable(account.bizId, 'products');
        await wipeCloudTable(account.bizId, 'inventory_movements');
        if (options?.clearCategories) {
          await wipeCloudTable(account.bizId, 'categories');
        }
      }
    } catch (e) {
      console.warn('Cloud product wipe warning:', e);
    }
  }
  return { success: true, deletedCount: count };
}

/**
 * Clears all sales history, bills, and returns. Resets invoice numbering back to INV-001.
 * Retains products catalog, customers, and khata records.
 */
export async function clearSalesAndAnalyticsHistory(options?: {
  wipeCloud?: boolean;
  businessId?: string;
}): Promise<{ deletedSales: number; deletedReturns: number }> {
  const salesCount = await db.sales.count();
  const returnsCount = await db.sales_returns.count();

  await db.transaction('rw', [db.sales, db.sales_returns, db.businesses], async () => {
    await db.sales.clear();
    await db.sales_returns.clear();
    const biz = options?.businessId ? await db.businesses.get(options.businessId) : await db.businesses.toCollection().first();
    if (biz) {
      await db.businesses.update(biz.id, {
        next_invoice_number: 1,
        updated_at: new Date().toISOString(),
      });
    }
  });

  try {
    const { resetInvoiceNumberCache } = await import('@/lib/invoices/invoiceNumberService');
    resetInvoiceNumberCache();
  } catch (e) {
    reportError('data-reset', e, 'invoice number cache not reset');
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('kamai_sales_cleared'));
  }

  if (options?.wipeCloud) {
    try {
      const { getCloudAccount } = await import('@/lib/cloud/cloudAccount');
      const account = getCloudAccount();
      if (account?.bizId) {
        const { wipeCloudTable } = await import('@/lib/cloud/cloudWrite');
        await wipeCloudTable(account.bizId, 'sales');
        await wipeCloudTable(account.bizId, 'sales_returns');
      }
    } catch (e) {
      console.warn('Cloud sales wipe warning:', e);
    }
  }

  return { deletedSales: salesCount, deletedReturns: returnsCount };
}

/**
 * Clears all customers and Khata ledger transactions.
 */
export async function clearKhataAndCustomers(options?: {
  wipeCloud?: boolean;
}): Promise<{ deletedCustomers: number; deletedLedgers: number }> {
  const custCount = await db.customers.count();
  const ledgerCount = await db.ledger_transactions.count();

  await db.transaction('rw', [db.customers, db.ledger_transactions], async () => {
    await db.customers.clear();
    await db.ledger_transactions.clear();
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('kamai_khata_cleared'));
  }

  if (options?.wipeCloud) {
    try {
      const { getCloudAccount } = await import('@/lib/cloud/cloudAccount');
      const account = getCloudAccount();
      if (account?.bizId) {
        const { wipeCloudTable } = await import('@/lib/cloud/cloudWrite');
        await wipeCloudTable(account.bizId, 'customers');
        await wipeCloudTable(account.bizId, 'ledger_transactions');
      }
    } catch (e) {
      console.warn('Cloud khata wipe warning:', e);
    }
  }

  return { deletedCustomers: custCount, deletedLedgers: ledgerCount };
}

/**
 * Complete Factory Reset: Wipes all operational retail data (products, sales, khata, galla, purchases)
 * while preserving the store profile (name, phone, gstin, licence).
 * Also optionally wipes all subcollections from Cloud Firestore so no test data resurrects.
 */
export async function completeFactoryReset(options?: {
  preserveStoreProfile?: boolean;
  wipeCloud?: boolean;
  businessId?: string;
}): Promise<{ success: boolean; clearedTables: string[] }> {
  const preserveProfile = options?.preserveStoreProfile !== false;
  const currentBiz = await db.businesses.toCollection().first();

  await db.transaction('rw', [
    db.sales,
    db.sales_returns,
    db.products,
    db.categories,
    db.inventory_movements,
    db.customers,
    db.ledger_transactions,
    db.suppliers,
    db.purchase_bills,
    db.cash_registers,
    db.cash_expenses,
    db.audit_logs,
    db.businesses,
  ], async () => {
    await db.sales.clear();
    await db.sales_returns.clear();
    await db.products.clear();
    await db.categories.clear();
    await db.inventory_movements.clear();
    await db.customers.clear();
    await db.ledger_transactions.clear();
    await db.suppliers.clear();
    await db.purchase_bills.clear();
    await db.cash_registers.clear();
    await db.cash_expenses.clear();
    await db.audit_logs.clear();

    if (preserveProfile && currentBiz) {
      await db.businesses.update(currentBiz.id, {
        next_invoice_number: 1,
        updated_at: new Date().toISOString(),
      });
    } else if (!preserveProfile) {
      await db.businesses.clear();
    }
  });

  try {
    const { resetInvoiceNumberCache } = await import('@/lib/invoices/invoiceNumberService');
    resetInvoiceNumberCache();
  } catch (e) {
    reportError('data-reset', e, 'invoice number cache not reset');
  }

  try {
    const { clearOutbox } = await import('@/lib/cloud/cloudOutbox');
    clearOutbox();
    const { clearPullCursors } = await import('@/lib/cloud/cloudPull');
    clearPullCursors();
  } catch (e) {
    reportError('data-reset', e, 'cloud queue not cleared');
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem('kamai_products_manually_cleared', 'true');
    localStorage.removeItem('kamai_pos_tabs');
    window.dispatchEvent(new Event('kamai_factory_reset_completed'));
  }

  if (options?.wipeCloud) {
    try {
      const { getCloudAccount } = await import('@/lib/cloud/cloudAccount');
      const account = getCloudAccount();
      if (account?.bizId) {
        const { wipeAllCloudOperationalData } = await import('@/lib/cloud/cloudWrite');
        await wipeAllCloudOperationalData(account.bizId);
      }
    } catch (e) {
      console.warn('Cloud factory wipe warning:', e);
    }
  }

  return {
    success: true,
    clearedTables: [
      'sales',
      'sales_returns',
      'products',
      'categories',
      'inventory_movements',
      'customers',
      'ledger_transactions',
      'suppliers',
      'purchase_bills',
      'cash_registers',
      'cash_expenses',
      'audit_logs',
    ],
  };
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
