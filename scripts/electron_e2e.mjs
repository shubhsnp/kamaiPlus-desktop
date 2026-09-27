/**
 * Real end-to-end test: launches the actual Electron app (main.js + the static
 * export in out/) and drives it like a shopkeeper would.
 *
 *   npm run build            (out/ must be current)
 *   npm run test:electron
 *
 * All data goes to a throw-away folder (KAMAI_E2E_DIR, see main.js) — the real
 * shop data, licence and Documents\KamaiPlus backups are never touched.
 *
 * The licence check is NOT bypassed. The "with licence" part signs a licence
 * for this computer with the private key (never in the repo); without the key
 * that part is skipped and only the "no licence → blocked" part runs.
 *   KAMAI_LICENCE_PRIVATE_KEY=<path to desktop_licence_private.pem>
 *   (default: %USERPROFILE%\KamaiPlus-Secrets\desktop_licence_private.pem)
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
const PASSWORD = 'e2e-Pass#2468';
const SHOTS = path.join(os.tmpdir(), 'kamaiplus-e2e-shots');

let passed = 0;
let failed = 0;
function check(ok, label) {
  if (ok) { passed++; console.log(`  ✅ [PASS] ${label}`); }
  else { failed++; console.log(`  ❌ [FAIL] ${label}`); }
}

async function launch(dataDir) {
  const env = { ...process.env, KAMAI_E2E_DIR: dataDir };
  // VS Code terminals set this; it makes electron.exe behave as plain Node.
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ executablePath: electronPath, args: [APP_DIR], cwd: APP_DIR, env, timeout: 60000 });
  const page = await app.firstWindow();
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  return { app, page, pageErrors };
}

async function textVisible(page, text, timeout = 20000) {
  try {
    await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

/** Reads a whole object store from the app's IndexedDB (VyaparSetuDB). */
function readStore(page, store) {
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

function writeSignedLicence(dataDir) {
  const pem = fs.readFileSync(PRIVATE_KEY, 'utf8');
  const payload = { v: 1, key: 'KPD-E2E0-TEST-0000-0001', machine_id: licence.getMachineId(), shop_name: 'E2E Test Shop', issued_at: new Date().toISOString() };
  const bytes = Buffer.from(JSON.stringify(payload), 'utf8');
  const signature = crypto.sign(null, bytes, crypto.createPrivateKey(pem));
  fs.mkdirSync(path.join(dataDir, 'userData'), { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'userData', 'licence.json'), JSON.stringify({ licence: bytes.toString('base64url'), signature: signature.toString('base64url') }));
}

async function shot(page, name) {
  try {
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
  } catch { /* window already gone */ }
}

async function run() {
  if (!fs.existsSync(path.join(APP_DIR, 'out', 'index.html'))) {
    console.log('out/ is missing — run `npm run build` first.');
    process.exit(1);
  }
  console.log('================================================================');
  console.log('🖥️  KamaiPlus Desktop — real Electron end-to-end test');
  console.log('================================================================');

  // ── 1. No licence: the app is blocked, even when a page is opened directly ──
  const blankDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kp-e2e-nolic-'));
  {
    const { app, page } = await launch(blankDir);
    try {
      check(await textVisible(page, 'Activate KamaiPlus Desktop'), 'Without a licence the app opens on the activation screen');
      await page.evaluate(() => { window.location.href = '/billing/'; });
      await page.waitForTimeout(2500);
      check(await textVisible(page, 'Activate KamaiPlus Desktop', 8000) && !(await page.getByText('Complete Sale').count()), 'Opening /billing directly without a licence still shows only the activation screen');
      await page.getByPlaceholder('KPD-XXXX-XXXX-XXXX-XXXX').waitFor({ timeout: 3000 }).catch(() => {});
    } catch (err) {
      check(false, `No-licence run crashed: ${err.message}`);
      await shot(page, 'nolicence');
    } finally {
      await app.close();
    }
  }
  const forged = path.join(blankDir, 'userData', 'licence.json');
  fs.mkdirSync(path.dirname(forged), { recursive: true });
  fs.writeFileSync(forged, JSON.stringify({ licence: Buffer.from(JSON.stringify({ v: 1, key: 'KPD-FAKE-FAKE-FAKE-FAKE', machine_id: licence.getMachineId() })).toString('base64url'), signature: 'AAAA' }));
  {
    const { app, page } = await launch(blankDir);
    try {
      check(await textVisible(page, 'Activate KamaiPlus Desktop'), 'A hand-made licence.json with a bad signature is rejected');
    } finally {
      await app.close();
    }
  }
  fs.rmSync(blankDir, { recursive: true, force: true });

  if (!fs.existsSync(PRIVATE_KEY)) {
    console.log(`\n⚠️  Licence private key not found (${PRIVATE_KEY}) — skipping the licensed shop flow.`);
    return;
  }

  // ── 2. Licensed: password → onboarding → sell one item → stock goes down ──
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kp-e2e-shop-'));
  writeSignedLicence(dataDir);
  let productId = '';
  let stockBefore = 0;
  let priceSold = 0;
  let expectedSales = 1;
  {
    const { app, page, pageErrors } = await launch(dataDir);
    let step = 'start';
    try {
      step = 'master password';
      check(await textVisible(page, 'Set Master Password'), 'A signed licence for this computer is accepted (master password setup shown)');
      await page.getByPlaceholder('Enter new password').fill(PASSWORD);
      await page.getByPlaceholder('Re-enter password').fill(PASSWORD);
      await page.getByRole('button', { name: /Set Password & Start/i }).click();

      step = 'onboarding';
      check(await textVisible(page, 'Setup Your Store Profile'), 'After the password, a new shop goes to store setup');
      await page.getByPlaceholder('e.g. Sharma Kirana & General Store').fill('E2E Kirana Store');
      await page.getByPlaceholder('e.g. Ramesh Sharma').fill('Test Owner');
      await page.getByPlaceholder('98765 43210').fill('9876543210');
      await page.getByPlaceholder('e.g. 9876543210@paytm or store@okaxis').fill('e2eshop@okaxis');
      const seed = page.locator('input[type="checkbox"]').first();
      if (!(await seed.isChecked())) await seed.check();
      await page.getByRole('button', { name: /Complete Setup/i }).click();
      await page.waitForURL((u) => !u.pathname.startsWith('/onboarding'), { timeout: 20000 });
      check(true, 'Store setup completes and opens the app');

      step = 'catalog';
      await page.waitForTimeout(1500);
      const products = (await readStore(page, 'products')).filter((p) => p.is_active !== false && !p.parent_id && Number(p.current_stock) > 1 && Number(p.selling_price) > 0);
      check(products.length > 0, `Starter catalog was saved to the local database (${products.length} sellable items)`);
      const target = products.sort((a, b) => String(a.name).localeCompare(String(b.name)))[0];
      productId = target.id;
      stockBefore = Number(target.current_stock);
      priceSold = Number(target.selling_price);
      check(Number.isInteger(priceSold), `Prices are stored as whole paise (${target.name}: ${priceSold})`);

      step = 'billing';
      check(!(await page.evaluate(() => localStorage.getItem('kamai_silent_print') === 'true')), 'Silent print is off (the test never sends a job to a real printer)');
      await page.evaluate(() => { window.location.href = '/billing/'; });
      await page.getByText('Complete Sale', { exact: false }).first().waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
      const search = page.getByPlaceholder(/search/i).first();
      await search.waitFor({ timeout: 20000 });
      await search.fill(target.name);
      await page.waitForTimeout(600);
      await page.locator('button', { hasText: target.name }).first().click();
      const completeBtn = page.getByRole('button', { name: /Complete Sale/i }).first();
      await completeBtn.waitFor({ state: 'visible', timeout: 10000 });
      // A hurried double click must still save exactly one bill.
      await completeBtn.dblclick();

      step = 'sale saved';
      let sales = [];
      for (let i = 0; i < 20 && sales.length === 0; i++) {
        await page.waitForTimeout(500);
        sales = await readStore(page, 'sales');
      }
      await page.waitForTimeout(1500); // give a second (wrong) save time to land
      sales = await readStore(page, 'sales');
      check(sales.length === 1, 'Double-clicking Complete Sale saves exactly one bill');
      const sale = sales[0] || {};
      const saleTotal = Number(sale.total_amount ?? sale.grand_total ?? sale.total ?? NaN);
      check(saleTotal === priceSold, `Bill total equals the item price in paise (${saleTotal} = ${priceSold})`);
      check(sale.payment_method === 'cash', `Bill is recorded as the payment the cashier chose (cash) — got ${sale.payment_method}`);

      const after = (await readStore(page, 'products')).find((p) => p.id === productId);
      check(after && Number(after.current_stock) === stockBefore - 1, `Stock goes down by 1 after the sale (${stockBefore} → ${after && after.current_stock})`);

      // Sidebar navigation must swap only the page (a full reload flashed the
      // black licence screen between pages). The new bill must show elsewhere too.
      step = 'navigation';
      await page.getByRole('button', { name: /New Bill/i }).first().click(); // close the "Sale Completed" modal
      await page.waitForTimeout(400);
      await page.evaluate(() => { window.__kpNoReload = true; });
      let billSeenInTransactions = false;
      for (const [label, route] of [['Products', '/products'], ['Khata Ledger', '/khata'], ['Transactions', '/transactions'], ['Billing POS', '/billing']]) {
        await page.locator('aside a').filter({ hasText: label }).first().click();
        await page.waitForURL((u) => u.pathname.startsWith(route), { waitUntil: 'commit', timeout: 10000 });
        await page.waitForTimeout(500);
        if (route === '/transactions') billSeenInTransactions = await textVisible(page, sale.invoice_number, 8000);
      }
      check(await page.evaluate(() => window.__kpNoReload === true), 'Sidebar navigation changes pages without reloading the app (no black blink)');
      check(billSeenInTransactions, `The new bill (${sale.invoice_number}) shows up in Transactions after navigating there`);

      // v4.68.0 — Add Product opens "Unlimited stock"; off = stock 10 / alert 10.
      step = 'product form';
      await page.locator('aside a[href="/products"]').first().click();
      await page.waitForURL(/\/products/, { waitUntil: 'commit', timeout: 10000 });
      await page.getByRole('button', { name: /Add Product/ }).first().click();
      const unlimited = page.getByRole('checkbox', { name: 'Unlimited Stock (no count)' });
      await unlimited.waitFor({ state: 'attached', timeout: 10000 });
      const onByDefault = await unlimited.isChecked();
      await page.locator('label:has(input[aria-label="Unlimited Stock (no count)"])').click();
      const tenTen = (await page.getByPlaceholder('e.g. 50').inputValue()) === '10' && (await page.getByPlaceholder('e.g. 5', { exact: true }).inputValue()) === '10';
      check(onByDefault && tenTen, 'Add Product: Unlimited stock is on by default; switching it off fills stock 10 and low-stock alert 10');
      await page.locator('label:has(input[aria-label="Unlimited Stock (no count)"])').click();
      // v4.69.0 — a new shop's form shows only name, category, unit, MRP, barcode, stock.
      const extraFields = await Promise.all(['e.g. 150.00', 'e.g. 120.00', 'e.g. 3401'].map((ph) => page.getByPlaceholder(ph).count()));
      check(extraFields.every((n) => n === 0) && (await page.getByText('GST Tax Rate (%)').count()) === 0 && (await page.getByText('Variants (Size / Colour)').count()) === 0,
        'Add Product (new shop): Selling Price, Cost Price, HSN, GST rate and Variants are hidden; MRP is the price');
      await page.getByPlaceholder('e.g. Fortune Sunflower Oil 1L').fill('E2E Unlimited Item');
      await page.getByPlaceholder('e.g. 165.00').fill('25');
      await page.getByRole('button', { name: /Save Product/ }).click();
      await page.waitForTimeout(800);
      const unlimitedItem = (await readStore(page, 'products')).find((p) => p.name === 'E2E Unlimited Item');
      check(unlimitedItem && unlimitedItem.is_unlimited_stock === true && unlimitedItem.selling_price === 2500 && unlimitedItem.mrp === 2500 && unlimitedItem.tax_rate === 0,
        'The new item is saved as unlimited stock and sells at its MRP (₹25 = 2500 paise, no GST)');

      // v4.69.0 — Settings → Features: switched-off screens leave the menu; a direct
      // address shows "turned off"; switching on brings the screen back.
      step = 'feature switches';
      const menuHas = async (href) => (await page.locator(`aside a[href="${href}"]`).count()) > 0;
      const hiddenByDefault = !(await menuHas('/cash-register')) && !(await menuHas('/purchases')) && !(await menuHas('/suppliers')) && !(await menuHas('/gst-reports')) && (await menuHas('/billing'));
      await page.evaluate(() => { window.location.href = '/cash-register/'; });
      const offCard = await textVisible(page, 'is turned off', 15000);
      check(hiddenByDefault && offCard, 'New shop: Cash Register, Purchases, Suppliers and GST are not in the menu; opening Cash Register directly says it is turned off');
      await page.evaluate(() => { window.location.href = '/settings/?tab=features'; });
      const cashSwitch = page.getByRole('checkbox', { name: 'Cash Register' });
      await cashSwitch.waitFor({ state: 'attached', timeout: 15000 });
      await page.locator('label:has(input[data-feature="cash_register"])').click();
      await page.waitForTimeout(400);
      check((await cashSwitch.isChecked()) && (await menuHas('/cash-register')), 'Settings → Features: switching Cash Register on puts it back in the menu at once');
      await page.locator('label:has(input[data-feature="cash_register"])').click();
      await page.waitForTimeout(300);

      // 🔊 / 🔇 in the top bar.
      const soundBtn = page.locator('header button[aria-pressed]').first();
      await soundBtn.click();
      const mutedNow = await page.evaluate(() => localStorage.getItem('kamai_sound_muted'));
      await soundBtn.click();
      const unmutedNow = await page.evaluate(() => localStorage.getItem('kamai_sound_muted'));
      check(mutedNow === 'true' && unmutedNow === 'false', 'Top bar sound button mutes and unmutes the app');

      // v4.70.0 — Excel price list: Hindi headings understood, every new item gets a saved
      // barcode, uploading the sheet again with a new price updates it (no copies).
      step = 'excel import';
      const XLSX = require('xlsx');
      const sheetFile = (rows) => {
        const f = path.join(dataDir, `list_${Date.now()}.xlsx`);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Section', 'Item (आयटम)', 'Company (कंपनी)', 'Price (भाव)', 'Per (प्रति)'], ...rows]), 'Items');
        XLSX.writeFile(wb, f);
        return f;
      };
      const runImport = async (file) => {
        await page.evaluate(() => { window.location.href = '/products/'; });
        await page.getByRole('button', { name: /Import Excel/ }).first().click();
        await page.locator('input[data-import-file]').setInputFiles(file);
        await page.getByRole('button', { name: /Next: check changes/ }).click();
        await page.getByRole('button', { name: /^Import:/ }).click();
        await page.locator('[data-import-done]').waitFor({ timeout: 30000 });
      };
      const productCount = async () => (await readStore(page, 'products')).length;
      const itemsBefore = await productCount();
      await runImport(sheetFile([['चौरसा', '8 वाला', 'अतिसिया', 320, '100 नग'], ['अनार', 'अनार स्पेशल', 'विन', 590, 'युनिट'], ['अटॅम बॉम्ब', 'Saddam', 'Regular', '', 'युनिट']]));
      let listed = (await readStore(page, 'products')).filter((p) => p.id.startsWith('prod_imp_'));
      const chaurasa = listed.find((p) => p.name === 'चौरसा 8 वाला – अतिसिया (100 नग)');
      const validEan = (c) => /^200\d{10}$/.test(c || '') && (10 - ([...c.slice(0, 12)].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0) % 10)) % 10 === Number(c[12]);
      check((await productCount()) === itemsBefore + 2 && chaurasa && chaurasa.selling_price === 32000 && chaurasa.unit === 'box' && listed.every((p) => validEan(p.barcode) && p.is_unlimited_stock),
        'Excel import: Hindi headings read, 2 items added (row without price skipped), each with its own saved barcode, price in paise');
      await page.getByRole('button', { name: /Done & View Catalog/ }).click();
      await runImport(sheetFile([['चौरसा', '8 वाला', 'अतिसिया', 350, '100 नग'], ['अनार', 'अनार स्पेशल', 'विन', 590, 'युनिट']]));
      listed = (await readStore(page, 'products')).filter((p) => p.id.startsWith('prod_imp_'));
      const again = listed.find((p) => p.id === chaurasa.id);
      check((await productCount()) === itemsBefore + 2 && again.selling_price === 35000 && again.barcode === chaurasa.barcode,
        'Uploading the sheet again with a new price updates that price — no copies, barcode kept');

      // v4.71.0 — "Print labels" after the import: Studio opens with the re-priced item and
      // the label printer gets one 50 × 25 mm page per label. kp:print is caught in the main
      // process and rendered to PDF — nothing reaches a real printer.
      step = 'label print';
      const pdfDir = path.join(dataDir, 'label-pdf');
      fs.mkdirSync(pdfDir, { recursive: true });
      await app.evaluate(({ ipcMain, BrowserWindow }, dir) => {
        const fsm = process.mainModule.require('fs');
        const pathm = process.mainModule.require('path');
        globalThis.__labelJobs = [];
        ipcMain.removeHandler('kp:print');
        ipcMain.handle('kp:print', async (_e, opts) => {
          const file = pathm.join(dir, `job${globalThis.__labelJobs.length}.html`);
          fsm.writeFileSync(file, opts.html, 'utf8');
          const win = new BrowserWindow({ show: false });
          await win.loadFile(file);
          const size = opts.paper === 'label' ? { width: opts.pageSizeMm.width / 25.4, height: opts.pageSizeMm.height / 25.4 } : 'A4';
          const pdf = await win.webContents.printToPDF({ pageSize: size, printBackground: true, margins: { top: 0, bottom: 0, left: 0, right: 0 } });
          win.destroy();
          const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
          globalThis.__labelJobs.push({ paper: opts.paper, pageSizeMm: opts.pageSizeMm, silent: opts.silent, pages });
          return { ok: true };
        });
      }, pdfDir);
      await page.locator('[data-import-print-labels]').click();
      await page.waitForURL(/barcode-generator/, { timeout: 15000 });
      await page.locator('[data-label-preview]').waitFor({ timeout: 15000 });
      await page.locator('[data-print-labels]').click();
      await page.locator('[data-print-notice]').waitFor({ timeout: 30000 });
      const [labelJob] = await app.evaluate(() => globalThis.__labelJobs);
      const labelHtml = fs.readFileSync(path.join(pdfDir, 'job0.html'), 'utf8');
      check(labelJob && labelJob.paper === 'label' && labelJob.pageSizeMm.width === 50 && labelJob.pageSizeMm.height === 25 && labelJob.pages === 1 && labelHtml.includes(chaurasa.barcode),
        `Import → Print labels → the label printer gets one 50 × 25 mm page with the item's saved barcode (${JSON.stringify(labelJob)})`);

      // v4.68.0 — customer typed on the counter row (no pop-up) is saved with the bill.
      step = 'counter customer';
      await page.locator('aside a[href="/billing"]').first().click();
      await page.waitForURL(/\/billing/, { waitUntil: 'commit', timeout: 10000 });
      const posSearch = page.getByPlaceholder(/Search products/).first();
      await posSearch.waitFor({ timeout: 10000 });
      const addByName = async (name) => { await posSearch.fill(name); await page.waitForTimeout(500); await posSearch.press('Enter'); await page.waitForTimeout(300); };
      const salesCount = async () => (await readStore(page, 'sales')).length;
      const closeSaleWindow = async () => { await page.getByRole('button', { name: /New Bill/i }).first().click(); await page.waitForTimeout(400); };
      await addByName('E2E Unlimited Item');
      await page.locator('input[data-pos-customer-name]').first().fill('Anil Verma');
      await page.locator('input[data-pos-customer-phone]').first().fill('91234 56780');
      const n0 = await salesCount();
      await page.keyboard.press('F10');
      await page.waitForTimeout(1500);
      const custSale = (await readStore(page, 'sales')).find((s) => s.customer_name === 'Anil Verma');
      const anil = (await readStore(page, 'customers')).find((c) => c.name === 'Anil Verma');
      check((await salesCount()) === n0 + 1 && anil && anil.phone === '9123456780' && custSale && custSale.customer_id === anil.id, 'Customer name + mobile typed on the counter (no pop-up) is saved and linked to the bill (F10)');
      await closeSaleWindow();

      // Shortcuts on the counter, and none of them fires under the "Sale completed" window.
      step = 'shortcuts';
      const tabsNow = () => page.evaluate(() => JSON.parse(localStorage.getItem('kamai_pos_tabs') || '[]'));
      await page.locator('main').first().click({ position: { x: 5, y: 5 } }).catch(() => {});
      const t0 = (await tabsNow()).length;
      await page.keyboard.press('F1');
      await page.waitForTimeout(300);
      const t1 = await tabsNow();
      await page.keyboard.press('F8'); await page.waitForTimeout(150);
      const upi = (await tabsNow()).some((t) => t.paymentMethod === 'upi');
      await page.keyboard.press('F9'); await page.waitForTimeout(150);
      const credit = (await tabsNow()).some((t) => t.paymentMethod === 'credit');
      await page.keyboard.press('F4'); await page.waitForTimeout(150);
      const cash = (await tabsNow()).every((t) => t.paymentMethod === 'cash');
      await page.keyboard.press('F2');
      const searchFocused = await posSearch.evaluate((el) => el === document.activeElement);
      await posSearch.fill('E2E');
      await page.keyboard.press('Escape');
      const cleared = (await posSearch.inputValue()) === '';
      check(t1.length === t0 + 1 && upi && credit && cash && searchFocused && cleared, 'F1 new bill, F8 UPI, F9 Credit, F4 Cash, F2 search, Esc clears search all work');
      await addByName('E2E Unlimited Item');      // this bill waits…
      await page.keyboard.press('F1');
      await page.waitForTimeout(300);
      await addByName('E2E Unlimited Item');      // …while this one is sold
      await posSearch.evaluate((el) => el.blur());
      const n1 = await salesCount();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
      const n2 = await salesCount();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(800);
      await page.keyboard.press('F10');
      await page.waitForTimeout(1200);
      check(n2 === n1 + 1 && (await salesCount()) === n2, 'Enter completes the sale; Enter / F10 under the "Sale completed" window never complete the bill waiting behind it');
      await closeSaleWindow();
      expectedSales = await salesCount();

      step = 'errors';
      check(pageErrors.length === 0, `No uncaught page errors during the flow${pageErrors.length ? `: ${pageErrors.slice(0, 3).join(' | ')}` : ''}`);
    } catch (err) {
      check(false, `Licensed flow failed at "${step}": ${err.message.split('\n')[0]}`);
      await shot(page, `failed-${step.replace(/\W+/g, '-')}`);
      console.log(`     screenshot: ${SHOTS}`);
    } finally {
      await app.close();
    }
  }

  // ── 3. Restart: data survives, password is asked, licence works offline ──
  {
    const { app, page } = await launch(dataDir);
    try {
      // Lock on launch (v4.58.0): a signed-in shop still needs the password after a restart.
      const pw = page.getByPlaceholder('••••••••');
      const asked = await pw.waitFor({ state: 'visible', timeout: 20000 }).then(() => true, () => false);
      check(!(await page.getByText('Activate KamaiPlus Desktop').count()), 'After a restart the licence is still valid offline (no activation screen)');
      check(asked, 'After a restart the app asks for the master password before showing anything');
      if (asked) {
        await page.evaluate(() => { window.location.href = '/billing/'; });
        await page.waitForTimeout(2500);
        check((await pw.isVisible()) && !(await page.getByText('Complete Sale').count()), 'Opening /billing directly while locked still shows only the password screen');
        await pw.fill('wrong-password');
        await pw.press('Enter');
        await page.waitForTimeout(1000);
        check((await pw.isVisible()) && !(await page.getByText('E2E Kirana Store').count()), 'A wrong master password does not open the app');
        await pw.fill(PASSWORD);
        await pw.press('Enter');
        check(await textVisible(page, 'E2E Kirana Store'), 'The right password opens the shop with its own name (signed-in user kept)');

        // Lock now (v4.65.0): store menu → password screen → back on the same page.
        // Let the unlock finish its own redirect first: a click in the same instant can be
        // undone by it (the test used to lock while still on Home and then blame the return).
        await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(1000);
        await page.locator('aside a[href="/products"]').first().click();
        await page.waitForURL(/\/products/, { waitUntil: 'commit', timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(800);
        const lockedFrom = new URL(page.url()).pathname.replace(/\/$/, '');
        await page.locator('header button[title="Click for Store Menu, Language & Settings"]').click();
        await page.getByRole('button', { name: /Lock now/ }).click();
        const relocked = await pw.waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false);
        check(relocked && !(await page.locator('aside').count()), '"Lock now" hides the shop behind the master password');
        if (relocked) {
          await pw.fill(PASSWORD);
          await pw.press('Enter');
          await page.waitForURL(/\/products/, { waitUntil: 'commit', timeout: 10000 }).catch(() => {});
          await page.waitForTimeout(800);
          const backPath = new URL(page.url()).pathname.replace(/\/$/, '');
          const asideCount = await page.locator('aside').count();
          check(lockedFrom === '/products' && backPath === '/products' && asideCount > 0, `After the password the app returns to the page that was open (Products)${lockedFrom === '/products' && backPath === '/products' && asideCount > 0 ? '' : ` — locked on "${lockedFrom}", came back to "${backPath}", sidebar ${asideCount ? 'shown' : 'missing'}`}`);
          if (!(backPath === '/products' && asideCount > 0)) await shot(page, 'failed-lock-return');
        }
      }
      const sales = await readStore(page, 'sales');
      const product = (await readStore(page, 'products')).find((p) => p.id === productId);
      check(sales.length === expectedSales && product && Number(product.current_stock) === stockBefore - 1, `The ${expectedSales} bills and the new stock are still there after closing and reopening the app`);
      const logFile = path.join(dataDir, 'userData', 'logs', 'errors.log');
      const logged = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean) : [];
      check(logged.length === 0, `Error log is empty after the whole flow${logged.length ? ` (${logged.length} entries, first: ${logged[0].slice(0, 160)})` : ''}`);
    } catch (err) {
      check(false, `Restart check failed: ${err.message.split('\n')[0]}`);
      await shot(page, 'failed-restart');
    } finally {
      await app.close();
    }
  }
  fs.rmSync(dataDir, { recursive: true, force: true });
}

run()
  .catch((err) => { failed++; console.error(err); })
  .finally(() => {
    console.log('================================================================');
    console.log(`📊 ELECTRON E2E: ${passed}/${passed + failed} CHECKS PASSED (${failed} failures)`);
    console.log('================================================================');
    process.exit(failed ? 1 : 0);
  });
