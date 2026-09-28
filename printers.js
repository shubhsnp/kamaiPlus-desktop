const { execFile } = require('child_process');

/**
 * Printer facts from Windows (v4.78.0). Electron's own printer list has only names, so the
 * app could not tell a plugged-in receipt printer from "Microsoft Print to PDF", nor say that
 * the bill printer is switched off. Get-Printer gives driver, port and status. ~1 s per call,
 * so results are cached briefly and one call is shared by everyone asking at the same time.
 */

const PS_SCRIPT = [
  '[Console]::OutputEncoding = [Text.Encoding]::UTF8;',
  "Get-Printer | Select-Object Name, DriverName, PortName, @{n='Status';e={[string]$_.PrinterStatus}}, WorkOffline | ConvertTo-Json -Compress",
].join(' ');

const CACHE_MS = 5000;
let cache = { at: 0, value: null };
let pending = null;

/** Get-Printer JSON (one printer = an object, several = an array) → plain records. */
function parsePrinterJson(stdout) {
  const text = String(stdout || '').trim();
  if (!text) return [];
  const raw = JSON.parse(text);
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .filter((p) => p && typeof p.Name === 'string' && p.Name)
    .map((p) => {
      const status = String(p.Status || '');
      return {
        name: p.Name,
        driver: String(p.DriverName || ''),
        port: String(p.PortName || ''),
        status,
        offline: p.WorkOffline === true || /offline|notavailable/i.test(status),
      };
    });
}

/** Installed printers with driver, port and offline state; null when Windows could not say. */
function getPrinterStatus() {
  if (process.platform !== 'win32') return Promise.resolve(null);
  if (cache.value && Date.now() - cache.at < CACHE_MS) return Promise.resolve(cache.value);
  if (pending) return pending;
  pending = new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', PS_SCRIPT],
      { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024 },
      (err, stdout) => {
        let value = null;
        if (!err) {
          try {
            value = parsePrinterJson(stdout);
          } catch {
            value = null;
          }
        }
        cache = { at: Date.now(), value };
        pending = null;
        resolve(value);
      }
    );
  });
  return pending;
}

module.exports = { getPrinterStatus, parsePrinterJson };
