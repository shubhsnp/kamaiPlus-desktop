# Business vertical plan — app dukaan ke prakar ke hisaab se (Desktop → Android → Sync)

> **Shuru:** 2026-10-09 (Desktop v4.117.0). **Kyun:** `docs/DESKTOP_AUDIT_2026-10-09.md` ki findings.
> **Crash / naya session:** pehle neeche "Abhi kya chal raha hai" padho, phir us step ka "Kaam log".

## Rahul ke faisle (2026-10-09)

1. Mere suggestion table (audit ke baad, section 3) ke hisaab se — **kirana mein Barcode Studio nahi**.
2. **GST vertical se nahi, GSTIN se** tay ho.
3. **Stock counting band = counter par koi stock check nahi.**
4. **Restaurant chunne par restaurant mode khud on** (AU-04).
5. AU-15 (har vertical ka preset) — Claude tay kare.
6. AU-22 (pharmacy batch / expiry + doctor / patient) — banana hai.
7. **Settings se Features poori tarah hatana**; category chunte hi app us vertical jaisa ban jaye.
8. **Purane customers par koi asar nahi.**
9. Android aur Desktop ek jaise + sync — ek-ek karke, sab likhte chalo, kaam se pehle note.

## Niyam jo har step par lagenge

- **Purani dukaan = kuch nahi badlega.** Naya tareeka sirf un dukaano par jo naye store setup se bani hain — pehchaan: localStorage `kamai_vertical_profile` (v4.118.0 se onboarding likhta hai). Ye key nahi = purana raasta, bilkul waisa hi (`readFeatureSwitches` same code path).
- Admin Console ke forced switches abhi bhi sabse upar (support ka control bana rahe).
- Har step: kaam se pehle "Kaam log" mein likho → code → Suite 9 test → `tsc` → suite → `help_impact` + HELP_SYNC row → version +0.1 → local commit (push / release nahi — memory "no push").

## Preset (AU-15 — Claude ka faisla)

✅ on · — off · **G** = sirf GSTIN ho to

| Switch | Kirana | Pharmacy | Kapde | Electronics | Retail | Restaurant |
|---|---|---|---|---|---|---|
| khata | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| customers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| inventory | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| stock_counting | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| product_barcode | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| barcode_studio | — | — | ✅ | ✅ | ✅ | — |
| purchases | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| suppliers | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| cash_register | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| sales_reports | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| invoice_designer | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| product_selling_price | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| product_cost_price | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| wholesale_price | ✅ | — | — | — | — | — |
| product_size_colour | — | — | ✅ | — | — | — |
| product_variants | — | — | ✅ | ✅ | — | ✅ |
| payment_keys | ✅ | — | — | — | — | — |
| whatsapp | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| profit_privacy | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| product_gst_rate | G | G | G | G | G | — (Set-up ka ek %) |
| product_hsn | G | G | G | G | G | — |
| gst_reports | G | G | G | G | G | G |
| Restaurant mode | — | — | — | — | — | ✅ (Admin "Off" kare to band) |

## Steps

| # | Step | Findings | Status |
|---|---|---|---|
| A1 | Vertical profile engine: preset upar wala, restaurant mode khud on, GST switches GSTIN se, Settings se Features tab hatana. Purani dukaan same. | AU-04, AU-15, AU-07 | ✅ v4.118.0 `bf8e86d` |
| A2 | Stock counting band = counter par stock check / badge nahi | AU-30 | ✅ v4.119.0 `2e139dc` |
| A3 | GST GSTIN se: bina GSTIN "BILL OF SUPPLY", store setup mein GSTIN (optional), restaurant GST 0 / 5 | AU-12, AU-25 | ✅ v4.120.0 `e7edd7d` |
| A4 | Sample data har vertical: GST 2.0 rate (sirf GSTIN par), retail = general items, kapde mein variants, restaurant unlimited, electronics 10, sahi hint, sirf vertical ki categories; units strip / plate / portion | AU-03, 08, 16, 21, 26, 29, 30 | ✅ v4.121.0 `054b4d3` |
| AU-01 | Admin-delete wipe: backup pehle, startup intezaar nahi, sirf is PC ki dukaan | AU-01 | ✅ v4.122.0 |
| A5 | Pharmacy: batch no. + expiry (item, bill line, bill print, expiry alert) + doctor / patient (bill) | AU-22, AU-13 | ✅ v4.126.0 |
| A6 | Electronics: IMEI / serial + warranty bill line par | AU-13 | ✅ v4.127.0 |
| A7 | Restaurant: KOT printer chunna; printer nahi = "sent" nahi | AU-31 | ✅ v4.123.0 `e149c99` |
| AU batch | AU-02 restore poora, AU-05/18 lookup sirf Google, AU-09, AU-17 Day Summary khata, AU-19 estimate text, AU-23 HSN + unit, AU-27 placeholder, AU-32 restaurant terms | — | ✅ v4.124.0 |
| A8 | Category cards sach bolein; Bible / contract / FUTURE_SCOPE update | AU-13, AU-20, AU-28 | ⬜ |
| B1 | Android: wahi preset table + profile (Android repo) | parity | ✅ Android commit (retail, hardware naam, GST GSTIN se) |
| B2 | Android: batch / expiry, IMEI, doctor / patient fields same naam se | parity | ✅ (expiry yyyy-MM, patient_name) |
| C1 | Sync: `business_type` + naye fields (batch_number, expiry_date, imei_serial, doctor_name, patient_name) dono taraf — `CLOUD_DATA_CONTRACT.md` dono repo mein | sync | ✅ v4.128.0 (Desktop test) + Android test |

