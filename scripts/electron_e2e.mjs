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
        await page.locator('aside a[href="/products"]').first().click();
        await page.waitForURL(/\/products/, { waitUntil: 'commit', timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(800);
        await page.locator('header button[title="Click for Store Menu, Language & Settings"]').click();
        await page.getByRole('button', { name: /Lock now/ }).click();
        const relocked = await pw.waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false);
        check(relocked && !(await page.locator('aside').count()), '"Lock now" hides the shop behind the master password');
        if (relocked) {
          await pw.fill(PASSWORD);
          await pw.press('Enter');
          await page.waitForURL(/\/products/, { waitUntil: 'commit', timeout: 10000 }).catch(() => {});
          await page.waitForTimeout(800);
          check(new URL(page.url()).pathname.replace(/\/$/, '') === '/products' && (await page.locator('aside').count()) > 0, 'After the password the app returns to the page that was open (Products)');
        }
      }
      const sales = await readStore(page, 'sales');
      const product = (await readStore(page, 'products')).find((p) => p.id === productId);
      check(sales.length === 1 && product && Number(product.current_stock) === stockBefore - 1, 'The bill and the new stock are still there after closing and reopening the app');
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
