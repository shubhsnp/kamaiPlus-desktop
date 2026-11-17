# System Architecture

## Scope
This repo is the KamaiPlus Desktop application codebase. It is not a full-stack monorepo containing a separate backend service, Android app, or admin service implementation. The evidence in-repo is clear and consistent.

## Verified stack
- Framework: Next.js 16.3.1 with App Router
- UI: React 18.3.1 + TypeScript 5.9.3 + TailwindCSS 3.4.19
- Desktop shell: Electron 44.4.3 + electron-builder
- Local DB: Dexie 4.4.4 over IndexedDB (`VyaparSetuDB`)
- Cloud SDK: Firebase 12.18.0 includes Auth, Firestore, Storage, and Remote Config modules. Their presence does not mean every service is active; current paths and the sync gate are qualified in the T0 addendum below.
- PDF / Excel: jsPDF, html2canvas, xlsx
- OS integration: Electron IPC, Windows printer support, WhatsApp bridge, local backup, licence management

## Runtime topology
Verified in `ENGINEERING_BIBLE.md`, `main.js`, `preload.js`, and `src/app/layout.tsx`.

- Electron main process owns the desktop shell and OS integrations.
- `app://kamaiplus` is the app origin; Electron serves the static Next export.
- `preload.js` exposes a narrow bridge via `window.kamaiDesktop`.
- The UI runs as a static export served by the Electron app.
- `src/lib/db/index.ts` drives `'VyaparSetuDB'` using Dexie.
- Firebase is optional and used for cloud sync/auth, not as the primary transactional datastore.

## Key app entry points
- `main.js` — Electron main process and IPC handlers
- `preload.js` — renderer bridge
- `src/app/layout.tsx` — app root shell + `LicenceGate` + `AppShell`
- `src/app/billing/page.tsx` — core POS route
- `src/app/restaurant/page.tsx` — restaurant vertical route
- `src/app/settings/page.tsx` — settings shell

## Database architecture
The application uses local-first storage with the Dexie database declared in `src/lib/db/index.ts`.

Current tables:
- `businesses`
- `categories`
- `products`
- `customers`
- `suppliers`
- `sales`
- `inventory_movements`
- `ledger_transactions`
- `cash_registers`
- `cash_expenses`
- `sales_returns`
- `marketing_templates`
- `audit_logs`
- `purchase_bills`

This is a direct retail-oriented data model, not a hospitality model.

## Existing vertical architecture
The repo already contains a vertical profile mechanism:
- `src/lib/business/verticalProfile.ts`
- `src/lib/features/featureSwitches.ts`

It supports categories such as:
- `grocery`
- `pharmacy`
- `clothing`
- `hardware`
- `restaurant`
- `retail`

This is evidence that the app supports one shared shell with existing business profiles and feature switches. It does not establish that a new module must be a vertical or that those local switches are a secure business entitlement.

## Restaurant implementation
The restaurant vertical is already a sub-feature of the same platform, not a separate application.

Relevant files:
- `src/app/restaurant/page.tsx`
- `src/components/restaurant/RestaurantPage.tsx`
- `src/components/restaurant/OrderScreen.tsx`
- `src/components/restaurant/TablesHome.tsx`
- `src/lib/restaurant/*`

This proves the project pattern for a hospitality-like vertical within a shared app.

## Admin / feature control architecture
The repo has remote control and feature-gating infrastructure:
- `src/lib/admin/adminControl.ts`
- `src/lib/admin/adminMessages.ts`
- `src/components/admin/AdminControlHost.tsx`
- `src/lib/features/featureSwitches.ts`

The verified Desktop control path is per-device/generic control. It is not currently a business-scoped Stay configuration or authorization lease. Reuse for Stay is only a proposal and requires proof that a trusted business identity is bound by the backend.

## Security model and constraints
- Licence check is enforced at the desktop shell level via `licence.js` and `src/components/licence/LicenceGate.tsx`.
- Feature switches are local and admin-controlled, but they are not sufficient security by themselves.
- The repo is not using a server API layer as the primary truth; it is using local-first state plus optional cloud sync.

## Verified facts vs assumptions
Verified facts:
- The app is a single shared desktop product.
- Restaurant is already a vertical under the same app.
- A vertical profile/feature switch system already exists.
- Cloud sync is optional and contract-based.

Proposals and unresolved questions:
- A centrally managed, business-scoped Stay activation is a user requirement; its Admin writer, backend contract, and trusted identity path are not verified in the available repository.
- Stay must remain inside the existing applications and must not alter Restaurant behavior. Whether it is a separate business profile or a module selected within an existing profile is unresolved; do not infer that it belongs under Restaurant mode.

## Conclusion
The verified architecture supports one shared Desktop shell and an existing Restaurant vertical. The product direction is to add Stay inside the existing applications, but activation, identity, authorization, Android parity, and Stay's exact relationship to vertical profiles remain unimplemented or unresolved. No Stay implementation is ready to begin until the external identity/backend/auth gates are resolved.

## T0 source-verified correction — 2026-11-16

This addendum is the current evidence snapshot; it supplements the design notes above and distinguishes available code from external documentation.

- **Verified implementation:** Desktop Admin check-in sends licence/device fields through `licence.js`; the response's generic `body.control` is cleaned and persisted per device by `adminLink.js`, passed through Electron IPC, and applied by `AdminControlHost`. The current control shape does not carry a canonical business ID or Stay lease.
- **Verified implementation:** onboarding generates a local Dexie business ID as `biz_<sanitized first 8 characters of user ID>_<timestamp>`. The cloud account separately derives `biz_<Firebase uid>`; `cloudContract.ts` maps between local and cloud identities without making them interchangeable. Admin, Android, and licence-to-business mapping are not proven by this repository.
- **Verified implementation:** `CLOUD_SYNC_ENABLED = false` disables the legacy `lazyCloud`/background sync/onboarding Firestore paths. A separate newer cloud outbox sender exists and can be enabled per computer when a cloud account is linked. Staff and Restaurant cloud features also have direct Firebase paths. Do not summarize this as “all cloud sync is disabled,” and do not treat any of these paths as a Stay configuration service.
- **Verified implementation:** Desktop's ordinary login is a local `local_admin` profile protected by the master password. Cloud account linking is separate. Staff records include generic permission fields, but the Desktop permissions dialog is deprecated/empty and no `stay.view` or `stay.manage` grant exists.
- **Verified implementation:** no Stay route, domain, lease consumer, permission, or Dexie table is present.
- **Unknown / blocked:** the Android app, Admin Console source, Cloud Functions source, live Firestore rules, staging environment, and deployment permissions are not available in this workspace.
- **Planning status:** business-scoped durable Admin config and a separate time-limited client lease are recommendations in `STAY_PHASE1_FINAL_DECISIONS.md`, not deployed behavior or owner-approved service details. Integrated Phase 1 remains **NOT READY**.
