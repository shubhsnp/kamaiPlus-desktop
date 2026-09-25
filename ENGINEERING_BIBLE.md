# 📕 KamaiPlus Desktop — Engineering Bible

> **Canonical context file. Read this before touching any code.**
> Last verified against the tree at v4.41.0, 2026‑09‑23.

This file exists so that an agent starting cold does **not** have to scan 180 source
files, and does **not** re-solve problems that were already solved. Everything here
was extracted from the code and verified, not remembered.

---

## 0. Trust rules (read this first)

**0.1 — The code is the only ground truth. This file is a map, not the territory.**
Before you rely on any fact below, spend the 5 seconds to confirm it. Every section
carries the exact command that regenerates it (see §13).

**0.2 — If you find this file is wrong, fix this file in the same commit as your code change.**
A stale map is worse than no map. That is not optional politeness — it is how the
next agent avoids your confusion.

**0.3 — Never invent a file, component, function or table name.**
If you are about to write `import { Foo } from '@/components/Foo'`, first run
`ls src/components/` or `rg "export.*Foo" src/`. This project has already been burned
by exactly this (see §12).

**0.4 — These other .md files in the repo are NOT trustworthy.**

| File | Status |
| :--- | :--- |
| `AGENTS.md` | ✅ **Authoritative.** Hard rules. Obey it. |
| `ENGINEERING_BIBLE.md` (this file) | ✅ **Authoritative.** Verified map. |
| `FEATURE_REGISTRY.md` | ❌ **Fiction.** All 27 component names in it are invented — `DashboardStatsCards`, `ProductModal`, `KhataEntryModal`, `RestoreModal` etc. do not exist and never did. Do not read it. |
| `SYSTEM_ARCHITECTURE.md` | ⚠️ **Partly stale.** Claims React 19 (actually 18.3.1), Next 15 (actually 16.3.1) and Supabase as the server DB (the Supabase dep was removed in v4.38.0 — nothing uses it). The *paise math* section in it is still correct. |
| `HANDOVER.md`, `KamaiPlus_Complete_App_Documentation.md` | ⚠️ **Historical.** Snapshots of older versions. Treat as archaeology. |

---

## 1. What this app is

**KamaiPlus (Kamai+)** — an **offline-first billing POS and retail management desktop
app for Indian small businesses.** Ships as a Windows Electron app.

Three non-negotiable product truths:

1. **Offline-first.** A bill is complete the moment it is written to IndexedDB. The
   internet is an optional accessory. Nothing in the billing path may `await` the network.
2. **Universal retail.** One product for every shop. There is no "pharmacy mode",
   "restaurant mode" or business-type branching anywhere. See §9.
3. **Money is integer paise.** Never floats. See §5.

**Business model (since v4.43.0):** the desktop app is sold to a shop for a fixed,
one-time price. Every feature is unlocked — there are **no Pro tiers, no in-app
payments / Razorpay and no AI scan** in this app. Suite 9 §8 fails the build if a
Pro gate, upgrade modal or Gemini call comes back. **Since v4.44.0 every copy needs a
licence key** (one key = one computer, no trial) — see §2.1.

### Verified stack

| Layer | Actual |
| :--- | :--- |
| Framework | Next.js **16.3.1**, App Router, Turbopack, `output: 'export'` |
| UI | React **18.3.1** / TypeScript **5.9.3** / TailwindCSS **3.4.19** |
| Desktop shell | Electron **44.4.3** + electron-builder (NSIS, Windows) |
| Local DB | Dexie **4.4.4** over IndexedDB — database name `VyaparSetuDB` |
| Cloud (optional) | Firebase **12.18.0** — Firestore + Analytics only |
| Icons | lucide-react · Lists: react-virtuoso · PDFs: jsPDF + html2canvas · Excel: xlsx |

There is **no server, no API route, no database migration system** beyond Dexie
versions. `next build` produces a static export in `out/`, and Electron serves it.

---

## 2. Runtime topology

```
electron main process  (main.js)
 │
 ├─ registers custom scheme  app://kamaiplus   ← THE ORIGIN. NEVER CHANGE IT.
 │     serves ./out/** through protocol.handle + fs.promises.readFile
 │
 ├─ hidden reusable print window (one, queued) ──► printToPDF / webContents.print
 │
 └─ BrowserWindow (renderer)
       preload.js  →  window.kamaiDesktop  (the ONLY bridge; contextIsolation on,
                                            nodeIntegration off, sandbox on)
       └─ Next.js static export = the whole UI
```

**`app://kamaiplus` is a load-bearing constant.** IndexedDB and localStorage are keyed
by origin. Change the scheme or host and **every shop on earth loses its data.** It is
defined once in `main.js` as `SCHEME` / `HOST`.

`electron . --dev` loads `http://localhost:3000` instead (Next dev server).

### IPC surface — the complete list

Defined in `main.js` (`ipcMain.handle`), exposed in `preload.js`, typed in
`src/lib/desktop/desktopBridge.ts`:

