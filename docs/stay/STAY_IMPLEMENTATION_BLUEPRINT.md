# STAY_IMPLEMENTATION_BLUEPRINT.md

## Purpose

This is the implementation blueprint for Stay as a sub-module under the existing Restaurant vertical. It is deliberately design-only and does not start development.

## Verified repo facts

- The app is a desktop-first Electron + Next.js + TypeScript + Dexie architecture.
- Restaurant is already a vertical under the same app shell.
- The business/vertical profile is stored in `src/lib/business/verticalProfile.ts`.
- Feature toggles and route guards are implemented in `src/lib/features/featureSwitches.ts` and `src/components/features/FeatureGate.tsx`.
- Admin remote control exists in `src/lib/admin/adminControl.ts`, `src/components/admin/AdminControlHost.tsx`, and `adminLink.js`.
- There is no Stay implementation and no Stay database schema yet.

## Summary of the architecture decision

Stay should be designed as:
- a child module under the existing Restaurant / business vertical shell
- a feature-guarded module with explicit business access checks
- a local-first data model using Dexie and the existing `business_id` tenant pattern
- a separate financial domain from restaurant sales
- a sync-safe model with idempotency and room-availability lock checks

## Phase plan

### Phase 0: Product and policy approval

Outputs required before code work:
- admin toggle design confirmed
- business scope confirmed
- role/permission model confirmed
- financial ledger boundaries confirmed
- offline behavior finalised

This is the current stage.

### Phase 1: Admin toggle contract and guard model

Implementation tasks:
- define `stay_enabled` / `stay_module_state` in the admin remote-control contract
- persist the state locally using the same pattern as `admin_control.json`
- apply the state to module routes and app services
- enforce route and data-access refusal when disabled

Required files in the app to align with existing code:
- `src/lib/admin/adminControl.ts`
- `src/lib/features/featureSwitches.ts`
- `src/components/features/FeatureGate.tsx`
- `src/components/layout/AppShell.tsx`

### Phase 2: Stay data foundation

Implementation tasks:
- add core Stay tables in Dexie only when approved
- add `business_id` relationships and safety indexes
- define `stays`, `bookings`, `rooms`, `room_types`, `rates`, `folios`, `folio_entries`, and `night_audit_sessions`
- ensure separate business domain from restaurant sales

This should happen only after the schema design is approved.

### Phase 3: Business operations and stay workflows

Implementation tasks:
- room availability logic
- reservation workflow
- check-in flow
- checkout flow
- occupancy state and room-change operations
- housekeeping and maintenance task flows

### Phase 4: Folio and payment operations

Implementation tasks:
- folio creation
- room charge posting
- payment allocation
- split payment support
- refund flow
- invoice generation
- invoice correction and credit memo flow

### Phase 5: Audit and reconciliation

Implementation tasks:
- business-day close
- night audit session
- cash reconciliation
- variance handling
- final reconciliation summary

### Phase 6: Sync and conflict handling

Implementation tasks:
- local outbox for Stay records
- reservation locking model
- idempotency keys for payments
- sync retries and reconciliation
- offline-safe provisional states

### Phase 7: Android compatibility and shared contract

Implementation tasks:
- align field names and IDs with the shared business logic
- verify the admin config contract is shared
- ensure Android uses the same state model

### Phase 8: Hardening and testing

Implementation tasks:
- negative tests for duplicate payment submission
- room double-booking tests
- disconnect and offline recovery tests
- audit reconciliation tests
- admin disable while offline tests

## Guardrail rules

1. Never mix Stay ledger records with restaurant sales records.
2. Never treat route hiding as a security boundary.
3. Never assume Android code exists in this repo; define the shared contract explicitly.
4. Never create a second independent Stay activation system.
5. Do not allow a disabled module to keep writing data after the disable flag is in effect.

## Key architecture decisions still unresolved

These are the decisions that need explicit approval before first code work:
- whether the admin toggle is strictly device-scoped or business-scoped
- whether the module state is a single boolean or a small state machine
- whether Android will consume the same cloud-borne admin config contract or a separate business config sync
- whether all night audit events will be finalized online only or can be drafted offline
- whether multi-device reservation control is enforced by a central service or by business-level serialized sync rules

## Recommendation

Proceed only after the design documents are approved and the first development phase is explicitly authorized. The implementation blueprint is intentionally narrow and safe, and it respects the repo’s current patterns without disturbing the existing Restaurant functionality.

## Finalized implementation guardrails (2026-11-16)

### Decision
The first implementation must follow these guardrails:
1. Stay remains a child module under Restaurant.
2. Stay activation is business-scoped and centrally controlled.
3. A room allocation lock is required before final confirmation.
4. Financial truth is the folio ledger and ledger entries, not invoice totals.
5. Offline actions remain provisional unless they are safe to complete locally.
6. Payment, refund, invoice, and audit closes require authoritative validation.

### Reason
These are the minimum rules needed to prevent double booking, duplicate payment posting, faulty room occupancy and unsafe audit closure while still supporting offline-first operation.

### Alternatives considered
- No room lock: rejected.
- No separate folio ledger: rejected.
- Immediate finalization of offline payment: rejected.
- UI-only disabled module: rejected.

### Risks
- delay in system confirmation for certain operations while offline
- more complex idempotency and retry logic
- need for centralized policy sync at the admin layer

### Testing implications
- verify offline drafts never finalize without validation
- verify room allocation conflict detection
- verify payment idempotency and ledger audit entry counts
- verify admin disable blocks new Stay operations while preserving old records

## Unresolved decisions requiring sign-off

- Stay route permission model
- default business scope for the toggle
- financial domain partitioning rules
- availability lock semantics
- offline confirmation policy for payment and booking actions
