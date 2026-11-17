# STAY_ANDROID_DESKTOP_INTEGRATION.md

## Verified facts

- The repo is a desktop application using Electron + Next.js + Dexie + optional Firebase, not a multi-application monorepo.
- There is no Android app source in this repository.
- There is a shared cloud contract pattern in `src/lib/cloud/cloudContract.ts` and a business model in `src/lib/db/index.ts`.
- The desktop app already receives admin control through `adminLink.js` and `src/lib/desktop/desktopBridge.ts`.

That means the design must define the shared contract required for Android and desktop compatibility, without assuming Android-specific implementation is present here.

## Shared integration points required

For Stay to work across Android and desktop, the following domain objects should be consistent across both clients:

- business identity
- room inventory state
- booking status and dates
- stay lifecycle state
- folio and balance state
- payment and refund state
- admin module activation state
- room availability and housekeeping status

The contract should be driven by the same IDs and same semantics on both platforms.

## Shared configuration contract

The existing repo uses a shop/business config model plus local admin override. The Stay config should not be created as a separate free-floating module activation system.

Recommended shared contract:

```json
{
  "business_id": "biz_123",
  "module": "stay",
  "enabled": true,
  "effective_state": "enabled",
  "scope": "business",
  "updated_at": "2026-11-16T12:00:00.000Z",
  "updated_by": "admin_user_id",
  "source": "admin_console",
  "version": 1
}
```

This should be used by both desktop and Android clients. The local desktop app may persist it in its last-known state file; Android may receive it from the same cloud-backed admin config contract.

## Required Android integration points

Even without Android source in this repo, the required integration points are clear:

1. Shared business metadata
   - business identity
   - business timezone
   - business day boundaries

2. Shared room configuration
   - room numbers and statuses
   - room type mapping
   - tariff plans

3. Shared reservation state
   - booking ids
   - arrival/departure dates
   - stay or check-in state

4. Shared folio sync
   - charges
   - payments
   - refunds
   - tax components

5. Shared admin module contract
   - stay enabled/disabled
   - versioning
   - timestamp of config update

6. Shared outbox sync semantics
   - idempotency keys
   - local queue state
   - retry semantics

7. Shared room availability lock semantics
   - final booking confirmation must be resolved with the same rules on both platforms

## Desktop-specific contract

The desktop app already has:
- local Dexie storage
- admin control payload persistence (`admin_control.json`)
- local feature overrides via `kamai_admin_feature_overrides`

Stay integration should reuse these patterns for the admin control and then add a business-specific Stay state, rather than inventing a separate toggle mechanism.

## What should not be duplicated

This document explicitly rejects a separate independent Stay database or independent activation system for Android.

The Android app should use:
- the same business_id
- the same module config contract
- the same room/booking/stay schemas
- the same folio and payment logic policy
- the same admin control semantics

The only mobile-specific differences should be UI and device-specific operational workflows, not a different business domain model.

## Why the shared contract is necessary

Without a shared contract, each client could drift into different definitions of:
- enabled vs disabled
- active stay status
- room occupancy meaning
- payment allocation rules
- invoice/folio state
- admin override source of truth

This would create duplicate or conflicting room bookings and mismatched financial ledgers.

## Conflict handling across devices

The same rules apply on Android and desktop:
- no second active stay for the same room in same time window
- no duplicate payment with same idempotency key
- no double-check-in for the same active stay
- no room state reset without an audit event

The actual enforcement should occur in the shared service contract and be consistent across clients.

## Recommendation

Use the existing business model and admin config contract as the central integration contract, and extend it with Stay-specific fields rather than implementing a second configuration system.

That keeps the architecture aligned with the repo’s real design patterns and avoids drift between Android and desktop.

## Final architecture decision: shared Stay config contract across desktop and Android

### Decision
Desktop and Android must use the same Stay admin configuration contract and the same business-scoped activation semantics. There is no separate Android-only activation system.

### Reason
The repo already defines a shared business model and cloud contract. Reusing one contract avoids divergence in room availability, folio state, payment posting and admin disable semantics.

### Alternatives considered
- Android-specific stay registration: rejected.
- Separate desktop-only toggle: rejected.
- Separate local database for Android: rejected.

### Risks
- if contracts drift, devices may disagree on room or payment state
- stale config may leave Android or desktop in different states while offline

### Testing implications
- verify both client types consume the same config version and timestamps
- verify both clients reject unsafe operations when config expires or disables the module
- verify actual room and payment state remains consistent after reconnect

### Shared contract minimum fields
- `business_id`
- `module`
- `enabled`
- `effective_state`
- `scope`
- `updated_at`
- `updated_by`
- `source`
- `version`
- `expires_at`

## Unresolved decisions

- Whether Android receives the config through Firebase only or through a lighter shared business object in the same cloud contract.
- Whether the Stay admin toggle is a boolean or a state machine (`enabled`, `disabled`, `limited`, `maintenance`).
- Whether the property-specific control is stored per business rather than per device in the first implementation.
