# 10. Implementation Roadmap

## Phase 0 — Product confirmation and scope freeze

Objective: decide if Stay is a business vertical inside the same app or a separate app.

Recommended decision: Keep the shared app and add a Stay vertical.

Deliverables:

- approved vertical definition
- approved room/booking scope
- approved admin toggle ownership
- approved data model constraints

Exit criteria:

- all stakeholders agree Stay is a vertical under the same app
- no ambiguity in room and billing model

## Phase 1 — Schema and config foundation

Objective: define Stay data and administrative gating.

Work:

- add `stay_enabled` / `vertical` metadata
- add room and booking tables
- add admin config model
- add route guard and module registration

Dependencies:

- architecture decision on vertical scoping
- stable definition of business ID and permission model

Estimated complexity: Medium

## Phase 2 — Core Stay business models

Objective: model the actual business domain.

Work:

- room master data
- room types and rates
- booking lifecycle
- room status and occupancy rules
- guest / customer links
- payment and stay ledger skeleton

Dependencies:

- Phase 1 complete

Estimated complexity: High

## Phase 3 — Stay UX and workflows

Objective: build the user-facing module.

Work:

- room list view
- booking form
- check-in / check-out flow
- room service and housekeeping flow
- billing and payment screens
- reports and summary pages

Dependencies:

- Phase 2 complete

Estimated complexity: High

## Phase 4 — Reporting and analytics

Objective: add operational visibility for Stay.

Work:

- occupancy report
- room revenue summary
- check-in / check-out timing report
- unpaid dues report
- stay ledger report

Dependencies:

- Phase 3 complete

Estimated complexity: Medium

## Phase 5 — Cloud sync and compatibility

Objective: extend the cloud contract without breaking current retail and restaurant flows.

Work:

- add Stay collections and model mapping
- add schema-version handling
- validate merge logic
- validate offline queue semantics

Dependencies:

- Phase 2 and 3 complete

Estimated complexity: Medium to High

## Phase 6 — Hardening, testing, and release gates

Objective: verify there is no regression and that Stay behaves safely.

Work:

- regression tests for retail and restaurant
- stay feature tests
- admin toggle tests
- performance tests
- UAT and pilot testing

Exit criteria:

- all regression tests pass
- Stay toggle tested in enabled and disabled states
- no data leakage or route bypass

Estimated complexity: Medium

## Dependency order

1. approve architecture
2. add config and schema foundation
3. create Stay domain entities
4. build Stay UX flows
5. add analytics and reporting
6. add cloud contract and sync support
7. run regression and pilot validation

## Recommended release gates

- no route or data access without the admin toggle check
- no new field in retail tables without backward-safe handling
- no direct cross-vertical writes
- no production release without retention / backup validation
- no conversion of the app to a second product without release sign-off

## Conclusion

The recommended sequence is conservative: establish the admin and schema foundation first, then build the Stay domain, then validate the integration. This keeps the current retail and restaurant app stable while adding the new hospitality vertical.
