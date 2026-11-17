# 01. Project Understanding

## Scope and evidence

This workspace is the Desktop codebase for KamaiPlus, not a monorepo with a separate Android or backend service. The strongest evidence in-repo is:

- `AGENTS.md` and `ENGINEERING_BIBLE.md` describe the application as a Windows Electron + Next.js desktop app for Indian retail.
- `package.json` declares `next`, `react`, `tailwindcss`, `electron`, `dexie`, `firebase`, `xlsx`, `jspdf` and Electron-builder.
- The `src/` tree contains rendering pages, billing logic, local database layer, cloud sync abstractions, and no server-side API implementation.
- `docs/PLATFORM_TRACKER.md` and `docs/VERTICAL_PLAN.md` explicitly describe the Android repo and Firebase admin/website work as separate repos and external flows.

The repository does not currently implement a KamaiPlus Stay vertical. A targeted search for `Stay`, `KamaiPlus Stay`, `hotel`, `lodging`, `room`, `guest stay`, or a separate route/module returned no product-level implementation.

## Verified current technology stack

| Layer | Verified technology | Evidence |
|---|---|---|
| App shell | Next.js 16.3.1 + App Router | `package.json`, `ENGINEERING_BIBLE.md` |
| UI | React 18.3.1 + TypeScript 5.9.3 + TailwindCSS 3.4.19 | `package.json`, `ENGINEERING_BIBLE.md` |
| Desktop shell | Electron 44.4.3 + electron-builder | `package.json`, `ENGINEERING_BIBLE.md` |
| Local data store | Dexie 4.4.4 over IndexedDB (`VyaparSetuDB`) | `src/lib/db/index.ts`, `ENGINEERING_BIBLE.md` |
| Optional cloud | Firebase 12.18.0 (Auth, Firestore, Storage, Remote Config) | `src/lib/firebase/config.ts`, `package.json` |
| PDF / Excel | jsPDF, html2canvas, xlsx | `package.json`, `ENGINEERING_BIBLE.md` |
| Printing / label support | Electron IPC + OS printers + label calibration scripts | `main.js`, `printers.js`, `labelCalibrate.js` |
| Licensing | local offline verification + server-backed control flow | `licence.js`, `ENGINEERING_BIBLE.md` |

## Product identity and constraints

The app is currently described as:

- Offline-first billing POS and retail management for Indian small businesses.
- A single universal retail app, not a multi-business-mode platform.
- Built around money as integer paise, not floats.
- One desktop app sold as a one-time licence, not a SaaS subscription model.

This is consistent with the product truths in `ENGINEERING_BIBLE.md` and the existing vertical profile architecture in `src/lib/business/verticalProfile.ts`.

## Repository structure

### Top-level

- `main.js` — Electron main process.
- `preload.js` — exposes the Electron bridge to the renderer.
- `licence.js`, `updater.js`, `backup.js`, `errorlog.js`, `printers.js`, `whatsapp.js`, `waLink.js`, `waWorker.js`, `labelCalibrate.js` — desktop integrations.
- `src/app/` — Next.js app routes.
- `src/components/` — UI and feature modules.
- `src/lib/` — business logic, persistence, sync, validation, pricing, and feature switches.
- `docs/` — product documentation, tracker, and architecture notes.
- `scripts/` — release, smoke, and test tools.

### Application entry points

- `src/app/layout.tsx` wraps the app with `ErrorReporter`, `DesktopLiveSync`, `DialogHost`, `LicenceGate`, and `AppShell`.
- `src/app/billing/page.tsx` is the core retail POS route.
- `src/app/restaurant/page.tsx` is a separate restaurant-oriented experience, implemented as a feature route rather than a new app.
- `src/app/products/page.tsx`, `inventory`, `khata`, `transactions`, `settings`, etc., are standard modules of the same app.

## Desktop architecture

`ENGINEERING_BIBLE.md` verifies the runtime topology:

1. Electron main process manages the desktop shell and low-level OS integrations.
2. It serves the rendered app through `app://kamaiplus` or a local Next dev server in development.
3. `preload.js` exposes the only bridge for the renderer (`window.kamaiDesktop`).
4. All database state lives locally in IndexedDB via Dexie.
5. Firebase is optional and used for cloud sync, analytics, auth, and remote config rather than as the app's source of truth.

## Restaurant vertical evidence

The app already supports a strong restaurant implementation as a specific business profile, not as a separate microservice application.

Evidence:

- `src/app/restaurant/page.tsx` routes to `RestaurantPage`.
- `src/lib/business/verticalProfile.ts` includes `restaurant` as a valid business vertical.
- `src/lib/features/featureSwitches.ts` contains restaurant presets and `restaurant_mode` handling.
- `src/components/restaurant/` contains order screens, table layouts, KOT logic, payment flows, and menu management.

This confirms the existing architecture is a single app with vertical-specific configuration rather than a separate hospitality app.

## What is missing for Stay

What is not present in the workspace:

- no `kamaiiplus-stay` module or route
- no hotel / lodge / guest-room / booking / check-in flow
- no Stay-specific database tables or schema
- no Stay-specific admin toggle or permissions model
- no guest stay checkout, occupancy, or room inventory logic

## Conclusion

The current KamaiPlus codebase is a single desktop-first retail system with a vertical configuration pattern. The most realistic path for KamaiPlus Stay is not a second app, but an extension of the same app architecture with a new business profile and business-specific workflows.

That keeps the architecture aligned with the existing product logic, especially the `verticalProfile` and feature switch system already used for restaurant-specific behavior.
