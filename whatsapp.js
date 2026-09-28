/**
 * Opening WhatsApp from the desktop app (v4.79.0), main process.
 *
 * WhatsApp Desktop installed (it registers `whatsapp:`) → the chat opens in it straight away,
 * message filled in. Not installed → wa.me in the browser (WhatsApp Web). Windows cannot open
 * very long links, so a long message is put on the clipboard and the chat opened empty — the
 * shop pastes it with Ctrl+V. Only `whatsapp://send` and `https://wa.me/` are ever opened.
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

async function openWhatsApp({ shell, app, clipboard }, request) {
  const text = String((request && request.text) || '');
  const urls = whatsAppUrls(request && request.phone, text);
  let hasApp = false;
  try {
    hasApp = Boolean(app.getApplicationNameForProtocol('whatsapp://'));
  } catch {}
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

module.exports = { whatsAppUrls, openWhatsApp, URL_LIMIT };