## Abhi kya chal raha hai

**A3** code + tests (v4.120.0) — commit ke baad agla **A4** (sample data + units).

## Kaam log

### A1 — Vertical profile engine (plan, kaam se pehle)
- Naya `src/lib/business/verticalProfile.ts`: `VERTICAL_PROFILE_KEY = 'kamai_vertical_profile'` (`{ v: 1, vertical, gst }`), `verticalSwitches(vertical, gst)` = poore switches upar wali table se (ek hi jagah — AU-07).
- `featureSwitches.ts` `readFeatureSwitches`: profile ho to base = `verticalSwitches(profile)` + app ke khud likhe switch (`kamai_feature_switches`, jaise Excel import ka wholesale) + Admin forced. Profile nahi = aaj wala code path same.
- `isRestaurantMode`: Admin ne `restaurant_mode` true / false bheja to wahi; nahi to profile `restaurant` = on.
- Onboarding: profile likhe (feature switches nahi); `cloudStoreRestore` bhi profile likhe (copy hatao).
- GSTIN Settings mein badla → profile `gst` badle (`BusinessProvider` business padhte hi milata hai).
- Settings → Features tab hatao (sab dukaano se — sirf dikhane wali list thi, koi kaam nahi badalta).
- Tests: Suite 9 — preset table, purani dukaan (profile nahi) same switches, restaurant auto + Admin Off, GSTIN → GST switches, Features tab nahi.

### A1 — kya hua (2026-10-09)
- Naya `src/lib/business/verticalProfile.ts` (preset table `VERTICAL_BASE`, `verticalSwitches`, `saveVerticalProfile`, `syncVerticalGst`).
- `featureSwitches.ts`: profile ho to category ke switches (+ app ke khud set kiye, + Admin); `adminRestaurantChoice`; `isRestaurantMode` profile `restaurant` = on, Admin true / false jeetta.
- `onboardingSubmit.ts` + `cloudStoreRestore.ts`: profile save, purane switches hatao; dono copy wale preset table hataye (AU-07).
- `BusinessProvider.tsx`: GSTIN ↔ profile `gst`.
- Settings → Features tab hataya (`FeaturesTab.tsx` delete, `?tab=features` → Store); `FeatureGate` se Settings link hata; khata-off toast ka text.
- Tests: Suite 9 "v4.118.0" block (preset, purani dukaan same, GSTIN, restaurant + Admin off); purane Features-tab asserts badle. Electron E2E: store setup ke baad profile hatata hai (E2E ki dukaan = purana customer), Features-tab checks badle; smoke se `?tab=features` hata. Suite 915/915 + version row.
- **Seekh:** Python se file likhne par CRLF ban gaya → Suite ka "
" wala check fail; files wapas LF (memory `python-edits-crlf`).
- Baaki (scripts jo v4.107 se pehle hi toot chuke the): `full_live_audit.mjs`, `stress_1000_audit.mjs` Features ke checkbox dabate hain — ye audit scripts hain, CI nahi; baad mein theek.

