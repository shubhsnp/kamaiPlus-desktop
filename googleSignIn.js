/**
 * Google sign-in for the desktop app — runs in the Electron MAIN process (v4.84.0, Step 2).
 *
 * Google blocks its sign-in page inside an app's own window, so this follows Google's
 * way for installed apps (RFC 8252): open the shop's normal browser, let Google send the
 * answer back to a one-time server on 127.0.0.1, prove it is the same sign-in with PKCE
 * (S256) and a random `state`, then swap the one-time code for an ID token. The page then
 * signs in to Firebase with that token (lib/cloud/cloudAccount.ts), so the shop's cloud
 * is `businesses/biz_<uid>` — the same account the Android app uses.
 *
 * The OAuth client is Google Cloud → Google Auth Platform → Clients → "KamaiPlus Desktop"
 * (type Desktop app). An installed-app client secret is not a secret (RFC 8252 §8.5): it
 * ships inside every copy of the app, so the page passes both in.
 */

const crypto = require('crypto');
const http = require('http');

const AUTH_URI = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const SCOPE = 'openid email profile';
const TIMEOUT_MS = 3 * 60 * 1000;

const base64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** PKCE (RFC 7636): a random verifier and its S256 challenge. */
function createPkce(verifier = base64url(crypto.randomBytes(32))) {
  return { verifier, challenge: base64url(crypto.createHash('sha256').update(verifier).digest()) };
}

function buildAuthUrl({ clientId, redirectUri, challenge, state }) {
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    prompt: 'select_account',
  });
  return `${AUTH_URI}?${q.toString()}`;
}

/** The browser's return to 127.0.0.1 → the one-time code, or why there is none. */
function parseCallback(requestUrl, expectedState) {
  const url = new URL(requestUrl, 'http://127.0.0.1');
  if (url.searchParams.get('error')) return { error: url.searchParams.get('error') };
  if (!url.searchParams.get('code')) return { error: 'no_code' };
  if (url.searchParams.get('state') !== expectedState) return { error: 'state_mismatch' };
  return { code: url.searchParams.get('code') };
}

/** Claims of a Google ID token (name, email, photo). Firebase checks the signature itself. */
function decodeIdToken(idToken) {
  try {
    const payload = String(idToken).split('.')[1];
    return JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch {
    return {};
  }
}

async function exchangeCode({ clientId, clientSecret, code, verifier, redirectUri }, fetchImpl = fetch) {
  const res = await fetchImpl(TOKEN_URI, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }).toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.id_token) return { error: json.error_description || json.error || `token_http_${res.status}` };
  return { idToken: json.id_token };
}

