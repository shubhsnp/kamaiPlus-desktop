require('v8-compile-cache');
const { app, BrowserWindow, ipcMain, net, protocol, shell } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const licence = require('./licence');
const { initAutoUpdate } = require('./updater');

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
      const { pathname } = new URL(request.url);
      const filePath = resolveExportFile(pathname);
      const ext = path.extname(filePath).toLowerCase();
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      const data = await fs.promises.readFile(filePath);
      return new Response(data, {
        headers: {
          'content-type': mime,
          'cache-control': 'public, max-age=31536000, immutable',
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

async function printJob(opts) {
  const { html, paper, deviceName, silent } = opts || {};
  if (typeof html !== 'string' || !html) return { ok: false, error: 'Nothing to print.' };
  let job;
  try {
    job = await withPrintRecovery(() => loadHtmlOffscreen(html));
    const pageSize = paper === 'thermal-80' || paper === 'thermal-58'
      ? await thermalPageSize(job.win, paper === 'thermal-80' ? 80 : 58)
      : 'A4';
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

ipcMain.handle('kp:licence-activate', async (_event, key) =>
  licence.activate({
    userDataDir: app.getPath('userData'),
    key,
    appVersion: app.getVersion(),
    fetchImpl: (url, opts) => net.fetch(url, opts),
  })
);

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
    if (!isDevServer) registerAppProtocol();
    createWindow();
    initAutoUpdate({ ipcMain, getWindow: () => mainWindow, enabled: app.isPackaged && !isDevServer });
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
