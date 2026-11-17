# Existing Feature Inventory

## Retail and POS features
Verified from the repo structure and app routes:
- `src/app/billing/page.tsx`
- `src/components/billing/*`
- `src/lib/billing/*`

Core features include:
- billing and cart flow
- payment split and settlement
- product catalog management
- stock handling and inventory integration
- purchase / inward flows
- customer and khata account logic
- invoice generation and print support
- payment method handling
- report generation
- GST / tax summary capability

## Restaurant features
Verified in:
- `src/app/restaurant/page.tsx`
- `src/components/restaurant/*`
- `src/lib/restaurant/*`

Existing capabilities include:
- tables and table management
- room/order-like flow for restaurant operations
- menu / dish selection
- POS-like ordering, KOT, payment, and table-status logic
- restaurant-specific configuration
- restaurant mode toggles and presets

This is the closest existing analogue to hospitality operations and should be treated as the integration precedent for Stay.

## Admin and configuration features
Verified in:
- `src/components/admin/*`
- `src/lib/admin/*`
- `src/lib/features/featureSwitches.ts`

Current admin patterns include:
- feature gating
- remote admin control
- message banners and control state
- configuration-based behavior changes

## Licensing and platform features
Verified in:
- `licence.js`
- `src/components/licence/LicenceGate.tsx`
- `src/components/licence/LicenceEndedScreen.tsx`

These include:
- local offline licence verification
- activation flows
- renewal control and check-in
- blocked state handling

## Cloud and sync features
Verified in:
- `src/lib/cloud/cloudContract.ts`
- `src/lib/firebase/config.ts`
- `src/lib/cloud/*`

Features include:
- local-to-cloud write mapping
- cloud contract normalization
- Firebase auth and Firestore setup
- optional sync with local data model

## UI feature patterns worth reusing for Stay
- `verticalProfile` model for business behavior
- `featureSwitches` model for capability gating
- modular route/page structures
- shared sidebar / shell / layout patterns
- generic report and billing components
- shared print / WhatsApp workflows

## Not present in repo today
The following do not appear to exist in the current workspace as implemented features:
- room master / floor management
- booking calendar
- check-in / check-out flow
- guest folio model
- housekeeping module
- maintenance tracker
- lost-and-found
- room move flow
- night audit concept for lodging
- Stay-specific admin toggle

## Conclusion
The repo already has a strong retail and restaurant platform, plus feature-gating and admin control infrastructure. It does not yet have a lodging / Stay feature layer.
