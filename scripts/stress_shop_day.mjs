// node scripts/stress_shop_day.mjs — a real shop day on the built app (out/), v4.128.0+.
//
// A GST-registered kirana is set up through store setup, 1,200 items come in through the Excel
// import (stock, GST, HSN, barcodes), then the counter is driven like a cashier: barcode scans,
// cash / UPI / udhar bills, discounts, estimates, returns and khata payments — a few hundred bills.
// Every number is then checked against the database: bill totals vs Reports / Day Summary / Home,
// stock vs what was sold, udhar vs the khata, invoice numbers, GST. The app is restarted at the end
// and must open with every record. Timings (scan → line, Complete Sale, page loads) are printed.
//
// Needs `npm run build` and the licence signing key (like the Electron E2E). Data goes to a temp
// folder. BILLS=300 by default (env BILLS=…).
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
const XLSX = require('xlsx');
const PRIVATE_KEY = process.env.KAMAI_LICENCE_PRIVATE_KEY || path.join(os.homedir(), 'KamaiPlus-Secrets', 'desktop_licence_private.pem');
const BILLS = Number(process.env.BILLS || 300);
const ITEMS = Number(process.env.ITEMS || 1200);
const PASSWORD = 'Stress#2468';
const SHOTS = path.join(os.tmpdir(), 'kamaiplus-stress-shots');
fs.mkdirSync(SHOTS, { recursive: true });

let passed = 0, failed = 0;
const problems = [];
const check = (ok, label) => { if (ok) { passed++; console.log(`  ✅ [PASS] ${label}`); } else { failed++; problems.push(label); console.log(`  ❌ [FAIL] ${label}`); } };
const timings = {};
const time = (k, ms) => { (timings[k] ||= []).push(ms); };
const stats = (a) => { const s = [...a].sort((x, y) => x - y); return { n: s.length, median: s[Math.floor(s.length / 2)], p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1] }; };

// Deterministic randomness, so a failure can be replayed.
let seed = 20261010;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];

function ean13(n) {
  const body = `890${String(n).padStart(9, '0')}`;
  const sum = [...body].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0);
  return body + ((10 - (sum % 10)) % 10);
}

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kp-stress-'));
{
  const pem = fs.readFileSync(PRIVATE_KEY, 'utf8');
  const payload = { v: 1, key: 'KPD-STRS-TEST-0000-0001', machine_id: licence.getMachineId(), shop_name: 'Stress Kirana', issued_at: new Date().toISOString() };
  const bytes = Buffer.from(JSON.stringify(payload), 'utf8');
  fs.mkdirSync(path.join(dataDir, 'userData'), { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'userData', 'licence.json'), JSON.stringify({ licence: bytes.toString('base64url'), signature: crypto.sign(null, bytes, crypto.createPrivateKey(pem)).toString('base64url') }));
  fs.writeFileSync(path.join(dataDir, 'userData', 'admin_control.json'), JSON.stringify({ mode: 'normal' }));
}

// 1,200 items over 12 sections: price, MRP, stock, GST, HSN, a real EAN-13.
const SECTIONS = ['Atta & Rice', 'Dal & Pulses', 'Oil & Ghee', 'Spices', 'Biscuits', 'Snacks', 'Beverages', 'Dairy', 'Soaps', 'Detergents', 'Personal Care', 'Household'];
const rows = [];
for (let i = 1; i <= ITEMS; i++) {
  const sec = SECTIONS[i % SECTIONS.length];
  const price = Math.round((10 + rnd() * 490) * 2) / 2;
  const mrp = Math.round(price * (1 + rnd() * 0.2));
  const gst = pick([0, 5, 5, 18]);
  rows.push([sec, `${sec.split(' ')[0]} Item ${String(i).padStart(4, '0')}`, pick(['Tata', 'Amul', 'Patanjali', 'HUL', 'ITC', 'Local']), price, mrp, 'Piece', Math.floor(20 + rnd() * 180), gst, gst ? '2106' : '1006', ean13(i)]);
}
const sheet = path.join(dataDir, 'pricelist.xlsx');
{
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Section', 'Item', 'Company', 'Price', 'MRP', 'Per', 'Stock', 'GST', 'HSN', 'Barcode'], ...rows]), 'Items');
  XLSX.writeFile(wb, sheet);
}

const env = { ...process.env, KAMAI_E2E_DIR: dataDir };
delete env.ELECTRON_RUN_AS_NODE;

