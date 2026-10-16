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
    version: '4.177.0',
    items: [
      msg("Send to counter: a bill made from a staff phone's cart is in that staff member's name — their Today's Bills and Staff performance show it."),
    ],
  },
  {
    version: '4.176.0',
    items: [
      msg('Restaurant: Add Dish starts on Plate in Restaurant mode and has no wholesale-Excel tip; no "GST 0%" line when the shop has no GST.'),
    ],
  },
  {
    version: '4.175.0',
    items: [
      msg('Add Product starts on the category you used last (else General) and your shop\'s own unit (plate for a restaurant, strip for a medical store) — no more a random category like "Accessories" in a restaurant. Your shop\'s units are listed first.'),
      msg('Categories that do not belong to your kind of shop (FMCG, Apparel… in a restaurant) are removed while no item uses them, and no longer come back when you delete all items.'),
      msg('Unlimited items are never counted in Inventory — an item a phone had sold 10+ times no longer shows 99,989 in stock.'),
      msg('Restaurant bill: a guest\'s mobile saves them as a customer (the name fills in next time), and Udhar puts the bill on their khata — like the counter.'),
      msg('A waiter\'s table bill carries the waiter\'s name, so it shows on their phone under Today\'s Bills.'),
    ],
  },
  {
    version: '4.174.0',
    items: [
      msg('Staff cart opened at the counter: an item this counter has too little stock for is named in the message (it is not added — add it by hand after checking the stock).'),
    ],
  },
  {
    version: '4.173.0',
    items: [
      msg('Staff phones (shops, not restaurants): "Send to counter" instead of billing on the phone — the cart shows up here (bottom right) and "Open bill at the counter" opens it as a new bill with this counter\'s invoice number, GST and stock.'),
      msg('Restaurant: a table paid or cancelled while the internet was off no longer comes back after the app is restarted.'),
    ],
  },
  {
    version: '4.172.0',
    items: [
      msg('Purchases and Inventory: "1 bill" / "1 item" instead of "1 bills"; a reorder card no longer shows "Deficit: 0" or "Cost: ₹0.00". Restaurant: Inventory says "Manage Menu".'),
    ],
  },
  {
    version: '4.171.0',
    items: [
      msg('Weighing-scale barcodes (starting 20 / 21) add the right weight — grams for an item sold in grams, kg for one sold in kg.'),
      msg("Settings → Staff: salary, advances and today's sales count only that person's own entries (two staff with similar names are no longer mixed)."),
    ],
  },
  {
    version: '4.170.0',
    items: [
      msg('Settings → Staff: add a staff member with just a name and a role (type any role, or tap a suggestion). Salary & advances for each member: paid this month and the balance to pay.'),
    ],
  },
  {
    version: '4.169.0',
    items: [
      msg('Backups: a backup file changed by hand is not restored — your shop data stays safe. Cloud sync: one bad record no longer stops the rest from going up.'),
    ],
  },
  {
    version: '4.168.0',
    items: [
      msg("Bills: a bill taken by a waiter or staff member shows their name (👤 Raju) in Transactions and Today's bills."),
    ],
  },
  {
    version: '4.167.0',
    items: [
      msg('Products: size / variant suggestions match your kind of shop (Half / Full, 500 g / 1 kg, strips…).'),
    ],
  },
  {
    version: '4.166.0',
    items: [
      msg('Inventory: the stock value no longer counts items with unlimited stock. Short messages now show at the top of the screen.'),
    ],
  },
  {
    version: '4.165.0',
    items: [
      msg('Restaurant: Inventory (kitchen stock) and Purchases from suppliers are on.'),
    ],
  },
  {
    version: '4.164.0',
    items: [
      msg('Settings → Staff: the join code window closes by itself once the staff phone is connected.'),
    ],
  },
  {
    version: '4.163.0',
    items: [
      msg('Staff in the side menu (under Customers). Every kind of shop can add staff now.'),
    ],
  },
  {
    version: '4.162.0',
    items: [
      msg("Settings → Staff: today's bills and sales of each staff member; remove a staff member for good. Tables & Orders: the \"New delivery\" button is gone."),
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
