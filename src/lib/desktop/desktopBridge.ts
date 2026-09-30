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

/** A printer as Windows reports it (Get-Printer): driver, port, offline — v4.78.0. */
export interface DesktopPrinterStatus {
  name: string;
  driver: string;
  port: string;
  status: string;
  offline: boolean;
}

export interface DesktopResult {
  ok: boolean;
  path?: string;
  error?: string;
}

/** Offline licence check result from `licence.js` in the Electron main process. */
export type LicenceStatus =
  /** validUntil: the key's end date (ISO) or null = lifetime; daysLeft: whole days to go (v4.85.0). */
  | { state: 'active'; key: string; shopName: string; machineName: string; dev?: boolean; validUntil?: string | null; daysLeft?: number | null }
  | { state: 'required'; machineName: string; reason?: string }
  /** The key's end date has passed (v4.85.0) — renewed in the Admin Console, then "Check again". */
  | { state: 'expired'; key: string; shopName: string; machineName: string; validUntil: string };

/** Online check-in result (licence.js refresh). */
export type LicenceRefreshResult = { ok: boolean; offline?: boolean; stopped?: boolean; error?: string; status: LicenceStatus };

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

export type GoogleSignInResult =
  | { ok: true; idToken: string | null; email: string | null; name: string | null; picture: string | null; stub?: boolean }
  | { ok: false; error: string };

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
  /** null when Windows could not say (not Windows, PowerShell failed). */
  getPrinterStatus?(): Promise<DesktopPrinterStatus[] | null>;
  /** Sends the label printer's own gap calibration (v4.80.0); manual = unknown make, use the FEED button. */
  calibrateLabelPrinter?(name: string): Promise<{ ok: boolean; manual?: boolean; language?: string; error?: string }>;
  /** WhatsApp Desktop if installed, else wa.me; a too-long text is copied instead (v4.79.0). */
  openWhatsApp?(request: { phone: string; text: string }): Promise<{ ok: boolean; via: 'app' | 'web'; copied: boolean; error?: string }>;
  openPath(path: string): Promise<DesktopResult>;
  showItemInFolder(path: string): Promise<DesktopResult>;
  getAppInfo(): Promise<{ version: string; documentsDir: string }>;
  getLicenceStatus(): Promise<LicenceStatus>;
  activateLicence(key: string): Promise<LicenceActivationResult>;
  /** Check in with the licence server now (a renewed end date comes back). v4.85.0 — optional for older builds. */
  refreshLicence?(): Promise<LicenceRefreshResult>;
  /** The licence changed while the app is open (ended, blocked, renewed). */
  onLicenceChanged?(callback: (status: LicenceStatus) => void): () => void;
  /** Master-password recovery: is this the key of the licence activated on this PC? */
  verifyLicenceKey(key: string): Promise<{ ok: boolean; error?: string }>;
  /** Google sign-in in the shop's browser (googleSignIn.js). `stub` only in the Electron E2E. */
  googleSignIn(opts: { clientId: string; clientSecret: string }): Promise<GoogleSignInResult>;
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
