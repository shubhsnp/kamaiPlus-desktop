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
    version: '4.168.0',
    items: [
      msg('Transactions & Bills: Staff attribution labels (👤 name) on bills, staff performance metrics, and seamless staff billing sync.'),
    ],
  },
  {
    version: '4.167.0',
    items: [
      msg('Products & Staff: dynamic vertical variant presets and custom staff roles with granular security permissions.'),
    ],
  },
  {
    version: '4.166.0',
    items: [
      msg('Inventory: unlimited items excluded from stock asset totals to prevent large digits, restaurant purchases enabled, and toasts moved to top navbar.'),
    ],
  },
  {
    version: '4.165.0',
    items: [
      msg('Restaurant: Inventory & Stock page enabled under Menu & Kitchen for kitchen stock tracking and valuation.'),
    ],
  },
  {
    version: '4.164.0',
    items: [
      msg('Settings → Staff: QR and join code modal automatically closes with confirmation when staff phone joins.'),
    ],
  },
  {
    version: '4.163.0',
    items: [
      msg('Sidebar: quick access Staff link under Ledger & Customers, all retail verticals staff roles unlocked, and inventory tracking added to restaurant menu.'),
    ],
  },
  {
    version: '4.162.0',
    items: [
      msg('Settings → Staff: permanent delete option, live staff order counts & sales performance, role permissions & security limits, and salary & advance payment management.'),
    ],
  },
  {
    version: '4.161.0',
    items: [
      msg('Restaurant: new "Fast POS" on Tables & Orders for a counter without tables — tap dishes, Pay (F10), and the bill prints with a token number (TK-01…), Takeaway or Dine-in. With a kitchen printer the KOT prints with it.'),
      msg("Restaurant: delivery bills now show in Today's bills too."),
    ],
  },
  {
    version: '4.160.0',
    items: [
      msg('Sales Analytics shows Est. Profit (with the owner PIN lock) and Products shows the Cost column again for every shop — only a restaurant without buying prices sees the average bill instead.'),
    ],
  },
  {
    version: '4.159.0',
    items: [
      msg('Billing: new "Custom Item" button (same as the phone) — add a carry bag, delivery charge or any item that is not in your list, with its price. Tick "Save to my items" to keep it for next time.'),
    ],
  },
  {
    version: '4.158.0',
    items: [
      msg('Sign-up is shorter: no UPI box. Add your UPI ID later in Settings → UPI & Banking (same as the phone app).'),
    ],
  },
  {
    version: '4.157.0',
    items: [
      msg('Products and Inventory tiles are cleaner: no small corner labels, and low stock reads "Time to reorder".'),
      msg('Billing counter: a category with no items is not shown as a chip.'),
    ],
  },
  {
    version: '4.156.0',
    items: [
      msg('General Retail: Product search mentions product name, barcode and HSN instead of apparel size and color.'),
    ],
  },
  {
    version: '4.155.0',
    items: [
      msg('Electronics & Hardware: Product search mentions item name, serial number, barcode and HSN instead of apparel size and color.'),
    ],
  },
  {
    version: '4.154.0',
    items: [
      msg('Medical & Pharmacy: Product search mentions medicine name, batch, barcode and HSN instead of apparel size and color.'),
    ],
  },
  {
    version: '4.153.0',
    items: [
      msg('Inventory and Products read in plain words: "Items" instead of "Tracked SKUs", and "25 products with prices & stock" in the Products header.'),
    ],
  },
  {
    version: '4.152.0',
    items: [
      msg('Restaurant: shorter table cards, the menu list shows no cost or barcode column, Sales Analytics shows the average bill instead of profit (no buying prices in a restaurant), and bills, guests and dishes are counted in the right words. Home has no lonely one-tile rows.'),
    ],
  },
  {
    version: '4.151.0',
    items: [
      msg('Home and Khata read better: "1 Debtor" / "1 Account" instead of "1 Debtors", the products tile says "25 items" (a restaurant: "11 dishes"), and the restaurant Staff card says "Add your waiters".'),
    ],
  },
  {
    version: '4.150.0',
    items: [
      msg('Every contact box now checks itself: a mobile number takes only 10 digits, email has no spaces, GSTIN 15 capitals, pincode 6 digits, bank IFSC and account number are checked. Customer birthday and anniversary are picked as Day + Month (+ Year if you know it).'),
    ],
  },
  {
    version: '4.149.0',
    items: [
      msg('A new computer starts its free trial by itself when you sign up — no button to press. Restaurant Home: the second card now shows your staff (how many, who is online) with Add / Manage.'),
    ],
  },
  {
    version: '4.148.0',
    items: [
      msg('A new computer without a licence key can start the free trial (the number of days is set by KamaiPlus). A strip shows the days left, and a key can be entered any time — nothing is deleted. Computers with a key are not affected.'),
    ],
  },
  {
    version: '4.147.0',
    items: [
      msg('Home: the quick-action buttons line up with the four cards above, the shortcut tiles stay compact on a wide screen, and a restaurant shows Average Bill instead of Profit. Invoice Themes shows only the options your shop uses (GST breakup / HSN with a GSTIN; no MRP savings for a restaurant).'),
    ],
  },
  {
    version: '4.146.0',
    items: [
      msg('Restaurant: the PC and the phone now match — a restaurant without a GSTIN charges no GST on the staff phones either (Bill of Supply), and Home / Khata say "Guest" like the phone.'),
    ],
  },
  {
    version: '4.145.0',
    items: [
      msg('Google sign-in: the browser tab after signing in now shows KamaiPlus, a clear tick, and which Google account was connected (no empty box beside it).'),
    ],
  },
  {
    version: '4.144.0',
    items: [
      msg('New: Settings → Staff. Add your staff (restaurant waiters today) and sign in their phone with a one-time code or QR — no Google account on their phone. A waiter\'s phone only takes orders and sends KOTs; bills, money, khata and reports stay with you. Remove a staff member and their phone is signed out at once. Each order shows who took it.'),
    ],
  },
  {
    version: '4.143.0',
    items: [
      msg('Restaurant: "New delivery" asks the mobile first — a guest you delivered to before fills the name and last address by itself — and shows the charges that will be added. The order shows the guest\'s name, mobile and full address. "Sold out today" says what to do while it is on. A delivery\'s bill now says "Delivery DL-…".'),
    ],
  },
  {
    version: '4.142.0',
    items: [
      msg('Settings: the profile\'s "Log out" now says what it does — the same shop opens again with the master password (it never switched to another shop).'),
    ],
  },
  {
    version: '4.141.0',
    items: [
      msg('PC + phone on one Google account now show the same business category: a shop set up on this PC before v4.137 had gone to the cloud as "Kirana" — its real category goes up now, and the phone follows it (with its items).'),
    ],
  },
  {
    version: '4.140.0',
    items: [
      msg('Restaurant on many devices: with cloud sync on, the running orders of every table and parcel are the same on this PC and the waiters\' phones (same Google account) — what one adds, the other sees in seconds; a paid order leaves all. Set-up → "Print KOTs from the waiters\' phones on this PC" makes this PC print the KOTs a phone sends to the kitchen.'),
    ],
  },
  {
    version: '4.139.0',
    items: [
      msg('Restaurant: new "New delivery" button — type the guest\'s name, mobile and address; the order gets a DL- token. Packing charge on every parcel and a delivery charge (set it in Set-up) go on the bill with GST. The guest and address show on the order, the KOT and the bill; the mobile fills the WhatsApp bill.'),
    ],
  },
  {
    version: '4.138.0',
    items: [
      msg('Restaurant: every dish can carry the Veg / Egg / Non-veg mark (set it on the item) — shown on the menu. New "Sold out today" button on the menu: tap dishes to mark them sold out; they cannot be ordered today, every device of the shop sees it, and they come back by themselves tomorrow.'),
    ],
  },
  {
    version: '4.137.0',
    items: [
      msg('Same Google account on PC and phone: store setup on this PC now waits while it looks for your shop and shows only "Restore" when it finds it (no new-shop form). A new shop set up with a Google account goes to the cloud at once, so the phone opens it instead of asking to sign up. No Google account yet? Store setup offers "Connect Google Account".'),
    ],
  },
  {
    version: '4.136.0',
    items: [
      msg('Sales Return: for a bill that still has udhar on it, the refund now comes off the customer\'s khata by default (Credit Balance −) instead of cash. You can still pick Cash or UPI.'),
    ],
  },
  {
    version: '4.135.0',
    items: [
      msg('Mobile + PC: khata entries, expenses, cash shifts, suppliers, returns, stock history and purchase orders made on the phone now come to this PC (and this PC\'s go to the phone). A khata entry, expense or purchase order deleted on the phone is removed here too.'),
    ],
  },
  {
    version: '4.134.0',
    items: [
      msg('Mobile + PC on one Google account: store setup now finds the phone\'s shop reliably and restores it with its category and GSTIN; after the restore this PC syncs with the phone by itself. Phone items marked unlimited stay unlimited here.'),
    ],
  },
  {
    version: '4.133.0',
    items: [
      msg('WhatsApp bill: the invoice PDF now goes with the message by default — it is copied for you, so just press Ctrl+V in the WhatsApp chat and Send.'),
    ],
  },
  {
    version: '4.132.0',
    items: [
      msg('WhatsApp buttons show the official WhatsApp logo, the same as the mobile app.'),
    ],
  },
  {
    version: '4.131.0',
    items: [
      msg('Printing: a printer that never answers (a switched-off printer, or "Microsoft Print to PDF" chosen as the bill printer) no longer blocks every later bill, KOT and label — after 45 seconds that print says it failed and the next one goes out.'),
    ],
  },
  {
    version: '4.130.0',
    items: [
      msg('Split payment: the 50 / 50 fill is worked out in paise, so cash + UPI always equal the bill (an odd-paise bill could leave 1 paisa on udhar). Day Summary names cash refunds of returns as refunds, not expenses.'),
    ],
  },
  {
    version: '4.129.0',
    items: [
      msg('Sales Return opens fresh every time: after a return, Return on another bill shows that bill — not the last "Sales Return Completed" screen.'),
    ],
  },
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
