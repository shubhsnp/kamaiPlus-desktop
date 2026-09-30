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

const page = (title, text) => `<!doctype html><html><head><meta charset="utf-8"><title>KamaiPlus</title>
<style>body{font-family:system-ui,Segoe UI,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
div{text-align:center;max-width:420px;padding:32px;border-radius:20px;background:#1e293b}h1{font-size:20px;margin:0 0 8px}p{color:#94a3b8;font-size:14px;margin:0}</style>
</head><body><div><h1>${title}</h1><p>${text}</p></div></body></html>`;

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
        res.end(page('Sign-in cancelled', 'Go back to the KamaiPlus app and try again.'));
        finish({ ok: false, error: back.error });
        return;
      }
      const token = await exchangeCode({ clientId, clientSecret, code: back.code, verifier, redirectUri }, fetchImpl).catch((e) => ({ error: e.message }));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      if (token.error) {
        res.end(page('Sign-in failed', 'Go back to the KamaiPlus app and try again.'));
        finish({ ok: false, error: token.error });
        return;
      }
      res.end(page('✅ Signed in to KamaiPlus', 'You can close this tab and go back to the app.'));
      const claims = decodeIdToken(token.idToken);
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
