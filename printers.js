const { execFile } = require('child_process');

/**
 * Printer facts from Windows (v4.78.0). Electron's own printer list has only names, so the
 * app could not tell a plugged-in receipt printer from "Microsoft Print to PDF", nor say that
 * the bill printer is switched off. Get-Printer gives driver, port and status. ~1 s per call,
 * so results are cached briefly and one call is shared by everyone asking at the same time.
 */

// v4.80.0: Windows keeps an unplugged USB printer "Normal" (tried: TSC TE244 pulled out), so the
// USB printer devices that are really there are listed too (their ids end in "&USB001" — the
// printer's port). usb: '' = none present, '?' = Windows could not say.
const PS_SCRIPT = `
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$p = @(Get-Printer | Select-Object Name, DriverName, PortName, @{n='Status';e={[string]$_.PrinterStatus}}, WorkOffline)
$usb = '?'
try { $usb = (@(Get-CimInstance Win32_PnPEntity -Filter "PNPDeviceID LIKE 'USBPRINT%'" -ErrorAction Stop | ForEach-Object { [string]$_.PNPDeviceID }) -join '|') } catch { $usb = '?' }
@{ printers = $p; usb = $usb } | ConvertTo-Json -Compress -Depth 3
`;

const CACHE_MS = 5000;
let cache = { at: 0, value: null };
let pending = null;

/**
 * Get-Printer JSON → plain records. Either { printers, usb } (v4.80.0) or the printers alone
 * (one printer = an object, several = an array). A printer on a USB port whose device is not
 * present is unplugged: offline.
 */
function parsePrinterJson(stdout) {
  const text = String(stdout || '').trim();
  if (!text) return [];
  const raw = JSON.parse(text);
  const wrapped = raw && !Array.isArray(raw) && 'printers' in raw;
  const printersRaw = wrapped ? raw.printers : raw;
  const list = printersRaw == null ? [] : Array.isArray(printersRaw) ? printersRaw : [printersRaw];
  const usb = wrapped && typeof raw.usb === 'string' && raw.usb !== '?' ? raw.usb.split('|').filter(Boolean).map((id) => id.toUpperCase()) : null;
  return list
    .filter((p) => p && typeof p.Name === 'string' && p.Name)
    .map((p) => {
      const status = String(p.Status || '');
      const port = String(p.PortName || '');
      const unplugged = Boolean(usb) && /^USB\d+$/i.test(port) && !usb.some((id) => id.endsWith(`&${port.toUpperCase()}`));
      return {
        name: p.Name,
        driver: String(p.DriverName || ''),
        port,
        status: unplugged ? 'Unplugged' : status,
        offline: unplugged || p.WorkOffline === true || /offline|notavailable/i.test(status),
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
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(PS_SCRIPT, 'utf16le').toString('base64')],
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
