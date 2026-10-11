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

**D — Electron audit poora (v4.129–4.131). E — Android pass code audit (2026-10-10):** AU-A3…A16 fixed + tests (Android commits f6c0486 … 3e83446) — paise boxes, restock / edit GST, Full Void, khata cash + settle, GST 2,000 cap + quarters, counts, drawer double refund, supplier payment save, restaurant charges. Baaki: phone (CPH2691) par on-device check + "Stay awake" band; help sync (4.118–4.131 rows).

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

### D — Electron audit log (2026-10-10)
- `scripts/stress_shop_day.mjs` 300 bills / 1,200 items: sab number DB se mile (bills 1…293, totals, GST, stock, Reports ₹2,61,058.05, restart). Speed: scan ~40 ms, sale 115 ms.
- **AU-33 (bug, fixed v4.129.0):** Sales Return dobara kholne par pichhla "Return Completed" screen — har opening ab saaf.
- Script ki galtiyan (app sahi): estimate ka return app mana karti hai; poora wapas hua bill har screen ki ginti se bahar (isRevenueSale).
- `full_live_audit.mjs` / `stress_1000_audit.mjs`: hata hua Features tab ki jagah switches localStorage mein.
- **AU-34 (paisa, fixed v4.130.0):** Split button ka 50 / 50 `total / 200` → ₹2.01 par 1 paisa udhar. Ab paise mein.
- **AU-35 (fixed v4.130.0):** Day Summary "After ₹915 expenses" jabki ₹915 return refunds the; ab "paid out (₹X return refunds)". Drawer ka number pehle bhi sahi tha.
- **AU-36 (fixed v4.131.0):** atka silent print poori print queue rokta tha (Electron E2E: KOT "Microsoft Print to PDF" par). Ab 45 s limit. E2E restaurant hissa ab bina printer (asli printer par kabhi nahi).
- Electron E2E v4.130: 134 / 135 (sirf yahi KOT); smoke 52 / 52.
- Android AU-A3 (split paise mein) — code + `test/split_math_test.dart` likha, commit Android pass mein.

### Rahul ke naye kaam (2026-10-10, phone test ke beech)
- **N1 Desktop WhatsApp logo:** Desktop mein jahan-jahan WhatsApp hai (button, icon, menu) wahan Android jaisa **official WhatsApp logo / icon**. ✅ v4.132.0 (`WhatsAppIcon` = official mark; Purchases / Help / Support bhi)
- **N2 WhatsApp bill = PDF + text:** jab bhi grahak ko bill WhatsApp par jaye, invoice (PDF) saath mein text ke saath — Android + Desktop dono par confirm. Test number: Rahul ka 9595997711. ✅ Android phone par PDF + text pahuncha (Rahul ne confirm kiya); dono WhatsApp hon to dukaandar chune. Desktop v4.133.0: PDF by default, clipboard par file — Ctrl+V.
- **N3 Android signup: UPI ID optional** (Desktop jaisa; abhi `*` zaroori). Aur Android signup mein GSTIN box nahi (Desktop mein hai) — parity. ⬜

