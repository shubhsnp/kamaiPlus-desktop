# KamaiPlus — Platform Tracker (Desktop + Android + Website)

> Ek hi jagah: **kya decide hua, kya kahan chal raha hai, kya kami hai, kya kaam hua.**
> Shuru: 2026-09-30. Rahul ka order: "jo jo hum kar rahe wo note karte chalo… jo kamiyan hai wo bhi ginte chalo".

## Kaise use karein (har kaam par)

1. **Kaam se pehle** ye file padho. Jo kaam karna hai uska ID (K-…) "Kamiyan" mein dhoondho; na mile to naya ID banao.
2. **Kaam ke baad** status badlo (version + commit likho) aur "Work log" mein ek line jodo.
3. **Har bug fix ke saath test** — Desktop: `scripts/e2e_simulation.ts` (Suite 9); Android: `test/` + `DEVELOPMENT_LOG.md` entry. Test ke bina koi bug "Done" nahi.
4. App ki andar ki detail apni jagah rehti hai: Desktop → `ENGINEERING_BIBLE.md`; Android → `DEVELOPMENT_LOG.md`, `APP_FEATURE_MEMORY.md` (⚠️ is file ke kuch daave code mein nahi hain — K-A04).
5. Sirf wahi likho jo code ya command se **verify** kiya ho. Andaza likhna ho to "(andaza)" likho.

---

## 1. Faisle (Decisions)

| # | Date | Faisla | Status |
| :--- | :--- | :--- | :--- |
| F-01 | 2026-09-30 | Sirf 2 product chalenge: **KamaiPlus Desktop** (Windows) aur **KamaiPlus Android**. Web app (`sayrahul/kamai`, `D:\My Web Sites\Billing WebApp`) **band**. | ✅ Final |
| F-02 | 2026-09-30 | Main domain = **kamaiplus.web.app**. `kamaiplus.com` liya to sab wahan shift. | ✅ Final |
| F-03 | 2026-09-30 | Main domain par sirf: Desktop download, Play Store link (`https://play.google.com/store/apps/details?id=com.kamaiplus.pos`), Admin panel. Baaki koi alag public website nahi. | ✅ Final |
| F-04 | 2026-09-30 | Main website ka code **Android repo ke `website/`** mein rahega (wahi pehle se site `kamaiplus` par deploy hota hai; privacy / terms / help bhi wahin). Admin panel **`/admin`** par. | ⏳ Proposal — OK ka intezaar |
| F-05 | 2026-09-30 | `kamaiplus-desktop.web.app` (Desktop update server) aur `kamaiplus-pay.web.app` (WhatsApp UPI pay link) **peeche chalte rahenge** — inke bina installed PC update nahi lenge aur bheje gaye pay links toot jayenge. Inka home page main site par bhej denge, taaki user ko ek hi website dikhe. | ⏳ Proposal |
| F-06 | 2026-09-30 | Web app ka GitHub repo **delete nahi, Archive** (read-only; history bachi rahe). | ⏳ Proposal |
| F-07 | 2026-09-30 | Rahul: "ab hum dhire dhire desktop app and android app ko same same rakhte jayenge" — dono apps ke features aur data **ek jaise** banenge; naya feature ek mein aaye to doosre ka bhi socho. Firebase Auth (Desktop par) ka vichaar isi ka hissa. | ✅ Final (direction) — Firebase Auth par faisla baaki |

### 1b. Website / web app ka kaam — ⏸️ ROKA HUA (Rahul, 2026-09-30: "ye sab baad me karte hai, likh kar rakho")

Dobara shuru karte waqt pehle Rahul se ye jawab lo:

1. F-04 / F-05 / F-06 par haan / na (main site Android `website/` mein, admin `/admin`, web app repo Archive).
2. Policy mein kiska naam likhe — "KamaiPlus / ProVenture", Rahul ka naam, ya nayi firm? City + state.
3. Grievance officer — suggestion: Rahul khud, `kamaiplus.app@gmail.com`.
4. Refund niyam (K-P14) — suggestion diya tha: Android Pro = pehli payment ke 7 din mein poora refund, renewal par nahi, cancel par period ke ant tak Pro; Desktop licence = activation se pehle poora refund, activation ke baad sirf tab jab 7 din mein app PC par chal hi na paaye aur hum theek na kar sakein.
5. Razorpay KYC mein website `kamaiplus.web.app` di thi?
6. Razorpay + Meta (WhatsApp) dashboard mein webhook URL kya hai; Supabase / Vercel mein koi KamaiPlus project hai?
7. `kamaiplus.com` kharidna hai? (2026-09-30 tak free tha.)

Tab tak: **`kamaiplus.web.app` par koi deploy nahi**, aur web app ki koi cheez delete nahi.

---

## 2. Abhi kya kahan chal raha hai (2026-09-30 ko command se check kiya)

### Firebase project `kamaiplus` — Hosting sites

| Site | Kis repo se deploy | Kaam | Aage kya |
| :--- | :--- | :--- | :--- |
| `kamaiplus.web.app` | **Abhi: Web app** (v4.22.0, deploy 2026-09-21). Android `website/` bhi isi site par deploy kar sakta hai (`firebase.json` → `"site": "kamaiplus"`). | Main site | Android `website/` se nayi main site (F-04) |
| `kamaiplus-admin.web.app` | Android `admin_console/` (Flutter web) | Admin panel | `/admin` par shift, phir yahan redirect |
| `kamaiplus-desktop.web.app` | Desktop `release/` (`npm run release:publish`) | Download page + `latest.yml` / `beta.yml` + installers | Chalta rahega (F-05) |
| `kamaiplus-pay.web.app` | Android `pay_redirect/` | UPI pay link (Android + Desktop dono ke WhatsApp messages) | Chalta rahega (F-05) |

