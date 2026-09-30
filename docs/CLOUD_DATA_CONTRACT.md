# KamaiPlus — Cloud Data Contract (Desktop + Android)

> **Status: v1.0 — Rahul ka OK 2026-09-30** (D1 haan, D2 na, D3 jodo — §6).
> **Desktop:** lagu v4.83.0 — `src/lib/cloud/cloudContract.ts` + `cloudFormat.ts`, test Suite 9 §9j(s).
> **Android:** baaki (§7). Yahi file Android repo mein bhi (`docs/CLOUD_DATA_CONTRACT.md`) — dono jagah ek jaisi.
> Tracker: `docs/PLATFORM_TRACKER.md` — F-07, K-P15, Step 1 (§3b).

**Kya hai:** Firestore mein har cheez ka **ek hi naam, ek hi unit, ek hi matlab** — taaki Desktop ka bill
Android par (aur Android ka Desktop par) sahi rakam ke saath dikhe. Dono apps apne andar (Dexie / SQLite)
jo naam chahein rakhein; cloud mein likhte / padhte waqt is contract ke naam use honge.

**Kahan se bana (code padh kar, 2026-09-30):** Android `feat/desktop-licence` (`da1bf6b`):
`lib/services/firestore_sync_service.dart`, `lib/models/models.dart`, `lib/core/database/local_database.dart`
(`processPosBill`), `firestore.rules`. Desktop `main`: `src/lib/firebase/firestoreSync.ts`, `src/types/index.ts`,
`src/lib/sales/saleMath.ts`. Desktop ka cloud sync abhi bhi band (`CLOUD_SYNC_ENABLED = false`, Step 2 ke baad).

---

## 1. Saare niyam (har collection par)

| # | Niyam | Kyun |
| :-- | :-- | :-- |
| R1 | **Path:** `businesses/{bizId}/{collection}/{docId}`. **`bizId = 'biz_' + Firebase uid`.** Har doc ka `business_id` = bizId. | `firestore.rules` → `isBusinessOwner` yahi maangta hai. |
| R2 | **Paisa = integer paise, naam `_paise` par khatam.** Padhne wala sirf contract ka naam padhe — purane bina-`_paise` naam (`price`, `mrp`, `current_balance` …) kabhi nahi (D2: purana data bachana nahi). | Bina `_paise` wale naam ko Android rupaye maan kar ×100 karta tha. |
| R3 | **Samay = ISO 8601, UTC, `Z` ke saath** — JS `new Date().toISOString()`, Dart `dt.toUtc().toIso8601String()`. Padhne wala local time mein badle. | Android bina timezone ke likhta tha. |
| R4 | **`updated_at` = app ka apna ISO string.** Server ka samay sirf `synced_at` (serverTimestamp) mein; padhne wala use Dexie / SQLite mein na rakhe. | Server Timestamp object ko tareekh ki tarah compare nahi kar sakte. |
| R5 | **Haan / na = `true` / `false`.** | — |
| R6 | **Maatra (quantity, stock) = number** (0.25 kg chalega). | — |
| R7 | **Likhna hamesha merge** (`set(..., {merge: true})`): jo field nahi bheja, cloud mein waisa hi rehta hai. **Padhte waqt: field gayab = apna purana value rakho; field maujood par khaali = khaali karo.** Doosre app ke field (Android `batch_number`, `credit_limit_paise` …) padhne wala saath rakhe aur wapas bheje. | Ek app ke save se doosre app ka data na mite. |
| R8 | **Naye record ki ID = `<prefix>_<uuid>`.** Purani ID (koi bhi unique string) chalti rahengi. | Desktop `sale_${Date.now()}` — do counter ek ms mein = ek ID (C12, Step 4). |
| R9 | **Paid-plan / kill-switch field koi app kabhi na likhe, na apne DB mein rakhe:** `is_pro`, `pro_plan`, `pro_expiry`, `pro_activated_at`, `pro_granted_by`, `subscription_tier`, `subscription_expires_at`, `subscription_valid_until`, `razorpay_payment_id`, `coupon_code_used`, `account_disabled`. `account_disabled` sirf live padh kar dukaan band karni hai. | Rules poora write rok dete hain. |
| R10 | **Ek device ki cheezein cloud mein nahi:** Desktop `next_invoice_number`, `is_onboarded`, printer / label setup, feature switches, master password; Android device settings. | Har counter ki apni bill series (Step 4). |
| R11 | **Jo field sirf ek app ka hai, uska naam wahi rahe** (Desktop `anniversary_date`, `loyalty_points`; Android `fit_notes`) — bas paisa ho to `_paise` lage. | Kam naam badlein, kam galti. |

