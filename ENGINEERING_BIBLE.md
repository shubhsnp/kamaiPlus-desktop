# 📕 KamaiPlus Desktop — Engineering Bible

> **Canonical context file. Read this before touching any code.**
> Last verified against the tree at v4.77.0, 2026‑09‑28 (sections carry the version they were last touched in).

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
| `docs/archive/SYSTEM_ARCHITECTURE.md` | ⚠️ **Partly stale.** Claims React 19 (actually 18.3.1), Next 15 (actually 16.3.1) and Supabase as the server DB (the Supabase dep was removed in v4.38.0 — nothing uses it). The *paise math* section in it is still correct. |
| `docs/archive/HANDOVER.md`, `docs/archive/KamaiPlus_Complete_App_Documentation.md` | ⚠️ **Historical.** Snapshots of older versions. Treat as archaeology. |

`FEATURE_REGISTRY.md` (27 invented component names) and a stale, never-deployed copy of
`firestore.rules` were deleted in v4.62.0. Firestore rules live in the **Android repo**.

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
| `kp:print` | `print({html, paper, deviceName, silent, pageSizeMm})` | Sends to OS printer; thermal page height is measured from the DOM; `paper: 'label'` (v4.71.0) prints at `pageSizeMm` (10–300 mm, one label-roll row per page) |
| `kp:get-printers` | `getPrinters()` | Installed printer list |
| `kp:open-path` | `openPath(target)` | Opens a saved file — **only inside `Documents/KamaiPlus`** |
| `kp:show-in-folder` | `showItemInFolder(target)` | Same path restriction |
| `kp:app-info` | `getAppInfo()` | `{version, documentsDir}` |
| `kp:licence-status` | `getLicenceStatus()` | Offline licence check (§2.1) → `{state:'active',…}` or `{state:'required', machineName, reason?}` |
| `kp:licence-activate` | `activateLicence(key)` | One-time online activation (§2.1) → `{ok, status}` or `{ok:false, error}` |
| `kp:licence-verify-key` | `verifyLicenceKey(key)` | Forgot master password: `{ok}` only if `key` is the key of the signed licence on THIS PC (offline). The login screen then clears the password so a new one can be set — data untouched. |
| `kp:log-error` | `logError(entry)` | Page error → `<userData>/logs/errors.log` (§2.4) |
| `kp:error-report` | `getErrorReport()` | Support report text: version, Windows, masked licence, last 30 errors (§2.4) |
| `kp:open-logs` | `openLogFolder()` | Opens the log folder (§2.4) |
| `kp:backup-write` | `writeBackup({json, shopName})` | Writes today's automatic backup (§2.3) |
| `kp:backup-info` | `getBackupInfo()` | Backup folder, last backup, count, extra folder (§2.3) |
| `kp:backup-choose-folder` | `chooseBackupFolder()` | Folder picker for the extra (pen drive) copy (§2.3) |
| `kp:backup-clear-folder` | `clearBackupFolder()` | Stop the extra copy (§2.3) |
| `kp:update-status` | `getUpdateStatus()` | `{enabled, readyVersion}` (§2.2) |
| `kp:update-install` | `installUpdate()` | Silent install + relaunch, only when an update has downloaded (§2.2) |
| `kp:update-check` | `checkForUpdates()` | "Check for updates now" (§2.2) |
| `kp:update-set-beta` | `setBetaUpdates(on)` | Per-computer beta channel on/off (§2.2) |
| _event_ `kp:update-ready` | `onUpdateReady(cb)` | Main → page when a new version has finished downloading (§2.2) |

`getDesktopApi()` returns `null` in a plain browser, and every caller must fall back to
the browser print dialog. Do not assume Electron.

### 2.1 Licence (v4.44.0) — one key = one computer, no trial

```
Admin Console (KamaiPlus Android repo, admin_console/) → Desktop Licences
   creates desktop_licences/{KPD-XXXX-XXXX-XXXX-XXXX}   (admin-only in the Android repo's firestore.rules)
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

**Staged rollout (v4.54.0).** Normal installs read `latest.yml`; a computer with
Settings → Help & Support → "Get early updates (beta)" reads `beta.yml`
(`<userData>/update-settings.json`). `updater.js` sets `autoUpdater.channel` and then
forces `allowDowngrade = false` (setting a channel silently turns downgrades on).

```
npm run version:bump
npm run release:beta      # build → release/beta.yml (stable latest.yml untouched)
npm run release:publish   # beta computers update; everyone else stays put
…try it on 2–3 shops…
npm run release:promote   # latest.yml = beta.yml — the SAME installer, no rebuild
npm run release:publish
```

**Download page (v4.59.0).** https://kamaiplus-desktop.web.app/ also serves the public
download page. Source: `site/index.html` + `site/logo.png` (one self-contained file,
Inter / Mukta / JetBrains Mono from Google Fonts, dark slate + logo yellow). Every
`prepare_release.js` run copies `site/` into `release/` and stamps `{{VERSION}}`,
`{{INSTALLER}}`, `{{SIZE_MB}}`, `{{RELEASE_DATE}}` from `release/latest.yml`; the page also
re-reads `latest.yml` at runtime, so the button always points at the current stable
installer. `/`, `/index.html` and both ymls are served `no-cache` (`firebase.json`). The
page's "try the counter" demo uses the POS rules (integer paise, inclusive GST, the same
tender chips); its QR is a decorative pattern, never a payable code. Edit the page in
`site/`, never in `release/`.

`npm run release:desktop` still ships straight to everyone (writes both files).
`prepare_release.js` never wipes `release/`; it deletes only installers that neither
yml points at. `release/` is not in git — publish from the machine that holds it.

**Code signing — not yet (needs a purchased certificate).** Installers are unsigned,
so Windows SmartScreen shows "Windows protected your PC → More info → Run anyway" and
some antivirus tools flag new versions. Nothing in the repo has to change to sign:
electron-builder signs every `.exe` it builds when a certificate is supplied through
the environment, and skips signing (as today) when it is not.

1. Buy an OV code-signing certificate in the company name (EV only if the budget
   allows — it builds SmartScreen reputation faster). Since 2023 the private key must
   live on a hardware token or a cloud HSM, so pick a CA whose delivery works with
   `signtool` on this PC (cloud signing service or USB token + its driver).
2. Build with the certificate in the environment — never in `package.json` or git:
   - `.pfx` file: `CSC_LINK=<path to .pfx>` and `CSC_KEY_PASSWORD=<password>`.
   - Token / cloud HSM: follow the CA's `signtool` instructions and set
     `win.signtoolOptions` (`certificateSubjectName` or `certificateSha1`) to pick the
     certificate from the Windows store.
3. Check: right-click the installer → Properties → Digital Signatures shows the
   company name.
4. **Only after the first signed version is live**, add
   `win.signtoolOptions.publisherName` (exact certificate subject CN). electron-updater
   then refuses any update not signed by that publisher. Adding it earlier — or letting
   the certificate lapse later — makes every shop reject every update.

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

### 2.4 Error log & support report (v4.52.0)

- `errorlog.js` (main) appends JSON lines to `<userData>/logs/errors.log`, rolls to
  `errors.1.log` at 1 MB, never throws. Sources: main `uncaughtException` /
  `unhandledRejection`, `render-process-gone` (the window reloads itself after a crash),
  `unresponsive`, and the page via `kp:log-error`.
- Page side: `<ErrorReporter>` (root layout) hooks `window.onerror` and unhandled
  rejections (`lib/diagnostics/errorReporter.ts`, same message at most once per 10 s);
  `app/error.tsx` and `app/global-error.tsx` replace a blank screen with a friendly
  one and log the error.
- Settings → **Help & Support** (`HelpSupportTab`): "Copy report for support" and
  "Open log folder". The report holds no bills, customers or prices.
- `errorlog.js` must stay in `build.files`.

### 2.5 Support contacts (v4.64.0)

- **WhatsApp / call +91 86699 97711 · kamaiplus.app@gmail.com** — written once in
  `lib/support/contact.ts` (`supportWhatsAppUrl`, `supportEmailUrl`, `supportGreeting`).
  `site/index.html` repeats them by hand. The old `info@proventure.in` is gone (§8y).
- Links are `https://wa.me/…` and a Gmail compose URL, never `mailto:` — main.js only
  hands `http(s)` to `shell.openExternal`, and many shop PCs have no mail app.
- `components/support/SupportContact.tsx`: `SupportContactCard` (top of Help & Support:
  WhatsApp chat, call number + copy, email + copy) and `SupportContactLine` (licence
  screen with the machine name in the message, locked-account modal, forgotten
  password). Help & Support also sends the problem report straight into WhatsApp /
  Gmail (cut to 1,800 chars so the link opens).
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
src/app/<route>/page.tsx    20 routes (§4)
src/app/layout.tsx          RootLayout → I18nProvider → LicenceGate → AppShell → PWAInstallBanner
src/components/layout/      The app shell: AppShell, Navbar, Sidebar,
                            DesktopStatusBar, GlobalDrawers, BusinessProvider