### Realtime sync test (2026-10-10, phone CPH2691 + PC test folder, rahulvjadhav44@gmail.com)
- Pass: phone item → PC ~1–2 s; PC bill → phone; phone bill INV-002 → PC <1 s (no number clash); stock 50 → 47 dono; udhar ₹270 PC → phone, ₹100 Jama phone → PC ₹170 ~2 s; PC daam ₹60 → phone; PC delete → phone.
- Bug fixed v4.134.0: PC phone ki dukaan dhoondh nahi paata tha (Firebase login wapas aane se pehle lookup = permission denied); restore 'retail' (merchants doc), GSTIN nahi, sync off; phone ka 999999 stock = ₹5.5 cr asset. Android: Desktop ka unlimited item phone par 0 stock.
- Gap (salah #3): phone ki khata entry (₹100 Jama) PC par nahi aati — sirf balance.
- **Delete ke baad purana data wapas aane ki asli wajah:** live Firestore rules purane — `deleted_businesses` padhna PERMISSION_DENIED → dono apps ka delete-check chupchaap fail → device data dobara bhejta. Ilaaj: Android repo se `firestore.rules` deploy (Rahul ka OK) + Admin delete saari 14 tables.

### N4 — Sab kuch dono taraf sync (Rahul, 2026-10-10: "dono taraf cloud sync chahiye sab kuch") — S1–S7 DONE (Android `cloud_extra_sync.dart`, Desktop v4.135.0)
Aaj: items, grahak, bills, categories dono taraf; baaki tables sirf Desktop → cloud. Phone ko Desktop ke contract naam (`CLOUD_DATA_CONTRACT.md` §3.7) se bhejna + padhna hai. Har step = Android code + test + commit; Desktop side check (Desktop pehle se 13 tables padhta / likhta).
- [x] S1 khata entries `ledger_transactions` (phone type credit/debit ↔ CREDIT_SALE / PAYMENT_RECEIVED…, `party_id`, `amount` paise, `balance_after`, `payment_method`). Balance NAHI badalna (balance customers ke increment se aata — dohra nahi).
- [x] S2 returns `sales_returns` (phone `sale_returns`) — bill ka status / returned_quantity sales se aata; return receipt alag.
- [x] S3 kharche `cash_expenses` (phone `expenses`), category Refund / Supplier Payment.
- [x] S4 cash shift `cash_registers` (phone shifts).
- [x] S5 suppliers `suppliers`.
- [x] S6 purchase: phone `inward_orders` ↔ Desktop `purchase_bills` (alag cheez — map jitna mel khaaye; na mile to dono app ek doosre ka dikhaye read-only).
- [x] S7 stock movements `inventory_movements` (sirf record; stock khud products increment se).
- Desktop-only rahenge: `audit_logs`, `marketing_templates` (contract §2).
- [x] S8 test (2026-10-10, phone USB par nahi tha → bridge): phone + PC asli sync, har table dono taraf; flutter + Desktop suite; Electron E2E.
- Kaise (N4): phone ki har table par `sync_status` (purani rows 'pending' = ek baar upar jaati hain), 400 ki batch + `synced_at`; cloud se aayi row seedhi likhi jaati hai (stock / udhar / bill nahi badalta), phone ki unsent row par kabhi nahi. Kharche mein `payment_mode` — PC ka UPI kharcha phone ke galle se nahi ghatta. Phone ka 'Desktop ne bill return kiya' ab phone ke bill par bhi dikhta hai (S2). Desktop v4.135.0: phone ki delete hui khata entry / kharcha / PO PC se bhi hatta. Shift history ke banaye hue (09:00–22:00, ₹0) din phone par hi rehte hain. Supplier ki khata (Desktop party_type supplier) phone par nahi — phone mein woh screen nahi.
- Android test: `test/cloud_extra_sync_test.dart` (14). Asli phone + PC test: S8.
- **S8 nateeja (asli Firestore, test shop Sync Test Kirana, Desktop v4.135 build):** phone ka asli Dart code (SQLite) → 12 documents (khata Jama ₹50 cash, kharcha, refund, shift, supplier, return, 2 movements, PO, bill, item, grahak) → cloud → PC 8 s mein: Khata par entry, balance ₹120, Galla par phone ke kharche + shift, Suppliers, Purchases PO-N4-1 ✅. Phone par kharcha delete (cloud) → PC se bhi hata ✅ (v4.135). Ulta: PC par UPI Jama ₹20, bijli ₹15, INV-003 return → cloud ke asli documents phone code mein: UPI Jama galle mein nahi gina (khata cash sirf ₹50), bijli = 'Electricity', INV-003 = refunded, returned_quantity 1 ✅. Mila: Desktop kharcha form ke asli naam (`utilities`, `delivery_fuel`, `salary`, `vendor_payment`, `cleaning`, `misc`) type se alag → Android map theek. **AU-37** (udhar bill return cash mein) → v4.136.0. Baaki: asli phone par ek baar (USB) — listener + upar bhejna.

### Cross-device login (Rahul 2026-10-10: "vahi email se cross device par login → signup form nahi") — v4.137.0 + Android
- Mile: (1) PC ka cloud shop doc sirf `name` → phone `store_name` padhta → "dukaan nahi" → signup form (aur phone usi biz_<uid> par nayi dukaan likh deta). (2) PC par Google jodne ke baad bhi nayi dukaan ka cloud sync BAND → dukaan cloud mein hi nahi. (3) PC store setup: dukaan mile to bhi neeche poora signup form; Google skip kiya to jodne ka rasta nahi. (4) Nayi PC dukaan cloud mein hamesha 'grocery'.
- Ilaaj: PC doc mein store_name/shop_name/business_name; Google wali nayi dukaan = sync ON; setup form dhoondhte waqt ruka (max 12 s), mile to sirf Restore; "Connect Google Account" box; naya type = PC ki category. Android: `CloudStoreRestore` (naam kisi bhi field se, Desktop ka upi_id bhi); signup screen khulte hi + Complete Setup se pehle cloud dekhti → dukaan mile to seedha dashboard.

### Asli phone test (2026-10-10, CPH2691, APK = N4 + login fix + startup fix + sirf En/Hi/Mr)
- Phone ki purani rows (₹100 Jama, movements) khulte hi cloud → PC ✅. Phone par INV-004 (11 items) + EST-001 → PC: bills, stock (Atta 21, Soap 8, Lux 23, Maggi 46), 17 movements ✅.
- PC bill INV-005 (Lux ×1) → phone billing par Lux 22 bina chhue ✅ (realtime).
- **Bug mila + theek (Android 74d9ab5):** phone khulte hi har item / grahak dobara bhejta tha — purana stock cloud ke naye par "farak" ban kar (PC ka return Atta 20 → 19 mita) + `updated_at = abhi` (PC ke naye daam ko harata). Ab startup sirf wahi bhejta jo cloud mein nahi. Live: phone band, cloud Atta 21 → phone khula → 21 hi raha, phone par bhi 21 ✅.
- **Cross-device login live:** cloud doc mein store_name / business_name / shop_name khali (purane PC doc jaisa) → app uninstall + install → usi Google se login → seedha dashboard, signup form nahi; 13 items sahi stock, Khata Sync Grahak ₹100 + 4 entries (PC + phone) ✅.
- Test data note: INV-003 (udhar) ka return v4.135 par cash mein hua tha (AU-37 se pehle) → khata mein ₹100 abhi bhi 'Pending Bills (1)'. Asli dukaan par v4.136 se aisa nahi hoga.

### Rahul ki list (2026-10-10, shaam) — kya ab, kya baad mein
**Ab karna (is kram se):**
- [x] R1 Restaurant P0: chalu table orders cloud se sync — Desktop v4.140.0 (Android next)
- [~] R2 Restaurant P0: dish "Aaj khatam" DONE (v4.138 + Android); "Stock ginein" → FUTURE — (dono devices); item par "Stock ginein" (bottle / packet) — Purchases + Suppliers NAHI chahiye
- [x] R3 Takeaway / delivery (Desktop v4.139.0; Android next)
- [x] R4 UI: veg / non-veg nishaan (Desktop v4.138.0 + Android)
- [x] A-1 Android restaurant form se batch / expiry hatana; settle sheet par packing line
- [x] A-2 Android product form mein HSN box
- [x] A-3 Label par nakli barcode band
- [x] A-4 Android bill edit
- [x] A-5 Android auto-backup
- [ ] A-6 Hindi / Marathi har Android screen par → FUTURE (Rahul: sirf zaroori abhi)
- [x] Purchase order ki nakli "Wholesale Inward Consignment" line (Android 78bf222)
- [ ] Cloud Functions Node 22 deploy — code + tests (93/93) taiyaar, live code = local (desktopLicence 9 Oct); deploy Claude ke session mein roka gaya → Rahul khud chalayein
**Sirf samjhana:** AU-A1 (phone har bill do jagah likhta) — karna nahi.
**Baad mein:** website / help guides sync; phone par A3, A4, A5, A7, A12, A15 checks; Desktop Ctrl+V PDF asli WhatsApp par; installer code-signing; staff login / roles.
- R2 (aadha): "Aaj khatam" ho gaya — product par `sold_out_on` (aaj ki taareekh), kal apne-aap wapas; Desktop menu "Sold out today" mode, Android "Khatam" mode; dono taraf product sync se. "Stock ginein" (bottle) abhi baaki.
- R1 kaise: har chalu order = `businesses/{biz}/restaurant_orders/{orderId}` (dono apps ka same shape); badlaav turant upar, naya `updatedAt` jeetta; bill / cancel = doc delete = sab device se hata. Table ki id naam se (`table_t4`) — do device ek hi order. PC khulne par server ka pehla jawab aane tak kuch nahi bhejta; jo order pehle bheja tha aur ab cloud mein nahi (doosre device par bill ho gaya) woh yahan bhi hatta — wapas zinda nahi hota. KOT: phone ke paas printer nahi → `kotRequestedAt` → PC (Set-up switch) chhaapta + sent mark. Takeaway token: doosre device ka TA-07 dekhkar apni ginti aage.

### Live test restaurant sync (2026-10-10, test shop, Desktop v4.140 build + asli Firestore)
- Phone ke format ka order (T3, Chai ×2, KOT request) → PC par 6 s mein ✅; PC par printer nahi → KOT "sent" nahi maana, request baaki ✅.
- PC ne T3 mein Biscuit joda → cloud doc turant update ✅. PC par bill INV-006 "Table T3" ₹75 → cloud doc delete ✅.
- Cloud se T5 delete (phone par bill) → PC se bhi hata ✅.
- Android suite: sab pass (rapid-scan widget test ek baar timing se fail, akele 6/6).

### FUTURE (Rahul 2026-10-10: "jo important h vahi karo, baki future me")
- A-6 Hindi / Marathi har Android screen par (~1,500 shabd; Desktop jaisa t('English') + hi/mr map, pehle Billing / Checkout / Khata / Products / Home / Galla / Restaurant)
- Restaurant: item par "Stock ginein" (bottle / packet), bill split + table merge, waiter naam + waiter-wise bikri, din ki dish report, Bluetooth KOT asli test + kitchen/bar alag printer, kitchen screen, recipe se kachcha maal, Swiggy/Zomato, QR table order
- Website / help guides sync (HELP_SYNC 4.118 → 4.140 pending)
- Phone checks A3, A4, A5, A7, A12, A15; Desktop Ctrl+V PDF asli WhatsApp par
- Installer code-signing; staff login / roles
- AU-A1 phone root copy (sirf samjhaya — karna nahi)
- Admin Console: permanent delete mein `restaurant_orders` bhi jode (abhi 15 tables)
- Rahul ke haath: Cloud Functions Node 22 deploy (30 Oct se pehle); Android branch feat/desktop-health-message → main merge ka faisla

### Category conflict (proventurein@, 2026-10-10) — v4.141.0 + Android
- Mila: Sharma Resturant (PC par restaurant, 9 Oct) cloud mein 'grocery' (purana PC default); phone ne wahi liya; phone har sync par apni lock category cloud par likhta tha, PC kabhi nahi bhejta tha.
- Ilaaj: cloud `business_type` + `business_type_set_at`; PC: cloud mein bina time wali / purani category ho to apni bhejta, nayi ho to leta (lib/cloud/shopCategory.ts); phone: category lock hai, isliye cloud ki leta (items + categories saath), apni sirf khaali doc mein likhta (shop_category_sync.dart).

### Reset test shop (Rahul 2026-10-10) — Desktop v4.142.0 + Android + Functions + Admin
- Test Gmails list: Firestore `admin_settings/test_accounts.emails` (proventurein@, rahulvjadhav4@, rahulvjadhav44@, vfxaurangabad@gmail.com). Koi app ise padh nahi sakti; badalna = Firebase console.
- Function `resetTestShop` (Android repo functions/test_shop_core.js): status / reset; poora `businesses/biz_<uid>` (har subcollection), root copies, merchants, purana tombstone mitata; naya tombstone NAHI, Gmail band NAHI. **Deploy Rahul karega** (Node 22 deploy ke saath ek hi command).
- Desktop: Settings → Data → "Reset test shop" card (sirf test Gmail par). Cloud pehle; phir backup, phir PC naye install jaisa saaf (licence rehta hai, main.js wipeAppDataAndRelaunch keepLicence).
- Android: Backup & Restore screen par wahi card; cloud pehle, phir backup, sign-out, poora local data + prefs saaf, login screen.
- Admin Console: Permanent delete mein "Sirf data saaf karo" checkbox (no tombstone, Gmail chalu); restaurant_orders bhi ab delete hote hain. Admin hosting deploy Rahul karega.
- Desktop menu: "Log Out / Switch Account" -> "Log out (password to open again)"; woh kabhi dukaan nahi badalta tha.

### Restaurant UI match (Rahul 2026-10-10: "naye screens ka UI apne UI se match nahi hota") — Desktop v4.143.0 + Android
- Desktop: DeliveryDialog naya (mobile pehle, icons, pehchana guest naam + pichla address khud bharta — lib/restaurant/guestLookup.ts, charges, Cancel); OrderPanel guest card (naam / mobile / poora address); MenuPanel sold-out banner; SetupDialog KOT = switch card; PayDialog delivery title fix ("Takeaway DL-01" aata tha).
- Android: naya RestaurantDeliverySheet (AlertDialog ki jagah, khata customer / pichle bill se naam + address); Tables header mein "New takeaway" + "New delivery" do bade button (delivery ek akela icon tha); order sheet guest strip, "Khatam" -> "Sold out" + count + banner, "AAJ KHATAM" -> "SOLD OUT TODAY".
- Phone par screenshot se check baaki (phone disconnect tha).

### Staff sign-in Phase 1 (Rahul 2026-10-10: "jo jaroori hai implement karo, carefully") — Desktop v4.144.0 + Android + Functions + rules
- Server: `staff` function (create_code owner / join staff), onStaffWritten (hataya = sign-out); staff user `kpst_<owner uid>_<staffId>`, claims kp_biz/kp_sid/kp_role. Rules: sirf naye alag `allow` (owner/admin ka kuch nahi badla) — 30/30 Rules-test-API cases (tool/firestore_rules_check.cjs).
- Desktop: Settings → Staff (add, code + QR 15 min, online / not signed in / removed, remove / add back); restaurant settings cloud mein (`restaurant_meta/settings`, PC ka KOT-printer option nahi); order par "by Raju".
- Android: login par "Staff sign-in" (QR / 6 digit) → StaffHomeScreen (sirf Tables; Settle & Bill, Cancel, Sold out, Setup chhupe); StaffShopSync (menu, categories, settings, apni entry, orders); owner ka Menu → Staff page; dukaan chhodna = pehle sync band, phir copy saaf.
- Roles: har vertical ki list dikhti hai; aaj sirf Restaurant Waiter chalta hai. Agla: Cashier / Captain / Kitchen, retail Billing staff (har device ki invoice series chahiye), Stock.
- **Rahul ko deploy karna hai:** functions (staff, onStaffWritten, resetTestShop) + `firestore:rules`.

### Google sign-in browser tab (Rahul 2026-10-10) — v4.145.0
- googleSignIn.js `page(kind, …)`: wordmark, animated ✓ / ✕ / !, Gmail chip, apne classes (extension ka chhupa div pehle khaali card ban jaata tha).

### Restaurant PC = phone (Rahul 2026-10-10) — Desktop v4.146.0 + Android
- GST: bina GSTIN koi GST nahi (PC pehle se sahi tha; phone 5% jodta tha; PC cloud mein 5 bhejta tha) — Android `billingSettings`, Desktop `settingsForCloud(s, gstAllowed())`.
- Shabd: dono par "Guest" (Desktop ke bache 4 "Customer" bhi).
- Android restaurant: Inventory / Expiry radar, Stock box (dish form), Stock Inward hataye (Desktop jaisa).

### Home + Invoice options by vertical (Rahul 2026-10-10) — Desktop v4.147.0 + Android
- Desktop Home: QuickActionDock = Pulse jaisa 2/4 grid; QuickToolsGrid auto-fill 190px (lambe tiles nahi); restaurant = Average Bill (showProfitCard restaurant).
- Invoice options: GST breakup / HSN sirf GSTIN, MRP savings restaurant mein nahi; Android same + Pharmacy Rx sirf pharmacy.
- Android: restaurant se Rapid Barcode Inward hata; Home GST card sirf GSTIN; Home par Add Staff (restaurant).
- Baaki: Android Menu ka kram Desktop sidebar jaisa (agla), vertical-by-vertical Rahul batayega.

### Free trial + version lock (Rahul 2026-10-10/11) — Desktop v4.148.0 + functions + Admin
- Trial: Admin days (platform_settings/desktop_trial), ek computer ek trial (desktop_trials/{machineId}), signed licence {trial:true}; key wale PC par kabhi nahi.
- Version lock: naye apps stable.yml / early.yml padhte hain; purane (Shanishwar 4.98) latest.yml / beta.yml — release unhe sirf `prepare_release.js --legacy` se chhuega. Admin "Hold updates" (update_hold) ek PC par check + install band; hold hone par min_version nahi.
- Pehli release jo naye channel par jaaye: `npm run release:desktop` (stable.yml likhega) — purane installs ko naya version tabhi milega jab `--legacy` diya.
