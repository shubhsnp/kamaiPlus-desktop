require('v8-compile-cache');
const { app, BrowserWindow, clipboard, dialog, ipcMain, net, Notification, protocol, shell } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const licence = require('./licence');
const { initAutoUpdate } = require('./updater');
const backup = require('./backup');
const errorlog = require('./errorlog');
const printers = require('./printers');
const whatsapp = require('./whatsapp');
const labelCalibrate = require('./labelCalibrate');
const googleSignIn = require('./googleSignIn');
const adminLink = require('./adminLink');

// Main-process failures are logged instead of vanishing (errorlog.js).
process.on('uncaughtException', (err) => {
  errorlog.logError({ source: 'main', message: err && err.message, stack: err && err.stack });
});
process.on('unhandledRejection', (reason) => {
  errorlog.logError({ source: 'main-promise', message: reason && reason.message ? reason.message : String(reason), stack: reason && reason.stack });
});

/**
 * KamaiPlus desktop shell.
 *
 * The UI is the static Next.js export in ./out, served from a private
 * `app://kamaiplus` origin (a fixed, secure origin keeps IndexedDB and
 * localStorage — i.e. the shop's data — stable across launches and updates).
 * `electron . --dev` loads the Next dev server instead.
 */

const SCHEME = 'app';
const HOST = 'kamaiplus';
const OUT_DIR = path.join(__dirname, 'out');
const DEV_URL = 'http://localhost:3000';
const hasExport = fs.existsSync(path.join(OUT_DIR, 'index.html'));
const isDevServer = process.argv.includes('--dev') || !hasExport;

// Electron end-to-end test (scripts/electron_e2e.mjs): keep the test's shop data,
// licence and backups in a throw-away folder, never the real ones. Unpackaged
// runs only — the installed app ignores this. The licence is still checked.
if (process.env.KAMAI_E2E_DIR && !app.isPackaged) {
  app.setPath('userData', path.join(process.env.KAMAI_E2E_DIR, 'userData'));
  app.setPath('documents', path.join(process.env.KAMAI_E2E_DIR, 'documents'));
}

// ── Performance: safe GPU rendering without buggy zero-copy driver deadlocks ──
app.commandLine.appendSwitch('enable-gpu-rasterization');

// A POS window partly covered by another app must keep rendering (Windows occlusion
// tracking otherwise pauses it, which also stalls hidden print jobs).
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

let mainWindow = null;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function resolveExportFile(urlPath) {
  const rel = decodeURIComponent(urlPath).replace(/^\/+/, '').replace(/\/+$/, '');
  const candidates = rel === '' ? ['index.html'] : [rel, `${rel}.html`, path.join(rel, 'index.html')];
  // Link prefetch asks for "khata/__next.khata.__PAGE__.txt"; the export stores
  // it as "khata/__next.khata/__PAGE__.txt" (one folder per route segment).
  const seg = path.basename(rel).match(/^__next\.(.+)\.txt$/);
  if (seg) {
    const parts = seg[1].split('.');
    if (parts.length > 1) candidates.push(path.join(path.dirname(rel), `__next.${parts[0]}`, ...parts.slice(1)) + '.txt');
  }
  for (const candidate of candidates) {
    const full = path.normalize(path.join(OUT_DIR, candidate));
    if (!full.startsWith(OUT_DIR)) continue;
    try {
      if (fs.statSync(full).isFile()) return full;
    } catch {}
  }
  const notFound = path.join(OUT_DIR, '404.html');
  return fs.existsSync(notFound) ? notFound : path.join(OUT_DIR, 'index.html');
}

