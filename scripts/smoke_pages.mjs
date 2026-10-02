// npm run test:smoke — opens EVERY screen of the built desktop app (Electron, real `out/`)
// the way a new customer gets it: licence → master password WITHOUT Google → store setup.
// Then every route and Settings tab, first as a new shop (switched-off screens say so),
// then with every feature switch on. Fails on a page error, a console error, a crash screen
// or a blank page. Screenshots: <tmp>/kamaiplus-smoke-shots. Needs `npm run build` first.
import { _electron as electron } from 'playwright-core';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const APP_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronPath = require('electron');
const licence = require(path.join(APP_DIR, 'licence.js'));
const PRIVATE_KEY = process.env.KAMAI_LICENCE_PRIVATE_KEY || path.join(os.homedir(), 'KamaiPlus-Secrets', 'desktop_licence_private.pem');
const SHOTS = path.join(os.tmpdir(), 'kamaiplus-smoke-shots');
const PASSWORD = 'smoke-Pass#1357';

const ROUTES = ['/', '/billing/', '/products/', '/inventory/', '/barcode-generator/', '/transactions/', '/customers/', '/khata/',
  '/suppliers/', '/purchases/', '/cash-register/', '/reports/', '/gst-reports/', '/invoice-designer/', '/cloud-backup/',
  '/settings/?tab=profile', '/settings/?tab=features', '/settings/?tab=invoicing', '/settings/?tab=data', '/settings/?tab=help',
  '/barcode-generator/?new=1', '/billing/?x=1'];
const CRASH_TEXT = /Something went wrong|Application error|Unhandled Runtime Error|client-side exception|ChunkLoadError|is not a function|Cannot read properties/i;
// Console noise that is not an app fault (offline Firebase, dev warnings of libraries).
const IGNORE_CONSOLE = /Download the React DevTools|net::ERR_INTERNET_DISCONNECTED|favicon|Failed to load resource: net::ERR_FILE_NOT_FOUND.*\.map/i;

let passed = 0;
let failed = 0;
const problems = [];
function check(ok, label) {
  if (ok) { passed++; console.log(`  ✅ [PASS] ${label}`); }
  else { failed++; problems.push(label); console.log(`  ❌ [FAIL] ${label}`); }
}

if (!fs.existsSync(path.join(APP_DIR, 'out', 'index.html'))) {
  console.log('out/ is missing — run `npm run build` first.');
  process.exit(1);
}
if (!fs.existsSync(PRIVATE_KEY)) {
  console.log(`Licence private key not found (${PRIVATE_KEY}).`);
  process.exit(1);
}

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kp-smoke-'));
{
  const pem = fs.readFileSync(PRIVATE_KEY, 'utf8');
  const payload = { v: 1, key: 'KPD-SMOK-ETES-T000-0001', machine_id: licence.getMachineId(), shop_name: 'Smoke Shop', issued_at: new Date().toISOString() };
  const bytes = Buffer.from(JSON.stringify(payload), 'utf8');
  const signature = crypto.sign(null, bytes, crypto.createPrivateKey(pem));
  fs.mkdirSync(path.join(dataDir, 'userData'), { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'userData', 'licence.json'), JSON.stringify({ licence: bytes.toString('base64url'), signature: signature.toString('base64url') }));
}
fs.mkdirSync(SHOTS, { recursive: true });

const env = { ...process.env, KAMAI_E2E_DIR: dataDir };
delete env.ELECTRON_RUN_AS_NODE;
console.log('================================================================');
console.log('🔎 KamaiPlus Desktop — every screen smoke test');
console.log('================================================================');
const app = await electron.launch({ executablePath: electronPath, args: [APP_DIR], cwd: APP_DIR, env, timeout: 60000 });
const page = await app.firstWindow();
const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', (err) => pageErrors.push(err.message));
page.on('console', (m) => { if (m.type() === 'error' && !IGNORE_CONSOLE.test(m.text())) consoleErrors.push(m.text().slice(0, 300)); });

const textVisible = (t, timeout = 20000) => page.getByText(t, { exact: false }).first().waitFor({ state: 'visible', timeout }).then(() => true, () => false);

