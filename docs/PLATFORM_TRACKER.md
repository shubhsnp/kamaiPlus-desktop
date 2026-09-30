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
| `sayrahul/kamaiplusDesktopApp` | `D:\My Web Sites\KamaiPlus Desktop App` | `main` (v4.80.0) | Chalega |
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

## 4. Kamiyan (count)

**Total: 43** — Platform 14 · Android 12 · Desktop 17. **Open 39 · Done 4.**
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
| K-P14 | Refund policy mein Desktop ki one-time licence ka koi niyam nahi; Android Pro ke niyam purane ("Pro & Enterprise", "Free Forever Tier") | 🟠 | Open — Rahul ka faisla chahiye |

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
