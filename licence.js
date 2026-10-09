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
 *
 * v4.85.0 — validity + check-in:
 *   - A key can have an end date (`valid_until`, set in the Admin Console). It is
 *     inside the signed licence, so it is enforced offline. The clock used is never
 *     earlier than the licence's `issued_at` (server time) or the latest time this
 *     computer has already seen (licence_clock.json) — turning the PC clock back
 *     does not bring an ended licence back.
 *   - While online, `refresh()` checks in (main.js: at start and every few hours):
 *     a fresh licence with the current end date comes back. A key blocked in the
 *     Admin Console ("revoked") or moved to another computer ("moved") stops the
 *     app: licence.json is set aside as licence.blocked.json (kept for support).
 *     No internet, or any other answer: nothing changes.
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
const BLOCKED_FILE = 'licence.blocked.json';
const CLOCK_FILE = 'licence_clock.json';
const DAY_MS = 24 * 60 * 60 * 1000;

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

const timeOf = (iso) => {
  const t = Date.parse(iso || '');
  return Number.isFinite(t) ? t : 0;
};

/**
 * "Now" for the end-date check: never before the licence's server time or the
 * latest time already seen on this computer. Remembers the new latest time.
 */
function licenceNow(userDataDir, payload, nowMs = Date.now()) {
  const file = path.join(userDataDir, CLOCK_FILE);
  let seen = 0;
  try {
    seen = Number(JSON.parse(fs.readFileSync(file, 'utf8')).seen) || 0;
  } catch {
    // first check on this computer
  }
  const now = Math.max(nowMs, seen, timeOf(payload && payload.issued_at));
  if (now > seen) {
    try {
      fs.writeFileSync(file, JSON.stringify({ seen: now }), 'utf8');
    } catch {
      // read-only folder: the check still uses the best time known now
    }
  }
  return now;
}

/** Active, or ended when the licence has an end date that is past. */
function statusFor(payload, now) {
  const base = { key: maskKey(payload.key), shopName: payload.shop_name || '', machineName: getMachineName() };
  const end = timeOf(payload.valid_until);
  if (!end) return { state: 'active', ...base, validUntil: null, daysLeft: null };
  if (now > end) return { state: 'expired', ...base, validUntil: payload.valid_until };
  return { state: 'active', ...base, validUntil: payload.valid_until, daysLeft: Math.floor((end - now) / DAY_MS) };
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Offline check, done on every launch. `dev` (electron . --dev / no build)
 * skips the licence so development never needs a key.
 */
function getStatus({ userDataDir, dev, nowMs }) {
  if (dev) return { state: 'active', key: '', shopName: '', machineName: getMachineName(), dev: true };
  const record = readJson(licencePath(userDataDir));
  if (!record) {
    // Stopped at a check-in (blocked / moved): say why on the activation screen.
    const blocked = readJson(path.join(userDataDir, BLOCKED_FILE));
    return blocked && blocked.reason
      ? { state: 'required', machineName: getMachineName(), reason: String(blocked.reason) }
      : { state: 'required', machineName: getMachineName() };
  }
  const payload = verifyLicence(record);
  if (!payload) {
    return {
      state: 'required',
      machineName: getMachineName(),
      reason: 'The licence on this computer is not valid for this computer. Please activate again.',
    };
  }
  return statusFor(payload, licenceNow(userDataDir, payload, nowMs));
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

/** POSTs to the licence server. Never throws: { res, body } or { offline: true }. */
async function callServer({ action, key, appVersion, fetchImpl, timeoutMs = 20000, health = null, report = null }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(ACTIVATION_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action,
        key,
        machine_id: getMachineId(),
        machine_name: getMachineName(),
        app_version: appVersion,
        // v4.98.0: counts only (adminLink.js) — sent at a check-in, never at activation.
        ...(health ? { health } : {}),
        // v4.105.0: features, update state, commands run, error report on request (adminLink.buildReport).
        ...(report && Object.keys(report).length ? { report } : {}),
      }),
      signal: controller.signal,
    });
    const body = await res.json().catch(() => ({}));
    return { res, body: body || {} };
  } catch {
    return { offline: true };
  } finally {
    clearTimeout(timer);
  }
}

function saveRecord(userDataDir, record) {
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(licencePath(userDataDir), JSON.stringify(record, null, 2), 'utf8');
  try {
    fs.rmSync(path.join(userDataDir, BLOCKED_FILE), { force: true });
  } catch {
    // an old note only
  }
}