function registerAppProtocol() {
  protocol.handle(SCHEME, async (request) => {
    try {
      const { pathname, searchParams } = new URL(request.url);
      const filePath = resolveExportFile(pathname);
      const ext = path.extname(filePath).toLowerCase();
      // Page changes fetch the next page's RSC payload (out/<route>.txt). Next.js
      // accepts it only as text/x-component; anything else makes it reload the
      // whole app on every sidebar click (the black "blink" between pages).
      const isRscRequest = searchParams.has('_rsc') || request.headers.get('rsc') === '1';
      if (isRscRequest && ext !== '.txt') {
        // No payload for this route: a clean 404 lets Next.js fall back to a normal load.
        return new Response('Not Found', { status: 404 });
      }
      const mime = isRscRequest ? 'text/x-component' : MIME_TYPES[ext] || 'application/octet-stream';
      const data = await fs.promises.readFile(filePath);
      return new Response(data, {
        headers: {
          'content-type': mime,
          // Pages and payloads change with every update; hashed chunks never do.
          'cache-control': ext === '.html' || ext === '.txt' ? 'no-cache' : 'public, max-age=31536000, immutable',
        },
      });
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  });
}

function appOrigin() {
  return isDevServer ? DEV_URL : `${SCHEME}://${HOST}`;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: '#f8fafc',
    title: 'KamaiPlus Desktop',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
    // Warm up the hidden print window safely after initial UI has settled (15s),
    // so it never competes with initial rendering or blocks clicks.
    setTimeout(() => {
      enqueuePrintJob(async () => {
        try {
          const win = getPrintWindow();
          await withTimeout(win.loadURL('about:blank'), 10000);
          await withTimeout(win.webContents.printToPDF({}), 15000); // initialises the PDF engine; output discarded
        } catch {
          resetPrintWindow();
        }
      }).catch(() => {});
    }, 15000);
  });

  // Links to the web (help pages, UPI apps, etc.) open in the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(appOrigin())) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });

  // A crashed or frozen page must at least leave a trace (and come back if it crashed).
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    errorlog.logError({ source: 'renderer-crash', message: `Page process gone: ${details.reason}`, detail: `exitCode ${details.exitCode}` });
    if (details.reason !== 'clean-exit' && mainWindow && !mainWindow.isDestroyed()) mainWindow.reload();
  });
  mainWindow.on('unresponsive', () => {
    errorlog.logError({ source: 'renderer-hang', message: 'The window stopped responding.' });
  });

  mainWindow.loadURL(isDevServer ? DEV_URL : `${appOrigin()}/`);
  mainWindow.on('closed', () => {
    mainWindow = null;
    // The hidden print window must not keep the app alive after the shop closes it.
    if (printWindow && !printWindow.isDestroyed()) printWindow.destroy();
    printWindow = null;
  });
}

// ---------------------------------------------------------------------------
// Printing & PDF (invoices, statements, reports)
// ---------------------------------------------------------------------------

const MICRONS_PER_PX = 264.5833;

function documentsRoot() {
  return path.join(app.getPath('documents'), 'KamaiPlus');
}

// One hidden window, reused for every print / PDF job. Creating a fresh renderer
// per job cost ~5 s on the first bill of the day; jobs run one at a time.
let printWindow = null;
let printQueue = Promise.resolve();

function getPrintWindow() {
  if (!printWindow || printWindow.isDestroyed()) {
    printWindow = new BrowserWindow({
      show: false,
      width: 900,
      height: 1200,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
    });
  }
  return printWindow;
}

function resetPrintWindow() {
  if (printWindow && !printWindow.isDestroyed()) printWindow.destroy();
  printWindow = null;
}

function enqueuePrintJob(job) {
  const run = printQueue.then(job, job);
  printQueue = run.catch(() => {});
  return run;
}

class StepTimeout extends Error {}

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new StepTimeout('timeout')), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * Runs a print / PDF step on the shared window. A step that never answers must
 * not block every later bill: the window is recreated and the step retried once.
 */
async function withPrintRecovery(step) {
  try {
    return await step();
  } catch (err) {
    if (!(err instanceof StepTimeout)) throw err;
    resetPrintWindow();
    try {
      return await step();
    } catch (retryErr) {
      if (retryErr instanceof StepTimeout) {
        resetPrintWindow();
        throw new Error('The print / PDF engine did not respond. Please try again.');
      }
      throw retryErr;
    }
  }
}