### Cloud Functions (us-central1)

| Function | Kiska | Aage |
| :--- | :--- | :--- |
| `aiExtract`, `resolveBarcode`, `referral`, `verifyRazorpayPayment`, `onAdminPushCreated`, `syncAccountDisabled` | Android (`functions/`) | Rakhna |
| `desktopLicence` | Desktop licence (code Android repo `functions/licence_core.js` mein) | Rakhna |
| `ssrkamaiplus` (nodejs22) | **Web app ka server** (Next.js SSR, `/api/*`) | **Band karna** (K-P03) |

### Repos

| Repo | Local | Branch | Aage |
| :--- | :--- | :--- | :--- |
| `sayrahul/kamaiplusDesktopApp` | `D:\My Web Sites\KamaiPlus Desktop App` | `main` (v4.82.0) | Chalega |
| `sayrahul/KamaiPlus` | `D:\My Web Sites\KamaiPlus Android` | naya kaam `feat/desktop-licence` par (v4.29.1); `main` 17 commit peeche | Chalega |
| `sayrahul/kamai` | `D:\My Web Sites\Billing WebApp` | `main` (v4.22.0) + 45 files ka uncommitted kaam | Archive (F-06) |

Kisi repo mein secret file commit nahi hai (check kiya: `.env*`, `env.local`, `*.jks`, service account).

---

## 3. Web app band karne ka plan

Order zaroori hai — pehle nayi site, phir purani cheezein band.

**Phase A — Nayi main site taiyaar (Android repo `website/`)** — bina deploy kiye
- [x] A1. Play Console ke URL (Rahul, 2026-09-30): `/privacy-policy`, `/terms-of-service`, `/refund-policy` — teeno purani web app ke pages. Nayi site par **inhi URL par seedha page** (200, redirect nahi) — `firebase.json` mein `cleanUrls: true` hai, to `website/privacy-policy.html` → `/privacy-policy` (K-P10).
- [ ] A1b. Teeno policy naye sire se, dono apps ke asli kaam ke hisaab se (K-P13), + `/delete-account` page (K-A12) + `/contact-us`. Refund ke niyam Rahul tay karein (K-P14).
- [ ] A2. "Download for Windows" section — hamesha latest stable installer (K-P06).
- [ ] A3. Play Store button (upar wala link).
- [ ] A4. Admin panel `/admin` par (Flutter build `--base-href /admin/`, deploy se pehle `website/admin/` mein copy). Public menu mein admin ka link **nahi** (K-P07).
- [ ] A5. Nakli `@kamaiplus.com` emails hatao → `kamaiplus.app@gmail.com` / WhatsApp +91 86699 97711 (K-P08).
- [ ] A6. Purani web app ke URLs ke redirects: `/billing`, `/auth`, `/login`, `/products`, `/khata`, `/admin` (purana) … → sahi jagah; `/privacy-policy`, `/terms-of-service` → nayi privacy / terms.
- [ ] A7. Purani PWA ka "kill switch": `/sw.js` aur `/firebase-messaging-sw.js` par aisa service worker jo khud ko hata de, taaki kisi ke browser mein purani app cache na rahe (K-P05).
- [ ] A8. Local preview (`firebase hosting:channel:deploy preview`) — dekh kar OK.

**Phase B — Deploy (Rahul ke OK ke baad)**
- [ ] B1. Android repo se `firebase deploy --only hosting:kamaiplus`. Galat hua to Firebase console → Hosting → release history se ek click mein wapas.
- [ ] B2. Live check: home, download, Play Store, `/admin` login, privacy, terms, purane URLs ke redirects.

**Phase C — Purani cheezein band**
- [ ] C1. `firebase functions:delete ssrkamaiplus --region us-central1` (K-P03).
- [ ] C2. `kamaiplus-admin.web.app` → `/admin` par redirect (baad mein chahe to site delete).
- [ ] C3. `kamaiplus-desktop.web.app` ka home → main site ka download section; files / yml wahi rahenge.
- [ ] C4. Third-party (K-P04), har ek mein pehle check ki Android ussi cheez ko use to nahi karta:
  - Razorpay dashboard: web app wala webhook (`…/api/razorpay/webhook`) hatao. Key tabhi badlo jab pakka ho ki Android functions alag key use karte hain.
  - Meta WhatsApp Cloud API: web app ka token revoke, webhook (`…/api/webhooks/whatsapp`) hatao.
  - Supabase: zaroori data export, phir project pause / delete (service role key band).
  - Vercel: web app ka project delete (repo mein `.vercel` folder mila).
  - Gemini key: agar sirf web app ki thi to AI Studio se delete; Android wali (`platform_settings`) mat chhedo.
- [ ] C5. GitHub `sayrahul/kamai`: uncommitted 45 files ek branch par push (history ke liye), phir Settings → **Archive this repository**.
- [ ] C6. Local folder `D:\My Web Sites\Billing WebApp` → archive folder mein (ya delete) — `.env.local` mein live keys hain, isliye C4 ke baad.

