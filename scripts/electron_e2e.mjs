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
  // KAMAI_E2E_GOOGLE_STUB: the test cannot sign in to Google — main.js answers kp:google-signin
  // with a stand-in (only in an unpackaged run — an installed app never).
  const env = { ...process.env, KAMAI_E2E_DIR: dataDir, KAMAI_E2E_GOOGLE_STUB: '1' };
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

/** A licence signed like the server does; `extra` adds / overrides payload fields (valid_until…). */
function signedLicence(extra = {}) {
  const pem = fs.readFileSync(PRIVATE_KEY, 'utf8');
  const payload = { v: 1, key: 'KPD-E2E0-TEST-0000-0001', machine_id: licence.getMachineId(), shop_name: 'E2E Test Shop', issued_at: new Date().toISOString(), ...extra };
  const bytes = Buffer.from(JSON.stringify(payload), 'utf8');
  const signature = crypto.sign(null, bytes, crypto.createPrivateKey(pem));
  return { licence: bytes.toString('base64url'), signature: signature.toString('base64url') };
}

function writeSignedLicence(dataDir, extra = {}) {
  fs.mkdirSync(path.join(dataDir, 'userData'), { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'userData', 'licence.json'), JSON.stringify(signedLicence(extra)));
}

/**
 * v4.85.0 — licence end date + online check-in, on licence.js itself (a stand-in server).
 * Then one real launch with an ended licence: only the "licence has ended" screen shows.
 */
