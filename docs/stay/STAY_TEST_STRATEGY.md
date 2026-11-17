# STAY_TEST_STRATEGY.md

## Scope

This strategy covers the architecture validation and the first implementation phase for Stay. It is design-only and does not introduce test code.

## Verified repo facts

- The repo has existing Dexie schema and migration patterns in `src/lib/db/index.ts`.
- Admin remote control is implemented in `adminLink.js`, `src/lib/admin/adminControl.ts`, and `src/components/admin/AdminControlHost.tsx`.
- Feature gating exists in `src/lib/features/featureSwitches.ts` and `src/components/features/FeatureGate.tsx`.
- There is no existing Stay test suite or Stay domain logic yet.

## Testing objectives

The Stay test strategy must cover:
- route and feature activation safety
- room availability correctness
- reservation conflict behavior
- payment idempotency
- folio accuracy
- night audit integrity
- offline recovery
- admin disable behavior
- Android/desktop config parity

## Test categories

### 1. Unit tests

Focus:
- `stay_enabled` helper logic
- room availability checks
- folio balance calculations
- tariff and tax calculations
- split payment allocation
- refund math
- ADR and RevPAR formulas
- feature gate route logic

Examples of unit assertions:
- a folio with charges, payments and adjustments has the correct remaining balance
- a `room_charge` + `tax` + `discount` produces the correct amount to invoice
- a duplicate payment with the same idempotency key is rejected
- room availability rejects overlapping active stays

### 2. Integration tests

Focus on how the Stay domain interacts with the existing app:
- Dexie data writes to the local DB
- `business_id` filtering
- local sync outbox handling
- migration behavior
- route and admin override reactivity

Examples:
- when `stay_enabled` is false, route load and direct access are blocked
- after offline booking creation, the record stays in pending sync until cloud confirmation
- after reconnect, the payment is not double-posted because the idempotency key is reused

### 3. Migration tests

Focus:
- Dexie version upgrades for Stay schema
- data preservation from existing businesses
- safe defaults for newly created rooms and room types
- migration rollback and validation

Examples:
- no data loss when adding `room_tariffs` or `folio_entries`
- previous Restaurant records remain untouched
- old backup files can still restore successfully without reintroducing stale room state

### 4. Conflict and concurrency tests

Focus on safety-critical flows:
- two devices booking the same room at the same time
- two devices checking in the same room simultaneously
- simultaneous payment attempts for the same folio
- multiple night audit sessions on the same business date

Expected result:
- only one reservation or check-in can finalize
- later duplicate operations are rejected or marked `needs_review`

### 5. Offline recovery tests

Focus:
- browser or device offline while creating bookings
- payment submission while offline
- night audit while the network is down
- admin disable while offline

Expected result:
- local draft is preserved
- finalization is deferred until safe validation occurs
- stale admin config is respected after reconnect or startup

### 6. End-to-end desktop behavior tests

Focus:
- route block for disabled Stay
- room assignment and check-in flow
- folio payment sequence
- checkout final bill
- night audit closure
- admin remote-control update applying to the app in real time

### 7. Security tests

Focus:
- direct URL access to disabled Stay routes
- local function calls to access a stay that is not allowed
- cross-business access attempts
- forbidden payment posting after disablement
- room state modifications after module disable

Expected result:
- blocked by guard logic and service security checks
- the app does not silently continue using stale local state after the module is disabled

## Required negative tests

The implementation should include tests for:
- room double-booking
- check-in to a room that already has an active stay
- duplicate payment with same idempotency key
- duplicate refund with same reference number
- duplicate invoice number generation
- night audit closure before all folios are settled
- cross-business stay access
- direct database access to a stay after module disable

## Test matrix

Priority should be:
1. booking conflict safety
2. check-in correctness
3. payment idempotency
4. audit reconciliation integrity
5. admin disable enforcement
6. off-line data safety
7. Android/desktop contract parity

## Recommendation

The first stable implementation should prove the following before broader feature work:
- room availability can be safely managed under concurrent update conditions
- payments cannot be duplicated
- admin disable is enforced at both route and data access layers
- nightly closure and cash variance are auditable and deterministic

## Finalized test obligations (2026-11-16)

### Decision
The first implementation must prove the following before broader extension:
- central admin disable blocks new Stay operations and preserves existing data
- room allocation cannot double-book under concurrent attempts
- folio balances are correct for charges, payments, refunds and corrections
- payment retries are idempotent and do not duplicate ledger entries
- night audit cannot close twice and cannot silently rewrite completed transactions
- offline drafts remain provisional until online validation

### Reason
These are the highest-risk safety and financial integrity requirements for the Stay domain.

### Alternatives considered
- End-to-end happy-path testing only: rejected because the risk is in concurrency and financial integrity.
- Testing room allocation only: rejected because payment, audit and disable safety are equally critical.

### Risks
- hidden data corruption under retries or stale local state
- room conflicts not caught by basic UI tests
- incorrect cash variance handling during close

### Testing implications
- add negative tests for duplicate room booking, duplicate payment and duplicate audit close
- add offline recovery tests for provisional booking and payment flows
- add route and service tests for disabled module enforcement

## Unresolved decisions

- Whether the first implementation includes a single central reservation lock or a simpler optimistic concurrency pattern.
- Whether the Android client will be included in initial verification or only in a later integration phase.
- Whether night audit finalization is fully offline-capable or restricted to online final close.
