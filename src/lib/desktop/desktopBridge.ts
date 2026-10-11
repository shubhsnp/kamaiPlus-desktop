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
  | { state: 'active'; key: string; shopName: string; machineName: string; dev?: boolean; validUntil?: string | null; daysLeft?: number | null; trial?: boolean }
  | { state: 'required'; machineName: string; reason?: string }
  /** The key's end date has passed (v4.85.0) — renewed in the Admin Console, then "Check again". */
  | { state: 'expired'; key: string; shopName: string; machineName: string; validUntil: string; trial?: boolean };

/** v4.148.0: is a free trial offered to this computer (desktopLicence "trial_info")? */
export type TrialInfo = { available: boolean; days: number; used: boolean; endsAt: string | null } | { offline: true } | { error: string };

/** Online check-in result (licence.js refresh). */
export type LicenceRefreshResult = { ok: boolean; offline?: boolean; stopped?: boolean; error?: string; status: LicenceStatus };

export type LicenceActivationResult =
  | { ok: true; status: LicenceStatus }
  | { ok: false; error: string };

/** Counts only — what the Admin Console sees about this shop (adminLink.js, v4.98.0). */
export interface ShopCounts {
  bills_today: number;
  bills_7d: number;
  products: number;
  customers: number;
  last_bill_at: string | null;
  cloud_sync: boolean;
  /** v4.105.0: the feature switches as they are now, for the Admin Console. */
  features?: Record<string, boolean>;
}

/** A message from the Admin Console: for this key ('key') or every Desktop ('all'). */
export interface AdminMessage {
  id: string;
  scope: 'key' | 'all';
  text: string;
  level: 'info' | 'warning' | 'urgent';
  until: string | null;
  /** v4.105.0: 'popup' opens a window once (and a Windows notification); default = a strip. */
  style?: 'popup';
  /** v4.105.0: one https link (a page, or a wa.me chat) with its button text. */
  link?: string;
  link_label?: string;
}

/** The Admin Console's remote control for this PC (v4.105.0, adminLink.js "Remote control"). */
export interface AdminControl {
  mode: 'normal' | 'read_only' | 'locked';
  mode_reason?: string;
  /** Features forced on / off; a feature not listed is the shop's own choice. */
  features?: Record<string, boolean>;
  min_version?: string;
  checkin_minutes?: number;
  commands?: { id: string; type: string; at: string | null }[];
  /** This app's version (added by the main process). */
  appVersion?: string;
}

/** A job the main process hands the page: a backup, or "is a bill open?". */
export interface AdminPageCommand {
  id: string;
  type: 'backup_now' | 'idle_check';
}

/** Auto-update state from `updater.js` in the Electron main process. */
export interface UpdateStatus {
  enabled: boolean;
  readyVersion: string | null;
  beta?: boolean;
  currentVersion?: string;
  lastCheck?: { at: string; result: 'up-to-date' | 'downloading' | 'error' | 'held'; version?: string; error?: string } | null;
  /** v4.148.0: the Admin holds this computer on its version (no checks, no installs). */
  held?: boolean;
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
  /** A bill PDF (in Documents\KamaiPlus) onto the clipboard as a file — Ctrl+V in WhatsApp attaches it (v4.133.0). */
  copyFileToClipboard?(path: string): Promise<DesktopResult>;
  getAppInfo(): Promise<{ version: string; documentsDir: string }>;
  getLicenceStatus(): Promise<LicenceStatus>;
  activateLicence(key: string): Promise<LicenceActivationResult>;
  /** v4.148.0 — free trial for a computer without a key (optional for older builds). */
  getTrialInfo?(): Promise<TrialInfo>;
  startTrial?(): Promise<LicenceActivationResult>;
  /** Check in with the licence server now (a renewed end date comes back). v4.85.0 — optional for older builds. */
  refreshLicence?(): Promise<LicenceRefreshResult>;
  /** The licence changed while the app is open (ended, blocked, renewed). */
  onLicenceChanged?(callback: (status: LicenceStatus) => void): () => void;
  /** Counts for the Admin Console's health view, sent at the next check-in (v4.98.0). */
  reportHealth?(counts: ShopCounts): Promise<{ ok: boolean; error?: string }>;
  /** The Admin's messages for this PC, kept from the last check-in (v4.98.0). */
  getAdminMessages?(): Promise<AdminMessage[]>;
  /** New messages arrived at a check-in. Returns an unsubscribe. */
  onAdminMessages?(callback: (messages: AdminMessage[]) => void): () => void;
  /** v4.105.0 — the Admin's remote control kept from the last check-in, and its changes. */
  getAdminControl?(): Promise<AdminControl>;
  onAdminControl?(callback: (control: AdminControl) => void): () => void;
  /** A job from the main process; answer with adminCommandDone({ id, ok, note }). */
  onAdminCommand?(callback: (command: AdminPageCommand) => void): () => void;
  adminCommandDone?(answer: { id: string; ok: boolean; note: string }): Promise<boolean>;
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
  /** v4.142.0 "Reset test shop": empties this PC like a new install (licence kept) and restarts the app. */
  resetTestShopDevice?(): Promise<{ ok: boolean }>;
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
