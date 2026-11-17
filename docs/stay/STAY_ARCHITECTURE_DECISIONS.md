# STAY_ARCHITECTURE_DECISIONS.md

## Scope

This document captures the finalized architecture decisions for Kamai Plus Stay as a child module under the Restaurant vertical. It is design-only and does not build or modify source code or database schema.

## Verified repository facts

- The repo is an Electron + Next.js + TypeScript desktop app with Dexie over IndexedDB and optional Firebase-backed cloud-sync behavior.
- Restaurant is already a vertical under the same app shell.
- Admin remote control exists in `src/lib/admin/adminControl.ts`, `src/components/admin/AdminControlHost.tsx`, `src/lib/features/featureSwitches.ts`, `adminLink.js`, and `src/lib/desktop/desktopBridge.ts`.
- Local config is persisted in `admin_control.json` and feature overrides are stored in `kamai_admin_feature_overrides`.
- The current code does not yet show a full Stay module database or a backend-enforced Stay security boundary.

## Decision 1: Stay activation is business-scoped and centrally controlled

### Decision
Stay activation is centrally controlled by Kamai Plus Admin and scoped to each business. It is not a device-only toggle and it is not a user-level permission.

### Reason
The repo already uses business-scoped data boundaries and an admin remote-control pattern. Stay must follow the same pattern to avoid device-local drift, business leakage and inconsistent room allocation.

### Alternatives considered
- Device-only toggle: rejected.
- User-level toggle: rejected.
- Android-only toggle: rejected.

### Risks
- stale cached config can cause access after disablement if expiry is ignored
- reduced resilience if the admin check-in is delayed

### Testing implications
- route tests for disabled Stay
- service-layer tests for module access denial
- cross-business access tests
- config expiry tests

## Decision 2: Stay uses a room allocation lock before final reservation confirmation

### Decision
A reservation is not final until the system performs room availability validation and acquires a valid room allocation lock or reservation token for the business date range.

### Reason
The repo has no built-in automatic room-lock guarantee. Without a lock, multiple devices can allocate the same room simultaneously and create double booking.

### Alternatives considered
- last-write-wins booking: rejected.
- offline booking accepted as final immediately: rejected.
- no lock and no provisional state: rejected.

### Risks
- temporary lock contention during high concurrency
- provisional holds that later fail validation

### Testing implications
- test overlapping room allocation attempts
- test provisional hold to confirmed booking flow
- test room-blocked state during maintenance or cleaning

## Decision 3: The folio ledger is the authoritative source of financial truth

### Decision
Stay financial truth is the folio plus `folio_entries`, `stay_payments`, `payment_allocations`, `refunds`, `invoices`, and `credit_memos` rather than invoice totals alone.

### Reason
Invoice totals are summaries; room charges, payment allocations, taxes, adjustments and refunds must be recorded as discrete ledger entries to support correction, audit and re-open logic.

### Alternatives considered
- invoice totals as source of truth: rejected.
- payment summary only: rejected.
- restaurant sales table as lodging ledger: rejected.

### Risks
- duplicate ledgers if payments and charges are not idempotent
- delayed corrections if allocation logic is not explicit

### Testing implications
- folio balance arithmetic tests
- split-payment allocation tests
- refund and reversal tests
- audit correction tests

## Decision 4: Monetary values use integer paise and all financial writes are idempotent

### Decision
Every financial operation uses integer paise and must carry a stable idempotency key or equivalent dedupe signature.

### Reason
This is required to prevent duplicated payment submission, duplication of refund processing, and financial drift when the same operation is retried due to network failure or device restart.

### Alternatives considered
- using floats or decimals directly in app state: rejected.
- allowing duplicate payments without idempotency checks: rejected.

### Risks
- inconsistent keys if client app does not preserve request IDs
- retry storms after network reconnection

### Testing implications
- same payment retried twice returns same logical record
- duplicate refund request rejected
- duplicate invoice number rejected

## Decision 5: The stay lifecycle must include explicit state transitions and event history

### Decision
The system distinguishes room category reservation, specific room assignment, room hold, confirmed booking, check-in, occupancy, room move, checkout, cleaning, maintenance blocking, and audit closure. These states are recorded as lifecycle transitions and event history.

### Reason
A room or stay can move through many operational states and those transitions must be auditable without overwriting earlier history.

