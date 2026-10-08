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

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kp-inspect-'));

const pem = fs.readFileSync(PRIVATE_KEY, 'utf8');
const payload = {
  v: 1,
  key: 'KPD-INSP-TEST-0000-0001',
  machine_id: licence.getMachineId(),
  shop_name: 'Inspect Shop',
  issued_at: new Date().toISOString()
};
const bytes = Buffer.from(JSON.stringify(payload), 'utf8');
const signature = crypto.sign(null, bytes, crypto.createPrivateKey(pem));
fs.mkdirSync(path.join(dataDir, 'userData'), { recursive: true });
fs.writeFileSync(
  path.join(dataDir, 'userData', 'licence.json'),
  JSON.stringify({ licence: bytes.toString('base64url'), signature: signature.toString('base64url') })
);

const env = { ...process.env, KAMAI_E2E_DIR: dataDir };
delete env.ELECTRON_RUN_AS_NODE;

console.log('Launching Electron...');
const app = await electron.launch({
  executablePath: electronPath,
  args: [APP_DIR],
  cwd: APP_DIR,
  env,
  timeout: 30000
});

const page = await app.firstWindow();
await page.waitForTimeout(4000);

const url = page.url();
const title = await page.title();
console.log('Current URL:', url);
console.log('Page Title:', title);

const shotPath = path.join(os.tmpdir(), 'startup_inspection.png');
await page.screenshot({ path: shotPath });
console.log('Screenshot saved to:', shotPath);

const bodyText = await page.evaluate(() => document.body.innerText);
console.log('Body Text:\n', bodyText.slice(0, 1000));

await app.close();
try {
  fs.rmSync(dataDir, { recursive: true, force: true });
} catch {}
