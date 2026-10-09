# Desktop audit — har vertical (2026-10-09, v4.117.0)

Rahul: "sab vertical ke liye pehle desktop app test karo — bugs, changes, improvement, issue likhte chalo aur sort karte chalo; uske according Android baad me."

**Kaise test hua:** asli Electron app (`out/` build of `3ec8871`, v4.117.0), har vertical ki nayi dukaan
(licence → password → store setup → sample items) — Kirana, Pharmacy, Clothing, Electronics, General Retail,
Restaurant (pehle bina Admin, phir Admin "restaurant mode" ke saath). Har dukaan mein 21 screens + asli kaam
(bill, udhar, khata payment, return, discount, UPI, estimate, variants, KOT, table bill), database se number
mila kar. Saath mein naye code (v4.115–4.117) ka review. Throw-away data folder — asli data nahi chhua.

**Priority:** 🔴 P0 = paisa / data ka nuksaan · 🟠 P1 = galat kaam jo dukaan ko dikhe / bikri ruke · 🟡 P2 = sudhaar · ⚪ P3 = chhoti baat
**Status:** `open` / `fixed vX` / `decision` (Rahul ka faisla chahiye)

**Ginti:** 30 (+ 1 merged) + 2 Android notes — P0 1 · P1 12 · P2 9 · P3 8. Crash / console error: **0**. Paise ka hisaab: **sab sahi**.

### Haal (2026-10-10)
Desktop v4.118.0 – v4.127.0 mein sab findings theek (status column). Baaki: AU-14 (Firestore rules deploy) aur AU-24 (functions deploy) — dono Rahul ke OK par.

### Pehle ye 6 (meri salah, 2026-10-09)
1. **AU-30** restaurant dish "OUT OF STOCK" — bikri rukti hai.
2. **AU-29** General Retail ke sample = patakhe.
3. **AU-12 + AU-03 + AU-25** GST: bina GSTIN "Tax Invoice", purane 12% rate, naya item 0%.
4. **AU-31** KOT bina printer ke "kitchen mein bheja" dikhata.
5. **AU-01** startup par bina backup data wipe.
6. **AU-24** Cloud Functions Node 20 — 30 Oct deadline.

---

## 🔴 P0

| ID | Kya | Kahan | Status |
|---|---|---|---|
| AU-01 | **App khulte hi poora data mit sakta hai, bina backup.** Har launch par (online) `deleted_businesses/<id>` dekha jaata hai — local shop ID, user ka business_id **aur Google cloud account ka bizId** — koi bhi mila to `purgeLocalDeviceData()` saare bills / products / khata mita deta hai. Backup pehle nahi liya jaata. Linked Android cloud shop delete hui to Desktop ka apna data bhi jayega. Startup Firestore ke jawab ka intezaar karta hai (Google se na jude PC par turant "permission denied" — test mein reload ~250 ms, par Google wale PC par kamzor net = der). | `src/components/layout/AppShell.tsx:89-117` | fixed v4.122.0 |

## 🟠 P1

