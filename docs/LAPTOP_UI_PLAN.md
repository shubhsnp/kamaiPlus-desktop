# Laptop UI / UX plan — Desktop (design ho gaya, code nahi)

> Banaya: 2026-11-07 / 08, Desktop v4.183.0 par. Rahul ka sawaal: "laptop desktop app ke screen ko
> kaise aur better kar sakte hai… canva design me option do… electron run karke… psychological
> mental sab aspect". Phir: "isme setting page bhi dikhao" aur "future implementation ke liye save
> karke rakho".
>
> **Status: sirf design.** Koi code nahi badla. Rahul har row se ek option chunenge, tab banana hai.
> Backlog: `docs/FUTURE_SCOPE.md` FS-34. Kamiyan: `docs/PLATFORM_TRACKER.md` K-D41…K-D46 (+ FS-24).
> Shuru karne se pehle `ENGINEERING_BIBLE.md` padhein (AGENTS.md Rule 0) — file ke naam neeche
> 2026-11-08 ko `rg` se jaanche gaye the, phir bhi ek baar dobara dekh lein.

| Kya | Kahan |
| :--- | :--- |
| Design canvas (23 board: "Abhi" asli screenshot + nishaan, aur har option) | https://claude.ai/artifact/EQDaZm3CTn4gaGMkLJVKxZ (Rahul ka private) |
| Saare screenshots, naap (`metrics.json`), tour scripts, canvas ka source (`.dc.html`) | `D:\My Web Sites\KamaiPlus Screens\desktop-4.183-laptop-ui-2026-11-07\` (git mein nahi) |

---

## 1. Kaise naapa

- Built app (`out/`, v4.183.0) asli Electron mein, `KAMAI_E2E_DIR` wale khali folder mein, signed licence
  ke saath (jaise `scripts/smoke_pages.mjs`). Shop data / licence asli PC ka nahi chhua.
- Size: **1366×700** (aam laptop, Windows taskbar ke baad), **1280×650** (sabse chhota), **1536×794**
  (15.6" FHD, 125 % — is dev PC ka). Size `page.setViewportSize()` se — `BrowserWindow.setContentSize`
  kaam nahi karta kyunki `main.js` window ko maximize karta hai.
- **Sabhi 6 vertical:** Grocery (4 bill, har screen), Pharmacy, Clothing, Hardware, General Retail
  (setup → counter par 3 item → sale → Products → naya item form), Restaurant (Admin control
  `userData/admin_control.json` = `{"mode":"normal","features":{"restaurant_mode":true}}`; tables,
  order, KOT, Bill window). Settings ke 5 tab scroll ke saath + "Unsaved Changes" patti.
- Har screen par naap: dikhte buttons, 11px se chhota text, 28px se chhote buttons, kitni screen lambi,
  kata hua text. Page error: **0** har jagah.
- Dobara chalane ke liye (pehle `npm run build`): scripts folder ke `laptop_tour.mjs` (grocery,
  `<out-dir>` argument), `vertical_tour.mjs <out-dir> [pharmacy,clothing,…]`, `settings_tour.mjs <out-dir>`.
  Git Bash mein `unset ELECTRON_RUN_AS_NODE` pehle (VS Code set karta hai). In scripts mein `APP_DIR`
  is PC ka path hai.

---

## 2. Jo mila (1366×700)

| Screen | Naap | Asar |
| :--- | :--- | :--- |
| **Billing counter** (Grocery / Hardware / Retail) | Bill mein **2 line** dikhti (1280×650 par 1). Total + 4 payment + Complete + Estimate ≈ 240px. 66 jagah 10px text, 31 button < 28px (qty +/−, pencil, dustbin). Hardware ke lambe naam bill mein kat-te | Item scroll mein chhupa → "add hua ya nahi?" shak → dobara scan, galti |
| Billing — **Pharmacy** | Patient / Doctor line hamesha khuli → **1 dawai** dikhti. Card par "Tablets & …" kat-ta. Bill par batch / expiry nahi | Dawai mein galti ka darr sabse zyada |
| Billing — **Clothing** | **1½ item**. Size wale card par daam kat-ta: "from ₹…" ("4 Variants" badge). Size window (keys 1–9) achhi hai | Grahak pehle size aur daam poochta |
| **Restaurant** order | Har dish ~100px ("Add-ons / note" har line par) → 4 mein se 3 dikhti. "Half / F…" kat-ta. Table patti + Bill window (v4.183) achhe | — |
| **Sale Completed** window (`InvoiceModal`) | 3 bade button ek saath (New Bill peela, Print kala, WhatsApp hara poori chaudai); aadhi window bill preview | Aankh tay nahi karti; peak hour mein har bill ke baad extra kaam |
| **Home** | Profit sabke saamne; ₹0 udhar bhi laal dabbe mein; "Business Pulse", "Advanced Analytics", "Gross Margin"; Cash Register / Transactions sidebar + tiles dono mein | Grahak profit dekh sakta; laal = bina wajah darr |
| **Products** list | Header + 4 KPI card ke baad table 392px se shuru → **4 item**. Rows 78px | List ka kaam, list dikhti nahi |
| **App ka dhancha** | Upar 64px + niche 28px patti + har page ka header card. Sidebar 16 link, 700px par Customers / Staff / Settings bina scroll nahi. Daayi "Transactions" patti buttons dhakti (Customers PDF, Products "Cards") = FS-24 | Hick's law: zyada option = dheema faisla |
| **Settings** | Store & GST Profile **2.9 screen** (logo, contact, GST, Logout, Data Reset, UPI, Bank; Data Reset apne tab mein bhi; line "Testing ke liye sabhi products ko 1-click me clean karein"). Invoice & Bill Rules **3.5 screen** (dukaan ke niyam + sirf is computer ke printer / label / WhatsApp). **Do save niyam:** printer / WhatsApp turant (`savePrintSettings`, `saveWhatsAppSettings`), dukaan ki jaankari "Save Changes" se. UPI sabse niche | Lambi form = thakaan, adhoora chhodna; "save hua?" shak |
| Size chunne ki window | `VariantPickerModal.tsx` mein `aria-modal` / `role="dialog"` nahi — Ctrl+H us par bhi chalta | Chhota |

---

## 3. Options aur salah

Canvas par har row: pehle "Abhi", phir options. **Salah: A2 + D1 + C1 + B1 + S1** — aadat kam
tootegi, bill mein 6–7 item. A1 / D2 baad mein "Fast counter" setting ban sakte.

| Row | Options | Salah |
| :--- | :--- | :--- |
| 1 · Billing | **A1 Bill pehle:** bill table poori chaudai (7 item, 46px row), item cards F3 par khulein, "Quick" chips, "Customer gave ₹… → Give back ₹…". **A2 Kam badlav:** wahi 2 hisse, sidebar billing par apne aap icon wala, chhote card (naam + rate + stock), payment total ke dabbe ke andar, Estimate / Hold / Clear → "More" (6 item, 42px row) | **A2** |
| 2 · Sale ke baad | **D1:** chhoti window, ek hi peela "+ New Bill (Enter)", baaki P / W / S / E, "Printing on EPSON" line, preview maangne par. **D2:** window nahi — counter turant khali, upar hari patti "Last bill saved ₹565 · Print / WhatsApp / Edit" | **D1** |
| 3 · Home | **C1 Aaj ka hisaab:** 4 number ek dabbe mein (profit chhupa, ₹0 grey), New Bill + 3 kaam, "Selling most today", "Shop is safe" (backup / printer / stock). **C2 Dhyan do:** sirf jis par kaam karna hai (kam stock, purana udhar, pen drive) har card mein agla button | **C1** |
| 4 · Dhancha + list | **B1:** 196px sidebar — 7 roz ke link + "More" + Settings hamesha niche; page header ek line; 44px row (10 item). **B2:** 64px icon patti + Ctrl+K "kuch bhi dhoondo" (customer, item, bill, screen) | **B1** |
| 5–7 · Verticals (A2 par bane) | Pharmacy: Rx (Patient / Doctor) ek button, Rx dawai aate hi khule; batch + expiry har line par, 3 mahine se kam = peela. Clothing: card par "₹399 · S M L XL", bill mein size chip. Restaurant: dish line 44px, ✎ add-on, ✓ kitchen hara / "Not sent" peela, "Send KOT (3)" | sab |
| 8 · Settings | **S1:** baayi hisson ki list (Shop / Bills / This computer only / More, har line par ✓ / "1 left" / "not set"), ek hissa ek screen, Save patti hamesha ("1 change not saved · Undo · Save Ctrl+S"), Reset sabse niche laal shabd. **S2:** checklist page "4 of 6 important things done", optional (GST, label, staff) ginti mein nahi | **S1** |

---

## 4. Design niyam (har option par)

- **Akshar:** total 44px+ (grahak 1.5 m se padhe) · page naam 20 · item naam 15–16 · normal 14 ·
  sabse chhota 12. **10px kahin nahi.** Paise `font-variant-numeric: tabular-nums`. Hindi / Marathi
  (Mukta) ke liye button mein 30 % zyada jagah.
- **Rang ka matlab:** Peela `#F5B301` = screen ka EK main kaam · Hara `#0B7A54` = paisa aaya / pura /
  theek · Laal `#B42318` = sirf asli khatra (delete, expired, fail) · Kaala `#14181F` = total, chuna tab
  · Grey = ₹0, khaali, band. Ek screen par 2–3 rang ke button se zyada nahi; sidebar icon ek rang.
  Rang ke saath shabd bhi.
