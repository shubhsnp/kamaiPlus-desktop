/**
 * Opening WhatsApp from the desktop app (v4.79.0), main process.
 *
 * WhatsApp Desktop installed (it registers `whatsapp:`) → the chat opens in it straight away,
 * message filled in. Not installed → wa.me in the browser (WhatsApp Web). Windows cannot open
 * very long links, so a long message is put on the clipboard and the chat opened empty — the
 * shop pastes it with Ctrl+V. Only `whatsapp://send` and `https://wa.me/` are ever opened.
 *
 * v4.181.0 (Rahul): a bill goes as the A4 PDF with the message under it, nothing to copy or
 * paste by hand. With WhatsApp Desktop on Windows and a number, the chat is opened empty and
 * PowerShell (PREPARE_SCRIPT) clears any old draft (WhatsApp ADDS a link's text to the draft —
 * a bill opened twice went out twice), pastes the PDF into the empty chat, then the message
 * into the file preview's caption box, and the shop presses Send. Tested on WhatsApp Desktop
 * 2.2640 (2026-10-22): a PDF pasted after the message never opened the preview; WhatsApp reads
 * the pasted file from the clipboard seconds later, so the message waits KP_WA_FILE_MS before
 * it replaces it ("1 document … has no content" otherwise). A file preview left open in a
 * chat stays there (previews are per chat — another customer's chat is never touched), and
 * pasting another file into it was seen to send the waiting one, so "Open again" after a pasted PDF only brings the chat up
 * (WhatsAppComposer). Every key goes only while WhatsApp is the window in front; nothing typed →
 * the v4.79.0 way (text in the link, PDF copied for Ctrl+V). The text, file and link reach
 * PowerShell in environment variables, never in the command.
 */

const URL_LIMIT = 2000;

function cleanNumber(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15 ? digits : '';
}

/** The app and web links for a number ('' = pick the chat) and text. */
function whatsAppUrls(phone, text) {
  const number = cleanNumber(phone);
  const body = String(text || '');
  const enc = encodeURIComponent(body);
  const appBase = number ? `whatsapp://send?phone=${number}` : 'whatsapp://send';
  const webBase = number ? `https://wa.me/${number}` : 'https://wa.me/';
  const app = body ? `${appBase}${number ? '&' : '?'}text=${enc}` : appBase;
  const web = body ? `${webBase}?text=${enc}` : webBase;
  return { number, app, web, appBase, webBase, tooLong: Math.max(app.length, web.length) > URL_LIMIT };
}

/**
 * Opens the chat, then (WhatsApp in front only) Esc + the link again (cursor into the message
 * box), Ctrl+A, Backspace, PDF, message. Prints
 * KPWA:<stage> — nowindow / focus (nothing typed), file (PDF in, message not), both, text
 * (message only, no PDF asked). WhatsApp in the tray or closed → 12 s for it to load the
 * chats; open → 3.5 s for the chat.
 */
const PREPARE_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  "function Done($stage) { Write-Output ('KPWA:' + $stage); exit 0 }",
  "$wasOpen = @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -like 'WhatsApp*' -and $_.MainWindowHandle -ne 0 }).Count -gt 0",
  '$clock = [Diagnostics.Stopwatch]::StartNew()',
  'Start-Process $env:KP_WA_URL',
  "Add-Type -TypeDefinition @'",
  'using System; using System.Diagnostics; using System.Runtime.InteropServices; using System.Threading;',
  'public static class KpWa {',
  '  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);',
  '  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();',
  '  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int n);',
  '  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);',
  '  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);',
  '  [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr h);',
  '  [DllImport("user32.dll")] static extern bool AttachThreadInput(uint a, uint b, bool attach);',
  '  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);',
  '  [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();',
  '  [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);',
  '  static uint pid;',
  '  public static IntPtr Find() {',
  '    foreach (Process p in Process.GetProcesses()) {',
  '      try {',
  '        if (p.ProcessName.StartsWith("WhatsApp", StringComparison.OrdinalIgnoreCase) && p.MainWindowHandle != IntPtr.Zero && IsWindowVisible(p.MainWindowHandle)) { pid = (uint)p.Id; return p.MainWindowHandle; }',
  '      } catch { }',
  '    }',
  '    return IntPtr.Zero;',
  '  }',
  '  public static bool Front() { uint p; GetWindowThreadProcessId(GetForegroundWindow(), out p); return p == pid; }',
  '  static void Key(byte vk, bool up) { keybd_event(vk, 0, up ? 2u : 0u, UIntPtr.Zero); }',
  '  public static bool Focus(IntPtr h) {',
  '    if (IsIconic(h)) ShowWindow(h, 9);',
  '    for (int i = 0; i < 4 && !Front(); i++) {',
  '      uint other; uint t = GetWindowThreadProcessId(GetForegroundWindow(), out other);',
  '      uint me = GetCurrentThreadId();',
  '      AttachThreadInput(me, t, true);',
  '      Key(0x12, false); Key(0x12, true);',
  '      BringWindowToTop(h); SetForegroundWindow(h);',
  '      AttachThreadInput(me, t, false);',
  '      Thread.Sleep(200);',
  '    }',
  '    return Front();',
  '  }',
  '  public static void Ctrl(byte vk) { Key(0x11, false); Key(vk, false); Key(vk, true); Key(0x11, true); Thread.Sleep(120); }',
  '  public static void Clear() { Ctrl(0x41); Key(0x08, false); Key(0x08, true); Thread.Sleep(150); }',
  '  public static void Esc() { Key(0x1B, false); Key(0x1B, true); }',
  '}',
  "'@",
  '$settle = if ($wasOpen) { [int]$env:KP_WA_WARM_MS } else { [int]$env:KP_WA_COLD_MS }',
  '$h = [IntPtr]::Zero',
  'while ($clock.ElapsedMilliseconds -lt 30000) { $h = [KpWa]::Find(); if ($h -ne [IntPtr]::Zero) { break }; Start-Sleep -Milliseconds 250 }',
  "if ($h -eq [IntPtr]::Zero) { Done 'nowindow' }",
  '$wait = $settle - $clock.ElapsedMilliseconds',
  'if ($wait -gt 0) { Start-Sleep -Milliseconds $wait }',
  "if (-not [KpWa]::Focus($h)) { Done 'focus' }",
  '# The link does not move the cursor into a chat that was already open: Esc closes the chat, the',
  '# link opens it again with the cursor in the message box. A file preview left open in it shows',
  '# "Discard selection?" instead and stays — the keys below then do nothing and the shop decides.',
  '[KpWa]::Esc()',
  'Start-Sleep -Milliseconds 600',
  'Start-Process $env:KP_WA_URL',
  'Start-Sleep -Milliseconds ([int]$env:KP_WA_REOPEN_MS)',
  "if (-not [KpWa]::Focus($h)) { Done 'focus' }",
  '[KpWa]::Clear()',
  "if (-not [KpWa]::Front()) { Done 'focus' }",
  '$file = $false',
  'if ($env:KP_WA_FILE) {',
  '  Set-Clipboard -LiteralPath $env:KP_WA_FILE',
  '  Start-Sleep -Milliseconds 200',
  "  if (-not [KpWa]::Front()) { Done 'focus' }",
  '  [KpWa]::Ctrl(0x56)',
  '  $file = $true',
  '  # WhatsApp reads the file from the clipboard seconds later; then the preview opens, its caption box in focus.',
  '  Start-Sleep -Milliseconds ([int]$env:KP_WA_FILE_MS)',
  '}',
  'Set-Clipboard -Value $env:KP_WA_TEXT',
  'Start-Sleep -Milliseconds 200',
  "if (-not [KpWa]::Front()) { if ($file) { Done 'file' } else { Done 'focus' } }",
  '[KpWa]::Ctrl(0x56)',
  "if ($file) { Done 'both' } else { Done 'text' }",
].join('\n');