async function loadHtmlOffscreen(html) {
  const tmpFile = path.join(os.tmpdir(), `kamaiplus-print-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
  fs.writeFileSync(tmpFile, html, 'utf8');
  const win = getPrintWindow();
  try {
    await withTimeout(win.loadFile(tmpFile), 15000);
    // Let embedded data-URL images decode before the page is captured.
    await withTimeout(
      win.webContents.executeJavaScript(
        'Promise.all(Array.from(document.images).map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))).then(() => document.fonts ? document.fonts.ready : 0).then(() => true)'
      ),
      10000
    );
  } catch (err) {
    fs.unlink(tmpFile, () => {});
    throw err;
  }
  const cleanup = () => {
    fs.unlink(tmpFile, () => {});
  };
  return { win, cleanup };
}

async function thermalPageSize(win, widthMm) {
  const heightPx = await win.webContents.executeJavaScript('Math.ceil(document.documentElement.scrollHeight)');
  const widthMicrons = widthMm * 1000;
  const heightMicrons = Math.max(80000, Math.ceil(heightPx * MICRONS_PER_PX) + 8000);
  return { width: widthMicrons, height: heightMicrons };
}

ipcMain.handle('kp:print-to-pdf', (_event, opts) => enqueuePrintJob(() => printToPdfJob(opts)));

async function printToPdfJob(opts) {
  const { html, fileName, folder } = opts || {};
  if (typeof html !== 'string' || !html) return { ok: false, error: 'Nothing to save.' };
  const safeFolder = ['Invoices', 'Reports', 'Statements'].includes(folder) ? folder : 'Invoices';
  const safeName = String(fileName || 'document.pdf').replace(/[^A-Za-z0-9_.-]+/g, '_');
  let job;
  try {
    const pdf = await withPrintRecovery(async () => {
      if (job) job.cleanup();
      job = await loadHtmlOffscreen(html);
      return withTimeout(
        job.win.webContents.printToPDF({
          pageSize: 'A4',
          printBackground: true,
          preferCSSPageSize: true,
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
        }),
        20000
      );
    });
    const dir = path.join(documentsRoot(), safeFolder);
    fs.mkdirSync(dir, { recursive: true });
    const target = path.join(dir, safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf`);
    fs.writeFileSync(target, pdf);
    return { ok: true, path: target };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : 'PDF could not be created.' };
  } finally {
    if (job) job.cleanup();
  }
}

ipcMain.handle('kp:print', (_event, opts) => enqueuePrintJob(() => printJob(opts)));

/**
 * Barcode labels (v4.71.0): the page is one row of a label roll, sized in mm by the
 * page (e.g. 50 × 25). Anything outside 10–300 mm is refused rather than printed.
 */
function labelPageSize(pageSizeMm) {
  const w = Number(pageSizeMm && pageSizeMm.width);
  const h = Number(pageSizeMm && pageSizeMm.height);
  if (!(w >= 10 && w <= 300 && h >= 10 && h <= 300)) return null;
  return { width: Math.round(w * 1000), height: Math.round(h * 1000) };
}

async function printJob(opts) {
  const { html, paper, deviceName, silent, pageSizeMm } = opts || {};
  if (typeof html !== 'string' || !html) return { ok: false, error: 'Nothing to print.' };
  const labelSize = paper === 'label' ? labelPageSize(pageSizeMm) : null;
  if (paper === 'label' && !labelSize) return { ok: false, error: 'Label size is not valid.' };
  let job;
  try {
    job = await withPrintRecovery(() => loadHtmlOffscreen(html));
    const pageSize = labelSize
      || (paper === 'thermal-80' || paper === 'thermal-58'
        ? await thermalPageSize(job.win, paper === 'thermal-80' ? 80 : 58)
        : 'A4');
    const result = await new Promise((resolve) => {
      job.win.webContents.print(
        {
          silent: Boolean(silent),
          deviceName: deviceName || undefined,
          printBackground: true,
          margins: { marginType: 'none' },
          pageSize,
        },
        (success, failureReason) => resolve({ ok: success, error: success ? undefined : failureReason })
      );
    });
    return result;
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : 'Printing failed.' };
  } finally {
    if (job) job.cleanup();
  }
}

