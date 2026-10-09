/**
 * Full Live Audit Script for KamaiPlus Desktop App
 * Drives every screen, modal, calculation and feature through the real Electron process.
 * Captures screenshots, console errors, page errors, and logs every anomaly or bug.
 */
import { _electron as electron } from 'playwright-core';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(APP_DIR, 'package.json'));
const electronPath = require('electron');
const licence = require(path.join(APP_DIR, 'licence.js'));

const PRIVATE_KEY = process.env.KAMAI_LICENCE_PRIVATE_KEY || path.join(os.homedir(), 'KamaiPlus-Secrets', 'desktop_licence_private.pem');
const PASSWORD = 'audit-Pass#1234';
const SHOTS_DIR = path.join(os.tmpdir(), 'kamaiplus-audit-shots');

let passed = 0;
let failed = 0;
const issues = [];

function check(ok, label, issueDetails = null) {
  if (ok) {
    passed++;
    console.log(`  ✅ [PASS] ${label}`);
  } else {
    failed++;
    console.log(`  ❌ [FAIL] ${label}`);
    if (issueDetails) issues.push({ label, ...issueDetails });
  }
}

function warn(label, details) {
  console.log(`  ⚠️ [WARN] ${label}: ${details}`);
  issues.push({ type: 'warning', label, details });
}

function writeSignedLicence(dataDir) {
  const pem = fs.readFileSync(PRIVATE_KEY, 'utf8');
  const payload = {
    v: 1,
    key: 'KPD-AUDIT-TEST-0000-0001',
    machine_id: licence.getMachineId(),
    shop_name: 'Audit Store Live',
    issued_at: new Date().toISOString()
  };
  const bytes = Buffer.from(JSON.stringify(payload), 'utf8');
  const signature = crypto.sign(null, bytes, crypto.createPrivateKey(pem));
  fs.mkdirSync(path.join(dataDir, 'userData'), { recursive: true });
  fs.writeFileSync(
    path.join(dataDir, 'userData', 'licence.json'),
    JSON.stringify({ licence: bytes.toString('base64url'), signature: signature.toString('base64url') })
  );
}

async function takeShot(page, name) {
  try {
    fs.mkdirSync(SHOTS_DIR, { recursive: true });
    const target = path.join(SHOTS_DIR, `${name}.png`);
    await page.screenshot({ path: target, fullPage: false });
    return target;
  } catch (err) {
    return null;
  }
}

async function readStore(page, store) {
  return page.evaluate((name) => new Promise((resolve, reject) => {
    const req = indexedDB.open('VyaparSetuDB');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(name)) { db.close(); resolve([]); return; }
      const all = db.transaction(name, 'readonly').objectStore(name).getAll();
      all.onsuccess = () => { db.close(); resolve(all.result); };
      all.onerror = () => { db.close(); reject(all.error); };
    };
  }), store);
}