| Channel | Bridge method | Does |
| :--- | :--- | :--- |
| `kp:print-to-pdf` | `printToPdf({html, fileName, folder})` | Vector A4 PDF → `Documents/KamaiPlus/{Invoices\|Reports\|Statements}` |
| `kp:print` | `print({html, paper, deviceName, silent})` | Sends to OS printer; thermal page height is measured from the DOM |
| `kp:get-printers` | `getPrinters()` | Installed printer list |
| `kp:open-path` | `openPath(target)` | Opens a saved file — **only inside `Documents/KamaiPlus`** |
| `kp:show-in-folder` | `showItemInFolder(target)` | Same path restriction |
| `kp:app-info` | `getAppInfo()` | `{version, documentsDir}` |
| `kp:licence-status` | `getLicenceStatus()` | Offline licence check (§2.1) → `{state:'active',…}` or `{state:'required', machineName, reason?}` |
| `kp:licence-activate` | `activateLicence(key)` | One-time online activation (§2.1) → `{ok, status}` or `{ok:false, error}` |
| `kp:backup-write` | `writeBackup({json, shopName})` | Writes today's automatic backup (§2.3) |
| `kp:backup-info` | `getBackupInfo()` | Backup folder, last backup, count, extra folder (§2.3) |
| `kp:backup-choose-folder` | `chooseBackupFolder()` | Folder picker for the extra (pen drive) copy (§2.3) |
| `kp:backup-clear-folder` | `clearBackupFolder()` | Stop the extra copy (§2.3) |
| `kp:update-status` | `getUpdateStatus()` | `{enabled, readyVersion}` (§2.2) |
| `kp:update-install` | `installUpdate()` | Silent install + relaunch, only when an update has downloaded (§2.2) |
| _event_ `kp:update-ready` | `onUpdateReady(cb)` | Main → page when a new version has finished downloading (§2.2) |

`getDesktopApi()` returns `null` in a plain browser, and every caller must fall back to
the browser print dialog. Do not assume Electron.

### 2.1 Licence (v4.44.0) — one key = one computer, no trial

```
Admin Console (KamaiPlus Android repo, admin_console/) → Desktop Licences
   creates desktop_licences/{KPD-XXXX-XXXX-XXXX-XXXX}   (admin-only in firestore.rules)
        │  key sent to the shop
        ▼
<LicenceGate> (src/components/licence/LicenceGate.tsx) wraps AppShell in layout.tsx
   └─ kp:licence-status → licence.js getStatus()        OFFLINE, every launch
        no valid licence.json → activation screen, nothing else opens
   └─ kp:licence-activate → licence.js activate()        ONLINE, once
        POST https://us-central1-kamaiplus.cloudfunctions.net/desktopLicence
             { action:'activate', key, machine_id, machine_name, app_version }
        server (functions/licence_core.js) binds key → machine in a transaction,
        returns { licence: base64url(JSON), signature } signed with Ed25519
        licence.js verifies with LICENCE_PUBLIC_KEY, writes <userData>/licence.json
```

- **Machine id** = SHA-256 of Windows `MachineGuid` (fallback: hostname + CPU + RAM).
  Survives app updates and reinstalls; changes with a Windows reinstall → admin uses
  "Move to a new computer" in the console.
- **Verification is in the main process** (`licence.js`), not the page. The payload must
  be signed by the server key **and** name this machine, so copying or editing
  `licence.json` fails.
- **Dev:** `electron . --dev` (or no `out/` build) and a plain browser skip the gate.
- **Private key** is the Firebase secret `DESKTOP_LICENCE_SIGNING_KEY`; it is in no repo.
  Rotating it means shipping a new `LICENCE_PUBLIC_KEY` and re-activating every PC —
  don't.
- Revoking a key in the console stops **new** activations only; a PC that already
  activated keeps working offline (a consequence of offline use, accepted).
- `licence.js` must stay in `package.json` → `build.files`, or the installer ships
  without it and the app cannot start.

### 2.2 Auto-update (v4.45.0)

The repo is private, so updates are **not** on GitHub. They are static files on the
Firebase Hosting site **`kamaiplus-desktop`** (`https://kamaiplus-desktop.web.app/`,
hosting target `updates` in `.firebaserc`, `firebase.json` publishes `release/`).

```
npm run version:bump                 # new version number (required — same version = no update)
npm run release:desktop              # next build → electron-builder → scripts/prepare_release.js
                                     #   copies latest.yml + KamaiPlus-Desktop-Setup-<v>.exe(+.blockmap) into release/
npm run release:publish              # firebase deploy --only hosting:updates
```

- `updater.js` (main process, electron-updater, `provider: generic`): first check 60 s
  after launch, then every 4 h; downloads silently; sends `kp:update-ready`.
- `<UpdateReadyBanner>` (in `AppShell`) offers **Restart & Update** / **Later**. The app
  **never restarts by itself** (a bill may be open); otherwise the update installs
  silently on quit (`autoInstallOnAppQuit`).
- Disabled unless `app.isPackaged` and not `--dev`.
- User data (IndexedDB under `app://kamaiplus`, `licence.json`) lives in the user-data
  folder, which an NSIS update does not touch. The installer file name must keep no
  spaces (`nsis.artifactName`) so `latest.yml` URLs resolve on Hosting.
- `win.icon` is the ready-made `build/icon.ico` (7 sizes). electron-builder's own
  PNG→ICO conversion fails with `EINVAL` when it runs the icon tool on this PC (the tool
  works when run by hand), so do not point it back at `public/icon-512.png`.
- Shops on v4.44.0 or older have no updater: they install the first updater build
  (v4.45.0+) by hand once; every version after that arrives automatically.

### 2.3 Automatic local backup (v4.46.0)