ipcMain.handle('kp:get-printers', async () => {
  if (!mainWindow) return [];
  try {
    const printers = await mainWindow.webContents.getPrintersAsync();
    return printers.map((p) => ({ name: p.name, displayName: p.displayName || p.name, isDefault: Boolean(p.isDefault) }));
  } catch {
    return [];
  }
});

// Driver, port and offline state from Windows (printers.js) — printer auto-detect (v4.78.0).
ipcMain.handle('kp:printer-status', async () => printers.getPrinterStatus());

// "Calibrate printer" for a label printer (labelCalibrate.js) — v4.80.0. Only a printer name comes in;
// the command is picked from a fixed list by the printer's make.
ipcMain.handle('kp:calibrate-label-printer', async (_event, name) => labelCalibrate.calibrate(printers, String(name || '')));

// WhatsApp Desktop when installed, else wa.me in the browser (whatsapp.js) — v4.79.0.
ipcMain.handle('kp:open-whatsapp', async (_event, request) => whatsapp.openWhatsApp({ shell, app, clipboard }, request));

function insideDocuments(target) {
  const full = path.normalize(String(target || ''));
  return full.startsWith(documentsRoot());
}

ipcMain.handle('kp:open-path', async (_event, target) => {
  if (!insideDocuments(target)) return { ok: false, error: 'Path not allowed.' };
  const error = await shell.openPath(path.normalize(target));
  return error ? { ok: false, error } : { ok: true };
});

ipcMain.handle('kp:show-in-folder', async (_event, target) => {
  if (!insideDocuments(target)) return { ok: false, error: 'Path not allowed.' };
  shell.showItemInFolder(path.normalize(target));
  return { ok: true };
});

ipcMain.handle('kp:app-info', async () => ({ version: app.getVersion(), documentsDir: documentsRoot() }));

// ---------------------------------------------------------------------------
// Licence (one-time purchase, one key = one computer) — see licence.js
// ---------------------------------------------------------------------------

ipcMain.handle('kp:licence-status', async () =>
  licence.getStatus({ userDataDir: app.getPath('userData'), dev: isDevServer })
);

// Online check-in (v4.85.0): a fresh licence with the key's end date; a key blocked or moved
// in the Admin Console stops the app. Offline: nothing changes. See licence.js refresh().
// v4.98.0: it carries this PC's health (counts only) and brings the Admin's messages back
// (adminLink.js); new messages go to the page at once.
const licenceRefresh = async () => {
  const userDataDir = app.getPath('userData');
  let health = null;
  let report = null;
  try {
    health = adminLink.buildHealth({ userDataDir, backupInfo: backup.getInfo(backupPaths()), errors: errorlog.readRecent(1000) });
  } catch {
    health = null;
  }
  // v4.105.0: features, update state, commands run, and the error report when the Admin asked.
  try {
    const licenceStatus = licence.getStatus({ userDataDir, dev: isDevServer });
    const licenceText = licenceStatus.state === 'active' ? `${licenceStatus.key || 'dev'} (${licenceStatus.shopName || 'no shop name'})` : 'not activated';
    report = adminLink.buildReport({
      userDataDir,
      updateStatus: updaterApi ? updaterApi.status() : null,
      errorReportText: errorlog.buildReport({ appVersion: app.getVersion(), licence: licenceText }),
    });
  } catch {
    report = null;
  }
  const res = await licence.refresh({ userDataDir, appVersion: app.getVersion(), fetchImpl: (url, opts) => net.fetch(url, opts), health, report });
  if (res.ok && report && report.commands_done) {
    try {
      adminLink.clearSentResults(userDataDir, report.commands_done.map((r) => r.id));
    } catch {}
  } else if (res.ok && report && report.error_report) {
    try {
      adminLink.clearSentResults(userDataDir, []);
    } catch {}
  }
  if (res.ok && res.messages !== undefined) {
    let changed = false;
    try {
      changed = adminLink.saveMessages(userDataDir, res.messages);
    } catch {
      changed = false;
    }
    if (changed && mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('kp:admin-messages', adminLink.readMessages(userDataDir));
    if (changed) notifyNewMessages(adminLink.readMessages(userDataDir));
  }
  if (res.ok && res.control !== undefined) {
    let changed = false;
    try {
      changed = adminLink.saveControl(userDataDir, res.control);
    } catch {
      changed = false;
    }
    if (changed) sendToPage('kp:admin-control', adminControlForPage());
    void runAdminCommands();
  }
  return res;
};

// ---------------------------------------------------------------------------
// Remote control (v4.105.0) — adminLink.js "Remote control". The Admin Console can force
// features, put the PC in read-only / locked mode, ask for a minimum version, change the
// check-in interval and send one-off commands. Restart and install wait for an idle counter.
// ---------------------------------------------------------------------------

let updaterApi = null;
const sendToPage = (channel, payload) => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
};
const adminControlForPage = () => ({ ...adminLink.readControl(app.getPath('userData')), appVersion: app.getVersion() });

