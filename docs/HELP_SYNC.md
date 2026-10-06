# Help guides stay in step with the app

kamaiplus.com/help has 16 guides (website repo `D:\My Web Sites\KamaiPlus Website`, pages in
`src/pages/help/`) that describe the Desktop app button by button, with real screenshots and
numbers from the demo shop. When the app changes, a guide can become wrong. This file is how every
agent keeps them in step. Rule: **AGENTS.md Rule 7**.

## The three pieces

| Piece | What it does |
| :--- | :--- |
| `docs/help-map.json` | Which app files each guide describes (glob patterns) and which `app-tour` stages take its screenshots. A new screen or a new guide → add it here. |
| `node scripts/help_impact.mjs [ref]` | Lists the guides your change may make wrong (default: uncommitted changes; with a ref: everything since that commit). |
| The queue below | One row per app version: what the shop will see differently and which guides must follow. |

**Checks that hold it together**

- Desktop e2e Suite 9 §9j(ai): every map pattern matches a real file, every guide exists on the
  website, and **the current `APP_VERSION` has a row in the queue** — a version bump without a
  row fails the tests.
- Website `npm run check`: fails while any row says `released` (shops have the change, the guide
  does not), so the site cannot be deployed with a known-stale guide; and every help guide on the site
  must be in `help-map.json`.

## Workflow

1. **While coding (Desktop):** before the version bump run `node scripts/help_impact.mjs`. Read
   the listed guides' text for what you changed: button names, steps, numbers, screenshots.
2. **At the version bump:** add a row to the queue: the version, what the shop sees differently (shop
   words), the guides, status `pending`. Nothing visible changed → guides `—`, status `none`.
3. **When the version reaches shops** (installer published / auto-update): change its rows to
   `released`. From now on the website check fails until the guides follow.
4. **Update the website** (website repo): edit the guide text **and** its Hindi
   (`src/i18n/hi.json` — `npm run check` lists missing strings), retake screenshots
   (`node scripts/app-tour.mjs all` with a fresh `npm run build` of the Desktop app, then
   `node scripts/help-images.mjs`), check pins at real size, update "Updated <date>" and
   "KamaiPlus Desktop <version>" in the guide header, `/facts` and the llms "Does not do yet" line if
   a feature shipped. `npm run check` → deploy → `node scripts/indexnow.mjs`.
5. **Close the row:** status `on website (site v1.x.x)`.

Why not update the website at once? The live site describes the app the shops have. Desktop work is
committed locally and reaches shops only when Rahul releases it (memory: no push / no release), so a
guide changed early would be wrong for every shop until then. Prepare the website change in a local
commit if you like; deploy it with the release.

## Statuses

| Status | Meaning |
| :--- | :--- |
| `pending` | In a local / unreleased build. Website stays as it is. |
| `released` | Shops have it. The website must follow — `npm run check` there fails until it does. |
| `on website (site v…)` | Guide text, Hindi and screenshots updated and deployed. |
| `none` | No visible change for the shop (refactor, tests, docs). |

## Queue

