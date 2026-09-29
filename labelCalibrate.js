const { execFile } = require('child_process');

/**
 * "Calibrate printer" for barcode label printers (v4.80.0). After a new roll a label printer must
 * learn where each label starts, or the print lands a few mm high or low (the TSC TE244 printed
 * ~2–3 mm high on its first roll). Each printer family has one fixed command for it. The renderer
 * only names the printer; the bytes come from this list, never from the page.
 */

// Order matters: Zebra's EPL driver is also "ZDesigner …".
const CALIBRATIONS = [
  { language: 'EPL', test: /\(epl\)|\bepl\b/i, commands: '\r\nxa\r\n' },
  { language: 'ZPL', test: /zdesigner|zebra|\bzpl\b/i, commands: '~JC' },
  { language: 'EZPL', test: /godex/i, commands: '~S,SENSOR\r\n' },
  {
    language: 'TSPL',
    test: /\btsc\b|\bttp[ -]?\d|tvs[ -]?lp|\blp[ -]?4\d|\bxp-?(dt|tt|h|p)?\d{3}b\b|\bgp-?(1\d{3}|[23]120|9[01]\d{2})|rongta[ -]?rp?[ -]?4\d{2}|idprt|hprt[ -]?(ht|hlp|sl)\d/i,
    commands: 'GAPDETECT\r\n',
  },
];

/** The calibration command for a printer (name + driver), or null when the app does not know it. */
function calibrationFor(printer) {
  const text = `${(printer && printer.name) || ''} ${(printer && printer.driver) || ''}`;
  const hit = CALIBRATIONS.find((c) => c.test.test(text));
  return hit ? { language: hit.language, commands: hit.commands } : null;
}

// A RAW job straight to the printer (the driver does not draw it). Printer name and bytes come in
// through the environment, so nothing is pasted into the script text.
const RAW_SCRIPT = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class KpRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DocInfo { public string pDocName; public string pOutputFile; public string pDataType; }
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)] static extern bool OpenPrinter(string name, out IntPtr h, IntPtr d);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)] static extern int StartDocPrinter(IntPtr h, int level, [In] DocInfo di);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool WritePrinter(IntPtr h, byte[] buf, int len, out int written);
  public static string Send(string printer, byte[] data) {
    IntPtr h;
    if (!OpenPrinter(printer, out h, IntPtr.Zero)) return "ERR open " + Marshal.GetLastWin32Error();
    try {
      if (StartDocPrinter(h, 1, new DocInfo { pDocName = "KamaiPlus calibrate", pDataType = "RAW" }) == 0) return "ERR raw " + Marshal.GetLastWin32Error();
      StartPagePrinter(h);
      int written;
      bool ok = WritePrinter(h, data, data.Length, out written);
      EndPagePrinter(h);
      EndDocPrinter(h);
      return ok && written == data.Length ? "OK" : "ERR write " + Marshal.GetLastWin32Error();
    } finally { ClosePrinter(h); }
  }
}
'@
[Console]::Out.Write([KpRawPrinter]::Send($env:KP_RAW_PRINTER, [Convert]::FromBase64String($env:KP_RAW_DATA)))
`;

function sendRaw(printerName, commands) {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(RAW_SCRIPT, 'utf16le').toString('base64')],
      {
        windowsHide: true,
        timeout: 20000,
        env: { ...process.env, KP_RAW_PRINTER: printerName, KP_RAW_DATA: Buffer.from(commands, 'ascii').toString('base64') },
      },
      (err, stdout) => {
        const out = String(stdout || '').trim();
        if (err || !out.startsWith('OK')) resolve({ ok: false, error: out || (err && err.message) || 'The printer did not take the command.' });
        else resolve({ ok: true });
      }
    );
  });
}

/**
 * Calibrates an installed label printer by name. { ok, language } when the command went out;
 * { ok: false, manual: true } when the printer family is unknown (the shop uses the FEED button).
 */
async function calibrate(printers, name) {
  if (process.platform !== 'win32') return { ok: false, manual: true };
  const list = await printers.getPrinterStatus();
  const printer = (list || []).find((p) => p.name === name);
  if (!printer) return { ok: false, error: 'Printer not found.' };
  const cal = calibrationFor(printer);
  if (!cal) return { ok: false, manual: true };
  const res = await sendRaw(printer.name, cal.commands);
  return { ...res, language: cal.language };
}

module.exports = { calibrate, calibrationFor };