ipcMain.handle('kp:admin-control', async () => adminControlForPage());

// Windows notification for a new urgent or pop-up message (once per message, per app run).
const notifiedMessages = new Set();
function notifyNewMessages(messages) {
  for (const m of messages || []) {
    if (notifiedMessages.has(m.id) || !(m.level === 'urgent' || m.style === 'popup')) continue;
    notifiedMessages.add(m.id);
    try {
      if (Notification.isSupported()) new Notification({ title: 'KamaiPlus', body: String(m.text).slice(0, 220) }).show();
    } catch {}
  }
}

// The page does what only it can (a backup of the shop data; "is a bill open?").
const pageWaiters = new Map();
function askPage(type, timeoutMs) {
  return new Promise((resolve) => {
    if (!mainWindow || mainWindow.isDestroyed()) return resolve({ noAnswer: true });
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const timer = setTimeout(() => {
      pageWaiters.delete(id);
      resolve({ noAnswer: true });
    }, timeoutMs);
    pageWaiters.set(id, (answer) => {
      clearTimeout(timer);
      resolve(answer);
    });
    mainWindow.webContents.send('kp:admin-command', { id, type });
  });
}
ipcMain.handle('kp:admin-command-done', async (_event, answer) => {
  const waiter = answer && pageWaiters.get(answer.id);
  if (waiter) {
    pageWaiters.delete(answer.id);
    waiter({ ok: Boolean(answer.ok), note: String(answer.note || '').slice(0, 200) });
  }
  return true;
});

const RETRY_FOR_MS = 24 * 60 * 60 * 1000;

/** One command → { ok, note } (recorded), or { retry } (the counter is busy: try again later). */
async function runAdminCommand(cmd) {
  const stale = cmd.at && Date.now() - Date.parse(cmd.at) > RETRY_FOR_MS;
  const idleOrRetry = async () => {
    const idle = await askPage('idle_check', 15000);
    if (idle.ok) return null;
    return stale ? { ok: false, note: 'A bill was open for 24 hours — not done' } : { retry: true };
  };
  switch (cmd.type) {
    case 'check_update': {
      if (!updaterApi || !updaterApi.status().enabled) return { ok: false, note: 'Updates are off on this computer' };
      const st = await updaterApi.check();
      const lc = st.lastCheck || {};
      return { ok: lc.result !== 'error', note: lc.result === 'error' ? `Error: ${lc.error || ''}` : `${lc.result || 'checked'}${lc.version ? ` ${lc.version}` : ''}` };
    }
    case 'install_update': {
      if (!updaterApi || !updaterApi.status().enabled) return { ok: false, note: 'Updates are off on this computer' };
      if (!updaterApi.status().readyVersion) {
        await updaterApi.check();
        if (!updaterApi.status().readyVersion) return stale ? { ok: false, note: 'No update downloaded in 24 hours' } : { retry: true };
      }
      const busy = await idleOrRetry();
      if (busy) return busy;
      const version = updaterApi.status().readyVersion;
      return { ok: true, note: `Installing ${version}`, after: () => updaterApi.install() };
    }
    case 'backup_now': {
      const r = await askPage('backup_now', 120000);
      if (r.noAnswer) return stale ? { ok: false, note: 'The app did not answer' } : { retry: true };
      return r;
    }
    case 'send_report':
      return { ok: true, note: `Error report sent (${errorlog.readRecent(1000).length} entries)`, sendReport: true, after: () => scheduleCheckIn(5000) };
    case 'restart_app': {
      const busy = await idleOrRetry();
      if (busy) return busy;
      return { ok: true, note: 'Restarted', after: () => setTimeout(() => { app.relaunch(); app.exit(0); }, 1500) };
    }
    default:
      return { ok: false, note: 'Unknown command' };
  }
}

