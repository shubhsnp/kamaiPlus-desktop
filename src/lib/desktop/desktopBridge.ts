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

export interface KamaiDesktopApi {
  isDesktop: true;
  printToPdf(opts: { html: string; fileName: string; folder: 'Invoices' | 'Reports' | 'Statements' }): Promise<DesktopResult>;
  print(opts: { html: string; paper: PaperFormat; deviceName?: string; silent?: boolean }): Promise<DesktopResult>;
  getPrinters(): Promise<DesktopPrinter[]>;
  openPath(path: string): Promise<DesktopResult>;
  showItemInFolder(path: string): Promise<DesktopResult>;
  getAppInfo(): Promise<{ version: string; documentsDir: string }>;
  getLicenceStatus(): Promise<LicenceStatus>;
  activateLicence(key: string): Promise<LicenceActivationResult>;
  getUpdateStatus(): Promise<{ enabled: boolean; readyVersion: string | null }>;
  installUpdate(): Promise<DesktopResult>;
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
