const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * What this computer tells the Admin Console, and what the Admin tells it (v4.98.0).
 *
 * Health: at each online licence check-in (licence.js refresh) the app sends a few COUNTS —
 * bills today / last 7 days, items, customers, last bill and last backup time, backups kept,
 * whether an extra backup copy and cloud sync are on, errors in the last 7 days, free disk and
 * the Windows version. Never names, amounts or bills. The counts come from the page (the shop
 * database lives there) via kp:report-health and are kept in userData, so a check-in before the
 * shop unlocks still sends the last ones.
 *
 * Messages: the check-in answer carries the Admin's messages for this computer
 * ({ id, scope, text, level, until }); they are kept in userData and shown as a banner.
 */

const COUNTS_FILE = 'shop_counts.json';
const MESSAGES_FILE = 'admin_messages.json';
const COUNT_FIELDS = ['bills_today', 'bills_7d', 'products', 'customers'];
const LEVELS = ['info', 'warning', 'urgent'];
const DAY_MS = 24 * 60 * 60 * 1000;

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

const isoOrNull = (v) => {
  if (typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

/** The page's counts → only known fields (whole numbers ≥ 0, an ISO date, a flag). */
function cleanCounts(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const k of COUNT_FIELDS) {
    const n = Number(raw[k]);
    if (raw[k] !== null && raw[k] !== undefined && Number.isFinite(n) && n >= 0) out[k] = Math.round(n);
  }
  const lastBill = isoOrNull(raw.last_bill_at);
  if (lastBill) out.last_bill_at = lastBill;
  if (typeof raw.cloud_sync === 'boolean') out.cloud_sync = raw.cloud_sync;
  return out;
}

function saveCounts(userDataDir, raw) {
  const counts = cleanCounts(raw);
  writeJson(path.join(userDataDir, COUNTS_FILE), { ...counts, at: new Date().toISOString() });
  return counts;
}

/** Free space on the drive that holds the shop data, in GB (one decimal); null if Windows cannot say. */
function diskFreeGb(dir) {
  try {
    const s = fs.statfsSync(dir);
    return Math.round(((s.bavail * s.bsize) / 1024 ** 3) * 10) / 10;
  } catch {
    return null;
  }
}

/**
 * The report sent at a check-in. backupInfo: backup.getInfo(); errors: errorlog.readRecent().
 * Counts older than 2 days are left out (they would show yesterday's "bills today").
 */
function buildHealth({ userDataDir, backupInfo, errors, nowMs = Date.now() }) {
  const health = {};
  const saved = readJson(path.join(userDataDir, COUNTS_FILE));
  const savedAt = saved && Date.parse(saved.at);
  if (saved && Number.isFinite(savedAt) && nowMs - savedAt < 2 * DAY_MS) {
    const counts = cleanCounts(saved);
    // "Bills today" is only today's when the page counted it today.
    if (new Date(savedAt).toDateString() !== new Date(nowMs).toDateString()) delete counts.bills_today;
    Object.assign(health, counts);
  }
  if (backupInfo) {
    if (backupInfo.lastBackupAt) health.last_backup_at = backupInfo.lastBackupAt;
    if (Number.isFinite(backupInfo.count)) health.backups_kept = backupInfo.count;
    health.backup_copy = Boolean(backupInfo.extraFolder);
  }
  if (Array.isArray(errors)) {
    health.errors_7d = errors.filter((e) => e && Date.parse(e.at) > nowMs - 7 * DAY_MS).length;
  }
  const disk = diskFreeGb(userDataDir);
  if (disk !== null) health.disk_free_gb = disk;
  health.windows = `${os.release()}`.slice(0, 40);
  return health;
}

/** The server's messages → at most 5 clean ones (the server already left out ended ones). */
function cleanMessages(raw, nowMs = Date.now()) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue;
    const text = String(m.text || '').replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ').trim().slice(0, 500);
    const id = String(m.id || '').trim().slice(0, 60);
    if (!text || !id || out.some((x) => x.id === id)) continue;
    const until = isoOrNull(m.until);
    if (until && Date.parse(until) <= nowMs) continue;
    out.push({ id, scope: m.scope === 'key' ? 'key' : 'all', text, level: LEVELS.includes(m.level) ? m.level : 'info', until });
    if (out.length === 5) break;
  }
  return out;
}

/** Saves the messages from a check-in; true when they differ from the ones kept before. */
function saveMessages(userDataDir, raw) {
  const next = cleanMessages(raw);
  const file = path.join(userDataDir, MESSAGES_FILE);
  const before = JSON.stringify(readJson(file) || []);
  if (before === JSON.stringify(next)) return false;
  writeJson(file, next);
  return true;
}

/** The kept messages, without any whose `until` has passed since. */
function readMessages(userDataDir, nowMs = Date.now()) {
  return cleanMessages(readJson(path.join(userDataDir, MESSAGES_FILE)), nowMs);
}

module.exports = { cleanCounts, saveCounts, buildHealth, cleanMessages, saveMessages, readMessages, diskFreeGb };
