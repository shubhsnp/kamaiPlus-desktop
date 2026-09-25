/**
 * Automatic local backup — runs in the Electron MAIN process.
 *
 * Cloud sync is off in the desktop app (no cloud login), so a dead hard disk would
 * lose the shop's whole history. Once a day the page builds a full JSON backup
 * (lib/backup/autoBackup.ts) and hands it here to be written to:
 *
 *   Documents/KamaiPlus/Backups/KamaiPlus_AutoBackup_<shop>_<YYYY-MM-DD>.json
 *
 * and, when the shop has picked one, a second folder (a pen drive, a Google Drive
 * folder...). A missing pen drive is reported, never an error that stops billing.
 * The newest KEEP_DAYS backups are kept in each folder; older auto backups are
 * deleted. Files are in the same format as "Export Full Backup", so the existing
 * "Restore Store Data" button restores them.
 */

const fs = require('fs');
const path = require('path');

const KEEP_DAYS = 30;
const PREFIX = 'KamaiPlus_AutoBackup_';
const SETTINGS_FILE = 'backup-settings.json';

function backupsDir(documentsRoot) {
  return path.join(documentsRoot, 'Backups');
}

function readSettings(userDataDir) {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(userDataDir, SETTINGS_FILE), 'utf8'));
    return { extraFolder: typeof s.extraFolder === 'string' && s.extraFolder ? s.extraFolder : null };
  } catch {
    return { extraFolder: null };
  }
}

function writeSettings(userDataDir, settings) {
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(path.join(userDataDir, SETTINGS_FILE), JSON.stringify(settings, null, 2), 'utf8');
}

function localDateKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function listAutoBackups(dir) {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.startsWith(PREFIX) && f.endsWith('.json'))
      .map((f) => {
        const full = path.join(dir, f);
        return { name: f, full, mtimeMs: fs.statSync(full).mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
  } catch {
    return [];
  }
}

function prune(dir) {
  for (const old of listAutoBackups(dir).slice(KEEP_DAYS)) {
    try {
      fs.unlinkSync(old.full);
    } catch {}
  }
}

/** Write to a temp name first, then rename — a power cut never leaves a half file as "today's backup". */
function writeAtomically(dir, fileName, json) {
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, fileName);
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, json, 'utf8');
  fs.renameSync(tmp, target);
  prune(dir);
  return target;
}

function safeShopName(name) {
  return String(name || 'Store').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'Store';
}

/** Writes today's backup (replacing an earlier one from today). Never throws. */
function writeBackup({ documentsRoot, userDataDir, json, shopName }) {
  if (typeof json !== 'string' || json.length < 20) return { ok: false, error: 'Nothing to back up.' };
  const fileName = `${PREFIX}${safeShopName(shopName)}_${localDateKey()}.json`;
  let mainPath;
  try {
    mainPath = writeAtomically(backupsDir(documentsRoot), fileName, json);
  } catch (err) {
    return { ok: false, error: `Backup could not be saved: ${err.message}` };
  }

  const { extraFolder } = readSettings(userDataDir);
  let extra = null;
  if (extraFolder) {
    if (!fs.existsSync(extraFolder)) {
      extra = { ok: false, error: 'The extra backup folder is not available (pen drive not connected?).' };
    } else {
      try {
        writeAtomically(extraFolder, fileName, json);
        extra = { ok: true };
      } catch (err) {
        extra = { ok: false, error: `Could not copy to the extra folder: ${err.message}` };
      }
    }
  }
  return { ok: true, path: mainPath, extra };
}

function getInfo({ documentsRoot, userDataDir }) {
  const dir = backupsDir(documentsRoot);
  const files = listAutoBackups(dir);
  const { extraFolder } = readSettings(userDataDir);
  return {
    folder: dir,
    extraFolder,
    extraFolderAvailable: extraFolder ? fs.existsSync(extraFolder) : null,
    count: files.length,
    keepDays: KEEP_DAYS,
    lastBackupAt: files[0] ? new Date(files[0].mtimeMs).toISOString() : null,
    today: localDateKey(),
    hasTodaysBackup: files.some((f) => f.name.endsWith(`_${localDateKey()}.json`)),
  };
}

function setExtraFolder(userDataDir, folder) {
  writeSettings(userDataDir, { extraFolder: folder || null });
}

module.exports = { writeBackup, getInfo, setExtraFolder, backupsDir, KEEP_DAYS, PREFIX };
