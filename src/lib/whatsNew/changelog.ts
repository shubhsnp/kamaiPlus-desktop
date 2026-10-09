import { msg } from '@/lib/i18n/core';
import { OLDER_RELEASES } from '@/lib/whatsNew/changelogOlder';

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
    version: '4.128.0',
    items: [
      msg('Pharmacy counter: loose tablets are billed with the strip\'s own tablet count (e.g. 3 of 15), never as tenths of a strip. Store setup card Electronics & Hardware matches the mobile app.'),
    ],
  },
  {
    version: '4.127.0',
    items: [
      msg('Electronics & mobile shops: the ✏️ on a bill line takes the IMEI / serial no. and warranty months of that piece, printed on the bill.'),
    ],
  },
  {
    version: '4.126.0',
    items: [
      msg('Pharmacy: batch no. and expiry month on medicines (printed on the bill), a warning when an expired medicine is added, a list of medicines expiring in 90 days on Inventory, and patient / doctor name on the bill.'),
    ],
  },
  {
    version: '4.125.0',
    items: [
      msg('Licence: if KamaiPlus support blocks and later unblocks your key, the app starts working again by itself at the next check-in.'),
    ],
  },
  {
    version: '4.124.0',
    items: [
      msg('Day Summary shows udhar received in cash; GST screen lists each HSN per unit; restoring a shop from the cloud brings back customers, udhar and bills, and bill numbers carry on.'),
    ],
  },
  {
    version: '4.123.0',
    items: [
      msg('Restaurant: with no kitchen (KOT) printer chosen, Send KOT no longer says sent — it asks whether the kitchen was told, and marks the order only then.'),
    ],
  },
  {
    version: '4.122.0',
    items: [
      msg('Safer: if KamaiPlus support deletes a shop, this computer saves today\'s backup first and clears the data only after that; the app also opens without waiting for the internet.'),
    ],
  },
  {
    version: '4.121.0',
    items: [
      msg('New shops: sample items now fit the shop category — medicines by the strip, clothes in sizes, restaurant dishes in Half / Full and never counted, general store items for retail. New units: Strip, Plate, Portion.'),
    ],
  },
  {
    version: '4.120.0',
    items: [
      msg('Bills of a new shop without a GSTIN carry no GST and are titled Bill of Supply; store setup has an optional GSTIN box, and GST starts once a GSTIN is saved.'),
    ],
  },
  {
    version: '4.119.0',
    items: [
      msg('Shops that do not count stock (for example restaurants) are never stopped with Out of stock at the counter, and the counter shows no stock numbers for them.'),
    ],
  },
  {
    version: '4.118.0',
    items: [
      msg('New shops: the app follows the shop category chosen in store setup (Cafe / Restaurant opens Tables & Orders by itself; GST screens and fields appear once a GSTIN is saved). Settings no longer has a Features tab.'),
    ],
  },
  {
    version: '4.117.0',
    items: [
      msg('Upgraded Store Onboarding: visual Category Selection Cards (Kirana, Pharmacy, Clothing, Hardware, Restaurant, Retail), vertical-tailored starter catalogs, and 1-click Cross-Device Cloud Store Restore.'),
    ],
  },
  {
    version: '4.116.0',
    items: [
      msg('Realtime Live Sync: 1-second instant live reaction for Admin remote commands, lock mode, factory wipe, and messages via Firestore signals.'),
    ],
  },
  {
    version: '4.115.0',
    items: [
      msg('Remote management: support for remote factory reset and licence wipe from the Admin Console.'),
    ],
  },
  {
    version: '4.114.0',
    items: [
      msg('Billing counter: fractional quantity presets (¼, ½, ¾) for packets, pieces, kg, litres, and pharmacy strips.'),
    ],
  },
  {
    version: '4.113.0',
    items: [
      msg('Performance & lightweight update: removed unused mobile packages and web banners for faster loading.'),
    ],
  },
  {
    version: '4.112.0',
    items: [
      msg('Brand consistency across the app: Kamai in black with Plus in red, single unified tagline "Aapki Dukaan Ka Digital Sathi", and website link www.kamaiplus.com.'),
    ],
  },
  {
    version: '4.111.0',
    items: [
      msg('Settings → Data Maintenance: safe 3-tier reset with cloud sync wiping (Clean Products, Reset Sales Bills with fresh INV-001 restart, and Factory Reset with Store Profile protection).'),
    ],
  },
  {
    version: '4.110.0',
    items: [
      msg('Restaurant: dish count badges on the menu tiles are aligned inside each card so numbers never get cropped or cut off when adding items.'),
    ],
  },
  {
    version: '4.109.0',
    items: [
      msg('Cash Register: Denomination Tally Counter shows real currency notes and coins (₹500 down to ₹1) next to each count.'),
    ],
  },
  {
    version: '4.108.0',
    items: [
      msg("Restaurant: a dish can be deleted from the order (🗑), the whole order can be cancelled with a reason (the kitchen gets a cancel slip, and today's cancelled orders are listed on the Tables screen), the bill can be printed for the table before paying (with your UPI QR), a lost KOT can be printed again, and a guest can pay part cash, part UPI."),
      msg("Restaurant mode now hides stock and barcodes everywhere (Menu page, Add Dish, Home, Reports). KamaiPlus support can switch them back on if you need them."),
    ],
  },
  {
    version: '4.107.0',
    items: [
      msg("Settings → Features now only shows what is on for your shop. To switch a feature on or off, contact KamaiPlus support — they change it for you."),
      msg("Restaurant mode speaks your language: Products is now Menu, Customers are Guests, Transactions are Bills. After paying you can print the bill straight away or open it to print, save a PDF or send it on WhatsApp; UPI shows your QR for the exact amount; today's bills sit on the Tables screen; and an order can move to another table."),
    ],
  },
  {
    version: '4.106.0',
    items: [
      msg("For restaurants and cafés: KamaiPlus support can switch on Restaurant mode — a Tables & Orders screen with running tables, takeaway tokens, add-ons, a kitchen slip (KOT) and a 5% GST bill. Shops that are not restaurants see no change."),
    ],
  },
  {
    version: '4.105.0',
    items: [
      msg('KamaiPlus support can now help faster: they can switch features on or off for you, send a pop-up message with a button, and run an update, a backup or a restart on this computer (a restart waits until no bill is open).'),
      msg('A feature set by KamaiPlus support shows a lock in Settings → Features. Urgent messages also come as a Windows notification.'),
    ],
  },
  {
    version: '4.104.0',
    items: [
      msg('Behind the scenes: the Billing, Khata, Products and Settings screens were split into smaller parts so future fixes are safer. Nothing changes in how they work.'),
    ],
  },
  {
    version: '4.103.0',
    items: [
      msg('Products: if the same item is saved twice (same barcode, or same name and unit), a "Review" bar lets you merge them into one — bills and stock history move to the item you keep.'),
      msg('GSTIN: a mistyped letter or digit is now caught when you save (the last character is a check digit).'),
      msg('The app now carries its own Mukta font, so text looks the same on every computer.'),
    ],
  },
  {
    version: '4.102.0',
    items: [
      msg('Billing: "Save as Estimate" saves the bill as a quotation (EST-001) without touching stock, udhar or cash. Turn it into a bill later from Transactions → "Convert to Bill".'),
      msg('Customers: set an udhar limit. The counter warns before a bill takes the customer past it.'),
      msg('Purchases: "Return to Supplier" makes a debit note (stock and what you owe go down) and "Purchase Order" sends your order on WhatsApp; mark it received when the goods come.'),
      msg('Cash Register: past shifts are listed with what was counted and any shortage. Starred items come first on the billing screen.'),
    ],
  },
  {
    version: '4.101.0',
    items: [
      msg('GST: goods returned are now a credit note in the month they came back. Returns by GSTIN buyers go in GSTR-1 table 9B; the bill itself stays as issued.'),
      msg('New GSTR-3B tab on the GST screen: tax on your sales for the month, the same figures as GSTR-1.'),
      msg('Tally file: returns come as Credit Note vouchers, and udhar is tracked bill by bill.'),
    ],
  },
  // 4.100.0 and older: changelogOlder.ts (split in v4.128.0 — a file stays ≤ 400 lines).
  ...OLDER_RELEASES,
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
