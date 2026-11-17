# Development Roadmap

## Phase 0 — Discovery and architecture validation
Status: Desktop-only discovery documented; cross-repository T0 remains blocked.

Tasks completed:
- inspect repo structure
- identify app architecture
- map restaurant and vertical patterns
- identify existing admin feature controls
- document a proposed Stay fit without breaking current functionality

The items above describe Desktop discovery and planning only. They do not complete T0's required Android/Admin/backend identity, authorization, rules, and staging verification.

## Phase 1 — Stay foundation
Scope:
- central admin toggle
- route and module gating
- tenant / property access
- navigation registration
- English and Marathi localization support initially; Hindi is a later target
- property setup shell

## Phase 2 — Core hospitality operations
Scope:
- room management
- guest management
- booking and reservation flow
- check-in and check-out
- stay folio
- payments and split payments

## Phase 3 — Financial and operational controls
Scope:
- invoice and GST flow
- rate plan logic
- room moves and transfers
- night audit and closing rules
- discounts and refunds

## Phase 4 — Daily operations
Scope:
- housekeeping tasks
- laundry / minibar
- maintenance management
- lost and found
- walk-in queue
- guest feedback flows

## Phase 5 — Management and analytics
Scope:
- owner dashboard
- occupancy and RevPAR reports
- expense tracking
- guest and business summaries

## Phase 6 — Reliability and security
Scope:
- offline-mode design
- queue sync and retry-safe actions
- permissions and audit trails
- performance checks
- security validation

## Phase 7 — AI and future readiness
Scope:
- Marathi assistant
- voice input
- structured summaries
- future OTA / payment / channel integrations

## Critical gating rule
No code-level implementation should begin until the Stay architecture is approved and the admin toggle / data isolation model is agreed.

## Recommended delivery order
1. architecture approval
2. admin toggle model approval
3. data model foundation
4. room / booking core
5. checkout and payment flow
6. night audit and financial integrity
7. daily operational modules
8. analytics and owner dashboard
9. security and reliability hardening
10. release validation

## Current gate and evidence status — 2026-11-16

- **Verified:** only the KamaiPlus Desktop repository is available in this workspace. Desktop generic per-device Admin control exists, but no business-scoped Stay configuration or authorization lease exists.
- **Blocked:** Android, Admin Console, Cloud Functions, Firestore rules, cross-platform canonical business identity, current staff-session enforcement, staging access, and deployment ownership require external source/access.
- **Approved product direction:** Stay is to remain a module within the existing Kamai Plus applications, not a standalone application; Restaurant behavior must remain stable.
- **Proposed, not approved:** the detailed T0–T7 execution sequence and config/lease design in the Stay planning documents.
- **No implementation:** Stay routes, permissions, schemas, migrations, room/booking/financial work remain unstarted. Do not proceed to Phase 1 source changes until the blockers and owner approvals in `OPEN_DECISIONS_AND_BLOCKERS.md` are resolved.

The phase descriptions above remain a product roadmap, not a claim that those features or acceptance gates are implemented.