### Alternatives considered
- single status field only: rejected.
- use only `check_in` / `check_out` tables: rejected.

### Risks
- event log bloat if every tiny state change is persisted without filtering
- overlooked room move or state transitions if event semantics are weak

### Testing implications
- room move transitions preserve old and new state
- checkout and cleaning states are consistent with occupancy
- maintenance block prevents new booking or check-in

## Decision 6: Night audit is a serial business-day close, not a silent summary update

### Decision
Each business date has exactly one active audit session and only one final close. Completed financial transactions are never silently overwritten.

### Reason
The repo does not show a robust daily reconciliation model, and lodging financial integrity needs serial closure and audit history to avoid duplicate closing or cash variance hiding.

### Alternatives considered
- allow multiple concurrent close sessions: rejected.
- silently mutate closed records: rejected.
- allow online-only close without provisional offline capture: rejected.

### Risks
- delayed daily close while offline or before all transactions settle
- manual exception handling if a late transaction arrives after cutoff

### Testing implications
- verify single active audit session per day
- verify late-arriving transactions are flagged, not silently merged
- verify variance reconciliation stays separate from folio entries

## Decision 7: Offline operation is classified into safe, provisional and online-only categories

### Decision
The system classifies actions into safe offline, provisional offline, and online-only final confirmation categories. No final financial or occupancy action is allowed to become authoritative without validation.

### Reason
This is required for a local-first app and reflects the real offline constraints of room allocation, payment posting and audit close.

### Alternatives considered
- all offline actions finalize immediately: rejected.
- all actions require online validation: rejected because it blocks local drafting and temporary room holds.

### Risks
- provisional actions may later be revoked
- user confusion if local drafts are not clearly marked

### Testing implications
- draft booking remains pending until validated
- offline payment remains pending until final post succeeds
- offline audit close remains provisional until revalidated

## Decision 8: Security is layered and honest about local-first limitations

### Decision
The app must use UI guards, application service checks, activity logging and central policy enforcement, but it must not claim that local DB or frontend guards protect against a user controlling their own device.

### Reason
Electron + IndexedDB is local-first by design; local checks are useful but not a security boundary against a technically capable user.

### Alternatives considered
- claiming frontend guard = security: rejected.
- claiming local IndexedDB protection = security: rejected.

### Risks
- data exposure if users bypass app-level logic manually
- false confidence in protection if policy is not described honestly

### Testing implications
- route and direct access tests
- service denial tests
- business mismatch tests
- stale admin config expiration tests

## Decision 9: Desktop and Android share one Stay config contract

### Decision
Android and desktop consume the same business-scoped Stay activation contract and share the same semantics for room state, payment state and folio accountability.

### Reason
This avoids drift between clients and preserves the same reservation, payment and audit semantics on both platforms.

### Alternatives considered
- separate Android config: rejected.
- separate Android database: rejected.

### Risks
- contract drift if fields are changed separately
- state divergence during outages

### Testing implications
- identical config versioning for both clients
- same rejection behavior on module disable or config expiry
- same detection of duplicate financial operations

## Decision 10: Existing Restaurant functionality remains unchanged while Stay is integrated as a sub-module

### Decision
Stay is integrated as a dependency-managed sub-module under the restaurant vertical without altering Restaurant structure or existing commerce flows.

### Reason
The repo already shows Restaurant as an existing vertical and the requirements explicitly preserve it.

### Alternatives considered
- restructuring Restaurant or replacing it: rejected.
- creating a parallel app-level module: rejected.

### Risks
- if route or data boundaries are not enforced, Stay feature code may accidentally leak into Restaurant
- unclear module ownership if business rules are mixed

### Testing implications
- ensure Restaurant flows remain unaffected when Stay is disabled
- ensure routed module access remains isolated
- keep Restaurant sales and Stay ledger domains separate

## Remaining unresolved decisions

- whether the configuration contract is carried through the existing desktop admin control pipeline or by a separate shared cloud contract object
- whether Android receives the config from the same cloud business object or from the same Firebase contract path
- whether the permission model is role-based, user-based, or both
- whether the first implementation uses a single centralized reservation lock or a simpler optimistic concurrency pattern with a serialized reconciler
- whether night audit finalization is fully offline-capable or restricted to online validation
