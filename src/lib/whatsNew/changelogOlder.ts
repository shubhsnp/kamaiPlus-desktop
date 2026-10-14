import { msg } from '@/lib/i18n/core';
import type { Release } from '@/lib/whatsNew/changelog';

/** "What's new" for 4.116.0 and older (moved out of changelog.ts to stay <= 400 lines, newest first). */
export const OLDER_RELEASES: Release[] = [
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
  // 4.104.0 and older: changelogOlder.ts (split in v4.128.0 — a file stays ≤ 400 lines).
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
  {
    version: '4.100.0',
    items: [
      msg('Home "Cash in Hand" and the Day Summary now count the morning cash you opened the drawer with, so they show what your galla really holds.'),
      msg("Day Summary after a return: cash, UPI and udhar now add up to the day's total sales."),
      msg('GST screen, GSTR-1 file and Tally: CGST and SGST are now equal halves (they used to differ by a few paise).'),
      msg("Supplier's Excel bill: an item is matched only when its name and pack size really agree, so another oil or size is offered as a new item. The supplier, bill number and date are read from the top of the sheet."),
      msg('Billing: "items" now counts the lines on the bill; "units" adds up the quantities. Bottles and cans are billed in whole numbers; a bag / sack can be sold in parts (¼, ½, ¾).'),
      msg('Stock Audit Trail shows the newest change first. Excel price lists keep Bottle, Can / Tin and Bag / Sack units. Bills and screens say "KamaiPlus".'),
    ],
  },
  {
    version: '4.81.0',
    items: [
      msg('Products: the search now finds items by HSN, size and colour too, and every category can be reached — “All categories” opens them all.'),
      msg('The camera Scan button on Products is gone (it did nothing). Scan with the barcode gun into the search or the barcode box — in Add Product the gun now fills the name and MRP and no longer saves a half-filled item.'),
      msg('Settings → Features has more switches: Khata, Customers, Inventory, Barcode Studio & Labels, Sales Analytics, Invoice Themes and WhatsApp. They start on — switch off what your shop does not use; nothing is deleted.'),
      msg('Khata switched off also takes Credit / Udhar off the billing counter (no Credit button, no F9), so every bill is paid in full.'),
    ],
  },
  {
    version: '4.80.0',
    items: [
      msg('Barcode labels: choose how tall the bars are (label setup → Barcode height). Set it once on this computer and every label uses it; bills are not affected.'),
      msg('Label setup shows your roll as a picture, and "Check size & position" prints a frame on each label — you see at once if the size or position is wrong.'),
      msg('New label roll? Label setup → "Calibrate printer" makes TSC, TVS, Xprinter, Zebra and Godex printers measure the labels themselves.'),
      msg('Label cut at the top or a side? Label setup → Print position moves the whole print up, down, left or right, for any label printer.'),
      msg('A barcode label printer chosen for bills is now flagged in the printer setup and in the bottom bar, so bills do not end up on your labels.'),
      msg('A USB printer whose cable is pulled out now shows red in the bottom bar (Windows kept calling it ready), and the "printer found" note no longer covers the Complete sale button.'),
      msg('More printers found on their own: Zebra, Xprinter, Retsol, Gprinter, SNBC, Postek and other label printers are set up for labels and never for bills.'),
    ],
  },
  {
    version: '4.79.0',
    items: [
      msg('WhatsApp from every screen, like the Android app: a bill, an udhar reminder (friendly or formal), a khata slip, a payment link, a restock order to your supplier, the day summary to the owner and GST figures to your CA.'),
      msg('Messages in English, हिंदी or मराठी, and you can edit them before sending. When money is due they carry a "Pay by UPI" link — the customer taps it and pays the exact amount.'),
      msg('WhatsApp Desktop opens straight away when it is installed (else WhatsApp Web). A bill can also save its PDF to drag into the chat. Settings → Invoice & Bill Rules → WhatsApp messages.'),
    ],
  },
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