| ID | Kya | Kahan | Status |
|---|---|---|---|
| AU-30 | **Restaurant ki dish stock khatam hone par bikni band — jabki stock dikhta hi nahi.** Restaurant preset `stock_counting: false` (Products par stock chhupa), par sample dishes counted stock ke saath (Paneer 30, Chai 100…, `is_unlimited_stock` nahi). Asli app (bina Admin restaurant mode): Paneer stock 1 → card "OUT OF STOCK", 3 click par sirf 1, toast "Out of Stock … 0 stock remaining". Counter par stock badge (100, 80…) bhi dikhte. (Admin restaurant mode mein Tables screen nahi rokti — wahan stock 0 par atak jaata hai.) Fix: stock counting off = har item unlimited, restaurant sample `is_unlimited_stock: true`. | `defaultProducts.ts` restaurant list, counter stock check (`posCartActions.ts`) | fixed v4.119.0 |
| AU-29 | **"General Retail Store" ke sample mein 10 ke 10 patakhe** (Ladi 1000 Wala Mirchi Bomb, Sutli Bomb, Rocket…), jabki screen kehti hai "Adds 10 general store items (Stationery, Bottles, Household)". `STARTER_PRODUCTS_BY_CATEGORY.retail = [...DEFAULT_STARTER_PRODUCTS]` (fireworks list). | `src/lib/constants/defaultProducts.ts` | fixed v4.121.0 |
| AU-12 | **Bina GSTIN wali dukaan ka bill "TAX INVOICE" + GST** (kirana INV-001: Maggi 12%, Good Day 18% alag GST column; pharmacy, electronics, restaurant bhi). Unregistered dukaan GST nahi le sakti, "Tax Invoice" nahi de sakti — "Bill of Supply" / "Cash Memo" chahiye. Default heading hamesha `TAX INVOICE` (`invoiceDocument.ts:286`, `themeDefaults.ts:25`), GSTIN ho ya na ho. | `lib/invoices/invoiceDocument.ts`, `themeDefaults.ts` | fixed v4.120.0 |
| AU-03 | **Sample items mein purane GST rate.** 22 Sep 2025 (GST 2.0) se 12% slab khatam; biscuit, paani 18% → 5%, ₹2,500 tak ke kapde 5%. Sample data: Maggi 12%, saari pharmacy 12%, LED bulb 12%, Good Day 18%, Mineral water 18%. Product form khud "12% (old slab)" likhta hai — seed data peeche reh gaya. CA se rate pakke karwa lein. | `src/lib/constants/defaultProducts.ts` | fixed v4.121.0 |
| AU-25 | **Ek hi dukaan mein do GST niyam — sample 5% / 12% / 18%, naya item 0%.** Kirana, clothing, electronics, retail, restaurant preset mein "GST rate" field band → har naya item 0% GST. Asli app: ek bill mein "Printed Cotton Kurti (M)" 0% aur "Designer Silk Saree" 5%. GST wali dukaan naye item par GST laga hi nahi sakti; dukaan ko dikhta bhi nahi ki sample item par GST hai. | `onboardingSubmit.ts` presets + `defaultProducts.ts` | fixed v4.120.0 |
| AU-31 | **KOT bina printer ke "kitchen mein bheja" dikhata.** Test PC: koi default printer nahi, bill printer chuna nahi (sirf TSC label printers + PDF). "Send KOT" → toast "KOT sent to the kitchen (T1)", lines "In kitchen". `printKot` → `deviceName: undefined, silent: true`; Windows ne success bola to app ne maan liya. Kitchen ko order mila hi nahi (ya kisi aur printer — TSC — par gaya), screen kehti hai bhej diya. Fix: KOT printer chuna na ho to "Kitchen printer set nahi" aur `markKotSent` nahi. | `src/lib/restaurant/kot.ts:71`, `main.js` kp:print | fixed v4.123.0 |
| AU-24 | **Cloud Functions Node 20 par — Google 30 Oct 2026 ko band** (tracker K-P17; aaj 9 Oct = 3 hafte). `functions/package.json` engines abhi `"node": "20"`. Uske baad `desktopLicence` (licence / block / wipe) ka koi fix deploy nahi hoga. | Android `functions/package.json` | code fixed (Android a93573f) — deploy baaki |
| AU-13 | **Category cards jo vaada karte hain, woh app mein nahi:** Pharmacy "Batch numbers, Expiry dates & Strips" — batch / expiry bana hi nahi (FS-08 / K-D20); Electronics "Serial numbers" — `imei_serial` type mein hai, form / counter par daalne ki jagah nahi; Restaurant "Table orders … KOT" — sirf Admin on kare to. | `src/components/onboarding/CategorySelector.tsx` | fixed v4.126.0 / v4.127.0 |
| AU-21 | **"Strip" unit dukaan chun hi nahi sakti** — `'strip'` type (`types/index.ts:112`) aur counter ka "loose tablets / half strip" (v4.114.0, `posQuantityConfig.ts:89`) hai, par Add Product ki unit list (`MASTER_UNITS`) aur Excel import (`mapUnit`) mein strip nahi. v4.114 ka pharmacy feature kisi dukaan tak nahi pahunchta. Sample "Strip of 15" par unit `box` → bill par "1 box". (Cloud contract §4.1 mein `strip`, `plate`, `portion` — Desktop list mein teeno nahi.) | `lib/constants/storeProfiles.ts`, `lib/import/catalogImport.ts` | fixed v4.121.0 |
| AU-02 | **Cloud se "Restore" karne par bill number 1 se** (`next_invoice_number: 1`) — cloud mein INV-001… pehle se, naye bill ke number takrayenge. "Restore" sirf products + categories laata hai — customers, udhar balance, purane bills nahi. Restore se pehle local tables bina backup saaf. | `src/components/onboarding/cloudStoreRestore.ts:175-213` | fixed v4.124.0 |
| AU-22 | **Pharmacy bill par batch no. / expiry nahi** (aur Schedule H dawai ke liye doctor / patient naam — Bible §9 ne hataye the). Dawai ki dukaan ke cash memo par ye zaroori maane jaate hain. Pharmacy vertical bina iske adhoora. | product + sale types, invoice | fixed v4.126.0 |
| AU-04 | **Store setup mein "Cafe / Restaurant" chunne par restaurant mode nahi aata** — asli app: menu mein Billing POS, Barcode Studio, Inventory & Stock (retail jaisa). Tables / KOT sirf Admin Console se. Faisla: restaurant chunte hi mode on ho, ya card par likho "KamaiPlus support chalu karega". | `onboardingSubmit.ts` CATEGORY_INITIAL_SWITCHES | fixed v4.118.0 |
| AU-33 | **Sales Return dobara kholne par pichhla "Sales Return Completed" dikhta** — bill A ka return → Done → bill B par Return dabao: bill B ke items ki jagah A ka "Credit Note RET-0001 … generated" screen. Dukaandar samjhe B ka return ho gaya. (Window mounted rehti hai, band karne par state saaf nahi hoti.) Stress test se mila. | `src/components/sales/SalesReturnModal.tsx` | fixed v4.129.0 |