try {
  // ── First run, the customer's way: password only, no Google ──
  check(await textVisible('Set Master Password'), 'Licensed first run shows the master password setup');
  await page.getByPlaceholder('Enter new password').fill(PASSWORD);
  await page.getByPlaceholder('Re-enter password').fill(PASSWORD);
  await page.getByRole('button', { name: /Set Password & Start/i }).click();
  check(await textVisible('Setup Your Store Profile'), 'Without Google, the password alone opens store setup');
  await page.getByPlaceholder('e.g. Sharma Kirana & General Store').fill('Smoke Test Kirana');
  await page.getByPlaceholder('e.g. Ramesh Sharma').fill('Smoke Owner');
  await page.getByPlaceholder('98765 43210').fill('9876543210');
  // v4.91.0 — UPI is optional at sign-up: this shop does not take UPI and leaves it blank.
  await page.getByPlaceholder('e.g. 9876543210@paytm or store@okaxis').fill('');
  const seed = page.locator('input[type="checkbox"]').first();
  if (!(await seed.isChecked())) await seed.check();
  await page.getByRole('button', { name: /Complete Setup/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/onboarding'), { timeout: 30000 });
  check(true, 'Store setup completes (UPI ID left blank — it is optional)');
  await page.waitForTimeout(2000);

  const visitAll = async (label) => {
    for (const route of ROUTES) {
      const before = { p: pageErrors.length, c: consoleErrors.length };
      await page.evaluate((r) => { window.location.href = r; }, route);
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(2200);
      const body = (await page.locator('body').innerText().catch(() => '')) || '';
      const crashed = CRASH_TEXT.test(body);
      const blank = body.trim().length < 40;
      const newPage = pageErrors.slice(before.p);
      const newConsole = consoleErrors.slice(before.c);
      const name = `${label}-${route.replace(/[^a-z0-9]+/gi, '_')}`;
      await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }).catch(() => {});
      check(!crashed && !blank && newPage.length === 0 && newConsole.length === 0,
        `${label} ${route}${crashed ? ' — CRASH SCREEN' : ''}${blank ? ' — BLANK' : ''}${newPage.length ? ` — page error: ${newPage.join(' | ').slice(0, 200)}` : ''}${newConsole.length ? ` — console: ${newConsole.join(' | ').slice(0, 200)}` : ''}`);
    }
  };

  await visitAll('new-shop');

  // Every feature switch on: every screen and every optional field shows.
  await page.evaluate(() => {
    const all = ['khata', 'customers', 'inventory', 'barcode_studio', 'cash_register', 'purchases', 'suppliers', 'gst_reports', 'sales_reports', 'invoice_designer',
      'product_selling_price', 'product_cost_price', 'product_hsn', 'product_gst_rate', 'product_size_colour', 'product_variants', 'payment_keys', 'whatsapp', 'wholesale_price'];
    localStorage.setItem('kamai_feature_switches', JSON.stringify(Object.fromEntries(all.map((k) => [k, true]))));
  });
  await visitAll('all-on');

  // v4.91.0 — Invoice Themes: the 58 mm preview follows the switches live, the shop without a
  // UPI ID is told so, Pharmacy Rx & D.L. is gone; Settings has the second contact number.
  await page.evaluate(() => { window.location.href = '/invoice-designer/'; });
  await page.getByRole('button', { name: '58mm', exact: true }).click({ timeout: 20000 });
  const slip = page.locator('[data-thermal-receipt="58"]');
  await slip.waitFor({ timeout: 10000 });
  const termsBefore = await slip.locator('[data-thermal-terms]').count();
  await page.getByRole('button', { name: /Show Terms & Conditions/ }).click();
  await page.waitForTimeout(500);
  const termsAfter = await slip.locator('[data-thermal-terms]').count();
  const designerText = await page.locator('main').innerText();
  const upiMissing = await page.locator('[data-designer-upi-missing]').isVisible().catch(() => false);
  const noUpiOnSlip = (await slip.locator('[data-thermal-upi]').count()) === 0;
  await page.screenshot({ path: path.join(SHOTS, 'designer-58mm.png') }).catch(() => {});
  check(termsBefore === 1 && termsAfter === 0 && upiMissing && noUpiOnSlip && !/Pharmacy Rx/.test(designerText) && (await page.locator('[data-designer-thermal-note]').isVisible()),
    `Invoice Themes 58 mm preview changes live (terms ${termsBefore} → ${termsAfter}), no UPI ID = no QR + a hint (${upiMissing}), Pharmacy Rx gone`);
  await page.evaluate(() => { window.location.href = '/settings/'; });
  const phone2 = page.locator('[data-settings-phone2]');
  check(await phone2.isVisible({ timeout: 15000 }).catch(() => false) || await phone2.waitFor({ timeout: 15000 }).then(() => true, () => false),
    'Settings → Contact & Store Location has the second contact number');

  // A sale through the counter, then the screens that read sales.
  await page.evaluate(() => { window.location.href = '/billing/'; });
  await page.waitForTimeout(2500);
  const search = page.getByPlaceholder(/search/i).first();
  await search.click();
  await search.fill('a');
  await page.waitForTimeout(800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  await page.keyboard.press('Escape');
  await page.locator('main').first().click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.keyboard.press('F10');
  await page.waitForTimeout(2500);
  await page.keyboard.press('Escape');
  for (const r of ['/', '/transactions/', '/reports/', '/gst-reports/', '/cash-register/']) {
    const before = pageErrors.length + consoleErrors.length;
    await page.evaluate((x) => { window.location.href = x; }, r);
    await page.waitForTimeout(2200);
    const body = (await page.locator('body').innerText().catch(() => '')) || '';
    await page.screenshot({ path: path.join(SHOTS, `after-sale-${r.replace(/[^a-z0-9]+/gi, '_')}.png`) }).catch(() => {});
    check(!CRASH_TEXT.test(body) && pageErrors.length + consoleErrors.length === before, `after a sale ${r}`);
  }
} catch (err) {
  check(false, `Smoke run crashed: ${err.message}`);
  await page.screenshot({ path: path.join(SHOTS, 'crash.png') }).catch(() => {});
} finally {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
}

console.log('================================================================');
console.log(`📊 SMOKE: ${passed}/${passed + failed} PASSED (${failed} failures)  screenshots: ${SHOTS}`);
console.log('================================================================');
process.exit(failed ? 1 : 0);