---

## 2. Kaunsa collection

**D1 (faisla): Desktop apni har table cloud mein bhejta hai** — wahi 14 jo backup file mein hain:
`businesses` (dukaan ka doc), `categories`, `products`, `customers`, `suppliers`, `sales`, `inventory_movements`,
`ledger_transactions`, `cash_registers`, `cash_expenses`, `sales_returns`, `marketing_templates`, `audit_logs`,
`purchase_bills`. (Test: cloud tables = backup tables.)

| Collection | Android aaj | Android aage |
| :-- | :-- | :-- |
| dukaan, `products`, `customers`, `sales` | likhta + padhta | contract ke naam (§7) |
| `categories` | sirf padhta (C15) | likhe bhi |
| `ledger_transactions`, `suppliers`, `cash_expenses`, `inventory_movements`, `cash_registers`, `sales_returns`, `purchase_bills` | — (phone par hi) | baad mein padhe / likhe — naam §3.7 |
| `marketing_templates`, `audit_logs` | — | Desktop-only |
| Root `/products`, `/customers`, `/sales`, `/merchants` (admin copy) | likhta | Desktop nahi likhta; admin panel `businesses/{id}/…` padhe (khula sawaal, admin_console) |

---

## 3. Field-by-field

Kolum: **Cloud** · **Type** · **Desktop** (Dexie) · **Android** (model / aaj ka cloud naam) · ⚠ = §5 ki galti.

### 3.1 `businesses/{bizId}` (dukaan)

| Cloud | Type | Desktop | Android | Note |
| :-- | :-- | :-- | :-- | :-- |
| `id`, `business_id` | string | *(local id alag — Step 2 mein `biz_<uid>`)* | bizId | = bizId |
| `owner_uid` | string | *(Step 2)* | `currentUid` | |
| `name` | string | `name` | `storeName` (+ copy `shop_name`, `business_name`, `store_name`) | sirf `name` padho |
| `tagline`, `owner_name`, `phone`, `email`, `address`, `pincode`, `gstin`, `logo_url` | string | same | same | |
| `upi_vpa` | string | `upi_id` | `upiVpa` | |
| `fssai` | string | `fssai_license_no` | `fssai` | |
| `business_type` | string (Android vertical: `grocery`, `pharmacy`, `restaurant`, `clothing`, `hardware` …) | — (Desktop apna `retail` rakhta) | `businessType` | Desktop kabhi overwrite nahi karta; cloud mein dukaan nayi ho to `grocery` |
| `platform` | string | `desktop` | `android_native` | aakhri likhne wala |
| `created_at`, `updated_at` | ISO | same | — | |
| Desktop-only (R11): `drug_license_no`, `pharmacist_reg_no`, `bank_*`, `language`, `currency`, `invoice_prefix`, `terms_conditions`, `footer_message`, `invoice_theme_config`, `gst_pricing_mode`, `upi_ids` | | same | — | |
| Android-only: `fcm_token`, `trial_started_at`, `device_reported_*`, `total_sales_count`, `total_revenue_paise`, `last_sale_at`, `category` | | — (padhta nahi) | same | |

### 3.2 `…/products`