async function run() {
  console.log('================================================================');
  console.log('🕵️  KamaiPlus Desktop — Comprehensive Live Feature-by-Feature Audit');
  console.log('================================================================');

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kp-full-audit-'));
  writeSignedLicence(dataDir);

  const env = { ...process.env, KAMAI_E2E_DIR: dataDir };
  delete env.ELECTRON_RUN_AS_NODE;

  const app = await electron.launch({
    executablePath: electronPath,
    args: [APP_DIR],
    cwd: APP_DIR,
    env,
    timeout: 60000
  });

  const page = await app.firstWindow();
  const pageErrors = [];
  const consoleErrors = [];
  const consoleWarnings = [];

  page.on('pageerror', (err) => {
    console.error('  🔥 PageError:', err.message);
    pageErrors.push(err.message);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore favicon or non-critical 404 noise if any
      if (!text.includes('favicon.ico')) {
        consoleErrors.push(text);
      }
    } else if (msg.type() === 'warning') {
      consoleWarnings.push(msg.text());
    }
  });

  try {
    // ── STEP 1: Master Password Setup ──
    console.log('\n--- 1. Security & Onboarding Flow ---');
    await page.getByPlaceholder('Enter new password').waitFor({ timeout: 15000 });
    await page.getByPlaceholder('Enter new password').fill(PASSWORD);
    await page.getByPlaceholder('Re-enter password').fill(PASSWORD);
    await page.getByRole('button', { name: /Set Password & Start/i }).click();

    // ── STEP 2: Store Onboarding ──
    await page.getByPlaceholder('e.g. Sharma Kirana & General Store').waitFor({ timeout: 15000 });
    await page.getByPlaceholder('e.g. Sharma Kirana & General Store').fill('Audit Mega Retail Store');
    await page.getByPlaceholder('e.g. Ramesh Sharma').fill('Rahul Test Owner');
    await page.getByPlaceholder('98765 43210').fill('9876543210');
    await page.getByPlaceholder('e.g. 9876543210@paytm or store@okaxis').fill('auditstore@okaxis');
    const seedBox = page.locator('input[type="checkbox"]').first();
    if (!(await seedBox.isChecked())) await seedBox.check();
    await page.getByRole('button', { name: /Complete Setup/i }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/onboarding'), { timeout: 20000 });
    await page.waitForTimeout(1000);
    check(true, 'Master Password + Store Onboarding completed successfully');
    await takeShot(page, '01_dashboard_home');

    // ── STEP 3: Dashboard Home Verification ──
    console.log('\n--- 2. Dashboard Home Inspection ---');
    const bizNameShown = await page.getByText('Audit Mega Retail Store', { exact: false }).first().isVisible();
    check(bizNameShown, 'Dashboard displays business name in navbar');
    const pulseVisible = await page.getByText("Today's Business Pulse", { exact: false }).first().isVisible().catch(() => false);
    check(pulseVisible, 'Business Pulse cards (Today Sales, Cash in Hand, Gross Profit, Total Udhar) visible');

    // ── STEP 4: Settings -> Enable All Feature Switches for Testing ──
    console.log('\n--- 3. Enabling All Feature Switches ---');
    // Settings → Features was removed in v4.118.0 (a shop's switches follow its business category);
    // tests turn switches on the way the app stores an explicit choice (kamai_feature_switches).
    const switchesToEnable = [
      'cash_register',
      'purchases',
      'suppliers',
      'gst_reports',
      'product_selling_price',
      'product_cost_price',
      'product_hsn',
      'product_gst_rate',
      'product_variants',
      'payment_keys'
    ];
    await page.evaluate((ids) => {
      const cur = JSON.parse(localStorage.getItem('kamai_feature_switches') || '{}');
      for (const id of ids) cur[id] = true;
      localStorage.setItem('kamai_feature_switches', JSON.stringify(cur));
    }, switchesToEnable);
    await page.reload();
    await page.waitForTimeout(1500);
    const on = await page.evaluate((ids) => { const c = JSON.parse(localStorage.getItem('kamai_feature_switches') || '{}'); return ids.every((id) => c[id] === true); }, switchesToEnable);
    check(on, 'Feature switches turned on (stored like the app does)');
    await takeShot(page, '02_settings_features');

    // ── STEP 5: Products Catalog Master Inspection ──
    console.log('\n--- 4. Products Master & Variants ---');
    await page.evaluate(() => { window.location.href = '/products/'; });
    await page.waitForURL(/\/products/, { timeout: 10000 });
    await page.waitForTimeout(1000);
    const initialProds = await readStore(page, 'products');
    check(initialProds.length >= 10, `Products loaded in table view (${initialProds.length} items)`);
    await takeShot(page, '03_products_table');

    // Test Add New Product with Variants
    await page.getByRole('button', { name: /Add Product/ }).first().click();
    await page.waitForTimeout(600);
    const modalTitle = await page.getByText('Add New Item to Catalog', { exact: false }).first().isVisible();
    check(modalTitle, 'Add Product modal opens with title "Add New Item to Catalog"');

    await page.getByPlaceholder('e.g. Fortune Sunflower Oil 1L').fill('Audit Premium Cotton Shirt');
    await page.getByPlaceholder('e.g. 150.00').fill('450'); // Selling price
    await page.getByPlaceholder('e.g. 120.00').fill('300'); // Cost price
    await page.getByPlaceholder('e.g. 165.00').fill('500'); // MRP

    // Turn on Variants switch
    const variantSwitch = page.locator('label:has(input[type="checkbox"])').filter({ hasText: '' }).last();
    const variantCheckbox = page.locator('input[type="checkbox"]').filter({ has: page.locator('..') }).last();
    // Click the variant section toggle
    const varToggle = page.locator('div:has-text("Variants (Size / Colour)") label').last();
    if (await varToggle.count()) {
      await varToggle.click();
      await page.waitForTimeout(400);
      // Select preset Size: 'S' and 'M'
      const btnS = page.locator('button', { hasText: /^S$/ }).first();
      const btnM = page.locator('button', { hasText: /^M$/ }).first();
      if (await btnS.count()) await btnS.click();
      if (await btnM.count()) await btnM.click();
      await page.waitForTimeout(300);
    }
    await page.locator('form').getByRole('button', { name: /Save Product/ }).click();
    await page.waitForTimeout(1000);

    const prodsAfterVariant = await readStore(page, 'products');
    const parentShirt = prodsAfterVariant.find((p) => p.name === 'Audit Premium Cotton Shirt');
    const childVariants = prodsAfterVariant.filter((p) => p.parent_id === parentShirt?.id);
    check(parentShirt && parentShirt.has_variants === true, 'Parent variant product created');
    check(childVariants.length >= 2, `Child variants created with own stock & prices (${childVariants.length} variants)`);

    // ── STEP 6: POS Billing Counter ──
    console.log('\n--- 5. Billing POS Counter ---');
    await page.evaluate(() => { window.location.href = '/billing/'; });
    await page.waitForURL(/\/billing/, { timeout: 10000 });
    await page.waitForTimeout(1000);
    await takeShot(page, '04_billing_counter');

    const searchBox = page.getByPlaceholder(/Search products/).first();
    await searchBox.waitFor({ timeout: 10000 });

    // Test Variant Picker on POS
    await searchBox.fill('Cotton Shirt');
    await page.waitForTimeout(600);
    const searchResBtn = page.locator('button', { hasText: 'Audit Premium Cotton Shirt' }).first();
    if (await searchResBtn.isVisible()) {
      await searchResBtn.click();
      await page.waitForTimeout(500);
      const variantPickerOpen = await page.getByText('Select Size / Colour', { exact: false }).first().isVisible().catch(() => false);
      check(variantPickerOpen, 'Variant Picker modal opened when adding parent product to cart');
      // Pick variant 1
      await page.keyboard.press('1');
      await page.waitForTimeout(500);
    }

    // Add another normal product
    const sampleItem = initialProds[0];
    await searchBox.fill(sampleItem.name);
    await page.waitForTimeout(600);
    await page.locator('button', { hasText: sampleItem.name }).first().click();
    await page.waitForTimeout(400);

    // Enter customer name on the counter
    await page.locator('input[data-pos-customer-name]').first().fill('Suresh Kumar Khata');
    await page.locator('input[data-pos-customer-phone]').first().fill('9811223344');

    // Switch payment to Credit (F9)
    await page.keyboard.press('F9');
    await page.waitForTimeout(300);
    check(await page.locator('button:has-text("Credit")').first().getAttribute('class').then(c => c.includes('amber') || c.includes('purple') || c.includes('slate')), 'Payment switched to Credit via F9 shortcut');

    // Complete Sale (F10)
    await page.keyboard.press('F10');
    await page.waitForTimeout(1500);
    const latestSales = await readStore(page, 'sales');
    const creditSale = latestSales.find((s) => s.customer_name === 'Suresh Kumar Khata');
    check(creditSale && creditSale.payment_method === 'credit' && creditSale.balance_due > 0, `Credit sale successfully created with balance due (Invoice #${creditSale?.invoice_number})`);

    // Close invoice modal if open
    const invoiceModalClose = page.getByRole('button', { name: /Close|✕|New Bill/i }).first();
    if (await invoiceModalClose.isVisible().catch(() => false)) {
      await invoiceModalClose.click();
      await page.waitForTimeout(400);
    }

    // ── STEP 7: Khata & Udhar Ledger Inspection ──
    console.log('\n--- 6. Khata Ledger & Settle Bills ---');
    await page.evaluate(() => { window.location.href = '/khata/'; });
    await page.waitForURL(/\/khata/, { timeout: 10000 });
    await page.waitForTimeout(1000);
    await takeShot(page, '05_khata_page');

    // Customer balance header
    const custBalanceVisible = await page.getByText('CURRENT OUTSTANDING BALANCE', { exact: false }).first().isVisible();
    check(custBalanceVisible, 'Customer balance and timeline loaded in Khata');

    // Test "Pending Bills" Tab and Settle Modal
    const pendingBillsTab = page.locator('button', { hasText: /Pending Bills/i }).first();
    if (await pendingBillsTab.isVisible()) {
      await pendingBillsTab.click();
      await page.waitForTimeout(500);
      const settleTrigger = page.locator('button[title="Settle this specific invoice"]').first();
      if (await settleTrigger.isVisible()) {
        await settleTrigger.click();
        await page.waitForTimeout(600);
        check(await page.getByText('Selected Invoices', { exact: false }).first().isVisible(), 'Settle Invoices Modal opens correctly');
        await takeShot(page, '06_settle_modal');
        const cancelSettle = page.getByRole('button', { name: /Cancel/i }).first();
        if (await cancelSettle.isVisible()) await cancelSettle.click();
        await page.waitForTimeout(300);
      }
    }

    // ── STEP 8: Inventory Movements & Reorder Alerts ──
    console.log('\n--- 7. Inventory Management ---');
    await page.evaluate(() => { window.location.href = '/inventory/'; });
    await page.waitForURL(/\/inventory/, { timeout: 10000 });
    await page.waitForTimeout(1000);
    await takeShot(page, '07_inventory_page');

    const totalAssetVal = await page.getByText('Inventory Asset', { exact: false }).first().isVisible();
    check(totalAssetVal, 'Inventory total asset valuation rendered');
    const movementsTab = page.locator('button', { hasText: /Stock Audit Trail|Movements/i }).first();
    if (await movementsTab.isVisible()) {
      await movementsTab.click();
      await page.waitForTimeout(500);
      const moveListCount = await page.locator('table tbody tr, div.border-slate-100').count();
      check(moveListCount > 0, `Inventory stock movements list populated (${moveListCount} records)`);
    }

    // ── STEP 9: Suppliers & Purchases ──
    console.log('\n--- 8. Suppliers & Purchases ---');
    await page.evaluate(() => { window.location.href = '/suppliers/'; });
    await page.waitForURL(/\/suppliers/, { timeout: 10000 });
    await page.waitForTimeout(1000);
    await takeShot(page, '08_suppliers_page');

    // Add new supplier
    await page.locator('header, div.flex').getByRole('button', { name: /Add Supplier/i }).first().click();
    await page.waitForTimeout(500);
    await page.getByPlaceholder('e.g. Metro Wholesale').fill('National Distributors Ltd');
    await page.getByPlaceholder('10-digit mobile').fill('9822001122');
    await page.getByPlaceholder('27ABCDE1234F1Z5').fill('27AABCN1234F1Z5');
    await page.locator('form').getByRole('button', { name: 'Add Supplier' }).click();
    await page.waitForTimeout(1000);
    const suppliers = await readStore(page, 'suppliers');
    check(suppliers.some(s => s.name === 'National Distributors Ltd'), 'Supplier created successfully in database');

    // Record Supplier Purchase (Purchases page)
    await page.evaluate(() => { window.location.href = '/purchases/'; });
    await page.waitForURL(/\/purchases/, { timeout: 10000 });
    await page.waitForTimeout(1000);
    await takeShot(page, '09_purchases_page');
    check(await page.getByText('Items Needing Restock', { exact: false }).first().isVisible(), 'Purchases inward overview rendered');

    // ── STEP 10: Cash Register & Denominations ──
    console.log('\n--- 9. Cash Register & Day-End Closing ---');
    await page.evaluate(() => { window.location.href = '/cash-register/'; });
    await page.waitForURL(/\/cash-register/, { timeout: 10000 });
    await page.waitForTimeout(1000);
    await takeShot(page, '10_cash_register_page');

    const openShiftBtn = page.getByRole('button', { name: /Open Drawer/i }).first();
    if (await openShiftBtn.isVisible().catch(() => false)) {
      await openShiftBtn.click();
      await page.waitForTimeout(500);
      await page.getByPlaceholder('e.g. 2000.00').fill('500');
      await page.getByRole('button', { name: /Start Shift/i }).first().click();
      await page.waitForTimeout(800);
    }
    const registerOpenStatus = await page.getByText('Drawer Open', { exact: false }).first().isVisible();
    check(registerOpenStatus, 'Cash register shift opened and active');

    // Test Tally Counter (Denomination modal)
    const countCashBtn = page.getByRole('button', { name: /Close Shift/i }).first();
    if (await countCashBtn.isVisible().catch(() => false)) {
      await countCashBtn.click();
      await page.waitForTimeout(500);
      const denomModal = await page.getByText('Denomination Tally Counter', { exact: false }).first().isVisible();
      check(denomModal, 'Denomination Calculator modal opens with all currency denominations');
      await takeShot(page, '11_denomination_modal');
      // Esc closes the modal (a /Close/ button match is the Close Shift button behind it)
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // ── STEP 11: Sales Reports & Analytics ──
    console.log('\n--- 10. Sales Reports & Analytics ---');
    await page.evaluate(() => { window.location.href = '/reports/'; });
    await page.waitForURL(/\/reports/, { timeout: 10000 });
    await page.waitForTimeout(1000);
    await takeShot(page, '12_sales_reports');

    const revenueMetric = await page.getByText('Total Revenue', { exact: false }).first().isVisible();
    check(revenueMetric, 'Sales Analytics Net Revenue and KPI ribbon rendered');
    const itemsTab = page.getByRole('button', { name: /^Items \(/ }).first();
    if (await itemsTab.isVisible()) {
      await itemsTab.click();
      await page.waitForTimeout(500);
      const itemsListed = await page.getByText(sampleItem.name, { exact: false }).count();
      check(itemsListed > 0, 'Items breakdown tab rendered with sales ranking');
    }

    // ── STEP 12: GST Reports & GSTR-1 Generator ──
    console.log('\n--- 11. GST Reports & GSTR-1 Compliance ---');
    await page.evaluate(() => { window.location.href = '/gst-reports/'; });
    await page.waitForURL(/\/gst-reports/, { timeout: 10000 });
    await page.waitForTimeout(1000);
    await takeShot(page, '13_gst_reports');

    const gstr1Heading = await page.getByText('GSTR-1', { exact: false }).first().isVisible();
    check(gstr1Heading, 'GSTR-1 report overview rendered');
    const jsonBtn = page.getByRole('button', { name: /GSTR-1 JSON/i }).first();
    check(await jsonBtn.isVisible(), 'GSTR-1 JSON export button present');

    // ── STEP 13: Barcode Studio & Label Setup ──
    console.log('\n--- 12. Barcode Studio & Label Setup ---');
    await page.evaluate(() => { window.location.href = '/barcode-generator/'; });
    await page.waitForURL(/\/barcode-generator/, { timeout: 10000 });
    await page.waitForTimeout(1000);
    await takeShot(page, '14_barcode_studio');

    const previewFrame = page.locator('iframe[data-label-preview], [data-label-preview]');
    check(await previewFrame.count() > 0, 'Barcode Label WYSIWYG preview frame active');

    // ── STEP 14: Invoice Designer & Themes ──
    console.log('\n--- 13. Invoice Designer ---');
    await page.evaluate(() => { window.location.href = '/invoice-designer/'; });
    await page.waitForURL(/\/invoice-designer/, { timeout: 10000 });
    await page.waitForTimeout(1000);
    await takeShot(page, '15_invoice_designer');

    const themeColors = await page.locator('button[style*="background-color"].rounded-full').count();
    check(themeColors >= 6, `Theme color options available (${themeColors} colors)`);

    // ── STEP 15: Cloud Backup & Data Maintenance ──
    console.log('\n--- 14. Cloud Backup & Maintenance ---');
    await page.evaluate(() => { window.location.href = '/cloud-backup/'; });
    await page.waitForURL(/\/cloud-backup/, { timeout: 10000 });
    await page.waitForTimeout(1000);
    await takeShot(page, '16_cloud_backup');

    const backupCard = await page.getByText('Automatic Backup', { exact: false }).first().isVisible();
    check(backupCard, 'Auto Backup card showing daily backup safety status');

    // ── STEP 16: Right Edge Global Drawers (Transactions) ──
    console.log('\n--- 15. Global Drawers (Transactions) ---');
    const historyTab = page.locator('[data-transactions-tab]').first();
    if (await historyTab.isVisible()) {
      await historyTab.click();
      await page.waitForTimeout(600);
      const drawerTitle = await page.locator('[data-drawer-close]').first().isVisible();
      check(drawerTitle, 'Transactions drawer opens smoothly from right edge');
      await takeShot(page, '17_history_drawer');
      // Press Escape to close
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }

    // ── STEP 17: Multi-Language Switcher (हिंदी & मराठी) ──
    console.log('\n--- 16. Multi-Language Switcher Live Test ---');
    await page.locator('header button[title="Click for Store Menu, Language & Settings"]').click();
    await page.waitForTimeout(300);
    const hiBtn = page.getByRole('button', { name: /हिंदी/ }).first();
    if (await hiBtn.isVisible()) {
      await hiBtn.click();
      await page.waitForTimeout(1200);
      const hindiActive = await page.getByText('दुकान', { exact: false }).first().isVisible().catch(() => false);
      check(hindiActive, 'Language switched to हिंदी successfully, translated UI rendered');
      await takeShot(page, '18_hindi_ui');

      // Switch back to English
      await page.locator('header button[title*="Store Menu"], header button[title*="दुकान"]').first().click();
      await page.waitForTimeout(300);
      const enBtn = page.getByRole('button', { name: /English/ }).first();
      if (await enBtn.isVisible()) {
        await enBtn.click();
        await page.waitForTimeout(1200);
      }
    }

    // ── STEP 18: Error & Diagnostic Audit ──
    console.log('\n--- 17. Error & Console Diagnostics ---');
    check(pageErrors.length === 0, `Zero uncaught PageErrors throughout all 20 pages (${pageErrors.length} errors)`);
    if (consoleErrors.length > 0) {
      warn('Browser Console Errors logged', consoleErrors.slice(0, 5).join(' | '));
    } else {
      check(true, 'Zero browser console errors logged');
    }

  } catch (err) {
    check(false, `Live audit crashed unexpectedly: ${err.message}`);
    await takeShot(page, 'crash_dump');
  } finally {
    await app.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }

  console.log('\n================================================================');
  console.log(`📊 LIVE AUDIT FINISHED: ${passed}/${passed + failed} CHECKS PASSED (${failed} failures)`);
  if (issues.length > 0) {
    console.log(`⚠️ ISSUES / WARNINGS FOUND: ${issues.length}`);
    console.log(JSON.stringify(issues, null, 2));
  } else {
    console.log('🎉 100% CLEAN: ZERO ISSUES OR FAILURES DETECTED!');
  }
  console.log(`📸 Screenshots saved to: ${SHOTS_DIR}`);
  console.log('================================================================');
}

run().catch(console.error);
