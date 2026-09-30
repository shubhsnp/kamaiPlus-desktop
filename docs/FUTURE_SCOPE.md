# KamaiPlus Desktop — Future Scope (baad mein karne ke kaam)

> Banaya: 28-09-2026, v4.78.0 ke waqt. Yeh **kaam ki list** hai, code ka naksha nahi —
> code ka naksha `ENGINEERING_BIBLE.md` hai. Koi kaam shuru karne se pehle Bible padhein
> (AGENTS.md Rule 0) aur yahan diye code ke hawale ek baar `rg` se jaanch lein.

**Kaise use karein:** ek item chunein → kaam karein → uske aage `[x]` lagayein aur version
likhein (jaise `[x] v4.85.0`). Naya kaam mile to neeche jod dein (agla ID).

**Priority:** P1 = sabse pehle · P2 = zaroori · P3 = jab samay ho
**Size:** S = 1 din · M = 2–5 din · L = 1–3 hafte · XL = mahina+

---

## Saar (overview)

| ID | Kaam | Priority | Size | Status |
| :-- | :-- | :-- | :-- | :-- |
| FS-01 | Asli dukaan mein pilot, asli hardware ke saath | P1 | M | [ ] |
| FS-02 | Installer par code-signing certificate | P1 | S | [ ] |
| FS-03 | Backup din mein ek baar se zyada | P1 | S | [x] v4.82.0 |
| FS-04 | Billing page (2,208 lines) ko chhote hisson mein todna | P1 | L | [ ] |
| FS-05 | Target dukaan tay karna → roadmap | P1 | S | [ ] |
| FS-06 | Multi-counter / multi-computer sync + maalik ka mobile view | P2 | XL | [ ] |
| FS-07 | Staff login aur roles (kisne bill kaata) | P2 | L | [ ] |
| FS-08 | Batch / expiry tracking | P2 | L | [ ] |
| FS-09 | Purchase return / debit note, purchase order | P2 | M | [ ] |
| FS-10 | GSTR-3B summary | P2 | M | [ ] |
| FS-11 | E-invoice (IRN) | P3 | L | [ ] |
| FS-12 | E-way bill | P3 | M | [ ] |
| FS-13 | P&L, balance sheet, bank reconciliation | P3 | L | [ ] |
| FS-14 | Tally XML ko asli Tally company mein jaanchna | P1 | S | [ ] |
| FS-15 | Baaki badi files todna (Khata, Products, Edit Invoice, Settings) | P2 | L | [ ] |
| FS-16 | Database ke unit tests (fake-IndexedDB) | P2 | M | [ ] |
| FS-17 | Regex source-checks ki jagah behaviour tests | P3 | M | [ ] |
| FS-18 | Chupchaap nigle gaye errors (`catch {}`) ka audit | P2 | S | [ ] |
| FS-19 | Purana / bekaar code hatana | P3 | M | [ ] |
| FS-20 | Manual Inward mein item dhoondhne wala picker | P2 | S | [ ] |
| FS-21 | Purchases ka "Add Single Item Manually" reload hataana | P3 | S | [ ] |
| FS-22 | Excel / CSV export seedha folder mein save | P3 | M | [ ] |
| FS-23 | Hindi / Marathi mein unit ke naam | P3 | S | [ ] |
| FS-24 | Transactions pull-tab right-edge ke buttons dhak leta hai | P3 | S | [ ] |
| FS-25 | Customers page par English se Hindi naam dhoondhna | P3 | S | [ ] |
| FS-26 | AMC / support plan (baar-baar aane wali kamai) | P2 | S | [ ] |
| FS-27 | Doosre software (Vyapar / Marg) se data import | P3 | L | [ ] |

---

## P1 — Sabse pehle

