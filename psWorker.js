/**
 * Runs PowerShell for the main process, in an Electron utility process (v4.97.0).
 *
 * Started from the main process, a PowerShell call (Get-Printer, every minute) sometimes held
 * the main thread for seconds — Windows checks the new process (an encoded command) before it
 * starts. The main thread also serves the app's pages and answers the window, so on a slow PC
 * Home showed up seconds late and a scan could wait. Here only this helper waits.
 *
 * Message in:  { id, args, timeoutMs }   (args for powershell.exe)
 * Message out: { id, error, stdout }
 */
const { execFile } = require('child_process');

process.parentPort.on('message', (event) => {
  const { id, args, timeoutMs } = event.data || {};
  execFile('powershell.exe', Array.isArray(args) ? args : [], { windowsHide: true, timeout: timeoutMs || 15000, maxBuffer: 1024 * 1024 }, (err, stdout) => {
    process.parentPort.postMessage({ id, error: err ? String(err.message || err) : null, stdout: String(stdout || '') });
  });
});