| Version | What the shop sees differently | Guides | Status |
| :--- | :--- | :--- | :--- |
| 4.98.0 | Guides were written from this version (website v1.7.0). | — | on website (site v1.7.0) |
| 4.99.0 | Home "Cash in Hand" and Day Summary "Net Cash in Hand" include the morning float (demo: ₹2,435, was ₹435); Home card subtitle "Float + Cash Sales - Exp"; after Close Shift the Cash Register still shows the opening float. GST screen and files: CGST = SGST per row (HSN 0713 ₹16.29 / ₹16.29, was 16.31 / 16.27); a B2B invoice is one row per rate. A4 bill footer "KamaiPlus • Aapki Dukaan ka Digital Sathi" (the website's `help-images.mjs` paints over the old footer in `theme-01-designer` — remove that `cover`). Counter: items = bill lines ("Cart Items (7)" for the first bill, was 8). | getting-started (Cash in Hand line says the float is NOT included — change it, and its Hindi), cash-register, reports-gst, invoice-themes, billing-counter | pending |
| 4.100.0 | Supplier Excel bill: an item is matched only when name and pack size agree (Sesame Oil no longer goes to Coconut Oil; a tie is left to the shop); supplier, bill number and date are read from the sheet's title rows (no "CSV_…" number). Day Summary after a return: cash + UPI + udhar add up to the total (UPI shown after the refund, as in Transactions). Stock Audit Trail newest first. "KamaiPlus" on the password screen and in the default bill terms ("Bill made with KamaiPlus."). Excel units Bottle / Can / Tin / Bag / Sack kept. Counter: bottles and cans whole numbers only; bag / sack with ¼ ½ ¾ chips. What's new has 4.100.0 notes. | purchases-suppliers (drop the "Look at the matches" Sesame/Coconut warning, mention title-row reading), cash-register + reports-gst (Day Summary rows), inventory-stock, add-products (units table: bottle / can whole, bag parts), excel-import (units), getting-started (password screen shows KamaiPlus — the website crop of start-01/02 can go), invoice-themes (default terms text) | pending |
| 4.101.0 | GST: returns are credit notes in the month the goods came back (GSTR-1 table 9B "cdnr" for GSTIN buyers, B2C rows net, HSN net, documents issued lists credit notes); the bill stays as issued. New GSTR-3B tab (3.1(a), 3.1(c), tax payable; ITC from GSTR-2B). Tally XML: returns = Credit Note vouchers on the return date, udhar bill-wise; ledgers in NAME.LIST. GST units BTL / CAN / BAG. | reports-gst (credit notes in B2B tab and Docs Issued, the new GSTR-3B tab — screenshot gst-01 shows 5 tabs now; "What is not in the app yet" drops GSTR-3B, keeps e-invoice / e-way bill), backup-restore (Tally export note) — and the website's /facts + llms "Does not do yet" line (GSTR-3B summary now in) | pending |
| 4.102.0 | Counter: new "Save as Estimate" button under Complete Sale — saves the bill as EST-001 (no stock / udhar / cash; Transactions → "Convert to Bill" later); starred items come first in the product grid; a bill that takes a customer past their udhar limit asks "Give udhar anyway?". Customer form: "Udhar limit (₹)" (empty = no limit). Cash Register: "Past shifts" table (last 30 — opening float, expected, counted, short / extra). Purchases: "Purchase Order" (PO-001, send on WhatsApp, "Received" adds stock, on credit adds to the account) and "Return to Supplier" (debit note DN-001: stock down, what you owe down — Suppliers shows "Goods returned"). | billing-counter (estimate button + udhar limit warning + starred first), khata-udhar (udhar limit on the customer form), cash-register (Past shifts), purchases-suppliers (purchase order + return to supplier; screenshots purchases show two new buttons), and the website's /facts + llms "Does not do yet" lines (estimates, purchase return / order now in) | pending |
| 4.103.0 | Products: an amber bar "N items look like duplicates … Review" when the same item is saved twice; the Review window merges them (pick the one to keep, stock after merge, Merge / Not duplicates). GSTIN fields (shop, customer, supplier) refuse a GSTIN whose last character (check digit) does not add up. App text in Mukta on every PC (bundled; screenshots taken on a PC without Mukta looked different). Nothing else visible. | add-products (duplicate review bar), settings / getting-started (GSTIN check message), khata-udhar + purchases-suppliers (GSTIN on customer / supplier forms) | pending |
| 4.104.0 | Nothing the shop sees: Billing, Khata, Products, Settings and 8 smaller files split into parts of ≤ 400 lines, code moved unchanged (K-D23). What's new has one line about it. | — | none |
| 4.105.0 | KamaiPlus support can control a PC from the Admin Console: a feature forced on / off shows locked in Settings → Features ("Set by KamaiPlus support for this computer"); "New bills are paused" over Billing; "KamaiPlus is paused on this computer" over the app; "Please update KamaiPlus" with Restart & update; messages can be a pop-up with a button, and urgent / pop-up ones also come as a Windows notification. | store-settings (locked feature row), getting-started (support / messages from KamaiPlus) | pending |
| 4.106.0 | New Restaurant mode (only when KamaiPlus support switches it on from the Admin Console): Billing in the menu becomes "Tables & Orders" — table cards (free / running, open time, amount), takeaway tokens TA-01, menu tiles with Half / Full, add-ons and a note for one piece (before or after the kitchen slip), Send KOT (only changes print), Bill & Pay (discount, cash / UPI / card, change) and a one-bill-per-table GST bill (5% included by default, editable in Set-up with service / packing charge). Stock, labels, purchases and suppliers are hidden in this mode. Other shops see no change. | none for now — restaurant mode is for specific shops; write a guide only when a restaurant shop is live (billing-counter source patterns now include src/components/restaurant) | none |
| 4.107.0 | Settings → Features: no switches any more — a list of what is On / Off with "Features are set by KamaiPlus support" (contact line); a turned-off screen says KamaiPlus support switches it on. Home: with stock and purchases both off, no "Fast barcode inward" tile. Restaurant mode only: the menu says Menu / Guests / Bills / Tables & Orders (Products, Customers, Transactions renamed), Add Dish form, Bill & Pay has a UPI QR, guest name / mobile and "After paying: Print straight away / Show the bill" (bill window: Print, PDF, WhatsApp), Today's bills strip and a Move-table button. | store-settings (Features tab is read-only now — screenshot + steps "switch it on" must change to "ask KamaiPlus support"), getting-started (Home tiles); restaurant parts: no guide yet | pending |
| 4.108.0 | Settings tab "Features ON / OFF" is now "Features"; two new rows there: Stock counting, Barcode on items (both On for every shop). Restaurant mode only: order screen — 🗑 on each dish, ⋯ menu (Reprint KOT, Cancel order with a reason + owner PIN when food is in the kitchen), Print bill button (before paying, with UPI QR); Pay — "Cash + UPI"; Tables — "Cancelled today" button; Menu page / Add Dish / Home / Reports show no stock or barcode. | store-settings (tab name, two new rows); restaurant parts: no guide yet | pending |
