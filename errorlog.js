/**
 * Error log — runs in the Electron MAIN process.
 *
 * Before this, an error on a shop's computer was invisible: nobody knew the app
 * had failed until the shop called. Every error from the main process, the page
 * (window.onerror / unhandled promise / React error screen) and renderer crashes
 * or hangs is appended to <userData>/logs/errors.log (one JSON line each; rolled
 * to errors.1.log at 1 MB). Settings → Help & Support copies a report the shop
 * can send on WhatsApp / email, or opens the folder.
 *
 * Never throws — logging must not become a second failure.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const MAX_BYTES = 1024 * 1024;

let logDir = null;

function init(userDataDir) {
  logDir = path.join(userDataDir, 'logs');
}

function logFile() {
  return logDir ? path.join(logDir, 'errors.log') : null;
}

function clip(value, max) {
  return String(value == null ? '' : value).slice(0, max);
}

/** entry: { source, message, stack?, detail? } */
function logError(entry) {
  const file = logFile();
  if (!file) return;
  try {
    fs.mkdirSync(logDir, { recursive: true });
    try {
      if (fs.statSync(file).size > MAX_BYTES) fs.renameSync(file, path.join(logDir, 'errors.1.log'));
    } catch {}
    const line = JSON.stringify({
      at: new Date().toISOString(),
      source: clip(entry && entry.source, 40) || 'unknown',
      message: clip(entry && entry.message, 1000),
      stack: clip(entry && entry.stack, 4000) || undefined,
      detail: clip(entry && entry.detail, 1000) || undefined,
    });
    fs.appendFileSync(file, line + '\n', 'utf8');
  } catch {}
}

function readRecent(limit) {
  const out = [];
  for (const name of ['errors.1.log', 'errors.log']) {
    try {
      const text = fs.readFileSync(path.join(logDir, name), 'utf8');
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        try {
          out.push(JSON.parse(line));
        } catch {}
      }
    } catch {}
  }
  return out.slice(-limit);
}

/** Plain-text report for support: app / system facts + the latest errors. */
function buildReport({ appVersion, licence }) {
  const recent = readRecent(30);
  const lines = [
    'KamaiPlus Desktop — support report',
    `Generated: ${new Date().toLocaleString('en-IN')}`,
    `App version: ${appVersion}`,
    `Windows: ${os.release()} (${os.arch()}), RAM ${Math.round(os.totalmem() / 1024 ** 3)} GB`,
    `Computer: ${os.hostname()}`,
    `Licence: ${licence}`,
    `Errors logged: ${recent.length === 0 ? 'none' : `${recent.length} (latest last)`}`,
    '',
  ];
  for (const e of recent) {
    lines.push(`[${e.at}] ${e.source}: ${e.message}`);
    if (e.detail) lines.push(`    ${e.detail}`);
    if (e.stack) lines.push(...String(e.stack).split('\n').slice(0, 4).map((s) => `    ${s.trim()}`));
  }
  return lines.join('\n');
}

module.exports = { init, logError, readRecent, buildReport, logDirPath: () => logDir };
