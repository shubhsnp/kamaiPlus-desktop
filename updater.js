/**
 * Auto-update — runs in the Electron MAIN process.
 *
 * The repo is private, so updates are served from Firebase Hosting
 * (https://kamaiplus-desktop.web.app/, see package.json → build.publish and
 * scripts/prepare_release.js). The installed app:
 *
 *   1. checks a minute after launch and then every 4 hours (or when the shop
 *      clicks "Check for updates now"),
 *   2. downloads a newer installer quietly in the background,
 *   3. tells the page (kp:update-ready) so it can offer "Restart & Update".
 *
 * Channels (staged rollout): a computer with "early updates (beta)" switched on
 * reads beta.yml, everyone else reads latest.yml. A new version is published to
 * beta first (`npm run release:beta`), tried on a few shops, then promoted with
 * the SAME installer (`npm run release:promote`). The choice is per computer, in
 * <userData>/update-settings.json.
 *
 * It NEVER restarts on its own — a cashier may be in the middle of a bill. If the
 * shop ignores the banner, the update installs silently the next time the app is
 * closed. Shop data (IndexedDB) and licence.json live in the user-data folder,
 * which an update does not touch. Offline shops simply fail the check and retry.
 */

const fs = require('fs');
const path = require('path');

const FIRST_CHECK_DELAY_MS = 60 * 1000;
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
const SETTINGS_FILE = 'update-settings.json';

let readyVersion = null;
let lastCheck = null; // { at, result: 'up-to-date' | 'downloading' | 'error', version?, error? }

function readBeta(userDataDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(userDataDir, SETTINGS_FILE), 'utf8')).beta === true;
  } catch {
    return false;
  }
}

function writeBeta(userDataDir, beta) {
  try {
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.writeFileSync(path.join(userDataDir, SETTINGS_FILE), JSON.stringify({ beta: Boolean(beta) }, null, 2), 'utf8');
  } catch {}
}

function initAutoUpdate({ ipcMain, getWindow, enabled, userDataDir, currentVersion }) {
  let beta = readBeta(userDataDir);
  const status = () => ({ enabled, readyVersion, beta, currentVersion, lastCheck });

  ipcMain.handle('kp:update-status', async () => status());

  if (!enabled) {
    ipcMain.handle('kp:update-install', async () => ({ ok: false, error: 'Updates are off in development.' }));
    ipcMain.handle('kp:update-check', async () => ({ ok: false, error: 'Updates are off in development.' }));
    ipcMain.handle('kp:update-set-beta', async (_e, on) => {
      beta = Boolean(on);
      writeBeta(userDataDir, beta);
      return status();
    });
    return;
  }

  // Loaded only in the packaged app, so `electron . --dev` never needs it.
  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = null;

  const applyChannel = () => {
    autoUpdater.channel = beta ? 'beta' : 'latest';
    // Setting a channel turns downgrades ON in electron-updater. Leaving beta must
    // never roll a shop back to an older build, so switch it off again.
    autoUpdater.allowDowngrade = false;
  };
  applyChannel();

  autoUpdater.on('update-downloaded', (info) => {
    readyVersion = info && info.version ? String(info.version) : 'new';
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send('kp:update-ready', { version: readyVersion });
  });
  autoUpdater.on('error', (err) => {
    lastCheck = { at: new Date().toISOString(), result: 'error', error: err && err.message ? String(err.message).slice(0, 200) : 'Update check failed' };
  });

  const check = async () => {
    try {
      const res = await autoUpdater.checkForUpdates();
      const available = res && res.isUpdateAvailable !== undefined ? res.isUpdateAvailable : Boolean(res && res.updateInfo && res.updateInfo.version !== currentVersion);
      lastCheck = {
        at: new Date().toISOString(),
        result: available ? 'downloading' : 'up-to-date',
        version: res && res.updateInfo ? String(res.updateInfo.version) : undefined,
      };
    } catch (err) {
      lastCheck = { at: new Date().toISOString(), result: 'error', error: err && err.message ? String(err.message).slice(0, 200) : 'Update check failed' };
    }
    return status();
  };
  setTimeout(check, FIRST_CHECK_DELAY_MS);
  setInterval(check, CHECK_INTERVAL_MS);

  ipcMain.handle('kp:update-check', async () => ({ ok: true, status: await check() }));

  ipcMain.handle('kp:update-set-beta', async (_e, on) => {
    beta = Boolean(on);
    writeBeta(userDataDir, beta);
    applyChannel();
    await check();
    return status();
  });

  ipcMain.handle('kp:update-install', async () => {
    if (!readyVersion) return { ok: false, error: 'No update is ready yet.' };
    // Silent install, then start the app again.
    setImmediate(() => autoUpdater.quitAndInstall(true, true));
    return { ok: true };
  });
}

module.exports = { initAutoUpdate, readBeta, writeBeta };