| Cloud | Type | Desktop | Android | Note |
| :-- | :-- | :-- | :-- | :-- |
| `id`, `business_id`, `name`, `barcode`, `category_id` | string | same | same | |
| `unit` | string (§4.1) | same | same | |
| `selling_price_paise`, `mrp_paise`, `purchase_price_paise` | int | `selling_price`, `mrp`, `purchase_price` | `*Paise` | |
| `stock_quantity` | number | `current_stock` | `stockQuantity` | |
| `tax_rate` (%), `is_tax_inclusive` | | same | same | |
| `hsn_code`, `size`, `color`, `imei_serial` | string | same | same | |
| `is_loose_item`, `is_favorite`, `is_active` | bool | same | same | ⚠ C10 |
| `parent_id`, `has_variants`, `variant_label` | | same | same | variants dono mein ek jaise |
| `batch_number`, `expiry_date` | string | — (K-D20; saath rakhta) | same | |
| Android-only: `business_type`, `sub_units_per_pack`, `fit_notes` | | saath rakhta | same | |
| Desktop-only: `min_stock_level`, `sku`, `allow_decimal`, `is_unlimited_stock`, `warranty_period_months`, `supplier_id`, `category_name` | | same | — | |
| `created_at`, `updated_at` | ISO | same | ⚠ C6 | |

### 3.3 `…/categories`
`id`, `business_id`, `name`, `created_at`; Desktop-only `icon`, `color`; Android-only `business_type`. ⚠ C15.

### 3.4 `…/customers`

| Cloud | Type | Desktop | Android | Note |
| :-- | :-- | :-- | :-- | :-- |
| `id`, `business_id`, `name`, `phone`, `address`, `gstin` | string | same | same | |
| `state_code` | string | GSTIN ke pehle 2 ank (bhejta, padhta nahi) | `stateCode` | |
| `current_balance_paise` | int (+ = customer par udhar) | `current_balance` | `currentBalancePaise` | |
| `opening_balance_paise` | int | `opening_balance` | — | ⚠ C9 |
| `credit_limit_paise` | int | — (K-D03; saath rakhta) | `creditLimitPaise` | |
| `is_vip` | bool | `customer_type === 'vip'` | `isVip` | |
| `customer_type` | string | same | — (Android sirf `is_vip` bhejta; iska banaya type Desktop ke `new` / `inactive` mita deta) | |
| `birthday` | `MM-DD` | `date_of_birth` se (saal Desktop apne paas + `date_of_birth` bhi bhejta) | `birthday` | |
| Desktop-only: `date_of_birth`, `anniversary_date`, `email`, `loyalty_points`, `total_spent_paise`, `total_visits`, `last_visit_date`, `notes` | | same (`total_spent`) | — | |
| `created_at`, `updated_at` | ISO | same | ⚠ C6 | |

### 3.5 `…/sales` (bill) — **matlab GST-sahi hisaab ka (Desktop `saleMath.ts`)**

Bill-discount har line par baant kar us line ka GST **chhoot ke baad** lagta hai (`allocateBillDiscount`).