let commandsRunning = false;
async function runAdminCommands() {
  if (commandsRunning) return;
  commandsRunning = true;
  const userDataDir = app.getPath('userData');
  try {
    for (const cmd of adminLink.pendingCommands(userDataDir, adminLink.readControl(userDataDir))) {
      let res;
      try {
        res = await runAdminCommand(cmd);
      } catch (err) {
        res = { ok: false, note: (err && err.message) || 'Failed' };
      }
      if (res.retry) continue;
      adminLink.recordCommand(userDataDir, cmd.id, res.ok, res.note, { sendReport: res.sendReport });
      if (res.after) res.after();
    }
  } finally {
    commandsRunning = false;
  }
}

let scheduledCheckIn = null;
function scheduleCheckIn(ms) {
  if (!app.isPackaged || isDevServer || scheduledCheckIn) return;
  scheduledCheckIn = setTimeout(() => {
    scheduledCheckIn = null;
    void licenceRefresh().catch(() => {});
  }, ms);
}

// The page's counts for the health report (v4.98.0) — kept for the next check-in.
ipcMain.handle('kp:report-health', async (_event, counts) => {
  try {
    adminLink.saveCounts(app.getPath('userData'), counts);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('kp:admin-messages', async () => adminLink.readMessages(app.getPath('userData')));

// "Check again" on the licence-ended screen (after the shop renews).
ipcMain.handle('kp:licence-refresh', async () => {
  const res = await licenceRefresh();
  return { ...res, status: res.status || licence.getStatus({ userDataDir: app.getPath('userData'), dev: isDevServer }) };
});

// v4.105.0: every 5 min (was 30): the end date can pass while the app is open, and a command
// waiting for an idle counter is tried again.
const LICENCE_TICK_MS = 5 * 60 * 1000;
// v4.98.0: hourly (was 6 h). v4.105.0: the Admin can set 15 min … 6 h (control.checkin_minutes).
const LICENCE_CHECKIN_MS = 60 * 60 * 1000;
const checkInEveryMs = () => {
  const minutes = adminLink.readControl(app.getPath('userData')).checkin_minutes;
  return minutes ? minutes * 60 * 1000 : LICENCE_CHECKIN_MS;
};

/** What the page shows about the licence: a change in any of it (a renewal too) is sent. */
const licenceShown = (s) => JSON.stringify([s.state, s.validUntil || null, s.daysLeft ?? null, s.reason || null]);

/** Every 30 min: re-check the licence (and every hour, online, check in); tell the page on a change. */
function startLicenceWatch() {
  if (isDevServer) return;
  let lastShown = licenceShown(licence.getStatus({ userDataDir: app.getPath('userData'), dev: false }));
  let lastCheckIn = 0;
  const tick = async () => {
    // Installed app only: a test or source run never calls the licence server on its own.
    if (app.isPackaged && Date.now() - lastCheckIn >= checkInEveryMs()) {
      lastCheckIn = Date.now();
      await licenceRefresh().catch(() => {});
    } else {
      void runAdminCommands();
    }
    const status = licence.getStatus({ userDataDir: app.getPath('userData'), dev: false });
    // v4.98.0: a renewal or a new day also counts (it was only "active" ↔ "ended").
    const shown = licenceShown(status);
    if (shown !== lastShown && mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('kp:licence-changed', status);
    lastShown = shown;
  };
  setTimeout(() => { void tick(); }, 60 * 1000);
  setInterval(() => { void tick(); }, LICENCE_TICK_MS);
}

// ---------------------------------------------------------------------------
// Error log & support report — see errorlog.js
// ---------------------------------------------------------------------------

ipcMain.handle('kp:log-error', async (_event, entry) => {
  errorlog.logError({ source: `page:${String((entry && entry.source) || 'error').slice(0, 30)}`, message: entry && entry.message, stack: entry && entry.stack, detail: entry && entry.detail });
  return { ok: true };
});

ipcMain.handle('kp:error-report', async () => {
  const status = licence.getStatus({ userDataDir: app.getPath('userData'), dev: isDevServer });
  const licenceText = status.state === 'active' ? `${status.key || 'dev'} (${status.shopName || 'no shop name'})` : 'not activated';
  return { text: errorlog.buildReport({ appVersion: app.getVersion(), licence: licenceText }), count: errorlog.readRecent(1000).length };
});

ipcMain.handle('kp:open-logs', async () => {
  const dir = errorlog.logDirPath();
  if (!dir) return { ok: false, error: 'Log folder not ready.' };
  fs.mkdirSync(dir, { recursive: true });
  const error = await shell.openPath(dir);
  return error ? { ok: false, error } : { ok: true };
});

// ---------------------------------------------------------------------------
// Automatic local backup — see backup.js
// ---------------------------------------------------------------------------

const backupPaths = () => ({ documentsRoot: documentsRoot(), userDataDir: app.getPath('userData') });

ipcMain.handle('kp:backup-write', async (_event, opts) =>
  backup.writeBackup({ ...backupPaths(), json: opts && opts.json, shopName: opts && opts.shopName })
);

ipcMain.handle('kp:backup-info', async () => backup.getInfo(backupPaths()));

ipcMain.handle('kp:backup-choose-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose a folder for an extra backup copy (pen drive, Google Drive folder...)',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (!result.canceled && result.filePaths[0]) backup.setExtraFolder(app.getPath('userData'), result.filePaths[0]);
  return backup.getInfo(backupPaths());
});

ipcMain.handle('kp:backup-clear-folder', async () => {
  backup.setExtraFolder(app.getPath('userData'), null);
  return backup.getInfo(backupPaths());
});

// Master-password recovery: the shop proves ownership with this PC's licence key.
ipcMain.handle('kp:licence-verify-key', async (_event, key) =>
  licence.verifyOwnKey({ userDataDir: app.getPath('userData'), key })
);

ipcMain.handle('kp:licence-activate', async (_event, key) =>
  licence.activate({
    userDataDir: app.getPath('userData'),
    key,
    appVersion: app.getVersion(),
    fetchImpl: (url, opts) => net.fetch(url, opts),
  })
);

// Google sign-in (googleSignIn.js): the shop's browser, answer on 127.0.0.1, PKCE.
// The Electron E2E cannot sign in to Google; only an unpackaged test run gets a stand-in
// (an installed app is always packaged, whatever its environment says).
ipcMain.handle('kp:google-signin', async (_event, opts) => {
  if (process.env.KAMAI_E2E_GOOGLE_STUB === '1' && !app.isPackaged) {
    return { ok: true, stub: true, idToken: null, email: 'e2e.owner@example.com', name: 'E2E Owner', picture: null };
  }
  const result = await googleSignIn.signIn({
    shell,
    clientId: String(opts?.clientId || ''),
    clientSecret: String(opts?.clientSecret || ''),
    fetchImpl: (url, init) => net.fetch(url, init),
  });
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
  return result;
});

// ---------------------------------------------------------------------------
// Lifecycle — one instance only, so two windows never fight over the local database.
// ---------------------------------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    errorlog.init(app.getPath('userData'));
    if (!isDevServer) registerAppProtocol();
    createWindow();
    updaterApi = initAutoUpdate({
      ipcMain,
      getWindow: () => mainWindow,
      enabled: app.isPackaged && !isDevServer,
      userDataDir: app.getPath('userData'),
      currentVersion: app.getVersion(),
    });
    startLicenceWatch();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
