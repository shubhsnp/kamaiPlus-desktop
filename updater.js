/**
 * Auto-update — runs in the Electron MAIN process.
 *
 * The repo is private, so updates are served from Firebase Hosting
 * (https://kamaiplus-desktop.web.app/, see package.json → build.publish and
 * scripts/prepare_release.js). The installed app:
 *
 *   1. checks latest.yml a minute after launch and then every 4 hours,
 *   2. downloads a newer installer quietly in the background,
 *   3. tells the page (kp:update-ready) so it can offer "Restart & Update".
 *
 * It NEVER restarts on its own — a cashier may be in the middle of a bill. If the
 * shop ignores the banner, the update installs silently the next time the app is
 * closed. Shop data (IndexedDB) and licence.json live in the user-data folder,
 * which an update does not touch.
 *
 * Offline shops simply fail the check and try again later.
 */

const FIRST_CHECK_DELAY_MS = 60 * 1000;
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

let readyVersion = null;

function initAutoUpdate({ ipcMain, getWindow, enabled }) {
  ipcMain.handle('kp:update-status', async () => ({ enabled, readyVersion }));

  if (!enabled) {
    ipcMain.handle('kp:update-install', async () => ({ ok: false, error: 'Updates are off in development.' }));
    return;
  }

  // Loaded only in the packaged app, so `electron . --dev` never needs it.
  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = null;

  autoUpdater.on('update-downloaded', (info) => {
    readyVersion = info && info.version ? String(info.version) : 'new';
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send('kp:update-ready', { version: readyVersion });
  });
  autoUpdater.on('error', (err) => {
    console.warn('[update] check failed:', err && err.message ? err.message : err);
  });

  const check = () => {
    autoUpdater.checkForUpdates().catch(() => {});
  };
  setTimeout(check, FIRST_CHECK_DELAY_MS);
  setInterval(check, CHECK_INTERVAL_MS);

  ipcMain.handle('kp:update-install', async () => {
    if (!readyVersion) return { ok: false, error: 'No update is ready yet.' };
    // Silent install, then start the app again.
    setImmediate(() => autoUpdater.quitAndInstall(true, true));
    return { ok: true };
  });
}

module.exports = { initAutoUpdate };