| Cloud | Type | Matlab | Desktop | Android |
| :-- | :-- | :-- | :-- | :-- |
| `id`, `business_id`, `invoice_number` | string | | same | same |
| `customer_id`, `customer_name`, `customer_phone`, `customer_gstin` | string | | same | ⚠ C8 (gstin nahi bhejta) |
| `place_of_supply` | string | | — | ⚠ C8 |
| `subtotal_paise` | int | **GST ke bina ki rakam, saari chhoot ke baad** | `subtotal` | ⚠ C16 (alag matlab) |
| `tax_amount_paise` | int | GST, saari chhoot ke baad | `tax_total` | ⚠ C16 |
| `total_amount_paise` | int | customer ne diya (= subtotal + tax) | `grand_total` | `totalAmountPaise` |
| `discount_paise` | int | **sirf bill-level chhoot** | Σ line `bill_discount_amount` | `discountPaise` |
| `line_discount_paise` | int | sirf line chhoot ka jod | `discount_total` − bill chhoot | *(naya)* |
| `payment_method` | §4.2 | | same | same |
| `split_cash_paise`, `split_upi_paise`, `split_card_paise`, `split_credit_paise`, `split_notes` | | | `payment_split.*` | ⚠ C8 (nahi bhejta) |
| `amount_received_paise`, `balance_due_paise`, `balance_due_at_sale_paise`, `change_returned_paise`, `returned_amount_paise` | int | | same (bina `_paise`) | — |
| `payment_status`, `has_return`, `return_id`, `customer_address`, `notes`, `created_by` | | | same | — |
| `status` | §4.3 | | same | alag shabd |
| `doctor_name`, `table_number` | string | | — | same |
| `items` | array §3.6 | | | |
| `created_at` | ISO UTC | | same | ⚠ C7 |
| `timestamp` (ms), `source` (`desktop` / `mobile_native_pos`), `updated_at` | | | same | |

Phone ka bill Desktop par aata hai to Desktop khud bharta hai: udhar (`credit` = poora, `split` = credit hissa),
`amount_received`, `payment_status`, `created_by: 'android'`.

### 3.6 Bill ki line (`items[]`)

| Cloud | Type | Matlab | Desktop (`CartItem`) | Android |
| :-- | :-- | :-- | :-- | :-- |
| `product_id`, `product_name`, `quantity`, `unit`, `notes`, `returned_quantity` | | | same | same (unit nahi) |
| `unit_price_paise` | int | | `unit_price` | same |
| `gross_total_paise` | int | maatra × rate − **line** chhoot, bill chhoot ke hisse se **pehle** (inclusive = GST andar, exclusive = GST bahar) | `total_amount` + `bill_discount_amount` | same |
| `discount_paise` | int | sirf line chhoot | `discount_amount` − `bill_discount_amount` | *(naya — aaj `discount_type` + `discount_value`, flat = rupaye)* |
| `bill_discount_paise` | int | is line ka bill-chhoot hissa | `bill_discount_amount` | *(naya)* |
| `tax_rate`, `is_tax_inclusive` (bool) | | | same (unset = inclusive) | same (1/0) |
| `tax_amount_paise` | int | line ka GST, saari chhoot ke baad | `tax_amount` | *(naya)* |
| `cost_price_paise` | int | 0 = pata nahi | `cost_price` | same |
| `mrp_paise`, `hsn_code`, `barcode`, `size`, `color`, `imei_serial`, `warranty_period_months` | | | same (`mrp`) | — |

Line ka customer se liya paisa = `gross_total_paise − bill_discount_paise` (+ `tax_amount_paise` agar exclusive).

### 3.7 Baaki tables (D1) — naam Desktop wale (R11), paisa `_paise`

| Collection | `_paise` fields | Andar ki list |
| :-- | :-- | :-- |
| `suppliers` | `current_balance`, `opening_balance` | — |
| `ledger_transactions` (khata) | `amount`, `balance_after` | `bill_allocations[]`: `amount_paise` |
| `cash_registers` (shift) | `opening_cash`, `cash_sales`, `upi_sales`, `credit_sales`, `cash_in`, `cash_out`, `expected_closing_cash`, `actual_closing_cash`, `difference` | — |
| `cash_expenses` | `amount` | — |
| `sales_returns` | `refund_amount` | `items[]`: `unit_price_paise`, `total_amount_paise` |
| `purchase_bills` | `total_amount` | `line_items[]`: `unit_price_paise`, `total_price_paise`, `selling_price_paise`, `mrp_paise` |
| `inventory_movements`, `marketing_templates`, `audit_logs` | — | — |

---

## 4. Shabd-kosh

