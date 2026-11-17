# 09. Testing Strategy

## Objective

Protect the current restaurant and retail app while validating the new Stay vertical. The testing strategy must follow the same principle as the repo’s engineering rules: prove no regression before moving into a release stage.

## 9.1 Regression testing for existing business flows

The first gate is regression coverage for the current application.

### Must-test flows

- billing and payment flow
- sales return flow
- customer ledger and khata flow
- inventory and stock movement flow
- product add/edit and catalog change flow
- GST and tax calculation flow
- invoice generation and print flow
- WhatsApp and report flows
- restaurant order flow and KOT flow

### Evidence in repo

- `scripts/e2e_simulation.ts`
- `ENGINEERING_BIBLE.md` mentions active financial and hardware tests
- `docs/VERTICAL_PLAN.md` records audit and vertical-specific fixes

## 9.2 Stay module functional testing

The Stay module should be tested in the following business flows:

- room master management
- room type and rate configuration
- booking creation and validation
- room availability checks
- check-in and check-out
- guest charge and payment settlement
- occupancy report views
- deposit and balance handling
- room service and housekeeping flows

## 9.3 Integration testing

Validate integrations across:

- app shell and route guards
- vertical profile loading
- feature switch resolution
- business config fetch
- cloud sync and data mapping
- print / report generation
- admin toggle synchronization

## 9.4 API / cloud contract testing

Although this repo does not contain a server API layer, the cloud boundary still needs validation.

Test cases:

- stay modules remain disabled when the toggle is off
- write requests blocked for disabled Stay collections
- `business_id` and `vertical` still resolve correctly
- amount values remain integer paise
- null and missing fields do not wipe data
- data merges do not clobber retail records

## 9.5 Database testing

The database strategy should be validated with:

- new database table creation
- correct indexing for room and booking queries
- delete and restore behavior
- multi-business isolation checks
- backup and restore compatibility
- schema version upgrades

## 9.6 Role and permission testing

Test all user roles and access states:

- owner/admin can enable or disable Stay
- staff sees or does not see Stay screens as allowed
- non-owners cannot alter room master or booking settings
- route direct hits fail when Stay is disabled
- hidden module actions are blocked even when manually invoked

## 9.7 Admin toggle testing

This is the highest-risk behavior and deserves dedicated tests.

Scenarios:

- enable Stay while app is closed
- disable Stay while app is open
- toggle during active booking session
- toggle while staff is modifying a room or bill
- route access after a config refresh
- stale cached state after server config arrives late

## 9.8 Subscription and licence testing

The repo’s licence system is central. If Stay introduces a product gating concept, it must be tested against:

- offline licence verification
- admin remote control changes
- licence expiry and blocked states
- no effect on current restaurant retail flow

## 9.9 Android and Desktop parity testing

If a later mobile client shares config and cloud data, validation should ensure:

- same vertical profile semantics
- same admin toggle behavior
- same money fields and data contract semantics
- same room and booking record states

## 9.10 Security testing

This feature should be reviewed for:

- direct URL access bypass
- unauthorized data reading
- stale local cache exploitation
- tampered config values
- data leakage between verticals
- disabled-module access attempts

## 9.11 Performance testing

Validate:

- room availability queries at scale
- daily occupancy report performance
- backup/restore of a Stay-enabled business
- search on room, guest, booking status, and date ranges

## 9.12 Offline and network interruption testing

The product is offline-first; Stay must be tested for:

- writing room / booking changes with no connection
- local queue reconciliation after reconnect
- conflict handling with overlapping bookings or stale data

## 9.13 Data migration testing

Before production rollout:

- validate add-on table creation
- validate no retail records are altered
- verify backup/restore compatibility
- confirm a opted-in shop migrates correctly without affecting others

## 9.14 UAT / alpha / beta / smoke plan

### UAT

- verify room and booking flows against real hotel/lodge operations
- check guest ledger and payment settlement expectations
- confirm admin toggle behavior under owner control

### Alpha

- internal team validates the Stay module with realistic test data
- verify regression in retail and restaurant mode

### Beta

- small pilot stores with Stay enabled
- run daily occupancy and billing checks
- monitor log errors and sync conflicts

### Production smoke

- start app with Stay disabled
- enable Stay through admin config
- open room module
- create and settle a booking
- disable Stay again and verify route/data block

## Conclusion

The testing strategy for Stay should follow the same standard as the existing app: protect the retail and restaurant platform first, then validate the new vertical in controlled, feature-gated, and auditable steps.