Cloud sync is off (§12 #7), so the shop's own disk is the only safety net.

- `<AutoBackupScheduler>` (in `AppShell`): first run 2 min after launch, then a check
  every 30 min; **one backup per calendar day**. `lib/backup/autoBackup.ts` builds the
  same JSON as "Export Full Backup" (`createFullBackupPayload`) and sends it over
  `kp:backup-write`.
- `backup.js` (main process) writes `Documents/KamaiPlus/Backups/KamaiPlus_AutoBackup_<shop>_<YYYY-MM-DD>.json`
  via temp file + rename, keeps the newest 30, never deletes files it did not create.
  Optional **extra folder** (pen drive / Google Drive folder) in
  `<userData>/backup-settings.json`; a disconnected drive is reported, never fatal.
- `<AutoBackupCard>` on `/cloud-backup`: last backup, Backup Now, Open Folder, choose /
  remove the extra folder. Restore = the existing "Restore Store Data" button.
- Since v4.46.0 backups include **`purchase_bills`**. Restoring an older backup (no
  such key) leaves current purchase bills alone instead of wiping them.
- `backup.js` must stay in `build.files`.
- The old `firebase.json` deployed the whole repo to the default `kamaiplus` site (the
  public website) and `npm run deploy:firebase` would have overwritten it. Both are gone.

---

## 3. Directory map

```
main.js / preload.js        Electron shell + IPC bridge
licence.js                  Licence check + one-time activation (main process, §2.1)
updater.js                  Auto-update from kamaiplus-desktop.web.app (main process, §2.2)
backup.js                   Daily automatic backup files (main process, §2.3)
scripts/prepare_release.js  dist/ → release/ for the update site (§2.2)
next.config.js              output:'export', images.unoptimized, TS errors NOT ignored
src/app/<route>/page.tsx    19 routes (§4)
src/app/layout.tsx          RootLayout → I18nProvider → AppShell → PWAInstallBanner
src/components/layout/      The app shell: AppShell, Navbar, Sidebar,
                            DesktopStatusBar, GlobalDrawers, BusinessProvider
src/components/<feature>/   Feature components, one folder per domain
src/components/ui/          Button, Card, Input, Modal  (that is all of it)
src/lib/<domain>/           Engines — see table below
src/types/index.ts          All domain types. Single file.
scripts/e2e_simulation.ts   The test suite (§11). 289 assertions.
scripts/bump_version.ts     Version bumper (+0.1 minor)
public/barcodes/*.json      5 shipped offline barcode dictionaries
```

### `src/lib` module index

| Module | Responsibility |
| :--- | :--- |
| `db/index.ts` | Dexie schema, `ensureStarterBusinessIfEmpty`, `seedBusinessStarterData`, `clearAllProductData`, `restoreStarterProductCatalog` |
| `sales/saleMath.ts` | **All bill arithmetic.** `computeBillTotals`, `allocateBillDiscount`, `getSalePaymentBreakdown`, returns/refund math, `getLocalDayRange` |
| `invoices/invoiceDocument.ts` | Builds the one `InvoiceDocument` model that feeds A4, thermal, ESC/POS and the theme preview |
| `invoices/invoiceOutput.tsx` | `renderInvoiceHtml` / `printInvoice` / `saveInvoicePdf` — the public print API |
| `invoices/invoiceNumberService.ts` | `getNextUniqueInvoiceNumber` → `commitNextInvoiceNumber` (two-phase, see §6.2) |
| `invoices/pdfGenerator.ts` | jsPDF + html2canvas raster fallback. **Lazy-import only.** |
| `print/printDocument.ts` | React element → standalone HTML → Electron or iframe. No jsPDF here. |
| `hardware/printSettings.ts` | Per-computer printer choice in localStorage |
| `hardware/escpos.ts` | Raw ESC/POS bytecode (ASCII-safe: ₹ • — are transliterated) |
| `hardware/bluetoothPrinter.ts` | Web Bluetooth thermal printer |
| `hardware/barcodeScannerListener.ts` | USB/HID scanner keystroke capture |
| `firebase/lazyCloud.ts` | **The only way billing touches the cloud.** §6.4 |
| `firebase/firestoreSync.ts` | Full push/pull sync + `sanitizeForFirestore` |
| `backup/cloudBackupService.ts` | Local JSON backup/restore of every table |
| `auth.ts` | `getStoredUser` / `setStoredUser` / `logoutUser` / `purgeLocalDeviceData`, 24h session |
| `auth/cashierPrivacy.ts` | Owner PIN + profit-masking for staff |
| `reports/advancedReports.ts` | Sales analytics (net of returns, profit only on frozen `cost_price`) |
| `gst/gstr1Generator.ts` | GSTR-1 + HSN summary |
| `tally/` | Tally Prime XML + CA sales-register CSV export |
| `purchases/matchProductByName.ts` | Matches Excel/CSV bill lines to existing products (bulk inward) |
| `barcode/barcodeDictionary.ts` | Merged offline barcode lookup (§9) |
| `i18n/index.tsx` | en / hi / mr from `src/locales/*.json` |

---

## 4. Routes

19 pages. All are `'use client'`. **There are no API routes.**

| Route | Purpose | Shell? |
| :--- | :--- | :--- |
| `/` | Dashboard (or public marketing view when logged out) | yes |
| `/billing` | **POS counter.** The most important screen in the app. | yes |
| `/products` | Catalog master | yes |
| `/inventory` | Stock, reorder alerts, movements | yes |
| `/purchases` | Supplier inward (manual + Excel/CSV bill) | yes |
| `/khata` | Udhar ledger | yes |
| `/customers` | CRM | yes |
| `/transactions` | Sales history, returns | yes |
| `/cash-register` | Shift open/close, denomination tally, expenses | yes |
| `/reports` | Sales analytics | yes |
| `/gst-reports` | GSTR-1 / HSN | yes |
| `/barcode-generator` | Label studio | yes |
| `/invoice-designer` | Invoice theme editor | yes |
| `/cloud-backup` | Backup / restore / Tally + CA export | yes |
| `/settings` | Store profile, print, UPI, data maintenance | yes |
| `/auth` | Login | **standalone** |
| `/onboarding` | First-run store creation | **standalone** |
| `/invoice` | Public customer invoice link | **standalone** |
| `/pay` | Public UPI payment link (`?pa=&pn=&am=`) | ⚠️ see §12 |

### 4.1 Which file writes which Dexie table (verified — the real side-effect map)

This replaces the fictional table in `FEATURE_REGISTRY.md`. **Before you change a
table, read this row.** Regenerate it with the `rg` command in §13.

Four modules write to almost every table and are omitted from the rows below to keep
them readable — assume they touch everything:
`lib/db/index.ts` (seeding), `lib/auth.ts` (`purgeLocalDeviceData` clears all),
`lib/backup/cloudBackupService.ts` (restore), `lib/firebase/firestoreSync.ts` (cloud pull).

| Table | Feature code that writes it |
| :--- | :--- |
| **`businesses`** | `app/invoice-designer/page.tsx` (update)<br>`app/settings/page.tsx` (update)<br>`components/layout/Navbar.tsx` (update)<br>`lib/invoices/invoiceNumberService.ts` (update) |
| **`cash_expenses`** | `app/cash-register/page.tsx` (delete,put)<br>`components/sales/SalesReturnModal.tsx` (put) |
| **`cash_registers`** | `app/cash-register/page.tsx` (put,update) |
| **`categories`** | `app/products/page.tsx` (put)<br>`components/settings/DataMaintenanceTab.tsx` (clear)<br>`lib/constants/defaultProducts.ts` (put) |
| **`customers`** | `app/billing/page.tsx` (put,update)<br>`app/customers/page.tsx` (delete,put)<br>`app/khata/page.tsx` (put,update)<br>`app/transactions/page.tsx` (update)<br>`components/invoices/EditInvoiceModal.tsx` (update)<br>`components/khata/SettleInvoicesModal.tsx` (update)<br>`components/sales/SalesReturnModal.tsx` (update) |
| **`inventory_movements`** | `app/billing/page.tsx` (put)<br>`app/inventory/page.tsx` (put)<br>`app/products/page.tsx` (put)<br>`app/purchases/page.tsx` (put)<br>`app/transactions/page.tsx` (put)<br>`components/dashboard/DashboardHome.tsx` (put)<br>`components/invoices/EditInvoiceModal.tsx` (put)<br>`components/purchases/BillScanReviewModal.tsx` (put)<br>`components/sales/SalesReturnModal.tsx` (put) |
| **`ledger_transactions`** | `app/billing/page.tsx` (put)<br>`app/customers/page.tsx` (put)<br>`app/khata/page.tsx` (delete,put,update)<br>`app/transactions/page.tsx` (put)<br>`components/invoices/EditInvoiceModal.tsx` (put)<br>`components/khata/SettleInvoicesModal.tsx` (put)<br>`components/sales/SalesReturnModal.tsx` (put) |
| **`marketing_templates`** | _only the four shared modules above_ |
| **`products`** | `app/billing/page.tsx` (put)<br>`app/inventory/page.tsx` (update)<br>`app/products/page.tsx` (delete,put,update)<br>`app/purchases/page.tsx` (update)<br>`app/transactions/page.tsx` (put)<br>`components/dashboard/DashboardHome.tsx` (update)<br>`components/inventory/ExcelInventoryImporter.tsx` (bulkPut)<br>`components/invoices/EditInvoiceModal.tsx` (update)<br>`components/purchases/BillScanReviewModal.tsx` (put,update)<br>`components/sales/SalesReturnModal.tsx` (update)<br>`lib/constants/defaultProducts.ts` (bulkPut) |
| **`purchase_bills`** | `components/purchases/BillScanReviewModal.tsx` (put) |
| **`sales`** | `app/billing/page.tsx` (put)<br>`app/transactions/page.tsx` (clear,put)<br>`components/invoices/EditInvoiceModal.tsx` (put)<br>`components/khata/SettleInvoicesModal.tsx` (put)<br>`components/sales/SalesReturnModal.tsx` (update) |
| **`sales_returns`** | `app/transactions/page.tsx` (clear)<br>`components/sales/SalesReturnModal.tsx` (put) |
| **`suppliers`** | _only the four shared modules above_ |


### Route guard (`AppShell.tsx`)

```
no user            → redirect /auth               (unless public route)
user, no business  → redirect /onboarding
user + business    → /auth and /onboarding bounce back to /
```

---

## 5. Money — the paise invariant

**Every monetary value in the DB, in cart items, in totals and in tax is an
integer number of paise. ₹499.00 is `49900`. There are no floats and no decimals.**

- `formatINR(paise)` → `"₹499.00"` (display only)
- `parseRupeesToPaise("499.00")` → `49900` (input only)
- Rounding is always `Math.round`, never truncation.

GST, in `saleMath.ts`:

- **Tax-inclusive** (price already contains GST):
  `taxable = round(gross × 10000 / (10000 + rate×100))`, `tax = gross − taxable`
- **Tax-exclusive** (GST added on top):
  `tax = round(base × rate / 100)`, `gross = base + tax`
- CGST = `round(tax/2)`, SGST = `tax − CGST` (so the halves always re-sum exactly)

Whether a line is inclusive is decided per line by `isLineTaxInclusive(item)`, falling
back to the shop's `gst_pricing_mode`. **Since v4.38.0 there is exactly one rule:**
`gst_pricing_mode === 'exclusive'`. It no longer depends on business type.

> Suite 2 of the test file asserts these. If you change rounding, it will fail. Good.

---

## 6. Core workflows

### 6.1 Completing a sale — `handleCompleteSale` in `src/app/billing/page.tsx`

This is the highest-risk function in the codebase. It writes **five tables** and touches
three other screens. The order matters:

```
1. getNextUniqueInvoiceNumber(businessId)      → reserve number (does NOT commit)
2. db.sales.put(newSale)                        ← the bill is now real & safe
   ├ cloudTrackInvoice(...)                     (fire-and-forget, never awaited)
   └ cloudSyncSoon(business_id)                 (fire-and-forget)
3. commitNextInvoiceNumber(businessId, nextSeq) → advance the counter
4. for each cart line:
     db.products.put(updatedProd)               → stock deducted
     db.inventory_movements.put(...)            → audit trail
     cloudMerge(products/<id>)                  (fire-and-forget)
5. if credit/udhar remains:
     db.customers.update(balance)               → khata balance
     db.ledger_transactions.put(...)            → khata entry
     cloudMerge(customers/<id> + ledger/<id>)   (fire-and-forget)
6. setActiveSaleForInvoice → InvoiceModal, or silent print if enabled
7. close/reset the bill tab
```

**Rules for this function:**
- Dexie writes come first and are awaited. Cloud calls are `void`-ed and never awaited.
  If you `await` a cloud call here, you have broken offline billing.
- Never reorder 2 before 1 (you would burn an invoice number on a failed bill) or
  3 before 2 (you would skip a number).
- Changing it affects `/inventory`, `/khata`, `/customers`, `/transactions`, `/reports`
  and `/cash-register`. Check all of them.

### 6.2 Invoice numbering — two-phase, deliberately

`getNextUniqueInvoiceNumber()` **reserves** and returns `{invoiceNumber, nextSeq}` by
scanning existing sales for the true maximum. `commitNextInvoiceNumber()` persists the
counter onto the business row **only after the sale is saved**. This is why a crashed
bill does not leave a hole in the sequence. Do not collapse it into one call.

### 6.3 Printing & PDF — one pipeline, three outputs

```
Sale + Business
   └─ buildInvoiceDocument()            → InvoiceDocument  (one model)
        ├─ <A4TaxInvoice>               → A4 page
        ├─ <ThermalReceipt>             → 58mm / 80mm slip
        └─ EscPosEncoder                → raw bytes for Bluetooth printers
   renderElementToHtml() → buildPrintHtml() → standalone HTML string
        ├─ Electron: window.kamaiDesktop.print / printToPdf  (vector, real PDF)
        └─ Browser : hidden iframe + window.print()
```

**Consequence:** any invoice setting that has a preview in `/invoice-designer` must
change *every* output, because they all read the same `InvoiceDocument`. If you add a
field to the A4 and not the thermal slip, you have created an inconsistency bug.

`pdfGenerator.ts` (jsPDF + html2canvas) is a **separate raster path** used only for
"download this on-screen element as PDF" (`/invoice` customer page, khata statement).
It must always be `await import(...)`-ed. See §8.

### 6.4 Cloud sync — always lazy, always optional

`src/lib/firebase/lazyCloud.ts` is the **only** module billing may use to reach the cloud:

| Function | Use |
| :--- | :--- |
| `cloudMerge(path, data)` | Mirror one document to Firestore. Swallows all errors. |
| `cloudSyncSoon(businessId)` | Queue the debounced full backup. |
| `cloudTrackInvoice(payload)` | Analytics for a completed bill. |
| `prewarmCloud()` | Called once on POS mount; pulls the Firebase chunk in on idle so the first bill never waits for it. |

Every one of them loads Firebase via dynamic `import()` on first use and **never throws**.
The local Dexie copy is always the source of truth; Firestore is a mirror.

### 6.5 First run / seeding

```
ensureStarterBusinessIfEmpty()
  no business  → create one (business_type: 'retail') + seedBusinessStarterData()
  business but 0 products, and the user has not explicitly cleared the catalog
               → re-seed
seedBusinessStarterData(businessId)
  → STARTER_CATEGORIES  (storeProfiles.ts)
  → seedCategoryDefaultProducts()  → DEFAULT_STARTER_PRODUCTS (defaultProducts.ts)
  → 3 marketing templates
```

The localStorage flag `kamai_products_manually_cleared` exists so that a shop that
deliberately emptied its catalog is **not** re-seeded on next launch. Respect it.

---

## 7. Shell wiring

```
src/app/layout.tsx          (server component — metadata, viewport, fonts)
└── <I18nProvider>          language: en/hi/mr, localStorage key `vyapar_language`
    └── <AppShell>          'use client' — auth guard, route classification, lockout
        └── <BusinessProvider>            ◄── THE single db.businesses live query
            ├── <Navbar>                  store menu, language, lazy MerchantQRModal
            ├── <Sidebar>                 4 sections, Ctrl+B collapse, prefetch={false}
            ├── <main>{children}</main>   ◄── the route renders here
            ├── <DesktopStatusBar>        online/printer/clock/version
            └── <GlobalDrawers>           right-edge Checkout + History pull-tabs
                                          (hidden on /billing)
```

**`BusinessProvider` rule:** the active business is queried **once**, here. Read it with
`useBusiness()`. Before v4.38.0 thirteen components each ran their own
`db.businesses.toCollection().first()` live query — that is 13 IndexedDB subscriptions
firing on every navigation. Do not reintroduce one.

Components outside the provider (`/auth`, `/onboarding`, `/invoice`, `/pay`) must query
the DB directly — `useBusiness()` returns `undefined` there.

### Cross-component messaging (window CustomEvents)

There is no global state library. Modules talk through window events:

| Event | Fired by → consumed by |
| :--- | :--- |
| `auth_changed` | `lib/auth.ts` → AppShell, Navbar |
| `account_frozen` / `account_unfrozen` | admin sync → AppShell lockout modal |
| `kamaiplus-cart-updated` | billing → GlobalDrawers cart preview |
| `kamai_payment_received` | payment bridge → billing celebration modal |
| `print_settings_changed` | settings → print consumers |
| `privacy_mode_changed` | cashier privacy toggle → ProfitMask |
| `auto_backup_saved` | `autoBackup.ts` → AutoBackupCard refresh |

### localStorage keys (complete, verified)

`kamai_user` · `kamai_session_timestamp` · `kamai_tabs_v2` (open POS bills) ·
`kamai_sidebar_collapsed` · `kamai_products_view_mode` · `kamai_products_manually_cleared` ·
`kamai_thermal_paper_width` · `kamai_silent_print` · `kamai_print_upi_qr` ·
`kamai_cash_drawer_enabled` · `kamai_saved_bt_printer_mac` ·
`kamai_barcode_layout` · `kamai_barcode_type` · `kamai_barcode_store_name` ·
`kamai_barcode_price` · `kamai_barcode_mrp` · `kamai_barcode_date` ·
`kamai_soundbox_lang` · `kamai_soundbox_vol` · `kamai_last_backup_time` ·
`kamai_last_backup_type` · `kamai_last_restore_time` · `kamai_app_installed` ·
`kamai_pwa_banner_dismissed` · `vyapar_language`

> Note the legacy prefixes: the DB is `VyaparSetuDB` and the language key is
> `vyapar_language`. **Do not "tidy" these** — renaming them orphans real shops' data.

---

## 8. Performance contract

Learned the hard way in v4.38.0. Violating these silently doubles every page's load.

**8.1 — Nothing in the app shell may statically import a heavy library.**
The shell is `layout.tsx`, `AppShell`, `Navbar`, `Sidebar`, `GlobalDrawers`,
`DesktopStatusBar`. A static import there lands in **every** route's bundle, including
`404`. Heavy = `jspdf` (408 KB), `html2canvas` (193 KB), `xlsx` (398 KB),
`firebase/*` (647 KB), `html5-qrcode` (361 KB).

> This actually happened: `Navbar` imported `MerchantQRModal`, which imported jsPDF +
> html2canvas + qrcode — so ~600 KB of PDF machinery loaded on every single page.

**8.2 — Heavy modals are `next/dynamic` AND conditionally mounted.**

```tsx
const HeavyModal = dynamic(() => import('...').then(m => m.HeavyModal), { ssr: false });
...
{isOpen && <HeavyModal isOpen={isOpen} onClose={...} />}
```

The `{isOpen && ...}` matters: `dynamic` splits the chunk, the conditional stops it
being fetched until the user actually opens it.

**8.3 — Heavy one-shot engines use `await import()` at the call site**, not a top import.
Pattern used by `/invoice`, `/cloud-backup`, `/onboarding`, khata statements.

**8.4 — No N+1 IndexedDB queries.** POS category counts used to run one `count()` per
category on every mount. It is now a single indexed pass:
`db.products.orderBy('category_id').eachKey(...)`.

**8.5 — Do not `toArray()` a whole table to render a count.** `/cloud-backup` loaded
every sale and customer into memory just to enable two buttons. Use `.count()`, and
fetch rows inside the export handler.

### Current budget (v4.38.0) — regenerate with the command in §13

| | JS per route |
| :--- | :--- |
| Shared baseline (every page) | **769 KB** |
| Heaviest route (`/billing`) | **988 KB** |
| Everything else | 770–940 KB |

The 769 KB floor is React + React-DOM + the Next runtime + Dexie + lucide + the shell.
**If any route jumps past ~1.1 MB, you have statically imported something heavy.**

---

## 9. Universal product rule

KamaiPlus is **one retail product**. As of v4.38.0 there is no per-vertical behaviour
anywhere, and SUITE 9 of the test file **fails the build if you reintroduce any**.

Removed and forbidden:

- `getStoreProfile`, `hasModule`, `featureToggles`, `ModuleId`, `StoreProfile` — deleted.
- Branching on `business_type` / `businessType` in any component — banned by test.
- `isRestaurant` / `isPharmacy` / `isClothing` / `isGrocery` flags — deleted.
- Restaurant `table_no` / `order_type` / `token_number`; pharmacy `doctor_name` /
  `patient_name` / strips-vs-tablets mode — deleted from types, POS and invoices.
- Per-trade barcode dictionaries → merged into `barcodeDictionary.ts` (one lookup over
  all 5 JSON files in `public/barcodes/`, first match wins, general retail first).
- Per-trade seed catalogues → one `DEFAULT_STARTER_PRODUCTS`.

`business_type` **still exists as a column** on `businesses` (it is a Dexie index;
removing it needs a schema version bump). It is written as `'retail'` and **nothing
reads it to make a decision.** Keep it that way.

What is left in `storeProfiles.ts`: `MASTER_UNITS`, `DEFAULT_UNIT`,
`RECOMMENDED_UNITS`, `STARTER_CATEGORIES`. That is all it is for now.

---

## 10. Solved problems — do not regress these

Each was a real bug that cost real time. The test suite guards most of them.

| # | Problem | Solution — do not undo |
| :--- | :--- | :--- |
| 1 | **POS checkout panel clipped its own pay button.** A long bill pushed the totals and "Complete Sale" out of an `overflow-hidden` card with no scroll region. | `renderCheckoutPanel()` is a bounded flex column: root `flex flex-col flex-1 min-h-0`, one scrolling body `flex-1 min-h-0 overflow-y-auto`, footer `flex-shrink-0`. The cart list must **not** have its own `overflow-y-auto` (double scrollbar). Mobile drawer needs `h-full flex flex-col` on the wrapper. |
| 2 | **~600 KB of PDF libs on every page** via Navbar → MerchantQRModal. | §8.1. Guarded by SUITE 9. |
| 3 | **Firebase (647 KB) loaded with the POS.** | `lazyCloud.ts` + `prewarmCloud()`. Guarded by SUITE 9. |
| 4 | **13 duplicate business live-queries.** | `BusinessProvider` + `useBusiness()`. Guarded by SUITE 9. |
| 5 | **N+1 category count queries on POS mount.** | Single `eachKey` pass. Guarded by SUITE 9. |
| 6 | **Sidebar re-registered its keydown listener on every render** (`useEffect` with no dep array). | `useCallback` + `[handleToggle]` dep. |
| 7 | **Invoice numbers skipped on a failed bill.** | Two-phase reserve → commit (§6.2). |
| 8 | **Thermal printer garbled ₹ and bullets.** | `escpos.ts` transliterates to ASCII; never send raw UTF-8. Suite 4. |
| 9 | **Cold print took ~5 s on the first bill of the day.** | `main.js` keeps one hidden print window, warms the PDF engine 1.5 s after launch, and queues jobs. |
| 10 | **A hung print job blocked every later bill.** | `withTimeout` + `withPrintRecovery` recreate the window and retry once. |
| 11 | **Estimates counted as revenue** in reports/GST. | `isEstimate()` / `isRevenueSale()` in `saleMath.ts`. Suites 20–21. |
| 12 | **Profit shown to counter staff.** | `cashierPrivacy.ts` owner PIN + `<ProfitMask>`. |
| 13 | **Re-seeding a deliberately emptied catalog.** | `kamai_products_manually_cleared` flag. |
| 14 | **Fabricated GSTIN placeholders on bills.** | Blank stays blank. Suite 21. |
| 15 | **Dead Android-era code.** 16 unreachable modules + 32 scripts targeting a *different Flutter repo* were deleted. SUITE 9 asserts they stay deleted. | Don't restore them. |
| 16 | **Pro gates, upgrade modals and AI bill scan in a one-time-licence product** (v4.43.0). The gates were already pass-throughs; AI scan asked the shop for its own Gemini key. | All removed. Bulk inward is Excel/CSV + manual. SUITE 9 §8/§8b keep them out. |
| 17 | **"Complete Sale" slowed down as history grew** — `getNextUniqueInvoiceNumber` read every sale on every bill. (~276 ms per bill at 20k sales in a fake-IndexedDB test.) | Max sequence comes from `orderBy('invoice_number').uniqueKeys()` (keys only), cached against `sales.count()`, warmed when the POS opens, plus an indexed "is this number taken" check. ~1–2 ms per bill. Suite 9 §8a. |
| 18 | **Firebase loaded on screens that never needed it** — `DashboardHome` and `SettleInvoicesModal` imported it statically. The settle modal also `await`-ed each cloud write mid-settlement, so a slow network could stall it half-way. | Both go through `lazyCloud.ts` (fire-and-forget). Suite 9 §8c/§8d forbid static Firebase imports in `app/` and `components/`. |
| 19 | **`/transactions` rendered the entire history** and re-filtered it on every render (even opening a modal); **`/khata` held every sale** to show one customer. | Transactions: `useMemo` + 250 ms search debounce + 100 bills per page ("Show more"); totals still cover all filtered bills. Khata: live query scoped to the selected customer. Suite 9 §8e. |
| 20 | **Status bar / navbar claimed "Synced" / "Cloud Synced"** while nothing was synced, with always-on pulse animations on every page. | Labels say "Online • Saved Locally" / "Online"; shell pulses and the history-drawer blur removed. |
---

## 11. Verification protocol (AGENTS.md Rule 6)

Before **every** commit:

```bash
npx tsc --noEmit                    # must be 0 errors
npx tsx scripts/e2e_simulation.ts   # must be 289/289, 0 failures
npx tsx scripts/bump_version.ts     # +0.1 minor, updates package.json + version.ts
git commit -m "<type>(v<NEW>): <description>"
git push origin main
```

### Test suite map — `scripts/e2e_simulation.ts` (289 assertions)

| Suite | Covers |
| :--- | :--- |
| 1 | Core retail pillars & capability matrix |
| 2 | **Financial & GST invariants (paise arithmetic)** |
| 3 | Security, rate limiting, constant-time compare |
| 4 | ESC/POS thermal bytecode |
| 5 | Payment notification parser & soundbox |
| 6 | WhatsApp Cloud API & webhook |
| 7 | Validation & data integrity |
| 8 | _Removed in v4.43.0 with the AI scan feature_ |
| 9 | **Universal-product + performance + anti-regression invariants** (incl. no Pro/AI code) |
| 10 | WhatsApp summary, khata payment deep-link |
| 11 | Admin deletion, tombstone persistence, anti-resurrection |
| 16 | Realtime freeze, universal auth binding |
| 17 | Security & auth hardening (`ensureStarterBusiness`, Firestore rules) |
| 18 | Desktop invoice engine (Android `InvoicePdfService` parity) |
| 19 | Bill-discount GST, returns, cash-drawer money rules |
| 20 | Advanced sales analytics (Android `ReportsRepository` parity) |
| 21 | GSTR-1 honesty & ESC/POS text safety |
| 22 | Denomination tally, old-khata warning, reports |

> Suite numbers **12–15 do not exist** — the numbering has a gap. That is not a
> missing file; do not go looking for them.

**Suite 9 is the anti-hallucination guard.** It reads the source tree and fails if:
business-type branching returns, a heavy lib lands in the shell, the POS panel loses its
scroll structure, the N+1 query returns, a deleted module reappears, or per-page
business queries come back. **When you fix a bug, add its invariant there.**

---

## 12. Known issues — verified, not yet fixed

Recorded so the next agent does not rediscover them. None are fixed as of v4.38.0.

1. ~~`DesktopStatusBar` advertised shortcuts that do not exist~~ — **fixed in v4.47.0**:
   it now shows the billing keys on `/billing` and only Ctrl+B elsewhere (Suite 9 §8i
   checks every advertised key is handled). The real bindings, POS-local in
   `src/app/billing/page.tsx`:
   | Key | Actual |
   | :--- | :--- |
   | F1 | New bill tab |
   | F2 (or `/`) | Focus product search |
   | F4 / F8 / F9 | Payment = cash / UPI / credit |
   | F10 or Enter | Complete sale |
   | Esc | Clear search |
   | Ctrl+B | Toggle sidebar (global) |
   None of F1/F2/F4 do anything outside `/billing`.

2. ~~`/pay` was unreachable when logged out~~ — **fixed in v4.47.0**: `AppShell` treats
   `/pay` like the public `/invoice` link (no login, standalone layout).

3. **The route guard references 8 pages that do not exist** — `/terms-of-service`,
   `/privacy-policy`, `/refund-policy`, `/contact-us`, `/features`, `/about`,
   `/download`, `/plans`. Harmless today (dead branches), but do not assume they exist.

4. ~~`useProSubscription()` always returns Pro.~~ **Resolved in v4.43.0** — the whole
   Pro / subscription layer was deleted (see §10 #16).

5. ~~Size / colour fields only rendered if already set~~ — **fixed in v4.47.0**: a
   "+ Add size / colour" link opens them on any product.

6. **Repo weight.** Measured 2026-09-23: `node_modules` 1.2 GB, `dist/` 597 MB
   (electron-builder output), `.next/` 161 MB, `out/` 8.1 MB, plus **627 MB of stale
   Android debug APKs** (`KamaiPlus_v4.18/4.19/4.20_debug.apk`) untracked in the repo
   root. `dist/`, `.next/` and `out/` all regenerate (`rm -rf dist .next out`); the
   APKs cannot be rebuilt from this repo — delete only when the owner confirms.

7. **There is no cloud sync.** The app never signs in to Firebase Auth (login is a
   local master password, `AuthForm.tsx`), but the deployed Firestore rules (owned by
   the Android repo) require `isBusinessOwner` → `request.auth.uid`, so every write
   was rejected. **Since v4.43.0 this is explicit:** `CLOUD_SYNC_ENABLED = false` in
   `lib/firebase/cloudAvailability.ts` short-circuits every cloud path (`lazyCloud`,
   `backgroundSync`, `syncEngine`, onboarding, Cloud Backup buttons show a message).
   Turning cloud sync on needs a real Firebase login first — then flip the flag.

8. ~~Every bill read the whole `sales` table~~ — **fixed in v4.43.0**, see §10 #17.

9. ~~Dashboard statically imported Firebase~~ — **fixed in v4.43.0**, see §10 #18.

---

## 13. How to re-verify this document

Run these to regenerate each section against the live tree. If output disagrees with
this file, **the file is wrong — fix it.**

```bash
# §4  routes
find src/app -name page.tsx | sort

# §3  lib modules
for d in src/lib/*/; do echo "$d: $(ls $d | tr '\n' ' ')"; done

# §7  which files WRITE which Dexie table  (the real dependency matrix)
rg -n "db\.[a-z_]+\.(put|bulkPut|add|update|delete|clear)" src/ -o --no-heading | sort -u

# §7  localStorage keys
rg -o "localStorage\.(getItem|setItem|removeItem)\('[^']+'" src/ | sed "s/.*('//" | sort -u

# §7  window events
rg -o "(dispatchEvent|addEventListener)\(\s*(new (Custom)?Event\()?'[a-z_-]+'" src/ -N | sort -u

# §2  IPC channels
rg -o "ipcMain\.handle\('[^']+'" main.js

# §8  per-route JS budget — after `npx next build`
node -e "const fs=require('fs'),p=require('path'),O='out';for(const f of fs.readdirSync(O).filter(x=>x.endsWith('.html'))){const h=fs.readFileSync(p.join(O,f),'utf8'),s=new Set();for(const m of h.matchAll(/_next\/static\/[^\"'()\s]+\.js/g))s.add(m[0]);let b=0;for(const r of s){try{b+=fs.statSync(p.join(O,r)).size}catch{}}console.log((b/1024).toFixed(0).padStart(7),'KB',f)}"

# §1  actual dependency versions (never trust package.json ranges)
for m in react next dexie electron typescript; do node -p "'$m '+require('./node_modules/$m/package.json').version"; done

# §12 does a component actually exist before you import it?
rg "export (const|function|class) <Name>" src/
```

---

## 14. Checklist for your next change

1. Read `AGENTS.md` (hard rules) and the relevant section here.
2. **Verify** the files you are about to touch actually exist and look how this doc says.
3. Make the smallest change that solves the stated problem. Nothing adjacent.
4. If you touched `src/types/`, `src/lib/`, `src/components/ui/` or
   `src/components/layout/` — grep every consumer first (AGENTS.md Rule 3) and explain
   the blast radius to the user in Hinglish before proceeding.
5. Add an invariant to SUITE 9 (or the fitting suite) for anything you fixed.
6. `npx tsc --noEmit` → `npx tsx scripts/e2e_simulation.ts` → bump → commit → push.
7. **Update this file** if anything here became wrong. Same commit.