async function launch() {
  const app = await electron.launch({ executablePath: electronPath, args: [APP_DIR], cwd: APP_DIR, env, timeout: 180000 });
  const page = await app.firstWindow();
  await page.setViewportSize({ width: 1366, height: 768 }).catch(() => {});
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_INTERNET_DISCONNECTED|favicon|Firestore|firebase|Missing or insufficient permissions/i.test(m.text())) errors.push(m.text().slice(0, 300)); });
  page.on('dialog', (d) => d.accept().catch(() => {}));
  return { app, page, errors };
}
const readStore = (page, name) => page.evaluate((n) => new Promise((resolve, reject) => {
  const r = indexedDB.open('VyaparSetuDB');
  r.onerror = () => reject(r.error);
  r.onsuccess = () => { const db = r.result; if (!db.objectStoreNames.contains(n)) { db.close(); resolve([]); return; } const q = db.transaction(n, 'readonly').objectStore(n).getAll(); q.onsuccess = () => { db.close(); resolve(q.result); }; q.onerror = () => { db.close(); reject(q.error); }; };
}), name);
const go = async (page, route) => { await page.evaluate((r) => { window.location.href = r; }, route); await page.waitForTimeout(1800); };
const text = async (page, sel = 'main') => (await page.locator(sel).first().innerText().catch(() => '')) || '';
const rupees = (s) => Math.round(Number(String(s).replace(/[^\d.]/g, '')) * 100);

console.log('================================================================');
console.log(`🏪 Shop day stress test — ${ITEMS} items, ${BILLS} bills  (data: ${dataDir})`);
console.log('================================================================');