async function licenceValidityChecks() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kp-e2e-valid-'));
  const userDataDir = path.join(dir, 'userData');
  const day = 24 * 60 * 60 * 1000;
  try {
    writeSignedLicence(dir, { valid_until: new Date(Date.now() + 5 * day + 3600000).toISOString() });
    const soon = licence.getStatus({ userDataDir, dev: false });
    writeSignedLicence(dir, { valid_until: new Date(Date.now() - day).toISOString() });
    const ended = licence.getStatus({ userDataDir, dev: false });
    writeSignedLicence(dir);
    const lifetime = licence.getStatus({ userDataDir, dev: false });
    check(soon.state === 'active' && soon.daysLeft === 5 && ended.state === 'expired' && lifetime.state === 'active' && lifetime.validUntil === null,
      `Licence end date: 5 days left → active (${soon.daysLeft}), a past end date → ended, no end date → lifetime`);

    // Turning the PC clock back: the time already seen (and the licence's server time) wins.
    const end = Date.now() + 2 * day;
    writeSignedLicence(dir, { valid_until: new Date(end).toISOString() });
    const later = licence.getStatus({ userDataDir, dev: false, nowMs: end + day });
    const rolledBack = licence.getStatus({ userDataDir, dev: false, nowMs: Date.now() });
    fs.rmSync(path.join(userDataDir, 'licence_clock.json'), { force: true });
    writeSignedLicence(dir, { valid_until: new Date(Date.now() + day).toISOString(), issued_at: new Date(Date.now() + 3 * day).toISOString() });
    const beforeIssue = licence.getStatus({ userDataDir, dev: false, nowMs: Date.now() });
    check(later.state === 'expired' && rolledBack.state === 'expired' && beforeIssue.state === 'expired',
      'Licence end date: turning the computer clock back does not bring an ended licence back');
    fs.rmSync(path.join(userDataDir, 'licence_clock.json'), { force: true });

    // Check-in: renewed end date saved; blocked / moved stops the app; offline changes nothing.
    writeSignedLicence(dir, { valid_until: new Date(Date.now() - day).toISOString() });
    const sent = [];
    const answer = (status, body) => async (_url, init) => { sent.push(JSON.parse(init.body)); return { ok: status === 200, status, json: async () => body }; };
    const renewedUntil = new Date(Date.now() + 365 * day).toISOString();
    const renewed = await licence.refresh({ userDataDir, appVersion: '4.85.0', fetchImpl: answer(200, signedLicence({ valid_until: renewedUntil })) });
    const afterRenew = licence.getStatus({ userDataDir, dev: false });
    const offline = await licence.refresh({ userDataDir, appVersion: '4.85.0', fetchImpl: async () => { throw new Error('ENOTFOUND'); } });
    const otherKey = await licence.refresh({ userDataDir, appVersion: '4.85.0', fetchImpl: answer(200, signedLicence({ key: 'KPD-OTHE-RKEY-0000-0002' })) });
    const serverDown = await licence.refresh({ userDataDir, appVersion: '4.85.0', fetchImpl: answer(500, { error: 'Licence service error.' }) });
    const stillOk = licence.getStatus({ userDataDir, dev: false });
    check(renewed.ok && afterRenew.state === 'active' && afterRenew.validUntil === renewedUntil && sent[0].action === 'refresh' && sent[0].key === 'KPD-E2E0-TEST-0000-0001'
      && sent[0].machine_id === licence.getMachineId() && offline.offline && !otherKey.ok && !serverDown.ok && stillOk.state === 'active',
      'Check-in: a renewed end date comes back and the ended licence works again; no internet, a server error or a licence for another key change nothing');
    const blocked = await licence.refresh({ userDataDir, appVersion: '4.85.0', fetchImpl: answer(403, { code: 'revoked', error: 'This licence key has been blocked. Please contact KamaiPlus support.' }) });
    const afterBlock = licence.getStatus({ userDataDir, dev: false });
    check(blocked.stopped && afterBlock.state === 'required' && /blocked/.test(afterBlock.reason || '') && fs.existsSync(path.join(userDataDir, 'licence.blocked.json')) && !fs.existsSync(path.join(userDataDir, 'licence.json')),
      'Check-in: a key blocked in the Admin Console stops the app with the reason (the old licence is kept aside for support)');

    // A real launch with an ended licence.
    writeSignedLicence(dir, { valid_until: new Date(Date.now() - day).toISOString() });
    fs.rmSync(path.join(userDataDir, 'licence.blocked.json'), { force: true });
    const { app, page } = await launch(dir);
    try {
      const shown = await textVisible(page, 'Your KamaiPlus licence has ended');
      await page.evaluate(() => { window.location.href = '/billing/'; });
      await page.waitForTimeout(2500);
      check(shown && (await textVisible(page, 'Your KamaiPlus licence has ended', 8000)) && !(await page.getByText('Complete Sale').count()) && (await page.locator('[data-licence-check-again]').count()) === 1,
        'An ended licence opens only the "licence has ended" screen (with "Check again"), even on /billing');
    } finally {
      await app.close();
    }
  } catch (err) {
    check(false, `Licence validity checks crashed: ${err.message}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
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

  // ── 1b. Licence end date + online check-in (v4.85.0) ──
  await licenceValidityChecks();

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
      // v4.84.0 — first time the Google account is offered with the password; optional since
      // v4.85.0 (it can be connected later on Backup). The stand-in answers here.
      const setBtn = page.getByRole('button', { name: /Set Password & Start/i });
      const openBeforeGoogle = await setBtn.isEnabled();
      await page.getByRole('button', { name: /Continue with Google/i }).click();
      const connected = await textVisible(page, 'e2e.owner@example.com', 10000);
      check(openBeforeGoogle && connected,
        `First run offers the Google account (optional — password works without it: ${openBeforeGoogle}; connected: ${connected})`);
      await setBtn.click();

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

      // v4.81.0 — Khata switched off: out of the menu and no Credit / Udhar on the counter;
      // switched back on afterwards (the khata checks further down need it).
      const khataInMenuBefore = await menuHas('/khata');
      await page.locator('label:has(input[data-feature="khata"])').click();
      await page.waitForTimeout(400);
      const khataInMenuOff = await menuHas('/khata');
      await page.evaluate(() => { window.location.href = '/billing/'; });
      await textVisible(page, 'Payment Mode', 15000);
      const creditButtonsOff = await page.locator('button', { hasText: 'F9' }).count();
      const f9HintOff = await page.locator('[data-status-shortcut="F9"]').count();
      await page.evaluate(() => { window.location.href = '/settings/?tab=features'; });
      await page.getByRole('checkbox', { name: 'Khata (Udhar)' }).waitFor({ state: 'attached', timeout: 15000 });
      await page.locator('label:has(input[data-feature="khata"])').click();
      await page.waitForTimeout(400);
      check(khataInMenuBefore && !khataInMenuOff && creditButtonsOff === 0 && f9HintOff === 0 && (await menuHas('/khata')),
        'Settings → Features → Khata off: Khata leaves the menu and Billing has no Credit (F9) button or hint; switched back on, it returns');

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
        // v4.89.0 — the first label print calibrates the printer: caught here too, so the test
        // never feeds labels on a real printer attached to this PC.
        globalThis.__calibrations = [];
        ipcMain.removeHandler('kp:calibrate-label-printer');
        ipcMain.handle('kp:calibrate-label-printer', async (_e, name) => {
          globalThis.__calibrations.push({ name, at: globalThis.__labelJobs.length });
          return { ok: true, language: 'TSPL' };
        });
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
      // A shop with a label printer chosen (the client's TSC) — "Ask every time" never calibrates.
      await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('kamai_label_settings') || '{}');
        localStorage.setItem('kamai_label_settings', JSON.stringify({ ...s, printer: 'E2E Label Printer' }));
        localStorage.removeItem('kamai_label_calibrated');
      });
      await page.locator('[data-import-print-labels]').click();
      await page.waitForURL(/barcode-generator/, { timeout: 15000 });
      await page.locator('[data-label-preview]').waitFor({ timeout: 15000 });
      // v4.85.0 — the preview must actually SHOW the labels (Rahul: "preview dikh nahi raha").
      const previewFrame = page.frameLocator('[data-label-preview]');
      // v4.85.0: an empty list shows a SAMPLE label first; the frame reloads when the items arrive.
      await page.locator('[data-preview-sample]').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
      let previewBox = null;
      for (let i = 0; i < 20 && !previewBox; i++) {
        await previewFrame.locator('.label').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
        previewBox = await previewFrame.locator('.label').first().boundingBox().catch(() => null);
        if (!previewBox) await page.waitForTimeout(250);
      }
      const previewLabels = await previewFrame.locator('.label').count();
      const previewBars = await previewFrame.locator('.label .bars svg').count();
      const frameBox = await page.locator('[data-label-preview]').boundingBox();
      const inView = frameBox && frameBox.y < 860 && frameBox.y + 40 > 0;
      await shot(page, 'studio-preview');
      check(previewLabels > 0 && previewBars > 0 && previewBox && previewBox.width > 60 && previewBox.height > 25 && inView,
        `Barcode Studio preview shows the labels on screen (${previewLabels} labels, bars ${previewBars}, label ${JSON.stringify(previewBox)}, frame top ${frameBox?.y})`);
      await page.locator('[data-print-labels]').click();
      await page.locator('[data-print-notice]').waitFor({ timeout: 30000 });
      const [labelJob] = await app.evaluate(() => globalThis.__labelJobs);
      const labelHtml = fs.readFileSync(path.join(pdfDir, 'job0.html'), 'utf8');
      check(labelJob && labelJob.paper === 'label' && labelJob.pageSizeMm.width === 50 && labelJob.pageSizeMm.height === 25 && labelJob.pages === 1 && labelHtml.includes(chaurasa.barcode),
        `Import → Print labels → the label printer gets one 50 × 25 mm page with the item's saved barcode (${JSON.stringify(labelJob)})`);
      // v4.89.0 (Customer Bug: first labels of the run shifted on a fresh 50 × 25 roll) — the first
      // print to this printer at this size calibrates it, BEFORE the labels; the next print does not.
      const calsAfterFirst = await app.evaluate(() => globalThis.__calibrations.slice());
      await page.locator('[data-print-labels]').click();
      await page.waitForTimeout(2500);
      const calsAfterSecond = await app.evaluate(() => globalThis.__calibrations.slice());
      const jobsNow = (await app.evaluate(() => globalThis.__labelJobs)).length;
      check(calsAfterFirst.length === 1 && calsAfterFirst[0].at === 0 && calsAfterFirst[0].name && calsAfterSecond.length === 1 && jobsNow === 2
        && (await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('kamai_label_calibrated') || '{}')).length)) === 1,
        `First label print to a printer calibrates it first (once per printer + size), the next print goes straight out (${JSON.stringify(calsAfterFirst)}, after 2nd: ${calsAfterSecond.length})`);

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
      const activeBill = () => page.locator('[data-active-bill]').first().getAttribute('data-bill-tab').catch(() => '');
      // v4.85.0 — F4 / F8 / F9 are a switch (Settings → Features), off for a new shop:
      // F8 does nothing and the status bar shows no payment keys. Then switched on.
      await page.keyboard.press('F8'); await page.waitForTimeout(150);
      const keysOffByDefault = (await tabsNow()).every((t) => t.paymentMethod !== 'upi')
        && (await page.locator('[data-status-shortcut="F8"]').count()) === 0 && (await page.locator('[data-status-shortcut="F2"]').count()) === 1;
      await page.evaluate(() => {
        localStorage.setItem('kamai_feature_switches', JSON.stringify({ ...JSON.parse(localStorage.getItem('kamai_feature_switches') || '{}'), payment_keys: true }));
        window.dispatchEvent(new Event('feature_switches_changed'));
      });
      await page.waitForTimeout(300);
      const keysHintOn = (await page.locator('[data-status-shortcut="F8"]').count()) === 1;
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
      // F2 = the next open bill (v4.85.0 — it was a second "search" key); '/' is search.
      const billBefore = await activeBill();
      await page.keyboard.press('F2'); await page.waitForTimeout(300);
      const billAfter = await activeBill();
      const f2Next = (await tabsNow()).length === t1.length && Boolean(billAfter) && billAfter !== billBefore;
      await page.keyboard.press('/');
      const searchFocused = await posSearch.evaluate((el) => el === document.activeElement);
      await posSearch.fill('E2E');
      await page.keyboard.press('Escape');
      const cleared = (await posSearch.inputValue()) === '';
      check(keysOffByDefault && keysHintOn && t1.length === t0 + 1 && upi && credit && cash && f2Next && searchFocused && cleared,
        `F4/F8/F9 off for a new shop (${keysOffByDefault}), switched on they show (${keysHintOn}) and F8 UPI, F9 Credit, F4 Cash work; F1 new bill, F2 next bill (${billBefore} → ${billAfter}), / search, Esc clears search`);
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

      // v4.72.0 — barcode gun: a code typed into the search box adds its item, Enter on the
      // empty box finishes the bill, the next scan closes "Sale completed", and with a bill
      // printer set once on the counter Enter prints straight to it. kp:print is caught in
      // the main process — nothing reaches a real printer.
      step = 'barcode gun';
      const [gA, gB] = listed; // the imported items, with saved store barcodes
      const cartQty = async (pid) => (await tabsNow()).flatMap((t) => t.cart).filter((i) => i.product_id === pid).reduce((a, i) => a + i.quantity, 0);
      const gun = async (code) => { await page.keyboard.type(code, { delay: 3 }); await page.keyboard.press('Enter'); await page.waitForTimeout(700); };
      const saleWindow = () => page.getByText('Sale Completed').first().isVisible().catch(() => false);
      const inSearch = () => posSearch.evaluate((el) => el === document.activeElement);
      await posSearch.click();
      await gun(gA.barcode);
      await gun(gA.barcode);
      await gun(gB.barcode);
      check((await cartQty(gA.id)) === 2 && (await cartQty(gB.id)) === 1 && (await posSearch.inputValue()) === '' && !(await page.getByText(/Add Scanned Barcode/).count()),
        `Gun scans into the search box add the items (A ×${await cartQty(gA.id)}, B ×${await cartQty(gB.id)}) and leave the box empty`);
      const g0 = await salesCount();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
      check((await salesCount()) === g0 + 1 && (await saleWindow()), 'Enter on the empty search box finishes the bill ("Sale completed" shows)');
      await gun(gB.barcode);
      await page.waitForTimeout(400);
      check(!(await saleWindow()) && (await cartQty(gB.id)) === 1 && (await cartQty(gA.id)) === 0 && (await inSearch()),
        "The next customer's scan closes 'Sale completed', starts the next bill, and the cursor is back in the search box");

      await app.evaluate(({ ipcMain }) => {
        globalThis.__billJobs = [];
        ipcMain.removeHandler('kp:print');
        globalThis.__billDelay = 0;
        globalThis.__billAnswer = { ok: true };
        ipcMain.handle('kp:print', async (_e, opts) => {
          globalThis.__billJobs.push({ paper: opts.paper, silent: opts.silent, deviceName: opts.deviceName || '' });
          await new Promise((r) => setTimeout(r, globalThis.__billDelay));
          return globalThis.__billAnswer;
        });
      });
      await page.getByRole('button', { name: /Silent: OFF/ }).click();
      await page.locator('[data-bill-autoprint]').waitFor({ timeout: 5000 });
      await page.locator('[data-bill-format="thermal-80"]').click();
      const printerNames = await page.locator('select[data-bill-printer] option').evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
      if (printerNames.length) await page.locator('select[data-bill-printer]').selectOption(printerNames[0]);
      await page.locator('[data-bill-autoprint]').check();
      await page.getByRole('button', { name: /^Done$/ }).click();
      await page.waitForTimeout(400);
      const savedPs = await page.evaluate(() => JSON.parse(localStorage.getItem('kamai_print_settings') || '{}'));
      await gun(gA.barcode);
      const g1 = await salesCount();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1800);
      const [billJob] = await app.evaluate(() => globalThis.__billJobs);
      check(savedPs.defaultFormat === 'thermal-80' && (savedPs.thermalPrinter || '') === (printerNames[0] || '') && (await salesCount()) === g1 + 1
        && billJob && billJob.paper === 'thermal-80' && billJob.silent === true && billJob.deviceName === (printerNames[0] || '') && !(await saleWindow()) && (await inSearch()),
        `Bill printer set once on the counter: Enter saves the bill and prints it straight to that printer, no window, cursor ready for the next scan (${JSON.stringify(billJob)})`);
      // v4.74.0 — a printer that takes 1.5 s: the counter is cleared at once, and the next
      // customer's scan 0.3 s after Enter goes into the next bill (it used to vanish).
      await app.evaluate(() => { globalThis.__billDelay = 1500; });
      await gun(gB.barcode);
      const g2 = await salesCount();
      const tEnter = Date.now();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => /CART ITEMS \(0\)/.test(document.body.innerText), null, { timeout: 5000 }).catch(() => {});
      const clearedMs = Date.now() - tEnter;
      await page.keyboard.type(gA.barcode, { delay: 3 });
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2200);
      const soldNow = (await readStore(page, 'sales')).sort((a, b) => a.created_at.localeCompare(b.created_at)).pop();
      check((await salesCount()) === g2 + 1 && clearedMs < 1000 && soldNow.items.length === 1 && soldNow.items[0].product_id === gB.id && (await cartQty(gA.id)) === 1,
        `Slow printer: the counter is ready in ${clearedMs} ms (no waiting for the printer) and a scan made meanwhile goes into the next bill`);
      // A bill that did not print waits in a red bar; "Print again" prints it.
      await app.evaluate(() => { globalThis.__billDelay = 0; globalThis.__billAnswer = { ok: false, error: 'Printer is offline' }; });
      await page.keyboard.press('Enter');
      const barShown = await page.locator('[data-print-failed]').waitFor({ timeout: 5000 }).then(() => true, () => false);
      const barText = barShown ? await page.locator('[data-print-failed]').innerText() : '';
      await app.evaluate(() => { globalThis.__billAnswer = { ok: true }; });
      const jobsBefore = (await app.evaluate(() => globalThis.__billJobs)).length;
      if (barShown) await page.locator('[data-print-retry]').first().click();
      await page.waitForTimeout(800);
      check(barShown && /Printer is offline/.test(barText) && !(await saleWindow()) && (await page.locator('[data-print-failed]').count()) === 0 && (await app.evaluate(() => globalThis.__billJobs)).length === jobsBefore + 1,
        'A bill that did not print shows in a red bar (no window over the next customer); "Print again" prints it and the bar goes away');
      await page.getByRole('button', { name: /Silent: ON/ }).click(); // back off before the restart checks
      await page.waitForTimeout(300);

      // v4.73.0 — English letters find the Hindi-named items; the counter has no webcam,
      // Rapid (webcam) or Bluetooth hardware-manager buttons any more.
      step = 'english search';
      const anarItem = listed.find((p) => p.name.startsWith('अनार स्पेशल'));
      const typeAndAdd = async (text) => { await posSearch.fill(text); await page.waitForTimeout(800); await posSearch.press('Enter'); await page.waitForTimeout(400); };
      const c0 = await cartQty(chaurasa.id);
      const a0 = await cartQty(anarItem.id);
      await typeAndAdd('chaurasa');
      await typeAndAdd('anar special');
      check((await cartQty(chaurasa.id)) === c0 + 1 && (await cartQty(anarItem.id)) === a0 + 1,
        'Typed in English, "chaurasa" and "anar special" find and add the Hindi-named items (चौरसा 8 वाला…, अनार स्पेशल…)');
      check(!(await page.getByTitle('Scan Barcode via Camera').count()) && !(await page.getByRole('button', { name: /^Rapid$/ }).count()) && !(await page.getByTitle(/POS Hardware/).count()),
        'The counter has no webcam scan, Rapid or hardware-manager buttons');
      expectedSales = await salesCount();

      // v4.77.0 — label-first stock: type name / price / qty in Barcode Studio → items saved
      // with counted stock and their own barcode, labels print (caught in the main process),
      // the label scans into a bill; loose packs carry their weight; Manual Inward and a
      // supplier's Excel bill both offer their labels.
      step = 'label-first stock';
      const labelDir = path.join(dataDir, 'label-first');
      fs.mkdirSync(labelDir, { recursive: true });
      await app.evaluate(({ ipcMain }, dir) => {
        const fsm = process.mainModule.require('fs');
        const pathm = process.mainModule.require('path');
        globalThis.__lfJobs = [];
        ipcMain.removeHandler('kp:print');
        ipcMain.handle('kp:print', async (_e, opts) => {
          const file = pathm.join(dir, `lf${globalThis.__lfJobs.length}.html`);
          fsm.writeFileSync(file, opts.html, 'utf8');
          globalThis.__lfJobs.push({ paper: opts.paper, pageSizeMm: opts.pageSizeMm, pages: (opts.html.match(/<div class="page">/g) || []).length, file });
          return { ok: true };
        });
      }, labelDir);
      const byName = async (name) => (await readStore(page, 'products')).find((p) => p.name === name);
      await page.evaluate(() => { window.location.href = '/barcode-generator/?new=1'; });
      await page.locator('[data-entry-list]').waitFor({ timeout: 20000 });
      const focusedIs = (attr) => page.evaluate((a) => document.activeElement?.hasAttribute(a), attr);
      const typeEnter = async (text) => { if (text) await page.keyboard.type(text, { delay: 5 }); await page.keyboard.press('Enter'); await page.waitForTimeout(150); };
      // Row 1: a new item — name, MRP, quantity; Enter walks the row and opens the next one.
      await page.waitForTimeout(300);
      const startsInName = await focusedIs('data-entry-name');
      await typeEnter('E2E Rocket 10 Shot');
      const thenPrice = await focusedIs('data-entry-price');
      await typeEnter('120');
      await typeEnter('20');
      const nextRow = await focusedIs('data-entry-name');
      // Row 2: the exact name of a saved (uncounted) item restocks it — price kept.
      await typeEnter(anarItem.name);
      await typeEnter('');
      await typeEnter('5');
      // Row 3: the gun scans a saved item's barcode into the name box → restock, cursor on qty.
      await page.keyboard.type(chaurasa.barcode, { delay: 3 });
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      const scanToQty = await focusedIs('data-entry-qty');
      await typeEnter('3');
      // Row 4: a loose item sold by kg.
      await typeEnter('E2E Kaju');
      await typeEnter('900');
      await page.locator('[data-entry-row]').nth(3).locator('[data-entry-unit]').selectOption('kg');
      await page.locator('[data-entry-row]').nth(3).locator('[data-entry-qty]').fill('2.5');
      await page.waitForTimeout(300);
      const summary = await page.locator('[data-entry-summary]').innerText();
      check(startsInName && thenPrice && nextRow && scanToQty && /2 new • 2 restocked • 29 labels/.test(summary),
        `New stock + labels: Enter walks name → MRP → qty → next row, a scanned saved code jumps to qty; summary "${summary.trim()}"`);
      await page.locator('[data-entry-save-print]').click();
      await page.locator('[data-print-notice]').waitFor({ timeout: 20000 });
      const rocket = await byName('E2E Rocket 10 Shot');
      const kaju = await byName('E2E Kaju');
      const anarNow = await byName(anarItem.name);
      const chaurasaNow = await byName(chaurasa.name);
      const general = (await readStore(page, 'categories')).find((c) => c.name === 'General');
      const rocketMoves = (await readStore(page, 'inventory_movements')).filter((m) => m.product_id === rocket?.id);
      check(rocket && rocket.selling_price === 12000 && rocket.mrp === 12000 && rocket.is_unlimited_stock === false && rocket.current_stock === 20 && validEan(rocket.barcode) && rocket.category_id === general?.id
        && rocketMoves.length === 1 && rocketMoves[0].movement_type === 'PURCHASE' && rocketMoves[0].quantity === 20,
        `A typed item is saved in the catalogue: ₹120, 20 counted, its own barcode ${rocket?.barcode}, "General", one PURCHASE movement`);
      check(anarNow.is_unlimited_stock === false && anarNow.current_stock === 5 && anarNow.selling_price === anarItem.selling_price && chaurasaNow.current_stock === 3 && chaurasaNow.is_unlimited_stock === false
        && kaju && kaju.unit === 'kg' && kaju.current_stock === 2.5 && (await readStore(page, 'products')).filter((p) => p.name === anarItem.name).length === 1,
        'Saved items typed or scanned are restocked (no copies), uncounted ones start counting; a kg item keeps 2.5');
      const lfJob = (await app.evaluate(() => globalThis.__lfJobs))[0];
      const lfHtml = lfJob ? fs.readFileSync(lfJob.file, 'utf8') : '';
      check(lfJob && lfJob.paper === 'label' && lfJob.pages === 29 && lfHtml.includes(rocket.barcode) && lfHtml.includes(chaurasa.barcode) && !(await page.evaluate(() => localStorage.getItem('kamai_stock_entry_draft'))),
        `"Save & print" sends 29 labels (20 + 5 + 3 + 1 for the kg lot) with the saved barcodes to the label printer; the draft is cleared (${lfJob ? lfJob.pages : 0} pages)`);

      // The label scans at the counter: the gun reads the new item into a bill.
      step = 'label scans into a bill';
      await page.locator('aside a[href="/billing"]').first().click();
      await page.waitForURL(/\/billing/, { waitUntil: 'commit', timeout: 10000 });
      await posSearch.waitFor({ timeout: 10000 });
      await posSearch.click();
      await gun(rocket.barcode);
      const rocketInCart = await cartQty(rocket.id);
      const s0 = await salesCount();
      await posSearch.click();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
      const rocketSold = (await readStore(page, 'sales')).find((s) => s.items.some((i) => i.product_id === rocket.id));
      check(rocketInCart === 1 && (await salesCount()) === s0 + 1 && rocketSold && (await byName('E2E Rocket 10 Shot')).current_stock === 19,
        'Its label scans at the counter: the gun adds the new item, the bill is saved and its stock goes 20 → 19');

      // Loose packs: 2 labels of 250 g Kaju; each scan adds 0.25 kg at the kg rate.
      step = 'loose packs';
      await page.evaluate(() => { window.location.href = '/barcode-generator/'; });
      await page.locator('[data-queue-loose]').click();
      await page.locator('[data-loose-search]').fill('E2E Kaju');
      await page.locator('[data-loose-item]').first().click();
      await page.locator('[data-loose-chip="250"]').click();
      await page.locator('[data-loose-chip="250"]').click();
      await page.locator('[data-loose-add]').click();
      await page.waitForTimeout(500);
      const seq5 = String(Number(kaju.barcode.slice(3, 12))).padStart(5, '0');
      const first12 = `29${seq5}00250`;
      const packCode = first12 + ((10 - ([...first12].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0) % 10)) % 10);
      const queueText = (await page.locator('[data-queue-list]').innerText()).replace(/\s+/g, ' ');
      const looseCount = await page.locator('[data-queue-count]').innerText();
      check(/E2E Kaju 250 g/.test(queueText) && queueText.includes(packCode) && /₹225\.00/.test(queueText) && /2 labels/i.test(looseCount),
        `Loose packs: "E2E Kaju 250 g" ×2 in the print list at ₹225 (₹900/kg × 0.25) with the pack code ${packCode} — list "${queueText.slice(0, 120)}", ${looseCount}`);
      await page.locator('aside a[href="/billing"]').first().click();
      await page.waitForURL(/\/billing/, { waitUntil: 'commit', timeout: 10000 });
      await posSearch.waitFor({ timeout: 10000 });
      await posSearch.click();
      await gun(packCode);
      await gun(packCode);
      const kajuLine = (await tabsNow()).flatMap((t) => t.cart).find((i) => i.product_id === kaju.id);
      check(kajuLine && kajuLine.quantity === 0.5 && kajuLine.total_amount === 45000 && !(await page.getByText(/Add Scanned Barcode/).count()),
        `Two 250 g pack scans add 0.5 kg of Kaju at ₹450 (qty ${kajuLine?.quantity}, ₹${(kajuLine?.total_amount || 0) / 100})`);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);

      // Manual Inward (Purchases switched on) → "Print 10 labels" → Studio with those labels.
      step = 'manual inward labels';
      await page.evaluate(() => {
        const cur = JSON.parse(localStorage.getItem('kamai_feature_switches') || '{}');
        localStorage.setItem('kamai_feature_switches', JSON.stringify({ ...cur, purchases: true }));
      });
      await page.evaluate(() => { window.location.href = '/purchases/'; });
      await page.getByRole('button', { name: /Manual Inward/ }).click();
      await page.locator('form select').first().selectOption(rocket.id);
      await page.getByPlaceholder('e.g. 50').fill('10');
      await page.getByRole('button', { name: /Save Stock Inward/ }).click();
      await page.locator('[data-inward-label-offer]').waitFor({ timeout: 10000 });
      const offerText = await page.locator('[data-inward-label-offer]').innerText();
      await page.locator('[data-inward-label-offer] button').first().click();
      await page.waitForURL(/barcode-generator/, { timeout: 15000 });
      await page.waitForFunction(() => /10 labels/i.test(document.querySelector('[data-queue-count]')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
      const inwardCount = await page.locator('[data-queue-count]').innerText();
      const rocketAfterInward = (await byName('E2E Rocket 10 Shot')).current_stock;
      check(/Print 10 labels/.test(offerText) && /1 items • 10 labels/i.test(inwardCount) && rocketAfterInward === 29,
        `Manual Inward of 10 → stock 19 → 29, "Print 10 labels" opens Barcode Studio with exactly those labels — offer "${offerText.replace(/\s+/g, ' ')}", ${inwardCount}, stock ${rocketAfterInward}`);

      // Supplier's Excel bill: title row, "Discount" column, a Total row; a new item without a
      // selling price is held back until one is typed; saved in one go; labels offered.
      step = 'excel bill inward';
      const billFile = path.join(dataDir, `bill_${Date.now()}.xlsx`);
      const billWb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(billWb, XLSX.utils.aoa_to_sheet([
        ['Balaji Traders — Bill 55'],
        ['Item', 'Qty', 'Rate', 'MRP', 'Discount', 'Amount'],
        ['E2E Rocket 10 Shot', 12, 80, '', 2, 960],
        ['E2E Neon Fountain Gold', 6, '₹50', 75, 5, 300],
        ['E2E Whistle Pipe', 4, 20, '', '', 80],
        ['Total', '', '', '', '', 1340],
      ]), 'Bill');
      XLSX.writeFile(billWb, billFile);
      await page.evaluate(() => { window.location.href = '/purchases/'; });
      await page.getByRole('button', { name: /Inward Bill \(Excel/ }).click();
      await page.locator('input[type="file"][accept*=".xlsx"]').setInputFiles(billFile);
      await page.locator('[data-inward-row]').first().waitFor({ timeout: 15000 });
      const rowsRead = await page.locator('[data-inward-row]').count();
      await page.getByRole('button', { name: /Confirm & Inward Stock/ }).click();
      await page.waitForTimeout(400);
      const problems = await page.locator('[data-inward-problem]').allInnerTexts();
      const billsBefore = (await readStore(page, 'purchase_bills')).length;
      await page.locator('[data-inward-row]').nth(2).locator('[data-inward-selling]').fill('30');
      await page.getByRole('button', { name: /Confirm & Inward Stock/ }).click();
      await page.locator('[data-inward-done]').waitFor({ timeout: 15000 });
      const fountain = await byName('E2E Neon Fountain Gold');
      const whistle = await byName('E2E Whistle Pipe');
      check(rowsRead === 3 && problems.length === 1 && /selling price/.test(problems[0]) && billsBefore === 0,
        `Excel bill: 3 item rows read (title, Total left out); a new item without a selling price is held back, nothing saved yet (${problems.join(' | ')})`);
      check((await byName('E2E Rocket 10 Shot')).current_stock === 41 && fountain && fountain.selling_price === 7500 && fountain.purchase_price === 5000 && fountain.current_stock === 6 && validEan(fountain.barcode)
        && whistle && whistle.selling_price === 3000 && (await readStore(page, 'purchase_bills')).length === 1,
        'Saved in one go: Rocket 29 → 41, Neon Fountain at its MRP ₹75 (cost ₹50, never "cost + 25 %"), Whistle Pipe at the typed ₹30, each with a barcode');
      await page.locator('[data-inward-print-labels]').click();
      await page.waitForURL(/barcode-generator/, { timeout: 15000 });
      await page.waitForFunction(() => /22 labels/i.test(document.querySelector('[data-queue-count]')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
      check(/3 items • 22 labels/i.test(await page.locator('[data-queue-count]').innerText()),
        'After the bill, "Print labels" opens Barcode Studio with 12 + 6 + 4 = 22 labels');
      expectedSales = await salesCount();

      // v4.78.0 — Fast barcode inward (Products): the gun scans a saved item twice and an
      // unknown code; name / price typed for the new one with no quantity; a scan that lands
      // in a name box still counts as a scan; saved in one go.
      step = 'fast barcode inward';
      await page.evaluate(() => { window.location.href = '/products/'; });
      await page.locator('[data-open-fast-inward]').click();
      await page.locator('[data-fast-scan]').waitFor({ timeout: 15000 });
      const gunFast = async (c) => { await page.keyboard.type(c, { delay: 3 }); await page.keyboard.press('Enter'); await page.waitForTimeout(700); };
      const rocketBefore = (await byName('E2E Rocket 10 Shot')).current_stock;
      await page.waitForTimeout(300);
      await gunFast(rocket.barcode);
      await gunFast(rocket.barcode);
      await gunFast('4006381333931');
      const scanFocused = await page.evaluate(() => document.activeElement?.hasAttribute('data-fast-scan'));
      const penRow = page.locator('[data-fast-row]').first();
      const penStatus = await penRow.locator('[data-fast-status]').innerText();
      await penRow.locator('[data-fast-name]').fill('E2E Imported Pen');
      await penRow.locator('[data-fast-price]').fill('45');
      await penRow.locator('[data-fast-qty]').fill('');
      // The gun fires while the cursor is in the pen's name box.
      await penRow.locator('[data-fast-name]').click();
      await page.keyboard.press('End');
      await gunFast(rocket.barcode);
      const topName = await page.locator('[data-fast-row]').first().locator('[data-fast-name]').inputValue();
      const topQty = await page.locator('[data-fast-row]').first().locator('[data-fast-qty]').inputValue();
      const fastSummary = await page.locator('[data-fast-summary]').innerText();
      check(scanFocused && /name \+ price needed/i.test(penStatus) && topName === 'E2E Rocket 10 Shot' && topQty === '3' && /1 new • 1 restocked • 3 labels/.test(fastSummary),
        `Fast inward: each scan adds a row with the cursor back in the scan box, the same code again adds 1 (×3, the last one fired into a name box), an unknown code asks for name + price — "${fastSummary.trim()}"`);
      // A code in the offline barcode list (fmcg-india.json — it did not load before v4.78.0).
      await page.locator('[data-fast-scan]').click();
      await gunFast('8901719101037');
      const parleRow = page.locator('[data-fast-row]').first();
      const parleName = await parleRow.locator('[data-fast-name]').inputValue();
      const parlePrice = await parleRow.locator('[data-fast-price]').inputValue();
      check(parleName === 'Parle-G Glucose Biscuit 80g' && parlePrice === '10',
        `A scanned packet in the offline barcode list fills its name and MRP ("${parleName}", ₹${parlePrice})`);
      await page.locator('[data-fast-save]').click();
      await page.locator('[data-fast-done]').waitFor({ timeout: 15000 });
      const pen = await byName('E2E Imported Pen');
      const rocketAfter = await byName('E2E Rocket 10 Shot');
      const fastMoves = (await readStore(page, 'inventory_movements')).filter((m) => m.product_id === rocket.id && /Fast barcode inward/.test(m.reason || ''));
      check(rocketAfter.current_stock === rocketBefore + 3 && fastMoves.length === 1 && fastMoves[0].quantity === 3
        && pen && pen.barcode === '4006381333931' && pen.selling_price === 4500 && pen.is_unlimited_stock === true && !(await page.evaluate(() => localStorage.getItem('kamai_fast_inward_draft'))),
        `Saved in one go: Rocket ${rocketBefore} → ${rocketAfter.current_stock} (one "Fast barcode inward" movement), the pen saved with its own maker's barcode, ₹45, not counted (no quantity typed)`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // v4.78.0 — F1 from any page opens Billing on a fresh bill; not while a form is open.
      step = 'f1 new bill';
      await page.getByRole('button', { name: /Add Product/ }).first().click();
      await page.locator('[role="dialog"]').first().waitFor({ timeout: 10000 });
      await page.keyboard.press('F1');
      await page.waitForTimeout(700);
      const stayedWithForm = /\/products/.test(page.url());
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      const busyTabsBefore = (await tabsNow()).filter((t) => t.cart.length > 0).length;
      await page.keyboard.press('F1');
      await page.waitForURL(/\/billing/, { timeout: 10000 });
      await posSearch.waitFor({ timeout: 10000 });
      await page.waitForTimeout(600);
      const freshCart = await page.getByText(/cart items \(0\)/i).first().isVisible().catch(() => false);
      const busyTabsAfter = (await tabsNow()).filter((t) => t.cart.length > 0).length;
      check(stayedWithForm && freshCart && busyTabsAfter === busyTabsBefore && !/new=1/.test(page.url()),
        `F1 opens Billing on a fresh bill from Products (bills with items kept: ${busyTabsAfter}); with the Add Product form open it does nothing${stayedWithForm && freshCart ? '' : ` [form kept: ${stayedWithForm}, empty cart: ${freshCart}]`}`);

      // v4.78.0 — Backup & restore: a backup file of the shop, then changes after it; "Add missing
      // records only" keeps those changes (nothing overwritten); "Clean Replace" brings the backup
      // back exactly, after saving the current data as today's automatic backup; a damaged file is refused.
      step = 'backup restore';
      const TABLES = ['businesses', 'categories', 'products', 'customers', 'suppliers', 'sales', 'cash_registers', 'cash_expenses', 'sales_returns', 'inventory_movements', 'ledger_transactions', 'purchase_bills', 'marketing_templates', 'audit_logs'];
      const snap = { metadata: { version: '2.1.0', created_at: new Date().toISOString(), business_name: 'E2E Kirana Store', counts: {} } };
      for (const t of TABLES) snap[t] = await readStore(page, t);
      const backupFile = path.join(dataDir, 'e2e_backup.json');
      fs.writeFileSync(backupFile, JSON.stringify(snap));
      const rocketAtBackup = (await byName('E2E Rocket 10 Shot')).current_stock;
      const rocketId = (await byName('E2E Rocket 10 Shot')).id;
      await page.evaluate((pid) => new Promise((resolve, reject) => {
        const req = indexedDB.open('VyaparSetuDB');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const d = req.result;
          const tx = d.transaction(['customers', 'products'], 'readwrite');
          tx.objectStore('customers').put({ id: 'cust_after_backup', business_id: 'x', name: 'E2E After Backup', phone: '9000000001', current_balance: 0, opening_balance: 0, loyalty_points: 0, total_spent: 0, total_visits: 0, customer_type: 'regular', created_at: new Date().toISOString() });
          const ps = tx.objectStore('products');
          ps.get(pid).onsuccess = (e) => { const p = e.target.result; p.current_stock = 999; ps.put(p); };
          tx.oncomplete = () => { d.close(); resolve(true); };
          tx.onerror = () => reject(tx.error);
        };
      }), rocketId);
      const restoreWith = async (mode) => {
        await page.evaluate(() => { window.location.href = '/cloud-backup/'; });
        await page.locator('[data-restore-file]').waitFor({ state: 'attached', timeout: 15000 });
        await page.locator('[data-restore-file]').setInputFiles(backupFile);
        await page.locator('[data-restore-modal]').waitFor({ timeout: 10000 });
        const counts = await page.locator('[data-restore-counts]').innerText();
        await page.locator(`[data-restore-mode="${mode}"]`).check();
        await page.locator('[data-restore-confirm]').click();
        await page.locator('[data-restore-done]').waitFor({ timeout: 20000 });
        const done = await page.locator('[data-restore-done]').innerText();
        await page.waitForTimeout(3500); // the app reloads itself
        await page.locator('[data-restore-file]').waitFor({ state: 'attached', timeout: 20000 });
        return { counts, done };
      };
      const merged = await restoreWith('merge');
      const custMerge = await readStore(page, 'customers');
      check(custMerge.some((c) => c.name === 'E2E After Backup') && (await byName('E2E Rocket 10 Shot')).current_stock === 999 && /Nothing already here was changed/.test(merged.done) && new RegExp(`Products: ${snap.products.length}`).test(merged.counts),
        `Restore "add missing records only": the customer added after the backup and Rocket's new stock stay (nothing overwritten) — "${merged.done.slice(0, 90)}"`);
      const cleaned = await restoreWith('clean');
      const custClean = await readStore(page, 'customers');
      const backupsDir = path.join(dataDir, 'documents', 'KamaiPlus', 'Backups');
      const safety = fs.existsSync(backupsDir) ? fs.readdirSync(backupsDir).filter((f) => f.startsWith('KamaiPlus_AutoBackup_')) : [];
      const safetyHasAfter = safety.some((f) => fs.readFileSync(path.join(backupsDir, f), 'utf8').includes('E2E After Backup'));
      check(!custClean.some((c) => c.name === 'E2E After Backup') && (await byName('E2E Rocket 10 Shot')).current_stock === rocketAtBackup && (await salesCount()) === expectedSales && safetyHasAfter && /Restored/.test(cleaned.done),
        `Restore "clean replace": the shop is exactly the backup again (Rocket ${rocketAtBackup}), and today's automatic backup kept the data from just before (${safety.length} file)`);
      const badFile = path.join(dataDir, 'e2e_bad_backup.json');
      fs.writeFileSync(badFile, JSON.stringify({ ...snap, products: [...snap.products, { name: 'no id' }] }));
      await page.locator('[data-restore-file]').setInputFiles(badFile);
      const alertBox = page.locator('[role="dialog"]').last();
      await alertBox.waitFor({ timeout: 10000 });
      const alertText = await alertBox.innerText();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);
      check(/damaged/i.test(alertText) && !(await page.locator('[data-restore-modal]').count()) && (await readStore(page, 'products')).length === snap.products.length,
        'A damaged backup file is refused before anything is touched');

      // v4.78.0 — the Transactions pull-tab: dragged up it stays up (saved), a click still opens it.
      step = 'drawer drag';
      await page.evaluate(() => { window.location.href = '/customers/'; });
      const pullTab = page.locator('[data-transactions-tab]');
      await pullTab.waitFor({ timeout: 15000 });
      await page.waitForTimeout(500);
      const boxBefore = await pullTab.boundingBox();
      await page.mouse.move(boxBefore.x + boxBefore.width / 2, boxBefore.y + boxBefore.height / 2);
      await page.mouse.down();
      await page.mouse.move(boxBefore.x + boxBefore.width / 2, boxBefore.y + boxBefore.height / 2 - 60, { steps: 5 });
      await page.mouse.move(boxBefore.x + boxBefore.width / 2, boxBefore.y + boxBefore.height / 2 - 180, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(400);
      const boxAfter = await pullTab.boundingBox();
      const savedY = Number(await page.evaluate(() => localStorage.getItem('kamai_drawer_tab_y')));
      // The drawer is always in the page, slid off to the right when closed: "open" = on screen.
      const drawerOnScreen = () => page.evaluate(() => {
        const b = document.querySelector('[data-drawer-close]');
        return Boolean(b) && b.getBoundingClientRect().left < window.innerWidth - 10;
      });
      const drawerOpenAfterDrag = await drawerOnScreen();
      await pullTab.click();
      // K-D24: the drawer slides in (300 ms) — wait for it instead of looking once after a fixed pause.
      const drawerOpened = await page.waitForFunction(() => {
        const b = document.querySelector('[data-drawer-close]');
        return Boolean(b) && b.getBoundingClientRect().left < window.innerWidth - 10;
      }, null, { timeout: 3000 }).then(() => true, () => false);
      const drawerWhy = drawerOpened ? '' : await page.evaluate(() => `overlay: ${document.querySelectorAll('.fixed.inset-0.z-\\[100\\]').length}, path: ${location.pathname}, tab: ${JSON.stringify(document.querySelector('[data-transactions-tab]')?.getBoundingClientRect())}`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      check(boxAfter.y < boxBefore.y - 150 && savedY > 0 && savedY < 0.5 && !drawerOpenAfterDrag && drawerOpened,
        `Transactions tab dragged up ${Math.round(boxBefore.y - boxAfter.y)} px and remembered (${savedY}); the drag did not open it, a click does${!drawerOpenAfterDrag && drawerOpened ? '' : ` [open after drag: ${drawerOpenAfterDrag}, open after click: ${drawerOpened}; ${drawerWhy}]`}`);

      // v4.78.0 — Home fills itself: Purchases off → Fast barcode inward tile (opens on Home), GST off →
      // Backup & CA exports, every row of tiles full; Printer setup opens the bill + label printer.
      step = 'home tiles';
      const setPurchases = (on) => page.evaluate((v) => {
        const cur = JSON.parse(localStorage.getItem('kamai_feature_switches') || '{}');
        localStorage.setItem('kamai_feature_switches', JSON.stringify({ ...cur, purchases: v }));
      }, on);
      await setPurchases(false);
      await page.evaluate(() => { window.location.href = '/'; });
      await page.locator('[data-home-action="printers"]').waitFor({ timeout: 15000 });
      await page.waitForTimeout(500);
      const homeIds = await page.locator('[data-home-action]').evaluateAll((els) => els.map((e) => e.getAttribute('data-home-action')).join(','));
      const gstStandIn = await page.locator('[data-home-tool="/settings?tab=data"]').isVisible().catch(() => false);
      // Every row of every tile group reaches the right edge: no empty slot anywhere.
      const rowsFull = await page.evaluate(() => {
        const groups = [document.querySelector('[data-home-action]')?.parentElement, ...Array.from(document.querySelectorAll('[data-home-tool]')).map((t) => t.parentElement)];
        return Array.from(new Set(groups.filter(Boolean))).every((g) => {
          const right = g.getBoundingClientRect().right;
          const rows = new Map();
          for (const c of Array.from(g.children)) {
            const r = c.getBoundingClientRect();
            const key = Math.round(r.top);
            rows.set(key, Math.max(rows.get(key) || 0, r.right));
          }
          return Array.from(rows.values()).every((edge) => Math.abs(edge - right) < 2);
        });
      });
      await page.locator('[data-home-action="fast_inward"]').click();
      const fastOnHome = await page.locator('[data-fast-scan]').waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      check(homeIds === 'new_bill,khata,fast_inward,day_summary,printers' && gstStandIn && rowsFull && fastOnHome && /\/$/.test(new URL(page.url()).pathname),
        `Home with Purchases / GST off: tiles "${homeIds}", Backup & CA exports in GST's place, every row full; Fast barcode inward opens right on Home`);
      await page.locator('[data-home-action="printers"]').click();
      await page.locator('[data-bill-printer]').waitFor({ timeout: 10000 });
      const printersTitle = await page.locator('[role="dialog"]').first().innerText();
      await page.locator('[data-home-label-printer]').click();
      const labelPanel = await page.locator('[data-label-printer]').first().isVisible().catch(() => false);
      await page.locator('[data-bill-autoprint]').check();
      const silentOn = await page.evaluate(() => localStorage.getItem('kamai_silent_print'));
      await page.locator('[data-bill-autoprint]').uncheck();
      const silentOff = await page.evaluate(() => localStorage.getItem('kamai_silent_print'));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      check(/Printers/.test(printersTitle) && labelPanel && silentOn === 'true' && silentOff === 'false',
        'Printer setup from Home: bill printer, the label printer one click down, and "print straight away" is the counter\'s own switch');
      // v4.78.0 — printer auto-detect: Windows' printers (driver, port, offline) reach the app, seen
      // printers are remembered, PDF "printers" are never picked, and the status bar opens Printers.
      const winPrinters = await page.evaluate(() => window.kamaiDesktop.getPrinterStatus());
      await page.waitForTimeout(1500);
      const knownPrinters = await page.evaluate(() => JSON.parse(localStorage.getItem('kamai_known_printers') || 'null'));
      const printSettingsNow = await page.evaluate(() => JSON.parse(localStorage.getItem('kamai_print_settings') || '{}'));
      const onlyVirtual = Array.isArray(winPrinters) && winPrinters.every((p) => /pdf|xps|onenote|fax/i.test(`${p.name} ${p.driver} ${p.port}`));
      const statusTone = await page.locator('[data-status-printer]').getAttribute('data-status-printer').catch(() => null);
      await page.locator('[data-status-printer]').click();
      const printersFromBar = await page.locator('[data-bill-printer]').waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      check(Array.isArray(winPrinters) && winPrinters.every((p) => typeof p.name === 'string' && typeof p.offline === 'boolean' && typeof p.port === 'string')
        && Array.isArray(knownPrinters) && winPrinters.every((p) => knownPrinters.includes(p.name))
        && (!onlyVirtual || ((printSettingsNow.thermalPrinter || '') === (savedPs.thermalPrinter || '') && !printSettingsNow.a4Printer)) && Boolean(statusTone) && printersFromBar,
        `Printer auto-detect: Windows printers read (${(winPrinters || []).map((p) => `${p.name}${p.offline ? ' [offline]' : ''}`).join(', ')}), remembered, the printer chosen earlier is never switched; status bar "${statusTone}" opens Printers`);
      await setPurchases(true);

      // v4.79.0 — WhatsApp everywhere: kp:open-whatsapp is caught in the main process (nothing opens).
      // A bill from Transactions: number typed, Hindi chosen, sent as 91… with the bill text;
      // Esc on the WhatsApp window over a bill closes only the WhatsApp window; a khata reminder.
      step = 'whatsapp';
      await app.evaluate(({ ipcMain }) => {
        globalThis.__waJobs = [];
        ipcMain.removeHandler('kp:open-whatsapp');
        ipcMain.handle('kp:open-whatsapp', async (_e, req) => {
          globalThis.__waJobs.push(req);
          return { ok: true, via: 'web', copied: false };
        });
      });
      const waJobs = () => app.evaluate(() => globalThis.__waJobs);
      await page.evaluate(() => { window.location.href = '/transactions/'; });
      await page.locator('[data-whatsapp="bill"]').first().waitFor({ timeout: 15000 });
      await page.locator('[data-whatsapp="bill"]').first().click();
      const composer = page.locator('[data-whatsapp-composer]');
      await composer.waitFor({ timeout: 10000 });
      await page.locator('[data-wa-text]').waitFor({ timeout: 10000 });
      await page.locator('[data-wa-phone]').fill('98220 12345');
      await page.locator('[data-wa-chip="hi"]').click();
      await page.waitForTimeout(300);
      const hindiText = await page.locator('[data-wa-text]').inputValue();
      await page.locator('[data-wa-chip="en"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-wa-send]').click();
      await page.locator('[data-wa-result]').waitFor({ timeout: 10000 });
      const waBillJob = (await waJobs())[0] || {};
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      check(waBillJob.phone === '919822012345' && /\*(INVOICE|ESTIMATE) #/.test(waBillJob.text || '') && /💰 \*Total: ₹/.test(waBillJob.text || '') && /बिल #|एस्टिमेट #/.test(hindiText) && !(await composer.isVisible().catch(() => false)),
        `Transactions → WhatsApp: the bill goes to 91 98220 12345 with its items and total (Hindi on one click): "${(waBillJob.text || '').split('\n')[0]}"`);

      // Over an open bill: Esc closes the WhatsApp window, the bill stays.
      await page.locator('[data-whatsapp="bill"]').first().evaluate((el) => el.parentElement?.closest('.group')?.click());
      await page.locator('[role="dialog"]').first().waitFor({ timeout: 10000 });
      await page.locator('[role="dialog"] [data-whatsapp="bill"]').first().click();
      await composer.waitFor({ timeout: 10000 });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      const waBillStillOpen = await page.locator('[role="dialog"]').first().isVisible().catch(() => false);
      const waComposerGone = !(await composer.isVisible().catch(() => false));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      check(waBillStillOpen && waComposerGone, 'Esc on the WhatsApp window over a bill closes only the WhatsApp window');

      // Khata: the customer's reminder / message opens with their name.
      await page.evaluate(() => { window.location.href = '/khata/'; });
      await page.waitForTimeout(1500);
      await page.locator('[data-khata-customer]').first().click();
      const khataWa = page.locator('[data-whatsapp="khata"]:visible').first();
      await khataWa.waitFor({ timeout: 10000 });
      await khataWa.click();
      await composer.waitFor({ timeout: 10000 });
      await page.locator('[data-wa-text]').waitFor({ timeout: 10000 });
      const khataText = await page.locator('[data-wa-text]').inputValue();
      const khataName = await page.locator('[data-whatsapp-composer] label span').first().innerText();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      check(/^Dear .+,|^नमस्ते .+ जी,|^नमस्कार .+,/.test(khataText) && /To/.test(khataName),
        `Khata → WhatsApp: the customer's message opens ready ("${khataText.split('\n')[0]}")`);

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
