/**
 * WhatsApp linked device (v4.185.0), main-process side. Rahul 2026-11-15: every bill goes from the
 * shop's own WhatsApp number by itself (PDF + message), no WhatsApp window, no Send press.
 *
 * - waWorker.js (Baileys, a WhatsApp Web "linked device") runs in a utility process started here;
 *   the session lives in <userData>/wa-link (never in a backup, never in the cloud).
 * - One message at a time with a gap (MIN_GAP_MS + up to GAP_JITTER_MS) and at most MAX_PER_HOUR an
 *   hour — a shop's bills, never bulk (an unofficial link: WhatsApp can restrict a number that spams).
 * - Only a PDF inside Documents\KamaiPlus (isAllowedFile, as kp:open-whatsapp) and a real mobile number.
 * - Started at app launch only when this PC was linked before (creds.json); "Connect" starts it.
 * - KAMAI_E2E_WA_FAKE=1 (not packaged): a fake worker — QR, open, sends written to wa-fake-sent.json.
 * No `require('electron')` here: main.js passes it in, so the test suite can load this file.
 */

const fs = require('fs');
const path = require('path');

const MIN_GAP_MS = 5000;
const GAP_JITTER_MS = 3000;
const MAX_PER_HOUR = 60;
const WAIT_OPEN_MS = 90000;
const HOUR_MS = 3600000;

/** A bill's mobile → WhatsApp number: 10 digits = India (+91); 11–15 digits as typed; else ''. */
function waNumber(phone) {
  const digits = String(phone || '').replace(/\D/g, '').replace(/^0+/, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) return digits;
  return digits.length >= 11 && digits.length <= 15 && !digits.startsWith('91') ? digits : '';
}

/** How long the next message waits: the gap after the last one, or until the hour has room again. */
function sendDelay(sentTimes, now, rand = Math.random) {
  const recent = sentTimes.filter((t) => now - t < HOUR_MS);
  const last = recent.length ? Math.max(...recent) : 0;
  const gapWait = last ? Math.max(0, last + MIN_GAP_MS + Math.floor(rand() * GAP_JITTER_MS) - now) : 0;
  const hourWait = recent.length >= MAX_PER_HOUR ? Math.min(...recent) + HOUR_MS - now : 0;
  return Math.max(gapWait, hourWait);
}

/** The test worker: behaves like waWorker.js without WhatsApp. */
function fakeWorker(userDataDir) {
  const handlers = [];
  const emit = (data) => setTimeout(() => handlers.forEach((h) => h(data)), 150);
  const log = path.join(userDataDir, 'wa-fake-sent.json');
  const linked = path.join(userDataDir, 'wa-link', 'creds.json');
  return {
    on(event, h) { if (event === 'message') handlers.push(h); },
    kill() {},
    postMessage(msg) {
      if (msg.type === 'start') {
        if (!fs.existsSync(linked)) emit({ type: 'qr', qr: 'KAMAIPLUS-E2E-FAKE-QR' });
        // The QR stays up 2.5 s (a test can see it), then "scanned".
        setTimeout(() => {
          fs.mkdirSync(path.dirname(linked), { recursive: true });
          fs.writeFileSync(linked, JSON.stringify({ me: { id: '919999999999:1@s.whatsapp.net' } }));
          emit({ type: 'state', state: 'open', me: '919999999999' });
        }, 2500);
      } else if (msg.type === 'logout') {
        fs.rmSync(path.dirname(linked), { recursive: true, force: true });
        emit({ type: 'state', state: 'loggedOut' });
      } else if (msg.type === 'send') {
        const sent = fs.existsSync(log) ? JSON.parse(fs.readFileSync(log, 'utf8')) : [];
        sent.push({ phone: msg.phone, text: msg.text, file: msg.file, fileName: msg.fileName, at: new Date().toISOString() });
        fs.writeFileSync(log, JSON.stringify(sent, null, 1));
        emit({ type: 'sent', id: msg.id, ok: true });
      }
    },
  };
}