**4.1 `unit`:** `piece`, `kg`, `gram`, `litre`, `ml`, `packet`, `box`, `strip`, `plate`, `portion`, `pair`, `set`,
`bundle`, `dozen`, `meter`, `foot`, `sqft`, `bottle`, `can`, `bag`, `custom`. (D3: `bottle`, `can`, `bag` Desktop
mein v4.83.0 se.) Desktop padhte waqt `pcs` / `pc` / `nos` → `piece`, `pkt` → `packet` bhi maanta hai; Android `pcs` / `pkt` likhna band kare.

**4.2 `payment_method`:** `cash` · `upi` · `card` · `bank_transfer` · `credit` (udhar) · `split`. Android `card` / `bank_transfer` dikhaye ("Card" / "Bank"), hisaab mein UPI jaisa.

**4.3 `status` (bill):** `completed` · `returned` · `partial_return` · `cancelled` · `draft` (estimate; `EST-` number bhi estimate). Android `refunded` → `returned`, `partially_refunded` → `partial_return` likhe (Desktop purane shabd bhi padh leta hai).

---

## 5. Galtiyan aur haal

| # | Galti | Kiski | Haal |
| :-- | :-- | :-- | :-- |
| C1 | Dukaan ki ID `biz_<8>_<time>`, `biz_<uid>` nahi | Desktop | cloud mein ab `bizId` hi jaata ✅ v4.83.0; local ID `biz_<uid>` Step 2 (login) mein |
| C2 | Paise wale field bina `_paise` (daam ₹0, MRP / bill / udhar ×100) | Desktop | ✅ v4.83.0 |
| C3 | Stock `current_stock` naam se (Android par 0) | Desktop | ✅ v4.83.0 |
| C4 | Dukaan ki row / onboarding mein plan fields (rules poora save rokte) | Desktop | ✅ v4.83.0 |
| C5 | Cloud doc seedha Dexie row maan kar save | Desktop | ✅ v4.83.0 (`fromCloud`) |
| C6 | `updated_at` = server Timestamp | Android | ✅ Android branch `feat/cloud-data-contract` (2026-09-30) |
| C7 | `created_at` bina timezone | Android | ✅ Android branch `feat/cloud-data-contract` (2026-09-30) |
| C8 | Bill push mein `customer_gstin`, `place_of_supply`, split nahi | Android | ✅ Android branch `feat/cloud-data-contract` (2026-09-30) |
| C9 | Customer push mein hamesha `opening_balance: 0` | Android | ✅ Android branch `feat/cloud-data-contract` (2026-09-30) (`customer_type` bhi nahi) |
| C10 | `is_loose_item` padhte waqt chhoot jaata | Android | ✅ Android branch `feat/cloud-data-contract` (2026-09-30) |
| C11 | Bill par stock `increment` **aur** product save par poora overwrite | Android | ✅ Step 4 (2026-10-01): stock / udhar sirf badlav (`increment`) — Android `cloud_counters.dart`, Desktop `cloudOutbox` deltas + `applyCounterDeltas` (§8) |
| C12 | ID `sale_<ms>` / `ledg_<ms>` / `mov_<ms>` | Desktop | ✅ Desktop v4.86.0 — `newId()` = `<prefix>_<ms>_<8 random>` (Android pehle se uuid) |
| C13 | Dukaan ke doc mein `city` = pincode | Android | ✅ Android branch `feat/cloud-data-contract` (2026-09-30) |
| C14 | Chhoot ka matlab alag | Dono | ✅ tay (§3.5, §3.6); Desktop lagu |
| C15 | Categories cloud mein nahi | Android | ✅ Android branch `feat/cloud-data-contract` (2026-09-30) |
| C17 | **Android checkout / cart / payment screen ka total GST-exclusive item ka GST nahi jodta**, aur GST "5% andaza" dikhata — jabki save hua bill GST jodta (cash chips, UPI QR, split sab kam rakam maangte) | Android | ✅ Android branch `feat/cloud-data-contract` — `BillMath` / `cartBillTotals` (K-A14) |
| C16 | **Android ka bill-discount GST kam nahi karta** (GST chhoot se pehle ki rakam par — GST report mein zyada tax); `subtotal` mein inclusive (GST andar) aur exclusive (GST bahar) lines mili | Android | ✅ Android branch `feat/cloud-data-contract` — `lib/core/utils/bill_math.dart`, Desktop ke test bill par paise-paise same (K-A13) |