- **Jagah:** upar patti 48px, niche keys patti 30px — bas. Page header ek line. List row 44px,
  bill line 42–46px. Button ≥ 32px (mouse), main kaam 48–60px.
- **Mann ke niyam:** 1 screen = 1 main kaam · har kaam ke baad saaf "ho gaya" (✓ + raqam) · darr kam
  (₹0 laal nahi, "Clear bill" pooch kar) · paisa private (profit chhupa, owner ek click) · yaad nahi,
  dikhe (F-keys button par + niche patti) · aadat mat todo ("Complete Sale" naam aur jagah wahi) ·
  dukaan ke shabd (Udhar, Galla, Hisaab — "Pulse", "CRM", "Margin" nahi).
- **Test:** 1366×700 aur 1280×650 par main kaam bina scroll; bill mein kam se kam 6 item.

---

## 5. Banane ka kram (Rahul ke chunne ke baad)

Ek version = ek screen (AGENTS.md Rule 1). Har step: `tr()` + `hi.json` / `mr.json` (Bible §7.1),
Suite 9 invariant, Electron E2E naap, `node scripts/help_impact.mjs` + `docs/HELP_SYNC.md` row
(Rule 7 — billing-counter, home, settings guides ke screenshots badlenge), version +0.1, commit
local (push / release sirf Rahul ke kehne par).

