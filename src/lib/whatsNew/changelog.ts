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
    version: '4.78.0',
    items: [
      msg('F1 opens a new bill from any screen (instead of Shift+B), Ctrl+L locks the screen, and the bar at the bottom shows the keys that work on each page.'),
      msg('Printers found on their own: install a receipt or label printer and, if it is the only one, KamaiPlus picks it and tells you. The bottom bar shows if the bill printer is ready, off or missing — click it to change.'),
      msg('Home arranges itself: a screen you switched off is replaced by a useful tile, with no empty gaps. New "Printer setup" tile, and "Average Bill" when your items have no buying price.'),
      msg('Fast barcode inward: scan item after item with the gun to bring stock in — quantity and category are optional. Add Product can "Generate" a barcode, "Save & print label" and make a new category right there.'),
      msg('Billing: the pencil on an item takes parts — ½ box, ¾ dozen, 7 pieces of a dozen, 1.25 kg — and shows the amount.'),
      msg('Customers in a grid or a list, sorted your way, and exported to Excel or PDF. UPI QR and bank details moved to Settings → Store Profile. The side drawer is now "Transactions" and can be dragged up or down.'),
      msg('Safer backup: before a full restore today\'s data is saved, a damaged file is refused and "Add missing records only" never overwrites. CA Excel and Tally exports for any period with correct GST. Packets like Parle-G and Maggi are found when scanned.'),
    ],
  },
  {
    version: '4.77.0',
    items: [
      msg('Barcode Studio → "New stock + labels": type the name, price and quantity of what came in. Each item is saved with its stock and its own barcode, and one label per piece prints — ready to scan at the counter.'),
      msg('Loose packs: weigh out 250 g, 500 g… of a loose item and print labels whose barcode carries the weight. One scan adds that pack to the bill at the right price.'),
      msg('Purchases: after Manual Inward or a supplier\'s Excel bill, "Print labels" gives one label per piece received. Bills with Hindi / Marathi headings and prices like ₹1,250 are read correctly.'),
      msg('Labels can also show the size / colour and a secret cost code (label setup → On the label).'),
      msg('Fixed: the Excel bill on the Purchases page did not open. A new item from a bill no longer gets a made-up price — you type its selling price.'),
    ],
  },
  {
    version: '4.74.0',
    items: [
      msg('Faster in busy hours: the next bill is ready the moment you press Enter — the counter no longer waits for the printer.'),
      msg('Fixed: an item scanned while the last bill was still being saved was lost. It now goes into the next bill.'),
      msg('A bill that did not print stays in a red bar on the counter with "Print again" — no window pops up over the next customer.'),
    ],
  },
  {
    version: '4.73.0',
    items: [
      msg('Search in English letters: type "rocket", "chitput" or "silver" and Hindi / Marathi items (रॉकेट, चीटपुट, सिल्व्हर) are found — in Billing, Products, Barcode Studio and when editing a bill.'),
      msg('Billing is simpler: the camera, Rapid and hardware buttons are gone. Scan with the barcode gun; set the bill printer with the button next to Silent.'),
    ],
  },
  {
    version: '4.72.0',
    items: [
      msg("Barcode gun billing: scan and the item is in the bill. Press Enter on the empty search box to finish the bill, and the next customer's scan starts a new bill."),
      msg('Set your bill printer once on the counter (Billing → printer button). Turn on "Enter prints the bill straight away" and every bill prints with no window.'),
      msg('Fixed: a fast scan sometimes showed "unknown barcode" with half the code.'),
    ],
  },
  {
    version: '4.71.0',
    items: [
      msg('Barcode labels for any printer: roll labels (50 × 25, 38 × 25, 2 across…), A4 sticker sheets or your own size. Set the label printer once in Settings → Invoice & Bill Rules and test it.'),
      msg('Barcode Studio: add all items, a whole category or your last Excel import at once, set copies for all, and print straight to the label printer.'),
      msg('Fixed: about 1 in 3 barcode labels printed before could not be scanned. Please reprint old labels.'),
    ],
  },
  {
    version: '4.70.0',
    items: [
      msg('Products → Import Excel: load your whole price list at once. The app reads your own column headings (also in Hindi / Marathi) and shows what will change before saving.'),
      msg('Change prices in the sheet and upload it again — the prices are updated, nothing is added twice.'),
      msg('Every imported item gets its own barcode, and a label printed for any item now always scans at the counter.'),
    ],
  },
  {
    version: '4.69.0',
    items: [
      msg('Settings → Features: switch Cash Register, Purchases, Suppliers, GST reports and extra product fields on or off. Switching off only hides them — nothing is deleted.'),
      msg('A simpler Add Product form: name, MRP, barcode and stock. Turn on Selling Price, Cost Price, HSN, GST, size / colour or variants when you need them.'),
      msg('Sound on / off button in the top bar.'),
    ],
  },
  {
    version: '4.68.0',
    items: [
      msg('Billing: type the customer\'s name and mobile right on the bill — no pop-up. Saved customers show underneath; someone new is saved when the bill is completed.'),
      msg('New products are "Unlimited stock" (no count) by default. Switch it off to count stock — it starts at 10 with a low-stock alert at 10.'),
      msg('Enter / F10 no longer complete a waiting bill while the "Sale completed" window is open. The Credit button shows its F9 key.'),
    ],
  },
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