## 🟡 P2

| ID | Kya | Kahan | Status |
|---|---|---|---|
| AU-14 | **Live Firestore par `desktop_signals` padhne ki ijazat nahi** — har launch par log: "[DesktopLive] Global / Key signal notice: Missing or insufficient permissions". Android repo ke `firestore.rules` mein `allow read: if true` hai → rules deploy nahi hue. v4.116.0 ka "1 second realtime command" live mein band; sab hourly check-in par. Fix: Android repo se rules deploy (Rahul ke OK par). | Android `firestore.rules:353` | open — rules deploy Rahul ke OK par |
| AU-23 | **GST screen ki HSN summary alag unit wale items jod deti** — pharmacy Dolo (1 box) + Benadryl (1 bottle), HSN 3004 @12% → screen par "Dolo 650… · 2 BOX". Screen key `${hsn}_${rt}` (`gstr1Generator.ts:154`), GSTR-1 JSON `hsn|uqc|rt` (`gstr1Json.ts:153`) — screen aur file alag. | `src/lib/gst/gstr1Generator.ts:154` | fixed v4.124.0 |
| AU-15 | **Vertical presets:** kirana ke liye Purchases + Suppliers off; sab verticals mein Cash Register off; GST Reports off jabki sample items GST le rahe; restaurant (bina Admin) mein Barcode Studio + Inventory on. v4.107 se dukaan khud switch on nahi kar sakti — har nayi dukaan support ko WhatsApp karegi. Har vertical ka preset ek baar tay karein. | `onboardingSubmit.ts` CATEGORY_INITIAL_SWITCHES | decided v4.118.0 (VERTICAL_PLAN preset) |
| AU-17 | **Day Summary mein khata vasooli ki line nahi** — "Cash Collections ₹348", "Net cash in hand ₹548 (After ₹15 expenses)"; beech ka ₹200 (udhar wapas) kahin nahi likha. | Day Summary (`DayEndClosingReportModal`) | fixed v4.124.0 |
| AU-16 | **Har vertical ko "Apparel" + "Accessories"** — universal 5 starter categories + vertical ki apni. Kirana / pharmacy / restaurant counter par 5 khaali chips. | `db/index.ts` seedBusinessStarterData, `storeProfiles.ts` STARTER_CATEGORIES | fixed v4.121.0 |
| AU-05 | Phone number se cloud dukaan dhoondhna kabhi kaam nahi karega — `merchants/wa_<phone>` / `user_<phone>` sirf owner padh sakta (rules). Har nayi dukaan par 5 fail Firestore lookup (log mein 5 warnings). Sirf Google (uid) rasta chalta. | `cloudStoreRestore.ts:118-139` | fixed v4.124.0 |
| AU-07 | Vertical ke feature preset do jagah copy (`onboardingSubmit.ts`, `cloudStoreRestore.ts`) — ek badla, doosra bhool gaye to restore wali dukaan alag chalegi. | dono files | fixed v4.118.0 |
| AU-26 | Clothing sample "T-Shirt (Size M)", "Jeans (Size 32)" alag flat items — variants (preset mein on) ka ek bhi namuna nahi; Add Product kapde ki dukaan mein bhi "Unlimited stock" se khulta (size-wise stock ke liye pehle band karna padta). | `defaultProducts.ts`, Add Product default | fixed v4.121.0 |
| AU-10 | Block ki hui key par "Wipe data & reset PC" nahi pahunchta — block ke pehle jawab par PC `licence.json` hata deta, phir server ko poochta hi nahi. Admin ko lagta wipe gaya. | `licence.js` refresh, Admin Console | fixed v4.125.0 |