---

## 6. Faisle (Rahul, 2026-09-30)

- **D1 — khata, suppliers, kharche, stock history cloud mein?** **Haan, Desktop sab bheje** (14 tables, §2).
- **D2 — Android ke asli users ka cloud data?** **Nahi hai** (sab test users) → seedha naye format; purane naam padhne ki zaroorat nahi.
- **D3 — `bottle`, `can`, `bag`?** "Jo theek lage" → Desktop ki unit list mein jode (v4.83.0).

---

## 7. Aage

1. ✅ **Desktop (v4.83.0):** `toCloud()` / `fromCloud()` har table ke liye; `firestoreSync.ts`, `cloudMerge`, onboarding
   inhi se likhte / padhte. Test: ₹100 bill = 10000 paise; phone ke asli format ka product / customer / bill Desktop par
   sahi; har table round-trip exact; plan fields kabhi nahi.
2. **Android:** ✅ C6–C10, C13, C15, §3.5 / §3.6 ke field, §4 ke shabd — `lib/services/cloud_contract.dart`, `test/cloud_contract_test.dart` (branch `feat/cloud-data-contract`). ✅ C16 + C17 (`BillMath`, `test/bill_math_test.dart`).
3. Step 2: Desktop Google login → local dukaan ID `biz_<uid>` (C1 poora).
4. ✅ Step 4: C11, C12 — §8.
5. Koi field badle to **ye file dono repo mein ek saath** badle.

---

## 8. Dono taraf sync ke niyam (Step 4, 2026-10-01)

- **S1 — Stock (`stock_quantity`) aur udhar (`current_balance_paise`) kabhi poori value se overwrite nahi.** Har app
  jo value cloud mein aakhri baar dekhi thi, usse farq `FieldValue.increment(farq)` se bhejti hai. Poori value sirf
  naye record par (cloud mein pehli baar). Desktop: `cloudOutbox` (write se pehle row padh kar farq), ek "round" ek hi
  baar lagta hai (`businesses/{biz}/sync_ops/{round}_{n}`). Android: `CloudCounters` (listener / restore / apna
  bill ka `increment` yaad).
- **S2 — Har write par `synced_at: serverTimestamp()`.** Desktop badi tables (bills, khata, kharche…) `synced_at` se
  aage padhta hai; products / customers / categories / suppliers poore sunta hai (phone ka `increment` `synced_at`
  nahi badalta).
- **S3 — Jo cloud se aaya woh wapas nahi bheja jaata** (Desktop: `markFromCloud` transaction; apne unconfirmed
  writes `hasPendingWrites` chhod do).
- **S4 — Desktop apni dukaan ID rakhta hai:** cloud `biz_<uid>`, Desktop row par apna `business_id`; dukaan ka doc
  Desktop ki apni row par milta hai.
- **S5 — Delete:** product / customer / category / supplier ek taraf delete = doosri taraf delete.
- **S6 — Store barcode (`200…`) ke number bante hain:** Desktop 1–49,999 phir 100,000–549,999; phone 50,000–99,999
  phir 550,000+. (Loose-pack `29…` code mein 99,999 tak aata hai.)
- **S7 — Bill number har device ka apna** (R10): Desktop `INV-…`, phone apna — ek hi series nahi.
- **Test:** Desktop `npm run test:cloud` — asli Firestore + Auth emulator, isi repo ke rules, ek "phone" jo
  Android jaisa likhta hai.
