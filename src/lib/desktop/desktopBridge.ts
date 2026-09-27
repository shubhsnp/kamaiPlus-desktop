/**
 * Bridge to the Electron shell (exposed by `preload.js` as `window.kamaiDesktop`).
 * In a plain browser (e.g. `next dev` without Electron) it is absent, and callers
 * fall back to the browser's own print dialog.
 */

export type PaperFormat = 'a4' | 'thermal-80' | 'thermal-58';

export interface DesktopPrinter {
  name: string;
  displayName: string;
  isDefault: boolean;
}

export interface DesktopResult {
  ok: boolean;
  path?: string;
  error?: string;
}

/** Offline licence check result from `licence.js` in the Electron main process. */
export type LicenceStatus =
  | { state: 'active'; key: string; shopName: string; machineName: string; dev?: boolean }
  | { state: 'required'; machineName: string; reason?: string };

export type LicenceActivationResult =
  | { ok: true; status: LicenceStatus }
  | { ok: false; error: string };

/** Auto-update state from `updater.js` in the Electron main process. */
export interface UpdateStatus {
  enabled: boolean;
  readyVersion: string | null;
  beta?: boolean;
  currentVersion?: string;
  lastCheck?: { at: string; result: 'up-to-date' | 'downloading' | 'error'; version?: string; error?: string } | null;
}

/** Automatic local backup state from `backup.js` in the Electron main process. */
export interface BackupInfo {
  folder: string;
  extraFolder: string | null;
  extraFolderAvailable: boolean | null;
  count: number;
  keepDays: number;
  lastBackupAt: string | null;
  today: string;
  hasTodaysBackup: boolean;
}

export interface BackupWriteResult {
  ok: boolean;
  path?: string;
  error?: string;
  extra?: { ok: boolean; error?: string } | null;
}

export interface KamaiDesktopApi {
  isDesktop: true;
  printToPdf(opts: { html: string; fileName: string; folder: 'Invoices' | 'Reports' | 'Statements' }): Promise<DesktopResult>;
  /** paper 'label' (v4.71.0): a barcode-label page of pageSizeMm (one roll row). */
  print(opts: { html: string; paper: PaperFormat | 'label'; pageSizeMm?: { width: number; height: number }; deviceName?: string; silent?: boolean }): Promise<DesktopResult>;
  getPrinters(): Promise<DesktopPrinter[]>;
  openPath(path: string): Promise<DesktopResult>;
  showItemInFolder(path: string): Promise<DesktopResult>;
  getAppInfo(): Promise<{ version: string; documentsDir: string }>;
  getLicenceStatus(): Promise<LicenceStatus>;
  activateLicence(key: string): Promise<LicenceActivationResult>;
  /** Master-password recovery: is this the key of the licence activated on this PC? */
  verifyLicenceKey(key: string): Promise<{ ok: boolean; error?: string }>;
  logError(entry: { source: string; message: string; stack?: string; detail?: string }): Promise<{ ok: boolean }>;
  getErrorReport(): Promise<{ text: string; count: number }>;
  openLogFolder(): Promise<DesktopResult>;
  writeBackup(opts: { json: string; shopName: string }): Promise<BackupWriteResult>;
  getBackupInfo(): Promise<BackupInfo>;
  chooseBackupFolder(): Promise<BackupInfo>;
  clearBackupFolder(): Promise<BackupInfo>;
  getUpdateStatus(): Promise<UpdateStatus>;
  installUpdate(): Promise<DesktopResult>;
  checkForUpdates(): Promise<{ ok: boolean; status?: UpdateStatus; error?: string }>;
  setBetaUpdates(on: boolean): Promise<UpdateStatus>;
  /** Fires once a newer version has finished downloading. Returns an unsubscribe. */
  onUpdateReady(callback: (info: { version: string }) => void): () => void;
}

declare global {
  interface Window {
    kamaiDesktop?: KamaiDesktopApi;
  }
}

export function getDesktopApi(): KamaiDesktopApi | null {
  if (typeof window === 'undefined') return null;
  const api = window.kamaiDesktop;
  return api && api.isDesktop ? api : null;
}

export function isDesktopApp(): boolean {
  return getDesktopApi() !== null;
}