**Phase D — Apna domain (jab lein)**
- [ ] D1. `kamaiplus.com` kharido (2026-09-30 tak kisi ka nahi — K-P09).
- [ ] D2. Firebase Hosting → site `kamaiplus` → Add custom domain → DNS records. `kamaiplus.web.app` bhi chalta rahega.
- [ ] D3. Firebase Auth → Authorized domains mein `kamaiplus.com` (admin login ke liye).
- [ ] D4. Email: `support@kamaiplus.com` jaisa asli mailbox (Zoho / Google Workspace), tab app aur site mein daalo.
- [ ] D5. Chahein to subdomain: `download.` → desktop site, `pay.` → pay site, `admin.` → admin.

---

## 3b. Desktop + Android ek jaisa — step plan (F-07)

Order zaroori hai: **pehle data surakshit → phir data ka ek format → phir login → phir sync.** Har step alag version + test + commit. Sync tab tak band (`CLOUD_SYNC_ENABLED = false`) jab tak Step 4 na aaye. Firestore rules Android repo mein hain — rule badle to wahin se deploy.

- [x] **Step 0 — Local backup har ghante (K-D18).** ✅ v4.82.0. Firebase se alag, abhi ka khatra. `AutoBackupScheduler.tsx` / `lib/backup/autoBackup.ts`: din ki file har ghante (ya N bill ke baad) idle time par overwrite, 30 din wala niyam wahi. Size S (andaza 1 din).
- [x] **Step 1 — Cloud data contract (K-P15).** Contract **v1.0 OK** (D1 haan, D2 na, D3 jodo — 2026-09-30). **Desktop ✅ v4.83.0** (`lib/cloud/cloudContract.ts`, test §9j(s)). **Android ✅** branch `feat/cloud-data-contract` (`lib/services/cloud_contract.dart` + `lib/core/utils/bill_math.dart`; C6–C10, C13, C15, C16, C17) — **local commits, push / Play Store build Rahul ke OK par**. Baaki: C1 poora (Step 2), C11 / C12 (Step 4). Jo kaagaz par tay hua tha:
  - Android `firestore_sync_service.dart` jo field likhta / padhta hai (products, categories, customers, sales, inward_orders, business doc) + Desktop `firestoreSync.ts` / Dexie tables ki list.
  - Ek table: cloud field → Desktop field → Android field. Paisa hamesha `*_paise` (integer), dukaan ID `biz_<uid>`, tareekh ka format, id ka format.
  - Jo sirf Desktop cloud mein bhejta hai (`suppliers`, `ledger_transactions`, `cash_expenses`) — Android khata ledger cloud mein nahi bhejta (sirf customer balance); tay karo dono kya karenge.
  - Same file dono repo mein: `docs/CLOUD_DATA_CONTRACT.md`. Rahul OK kare.
  - Desktop mein `toCloud` / `fromCloud` mapping + Suite 9 test (₹100 bill → `subtotal_paise = 10000`; Android wala doc padh kar sahi rakam). Size M (andaza 2–3 din).
- [x] **Step 2 — Desktop par Google login (Firebase Auth).** ✅ **Code v4.84.0**, live 4.84.0. **v4.85.0 (Rahul): Google pehli baar zaroori nahi** — password se app khulta hai, Google baad mein Backup → Google Account se. (`googleSignIn.js` loopback + PKCE, `lib/cloud/cloudAccount.ts`, AuthForm step 1 Google → step 2 password, Backup → Google Account card; Bible §2.6). **Live check 2026-09-30:** Google ✅ (`iamdivyaang@gmail.com`), Firebase ne Desktop client ka token maana ✅ (purana user), rules ne `biz_<uid>` padhne diya ✅ — lekin **`biz_<uid>` doc hai hi nahi (404)**: is account se Android ne cloud dukaan nahi banayi → **Rahul se: phone par kaunsa Google account?** Installer publish baaki. Faisla pehle: sirf Google (Android jaisa) ya OTP bhi. **Faisla (Rahul, 2026-09-30): Android pehli baar sirf Google; Desktop bhi pehli baar sirf Google, uske baad roz master password** (aaj jaisa). ⏸️ **Rahul se chahiye:** (1) ~~sirf Google~~ ✅; (2) Google Cloud Console (project `kamaiplus`) → APIs & Services → Credentials → Create OAuth client ID → type **Desktop app** → Client ID + secret; (3) OAuth consent screen "In production" hai ya "Testing" (Testing mein sirf test users login kar sakte).
  - Google Cloud Console → Credentials → "Desktop app" OAuth client (project `kamaiplus`).
  - Electron: system browser mein Google login, `127.0.0.1` loopback par jawab, phir `signInWithCredential` (app ke andar wali window mein Google login block karta hai). Desktop mein aaj koi OAuth code nahi.
  - Onboarding: dukaan ID `biz_<uid>` (aaj `biz_<8 akshar>_<time>`, `app/onboarding/page.tsx:101`; Dexie mein `business_id` har record par — test installs ka data migrate ya reset).
  - Master password PC lock ki tarah rahe; pehli baar ke baad login bina internet chale.
  - Size L (andaza 1 hafta).