## ⚪ P3

| ID | Kya | Kahan | Status |
|---|---|---|---|
| AU-08 | Sample hint galat: electronics "10 items" (asal 8), restaurant "10 menu items (… Biryani …)" (asal 9, Biryani nahi). | `src/app/onboarding/page.tsx` CATALOG_HINTS | fixed v4.121.0 |
| AU-32 | Restaurant ke bill par bhi "Goods once sold can be exchanged within 7 days with bill receipt" (default terms) — khane ke bill par ajeeb. | default terms / restaurant | fixed v4.124.0 |
| AU-19 | Estimate ki window mein "TOTAL BILLED" aur "PDF is always the full A4 Tax Invoice". | `InvoiceModal` | fixed v4.124.0 |
| AU-27 | Add Product placeholder har dukaan mein "e.g. Fortune Sunflower Oil 1L". | product form | fixed v4.124.0 |
| AU-09 | `isMounted` banaya par padha nahi (existing-store gate). | `src/app/onboarding/page.tsx` | fixed v4.124.0 |
| AU-20 | `ENGINEERING_BIBLE.md` §9 / §6.5 aur `CLOUD_DATA_CONTRACT.md` §3.1 abhi bhi "`business_type` hamesha 'retail', koi nahi padhta / ek universal sample" — v4.117.0 ne dono badle, docs nahi (Rule 0.3). | Bible, contract | fixed (Bible §9.0b / §9.0c, contract) |
| AU-28 | `docs/FUTURE_SCOPE.md` purana: FS-04 / FS-15 (v4.104.0), FS-09 (v4.102.0), FS-10 (v4.101.0) tracker mein Done, yahan `[ ]`. | `docs/FUTURE_SCOPE.md` | fixed v4.125.0 |
| AU-11 | Android repo: `website/` delete, par `firebase.json` site `kamaiplus` → `public: website` abhi bhi; `firebase deploy --only hosting` = khaali site. | Android `firebase.json` | fixed (Android 6b6a687) |
| AU-06 | → AU-21 mein mila diya. | — | merged |

