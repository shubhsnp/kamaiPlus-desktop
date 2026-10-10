const { contextBridge, ipcRenderer } = require('electron');

// The only desktop capabilities the UI gets: printing, PDF export, opening
// files it saved, the licence check and auto-update. No Node.js access reaches the page.
contextBridge.exposeInMainWorld('kamaiDesktop', {
  isDesktop: true,
  printToPdf: (opts) => ipcRenderer.invoke('kp:print-to-pdf', opts),
  print: (opts) => ipcRenderer.invoke('kp:print', opts),
  getPrinters: () => ipcRenderer.invoke('kp:get-printers'),
  getPrinterStatus: () => ipcRenderer.invoke('kp:printer-status'),
  calibrateLabelPrinter: (name) => ipcRenderer.invoke('kp:calibrate-label-printer', name),
  openWhatsApp: (request) => ipcRenderer.invoke('kp:open-whatsapp', request),
  openPath: (target) => ipcRenderer.invoke('kp:open-path', target),
  showItemInFolder: (target) => ipcRenderer.invoke('kp:show-in-folder', target),
  copyFileToClipboard: (target) => ipcRenderer.invoke('kp:copy-file', target),
  getAppInfo: () => ipcRenderer.invoke('kp:app-info'),
  getLicenceStatus: () => ipcRenderer.invoke('kp:licence-status'),
  activateLicence: (key) => ipcRenderer.invoke('kp:licence-activate', key),
  refreshLicence: () => ipcRenderer.invoke('kp:licence-refresh'),
  onLicenceChanged: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('kp:licence-changed', listener);
    return () => ipcRenderer.removeListener('kp:licence-changed', listener);
  },
  verifyLicenceKey: (key) => ipcRenderer.invoke('kp:licence-verify-key', key),
  // v4.98.0 — health counts for the Admin Console, and the Admin's messages for this PC.
  reportHealth: (counts) => ipcRenderer.invoke('kp:report-health', counts),
  getAdminMessages: () => ipcRenderer.invoke('kp:admin-messages'),
  onAdminMessages: (callback) => {
    const listener = (_event, messages) => callback(messages);
    ipcRenderer.on('kp:admin-messages', listener);
    return () => ipcRenderer.removeListener('kp:admin-messages', listener);
  },
  // v4.105.0 — the Admin's remote control: features, mode, minimum version, commands.
  getAdminControl: () => ipcRenderer.invoke('kp:admin-control'),
  onAdminControl: (callback) => {
    const listener = (_event, control) => callback(control);
    ipcRenderer.on('kp:admin-control', listener);
    return () => ipcRenderer.removeListener('kp:admin-control', listener);
  },
  onAdminCommand: (callback) => {
    const listener = (_event, command) => callback(command);
    ipcRenderer.on('kp:admin-command', listener);
    return () => ipcRenderer.removeListener('kp:admin-command', listener);
  },
  adminCommandDone: (answer) => ipcRenderer.invoke('kp:admin-command-done', answer),
  googleSignIn: (opts) => ipcRenderer.invoke('kp:google-signin', opts),
  logError: (entry) => ipcRenderer.invoke('kp:log-error', entry),
  getErrorReport: () => ipcRenderer.invoke('kp:error-report'),
  openLogFolder: () => ipcRenderer.invoke('kp:open-logs'),
  writeBackup: (opts) => ipcRenderer.invoke('kp:backup-write', opts),
  getBackupInfo: () => ipcRenderer.invoke('kp:backup-info'),
  chooseBackupFolder: () => ipcRenderer.invoke('kp:backup-choose-folder'),
  clearBackupFolder: () => ipcRenderer.invoke('kp:backup-clear-folder'),
  getUpdateStatus: () => ipcRenderer.invoke('kp:update-status'),
  installUpdate: () => ipcRenderer.invoke('kp:update-install'),
  checkForUpdates: () => ipcRenderer.invoke('kp:update-check'),
  setBetaUpdates: (on) => ipcRenderer.invoke('kp:update-set-beta', on),
  onUpdateReady: (callback) => {
    const listener = (_event, info) => callback(info);
    ipcRenderer.on('kp:update-ready', listener);
    return () => ipcRenderer.removeListener('kp:update-ready', listener);
  },
});