### A2 — Stock counting band = counter par stock check nahi (plan, kaam se pehle)
- Counter (`posCartActions.ts` aur jahan "Out of Stock" / "Only {count} left" rokta hai) `isFeatureOn('stock_counting')` padhe: band = koi rok / chetavni nahi, card par stock badge / "OUT OF STOCK" nahi.
- Stock ka hisaab (bikri par ghatna) chalta rahe — chhupa hai, data waisa hi (switch on karne par sahi number).
- Purani dukaan: `stock_counting` default on → koi farq nahi (sirf jahan Admin / restaurant ne off kiya).
- Test: Suite 9 + (agar ho sake) Electron.

### A2 — kya hua (2026-10-09)
- Naya `src/lib/billing/stockRule.ts` `countsStockAtCounter(item, stockCountingOn)`.
- Counter ke saare stock rok: `posCartActions.ts` (add / scan, available stock, + button, quantity box), `billing/page.tsx` (search Enter), `PosCatalogPanel.tsx` (card "Out of stock" / low), `VariantPickerModal.tsx` (size picker) — sab is niyam se. `PosProductCard.tsx` `showStock` = stock badge nahi.
- Bikri par chhupa stock ghatna waisa hi (`posSaleActions.ts`).
- Purani dukaan: stock counting default on → farq nahi.
- Tests: Suite 9 "v4.119.0" block.

### A3 — GST GSTIN se (plan, kaam se pehle)
- Bill heading: profile wali dukaan + GSTIN nahi + apna title nahi → "BILL OF SUPPLY" (bina GST column / tax table); GSTIN ho → "TAX INVOICE". Purani dukaan: waisa hi.
- Bina GSTIN wali profile dukaan mein bill par GST na lage: counter / sale par line ka `tax_rate` 0 maana jaye (sirf profile + bina GSTIN). Dhyan: `saleMath` sabse risky — pehle padhna, kam se kam badlav.
- Store setup mein optional GSTIN box (validateGstin); bhara = profile `gst: true`.
- Restaurant: Set-up GST default bina GSTIN 0%, GSTIN ho to 5%.
- Tests + Electron check.

### A3 — kya hua (2026-10-09)
- `verticalProfile.ts`: `gstAllowed()` (profile nahi = haan, purana jaisa), `lineGstRate`, `restaurantGstFor`.
- Item ka GST rate data mein rehta hai (GSTIN aane par sahi rate pehle se); **bill banate waqt** line GST = 0 jab dukaan GST nahi le sakti: counter `posCartActions.ts` (2 jagah), Edit Bill `EditInvoiceModal.tsx`.
- Heading: `invoiceDocument.ts` — profile + GSTIN nahi + heading "TAX INVOICE" → "BILL OF SUPPLY" (dukaan ka apna title rehta). `INVOICE_HEADINGS` mein BILL OF SUPPLY.
- Store setup: optional GSTIN box (`validateGstin`), shop row par save, profile `gst`; restaurant Set-up GST 0 / 5.
- `BusinessProvider`: GSTIN badla → restaurant GST bhi. `SetupDialog`: bina GSTIN GST band + note.
- Tests: Suite 9 "v4.120.0" block.
- Note: bina GSTIN GST band hai to GST bills mein 0 → `statutory` false → GST column / tax table pehle se nahi chhapte.

### A4 — Sample data + units (plan, kaam se pehle)
- `defaultProducts.ts`: GST 2.0 rate (12% hatao; CA se confirm), retail = general store items (patakhe nahi), clothing ek variants wala item (Kurti S/M/L), electronics 10 items, restaurant dishes `is_unlimited_stock: true`, pharmacy unit `strip` + batch / expiry baad mein (A5).
- Hint text sahi (`CATALOG_HINTS`), categories sirf vertical ki (+ General) — profile wali nayi dukaan ke liye.
- Units: `strip`, `plate`, `portion` MASTER_UNITS + Excel `mapUnit` (cloud contract §4.1 se mel).

### ⏸️ RUKA (2026-10-09 raat — laptop battery) — yahan se shuru karo
- Commit ho chuke (local, push nahi): A1 `bf8e86d` v4.118.0 · A2 `2e139dc` v4.119.0 · A3 `e7edd7d` v4.120.0.
- **A4 adhoora, commit NAHI hua** (version abhi 4.120.0):
  - ✅ disk par: `storeProfiles.ts` MASTER_UNITS mein strip / plate / portion; `catalogImport.ts` UNIT_WORDS mein strip / plate / portion.
  - ⬜ baaki: `defaultProducts.ts` naya STARTER_PRODUCTS_BY_CATEGORY (GST 0/5/18, pharmacy unit strip, kapde mein variants T-shirt / shirt / jeans / kurti, electronics 10, restaurant 10 unlimited + Paneer / Biryani Half-Full, retail = stationery / household — patakhe nahi) + seed function mein `variants` aur `is_unlimited_stock`; `db/index.ts` seedBusinessStarterData: vertical di ho to sirf "General" + vertical ki categories; onboarding `CATALOG_HINTS` sahi count + hi / mr; Suite 9 "v4.121.0" test; bump 4.121.0, changelog, HELP_SYNC row, commit.
  - Seekh: bada Python heredoc bash quoting se toota — agli baar Python script file mein likh kar chalao.