1. **Billing counter (K-D41)** — `components/billing/PosCheckoutPanel.tsx` (**396 lines — 400 ki
   seema**, pehle hissa alag karo), `PosCheckoutFooter.tsx`, `PosCatalogPanel.tsx`,
   `PosProductCard.tsx` (K-D42 "from ₹…"), `PosPrescriptionRow.tsx` (Rx button), `usePosKeyboard.ts`
   (F-keys wahi; A1 chuna to F3). Sidebar billing par chhota: `components/layout/Sidebar.tsx`
   (Ctrl+B pehle se, `kamai_sidebar_collapsed`). "Give back ₹" ka hisaab restaurant
   `components/restaurant/PayDialog.tsx` mein pehle se hai — wahi tarika. E2E: 1366×700 par 7 line ke
   bill mein ≥ 6 line dikhein; `data-pay-*` hooks na tootein.
2. **Sale ke baad (D1)** — `components/invoices/InvoiceModal.tsx`. Dhyan: ye window Transactions se
   reprint mein bhi khulti hai — dono jagah jaanchein. Enter = New Bill bana rahe.
3. **Settings (S1, K-D46)** — `app/settings/page.tsx`, `components/settings/SettingsNavTabs.tsx`,
   `StoreProfileTab.tsx` (Logout store menu mein pehle se hai — `Navbar.tsx` "Log out" — yahan se
   hatao; Data Reset sirf Data tab mein; dev wali line hatao),
   `UpiBankingTab.tsx`, `InvoiceSettingsTab.tsx`, `PrintSettingsCard.tsx`, `LabelPrinterCard.tsx`,
   `WhatsAppSettingsCard.tsx`, `SettingsChangeDialogue.tsx` (save patti). Ek save niyam chunein:
   "This computer only" group turant save + "Saved ✓", baaki Save patti. Deep links
   `/settings?tab=…` (`lib/ui/settingsLinks.ts`, status bar "Bill rules") chalte rahein.
4. **Dhancha (B1)** — `Sidebar.tsx`, `Navbar.tsx` (64 → 48px; Store QR / Sound store menu mein),
   `DesktopStatusBar.tsx`, `GlobalDrawers.tsx` (FS-24 / K-D43). Page header ek line:
   `components/products/ProductMetricsRibbon.tsx`, `app/products/page.tsx`,
   `app/transactions/page.tsx` (44px row). F1 / Ctrl+H / Ctrl+L wahi (`lib/ui/globalShortcuts.ts`).
5. **Home (C1)** — `components/dashboard/DashboardHome.tsx`, `TodayBusinessPulse.tsx`,
   `QuickActionDock.tsx`, `lib/dashboard/homeTiles.ts`. Profit chhupana `lib/auth/cashierPrivacy.ts`
   ke saath (PIN wala niyam na toote).
6. **Restaurant order lines** — `components/restaurant/OrderPanel.tsx`, `MenuPanel.tsx`
   ("Half / Full"). `data-order-*` / `data-strip-*` hooks aur Bill window ki fixed height (E2E naapta
   hai) na badlein.
7. **Chhote** — `VariantPickerModal.tsx` par `role="dialog" aria-modal="true"` (K-D44);
   `PrinterWatcher.tsx` ka "Printer set automatically" popup sidebar na dhake.

**Android:** F-07 ke hisaab se baad mein phone ka apna design (alag canvas) — ye plan sirf laptop ka hai.
