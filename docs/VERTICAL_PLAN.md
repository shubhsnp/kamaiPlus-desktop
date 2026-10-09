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
| A3 | GST GSTIN se: bina GSTIN "BILL OF SUPPLY", store setup mein GSTIN (optional), restaurant GST 0 / 5 | AU-12, AU-25 | ✅ v4.120.0 |
| A4 | Sample data har vertical: GST 2.0 rate (sirf GSTIN par), retail = general items, kapde mein variants, restaurant unlimited, electronics 10, sahi hint, sirf vertical ki categories; units strip / plate / portion | AU-03, 08, 16, 21, 26, 29, 30 | ⬜ |
| A5 | Pharmacy: batch no. + expiry (item, bill line, bill print, expiry alert) + doctor / patient (bill) | AU-22, AU-13 | ⬜ |
| A6 | Electronics: IMEI / serial + warranty bill line par | AU-13 | ⬜ |
| A7 | Restaurant: KOT printer chunna; printer nahi = "sent" nahi | AU-31 | ⬜ |
| A8 | Category cards sach bolein; Bible / contract / FUTURE_SCOPE update | AU-13, AU-20, AU-28 | ⬜ |
| B1 | Android: wahi preset table + profile (Android repo) | parity | ⬜ |
| B2 | Android: batch / expiry, IMEI, doctor / patient fields same naam se | parity | ⬜ |
| C1 | Sync: `business_type` + naye fields (batch_number, expiry_date, imei_serial, doctor_name, patient_name) dono taraf — `CLOUD_DATA_CONTRACT.md` dono repo mein | sync | ⬜ |

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