function createWaLink({ app, utilityProcess, getWindows, isAllowedFile }) {
  const userData = app.getPath('userData');
  const authDir = path.join(userData, 'wa-link');
  const fake = process.env.KAMAI_E2E_WA_FAKE === '1' && !app.isPackaged;
  let worker = null;
  let status = { state: 'idle', me: '', qr: '', error: '' };
  const pending = new Map();
  const queue = [];
  const sentTimes = [];
  let pumping = false;
  let nextId = 1;

  const broadcast = () => {
    for (const w of getWindows()) {
      try { if (!w.isDestroyed()) w.webContents.send('kp:wa-link-event', status); } catch { /* window closing */ }
    }
  };
  // Baileys writes creds.json as soon as the QR shows; only a scanned one has `me` (its login id).
  const isLinked = () => {
    try { return Boolean(JSON.parse(fs.readFileSync(path.join(authDir, 'creds.json'), 'utf8')).me?.id); } catch { return false; }
  };

  function onWorkerMessage(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'qr') status = { ...status, state: 'qr', qr: String(msg.qr || ''), error: '' };
    if (msg.type === 'state') status = { state: msg.state, me: msg.me || (msg.state === 'open' ? status.me : ''), qr: '', error: msg.error || '' };
    if (msg.type === 'sent') {
      const done = pending.get(msg.id);
      pending.delete(msg.id);
      if (done) done({ ok: Boolean(msg.ok), error: msg.error || '' });
      return;
    }
    broadcast();
    if (status.state === 'open') void pump();
  }

  function startWorker() {
    if (!worker) {
      if (fake) worker = fakeWorker(userData);
      else {
        if (!utilityProcess) return false;
        worker = utilityProcess.fork(path.join(__dirname, 'waWorker.js'), [], {
          serviceName: 'KamaiPlus WhatsApp',
          env: { ...process.env, KP_WA_AUTH_DIR: authDir },
        });
        worker.on('exit', () => {
          worker = null;
          status = { ...status, state: 'closed', qr: '' };
          for (const [, done] of pending) done({ ok: false, error: 'worker-stopped' });
          pending.clear();
          broadcast();
        });
      }
      worker.on('message', onWorkerMessage);
    }
    worker.postMessage({ type: 'start' });
    // A send waiting in the queue waits for the (re)connection instead of failing at once.
    if (status.state !== 'open' && status.state !== 'qr') {
      status = { ...status, state: 'connecting', error: '' };
      broadcast();
    }
    return true;
  }

  const waitForOpen = (ms) => new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (status.state === 'open') resolve(true);
      else if (Date.now() - started >= ms || ['loggedOut', 'idle', 'qrTimeout', 'replaced'].includes(status.state)) resolve(false);
      else setTimeout(tick, 1000);
    };
    tick();
  });

  async function pump() {
    if (pumping) return;
    pumping = true;
    try {
      while (queue.length) {
        if (status.state !== 'open' && !(await waitForOpen(WAIT_OPEN_MS))) {
          while (queue.length) queue.shift().resolve({ ok: false, error: 'not-connected' });
          break;
        }
        const wait = sendDelay(sentTimes, Date.now());
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        const job = queue.shift();
        const id = nextId++;
        const result = await new Promise((resolve) => {
          pending.set(id, resolve);
          worker.postMessage({ type: 'send', id, phone: job.phone, text: job.text, file: job.file, fileName: job.fileName });
        });
        sentTimes.push(Date.now());
        while (sentTimes.length && Date.now() - sentTimes[0] >= HOUR_MS) sentTimes.shift();
        job.resolve(result);
      }
    } finally {
      pumping = false;
    }
  }

  function send(request) {
    const r = request || {};
    const phone = waNumber(r.phone);
    if (!phone) return Promise.resolve({ ok: false, error: 'bad-number' });
    const file = r.file && isAllowedFile(r.file) ? path.normalize(r.file) : '';
    if (r.file && !file) return Promise.resolve({ ok: false, error: 'file-not-allowed' });
    if (!isLinked() && !fake) return Promise.resolve({ ok: false, error: 'not-linked' });
    if (!worker) startWorker();
    return new Promise((resolve) => {
      queue.push({ phone, text: String(r.text || '').slice(0, 3000), file, fileName: path.basename(String(r.fileName || file || 'bill.pdf')), resolve });
      void pump();
    });
  }

  function register(ipcMain) {
    ipcMain.handle('kp:wa-link-status', async () => ({ ...status, linked: isLinked() }));
    ipcMain.handle('kp:wa-link-connect', async () => {
      startWorker();
      return { ...status, linked: isLinked() };
    });
    // Close the QR without linking (nothing saved yet): the worker stops.
    ipcMain.handle('kp:wa-link-cancel', async () => {
      if (!isLinked() && worker) {
        worker.postMessage({ type: 'stop' });
        status = { state: 'idle', me: '', qr: '', error: '' };
        broadcast();
      }
      return { ...status, linked: isLinked() };
    });
    ipcMain.handle('kp:wa-link-logout', async () => {
      if (worker) worker.postMessage({ type: 'logout' });
      else fs.rmSync(authDir, { recursive: true, force: true });
      status = { state: 'loggedOut', me: '', qr: '', error: '' };
      broadcast();
      return { ...status, linked: false };
    });
    ipcMain.handle('kp:wa-link-send', async (_event, request) => send(request));
  }

  /** At launch: reconnect a PC that was linked before, so bills go without opening Settings. */
  function startIfLinked() {
    if (isLinked() || (fake && process.env.KAMAI_E2E_WA_FAKE_LINKED === '1')) startWorker();
  }

  return { register, startIfLinked, send, status: () => status };
}

module.exports = { createWaLink, waNumber, sendDelay, MIN_GAP_MS, GAP_JITTER_MS, MAX_PER_HOUR };
