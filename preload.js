const { contextBridge, ipcRenderer } = require('electron');

// The only desktop capabilities the UI gets: printing, PDF export, opening
// files it saved, the licence check and auto-update. No Node.js access reaches the page.
contextBridge.exposeInMainWorld('kamaiDesktop', {
  isDesktop: true,
  printToPdf: (opts) => ipcRenderer.invoke('kp:print-to-pdf', opts),
  print: (opts) => ipcRenderer.invoke('kp:print', opts),
  getPrinters: () => ipcRenderer.invoke('kp:get-printers'),
  getPrinterStatus: () => ipcRenderer.invoke('kp:printer-status'),
  openPath: (target) => ipcRenderer.invoke('kp:open-path', target),
  showItemInFolder: (target) => ipcRenderer.invoke('kp:show-in-folder', target),
  getAppInfo: () => ipcRenderer.invoke('kp:app-info'),
  getLicenceStatus: () => ipcRenderer.invoke('kp:licence-status'),
  activateLicence: (key) => ipcRenderer.invoke('kp:licence-activate', key),
  verifyLicenceKey: (key) => ipcRenderer.invoke('kp:licence-verify-key', key),
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