src/components/<feature>/   Feature components, one folder per domain
src/components/ui/          Button, Card, Input, Modal  (that is all of it)
src/lib/<domain>/           Engines — see table below
src/types/index.ts          All domain types. Single file.
scripts/e2e_simulation.ts   The test suite (§11). 517 assertions.
scripts/bump_version.ts     Version bumper (+0.1 minor)
public/barcodes/*.json      5 shipped offline barcode dictionaries
```

### `src/lib` module index

| Module | Responsibility |
| :--- | :--- |
| `db/index.ts` | Dexie schema, `ensureStarterBusinessIfEmpty`, `seedBusinessStarterData`, `clearAllProductData`, `restoreStarterProductCatalog` |
| `billing/billTabs.ts` | Open POS bills (tabs) in localStorage `kamai_pos_tabs`: `makeEmptyTab`, `tabsAfterClosing`, `tabsAfterSale` + `cartBeyond` (scans made while a bill saves → next bill, v4.74.0), `getInitialTabs` |
| `search/productSearch.ts` | Product search in English or हिंदी / मराठी (v4.73.0): `searchProducts` (filter + best first), `productSearchScore`, `makeProductQuery`, `wordSoundKey` — §9.6 |
| `billing/scanInput.ts` | Barcode gun on the counter (v4.72.0): `searchEnterAction` (what Enter in the search box does), `looksLikeBarcode` — §9.5 |
| `billing/billCustomer.ts` | Customer typed on the POS counter row (v4.68.0): `resolveBillCustomer` (saved by mobile / only-one-by-name → existing, else new, or a refusal), `suggestCustomers`, `buildBillCustomer` — §6.1 step 0 |
| `sales/saleMath.ts` | **All bill arithmetic.** `computeBillTotals`, `allocateBillDiscount`, `getSalePaymentBreakdown`, returns/refund math, `getLocalDayRange` |
| `invoices/invoiceDocument.ts` | Builds the one `InvoiceDocument` model that feeds A4, thermal, ESC/POS and the theme preview |
| `invoices/invoiceOutput.tsx` | `renderInvoiceHtml` / `printInvoice` / `saveInvoicePdf` — the public print API |
| `invoices/invoiceNumberService.ts` | `getNextUniqueInvoiceNumber` → `commitNextInvoiceNumber` (two-phase, see §6.2) |
| `invoices/pdfGenerator.ts` | jsPDF + html2canvas raster fallback. **Lazy-import only.** |
| `print/printDocument.ts` | React element → standalone HTML → Electron or iframe. No jsPDF here. |
| `hardware/printSettings.ts` | Per-computer printer choice in localStorage |
| `hardware/escpos.ts` | Raw ESC/POS bytecode (ASCII-safe: ₹ • — are transliterated) |
| `hardware/bluetoothPrinter.ts` | Web Bluetooth ESC/POS printer — only the "Bluetooth" print in "Sale completed" and Barcode Studio use it; it connects on demand (the billing hardware manager that paired it was removed in v4.73.0) |
| `hardware/barcodeScannerListener.ts` | USB/HID scanner keystroke capture when **no** text box owns the scan (key timing by `e.timeStamp`; `ignore` lets the POS search box read scans itself) — §9.5 |
| `firebase/lazyCloud.ts` | **The only way billing touches the cloud.** §6.4 |
| `firebase/firestoreSync.ts` | Full push/pull sync + `sanitizeForFirestore` |
| `backup/cloudBackupService.ts` | Local JSON backup/restore of every table |
| `auth.ts` | `getStoredUser` / `setStoredUser` / `logoutUser` / `purgeLocalDeviceData`, 24h session |
| `auth/cashierPrivacy.ts` | Owner PIN + profit-masking for staff |
| `reports/advancedReports.ts` | Sales analytics (net of returns, profit only on frozen `cost_price`) |
| `gst/gstr1Generator.ts` | GSTR-1 + HSN summary for the screen and the CSV |
| `gst/gstr1Json.ts` | **GSTR-1 JSON for the GST portal / offline tool** (`buildGstr1Json`) and the GST page periods (`gstPeriodRange`, Indian FY) — see §10 #25 |
| `tally/` | Tally Prime XML + CA sales-register CSV export |
| `purchases/matchProductByName.ts` | Matches Excel/CSV bill lines to existing products: bill barcode first, then name (`normalizeName` keeps Indian scripts — v4.77.0), never a variant parent |
| `purchases/billSheet.ts` | Supplier bill Excel / CSV → lines, pure (§9.8): `guessBillColumns`, `readBillSheet`, `billLineProblem` |
| `purchases/billInwardDb.ts` | `applyBillInward` — a whole supplier bill in one transaction (§9.8) |
| `barcode/barcodeDictionary.ts` | Merged offline barcode lookup (§9) |
| `i18n/core.ts` | `tr()` / `msg()` / `paymentMethodLabel` / `expenseCategoryLabel`; lazy-loads `src/locales/hi.json` / `mr.json` (§7.1) |
| `i18n/index.tsx` | `I18nProvider` + `useTranslation()` (language state, remount on change) |
| `support/contact.ts` | Support WhatsApp / phone / e-mail and their links (§2.5) |
| `features/featureSwitches.ts` | Settings → Features on / off switches (§9.2): `useFeatureSwitches`, `isFeatureOn`, `featureForPath`, `showSellingPriceField` |
| `sound/soundSettings.ts` | 🔊 / 🔇 for every beep and voice (`isSoundMuted`, `setSoundMuted`) — §9.2 |
| `import/catalogImport.ts` | Excel / CSV price-list import, pure (§9.3): `guessColumnRoles`, `mapUnit`, `buildItemName`, `buildImportRows`, `planImport` |
| `import/catalogImportDb.ts` | `applyImportPlan` — categories, new items, price updates, store barcodes in one Dexie transaction (§9.3) |
| `barcode/storeBarcodes.ts` | The shop's own saved barcodes, EAN-13 `200…` (§9.3): `nextStoreBarcodes`, `ensureProductBarcode`, `ensureProductBarcodes` (bulk) |
| `barcode/barcodeGenerator.ts` | Bar codes as SVG (§9.4): `barcodeSymbol` (EAN-13 for valid EAN-13, else Code-128 B / C), `barcodeSVG`, `code128Modules`, `ean13Modules` |
| `labels/` | Barcode labels (§9.4): `labelSettings.ts` (stocks, per-computer setup, `saveLabelHandoff` / `readLabelHandoff`), `labelSheet.ts` (`buildLabelHtml` — preview = print), `printLabels.ts`, `labelExtras.ts` (cost code, size / colour — v4.77.0) |
| `inward/` | Goods coming in (§9.8): `stockEntry.ts` (pure — `stockAfterInward`, `labelCopiesFor`, `lowStockAlertFor`, `inwardMovement`, `planStockEntry`), `stockEntryDb.ts` (`applyStockEntry`), `stockEntryDraft.ts` (typed rows kept per computer) |
| `barcode/weighedBarcode.ts` | Loose-pack codes `29 IIIII QQQQQ C` (§9.8): `makeWeighedBarcode`, `parseWeighedBarcode`, `weighedQuantity`, `formatPackAmount` |

---

## 4. Routes

20 pages. All are `'use client'`. **There are no API routes.**

| Route | Purpose | Shell? |
| :--- | :--- | :--- |
| `/` | Dashboard (or public marketing view when logged out) | yes |
| `/billing` | **POS counter.** The most important screen in the app. | yes |
| `/products` | Catalog master | yes |
| `/inventory` | Stock, reorder alerts, movements | yes |
| `/purchases` | Supplier inward (manual + Excel/CSV bill); manual inward can put the value on a saved supplier's account; both offer "Print N labels" (§9.8) | yes |
| `/suppliers` | Supplier accounts (v4.48.0): what you owe, purchases on credit, payments — `lib/suppliers/supplierLedger.ts` | yes |
| `/khata` | Udhar ledger | yes |
| `/customers` | CRM | yes |
| `/transactions` | Sales history, returns | yes |
| `/cash-register` | Shift open/close, denomination tally, expenses | yes |
| `/reports` | Sales analytics | yes |
| `/gst-reports` | GSTR-1 / HSN | yes |
| `/barcode-generator` | Label studio; "New stock + labels" (`?new=1`), loose packs, labels handed over from Purchases (`?from=inward`) — §9.4, §9.8 | yes |
| `/invoice-designer` | Invoice theme editor | yes |
| `/cloud-backup` | Backup / restore / Tally + CA export | yes |
| `/settings` | Store profile, print, UPI, data maintenance | yes |
| `/auth` | Login | **standalone** |
| `/onboarding` | First-run store creation | **standalone** |
| `/invoice` | Public customer invoice link | **standalone** |
| `/pay` | Public UPI payment link (`?pa=&pn=&am=`) | ⚠️ see §12 |

`/cash-register`, `/purchases`, `/suppliers` and `/gst-reports` can be switched off in
Settings → Features (§9.2): off = not in the Sidebar or on Home, and the address shows a
"turned off" card (`<FeatureGate>` in AppShell). **Off by default for a new shop.**

### 4.1 Which file writes which Dexie table (verified — the real side-effect map)

**Before you change a table, read this row.** Regenerate it with the `rg` command in §13.

Four modules write to almost every table and are omitted from the rows below to keep
them readable — assume they touch everything:
`lib/db/index.ts` (seeding), `lib/auth.ts` (`purgeLocalDeviceData` clears all),
`lib/backup/cloudBackupService.ts` (restore), `lib/firebase/firestoreSync.ts` (cloud pull).

| Table | Feature code that writes it |
| :--- | :--- |
| **`businesses`** | `app/invoice-designer/page.tsx` (update)<br>`app/settings/page.tsx` (update)<br>`components/layout/Navbar.tsx` (update)<br>`lib/invoices/invoiceNumberService.ts` (update) |
| **`cash_expenses`** | `app/cash-register/page.tsx` (delete,put)<br>`components/sales/SalesReturnModal.tsx` (put)<br>`lib/suppliers/supplierLedger.ts` (put — cash supplier payments, category `supplier_payout`) |
| **`cash_registers`** | `app/cash-register/page.tsx` (put,update) |
| **`categories`** | `app/products/page.tsx` (put)<br>`components/settings/DataMaintenanceTab.tsx` (clear)<br>`lib/constants/defaultProducts.ts` (put)<br>`lib/import/catalogImportDb.ts` (bulkPut — sections of an imported price list) |
| **`customers`** | `app/billing/page.tsx` (put,update)<br>`app/customers/page.tsx` (delete,put)<br>`app/khata/page.tsx` (put,update)<br>`app/transactions/page.tsx` (update)<br>`components/invoices/EditInvoiceModal.tsx` (update)<br>`components/khata/SettleInvoicesModal.tsx` (update)<br>`components/sales/SalesReturnModal.tsx` (update) |
| **`inventory_movements`** | `lib/import/catalogImportDb.ts` (bulkPut — opening stock, only when the sheet has a stock column)<br>`app/billing/page.tsx` (put)<br>`app/inventory/page.tsx` (put)<br>`app/products/page.tsx` (put)<br>`app/purchases/page.tsx` (put — in one transaction with the stock)<br>`app/transactions/page.tsx` (put)<br>`components/dashboard/DashboardHome.tsx` (put)<br>`components/invoices/EditInvoiceModal.tsx` (put)<br>`lib/inward/stockEntryDb.ts` (bulkPut — "New stock + labels", §9.8)<br>`lib/purchases/billInwardDb.ts` (bulkPut — supplier bill, §9.8)<br>`components/sales/SalesReturnModal.tsx` (put) |
| **`ledger_transactions`** | `app/billing/page.tsx` (put)<br>`app/customers/page.tsx` (put)<br>`app/khata/page.tsx` (delete,put,update)<br>`app/transactions/page.tsx` (put)<br>`components/invoices/EditInvoiceModal.tsx` (put)<br>`components/khata/SettleInvoicesModal.tsx` (put)<br>`components/sales/SalesReturnModal.tsx` (put)<br>`lib/suppliers/supplierLedger.ts` (put, modify — `party_type: 'supplier'` rows) |
| **`marketing_templates`** | _only the four shared modules above_ |
| **`products`** | `app/billing/page.tsx` (put)<br>`app/inventory/page.tsx` (update)<br>`app/products/page.tsx` (delete,put,update)<br>`app/purchases/page.tsx` (update)<br>`app/transactions/page.tsx` (put)<br>`components/dashboard/DashboardHome.tsx` (update)<br>`lib/import/catalogImportDb.ts` (bulkPut — Excel import, new + updated items)<br>`lib/barcode/storeBarcodes.ts` (update, bulkPut — a saved barcode for items that get a label)<br>`components/invoices/EditInvoiceModal.tsx` (update)<br>`lib/inward/stockEntryDb.ts` (bulkPut — "New stock + labels": new items + restocks, §9.8)<br>`lib/purchases/billInwardDb.ts` (bulkPut — supplier bill, §9.8)<br>`components/sales/SalesReturnModal.tsx` (update)<br>`lib/constants/defaultProducts.ts` (bulkPut)<br>`lib/products/variants.ts` (put, bulkPut, update, delete — parent + variants in one transaction, §9.1) |
| **`purchase_bills`** | `lib/purchases/billInwardDb.ts` (put — with the bill's stock, one transaction) |
| **`sales`** | `app/billing/page.tsx` (put)<br>`app/transactions/page.tsx` (clear,put)<br>`components/invoices/EditInvoiceModal.tsx` (put)<br>`components/khata/SettleInvoicesModal.tsx` (put)<br>`components/sales/SalesReturnModal.tsx` (update) |
| **`sales_returns`** | `app/transactions/page.tsx` (clear)<br>`components/sales/SalesReturnModal.tsx` (put) |
| **`suppliers`** | `lib/suppliers/supplierLedger.ts` (put, update, delete) — the only writer; every balance change is one Dexie transaction with its ledger row |


### Route guard (`AppShell.tsx`)

```
no user            → redirect /auth               (unless public route)
user, locked       → redirect /auth               (master password not entered, §12 #10)
user, no business  → redirect /onboarding
user + business    → /auth and /onboarding bounce to unlockDestination() (the saved page, else /)
```

**Lock now / auto-lock when idle (v4.65.0).** `lockApp(pathname)` in
`lib/auth/masterPassword.ts` removes the sessionStorage unlock flag, saves the page in
sessionStorage `kamai_return_to` (only a shop page — `safeReturnPath`) and fires
`auth_changed`; AppShell then shows the password screen. After the password
`unlockDestination()` sends the shop back there (AuthForm reads it *before* the shell
clears it on arrival). Triggers: Navbar store menu → **Lock now**, and
`components/layout/IdleLock.tsx` (inside the unlocked shell) — pointer / key / wheel /
touch use resets the timer; a 15 s check compares against the clock, so a PC that slept
past the limit locks on wake. Time per computer in localStorage `kamai_idle_lock_minutes`
(Off / 5 / 10 / 15 / 30 / 60, default **10**), chosen in the store menu. Open bills
survive (they are in `kamai_pos_tabs`). Suite 9 §8z; Electron E2E "Lock now" → back on
Products.

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
0. customer typed on the counter row (no one picked from the list)      (v4.68.0)
     resolveBillCustomer(all customers, {name, phone})
       saved mobile / the only customer with that name → that customer
         (same name saved without a mobile + mobile typed → mobile filled in: db.customers.update)
       wrong mobile / two customers with that name     → refused, cursor to that box
       otherwise                                       → db.customers.put(new customer)
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
6. close the bill tab FIRST — tabsAfterSale(prev, soldTabId, soldCart, …)          (v4.74.0)
     items scanned while 1–5 ran (cart beyond soldCart) move into the next bill;
     activeTabIdRef → the next bill, so a later scan never lands in the sold one
7. setActiveSaleForInvoice → InvoiceModal, or silent print if enabled
     silent: billPrint.print(...) — NOT awaited (components/billing/BillPrintQueue.tsx);
     answer {ok:false} → toast + red "did not print" bar with Print again  (v4.74.0)
```

**Rules for this function:**
- There is **no customer pop-up** on the counter (v4.68.0). `components/billing/PosCustomerRow.tsx`
  is one row — name box + mobile box, saved customers listed underneath (↑ ↓ Enter / click).
  What is typed lives on the bill tab (`customerName` / `customerPhone` in `kamai_pos_tabs`)
  until step 0 saves it. Credit / short cash with no customer puts the cursor in the name box
  (`focusPosCustomerName`). Address / GSTIN are edited on `/customers`.
- Dexie writes come first and are awaited. Cloud calls are `void`-ed and never awaited.
  If you `await` a cloud call here, you have broken offline billing.
- Never reorder 2 before 1 (you would burn an invoice number on a failed bill) or
  3 before 2 (you would skip a number).
- Never `await` the printer here, and never close the tab with the live `cart` — use
  `soldCart` (the cart when Enter was pressed). Both lost the next customer's scans (§9.7).
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
└── <I18nProvider>          language: en/hi/mr, localStorage key `vyapar_language` (§7.1)
    (└── <LicenceGate>      sits here, between the two — activation screen until licensed)
    └── <AppShell>          'use client' — auth guard, route classification, lockout
        └── <BusinessProvider>            ◄── THE single db.businesses live query
            ├── <Navbar>                  store menu, language, lazy MerchantQRModal, 🔊 SoundToggleButton
            ├── <Sidebar>                 4 sections, Ctrl+B collapse, prefetch={false}
            ├── <main><FeatureGate>{children}</FeatureGate></main>   ◄── the route renders here
            │                                (switched-off screen → "turned off" card, §9.2)
            ├── <DesktopStatusBar>        online/printer/clock/version; the page's keys; "Bill rules" / "Help" links (v4.78.0)
            └── <GlobalDrawers>           right-edge "Transactions" pull-tab (recent bills; was "History" before v4.78.0)
                                          (hidden on /billing)
```

**`BusinessProvider` rule:** the active business is queried **once**, here. Read it with
`useBusiness()`. Before v4.38.0 thirteen components each ran their own
`db.businesses.toCollection().first()` live query — that is 13 IndexedDB subscriptions
firing on every navigation. Do not reintroduce one.

Components outside the provider (`/auth`, `/onboarding`, `/invoice`, `/pay`) must query
the DB directly — `useBusiness()` returns `undefined` there.

### Global Keyboard Shortcuts (v4.76.0, v4.78.0)

One list in `lib/ui/globalShortcuts.ts` (`globalShortcutFor` — run by `AppShell.tsx` while the
shop is open; `globalShortcutHints` — shown by the status bar, so it never advertises a dead key):
- `Ctrl + H`: Home (`/`) from any page — **also while typing** (the POS search box always has
  the cursor; Ctrl keys type no text).
- `Ctrl + L` (v4.78.0): lock the screen (`lockApp(pathname)`, like Navbar → Lock now) — also
  while typing. After the master password the app returns to that page.
- `Shift + B`: Billing (`/billing`) — ONLY on Home (`/`) and never while typing (it types "B").

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
| `feature_switches_changed` | `setFeatureSwitch` → every `useFeatureSwitches()` (Sidebar, Home, form, ProfitMask…) |
| `sound_mute_changed` | `setSoundMuted` → SoundToggleButton |
| `kamai_settings_tab` | `openSettingsTab` (`lib/ui/settingsLinks.ts`, status bar) → Settings switches tab in place (v4.78.0) |

### localStorage keys (complete, verified)

`kamai_user` · `kamai_session_timestamp` · `kamai_pos_tabs` (open POS bills) ·
`kamai_master_password` (salted hash) · `kamai_idle_lock_minutes` · `kamai_whats_new_seen` ·
`kamai_sidebar_collapsed` · `kamai_products_view_mode` · `kamai_products_manually_cleared` ·
`kamai_thermal_paper_width` · `kamai_silent_print` · `kamai_print_upi_qr` ·
`kamai_cash_drawer_enabled` · `kamai_saved_bt_printer_mac` ·
`kamai_soundbox_lang` · `kamai_soundbox_vol` · `kamai_last_backup_time` ·
`kamai_last_backup_type` · `kamai_last_restore_time` · `kamai_app_installed` ·
`kamai_pwa_banner_dismissed` · `kamai_cashier_owner_pin` · `kamai_cashier_privacy_locked` ·
`kamai_print_settings` (bill printers) · `kamai_label_settings` · `kamai_last_import_ids` ·
`kamai_label_handoff` (Purchases → Barcode Studio labels) · `kamai_stock_entry_draft` (typed "New stock" rows) ·
`kamai_feature_switches` · `kamai_sound_muted` · `vyapar_language`

sessionStorage (emptied when the app closes): `kamai_unlocked` · `kamai_return_to`.

> Note the legacy prefixes: the DB is `VyaparSetuDB` and the language key is
> `vyapar_language`. **Do not "tidy" these** — renaming them orphans real shops' data.

### 7.1 Language — English / हिंदी / मराठी (v4.63.0)

The whole UI is translated. **The English text is the message id** — there is no key file.

```tsx
import { tr, msg } from '@/lib/i18n/core';
<h1>{tr('Complete Sale & Print')}</h1>
showToast(tr('Only {count} left for "{name}".', { count, name: p.name }));
const TABS = [{ id: 'all', label: msg('All') }];   // constant list: mark with msg() …
<span>{tr(tab.label)}</span>                         // … and translate where it is shown
```

- `src/locales/hi.json` / `mr.json` are flat `{ "English": "translation" }` maps (≈1,940
  entries). A missing entry falls back to English, so nothing breaks — but **suite §8x
  fails the build** until both files have it, with the same `{placeholders}`.
- Never `tr(\`… ${x}\`)` (it can never be found) — use `{name}` placeholders. §8x checks.
- Never wrap ids, tones, CSS classes or locale options (`tr('error')`, `tr('en-IN')`).
- JSX text in a screen must go through `tr()`; §8x parses every UI `.tsx` and lists bare
  English. Exempt on purpose: print documents (`components/invoices/print`,
  `components/reports/print`, `InvoicePreview`), `/invoice`, `/pay`, the UI kit, and
  brand words (KamaiPlus, Google Pay, PhonePe, Paytm…).
- **Stay English:** anything saved in the DB (ledger notes, stock-movement reasons,
  "Cash Customer", "General"), printed bills / PDFs, WhatsApp share texts, Excel template
  headers. The shop's own data (product / category names) is never translated.
- Raw ids shown as badges go through `paymentMethodLabel()` / `expenseCategoryLabel()`;
  report period chips keep the English id (`REPORT_PERIOD_LABELS`) and show `tr(p)`.
- Only the chosen table is loaded (dynamic import). `I18nProvider` holds the first paint
  until it is loaded and remounts the app on a change (open bills live in localStorage).
- `<LanguageSwitcher>` pills sit on the licence, master-password and store-setup
  screens; inside the app the Navbar store menu changes it (and `business.language`).
- Adding text: wrap it, then add the English → Hindi / Marathi lines to both json files
  (keep them sorted), run the suite.

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

### 9.0 Unlimited stock is the default for a new product (v4.68.0)

Same as the Android app: Add Product opens with **"Unlimited Stock (no count)"** on
(`is_unlimited_stock: true`, no stock boxes, no opening-stock movement). Switching it off
fills stock **10** and low-stock alert **10** (`DEFAULT_COUNTED_STOCK` in
`lib/products/variants.ts`); an edited product that was already counted gets its own
numbers back. Variants of an unlimited product are unlimited too (the matrix shows ∞).
Billing, returns, inventory, valuation and alerts already skip unlimited items
(`tracksOwnStock`). Other creators keep their own rule: POS "unknown barcode" quick-add
= 50 counted, Excel / bill inward = the quantity received.

### 9.2 Feature switches — Settings → Features (v4.69.0)

A shop hides what it does not use. **Per feature, never per trade** — nothing may branch
on `business_type` (Suite 9 still bans it, and the identifier `featureToggles`; the
module is `featureSwitches`). Switching off only hides; no data is deleted.

| Switch | Default | Off means |
| :--- | :--- | :--- |
| `cash_register`, `purchases`, `suppliers`, `gst_reports` | off | not in Sidebar / Home tiles / Home links; the address shows `<FeatureGate>`'s "turned off" card. `purchases` off also hides Bulk Inward (Excel) on Products and in the Add Product form. |
| `product_selling_price` | off | Add Product shows only **MRP (required)**; the item sells at MRP (`selling_price = mrp`). An existing item whose price ≠ MRP still shows both boxes (`showSellingPriceField`) so a save never changes its price. |
| `product_cost_price`, `product_hsn`, `product_gst_rate`, `product_size_colour`, `product_variants` | off | field not shown; a new item gets 0 / empty / 0 % GST, an edited one keeps its value. |
| `profit_privacy` | **on** | off = no "Cashier Privacy" button anywhere, `isProfitHidden()` always false, Reports show profit without the owner PIN. |

- Stored **per computer** in localStorage `kamai_feature_switches` (one licence = one
  computer), read through `useFeatureSwitches()` (re-renders on `feature_switches_changed`).
- With an owner PIN set, the Features tab asks for it (`FeaturesTab` → `OwnerPinPrompt`);
  otherwise staff could switch profit privacy off.
- 🔊 / 🔇 (`SoundToggleButton`, top bar, `kamai_sound_muted`): `playBeepSound`,
  `playSupermarketBeep` and the soundbox voice all return early when muted.
- Suite 9 §9c; Electron E2E checks the new-shop form, menu, "turned off" card, a switch
  going on, and the sound button.

### 9.3 Excel price-list import & the shop's own barcodes (v4.70.0)

`components/import/CatalogImportModal.tsx` (Products → **Import Excel**, Inventory →
Excel Import; mounted only while open, `xlsx` loaded with `await import`). Steps: file →
**column check** (`ImportColumnMapper`: every column's role is guessed from its heading —
English / Hindi / Marathi, e.g. `Item (आयटम)`, `Price (भाव)`, `Per (प्रति)`, `Section` —
and can be changed) → **preview** (`ImportPreview`: new / updated / no change / skipped,
with the reason) → import.

- **The sheet's price is the selling price** (`selling_price = mrp = price`; an MRP column,
  if present, sets MRP). No wholesale / margin logic, no invented cost price.
- **Upload again = update.** A row finds its saved item by barcode, else by the item name
  built from it (`buildItemName` is deterministic for the same sheet), and only changed
  fields are written; items missing from the sheet are left alone; unmapped columns never
  overwrite saved values; stock is never overwritten on an update.
- Name = item [+ `– company`] [+ `(pack)`]. Names starting with a size / number get their
  section in front (`चौरसा 8 वाला`, option on the column step). A "company" cell that is a
  pack size (`1 Piece`, `5 नग`, `50 Box/Case`) is not a company. Two rows with the same
  name get `– section`; still the same → the later row is skipped.
- `प्रति` → unit (`mapUnit`): बॉक्स/Box → box, युनिट → piece, पॅकेट → packet; a pack of many
  (`100 नग`, `10 थैली`) is sold as one box / bundle and the pack text goes into the name.
- Section column → categories (created once, reused by name). No stock column → items are
  **Unlimited stock** (scanning never blocked). No HSN / GST column → none / 0 %.
- **Barcodes:** every new item gets its own saved code unless the sheet has one:
  EAN-13 with the GS1 in-store prefix `200` + running number + check digit
  (`nextStoreBarcodes`, never reused). Labels (Barcode Studio queue, 1-click label) call
  `ensureProductBarcode` first, so **a printed code is always saved on the item**
  (before v4.70.0 they printed `KP…` / the id's first 10 characters, never saved — every
  such label said "unknown barcode" at the counter).
- Tested with the real 825-row fireworks list: 796 items, 29 rows without a price skipped,
  50 categories, 796 unique valid codes; re-upload with 2 prices changed → 2 updated, 0 new.
  Suite 9 §9d; Electron E2E imports and re-imports a sheet with Hindi headings.

### 9.4 Barcode labels — any printer, any size (v4.71.0)

- **Setup per computer** (`lib/labels/labelSettings.ts`, localStorage `kamai_label_settings`):
  label stock (rolls 50×25, 38×25, 38×25 2-across, 50×25 2-across, 40×30, 50×30, 75×50,
  100×50; A4 sheets of 24 / 40 / 65; or a custom roll: width, height, 1–5 across, gap),
  label printer ('' = print dialog), print without dialog, what the label shows (shop,
  name, price, MRP when higher, digits, date, QR instead of bars; since v4.77.0 size /
  colour and a cost code in the shop's 10-letter word — `labelExtras.ts`), default copies.
  Edited in `LabelSetupPanel` — Settings → Invoice & Bill Rules (`LabelPrinterCard`),
  Barcode Studio and the 1-click label share it, with a **Test print**.
- **One HTML for preview and print** (`buildLabelHtml`): sizes in mm; a roll is one row of
  labels per page (`@page` = across × width + gaps by height), an A4 sheet one sheet per
  page. Names render in Nirmala UI (Devanagari). The preview is that HTML in a sandboxed
  iframe (`LabelPreview`). Printing: `printLabels` → `printHtml(…, 'label', {pageSizeMm})`
  → `kp:print` (Electron) or the iframe dialog (browser).
- **Barcode Studio** (`app/barcode-generator`, < 300 lines + `components/labels/`): add one
  item, a whole category, all items, or the **last Excel import** (`kamai_last_import_ids`,
  new + re-priced items; the import's done screen links to `?from=import`); copies for
  all or "= stock". Every catalogue item gets a saved barcode before it is listed
  (`ensureProductBarcodes`). Bluetooth ESC/POS stays as a secondary button (ASCII only).
  Since v4.77.0 also **"New stock + labels"** and **loose packs** (§9.8). The old "Custom
  label" (`CustomLabelModal`, a `KP…` code saved nowhere — "unknown barcode" at the
  counter) is gone: every label now belongs to a saved item.
- **Bar codes** (`barcodeGenerator.ts`): valid EAN-13 → EAN-13 (all store codes), digits of
  even length → Code-128 C, anything else → Code-128 B. **Verified with ZXing** (the
  decoder in `html5-qrcode/third_party`): every check value, 300 store codes and real
  EANs decode (Suite 9 §9e); label images rendered at ~203 dpi decode too.
- Real-app check (printing caught in the main process and rendered to PDF): 50×25 → one
  50×25 page per label; 38×25 2-across → 78×25 pages; A4 → one A4 page; custom 60×40 to a
  chosen printer → silent. Electron E2E does the same for "Print labels" after an import.
  **Not tested on a physical label printer** — the driver may need the same size set in
  its own preferences.

### 9.5 Barcode gun on the counter & the bill printer (v4.72.0)

A USB gun types the code into whatever has focus and presses Enter. On the POS that is
normally the product search box (it has focus when Billing opens and after every add).

- **The search box reads the scan itself** — `handleSearchEnter` in `app/billing/page.tsx`
  reads the box's whole text on Enter and asks `searchEnterAction` (`lib/billing/scanInput.ts`):
  empty box → finish the bill (if it has items) · a saved barcode → add it · a code nobody
  has (`looksLikeBarcode`: 6+ digits, or 6+ capitals/digits/dashes with 4+ digits) →
  "Add Scanned Barcode" with the whole code · words → the highlighted result (old
  behaviour). The code is cleared from the box and the cursor goes back to it.
- **Loose-pack codes (v4.77.0)** — `handleBarcodeScanned`: the exact barcode first; if no item
  has it, `parseWeighedBarcode` → the item by its store code → `addToCart(item, weight)`;
  only then "Add Scanned Barcode". Cart merges keep 3 decimals (0.25 + 0.5 = 0.75).
- **The key-timing listener** (`useHardwareBarcodeScanner`) stands aside while the search
  box has focus (`ignore: searchBoxHasFocus`) and catches scans when nothing else does
  (e.g. under "Sale completed", where focus is on the page). It times keys by the event's
  own `timeStamp` (stamped when the key arrived, not when the busy page got to it), and
  outside a text box allows 250 ms between keys.
- **"Sale completed" + next customer:** the listener stays on under that window; a scan
  closes it and starts the next bill (`handleBarcodeScanned`). A plain Enter / F10 there
  never completes the bill waiting underneath (§10 #26 still holds: `onlySaleWindowOpen`
  lets only a scanned code through).
- **Bill printer, set once** (`components/billing/BillPrinterSetup.tsx`, gear button next
  to the Silent pill): bill size (80 mm / 58 mm / A4 → `defaultFormat`), the printer for
  that size, "Enter prints the bill straight away" (= `kamai_silent_print`) and a test
  print. Same `kamai_print_settings` as Settings → Printer Setup. Turning Silent on with no
  printer chosen for the bill size opens this first. With it on, Enter saves the bill and
  prints it with no window, and the cursor is ready for the next scan; if the printer
  answers `{ok:false}` the bill is still saved, the error is shown and the bill waits in a
  red bar with "Print again" (v4.74.0 — before, "Sale completed" opened; §9.7).
- Verified in the real app with a CDP key burst (all keys queued at once, 3 ms apart) while
  the page was kept 92 % busy, and by the Electron E2E (§11). Playwright's `keyboard.type`
  waits for each key to be handled, so under a busy page its own gaps grow — do not use it
  to judge the timing listener.
- **No webcam on the counter (v4.73.0).** The camera button (`BarcodeScannerModal`), "Rapid"
  (`RapidScanMode`, also a webcam scanner) and the Bluetooth "POS Hardware" manager
  (`HardwareManagerModal`: Web Bluetooth pairing — no `select-bluetooth-device` handler in
  `main.js` — and roll width / cash drawer / UPI QR switches that only its Bluetooth path
  read) were removed from Billing; the two billing-only files are deleted. The bill printer
  is the ⚙ button (`BillPrinterSetup`). `BarcodeScannerModal` still exists on `/products`.

### 9.6 Search in English letters (v4.73.0)

`lib/search/productSearch.ts`. A shop's names are often Devanagari (`चीटपुट बुलेट टिकटॅक`);
the cashier types English (`chitput`, `tictac`). Every word becomes a **sound key** — its
consonants with similar sounds merged (ट/त/th → t, श/ष/स/sh → s, फ/f/ph → p, ग/ज/g/z → j,
व/w → v, c → k or s, x → ks, ह / h only at the start, m before p/b → n, no doubles) plus a
mark when it starts with a vowel (अनार ≠ नर). Vowels do not decide a match (English
spellings never agree on them) but rank it, without the "a" sound. A query word matches
when its key starts a name word's key or runs on into the next words (`atombomb`); all
query words must match, any order. Order: plain text / barcode match (the old search) →
sound match (penalty: vowels differ +4, joined words +2, not the first word +1) → the
section (Billing only, as before). Keys are cached per name (20 000 entries).
Used by Billing (with category), Products, Barcode Studio's item search and Edit Invoice.
Suite 9 §9g checks real price-list names; Electron E2E types `chaurasa` / `anar special`.

### 9.7 Peak hour — the counter never waits for the printer (v4.74.0)

In a live test with a printer taking 1.5 s, the next customer's first scan vanished 3 of
3 times: `completeSale` awaited the print, then closed the tab with `tabsAfterClosing`,
dropping everything scanned meanwhile; `updateActiveTab` also used the render's
`activeTabId`, so a scan could land in the bill just closed.

- **Close first, print after.** Step 6 of §6.1 closes the tab with
  `tabsAfterSale(prev, soldTabId, soldCart, newTabId, retotalLine)` (`lib/billing/billTabs.ts`):
  `cartBeyond` takes what is in the bill beyond `soldCart` (A sold ×2, now ×3 → A ×1,
  re-totalled via the POS `retotalLine`; a new line comes whole) and puts it into the bill
  the counter goes to (merged into a waiting bill; a held bill is never touched). Nothing
  scanned meanwhile → exactly `tabsAfterClosing`.
- **`activeTabIdRef`** — `updateActiveTab` reads the ref; `completeSale` sets it to the next
  bill at once, before React re-renders.
- **Background print** — `components/billing/BillPrintQueue.tsx`: `useBackgroundBillPrint`
  renders + sends `kp:print` without the counter awaiting it (main.js already queues jobs
  one at a time). `{ok:false}` / throw → toast + `PrintFailureBar` above the customer row:
  "Print again", "Open bill" (InvoiceModal), ✕. No window pops over the next customer.
- **Warm-up** — `warmBillPrinting(business)` runs with the invoice-number warm-up when the
  counter is idle: loads `InvoiceModal`, the logo and renders a sample bill once.
- **One beep context** — `playBeepSound` (`lib/voice/speechParser.ts`) reuses one
  `AudioContext`; one per scan was never closed.
- Suite 9 §9h; Electron E2E: a 1.5 s printer — counter clear in < 1 s and a scan 0.3 s after
  Enter lands in the next bill; `{ok:false}` → red bar, "Print again" prints and it goes.

### 9.8 Label-first stock & inward labels (v4.77.0)

The shop's flow is *goods arrive → label → stick → scan at the counter*. Every way goods
come in now ends with labels that scan, and uses one rule (`lib/inward/stockEntry.ts`):

- **`stockAfterInward`** — a counted item adds the quantity; an "Unlimited stock" item
  **starts counting** from what came in (previous 0, its stale number is not added to).
  Used by "New stock + labels", Manual Inward and the Excel bill. Before, Manual Inward
  added to an unlimited item's number while it stayed unlimited (nothing changed).
- **`labelCopiesFor`** — one label per piece / box / packet, one per lot for kg / gram /
  litre / ml / metre / foot / sqft, at most 999. **`lowStockAlertFor`** — a new counted
  item alerts at about a fifth of what came in (1–10).
- **"New stock + labels"** (Barcode Studio, `?new=1`, also a button on Purchases):
  `components/labels/StockEntryModal.tsx` + `StockEntryRowView.tsx`. A grid: item, price
  (MRP when "Separate Selling Price" is off), [MRP] [cost] [GST] [HSN] per the feature
  switches, qty, unit. Enter walks the row, the last box opens the next row, Ctrl+Enter =
  Save & print. Typing shows saved items (`searchProducts`); a gun scan into the name box
  links a saved code (→ qty) or keeps a new code with name / price from the offline
  dictionary. `planStockEntry` (pure): picked / scanned / **exact name** → restock (never a
  second copy), else new; per-row problems (no qty / price, same item twice, a parent with
  sizes, decimals for pieces, MRP < price). `applyStockEntry` writes products + PURCHASE
  movements in **one transaction**; new items get counted stock = qty, the chosen
  category, the shop's GST mode and a barcode (the scanned one if free, else `200…`).
  Labels go to the print list (and print at once). Rows are a draft
  (`kamai_stock_entry_draft`) until saved.
- **Purchases.** Manual Inward: stock + movement in one transaction, then "Print N labels"
  (`InwardLabelOffer`). Excel bill: `readBillSheet` reads headings like the price-list
  import (Hindi / Marathi, whole words — "Discount" is not the qty, "Unit Price" is not the
  unit), `₹1,250`, a title row, and leaves out Total rows; "Rate" / "Price" is the cost,
  a "Selling / Sale" column or MRP the selling price. A new item **must get a selling
  price typed** (`billLineProblem`) — the old `cost × 1.25` guess is gone. A bill barcode is
  kept only if it is a real EAN / UPC (8–14 digits). `applyBillInward` saves the whole bill
  in one transaction (before: line by line, an error half-way left half the stock); the
  same item on two lines adds up. The done screen (`BillInwardDone`) offers "Print N
  labels". Labels reach the Studio via `saveLabelHandoff` → `?from=inward`.
- **The Excel bill never opened from Purchases (before v4.77.0).** `InwardBillButton` mounts
  `PurchaseInwardOptionsSheet` only while open; the sheet called `onClose()` after reading
  the file, which unmounted the review with it. The sheet now hides behind the review and
  closes with it (Products mounts it always, so it worked there).
- **Loose packs** (`components/labels/LoosePackModal.tsx`, `lib/barcode/weighedBarcode.ts`):
  an item sold by kg / gram / litre / ml / metre, pack sizes in g / ml / cm, price = rate
  × weight. Code = GS1 variable-measure EAN-13 `29` + the item's store-code number (≤ 99999)
  + quantity (thousandths of kg / L / m, or whole g / ml) + check digit. Items with a
  maker's barcode cannot get pack labels (the shop's own code is needed). Stock is cut by
  weight when the pack is sold (§9.5), not when it is packed.
- Suite 9 §9i; Electron E2E types 4 rows (new, exact name, gun scan, kg), prints 29 labels,
  scans the new label into a bill, prints 250 g packs and scans them (0.5 kg), and runs
  Manual Inward + an Excel bill with a missing selling price through to their labels.

### 9.1 Product variants (v4.49.0) — same model as the Android app

Not a per-vertical mode: any shop can use it. `lib/products/variants.ts`.

```
parent  "Cotton Shirt"        has_variants = true, current_stock = 0 — listed, never sold
child   "Cotton Shirt (M)"    parent_id = parent.id, variant_label = "M", size = "M"
child   "Cotton Shirt (XL)"   own selling_price / mrp / current_stock / barcode
```

- **Create:** Add Product → "Variants (Size / Colour)" switch (new products only) →
  presets (S…3XL, 28…42, colours) or custom labels → price / MRP / stock / barcode per
  row. `createProductWithVariants` writes parent + children + opening-stock movements
  in one transaction. Later sizes: product list → "Variants ▾" → `VariantsManagerModal`.
- **Children are ordinary products** — billing, stock deduction, returns, reports and
  barcode scanning need no special case. Lists hide children unless searching.
- **POS:** every add path goes through `addToCart`; a parent opens
  `VariantPickerModal` (keys 1–9, out-of-stock rows disabled). While it is open, the
  billing shortcuts **and** the hardware scanner listener are off (Enter would
  otherwise complete the sale; scanner digits would pick variants). Parent cards show
  "from ₹<cheapest>" and "N Variants".
- **Stock:** a parent has no stock of its own. `tracksOwnStock()` keeps it out of low /
  out-of-stock alerts (inventory, products, purchases, dashboard) and valuation;
  manual inward, Edit Invoice and barcode labels do not list parents.
- Editing any product spreads `...editingProduct` first, so variant links survive.
- Deleting a parent deletes its children (`deleteProductAndVariants`).
- No Dexie schema change: children are found by filtering `parent_id` (not indexed).

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
| 23 | **Live A–Z audit (v4.61.0)** — the real app was driven through setup, products, 4 kinds of bills, khata, returns, purchases, suppliers, cash register, settings, PIN, backup, logout / login. Found: (a) after a sale the next bill kept the customer, payment mode, split amounts and bill discount (next customer silently got the discount / the old udhar customer), and with several tabs the app jumped onto a **held** bill and "New Bill" cleared it; (b) Settle Invoices lowered `balance_due`, so `getSalePaymentBreakdown` turned the settled udhar into a cash sale on the bill's date while the khata payment was also counted — cash drawer counted the money twice; a plain khata "You Got" payment left every bill showing its old "Due"; (c) owner PIN defaulted to **1234**, printed on the PIN screen; (d) Store QR / history drawer / rapid scan / purchase sheet ignored Esc; (e) `pl-8.5` (not a Tailwind class) put search icons over the text; (f) new products got `category_id: 'cat_general'`, which no category has ("ITEM" on cards, General count 0); (g) no HSN field in the product form; GST dropdown lacked 3% / 40%; (h) onboarding promised "8 General Retail items" but adds 10 fireworks; (i) "0 bills recorded" beside an inward entry; (j) Link prefetch asked for `route/__next.route.__PAGE__.txt`, stored as `route/__next.route/__PAGE__.txt` → 404s. | (a) `lib/billing/billTabs.ts` `makeEmptyTab` / `tabsAfterClosing`: the finished bill is dropped, the next is a waiting (never held) or blank bill; "New Bill" only closes the dialog; the app opens on a waiting bill. (b) `Sale.balance_due_at_sale` keeps the counter udhar and the breakdown reads it; `lib/khata/billAllocation(.Db).ts` clears bills oldest-first for every khata payment, stores `bill_allocations` on the ledger entry and undoes them on edit / delete; Settle does the same. Transactions ribbon says "Udhar Given". (c) no default PIN — `OwnerPinSetup` sets / resets it with the master password. (d) Esc handlers. (e) `pl-9` / `pl-11`. (f) `lib/products/defaultCategory.ts` → the real "General" id, `category_name` saved. (g) HSN / SAC input; slabs 0, 3, 5, 18, 40 (+12 / 28 as old). (h)(i) text. (j) `resolveExportFile` maps segment payloads. Suite 9 §8w (20 checks, incl. no mojibake / no bad spacing classes). |
| 22 | **Every sidebar click reloaded the whole app (v4.60.0)** — the screen went black for a moment between pages (the `LicenceGate` "checking" screen of the fresh load). `<Link>` navigation fetches `out/<route>.txt?_rsc=…`; `main.js` served it as `application/octet-stream`, Next.js rejects anything but `text/x-component` and falls back to a full page load. | The `app://` handler serves RSC requests (`_rsc` param or `RSC: 1` header) as `text/x-component`, answers a missing payload with a real 404, and sends `.html` / `.txt` with `no-cache`. Layout (sidebar, navbar, status bar) now stays mounted; pages swap in place. Suite 9 §8v; Electron E2E clicks 4 sidebar links and checks the app was never reloaded. |
| 25 | **"GSTR-1 JSON" could not be filed (before v4.66.0).** `fp` was taken from the preset name (`'this_month'` has no digits) so every file said **082026**; dates were `yyyy-mm-dd`; a B2B bill was repeated once per line; HSN rows had no `rt` and an old `val`; B2CS was always INTRA; 0 % lines sat in B2B / B2CS; `doc_issue` used `canc`; `cur_gt` was the period's taxable value. The GST page quarters used the calendar year (in Jan 2027 "Q1" would be the future Apr–Jun 2027) and "Full Year" was Jan–Dec. | `lib/gst/gstr1Json.ts` builds the file from the bills: `fp` MMYYYY (quarter = its last month), `idt` dd-mm-yyyy, `b2b` ctin → one `inv` per bill (`inv_typ` R) → items per rate, CGST+SGST or IGST keys only, `b2cs` per state + rate with `typ` OE, 0 % lines → `nil`, `hsn` split into `hsn_b2b` / `hsn_b2c` with `rt`, `doc_issue` per invoice series with `cancel`. Before download the page lists what the portal would reject (no shop GSTIN, items without HSN, wrong buyer GSTIN, B2B invoice number > 16 chars) and asks. Full year → no JSON (GSTR-1 is monthly / quarterly). Periods on the Indian FY; quarters = latest occurrence. **Limits:** counter customers without GSTIN are taken as within the shop's state (no B2CL); partial returns are reported net (no CDNR credit-note table); cess is 0. The `version` string is a best guess — the shop / CA should import the file in the GSTN offline tool once before uploading. Suite 21 (15 checks). |
| 24 | **Language menu changed almost nothing (before v4.63.0)** — `t()` existed but only the Navbar used it; `en.json` held ~40 unused keys, every screen was hard-coded English. | ~1,940 texts wrapped in `tr()` across ~115 files, full Hindi + Marathi tables, badge / period-chip label helpers, language pills before login. Suite 9 §8x (every text translated, placeholders kept, no bare JSX text, no dynamic `tr()`). Live-checked 16 screens in हिंदी and मराठी: only shop data, brands and print previews stay English. |
| 26 | **Enter / F10 completed a hidden bill (before v4.68.0).** With two bills open, completing one opened "Sale completed" on top of the other; pressing Enter (e.g. on the focused Print button) or F10 there completed the waiting bill underneath — found by driving the real app. The customer also needed a pop-up to be added. | Billing shortcuts return early while `counterCovered` (Sale completed, item edit, camera, rapid scan, printer setup, big QR, unknown-barcode windows) or the variant picker is open; the `DialogHost` confirm already captured Enter. Customer typed inline (§6.1 step 0). Credit button shows F9. Suite 9 §9b (19 checks); Electron E2E presses Enter + F10 under "Sale completed". |
| 27 | **Labels that could never scan (before v4.70.0).** An item without a barcode got a code made up at print time — Barcode Studio `KP` + last 6 id characters, the 1-click label the id's first 10 characters (the same `PROD_IMP_1` for every imported item) — and it was never saved, so the counter said "unknown barcode". The Excel importer read only its own template: a real price list (`Item (आयटम)`, `Price (भाव)`…) imported 0 of 825 rows; with a renamed column it lost company / section / unit, invented a cost price and counted stock at 10. | `lib/barcode/storeBarcodes.ts` saves an EAN-13 `200…` code before any label is printed; `lib/import/` imports any sheet by its headings, updates prices on re-upload (§9.3). Suite 9 §9d. |
| 28 | **About 1 barcode label in 3 could not be scanned (before v4.71.0).** Code-128 took the check character's pattern from `Object.keys()` of a character map; JS lists the digit keys first, so check values 0–25 got the wrong pattern and 95–102 had none. ZXing rejected 127 of 400 sample labels. Labels also printed through `window.print()` at A4 even on 50 × 25 rolls. | Patterns looked up by value from the standard 0–106 table; EAN-13 for store codes; Code-128 C for even digits. Labels print at their own mm page size through `kp:print` (`paper: 'label'`). Suite 9 §9e decodes every check value with ZXing. |
| 21 | **Wiring & calculation audit (v4.59.0).** (a) A double Enter / click on Complete Sale could save the cart twice (two bills, stock cut twice, same invoice number). (b) Cash typed in cash mode stayed in the tab and turned a later UPI / card / credit bill into a part payment. (c) Short cash with no customer saved an udhar nobody owed. (d) An overpaid split counted the excess as drawer cash. (e) +/− or re-scanning reset a rate the cashier had edited to the catalogue price. (f) Settings → "Default GST Calculation" did nothing: every product was saved tax-inclusive. (g) Excel import stamped HSN `1905` on every product without one. (h) Changing a balance in customer details wrote no ledger entry. | (a) `completingSaleRef` guard. (b)(c) `typedCashPaise` is read only in cash mode; short cash needs a customer. (d) excess must fit in the cash part and is recorded as `change_returned`. (e) existing lines keep `unit_price`. (f) new / imported products take the shop mode, edited ones keep theirs; cart lines store the resolved mode so POS tax and `saleMath` agree. (g) no HSN = none. (h) the change goes to the ledger on top of the fresh balance. Suite 9 §8u; Electron E2E double-clicks Complete Sale. |
| 29 | **Barcode gun on the counter (before v4.72.0).** The scan stayed in the focused search box and was also caught by the key-timing listener, which timed keys by when its code ran — a busy screen (the "Sale completed" preview being drawn) looked like slow typing and cut the code short ("unknown barcode" with half the code). Enter on an empty box added the first product instead of finishing the bill; scans were ignored under "Sale completed". Silent print ignored a `{ok:false}` answer (bill looked printed); an older toast's timer hid newer toasts. | §9.5: the search box reads the whole code on Enter (`searchEnterAction`), the listener stands aside while it has focus and uses `e.timeStamp`; a scan closes "Sale completed"; `if (!printed.ok) throw` → toast + window; one `toastTimerRef`. Bill printer set once on the counter. Suite 9 §9f; Electron E2E scans, Enter-finishes, scan-under-window and silent print. |
| 31 | **Labels and inward that did not hold up (before v4.77.0).** Barcode Studio's "Custom label" printed a `KP…` code saved on no item ("unknown barcode" at the counter). Purchases → Excel bill: the review never opened (unmounted with the sheet); every Hindi name normalised to "" and matched the first Hindi item; headings were matched by substring ("Discount" → qty, "Unit Price" → unit); `₹1,250` read as 0; a missing selling price became cost × 1.25; lines were written one by one (half a bill on an error; the same item on two lines lost the first); new items ignored the shop's GST mode and got no barcode. Manual Inward into an "Unlimited" item changed nothing. | §9.8: "New stock + labels" saves typed items with stock and a barcode; `readBillSheet` + `billLineProblem` + `applyBillInward` (one transaction); `normalizeName` keeps Indian scripts; `stockAfterInward` starts counting. Suite 9 §9i; Electron E2E. |
| 30 | **The next customer's scan vanished in busy hours (before v4.74.0).** `completeSale` awaited the silent print before closing the bill, so the counter stood still for the printer; scans made meanwhile went into the bill being closed and were dropped by `tabsAfterClosing`; a failed print opened "Sale completed" over the next customer. Every beep created an `AudioContext` that was never closed. | §9.7: close first with `tabsAfterSale` (extras move to the next bill) + `activeTabIdRef`; `BillPrintQueue` prints in the background, failures wait in a red bar; one shared beep context. Suite 9 §9h; Electron E2E slow-printer + failed-print checks. |
---

## 11. Verification protocol (AGENTS.md Rule 6)

Before **every** commit:

```bash
npx tsc --noEmit                    # must be 0 errors
npx tsx scripts/e2e_simulation.ts   # must be 517/517, 0 failures
npx tsx scripts/bump_version.ts     # +0.1 minor, updates package.json + version.ts
git commit -m "<type>(v<NEW>): <description>"
git push origin main
```

Before a **release** (and after touching main.js, licence, login, onboarding or
billing), also run the real app:

```bash
npx next build                      # out/ must be current
npm run test:electron               # scripts/electron_e2e.mjs — 56/56
```

`electron_e2e.mjs` launches the actual Electron app with Playwright (`playwright-core`,
no browser download) and checks: no licence / forged licence → activation screen only;
signed licence → master password → store setup → sell one starter item → one cash bill
in paise, stock −1, no page errors; restart → still licensed offline, master password
asked (even for `/billing`), wrong one refused, data kept, error log empty. Since v4.68.0
also: Add Product opens unlimited (off → 10 / 10), a customer typed on the counter row is
saved and linked to the bill, F1 / F2 / F4 / F8 / F9 / Esc work, and Enter / F10 under
"Sale completed" never complete the bill waiting behind it. Since v4.69.0: a new shop's
Add Product form (MRP only), menu without the switched-off screens, the "turned off" card,
a switch going on in Settings → Features, and the 🔊 / 🔇 button. Since v4.70.0: an Excel
sheet with Hindi headings is imported (saved barcodes) and re-imported with a new price.
Since v4.71.0: "Print labels" after the import sends one 50 × 25 mm page per label (the
test catches `kp:print` in the main process and renders PDF — no real printer). Since
v4.72.0: gun scans typed into the search box add the items, Enter on the empty box finishes
the bill, the next scan closes "Sale completed", and a bill printer set once on the counter
gets the next bill silently with no window (`kp:print` caught; Silent is switched back off).
Since v4.73.0: "chaurasa" / "anar special" typed in English add the Hindi-named items, and
the counter has no camera / Rapid / hardware buttons. Since v4.74.0: with a printer taking
1.5 s the counter is clear in < 1 s and a scan made meanwhile lands in the next bill; a
failed print shows the red bar and "Print again" prints it. Since v4.77.0: "New stock + labels" (4 rows typed / scanned →
items with stock and barcodes, 29 labels printed, the new label scanned into a bill), 250 g loose
packs scanned as 0.5 kg, Manual Inward and a supplier Excel bill through to "Print labels" (§9.8).
Its data goes to a temp folder via `KAMAI_E2E_DIR` (main.js honours it only
when `!app.isPackaged`). The licence is **signed for this PC with the private key** in
`%USERPROFILE%\KamaiPlus-Secrets\` (or `KAMAI_LICENCE_PRIVATE_KEY`) — nothing is
bypassed; without the key only the no-licence checks run. The script removes
`ELECTRON_RUN_AS_NODE` (set by VS Code terminals), which otherwise stops Electron
launching. Failure screenshots go to `%TEMP%\kamaiplus-e2e-shots\`.

### Test suite map — `scripts/e2e_simulation.ts` (517 assertions)

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
   checks every advertised key is handled). Since v4.78.0 also the app-wide keys of the page
   (`globalShortcutHints`: Shift+B on Home, else Ctrl+H; Ctrl+L everywhere — on Billing only
   on 2xl screens) — Suite 9 §9j(b). The real bindings, POS-local in
   `src/app/billing/page.tsx`:
   | Key | Actual |
   | :--- | :--- |
   | F1 | New bill tab |
   | F2 (or `/`) | Focus product search |
   | F4 / F8 / F9 | Payment = cash / UPI / credit |
   | F10 or Enter | Complete sale |
   | Esc | Clear search |
   | ↑ ↓ + Enter (in search) | Pick a product from the results |
   | Ctrl+1 … Ctrl+9 | Switch to bill 1…9 |
   | 1–9 (variant picker open) | Pick that size / colour |
   | Ctrl+B | Toggle sidebar (global) |
   None of F1/F2/F4 do anything outside `/billing`. **Since v4.68.0 none of the billing
   keys fire while a window covers the counter** (`counterCovered`, §10 #26) — verified
   key by key in the real app; the Credit button shows "F9" like Cash "F4" / UPI "F8".

2. ~~`/pay` was unreachable when logged out~~ — **fixed in v4.47.0**: `AppShell` treats
   `/pay` like the public `/invoice` link (no login, standalone layout).

3. **The route guard references 8 pages that do not exist** — `/terms-of-service`,
   `/privacy-policy`, `/refund-policy`, `/contact-us`, `/features`, `/about`,
   `/download`, `/plans`. Harmless today (dead branches), but do not assume they exist.

4. ~~`useProSubscription()` always returns Pro.~~ **Resolved in v4.43.0** — the whole
   Pro / subscription layer was deleted (see §10 #16).

5. ~~Size / colour fields only rendered if already set~~ — **fixed in v4.47.0**: a
   "+ Add size / colour" link opens them on any product.

6. ~~Repo weight~~ — **cleaned in v4.62.0** (owner asked): `dist/` (930 MB of old
   installers + `win-unpacked`) and `.next/` (205 MB) deleted — both regenerate on the
   next build; the stale Android APKs were already gone. `release/` (what
   `release:publish` uploads) is kept. Also removed: `.github/workflows/build-android.yml`
   (tried to build a Capacitor Android app from this repo on every push — there is no
   `android/` folder, so it could only fail), `FEATURE_REGISTRY.md`, the stale
   `firestore.rules`; old docs moved to `docs/archive/`. CI (`deploy.yml`) now runs
   `tsc`, the test suite and `next build` on every push. `dist/` grows by ~110 MB per
   build — delete it now and then (`rm -rf dist`).

7. **There is no cloud sync.** The app never signs in to Firebase Auth (login is a
   local master password, `AuthForm.tsx`), but the deployed Firestore rules (owned by
   the Android repo) require `isBusinessOwner` → `request.auth.uid`, so every write
   was rejected. **Since v4.43.0 this is explicit:** `CLOUD_SYNC_ENABLED = false` in
   `lib/firebase/cloudAvailability.ts` short-circuits every cloud path (`lazyCloud`,
   `backgroundSync`, `syncEngine`, onboarding, Cloud Backup buttons show a message).
   Turning cloud sync on needs a real Firebase login first — then flip the flag.

8. ~~Every bill read the whole `sales` table~~ — **fixed in v4.43.0**, see §10 #17.

9. ~~Dashboard statically imported Firebase~~ — **fixed in v4.43.0**, see §10 #18.

10. ~~The master password was not asked when the app restarted~~ — **fixed in
    v4.58.0** (owner asked for it). Found by `electron_e2e.mjs`: the signed-in user
    stays in localStorage, so a restart went straight to the dashboard. Now
    `masterPassword.ts` keeps a `kamai_unlocked` flag in **sessionStorage** (Electron
    empties it when the app closes; page changes and crash reloads keep it).
    `AppShell` treats a signed-in user without it as locked: only `/auth` (and the
    customer `/invoice`, `/pay` links) render, every other route redirects there.
    `AuthForm.performLocalLogin()` sets the flag; unlocking a still-signed-in shop
    keeps its stored user (owner name) and only renews the session time.
    Electron E2E checks it (restart → password, `/billing` blocked, wrong password
    refused). **Idle lock + "Lock now" added in v4.65.0** — see the route-guard section (§4).

11. ~~Code-128 check character wrong~~ — **fixed in v4.71.0**, and worse than first thought
    (≈ 1 label in 3, see §10 #28).

12. **A click in the first moment after unlocking can be undone** by the unlock's own
    redirect (AuthForm and AppShell both `router.replace` to the saved page). Seen only when
    automated; the Electron E2E waits for the redirect before clicking. Harmless in practice
    (the page opens on the second click).

13. ~~USB barcode gun on the POS~~ — **fixed in v4.72.0** (§9.5, §10 #29). Not yet tried with a
    physical gun + thermal printer in a shop; the fix was proven with queued key bursts.

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
6. New screen text → `tr()` + Hindi / Marathi lines in `src/locales/` (§7.1).
7. A change the shop will notice → one short line in `src/lib/whatsNew/changelog.ts`
   under the version the bump will give (+ its hi / mr lines). It pops up once after the
   update. Internal changes get no entry.
8. `npx tsc --noEmit` → `npx tsx scripts/bump_version.ts` → `npx tsx scripts/e2e_simulation.ts`
   (the suite checks the changelog is not newer than the app) → commit → push.
9. **Update this file** if anything here became wrong. Same commit.

### "What's new" (v4.67.0)

`lib/whatsNew/changelog.ts` (`CHANGELOG`, newest first, texts are `msg()` ids) +
`components/whatsNew/WhatsNewModal.tsx` in the unlocked shell. It opens once when this
computer has not seen the running version (localStorage `kamai_whats_new_seen`; a shop
without the key — updated from before v4.67 — sees everything after
`WHATS_NEW_BASELINE` 4.62.0). Onboarding writes the key **before** `setStoredUser`, so a
brand-new shop never gets the pop-up. Also opened by the status-bar version number and
Settings → Help & Support ("What's new" card, "All updates"). Suite 9 §9a.