---

## ✅ Jo sahi chala (asli app, number database se mila kar)

**Kirana:** bill (cash, 3 items, GST inclusive ₹8.55) · double stock cut nahi · udhar bill naye customer ke saath (balance ₹365, khata entry) · khata "You Got" ₹200 (balance ₹165, INV-002 partial, allocation sahi) · return 1 Maggi (₹15 cash refund, stock wapas, refund cash register mein) · 10% bill discount + UPI (₹182.70, oil 5% GST ₹5.79) · Estimate (EST-001, stock nahi kata, agla bill INV-004) · Home / Day Summary / Reports: bikri ₹895.70, cash ₹548, udhar ₹165, munafa ₹92.70 — haath se check, sab mile · full reload ~250 ms (offline bhi).
**Pharmacy:** HSN 3004 + 12% CGST / SGST sahi (₹13.93 = 6.97 + 6.96) · GST Reports + HSN / GST / cost field on.
**Clothing:** variants S / M / L (stock 5 / 8 / 3), counter picker "2" = M, M stock 8 → 7.
**Electronics:** HSN sahi, CGST / SGST sahi.
**Restaurant (Admin mode):** Billing → Tables & Orders, menu ke shabd (Menu / Guests / Bills), 10 tables, T1 order ₹505, KOT ke baad "In kitchen", Pay cash ₹550 → "Give back ₹45", bill INV-001 "Table T1", 5% GST ₹12.02 + ₹12.02, HSN 9963, UPI QR bill par · Stock / Purchases / Barcode chhupe.
**Har vertical:** 21 screens, koi crash / console error nahi.

---

## 🏪 Poora din — stress test (2026-10-10, v4.128.0 build)

`node scripts/stress_shop_day.mjs` (BILLS=300, ITEMS=1200) — asli Electron app, GSTIN wali kirana store setup se.

| Kya | Nateeja |
|---|---|
| Store setup GSTIN ke saath | profile `grocery`, `gst: true`, GSTIN saved ✅ |
| Excel import 1,200 items (price, MRP, stock, GST, HSN, EAN-13) | 1,200 / 1,200, paise sahi, **3.4 s** ✅ |
| 300 bills barcode scan se (1,055 scans) — cash / UPI / udhar (19 grahak) / 5 % discount / 7 estimate | 293 bills + 7 estimates; INV 1…293 bina gap / duplicate ✅ |
| Har bill ka total = lines ka jod; GST % wali line par GST, 0 % par nahi | 0 galat ✅ |
| 1,200 items ka stock = import − bika + wapas | 0 galat ✅ |
| Home "Today's Sales" bills; Reports total vs database | 293 = 293; ₹2,61,058.05 = ₹2,61,058.05 ✅ |
| GST Reports (GSTIN dukaan) | khulta, DB GST ₹16,934.32 ✅ |
| Console / page error poore din | 0 ✅ |
| Restart → password → sab data | 300 bills + 1,200 items ✅ |

**Speed (1,200 items, 300 bills ke baad bhi):** scan → line ~40 ms · Complete Sale median 115 ms, p95 183 ms · Estimate 84 ms · Products / Inventory / Billing / Reports page 0.2–0.35 s · unlock → home 0.4 s.

## Android (baad mein — yahan sirf note)

| ID | Kya | Status |
|---|---|---|
| AU-A1 | Har bill / product / customer cloud mein **do baar** likha jaata (`businesses/<id>/…` + root `sales` / `products` / `customers` purane band admin portal ke liye) — Firestore kharcha double. | open |
| AU-A2 | Test phone par "Stay awake" (`svc power stayon usb`) on reh gaya — agli baar phone jodne par band karna. | open |