- [ ] **Step 3 — Sirf Desktop → cloud (one-way backup).** ⏸️ Branch `feat/step3-cloud-send` (push hua, main par nahi) — Rahul ne 4.85.0 ke kaam ke liye roka, ab wahin se aage. Pehle test Google account par. Check: Android par same account → Desktop ke bill / product sahi rakam ke saath; naye PC par login → data wapas. Firebase usage (kharcha) ek hafta dekho. Privacy policy (K-P13) isse pehle.
- [ ] **Step 4 — Dono taraf sync.** Niyam tay: stock "-N / +N" entries (overwrite nahi), har counter ki alag bill series, licence = ek dukaan kai PC (`desktop_licences`, `desktopLicence` function). Pilot dukaan par.
- [ ] **Step 5 — Features ek jaise (lagatar).** Ek-ek karke: batch / expiry Desktop mein (K-D20, Android mein field hai), label print Android mein (K-A01), khata edit Android mein (K-A05) … Naya feature dono mein.

---

## 4. Kamiyan (count)

**Total: 60** — Platform 17 · Android 16 · Desktop 27. **Open 49 · Done 11.**
🔴 = paisa / data / security / Play Store risk · 🟠 = galat ya adhoora behaviour · 🟢 = chhota / feature gap

### Platform / website (K-P)

| ID | Kami | Level | Status |
| :--- | :--- | :--- | :--- |
| K-P01 | Band ki hui web app abhi bhi live: `kamaiplus.web.app/billing`, `/admin`, `/api/admin/*` chal rahe | 🔴 | Open |
| K-P02 | `kamaiplus.web.app` par 2 repo (web app + Android `website/`) deploy kar sakte — jo baad mein deploy kare wahi dikhe | 🟠 | Open |
| K-P03 | `ssrkamaiplus` Cloud Function (web app server) chal raha — kharcha + khula API | 🔴 | Open |
| K-P04 | Web app ki live keys (Razorpay, WhatsApp token, Supabase service role, Gemini, admin password, JWT) aur Vercel / Supabase projects band ke baad bhi active | 🔴 | Open |
| K-P05 | Purani PWA kuch browsers mein install / cache (`sw.js`, `firebase-messaging-sw.js`) | 🟠 | Open |
| K-P06 | Main site (Android `website/`) par Desktop download nahi | 🟠 | Open |
| K-P07 | Main site par "Super Admin Console" ka public link (3 jagah: `website/index.html` 41, 60, 765; `help.html` 59, 390) | 🟠 | Open |
| K-P08 | Nakli emails `@kamaiplus.com` — domain hamara nahi, mail bounce / koi aur le sakta hai: `support@` (Android `remote_config_service.dart:33`, `website/privacy.html:72`), `billing@` (`razorpay_service.dart:86`), `legal@` (`website/terms.html:60`), `admin@` (admin login prefill) | 🔴 | Open |
| K-P09 | `kamaiplus.com` abhi register nahi — koi aur le sakta hai | 🟠 | Open |
| K-P10 | Play Store listing ke 3 URL (`/privacy-policy`, `/terms-of-service`, `/refund-policy`) purani web app se chal rahe — nayi site par bhi inhi URL par chalne chahiye, warna listing ka link toot jayega | 🔴 | Open (URL pata, 2026-09-30) |
| K-P11 | Android `main` 17 commit peeche; purani branches / worktrees (`agents/greeting-user-initialization`, `fix/cross-screen-wiring`, `.kilo/…/respected-foe`) | 🟢 | Open |
| K-P12 | Uncommitted kaam: Desktop `docs/FUTURE_SCOPE.md`, Android `DEVELOPMENT_LOG.md`, web app 45 files | 🟢 | Open |
| K-P13 | Policy pages ka content aaj ki apps se mel nahi khaata. Live (web app): purana naam "KamaiPlus / ProVenture", `info@proventure.in`, `kamaiplus.proventure.in`, mobile + PIN login, Supabase, browser storage, "Enterprise" plan, "voice billing". Android `website/privacy.html`: OTP login, `support@kamaiplus.com`. Dono mein nahi: Google Sign-In, Firebase sync, notification access (UPI payment padhna), contacts, fingerprint, AI photo scan (Gemini), Crashlytics, Google Drive, push, Razorpay (Android), aur **Desktop app bilkul nahi** (licence activation par PC ka naam / id jaata hai) | 🔴 | Open |
| K-P16 | Google login (OAuth consent screen → Branding) ke home / privacy / terms links `kamaiplus.proventure.in/...` par — teeno **404** (2026-09-30 curl se check). `kamaiplus.web.app/`, `/privacy-policy`, `/terms-of-service` 200. Rahul Branding mein badal rahe; content abhi purana (K-P13). **Branding verification pehle fail hua tha:** "homepage `https://kamaiplus.web.app/` is not registered to you" → Google Search Console mein URL-prefix property + site par verification file / meta tag chahiye = `kamaiplus.web.app` par deploy (website kaam §1b roka hua). Login iske bina chalta hai (sirf basic scopes); verification website ke saath: deploy → Search Console verify → 24 h → "I have fixed the issues" | 🟠 | Links: Rahul badal rahe · Verification: website ke saath |
| K-P14 | Refund policy mein Desktop ki one-time licence ka koi niyam nahi; Android Pro ke niyam purane ("Pro & Enterprise", "Free Forever Tier") | 🟠 | Open — Rahul ka faisla chahiye |
| K-P15 | Desktop aur Android ka cloud data format mel nahi khaata (sync band hai, isliye abhi nuksaan nahi — **sync chalu karne se pehle zaroori**): (1) Desktop businessId `biz_<8 akshar>_<time>` (`app/onboarding/page.tsx:101`), Android + Firestore rules `biz_<uid>` maangte hain; (2) Desktop paise wale field `_paise` naam ke bina bhejta hai (`subtotal`, `selling_price` — dono paise mein), Android `subtotal_paise ?? subtotal*100` aur `selling_price_paise ?? price*100` padhta hai (`firestore_sync_service.dart:413, 732, 799`) → Desktop ka ₹100 ka bill Android par ₹10,000, product ka daam ₹0. **Poori list (C1–C16, dono apps) + fix: `docs/CLOUD_DATA_CONTRACT.md`** | 🔴 | Open — contract v1.0; Desktop ✅ v4.83.0 (C2–C5, C14; C1 cloud side), Android baaki |
| K-P17 | Cloud Functions Node.js 20 par — Google 2026-10-30 ko band karega, uske baad functions deploy nahi honge (`firebase deploy` ki warning, 2026-09-30). `functions/package.json` engines Node 22 + `firebase-functions` update chahiye | 🟠 | Open |

