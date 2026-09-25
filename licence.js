/**
 * KamaiPlus Desktop licence — runs in the Electron MAIN process only.
 *
 * The app is sold for a fixed, one-time price. One licence key works on one
 * computer, and there is no trial:
 *
 *   1. The shop types its key once. `activate()` sends it, with this computer's
 *      machine id, to the `desktopLicence` Cloud Function (KamaiPlus Android
 *      repo, functions/licence_core.js). The server binds the key to this PC and
 *      returns a licence signed with an Ed25519 private key that never leaves the
 *      server.
 *   2. The signed licence is saved in the user-data folder. On every launch
 *      `getStatus()` verifies it OFFLINE with the public key below and checks it
 *      names this computer. No internet is ever needed again.
 *
 * Copying licence.json to another PC does not work (different machine id), and
 * editing it breaks the signature. Keys are created / moved / blocked in the
 * Admin Console → Desktop Licences.
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ACTIVATION_URL = 'https://us-central1-kamaiplus.cloudfunctions.net/desktopLicence';

/** Public half of the server's DESKTOP_LICENCE_SIGNING_KEY. Safe to ship. */
const LICENCE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAw4ceFjPzb1z6Xq9b8i2WgT4k2D3NUgRdmlLVhKKJLqk=
-----END PUBLIC KEY-----
`;

const LICENCE_FILE = 'licence.json';

let cachedMachineId = null;

/**
 * A stable id for this computer: SHA-256 of Windows' MachineGuid (survives app
 * reinstalls and updates, changes only with a Windows reinstall). Falls back to
 * hostname + CPU + RAM where the registry cannot be read.
 */
function getMachineId() {
  if (cachedMachineId) return cachedMachineId;
  let seed = '';
  if (process.platform === 'win32') {
    try {
      const out = execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 5000,
      });
      const match = out.match(/MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]+)/);
      if (match) seed = `win:${match[1].toLowerCase()}`;
    } catch {
      // fall through to the hardware fallback
    }
  }
  if (!seed) {
    const cpu = (os.cpus()[0] || {}).model || 'cpu';
    seed = `fallback:${os.hostname()}|${cpu}|${os.totalmem()}|${process.platform}`;
  }
  cachedMachineId = crypto.createHash('sha256').update(`kamaiplus-desktop|${seed}`).digest('hex');
  return cachedMachineId;
}

function getMachineName() {
  return os.hostname().slice(0, 80) || 'Windows PC';
}

/** "KPD-7F3K-9QXM-2B8H-RT4W" -> "KPD-7F3K-••••-••••-RT4W" for display. */
function maskKey(key) {
  const parts = String(key || '').split('-');
  if (parts.length !== 5) return '';
  return [parts[0], parts[1], '••••', '••••', parts[4]].join('-');
}

/** Returns the licence payload if the signature is valid and it names this PC. */
function verifyLicence(record) {
  if (!record || typeof record.licence !== 'string' || typeof record.signature !== 'string') return null;
  try {
    const bytes = Buffer.from(record.licence, 'base64url');
    const ok = crypto.verify(
      null,
      bytes,
      crypto.createPublicKey(LICENCE_PUBLIC_KEY),
      Buffer.from(record.signature, 'base64url')
    );
    if (!ok) return null;
    const payload = JSON.parse(bytes.toString('utf8'));
    if (payload.v !== 1 || payload.machine_id !== getMachineId()) return null;
    return payload;
  } catch {
    return null;
  }
}

function licencePath(userDataDir) {
  return path.join(userDataDir, LICENCE_FILE);
}

function activeStatus(payload) {
  return {
    state: 'active',
    key: maskKey(payload.key),
    shopName: payload.shop_name || '',
    machineName: getMachineName(),
  };
}

/**
 * Offline check, done on every launch. `dev` (electron . --dev / no build)
 * skips the licence so development never needs a key.
 */
function getStatus({ userDataDir, dev }) {
  if (dev) return { state: 'active', key: '', shopName: '', machineName: getMachineName(), dev: true };
  let record = null;
  try {
    record = JSON.parse(fs.readFileSync(licencePath(userDataDir), 'utf8'));
  } catch {
    return { state: 'required', machineName: getMachineName() };
  }
  const payload = verifyLicence(record);
  if (!payload) {
    return {
      state: 'required',
      machineName: getMachineName(),
      reason: 'The licence on this computer is not valid for this computer. Please activate again.',
    };
  }
  return activeStatus(payload);
}

/** "kpd 7f3k-9qxm…" and "KPD-7F3K-9QXM-…" compare equal. */
function normalizeKey(key) {
  let s = String(key || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.length > 16 && s.startsWith('KPD')) s = s.slice(3);
  return s;
}

/**
 * Master-password recovery: true only if `key` is the key of the valid, signed
 * licence activated on THIS computer. Works offline. The small delay makes
 * guessing pointless on top of the key's ~79 bits.
 */
async function verifyOwnKey({ userDataDir, key }) {
  await new Promise((r) => setTimeout(r, 600));
  let record = null;
  try {
    record = JSON.parse(fs.readFileSync(licencePath(userDataDir), 'utf8'));
  } catch {
    return { ok: false, error: 'No licence is activated on this computer.' };
  }
  const payload = verifyLicence(record);
  if (!payload) return { ok: false, error: 'The licence on this computer is not valid.' };
  const typed = normalizeKey(key);
  if (!typed || typed !== normalizeKey(payload.key)) {
    return { ok: false, error: 'This is not the licence key of this computer. Check the key you received when you bought KamaiPlus.' };
  }
  return { ok: true };
}

/** One-time online activation. Never throws; returns { ok, status } or { ok:false, error }. */
async function activate({ userDataDir, key, appVersion, fetchImpl }) {
  const cleanKey = String(key || '').trim();
  if (!cleanKey) return { ok: false, error: 'Please enter your licence key.' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let res;
  let body = {};
  try {
    res = await fetchImpl(ACTIVATION_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'activate',
        key: cleanKey,
        machine_id: getMachineId(),
        machine_name: getMachineName(),
        app_version: appVersion,
      }),
      signal: controller.signal,
    });
    body = await res.json().catch(() => ({}));
  } catch {
    return {
      ok: false,
      error: 'Could not reach the KamaiPlus licence server. Please check the internet connection and try again.',
    };
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    return { ok: false, error: body.error || `Activation failed (error ${res.status}). Please try again.` };
  }

  const record = { licence: body.licence, signature: body.signature };
  const payload = verifyLicence(record);
  if (!payload) {
    return { ok: false, error: 'The licence server sent an invalid licence. Please contact KamaiPlus support.' };
  }

  try {
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.writeFileSync(licencePath(userDataDir), JSON.stringify(record, null, 2), 'utf8');
  } catch (err) {
    return { ok: false, error: `Activated, but the licence could not be saved on this computer: ${err.message}` };
  }
  return { ok: true, status: activeStatus(payload) };
}

module.exports = { getMachineId, getMachineName, maskKey, verifyLicence, getStatus, activate, verifyOwnKey, LICENCE_PUBLIC_KEY };
