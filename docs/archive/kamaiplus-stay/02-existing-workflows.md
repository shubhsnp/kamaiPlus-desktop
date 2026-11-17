# 02. Existing Workflows

## 2.1 Login and onboarding

The current app uses a local-first state machine, with optional cloud integration after onboarding. The evidence points to:

- `src/app/onboarding/page.tsx` for store setup / first-run business creation.
- `src/lib/db/index.ts` for starter business creation via `ensureStarterBusinessIfEmpty()`.
- `src/lib/auth.ts` and related auth helpers for local sessions and access rules.
- `googleSignIn.js` and `src/lib/firebase/config.ts` for optional Google auth and Firebase-backed identity.

The product is not an API-first SaaS app: the store is created in Dexie IndexedDB, and cloud data is synchronised later rather than being the primary state source.

## 2.2 Business creation and vertical profile

Business setup is driven by the vertical profile engine:

- `src/lib/business/verticalProfile.ts`
- `src/lib/features/featureSwitches.ts`

This is the strongest reusable foundation for Stay. It already supports category-based behavior for `grocery`, `pharmacy`, `clothing`, `hardware`, `restaurant`, and `retail`.

This means the app already has a pattern for:

- category choice during setup
- feature switches tied to vertical
- GST logic tied to business profile
- route and screen visibility based on enabled capabilities

## 2.3 Pos and retail billing flow

The core sale flow is centered around the billing route and a large set of modular POS components:

- `src/app/billing/page.tsx`
- `src/components/billing/PosCatalogPanel.tsx`
- `src/components/billing/PosCheckoutPanel.tsx`
- `src/components/billing/PosPaymentPanels.tsx`
- `src/components/billing/posSaleActions.ts`
- `src/components/billing/posCartActions.ts`

This is the closest reusable pattern for a Stay checkout flow, especially for:

- item selection
- cart state management
- discount / payment split handling
- sales return and settlement
- print / WhatsApp sending

## 2.4 Restaurant workflow (existing vertical analogue)

The restaurant feature is the closest working hospitality pattern in this codebase.

Relevant modules:

- `src/components/restaurant/RestaurantPage.tsx`
- `src/components/restaurant/OrderScreen.tsx`
- `src/components/restaurant/TablesHome.tsx`
- `src/components/restaurant/TableStrip.tsx`
- `src/lib/restaurant/`

The restaurant vertical includes:

- table / order management
- menu and category flows
- KOT and kitchen print jobs
- guest / delivery information
- payment settlement
- restaurant-specific settings and presets

This is the main evidence that the app can extend to another hospitality workflow without creating a second app.

## 2.5 Product and inventory flow

The app stores inventory and product records in Dexie with indexes on business and product metadata. This is visible in `src/lib/db/index.ts` and the `Product` types in `src/types/index.ts`.

Typical flow:

- Add or edit product
- assign category and stock
- save record to Dexie
- allow purchase / inward / sales adjustments
- track inventory movement records and alerts

This separation is reusable for Stay operations such as room inventory, add-ons, occupancy consumables, housekeeping items, and service items.

## 2.6 Khata and customer ledger flow

Customer and debt flows are managed in the generic ledger model:

- `src/components/khata/`
- `src/lib/khata/`
- `src/types/records.ts`

This is directly relevant because a Stay system needs:

- guest ledger tracking
- room charges / deposit tracking
- payment settlement
- outstanding balance management

The generic `khata` workflow is likely reusable, but it would need a Stay-specific interpretation of the party and charge model.

## 2.7 Reports and analytics flow

The reports layer handles sales analytics, GST, daily summaries, and inventory reports:

- `src/app/reports/page.tsx`
- `src/components/reports/`
- `src/lib/reports/`

This layer is not inherently restaurant-only; it is a business data reporting layer and can be extended with Stay reports such as occupancy, room revenue, checkouts, advance payments, and daily occupancy summary.

## 2.8 Cloud sync and contract layer

The desktop app’s cloud model is defined in:

- `src/lib/cloud/cloudContract.ts`
- `docs/CLOUD_DATA_CONTRACT.md`

This pattern is important because the recommended Stay design is not a separate service boundary—it should be an additional business profile and cloud collection set in the same shared backend model.

The current contract already standardizes:

- `business_id` as a shared identifier across collections
- money as integer paise
- shared product and sale mappings
- category / customer / ledger conventions

## 2.9 Business logic that is reusable for Stay

The following are the clearest reusable components:

- vertical profile mechanism
- role and access gating via feature switches
- product catalog management
- customer / ledger data model
- purchase and stock flows
- billing / payment split logic
- invoice / PDF output
- backup and sync infrastructure
- admin control message system
- print and WhatsApp pipelines

## 2.10 What is not reusable as-is

The following areas are not currently tailored for accommodation workflows:

- room / booking status
- check-in / check-out calendar
- occupancy / vacancy state
- deposit / advance management
- night / day occupancy ledger logic
- room rate plans and stay packages
- housekeeping or room service workflow
- gate / access / guest profile model

These would require genuine new domain logic rather than a simple adaptation of retail menu or billing screens.

## Conclusion

The product already contains the underlying system architecture needed to support a second hospitality vertical: a shared app, a local-first data layer, a configurable vertical profile, and a modular feature switch model. The missing domain logic is specifically for accommodation operations; the retail and billing stack is already strong and reusable.