### Android (K-A)

| ID | Kami | Level | Status |
| :--- | :--- | :--- | :--- |
| K-A01 | Barcode Studio "Print" kuch print nahi karta — sirf "Sent N label(s) to Bluetooth printer" message (`views/tools/barcode_studio_screen.dart` `_dispatchPrint`). Pro feature hai | 🔴 | Open |
| K-A02 | Label preview ki bars sirf design (`List.generate`), asli barcode nahi | 🟠 | Open |
| K-A03 | Bhasha list mein 9, par sirf ~17 labels translate (bottom bar, Home) — Hindi chunne par bhi app English | 🟠 | Open |
| K-A04 | `APP_FEATURE_MEMORY.md` ke daave jo code mein nahi: khata voice note (audio package hi nahi), GSTR-3B / ZIP CA pack | 🟢 | Open |
| K-A05 | Khata entry edit / delete nahi | 🟠 | Open |
| K-A06 | Bana hua bill edit nahi | 🟢 | Open |
| K-A07 | Automatic (rozana) backup nahi — sirf haath se / Drive (Pro) | 🟠 | Open |
| K-A08 | Bina barcode wale item ka apna barcode nahi banta | 🟠 | Open |
| K-A09 | English mein type karke Hindi naam wala item nahi milta | 🟢 | Open |
| K-A10 | `showQuotationEstimate` flag bana, estimate / quotation feature nahi | 🟢 | Open |
| K-A11 | `DESKTOP_FIXES_ANDROID_CHECK.md` ka audit (double-tap = do bill, cash leak, short cash udhar, split excess, GSTR-1 JSON …) abhi tak hua hi nahi | 🔴 | Open |
| K-A13 | Bill-discount GST kam nahi karta — `processPosBill` GST chhoot se pehle ki rakam par lagata, `total = grand − discount` (GST report mein zyada tax); `subtotal` mein inclusive / exclusive lines mili. Desktop ne ye `saleMath.allocateBillDiscount` se theek kiya tha (contract C16) | 🔴 | ✅ Done (branch `feat/cloud-data-contract`, abhi Play Store build mein nahi) — `BillMath`, `test/bill_math_test.dart` |
| K-A14 | Checkout / cart / payment modal ka total GST-exclusive item ka GST nahi jodta (saved bill jodta — cash chips, UPI QR, split kam rakam maangte); GST "5% andaza" (`grandTotal × 0.05`) dikhta; invoice PDF `is_tax_inclusive != false` se `0` ko inclusive maanta (exclusive line ka GST galat chhapta); GST export bill-discount se pehle ki rakam par GST (contract C17) | 🔴 | ✅ Done (branch `feat/cloud-data-contract`, abhi Play Store build mein nahi) — sab screens `cartBillTotals` se |
| K-A15 | Poora `flutter test` ek saath chalane par DB wale tests (advanced_sales_report, customer_edit_crud, inventory_inward_service, referral) 30 s timeout — akele (`--concurrency=1`) sab pass. Test timeout / DB setup sudharna hai | 🟢 | Open |
| K-A16 | Checkout mein cart badalne (item hatane) par "Cash Tendered" purani rakam par atka rehta — ₹517 likha raha jab bill ₹118 ho gaya, "Return Change ₹399" dikha (phone par dekha, 2026-09-30) | 🟢 | Open |
| K-A12 | Account delete karne ka koi tarika nahi (app mein bhi nahi, web par bhi nahi). Google Sign-In se account banta hai, to Play policy dono maangti hai (Data safety → "Delete account URL") | 🔴 | Open |

### Desktop (K-D)

