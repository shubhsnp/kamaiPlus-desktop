const { contextBridge, ipcRenderer } = require('electron');

// The only desktop capabilities the UI gets: printing, PDF export, opening
// files it saved, and the licence check. No Node.js access reaches the page.
contextBridge.exposeInMainWorld('kamaiDesktop', {
  isDesktop: true,
  printToPdf: (opts) => ipcRenderer.invoke('kp:print-to-pdf', opts),
  print: (opts) => ipcRenderer.invoke('kp:print', opts),
  getPrinters: () => ipcRenderer.invoke('kp:get-printers'),
  openPath: (target) => ipcRenderer.invoke('kp:open-path', target),
  showItemInFolder: (target) => ipcRenderer.invoke('kp:show-in-folder', target),
  getAppInfo: () => ipcRenderer.invoke('kp:app-info'),
  getLicenceStatus: () => ipcRenderer.invoke('kp:licence-status'),
  activateLicence: (key) => ipcRenderer.invoke('kp:licence-activate', key),
});