let { app, page, errors } = await launch();
const expected = { products: new Map() };
try {
  // ── Setup: password → GST-registered kirana with a GSTIN ──
  await page.getByPlaceholder('Enter new password').fill(PASSWORD, { timeout: 120000 });
  await page.getByPlaceholder('Re-enter password').fill(PASSWORD);
  await page.getByRole('button', { name: /Set Password & Start/i }).click();
  await page.waitForURL((u) => u.pathname.startsWith('/onboarding'), { timeout: 60000 });
  await page.getByPlaceholder('e.g. Sharma Kirana & General Store').fill('Stress Kirana Bhandar');
  await page.getByRole('button', { name: /Grocery \/ Kirana/ }).click();
  await page.getByPlaceholder('e.g. Ramesh Sharma').fill('Ramesh Gupta');
  await page.getByPlaceholder('98765 43210').fill('9876512345');
  await page.locator('[data-onboarding-gstin]').fill('27AAPFU0939F1ZV');
  await page.getByRole('button', { name: /Complete Setup/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/onboarding'), { timeout: 60000 });
  await page.waitForTimeout(2000);
  const profile = await page.evaluate(() => localStorage.getItem('kamai_vertical_profile'));
  const biz = (await readStore(page, 'businesses'))[0];
  check(/"vertical":"grocery"/.test(profile || '') && /"gst":true/.test(profile || '') && biz?.gstin === '27AAPFU0939F1ZV',
    `Store setup: kirana with GSTIN → profile ${profile}, GSTIN saved`);

  // ── 1,200 items through the Excel import ──
  let t0 = Date.now();
  await go(page, '/products/');
  await page.getByRole('button', { name: /Import Excel/ }).first().click();
  await page.locator('input[data-import-file]').setInputFiles(sheet);
  await page.getByRole('button', { name: /Next: check changes/ }).click({ timeout: 60000 });
  await page.getByRole('button', { name: /^Import:/ }).click({ timeout: 60000 });
  await page.locator('[data-import-done]').waitFor({ timeout: 300000 });
  time('import 1200 items (ms)', Date.now() - t0);
  await page.getByRole('button', { name: /Done & View Catalog/ }).click().catch(() => {});
  const prods = (await readStore(page, 'products')).filter((p) => p.barcode && p.barcode.startsWith('890'));
  for (const p of prods) expected.products.set(p.id, { stock: Number(p.current_stock), sold: 0, unlimited: p.is_unlimited_stock });
  const sample = prods.find((p) => p.barcode === ean13(7));
  check(prods.length === ITEMS && sample && sample.selling_price === Math.round(rows[6][3] * 100) && sample.tax_rate === rows[6][7] && sample.current_stock === rows[6][6] && !sample.is_unlimited_stock,
    `Excel import: ${prods.length} / ${ITEMS} items with price (paise), GST, stock and the sheet's barcode (${timings['import 1200 items (ms)'][0]} ms)`);
  await page.screenshot({ path: path.join(SHOTS, 'products-1200.png') });

  // Page loads with 1,200 items.
  for (const r of ['/products/', '/inventory/', '/billing/', '/reports/']) {
    t0 = Date.now();
    await page.evaluate((x) => { window.location.href = x; }, r);
    await page.locator('main').first().waitFor({ timeout: 30000 });
    await page.waitForFunction(() => (document.querySelector('main')?.textContent || '').length > 200, null, { timeout: 30000 }).catch(() => {});
    time(`open ${r} (ms)`, Date.now() - t0);
  }

  // ── The counter ──
  await go(page, '/billing/');
  const search = page.getByPlaceholder(/search/i).first();
  const customers = Array.from({ length: 20 }, (_, i) => ({ name: `Grahak ${String.fromCharCode(65 + i)}`, phone: `98${String(20000000 + i * 7919).slice(0, 8)}` }));
  let estimates = 0;
  for (let b = 1; b <= BILLS; b++) {
    const lines = 1 + Math.floor(rnd() * 5);
    const chosen = [];
    for (let l = 0; l < lines; l++) {
      const idx = Math.floor(rnd() * ITEMS) + 1;
      const qty = rnd() < 0.2 ? 2 : 1;
      for (let q = 0; q < qty; q++) {
        const ts = Date.now();
        await search.fill(ean13(idx));
        await search.press('Enter');
        await page.waitForTimeout(250);
        time('scan → line (ms)', Date.now() - ts);
      }
      chosen.push(idx);
    }
    const kind = b % 40 === 0 ? 'estimate' : b % 7 === 0 ? 'credit' : b % 3 === 0 ? 'upi' : 'cash';
    if (kind === 'credit') {
      const c = pick(customers);
      await page.getByPlaceholder('Customer name (optional)').fill(c.name);
      await page.getByPlaceholder(/10-digit mobile/).fill(c.phone);
      await page.getByRole('button', { name: /^Credit/ }).first().click();
    } else if (kind === 'upi') {
      await page.getByRole('button', { name: /UPI \/ QR/ }).first().click();
    }
    if (b % 10 === 0 && kind !== 'estimate') {
      await page.getByRole('button', { name: /% Percent/ }).click().catch(() => {});
      await page.getByPlaceholder('e.g. 5 or 10%').fill('5').catch(() => {});
    }
    const ts = Date.now();
    if (kind === 'estimate') {
      await page.getByRole('button', { name: /Save as Estimate/ }).click();
      estimates++;
    } else {
      await page.getByRole('button', { name: /Complete Sale/i }).first().click();
    }
    await page.getByRole('button', { name: /New Bill/i }).first().waitFor({ timeout: 20000 });
    time(kind === 'estimate' ? 'save estimate (ms)' : 'complete sale (ms)', Date.now() - ts);
    await page.getByRole('button', { name: /New Bill/i }).first().click();
    await page.waitForTimeout(150);
    if (b % 50 === 0) console.log(`  … ${b} bills`);
  }
  await page.screenshot({ path: path.join(SHOTS, 'counter-after.png') });

  // ── Returns (5 bills) and khata payments (3 customers) ──
  // Returns the cashier's way: Sales Return → invoice number → Search → one piece back. 2 udhar bills
  // (the refund comes off the khata) and 3 cash / UPI bills (cash back). An estimate is refused by the app.
  await go(page, '/transactions/');
  let returnsDone = 0, staleReturnScreen = 0;
  const soldSoFar = (await readStore(page, 'sales')).filter((s) => /^INV-/.test(s.invoice_number));
  const toReturn = [...soldSoFar.filter((s) => s.payment_method === 'credit').slice(0, 2), ...soldSoFar.filter((s) => s.payment_method !== 'credit').slice(0, 3)];
  for (const [r, sale] of toReturn.entries()) {
    await page.getByRole('button', { name: 'Sales Return' }).first().click();
    const modal = page.locator('[aria-modal="true"]');
    await page.waitForTimeout(400);
    const stale = modal.getByRole('button', { name: /Process Another Return/ });
    if (await stale.isVisible().catch(() => false)) { staleReturnScreen++; await stale.click(); }
    const box = modal.getByPlaceholder(/Enter Invoice Number/);
    await box.fill(sale.invoice_number);
    await box.press('Enter');
    await modal.locator('button').filter({ hasText: /^\+$/ }).first().click({ timeout: 10000 }).catch(() => {});
    const issue = modal.getByRole('button', { name: /Issue Return/ });
    if (!(await issue.isEnabled().catch(() => false))) await page.screenshot({ path: path.join(SHOTS, `return-${r}.png`) });
    if (await issue.isEnabled().catch(() => false)) {
      await issue.click();
      await modal.getByRole('button', { name: /^Done$/ }).click({ timeout: 15000 });
      returnsDone++;
    } else await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
  }
  check(returnsDone === toReturn.length, `Returns: ${returnsDone} / ${toReturn.length} done through Sales Return → invoice number`);
  check(staleReturnScreen === 0, `Sales Return opens fresh each time (${staleReturnScreen} times it showed the last "Return Completed")`);
  await go(page, '/khata/');
  let paymentsDone = 0;
  for (let k = 0; k < 3; k++) {
    const row = page.locator('[data-khata-customer]').nth(k);
    if (!(await row.count())) break;
    await row.click();
    await page.getByRole('button', { name: /You Got/ }).first().click();
    await page.getByPlaceholder('0.00').fill('100');
    await page.getByRole('button', { name: /Confirm & Save Payment/ }).click();
    await page.waitForTimeout(1200);
    paymentsDone++;
  }

  // ── Check every number against the database ──
  const sales = await readStore(page, 'sales');
  const real = sales.filter((s) => s.status !== 'draft' && !/^EST-/.test(s.invoice_number));
  const ests = sales.filter((s) => /^EST-/.test(s.invoice_number));
  const invs = real.map((s) => s.invoice_number);
  const seqs = invs.map((n) => Number(String(n).replace(/\D/g, ''))).sort((a, b) => a - b);
  check(real.length === BILLS - estimates && ests.length === estimates && new Set(invs).size === invs.length && seqs[0] === 1 && seqs[seqs.length - 1] === real.length,
    `Bills: ${real.length} saved + ${ests.length} estimates; invoice numbers unique and 1…${real.length} with no gap`);
  const lineSum = (s) => (s.items || []).reduce((n, i) => n + (i.total_amount || 0), 0);
  const badTotals = real.filter((s) => Math.abs(lineSum(s) - (s.grand_total ?? s.total_amount)) > 1 && !(s.items || []).some((i) => i.is_tax_inclusive === false));
  check(badTotals.length === 0, `Every bill total = the sum of its lines (${badTotals.length} wrong)`);
  const taxOk = real.every((s) => (s.items || []).every((i) => (i.tax_rate || 0) === 0 ? (i.tax_amount || 0) === 0 : (i.tax_amount || 0) > 0));
  check(taxOk, 'GSTIN shop: a line with GST % carries GST, a 0 % line none');

  // Stock: start − sold + returned = now (counted items).
  const prodsAfter = new Map((await readStore(page, 'products')).map((p) => [p.id, p]));
  const sold = new Map();
  for (const s of real) for (const i of s.items || []) sold.set(i.product_id, (sold.get(i.product_id) || 0) + (i.quantity || 0) - (i.returned_quantity || 0));
  let stockBad = 0;
  for (const [id, e] of expected.products) {
    const now = Number(prodsAfter.get(id)?.current_stock);
    if (Math.abs(e.stock - (sold.get(id) || 0) - now) > 0.0001) stockBad++;
  }
  check(stockBad === 0, `Stock of all ${expected.products.size} items = imported − sold + returned (${stockBad} wrong)`);

  // Udhar: each customer's balance = credit bills − khata payments (ledger).
  const custs = await readStore(page, 'customers');
  const ledger = await readStore(page, 'ledger_transactions');
  let udharBad = 0;
  for (const c of custs) {
    // Khata entries carry the customer in party_id; a payment (or a return on an udhar bill) is PAYMENT_RECEIVED.
    const entries = ledger.filter((l) => l.party_type === 'customer' && l.party_id === c.id).sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)));
    const bal = entries.reduce((n, l) => n + (l.transaction_type === 'PAYMENT_RECEIVED' ? -1 : 1) * (l.amount || 0), 0);
    const last = entries[entries.length - 1];
    const credit = real.filter((x) => x.customer_id === c.id).reduce((n, x) => n + (x.credit_amount ?? (x.payment_method === 'credit' ? (x.grand_total ?? x.total_amount) : 0)), 0);
    if (Math.abs(bal - (c.current_balance || 0)) > 1 || (last && Math.abs((last.balance_after || 0) - (c.current_balance || 0)) > 1) || credit <= 0) {
      udharBad++;
      if (udharBad <= 3) console.log(`    udhar ${c.name}: entries ${bal}, balance ${c.current_balance}, last balance_after ${last?.balance_after}, credit bills ${credit}`);
    }
  }
  check(custs.length > 0 && udharBad === 0, `Udhar: ${custs.length} customers, balance = khata entries (${udharBad} wrong); ${paymentsDone} payments, ${returnsDone} returns`);

  // Reports and Home show the database's numbers.
  const netOf = (s) => (s.grand_total ?? s.total_amount) - (s.returned_amount || 0);
  const total = real.reduce((n, s) => n + netOf(s), 0);
  await go(page, '/');
  const home = await text(page);
  const homeBills = Number((home.match(/Today.s Sales\s*(\d+)\s*Bills/i) || [])[1] || -1);
  // Day Summary (Home → Day Summary): total = database; cash + UPI + udhar = total; cash in hand = cash + udhar paid in cash.
  await page.locator('[data-home-action="day_summary"]').first().click();
  const dayBox = page.locator('[aria-modal="true"]');
  await dayBox.getByText('Total Sales (Bikri)').waitFor({ timeout: 15000 });
  const day = await dayBox.innerText();
  const amt = (label) => rupees((day.match(new RegExp(label + '[\s\S]{0,30}?₹([\d,]+(?:\.\d+)?)', 'i')) || [])[1] || '0');
  const dTotal = amt('Total Sales \(Bikri\)'), dCash = amt('Cash Collections:'), dUpi = amt('UPI / QR Payments:'), dCredit = amt('Customer Udhar \(Credit\):');
  const dHand = amt('Net Cash in Hand'), dKhata = amt('Udhar received in cash \(Khata\):');
  check(Math.abs(dTotal - total) <= 100 && Math.abs(dCash + dUpi + dCredit - dTotal) <= 3 && Math.abs(dHand - (dCash + dKhata)) <= 3,
    `Day Summary: total ₹${dTotal / 100} (db ₹${total / 100}) = cash ₹${dCash / 100} + UPI ₹${dUpi / 100} + udhar ₹${dCredit / 100}; cash in hand ₹${dHand / 100} = cash + khata cash ₹${dKhata / 100}`);
  await page.screenshot({ path: path.join(SHOTS, 'day-summary.png') });
  await page.keyboard.press('Escape');
  await go(page, '/reports/');
  await page.getByRole('button', { name: /^Today$/ }).click().catch(() => {});
  await page.waitForTimeout(1200);
  const rep = await text(page);
  const repTotal = rupees((rep.match(/Total Revenue[\s\S]{0,40}?₹([\d,]+(?:\.\d+)?)/) || [])[1] || '0');
  // A fully returned bill leaves the count on every screen (isRevenueSale), its money is already 0.
  const counted = real.filter((x) => x.status !== 'returned' && x.status !== 'cancelled').length;
  check(homeBills === counted && Math.abs(repTotal - total) <= 100,
    `Home "Today's Sales" ${homeBills} bills (db ${counted}, fully returned left out); Reports total ₹${repTotal / 100} = database ₹${total / 100} (net of returns)`);
  await page.screenshot({ path: path.join(SHOTS, 'reports.png') });

  // GST screen sees the GST.
  await go(page, '/gst-reports/');
  const gstText = await text(page);
  const gstDb = real.reduce((n, s) => n + (s.items || []).reduce((m, i) => m + (i.tax_amount || 0), 0), 0);
  check(/Total GST Tax/.test(gstText) && gstDb > 0, `GST Reports open for a GSTIN shop; database GST ₹${gstDb / 100}`);

  check(errors.length === 0, `No page / console errors during the day (${errors.length}${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''})`);
} catch (err) {
  check(false, `Stress run stopped: ${String(err.message).split('\n')[0]}`);
  await page.screenshot({ path: path.join(SHOTS, 'crash.png') }).catch(() => {});
} finally {
  await app.close().catch(() => {});
}

// ── Restart: everything is still there, the password is asked ──
try {
  ({ app, page, errors } = await launch());
  const pw = page.getByPlaceholder('••••••••');
  await pw.waitFor({ timeout: 120000 });
  const t0 = Date.now();
  await pw.fill(PASSWORD);
  await pw.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 60000 });
  time('unlock → home (ms)', Date.now() - t0);
  const sales = await readStore(page, 'sales');
  const prods = await readStore(page, 'products');
  check(sales.length >= BILLS && prods.length >= ITEMS, `After a restart: ${sales.length} bills and ${prods.length} items are all there`);
} catch (err) {
  check(false, `Restart check failed: ${String(err.message).split('\n')[0]}`);
} finally {
  await app.close().catch(() => {});
}

console.log('\n⏱️  Timings');
for (const [k, a] of Object.entries(timings)) console.log(`  ${k}: ${JSON.stringify(stats(a))}`);
console.log('================================================================');
console.log(`📊 SHOP DAY: ${passed}/${passed + failed} PASSED (${failed} failures)  screenshots: ${SHOTS}`);
if (problems.length) console.log('Problems:\n- ' + problems.join('\n- '));
console.log('================================================================');
fs.rmSync(dataDir, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
