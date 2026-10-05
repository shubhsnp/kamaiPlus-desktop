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
 *
 * Control (v4.105.0): features forced on / off, read-only / locked, a minimum version, the
 * check-in interval and one-off commands — see "Remote control" below.
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
  // v4.105.0: the feature switches as the shop has them (for the Admin Console's Control window).
  if (raw.features && typeof raw.features === 'object' && !Array.isArray(raw.features)) {
    const f = {};
    for (const [k, v] of Object.entries(raw.features)) if (/^[a-z][a-z_]{1,39}$/.test(k) && typeof v === 'boolean') f[k] = v;
    if (Object.keys(f).length) out.features = f;
  }
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
    delete counts.features;
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
    const msg = { id, scope: m.scope === 'key' ? 'key' : 'all', text, level: LEVELS.includes(m.level) ? m.level : 'info', until };
    if (m.style === 'popup') msg.style = 'popup';
    const link = String(m.link || '').trim();
    if (/^https:\/\/[^\s"'<>]{3,300}$/.test(link)) {
      msg.link = link;
      msg.link_label = String(m.link_label || 'Open').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 40) || 'Open';
    }
    out.push(msg);
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


// ---------------------------------------------------------------------------
// Remote control (v4.105.0) — what the Admin Console makes this computer do.
// The check-in answer carries `control` (server: licence_core.js pickDesktopControl):
//   { mode: normal | read_only | locked, mode_reason?, features?: { id: on }, min_version?,
//     checkin_minutes?, commands?: [{ id, type, at }] }
// It is kept in userData so it holds offline too (a locked shop stays locked until the Admin
// unlocks it at the next check-in). Commands run once: their ids are remembered, and the
// result goes back at the next check-in (`report.commands_done`).
// ---------------------------------------------------------------------------

const CONTROL_FILE = 'admin_control.json';
const COMMANDS_FILE = 'admin_commands.json';
const MODES = ['normal', 'read_only', 'locked'];
const COMMAND_TYPES = ['check_update', 'install_update', 'backup_now', 'send_report', 'restart_app'];
const FEATURE_ID = /^[a-z][a-z_]{1,39}$/;
const VERSION = /^\d{1,3}\.\d{1,4}\.\d{1,4}$/;
const DEFAULT_CONTROL = { mode: 'normal' };

const cleanLine = (v, max) => String(v || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

/** The server's control → only known fields (anything unreadable = normal, nothing forced). */
function cleanControl(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_CONTROL };
  const out = { mode: MODES.includes(raw.mode) ? raw.mode : 'normal' };
  const reason = cleanLine(raw.mode_reason, 300);
  if (out.mode !== 'normal' && reason) out.mode_reason = reason;
  if (raw.features && typeof raw.features === 'object' && !Array.isArray(raw.features)) {
    const f = {};
    for (const [k, v] of Object.entries(raw.features)) if (FEATURE_ID.test(k) && typeof v === 'boolean') f[k] = v;
    if (Object.keys(f).length) out.features = f;
  }
  if (VERSION.test(String(raw.min_version || ''))) out.min_version = String(raw.min_version);
  const minutes = Number(raw.checkin_minutes);
  if (Number.isFinite(minutes) && minutes > 0) out.checkin_minutes = Math.min(360, Math.max(15, Math.round(minutes)));
  if (Array.isArray(raw.commands)) {
    const cmds = [];
    for (const c of raw.commands) {
      if (!c || !COMMAND_TYPES.includes(c.type)) continue;
      const id = cleanLine(c.id, 60);
      if (!id || cmds.some((x) => x.id === id)) continue;
      cmds.push({ id, type: c.type, at: isoOrNull(c.at) });
      if (cmds.length === 10) break;
    }
    if (cmds.length) out.commands = cmds;
  }
  return out;
}