/** Runs PREPARE_SCRIPT → its stage as soon as it is printed ('error' when PowerShell failed). */
function runPrepare(env) {
  return new Promise((resolve) => {
    let out = '';
    const child = require('child_process').execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(PREPARE_SCRIPT, 'utf16le').toString('base64')],
      { env: { ...process.env, ...env }, windowsHide: true, timeout: 60000 },
      () => resolve('error')
    );
    child.stdout.on('data', (chunk) => {
      out += String(chunk);
      const m = /KPWA:(\w+)/.exec(out);
      if (m) resolve(m[1]);
    });
  });
}

/**
 * request: { phone, text, file? } — file = a bill PDF the caller checked (main.js: inside
 * Documents\KamaiPlus). Result: { ok, via, copied, textPasted?, filePasted?, error? }.
 */
async function openWhatsApp({ shell, app, clipboard, prepare = runPrepare, platform = process.platform }, request) {
  const text = String((request && request.text) || '');
  const file = String((request && request.file) || '');
  const urls = whatsAppUrls(request && request.phone, text);
  let hasApp = false;
  try {
    hasApp = Boolean(app.getApplicationNameForProtocol('whatsapp://'));
  } catch {}

  // v4.181.0: message + PDF straight into the chat (a number only — without one the chat that
  // happens to be open would get them).
  if (hasApp && urls.number && text && platform === 'win32') {
    const stage = await prepare({
      KP_WA_URL: urls.appBase,
      KP_WA_TEXT: text.replace(/\r?\n/g, '\r\n'),
      KP_WA_FILE: file,
      KP_WA_WARM_MS: '3500',
      KP_WA_COLD_MS: '12000',
      KP_WA_REOPEN_MS: '1800',
      KP_WA_FILE_MS: '3000',
    });
    if (stage === 'both' || stage === 'text') {
      return { ok: true, via: 'app', copied: false, textPasted: true, filePasted: stage === 'both' };
    }
    if (stage === 'file') {
      // PDF in, then WhatsApp lost the front: the message waits on the clipboard.
      clipboard.writeText(text);
      return { ok: true, via: 'app', copied: true, textPasted: false, filePasted: true };
    }
    // Nothing typed (WhatsApp never came to the front): the chat is open — fill it the old way below.
  }

  let copied = false;
  if (urls.tooLong && text) {
    clipboard.writeText(text);
    copied = true;
  }
  const target = hasApp ? (urls.tooLong ? urls.appBase : urls.app) : urls.tooLong ? urls.webBase : urls.web;
  try {
    await shell.openExternal(target);
    return { ok: true, via: hasApp ? 'app' : 'web', copied };
  } catch (err) {
    if (hasApp) {
      // A broken WhatsApp install: fall back to the browser.
      try {
        await shell.openExternal(urls.tooLong ? urls.webBase : urls.web);
        return { ok: true, via: 'web', copied };
      } catch {}
    }
    return { ok: false, via: hasApp ? 'app' : 'web', copied, error: (err && err.message) || 'Could not open WhatsApp' };
  }
}

module.exports = { whatsAppUrls, openWhatsApp, URL_LIMIT, PREPARE_SCRIPT };