/** One-time online activation. Never throws; returns { ok, status } or { ok:false, error }. */
async function activate({ userDataDir, key, appVersion, fetchImpl }) {
  const cleanKey = String(key || '').trim();
  if (!cleanKey) return { ok: false, error: 'Please enter your licence key.' };

  const call = await callServer({ action: 'activate', key: cleanKey, appVersion, fetchImpl });
  if (call.offline) {
    return {
      ok: false,
      error: 'Could not reach the KamaiPlus licence server. Please check the internet connection and try again.',
    };
  }
  const { res, body } = call;
  if (!res.ok) {
    return { ok: false, error: body.error || `Activation failed (error ${res.status}). Please try again.` };
  }

  const record = { licence: body.licence, signature: body.signature };
  const payload = verifyLicence(record);
  if (!payload) {
    return { ok: false, error: 'The licence server sent an invalid licence. Please contact KamaiPlus support.' };
  }

  try {
    saveRecord(userDataDir, record);
  } catch (err) {
    return { ok: false, error: `Activated, but the licence could not be saved on this computer: ${err.message}` };
  }
  return { ok: true, status: statusFor(payload, licenceNow(userDataDir, payload)) };
}

/**
 * Online check-in (v4.85.0). Never throws. Returns:
 *   { ok: true, status, messages, control } fresh licence saved (new end date, if any); messages =
 *                                        the Admin's messages for this PC (v4.98.0; undefined
 *                                        from an older server)
 *   { ok: false, stopped: true, status, control } key blocked / moved / deleted: the app must stop;
 *                                        control = the blocked key's wipe command, if any
 *   { ok: false, offline: true }         no internet — nothing changes
 *   { ok: false, error }                 any other answer — nothing changes
 */
async function refresh({ userDataDir, appVersion, fetchImpl, timeoutMs, health = null, report = null }) {
  let record = readJson(licencePath(userDataDir));
  let current = record && verifyLicence(record);
  let wasBlocked = false;
  if (!current) {
    // v4.125.0 (AU-10): a PC whose key was BLOCKED keeps checking in with the blocked licence, so the
    // Admin's "Wipe data & reset PC" still reaches it and "Unblock key" brings it back by itself. A key
    // that moved to another PC or was deleted never asks again.
    const blocked = readJson(path.join(userDataDir, BLOCKED_FILE));
    const kept = blocked && blocked.code === 'revoked' ? { licence: blocked.licence, signature: blocked.signature } : null;
    const keptPayload = kept && verifyLicence(kept);
    if (!keptPayload) return { ok: false, error: 'no-licence' };
    record = kept;
    current = keptPayload;
    wasBlocked = true;
  }

  const call = await callServer({ action: 'refresh', key: current.key, appVersion, fetchImpl, timeoutMs, health, report });
  if (call.offline) return { ok: false, offline: true };
  const { res, body } = call;

  if (!res.ok) {
    // Only the answers that mean "this computer may no longer use the key" stop the app.
    // v4.117.0: "not-found" too — the Admin deleted the key (before, the PC kept running on it).
    if (body.code === 'revoked' || body.code === 'moved' || body.code === 'not-found') {
      const reason = body.code === 'not-found'
        ? 'This licence key has been deleted. Please contact KamaiPlus support.'
        : body.error || (body.code === 'revoked'
          ? 'This licence key has been blocked. Please contact KamaiPlus support.'
          : 'This licence key is no longer on this computer. Enter the key again, or contact KamaiPlus support.');
      try {
        fs.writeFileSync(path.join(userDataDir, BLOCKED_FILE), JSON.stringify({ ...record, code: body.code, reason, at: new Date().toISOString() }, null, 2), 'utf8');
        fs.rmSync(licencePath(userDataDir), { force: true });
      } catch (err) {
        return { ok: false, error: `Could not update the licence on this computer: ${err.message}` };
      }
      // The Admin's control (a wipe command) only from a blocked key — never from "moved": the key's
      // commands are now for its new PC.
      return { ok: false, stopped: true, status: { state: 'required', machineName: getMachineName(), reason }, control: body.code === 'revoked' ? body.control : undefined };
    }
    return { ok: false, error: body.error || `error ${res.status}` };
  }

  const fresh = { licence: body.licence, signature: body.signature };
  const payload = verifyLicence(fresh);
  if (!payload || payload.key !== current.key) return { ok: false, error: 'invalid-licence' };
  try {
    saveRecord(userDataDir, fresh);
    // Unblocked by the Admin: the licence works again and the "blocked" note goes (v4.125.0).
    if (wasBlocked) fs.rmSync(path.join(userDataDir, BLOCKED_FILE), { force: true });
  } catch (err) {
    return { ok: false, error: err.message };
  }
  return {
    ok: true,
    status: statusFor(payload, licenceNow(userDataDir, payload)),
    messages: Array.isArray(body.messages) ? body.messages : undefined,
    // v4.105.0: the Admin's remote control for this PC (undefined from an older server).
    control: body.control && typeof body.control === 'object' ? body.control : undefined,
  };
}

module.exports = { getMachineId, getMachineName, maskKey, verifyLicence, getStatus, activate, refresh, verifyOwnKey, statusFor, licenceNow, LICENCE_PUBLIC_KEY };
