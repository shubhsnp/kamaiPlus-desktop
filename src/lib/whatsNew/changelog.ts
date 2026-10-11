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