const esc = (v) => String(v || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * The browser tab Google sends back to (v4.144.0 redesign): KamaiPlus wordmark, an animated mark, the
 * signed-in account, and where to go next. Every style is on its own class — a browser extension's own
 * (hidden) <div> showed up as an empty card beside the old one, which styled every div.
 * kind: 'ok' | 'cancel' | 'fail'.
 */
const page = (kind, title, text, account = null) => {
  const tone = kind === 'ok' ? '#10b981' : kind === 'cancel' ? '#f59e0b' : '#ef4444';
  const mark = kind === 'ok'
    ? '<path class="kp-draw" d="M15 27l8 8 16-17"/>'
    : kind === 'cancel'
      ? '<path class="kp-draw" d="M18 18l18 18M36 18L18 36"/>'
      : '<path class="kp-draw" d="M27 15v15"/><circle cx="27" cy="38" r="2.2" fill="#fff" stroke="none"/>';
  const who = account && (account.email || account.name)
    ? `<div class="kp-acct"><span class="kp-av">${esc((account.name || account.email || '?').slice(0, 1).toUpperCase())}</span><span class="kp-acct-t">${account.name ? `<b>${esc(account.name)}</b>` : ''}<span>${esc(account.email || '')}</span></span></div>`
    : '';
  const close = kind === 'ok' ? '<script>setTimeout(function(){try{window.close()}catch(e){}},4000)</script>' : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KamaiPlus · ${esc(title)}</title>
<style>
html,body{margin:0;height:100%}
body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:radial-gradient(1200px 600px at 50% -10%,#1e1b4b 0%,#0b0f19 55%) #0b0f19;color:#e2e8f0;display:flex;align-items:center;justify-content:center;-webkit-font-smoothing:antialiased}
.kp-wrap{width:100%;max-width:440px;padding:24px;box-sizing:border-box;text-align:center}
.kp-brand{font-weight:900;font-size:22px;letter-spacing:-.5px;margin-bottom:28px;color:#fff}
.kp-brand span{color:#ef4444}
.kp-card{background:rgba(30,41,59,.72);border:1px solid rgba(148,163,184,.16);border-radius:24px;padding:36px 28px 30px;box-shadow:0 30px 80px rgba(0,0,0,.45);animation:kp-up .45s cubic-bezier(.2,.8,.2,1) both}
.kp-ic{width:76px;height:76px;margin:0 auto 20px;border-radius:50%;background:${tone};display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 10px ${tone}22,0 12px 32px ${tone}66;animation:kp-pop .5s .1s cubic-bezier(.3,1.6,.5,1) both}
.kp-ic svg{width:54px;height:54px;fill:none;stroke:#fff;stroke-width:4.5;stroke-linecap:round;stroke-linejoin:round}
.kp-draw{stroke-dasharray:60;stroke-dashoffset:60;animation:kp-draw .45s .45s ease-out forwards}
.kp-h{font-size:22px;font-weight:800;margin:0 0 8px;color:#fff}
.kp-p{font-size:14.5px;line-height:1.55;color:#94a3b8;margin:0}
.kp-acct{display:inline-flex;align-items:center;gap:10px;margin:20px auto 0;padding:8px 14px 8px 8px;border-radius:999px;background:rgba(15,23,42,.7);border:1px solid rgba(148,163,184,.18);text-align:left;max-width:100%}
.kp-av{width:30px;height:30px;flex:none;border-radius:50%;background:#4f46e5;color:#fff;font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center}
.kp-acct-t{display:flex;flex-direction:column;font-size:12.5px;color:#cbd5e1;min-width:0}
.kp-acct-t b{color:#fff;font-size:13px}
.kp-acct-t span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kp-next{margin-top:22px;font-size:13px;color:#cbd5e1;display:flex;align-items:center;justify-content:center;gap:8px}
.kp-dot{width:8px;height:8px;border-radius:50%;background:${tone};animation:kp-pulse 1.4s infinite}
.kp-foot{margin-top:22px;font-size:11.5px;color:#64748b}
@keyframes kp-up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes kp-pop{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes kp-draw{to{stroke-dashoffset:0}}
@keyframes kp-pulse{0%,100%{opacity:1}50%{opacity:.3}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}.kp-draw{stroke-dashoffset:0}}
</style></head><body><main class="kp-wrap">
<div class="kp-brand">Kamai<span>Plus</span></div>
<section class="kp-card" role="status">
<div class="kp-ic"><svg viewBox="0 0 54 54" aria-hidden="true">${mark}</svg></div>
<h1 class="kp-h">${esc(title)}</h1>
<p class="kp-p">${esc(text)}</p>
${who}
<div class="kp-next"><span class="kp-dot"></span>${kind === 'ok' ? 'KamaiPlus is ready — this tab can be closed.' : 'Switch back to the KamaiPlus app.'}</div>
</section>
<div class="kp-foot">Secure Google sign-in · only this computer received the answer</div>
</main>${close}</body></html>`;
};

/**
 * Opens the browser and waits (up to 3 min) for Google's answer.
 * → { ok: true, idToken, email, name, picture } | { ok: false, error }
 */
function signIn({ shell, clientId, clientSecret, fetchImpl = fetch, timeoutMs = TIMEOUT_MS }) {
  if (!clientId || !clientSecret) return Promise.resolve({ ok: false, error: 'not_configured' });
  const { verifier, challenge } = createPkce();
  const state = base64url(crypto.randomBytes(16));

  return new Promise((resolve) => {
    let done = false;
    const server = http.createServer();
    const finish = (result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      server.close();
      resolve(result);
    };
    const timer = setTimeout(() => finish({ ok: false, error: 'timeout' }), timeoutMs);

    server.on('request', async (req, res) => {
      if (!req.url || !req.url.startsWith('/?')) {
        res.writeHead(404).end();
        return;
      }
      const redirectUri = `http://127.0.0.1:${server.address().port}`;
      const back = parseCallback(req.url, state);
      if (back.error) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(page('cancel', 'Sign-in cancelled', 'Nothing was changed. Go back to the KamaiPlus app and try again.'));
        finish({ ok: false, error: back.error });
        return;
      }
      const token = await exchangeCode({ clientId, clientSecret, code: back.code, verifier, redirectUri }, fetchImpl).catch((e) => ({ error: e.message }));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      if (token.error) {
        res.end(page('fail', 'Sign-in did not finish', 'Check the internet, then go back to the KamaiPlus app and try again.'));
        finish({ ok: false, error: token.error });
        return;
      }
      const claims = decodeIdToken(token.idToken);
      res.end(page('ok', 'You’re signed in', 'Your Google account is now connected to KamaiPlus.', { email: claims.email, name: claims.name }));
      finish({ ok: true, idToken: token.idToken, email: claims.email || null, name: claims.name || null, picture: claims.picture || null });
    });

    // Only this computer can reach it; port 0 = any free port (a Desktop-app client allows any loopback port).
    server.listen(0, '127.0.0.1', () => {
      const redirectUri = `http://127.0.0.1:${server.address().port}`;
      Promise.resolve(shell.openExternal(buildAuthUrl({ clientId, redirectUri, challenge, state }))).catch(() =>
        finish({ ok: false, error: 'browser_not_opened' })
      );
    });
    server.on('error', (e) => finish({ ok: false, error: `server_${e.code || 'error'}` }));
  });
}

module.exports = { signIn, createPkce, buildAuthUrl, parseCallback, decodeIdToken, exchangeCode, SCOPE };