| ID | Kami | Level | Status |
| :--- | :--- | :--- | :--- |
| K-D01 | `src/lib/payments/` (UPI notification parser, soundbox) kisi screen se juda nahi — bekaar code | 🟢 | Open |
| K-D02 | Purani cash shifts ki history nahi | 🟢 | Open |
| K-D03 | Customer credit limit warning nahi | 🟢 | Open |
| K-D04 | GSTR-1 JSON mein credit notes (cdnr / cdnur) nahi — partial return net report hota hai | 🟠 | Open |
| K-D05 | GSTIN online verify nahi (sirf format check) | 🟢 | Open |
| K-D06 | Favourite (star) items POS mein upar nahi aate | 🟢 | Open |
| K-D07 | Estimate / quotation bana nahi sakte (sirf pehchaanta hai) | 🟢 | Open |
| K-D08 | Installer unsigned — Windows "protected your PC" warning (certificate chahiye, Bible §2.2) | 🟠 | Open |
| K-D09 | Cloud sync band — ek dukaan mein 2 counter / 2 PC ek data nahi | 🟠 | Open |
| K-D10 | TSC par "plug wapas = green" aur calibrate ke baad frame photo check baaki (installer wala hissa ho gaya — 4.80.0 live tha, 4.81.0 2026-09-30 ko publish) | 🟠 | Open |
| K-D11 | Tally XML asli Tally company mein import karke test nahi hua | 🟠 | Open |
| K-D12 | Route guard 8 aise pages ka naam leta hai jo hain hi nahi (Bible §12 #3) | 🟢 | Open |
| K-D13 | Products toolbar ka camera "Scan" kuch nahi karta tha (code band form mein jaata tha) | 🟠 | ✅ Done v4.81.0 — camera scanner hataya (Bible §9.12) |
| K-D14 | Products search "HSN, size, color" ka daava karta tha, par sirf naam / barcode dhoondhta tha | 🟠 | ✅ Done v4.81.0 — `lib/products/detailSearch.ts` |
| K-D15 | Category chips ek line mein side-scroll — mouse se aage ki categories tak pahunch hi nahi | 🟠 | ✅ Done v4.81.0 — chips wrap + "All categories (N)" |
| K-D16 | Add Product ke barcode box mein gun ka Enter adhoora product save kar deta tha | 🔴 | ✅ Done v4.81.0 — Enter = offline list se naam / MRP |
| K-D17 | Electron E2E ka pehla licensed launch check ("Set Master Password" 20 s mein) naye build ke baad thande start par fail ho jaata hai — agle steps pass hote hain (screen der se aati hai). Timeout / wait sudharna hai | 🟢 | Open |
| K-D18 | Automatic backup din mein sirf **ek** baar — app khulne ke 2 min baad (`AutoBackupScheduler.tsx`, "one backup per calendar day"). Matlab aaj ke bill kal subah tak kisi auto backup mein nahi; shaam ko disk / PC kharab = poore din ke bill gaye (FS-03) | 🔴 | ✅ Done v4.82.0 — din ki file har ghante nayi (data badla ho + counter 30 s khaali; rush mein bhi max 2 ghante), Bible §2.3 / §10 #34, test §9j(r) |
| K-D19 | Staff login / roles nahi — kaun sa cashier kaunsa bill kaata, record nahi; cashier ko discount / return / delete se rok nahi sakte (sirf owner PIN profit chhupata hai). `staff_id` sirf `lib/auth/session.ts` mein (FS-07) | 🟠 | Open |
| K-D20 | Batch / expiry nahi — product type mein field hi nahi (pharmacy / FMCG ke liye zaroori) (FS-08) | 🟠 | Open |
| K-D21 | Purchase return / debit note / purchase order nahi (FS-09) | 🟢 | Open |
| K-D22 | GSTR-3B summary, e-invoice (IRN), e-way bill nahi — `src` mein koi code nahi (FS-10, FS-11, FS-12) | 🟢 | Open |
| K-D24 | Electron E2E ka "Transactions tab drag, phir click se khule" check kabhi-kabhi fail (v4.82.0 par 2 run mein 1 baar: click ke 600 ms baad drawer screen par nahi) — doosre run mein 71/71. Wait badhana / drawer ke khulne ka intezaar karna hai | 🟢 | ✅ Done v4.83.0 — test ab drawer ke khulne ka 3 s tak intezaar karta hai (300 ms slide), fail par overlay / path / tab likhta hai; 71/71 |
| K-D25 | Barcode Studio mein preview tab tak dikhta hi nahi tha jab tak item na jode (khaali list = grey dabba + ek line) — size / "On the label" badlo to asar nahi dikhta | 🟠 | ✅ Done v4.85.0 — khaali list par sample label, preview sticky, frame labels jitna uncha (Bible §9, §10 #36) |
| K-D26 | Custom roll size box mein "38" type nahi hota tha — "3" par hi 50 ho jaata (save + settings event); "Copies for all" koi bhi number le leta (50,000 labels) | 🟠 | ✅ Done v4.85.0 — draft value, sirf sahi size save (`CUSTOM_LIMITS`); copies 1…999 |
| K-D27 | Admin Console se chalti Desktop par control nahi — licence ki validity (end date) nahi, block / move sirf nayi activation rokta tha | 🟠 | ✅ Done v4.85.0 — Desktop `licence.js` end date + online check-in; `desktopLicence` function + Admin Console deploy 2026-09-30 (Android branch `feat/desktop-licence-validity`) |
| K-D23 | 16 files 400 line ke niyam se badi — `billing/page.tsx` **2,254**, `khata/page.tsx` 1,175, `products/page.tsx` 655 … Sabse zaroori screen mein har badlav sabse risky (FS-04, FS-15) | 🟠 | Open |

---

## 5. Work log

| Date | Kya hua | Kahan |
| :--- | :--- | :--- |
| 2026-09-30 | Teeno repos ka git connection check (sab push kar sakte). | — |
| 2026-09-30 | Android vs Desktop poori comparison (feature / page / function) — code se verify. Nateeje: K-A01…K-A11, K-D01…K-D07. | — |
| 2026-09-30 | Platform audit: 4 hosting sites, 8 functions, domain links, web app ki keys / PWA / Vercel / Supabase. Nateeje: K-P01…K-P12. Ye tracker banaya. | `docs/PLATFORM_TRACKER.md` |
| 2026-09-30 | Play Console ke 3 policy URL mile; live pages + Android `website/privacy.html` + Android permissions padhe. Nateeje: K-P13, K-P14, K-A12. | — |
| 2026-09-30 | Website / web app ka kaam Rahul ne roka — pending sawaal §1b mein. Ab Desktop app ke changes. | — |
| 2026-09-30 | Desktop v4.81.0 — Products toolbar: camera Scan hataya, gun Enter fix, search HSN / size / colour, category chips wrap. Test §9j(p), suite 601/601. K-D13…K-D16. | Desktop |
| 2026-09-30 | Rahul ke PC ke Feature switches padhe (`app://kamaiplus` localStorage): 11 ke 11 **off** (profit privacy bhi). Naye switches default **on** rahenge (jo screens aaj dikhti hain). | — |
| 2026-09-30 | **Desktop v4.81.0 publish — sabke liye** (`release:desktop` → `release:publish`). Live `latest.yml` + `beta.yml` = 4.81.0; installer 115,456,076 bytes, live file ka sha512 = `latest.yml` ✔; 4.80.0 installer hosting se hata. Installed PCs 60 s baad / har 4 ghante mein khud update lenge ("Restart & Update"). Installer abhi bhi unsigned (K-D08). | kamaiplus-desktop.web.app |
| 2026-09-30 | Desktop v4.81.0 — Settings → Features mein 7 naye switch (Khata, Customers, Inventory, Barcode Studio & Labels, Sales Analytics, Invoice Themes, WhatsApp), sab default on. Khata off = counter par udhar bhi band. Test §9j(q), suite 613/613; Electron E2E mein Khata-off check. | Desktop |
| 2026-09-30 | Rahul: "desktop app me kya kya kamiya hai?" — K-D list + `FUTURE_SCOPE.md` + Bible §12 code se dobara check (sab purani kamiyan abhi bhi hain). FUTURE_SCOPE ki jo kamiyan yahan gini nahi thi unhe ID diya: K-D18…K-D23. | `docs/PLATFORM_TRACKER.md` |
| 2026-09-30 | Rahul: Firebase Auth ke fayde? + faisla F-07 (Desktop + Android ek jaise). Android login (Google Sign-In → Firebase Auth, `biz_<uid>`), Firestore rules, Desktop ka band sync code (`firestoreSync.ts`) padha. Naya: K-P15 (data format mel nahi khaata). | — |
| 2026-09-30 | F-07 ka step plan likha (§3b): Step 0 backup → 1 data contract → 2 Google login → 3 one-way → 4 dono taraf → 5 features. Check kiya: Android khata ledger cloud mein nahi bhejta; Desktop mein koi OAuth code nahi; Dexie mein `business_id` har record par. | `docs/PLATFORM_TRACKER.md` |
| 2026-09-30 | **Desktop v4.82.0 — Step 0 / K-D18: backup har ghante.** Din ki file data badalne par har ghante nayi (counter 30 s khaali ho; rush mein bhi max 2 ghante). "Data badla" = Dexie DBCore middleware (har write). Test §9j(r), suite 621/621; asli Dexie (fake-indexeddb, scratchpad) 9/9; Electron E2E 70/71 phir 71/71 (drawer check flaky → K-D24). Installer publish **nahi** kiya. | Desktop |
| 2026-09-30 | Step 1 shuru: Android `firestore_sync_service.dart` + `models.dart` aur Desktop `firestoreSync.ts` + types field-by-field padhe. **Contract draft v0.1** (`docs/CLOUD_DATA_CONTRACT.md`): niyam R1–R10, 15 galtiyan C1–C15 (Desktop 6, Android 8, dono 1) — sab K-P15 ke andar. Naye: Android ke products Desktop par ₹0 / stock 0; Android customer save Desktop ka opening balance 0 kar deta; Android `updated_at` server Timestamp; Android bill push mein split / GSTIN nahi; Android categories cloud mein nahi. Faisle D1–D3 Rahul se. | `docs/CLOUD_DATA_CONTRACT.md` |
| 2026-09-30 | Rahul ke faisle: **D1** Desktop sab bheje, **D2** Android ke asli users nahi → seedha naya format, **D3** "jo theek lage" → `bottle` / `can` / `bag` Desktop mein. Contract **v1.0**. **Desktop v4.83.0:** `lib/cloud/cloudContract.ts` + `cloudFormat.ts` (14 tables, `toCloud` / `fromCloud`), `firestoreSync.ts` table-driven (515 → ~270 lines), `cloudMerge` + onboarding bhi contract se (onboarding ka `subscription_tier: 'free'` hata). Chhoot ka matlab tay (bill vs line, GST-sahi) — Android ki GST galti mili: **K-A13**. Test §9j(s), suite 643/643. Sync abhi bhi band. `next build` ✔; Electron E2E 70/71 (drawer) → test ko intezaar wala banaya (K-D24) → 71/71. | Desktop |
| 2026-09-30 | **Step 1 Android hissa** — branch `feat/cloud-data-contract` (local, push nahi): `2b1598c` sync boundary (`cloud_contract.dart`; C6–C10, C13, C15; card / bank bill = digital) + `91d286d` `BillMath` (C16 + C17 — naya mila **K-A14**: checkout total exclusive GST chhodta, GST 5% andaza, PDF `0` ko inclusive maanta). Desktop ke asli `toCloud()` output se test; Android `BillMath` Desktop ke test bill par paise-paise same (17159 / 1942 / 19101). Suite 359/359 serial; parallel mein DB tests timeout → **K-A15**. Contract dono repo mein ek jaisa. **Step 1 poora.** Step 2 ke liye Rahul se OAuth client chahiye (§3b). | Android + docs |
| 2026-09-30 | **Rahul ke phone par manual test** (debug build, OnePlus CPH2691, data bacha raha): 0% item checkout GST ₹0.00 (pehle 5% andaza); "TEST GST 18" ₹118 → Subtotal 100 + GST 18; ₹11.80 discount → 101.80 / 16.20 / −11.80 / **₹106.20**; bill INV-002 ₹106.20; return sheet ₹106.20; UPI filter theek; A4 PDF taxable ₹90 + CGST 8.10 + SGST 8.10. PDF summary jod nahi baithta tha → Android `9d2e772` ("Discount applied" upar) → phone par dobara theek. Naya **K-A16**. Test data phone par bacha: item "TEST GST 18", bill INV-002. Step 2 faisla: Desktop pehli baar Google, phir master password. | Android (phone) |
| 2026-09-30 | **Desktop v4.84.0 — Step 2: Google sign-in.** Rahul ne OAuth client ("KamaiPlus Desktop", Desktop app) diya → `.env.local` (`NEXT_PUBLIC_GOOGLE_DESKTOP_CLIENT_ID/SECRET`, git-ignored). Branding links proventure.in (404) → kamaiplus.web.app (K-P16); branding verification website ke saath. Main process `googleSignIn.js` (browser → 127.0.0.1, PKCE, state, 3 min), `cloudAccount.ts` (Firebase `signInWithCredential`, `kamai_cloud_account`, `biz_<uid>`; local business id nahi badla), AuthForm step 1 Google (desktop mein zaroori), Backup card. Test §9j(t) 11 (RFC 7636 vector, loopback round trip), suite 654/654; Electron E2E 72/72 (stub). Live: Google + Firebase ✅, `biz_<uid>` 404. | Desktop |
| 2026-09-30 | Android branch `feat/cloud-data-contract` **GitHub par push** (Rahul ka OK). Phone par account DB files: `kamaiplus_XXokEu2E….db` (chalu, "sgc") aur `kamaiplus_V7xUycMK….db` — `iamdivyaang` (`nfizBU…`) wala nahi → phone kisi aur Google account par. Android har account ka alag DB rakhta (`switchUser`) — account badalne se data mix / delete nahi. | Android |
| 2026-09-30 | **Desktop v4.84.0 publish — sabke liye** (Rahul: "publish kardo"). Test installer (`build:desktop`, asar mein `googleSignIn.js` ✔, client ID bundle mein ✔) → `prepare_release.js` → `release:publish`. Live `latest.yml` + `beta.yml` = 4.84.0; installer 115,477,262 bytes, live sha512 = `latest.yml` ✔; 4.81.0 installer hata (404). Isme 4.82 (backup har ghante) + 4.83 (contract, units) + 4.84 (Google login) teeno. Installer abhi bhi unsigned (K-D08). | kamaiplus-desktop.web.app |
| 2026-09-30 | **Desktop v4.85.0 (Rahul ki list, Step 3 roka):** (1) billing customer — naam box mein sirf naam (Hindi / Marathi bhi), number box mein sirf 10 digit (+91 paste = aakhri 10), dono zaroori nahi; (2) **F2 = agla bill** (ek hi bill ho to naya bill, "+ New Bill" jaisa), search ab `/`; (3) F4 / F8 / F9 Settings → Features → "Payment keys" switch ke peeche, **default off**; (4) Barcode Studio: preview hamesha (sample label), sticky, custom size typing, copies 999, Bluetooth price, "Print 1 label" (K-D25, K-D26); (5) Google pehli baar optional; (6) licence validity + online check-in (K-D27). Test §9j(v)(w)(x), Electron E2E §1b. | Desktop |
| 2026-09-30 | **Admin Console + desktopLicence (Android branch `feat/desktop-licence-validity`, `2f6889d`, push hua):** key par end date ("Set validity / renew": lifetime, +1/3/6/12/24 mahine, ya tareekh), "Ending in 30 days" / "Validity ended" ginti, "Last online"; function action `refresh` (check-in). Functions test 82/82, admin test 3/3, analyze saaf. **Deploy nahi hua** — auto-mode ne production deploy roka; Rahul chalaye: `firebase deploy --only functions:desktopLicence` aur admin build + `firebase deploy --only hosting:admin` (Android repo). Tab tak 4.85.0 par kuch nahi toot-ta (check-in ka jawab "unknown action" = koi badlav nahi). Naya K-P17 (Node 20). | Android |
| 2026-09-30 | **Sab live (Rahul: "online upload kardo, sab taraf, public kardo"):** `desktopLicence` function deploy (live check: action `refresh` samajhta hai) · Admin Console build + `hosting:admin` deploy (kamaiplus-admin.web.app — Desktop Licences mein "Set validity / renew") · **Desktop v4.85.0 publish sabke liye**: live `latest.yml` + `beta.yml` = 4.85.0, installer 115,468,804 bytes, live sha512 = `latest.yml` ✔, 4.84.0 installer hata (404); asar mein naya `licence.js` ✔. Installer unsigned (K-D08). | Firebase + kamaiplus-desktop.web.app |
