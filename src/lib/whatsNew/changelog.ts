import { msg } from '@/lib/i18n/core';

/*
 * "What's new" — what a shopkeeper notices after an update, newest first.
 * Write for the counter, not for developers: one short line per change.
 * Texts are English message ids (msg); add their Hindi / Marathi lines to
 * src/locales/hi.json and mr.json (suite §8x checks).
 *
 * Only versions a shop can see. Internal releases (tests, clean-ups) get no entry.
 */
export interface Release {
  version: string;
  items: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: '4.67.0',
    items: [
      msg('"What\'s new" after every update. See it again any time in Settings → Help & Support, or click the version number at the bottom right.'),
    ],
  },
  {
    version: '4.66.0',
    items: [
      msg('GSTR-1 JSON for the GST portal is fixed: right month, right format, each B2B bill once, HSN split into B2B and B2C.'),
      msg('Before the GSTR-1 download the app tells you what to fix — for example items without an HSN code.'),
      msg('GST page quarters and year follow the financial year (April–March).'),
    ],
  },
  {
    version: '4.65.0',
    items: [
      msg('Auto-lock: after 10 minutes without use the app asks for the master password. Change the time or turn it off in the store menu (top right).'),
      msg('"Lock now" in the store menu when you leave the counter. Open bills stay as they are.'),
    ],
  },
  {
    version: '4.64.0',
    items: [
      msg('Help from KamaiPlus: WhatsApp or call +91 86699 97711, or e-mail kamaiplus.app@gmail.com — from Settings → Help & Support.'),
      msg('Send the problem report to KamaiPlus on WhatsApp or e-mail with one click.'),
    ],
  },
  {
    version: '4.63.0',
    items: [
      msg('The whole app in हिंदी and मराठी. Choose the language in the store menu or on the password screen.'),
    ],
  },
  {
    version: '4.61.0',
    items: [
      msg('After a sale the next bill starts empty — no old customer, discount or split amounts.'),
      msg('Khata payments clear the oldest bills first, and the cash drawer no longer counts them twice.'),
      msg('The owner PIN has no default any more — set your own with the master password.'),
      msg('HSN / SAC code in the product form; GST slabs 3 % and 40 % added.'),
    ],
  },
  {
    version: '4.60.0',
    items: [msg('No more black flash when you move between pages.')],
  },
  {
    version: '4.59.0',
    items: [
      msg('A double click on Complete Sale saves the bill only once.'),
      msg('Billing fixes: split payments, cash typed before changing the payment mode, and edited rates stay as typed.'),
    ],
  },
];

export const WHATS_NEW_SEEN_KEY = 'kamai_whats_new_seen';
/** Shops that updated before this key existed are shown everything after this version. */
export const WHATS_NEW_BASELINE = '4.62.0';
export const OPEN_WHATS_NEW_EVENT = 'open_whats_new';

/** 4.10.0 > 4.9.0. Missing parts count as 0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

/** Releases newer than the last one this computer has seen, up to the running version. */
export function unseenReleases(lastSeen: string | null, current: string, changelog: Release[] = CHANGELOG): Release[] {
  const from = lastSeen || WHATS_NEW_BASELINE;
  return changelog.filter((r) => compareVersions(r.version, from) > 0 && compareVersions(r.version, current) <= 0);
}

export function readWhatsNewSeen(): string | null {
  try {
    return localStorage.getItem(WHATS_NEW_SEEN_KEY);
  } catch {
    return null;
  }
}

export function markWhatsNewSeen(version: string): void {
  try {
    localStorage.setItem(WHATS_NEW_SEEN_KEY, version);
  } catch {}
}
