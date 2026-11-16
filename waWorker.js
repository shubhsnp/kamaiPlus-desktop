/**
 * WhatsApp linked device (v4.185.0) — runs in its own utility process (waLink.js forks it), never in
 * the main process: a hang or a crash here can never stop billing, printing or the window.
 *
 * Rahul 2026-11-15: a bill goes from the shop's OWN WhatsApp number to the customer, PDF + message,
 * with no WhatsApp window and no Send press (as Vyapar does). This is a WhatsApp Web "linked device"
 * made with the Baileys library — NOT an official WhatsApp API. WhatsApp can restrict a number that
 * is used this way; the shop is told so and ticks it before linking (WaLinkDialog). Only one bill to
 * that bill's own customer, never bulk; waLink.js keeps a gap between messages.
 *
 * In  (process.parentPort): { type: 'start' } · { type: 'stop' } · { type: 'logout' }
 *                           { type: 'send', id, phone, text, file, fileName }
 * Out:                      { type: 'state', state, me?, error? } · { type: 'qr', qr }
 *                           { type: 'sent', id, ok, error? }
 * state: connecting | qr | open | closed | loggedOut | qrTimeout | replaced
 */

const fs = require('fs');
const path = require('path');

const AUTH_DIR = process.env.KP_WA_AUTH_DIR || '';
const SEND_TIMEOUT_MS = 60000;
const CAPTION_MAX = 1000;

let lib = null;
let sock = null;
let wantRunning = false;
let state = 'closed';
let retries = 0;
let reconnectTimer = null;

const post = (msg) => {
  try { process.parentPort.postMessage(msg); } catch { /* parent gone */ }
};

const setState = (next, extra = {}) => {
  state = next;
  post({ type: 'state', state: next, ...extra });
};

/** Baileys talks a lot; none of it goes to the shop's disk or console. */
const quiet = { level: 'silent', child: () => quiet, trace() {}, debug() {}, info() {}, warn() {}, error() {}, fatal() {} };

/** "919525512020:12@s.whatsapp.net" → "919525512020". */
const myNumber = (s) => String((s && s.user && s.user.id) || '').split(/[:@]/)[0];

const wipeAuth = () => {
  try { if (AUTH_DIR) fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch { /* next start makes a new one */ }
};

const withTimeout = (promise, ms, label) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(label)), ms)),
]);

async function loadLib() {
  if (!lib) lib = await import('@whiskeysockets/baileys');
  return lib;
}

async function connect() {
  if (!AUTH_DIR) { setState('closed', { error: 'no-auth-dir' }); return; }
  clearTimeout(reconnectTimer);
  const b = await loadLib();
  const makeWASocket = b.makeWASocket || b.default;
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const { state: auth, saveCreds } = await b.useMultiFileAuthState(AUTH_DIR);
  // The current WhatsApp Web version (an old one can be refused); the built-in one when offline.
  let version;
  try { version = (await withTimeout(b.fetchLatestBaileysVersion(), 8000, 'version')).version; } catch { version = undefined; }
  setState('connecting');
  const s = makeWASocket({
    auth,
    version,
    logger: quiet,
    browser: b.Browsers.windows('KamaiPlus'),
    // The shop's phone keeps getting its notifications; no old chats are downloaded.
    markOnlineOnConnect: false,
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    generateHighQualityLinkPreview: false,
  });
  sock = s;
  s.ev.on('creds.update', saveCreds);
  s.ev.on('connection.update', (u) => {
    if (sock !== s) return;
    if (u.qr) { state = 'qr'; post({ type: 'qr', qr: u.qr }); }
    if (u.connection === 'open') {
      retries = 0;
      setState('open', { me: myNumber(s) });
    }
    if (u.connection === 'close') {
      sock = null;
      const code = u.lastDisconnect && u.lastDisconnect.error && u.lastDisconnect.error.output
        ? u.lastDisconnect.error.output.statusCode : 0;
      const R = b.DisconnectReason;
      if (code === R.loggedOut) { wipeAuth(); setState('loggedOut'); return; }
      if (code === R.connectionReplaced) { setState('replaced'); return; }
      // The QR was shown and nobody scanned it: stop, the shop presses Connect again.
      // (`me` is set only once a QR was scanned — a linked PC that times out reconnects instead.)
      if (code === R.timedOut && !(auth.creds && auth.creds.me)) { setState('qrTimeout'); return; }
      if (!wantRunning) { setState('closed'); return; }
      setState('connecting');
      // restartRequired comes right after a scan — reconnect at once; otherwise back off up to a minute.
      const wait = code === R.restartRequired ? 0 : Math.min(60000, 2000 * 2 ** Math.min(retries, 5));
      retries += 1;
      reconnectTimer = setTimeout(() => { if (wantRunning) connect().catch(fail); }, wait);
    }
  });
}

function fail(err) {
  setState('closed', { error: String((err && err.message) || err || 'error') });
}

async function send(msg) {
  const { id, phone, text, file, fileName } = msg;
  const s = sock;
  if (!s || state !== 'open') { post({ type: 'sent', id, ok: false, error: 'not-connected' }); return; }
  try {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) throw new Error('bad-number');
    const [found] = await withTimeout(s.onWhatsApp(`${digits}@s.whatsapp.net`), SEND_TIMEOUT_MS, 'timeout');
    if (!found || !found.exists) throw new Error('not-on-whatsapp');
    const body = String(text || '');
    const hasPdf = Boolean(file && fs.existsSync(file));
    if (!hasPdf && !body) throw new Error('empty');
    // A media caption holds about 1,024 characters: a longer bill message goes right after the PDF instead.
    const inCaption = body.length <= CAPTION_MAX;
    if (hasPdf) {
      const doc = { document: fs.readFileSync(file), mimetype: 'application/pdf', fileName: fileName || path.basename(file), caption: inCaption ? body : '' };
      await withTimeout(s.sendMessage(found.jid, doc), SEND_TIMEOUT_MS, 'timeout');
    }
    if (!hasPdf || !inCaption) await withTimeout(s.sendMessage(found.jid, { text: body }), SEND_TIMEOUT_MS, 'timeout');
    post({ type: 'sent', id, ok: true });
  } catch (err) {
    post({ type: 'sent', id, ok: false, error: String((err && err.message) || err || 'error') });
  }
}

async function logout() {
  wantRunning = false;
  clearTimeout(reconnectTimer);
  const s = sock;
  sock = null;
  try { if (s) await withTimeout(s.logout(), 15000, 'timeout'); } catch { /* removed on the phone already, or offline */ }
  try { if (s) s.end(undefined); } catch { /* closed */ }
  wipeAuth();
  setState('loggedOut');
}

process.parentPort.on('message', (event) => {
  const msg = (event && event.data) || {};
  if (msg.type === 'start') {
    wantRunning = true;
    if (!sock) connect().catch(fail);
    else post({ type: 'state', state, me: myNumber(sock) });
  } else if (msg.type === 'stop') {
    wantRunning = false;
    clearTimeout(reconnectTimer);
    const s = sock;
    sock = null;
    try { if (s) s.end(undefined); } catch { /* closed */ }
    setState('closed');
  } else if (msg.type === 'logout') {
    logout().catch(fail);
  } else if (msg.type === 'send') {
    send(msg).catch((err) => post({ type: 'sent', id: msg.id, ok: false, error: String((err && err.message) || err) }));
  }
});