### FS-01 · Asli dukaan mein pilot, asli hardware ke saath — P1 · M
- **Kyun:** ab tak ke saare tests simulated hain. Physical barcode gun, thermal printer,
  label printer aur weighing scale ke saath app kabhi nahi chali (Bible §9.4 "Not tested on a
  physical label printer", §12 #13). Abhi koi live dukaan bhi nahi hai.
- **Kya karna hai:** 1–2 dukaano mein 1–2 hafte chalana; gun se tez scanning, silent print,
  50×25 label roll, loose-pack label scan, din-bhar ka backup, Hindi mode — sab asli mein.
  Har mili galti ka test (Suite 9) + Bible entry.
- **Kahan:** `scripts/electron_e2e.mjs` (jo abhi simulate hota hai), Bible §9.4, §9.5, §9.7.

### FS-02 · Installer par code-signing certificate — P1 · S (+ kharcha)
- **Kyun:** installer unsigned hai → Windows SmartScreen "Windows protected your PC" dikhata
  hai, kuch antivirus flag karte hain. Pehli installation par hi bharosa hilta hai.
- **Kya karna hai:** company ke naam par OV (ya EV) certificate; build environment mein
  `CSC_LINK` / token; pehle signed version ke baad hi `publisherName` jodna.
- **Kahan:** Bible §2.2 "Code signing — not yet" (poore steps wahin likhe hain).

### FS-03 · Backup din mein ek baar se zyada — P1 · S — ✅ v4.82.0
- **Hua:** din ki file ab har ghante nayi hoti hai jab data badla ho aur counter 30 s khaali
  ho (rush mein bhi 2 ghante se zyada nahi rukta). Bible §2.3, §10 #34. Neeche purana plan.
- **Kyun:** automatic backup din mein **ek** baar hota hai. Shaam ko computer / disk kharab ho
  to us din ke bill sirf manual backup se bachte hain.
- **Kya karna hai:** har ghante ya har N bill ke baad backup (din ki file overwrite, 30 din rakhna
  waise hi); pen-drive copy bhi utni hi baar. Bada DB ho to bhi counter dheema na ho — idle
  time par chalayein.
- **Kahan:** `lib/backup/autoBackup.ts` (`runAutoBackup`, `hasTodaysBackup`),
  `components/layout/AutoBackupScheduler`, `backup.js` (main process). Bible §2.3.

### FS-04 · Billing page ko chhote hisson mein todna — P1 · L
- **Kyun:** sabse zaroori screen sabse badi file hai — `src/app/billing/page.tsx` **2,208 lines**
  (niyam 400, AGENTS.md Rule 5). Yahan har badlav sabse risky hai.
- **Kya karna hai:** bina vyavahaar badle hisse alag karna — cart / line edit, search + scan,
  payment panel, sale complete (`handleCompleteSale`), shortcuts. Pehle Electron E2E ke billing
  checks pakke, phir ek-ek hissa nikaalna, har kadam par suite + E2E.
- **Dhyan:** `handleCompleteSale` ka kram (Bible §6.1), `activeTabIdRef`, `tabsAfterSale`
  (§9.7), `counterCovered` (§10 #26) — inhe todna nahi.

### FS-05 · Target dukaan tay karna → roadmap — P1 · S
- **Kyun:** aage ke bade kaam dukaan ke prakar par tike hain.
- **Faisla:** kirana / general retail → FS-06, FS-07 · GST wali / B2B dukaan → FS-10, FS-12
  (aur turnover > ₹5 cr ho to FS-11) · pharmacy → FS-08 · garment / footwear → variants + cost
  code pehle se hain, FS-07.

### FS-14 · Tally XML ko asli Tally company mein jaanchna — P1 · S
- **Kyun:** v4.78.0 mein Tally export dobara likha (balanced vouchers, GST duty heads, no stock
  lines) lekin **asli Tally Prime mein import karke nahi dekha** (Bible §10 #32).
- **Kya karna hai:** ek test company mein ek mahine ki file — Import → Masters, phir
  Import → Transactions. Jo error aaye use `tallyXmlGenerator.ts` mein theek karke test jodna.
- **Kahan:** `lib/tally/tallyXmlGenerator.ts`, `lib/tally/saleBreakup.ts`,
  `components/backup/AccountingExportsCard.tsx`.

---

## P2 / P3 — Business features jo nahi hain

### FS-06 · Multi-counter / multi-computer sync + maalik ka mobile view — P2 · XL
- **Kyun:** ek licence = ek computer (`licence.js`), aur cloud sync band hai
  (`lib/firebase/cloudAvailability.ts` → `CLOUD_SYNC_ENABLED = false`). Do counter stock / bill
  share nahi kar sakte; maalik phone par aaj ki bikri nahi dekh sakta.
- **Kya chahiye:** asli login (Firebase Auth) — Firestore rules (`isBusinessOwner` →
  `request.auth.uid`) Android repo mein hain; conflict ka niyam (stock, invoice number series per
  counter); licence model (ek dukaan, kai computer). Bible §12 #7 mein kaaran likha hai.
- **Kahan:** `lib/firebase/*` (lazyCloud, firestoreSync, backgroundSync), `licence.js`, Admin Console
  (Android repo).

### FS-07 · Staff login aur roles — P2 · L
- **Kyun:** sirf owner PIN hai jo profit chhupata hai (`lib/auth/cashierPrivacy.ts`). Kaun sa
  cashier kaunsa bill kaata, iska record nahi; cashier ko return / discount / delete se rokne ka
  raasta nahi.
- **Kya karna hai:** staff ka naam + PIN, har bill / return / stock badlav par `staff_id`, role ke
  hisaab se permission (discount limit, return, delete, reports), shift report per staff.

### FS-08 · Batch / expiry tracking — P2 · L
- **Kyun:** product mein batch / expiry ka koi field nahi. Pharmacy aur FMCG ke liye zaroori
  (expiry ke paas ka maal pehle bechna, expired ko rokna).
- **Kya karna hai:** batch-wise stock (batch no, expiry, MRP), inward par batch, bikri par FEFO,
  "jaldi expire hone wala" report. Dexie schema version badhana padega (Bible §9 — schema
  badlav ka dhyan).

### FS-09 · Purchase return / debit note, purchase order — P2 · M
- **Kyun:** supplier ko maal wapas karne ya PO banane ka raasta nahi.
- **Kya karna hai:** purchase return (stock ghatana + supplier balance), debit note print,
  PO → inward se jodna.
- **Kahan:** `app/purchases/page.tsx`, `lib/purchases/billInwardDb.ts`,
  `lib/suppliers/supplierLedger.ts`.

### FS-10 · GSTR-3B summary — P2 · M
- **Kyun:** GSTR-1 (JSON bhi) hai, par GSTR-3B ka mahine ka summary nahi.
- **Kya karna hai:** outward tax (GSTR-1 wale aankde), purchase ka input tax (inward bills ka
  GST — abhi purchase side GST poora record nahi hota, pehle wahi), net payable.
- **Kahan:** `lib/gst/gstr1Generator.ts`, `lib/gst/gstr1Json.ts`, `app/gst-reports/page.tsx`.

### FS-11 · E-invoice (IRN) — P3 · L
- **Kyun:** ₹5 crore se zyada turnover wali dukaano ke liye B2B bill par IRN zaroori. Abhi nahi hai.
- **Kya chahiye:** GSP / IRP API (internet chahiye — bill offline save ho, IRN baad mein),
  signed QR bill par.

### FS-12 · E-way bill — P3 · M
- **Kyun:** ₹50,000 se zyada ka maal bhejne par. Abhi nahi hai.
- **Kya karna hai:** bill se e-way bill JSON (portal upload) — pehle offline JSON, API baad mein.

### FS-13 · P&L, balance sheet, bank reconciliation — P3 · L
- **Kyun:** reports mein bikri / profit hai, par poora accounting nahi.
- **Kahan:** `lib/reports/advancedReports.ts`, cash register, supplier ledger, khata.

---

## P2 / P3 — Code ki sehat

### FS-15 · Baaki badi files todna — P2 · L
| File | Lines (28-09-2026) |
| :-- | --: |
| `src/app/khata/page.tsx` | 1,160 |
| `src/app/products/page.tsx` | 665 |
| `src/components/invoices/EditInvoiceModal.tsx` | 629 |
| `src/app/settings/page.tsx` | 613 |
| `src/components/khata/ConsolidatedStatementModal.tsx` | 589 |
| `src/lib/firebase/firestoreSync.ts` | 515 (sync band — FS-19 bhi dekhein) |

Niyam: AGENTS.md Rule 5 (400 lines). Ek-ek file, bina vyavahaar badle.

### FS-16 · Database ke unit tests (fake-IndexedDB) — P2 · M
- **Kyun:** suite mein DB ke unit tests nahi; `applyStockEntry`, `applyBillInward`,
  `restoreDatabaseFromPayload` sirf dheeme Electron E2E se jaanche jaate hain.
- **Kya karna hai:** `fake-indexeddb` devDependency, in functions ke tez tests (transaction
  rollback, merge, barcode, stock).

### FS-17 · Regex source-checks ki jagah behaviour tests — P3 · M
- **Kyun:** Suite 9 ke kai checks code ke text ko regex se milate hain — vyavahaar toote to bhi
  pass ho sakte hain, aur bina nuksaan ke refactor par fail. Jahan ho sake, pure function / DB
  test (FS-16) se badalna.

### FS-18 · Chupchaap nigle gaye errors ka audit — P2 · S
- **Kyun:** `public/barcodes/fmcg-india.json` mein ek quote chhoota tha — 77 FMCG items mahino se
  load nahi ho rahe the, loader error nigal leta tha (v4.78.0 mein theek). Aise aur `catch {}` ho
  sakte hain.
- **Kya karna hai:** `rg "catch \{\}|catch \(\w+\) \{\s*\}" src` — jahan data kho sakta hai wahan
  error log (`lib/diagnostics/errorReporter.ts`) ya dukaandaar ko sandesh.

### FS-19 · Purana / bekaar code hatana — P3 · M
- `lib/firebase/firestoreSync.ts` aur sync ke hisse (jab tak FS-06 nahi) — ya to FS-06 ke saath
  chalu, ya saaf.
- Route guard mein 8 aise pages jo hain hi nahi (Bible §12 #3).
- Purane props `onOpenRapidInward` (Dashboard, Inventory, `ProductHeaderActions`) jo kahin se
  diye nahi jaate.
- Locales mein bekaar keys (jaise "Custom label" — v4.77.0 mein button hata).

---

## P3 — Use karne mein takleef (UX)

### FS-20 · Manual Inward mein item dhoondhne wala picker — P2 · S
- **Kyun:** `app/purchases/page.tsx` ka "Select Product" saadi `<select>` hai — 800 items mein
  dhoondhna mushkil.
- **Kya karna hai:** `lib/search/productSearch.ts` (`searchProducts`) wala search box + barcode
  scan, jaise Barcode Studio mein.

### FS-21 · Purchases ka "Add Single Item Manually" reload hataana — P3 · S
- **Kyun:** `components/purchases/InwardBillButton.tsx` → `window.location.href = '/products'` —
  poora page reload, pal bhar kaala screen (Bible §10 #22 wali samasya).
- **Kya karna hai:** `router.push`.

### FS-22 · Excel / CSV export seedha folder mein save — P3 · M
- **Kyun:** Customers Excel, CA register, Tally XML, backup — har baar Windows "Save As" poochta
  hai (Electron mein download handler nahi). PDF pehle se `Documents/KamaiPlus/Reports` mein
  jaate hain.
- **Kya karna hai:** ek IPC (`kp:save-file`, `main.js` + `preload.js` + `desktopBridge.ts`) jo
  `Documents/KamaiPlus/<folder>` mein likhe, phir "Open / Show in folder". Bible §2 IPC table
  update.

### FS-23 · Hindi / Marathi mein unit ke naam — P3 · S
- **Kyun:** Hindi mode mein bhi `box`, `pc`, `kg` English mein dikhte hain (cart, labels, chips).
- **Kya karna hai:** unit ke dikhane wale naam `tr()` se (DB mein id English hi rahe).

### FS-24 · Transactions pull-tab right-edge ke buttons dhak leta hai — P3 · S
- **Kyun:** screenshot mein Customers page ka "PDF" button right-edge ke "Transactions" tab ke
  neeche aa gaya.
- **Kahan:** `components/layout/GlobalDrawers.tsx` — pages ke right mein thodi jagah, ya tab chhota.

### FS-25 · Customers page par English se Hindi naam dhoondhna — P3 · S
- **Kyun:** Customers search saada `includes` hai; Billing / Products wala English → हिंदी search
  (`lib/search/productSearch.ts`, Bible §9.6) yahan nahi.

---

## P2 / P3 — Business model

### FS-26 · AMC / support plan — P2 · S (faisla)
- **Kyun:** ek-baar ka licence → kamai sirf naye customers se; updates aur support ka kharcha
  chalta rehta hai.
- **Vichaar:** saalana support / update plan, ya naye bade features (FS-06, FS-07) add-on.
  (Licence ke saath jodna ho to `licence.js` aur Admin Console — Android repo.)

### FS-27 · Doosre software se data import — P3 · L
- **Kyun:** Vyapar / Marg se shift karne wale ke liye sirf Excel price list import hai
  (`lib/import/catalogImport.ts`). Purane customer, udhar balance, bill nahi aate.
- **Kya karna hai:** customers + opening udhar ka Excel import (khata entry ke saath), phir
  zaroorat ho to un software ke export format.