/** Saves the control from a check-in; true when it differs from the one kept before. */
function saveControl(userDataDir, raw) {
  const next = cleanControl(raw);
  const file = path.join(userDataDir, CONTROL_FILE);
  if (JSON.stringify(readJson(file)) === JSON.stringify(next)) return false;
  writeJson(file, next);
  return true;
}

function readControl(userDataDir) {
  return cleanControl(readJson(path.join(userDataDir, CONTROL_FILE)));
}

/** `1` when a is newer than b ("4.105.0" vs "4.99.0"), `-1` older, `0` same. */
function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0) ? 1 : -1;
  return 0;
}

// Commands: { done: [id…] (last 50, never run again), results: [{ id, ok, note, at }] not yet sent }
function readCommands(userDataDir) {
  const raw = readJson(path.join(userDataDir, COMMANDS_FILE)) || {};
  return { done: Array.isArray(raw.done) ? raw.done.slice(-50) : [], results: Array.isArray(raw.results) ? raw.results.slice(-20) : [], sendReport: raw.sendReport === true };
}

function writeCommands(userDataDir, state) {
  writeJson(path.join(userDataDir, COMMANDS_FILE), { done: state.done.slice(-50), results: state.results.slice(-20), sendReport: Boolean(state.sendReport) });
}

/** The control's commands this computer has not run yet (oldest first). */
function pendingCommands(userDataDir, control) {
  const { done } = readCommands(userDataDir);
  return (control.commands || []).filter((c) => !done.includes(c.id));
}

/** Marks a command as run and keeps its result for the next check-in. */
function recordCommand(userDataDir, id, ok, note, extra = {}) {
  const state = readCommands(userDataDir);
  if (!state.done.includes(id)) state.done.push(id);
  state.results = state.results.filter((r) => r.id !== id).concat({ id, ok: Boolean(ok), note: cleanLine(note, 200), at: new Date().toISOString() });
  if (extra.sendReport) state.sendReport = true;
  writeCommands(userDataDir, state);
}

/** After the server took the report: the results it has are not sent again. */
function clearSentResults(userDataDir, sentIds) {
  const state = readCommands(userDataDir);
  state.results = state.results.filter((r) => !sentIds.includes(r.id));
  state.sendReport = false;
  writeCommands(userDataDir, state);
}

/**
 * What goes with the check-in besides the health counts: the page's feature switches, the
 * update state, the commands run since the last check-in and — only when the Admin asked for
 * it — the error report.
 */
function buildReport({ userDataDir, updateStatus, errorReportText }) {
  const report = {};
  const saved = readJson(path.join(userDataDir, COUNTS_FILE));
  if (saved && saved.features && typeof saved.features === 'object') {
    const f = {};
    for (const [k, v] of Object.entries(saved.features)) if (FEATURE_ID.test(k) && typeof v === 'boolean') f[k] = v;
    if (Object.keys(f).length) report.features = f;
  }
  if (updateStatus) {
    const u = {};
    if (updateStatus.readyVersion && VERSION.test(String(updateStatus.readyVersion))) u.ready_version = String(updateStatus.readyVersion);
    if (updateStatus.lastCheck && updateStatus.lastCheck.at) u.last_check = updateStatus.lastCheck.at;
    if (updateStatus.lastCheck && updateStatus.lastCheck.result) u.last_result = String(updateStatus.lastCheck.result).slice(0, 30);
    if (typeof updateStatus.beta === 'boolean') u.beta = updateStatus.beta;
    if (Object.keys(u).length) report.update = u;
  }
  const state = readCommands(userDataDir);
  if (state.results.length) report.commands_done = state.results;
  if (state.sendReport && errorReportText) report.error_report = String(errorReportText).slice(0, 20000);
  return report;
}

module.exports = {
  cleanCounts, saveCounts, buildHealth, cleanMessages, saveMessages, readMessages, diskFreeGb,
  cleanControl, saveControl, readControl, compareVersions, pendingCommands, recordCommand, readCommands, clearSentResults, buildReport,
  COMMAND_TYPES,
};