### A4 — kya hua (2026-10-10)
- `defaultProducts.ts`: har category ke 10 sample (GST 0 / 5 / 18 — CA se confirm), pharmacy goliyan `strip` mein, kapde ke 4 item size variants ke saath (apna stock), restaurant ki dishes `is_unlimited_stock` + Paneer / Biryani Half-Full, electronics 10, retail = stationery / household (patakhe nahi). Seed function variants (parent + children) aur unlimited bana sakta hai.
- `db/index.ts`: category wali dukaan ko sirf "General" + apni categories (AU-16); purana raasta same.
- Units strip / plate / portion (`storeProfiles.ts`, Excel `mapUnit`).
- Onboarding hints sahi (10 har ek) + hi / mr.
- Tests: Suite 9 "v4.121.0".
- Purani patakhe list `DEFAULT_STARTER_PRODUCTS` sirf `ensureStarterBusinessIfEmpty` (purani dukaan) ke liye bachi.

### Agla: AU-01 (startup par bina backup wipe) — plan, kaam se pehle
- `AppShell.tsx` ka tombstone check: (1) `cloudAcc.bizId` hatao — sirf is PC ki apni dukaan; (2) wipe se pehle `runAutoBackup({ force: true })` (backup na bane to wipe nahi); (3) app ka khulna Firestore ka intezaar na kare — check background mein, hydration pehle; (4) test Suite 9.

### AU-01 — kya hua (2026-10-10)
- Naya `src/lib/cloud/deletedStore.ts`: `idsToCheckOnThisPc` (apni dukaan + cloud dukaan sirf jab sync on), `storeDeletedInCloud`, `wipeAfterCloudDelete` (force backup → `backupIsSafe` → tabhi purge; backup nahi = data rehta).
- `AppShell.tsx`: check background mein (app khulna nahi rukta). `syncEngine.ts`, `firestoreSync.ts`: wahi backup-pehle wipe.
- Tests: Suite 9 "v4.122.0".

### Agla: AU-24 (Cloud Functions Node 20 → 22) — plan, kaam se pehle
- Android repo `functions/package.json` engines `"node": "22"`; `firebase-functions` / `firebase-admin` version check; `npm --prefix functions test`. **Deploy NAHI** (Rahul ke OK par) — sirf code + test, Android branch par local commit.

### AU-24 — kya hua (2026-10-10)
- Android `functions/package.json` engines node 20 → 22; tests 93/93 (Node 22). Commit `a93573f` (branch feat/desktop-health-message). **Deploy baaki** (Rahul ke OK par, `FUNCTIONS_DISCOVERY_TIMEOUT=120`). AU-01 Desktop commit `63ef1b2`.

### A7 — kya hua (2026-10-10)
- `kot.ts` `printKot`: desktop par KOT printer chuna nahi = `{ noPrinter: true }`, kuch print nahi (pehle Windows jahan chahe bhej deta tha).
- `OrderScreen.tsx` Send KOT: noPrinter → sawaal "Mark as told to the kitchen anyway?" → haan par hi "In kitchen". Reprint / cancel slip: "no kitchen printer chosen".
- Electron E2E: sawaal aaye to "Yes, kitchen knows". Suite 9 "v4.123.0".

### Agla: AU-23 (GST screen HSN + unit) aur AU-17 (Day Summary khata line) — plan
- `gstr1Generator.ts` HSN key mein UQC (`${hsn}_${uqc}_${rt}`), JSON jaisa; HSN row mein uqc dikhe.
- Day Summary: "Udhar received (Khata)" line, cash in hand ke hisaab ke saath.

### v4.124.0 — kya hua (2026-10-10)
- AU-23 `gstr1Generator.ts` HSN key + UQC. AU-17 Day Summary "Udhar received in cash (Khata)" (screen + WhatsApp). AU-02 `cloudStoreRestore.ts` restore = `pullEverything` (sab tables) + pehle backup. AU-05/18 cloud lookup sirf jude Google account se (Firebase bhi tabhi load). AU-19 estimate / Bill of Supply words bill window mein. AU-27 Add Product example naam category se. AU-32 restaurant terms. AU-09 isMounted hataya.

### Agla (plan): AU-10 (blocked key par wipe), AU-11 (Android firebase.json), AU-13 (category cards sach), AU-20 / AU-28 (docs), phir A5 pharmacy batch / expiry + doctor / patient, A6 IMEI / warranty.

### v4.125.0 — kya hua (2026-10-10)
- AU-10 `licence.js` refresh: block ki hui key (`licence.blocked.json` code revoked) se check-in chalta rehta — wipe pahunchta, Unblock par licence wapas + blocked file hatati. Moved / deleted key dobara nahi poochti. Test pem-gated block.
- AU-11 Android `firebase.json` se `kamaiplus` / `website` hosting hataya (commit `6b6a687`).
- AU-28 FUTURE_SCOPE: FS-04, FS-09, FS-10, FS-15 tick.
- Agla: A5 (pharmacy batch / expiry + doctor / patient), A6 (IMEI / warranty), phir AU-13 cards + A8 docs.

### A5 — kya hua (2026-10-10)
- Types: Product / CartItem `batch_number`, `expiry_date` ('YYYY-MM'); Sale `doctor_name`, `patient_name` (cloud contract ke naam; cloudFormat anjaan fields aage bhejta hai).
- Switches `product_batch_expiry`, `bill_prescription` (default off; pharmacy on) + Android Admin Console list (`admin_models.dart`, commit Android side alag).
- `lib/products/expiry.ts` (`cleanExpiry`, `formatExpiry`, `expiryState`).
- Product form Batch No. + Expiry (month) — page → ProductPageDialogs → AddEditProductModal → ProductFormDetails, productActions save / edit.
- Counter: line par batch / expiry, expired par chetavni (rokta nahi — pharmacist tay kare), `PosPrescriptionRow` (patient / doctor) → sale.
- Bill: A4 `lineMeta` Batch / Exp, details Patient / Dr; thermal Batch / Exp + IMEI line.
- Inventory `ExpiryAlertsCard`.
- Baaki (A5 se bahar): batch-wise stock (ek item ke kai batch) — abhi item par ek batch, jaise Android. Excel import mein Batch / Expiry column — baad mein.

### A6 — kya hua (2026-10-10)
- Switch `bill_serial_warranty` (electronics on) + Admin Console list.
- `PosItemEditModal` mein IMEI / Serial No. + Warranty (months) (sirf switch on); `handleSaveEditItem(extra)` line par likhta. A4 `lineMeta` aur thermal (A5 mein) pehle se chhaapte.
- Agla: AU-13 cards + A8 docs, phir B1 / B2 / C1 (Android), phir poora Electron audit + 1000+ products.

### B1 / B2 / C1 — kya hua (2026-10-10)
- Android: `retail` vertical + signup card + 10 samples; `hardware` = "Electronics, Mobile & Hardware", card "Electronics & Hardware" (Desktop card bhi), labels on; GST GSTIN se (`FeatureSwitchesService.init(gstin)`, `syncGstin`; pehle Android par GST chalu hi nahi ho sakta tha); bina GST "BILL OF SUPPLY".
- Android B2: expiry `yyyy-MM` padhta; `patient_name` (model, DB column, checkout, cloud).
- **Paisa bug dono apps mein:** strip ki goliyan "10 per strip" maan kar bilti thi (15 wali strip ki 3 goli = 0.3 strip). Desktop: "Or tablets: N of M in a strip" (naam se ginti, nahi to likho), chips se 0.1 hataye. Android: bina pack size tablet chips nahi, labels "N Tablets".
- Desktop C1 test: doctor / patient / batch / expiry / strip cloud mein aate-jaate (Suite 9 v4.128.0). Android `test/desktop_parity_test.dart`.
- Android suite: 422 + parity; ek fail (quantity_config) theek.

### Agla: poora Electron audit (1000+ products, asli din, stress) — plan
- Naya build (`npm run build`), driver se: har vertical setup, 1000+ products Excel import / bulk, 300+ bills (cash / UPI / udhar / split / discount / return / estimate), khata, purchases, cash register, reports / GST / Day Summary mila kar, search / scan speed, backup / restore, restart. Mile bug → fix + test + version.
