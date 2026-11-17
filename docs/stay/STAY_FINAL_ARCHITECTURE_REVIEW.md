# Kamai Plus Stay — Final Architecture Review

**Status:** Consolidated design review; no implementation or schema work performed  
**Review date:** 2026-11-16  
**Purpose:** Bring the Stay discovery, design, and architecture-decision documents into one reviewable reference. This document distinguishes repository facts from proposed design and unresolved decisions.

## Evidence labels

- **Verified repository fact** — documented as present in this Desktop repository or its implementation references.
- **Approved direction** — a product/architecture direction recorded in the latest Stay decisions and user instructions; it is not necessarily implemented.
- **Proposal** — a recommended design that still needs implementation and, where noted, approval.
- **Unresolved** — conflicting or incomplete requirements that must not be treated as settled.

This is a documentation consolidation, not an implementation approval. No source code, Dexie schema, or migration was modified or executed.

---

## 1. Product vision, target customers and usability goals

### Product vision

Kamai Plus Stay is intended to help a small lodge owner and staff operate rooms, bookings, check-ins, guest accounts, payments, checkout, and daily reconciliation within the Kamai Plus product family. The intended user includes a lodge owner in rural Maharashtra who may not have an accountant or technical expert available during daily operations.

**Approved direction:** Keep this as an addition to the existing Kamai Plus Desktop application, under the Restaurant vertical/module boundary, rather than building an independent Stay application or database.

### Target user and operating context

- Small lodge / hotel owner or manager.
- Front-desk and operational staff with differing permissions.
- Desktop use with intermittent or unavailable network connectivity.
- Potential future Android use sharing the same business, data, and activation semantics.
- Users who need straightforward guided workflows rather than requiring accounting or IT expertise.

### Usability goals

**Proposal, derived from the product goal:**

- Make everyday workflows understandable to non-technical staff.
- Make booking, room assignment, check-in, checkout, and payment states visibly distinct.
- Clearly mark provisional/offline work so it cannot be mistaken for a confirmed booking, posted payment, or closed audit.
- Present errors and conflicts in actionable language; do not silently discard or auto-confirm operations.
- Preserve access to existing records when the module is disabled.
- Keep core operations low-cost and avoid requiring paid third-party services.
- Provide Marathi and English language support, with Hindi planned for a future phase (see §13). Translation coverage and release criteria remain to be defined.

### Product scope and boundaries

Stay concerns accommodation operations: rooms, room types, guests, bookings, occupancy, rates, folios, guest charges, payments, invoices, refunds, audit, housekeeping, maintenance, and related reports.

Restaurant remains responsible for its existing tables, menus, orders, KOT, and restaurant settlement flows. Stay financial records must not be recorded as Restaurant sales. A future link from a restaurant order to a guest folio would require explicit mapping and must preserve separate source records.

---

## 2. Product scope and feature prioritization

The latest proposed delivery order is staged; it avoids introducing all proposed entities and workflows at once:

1. Admin Stay toggle and shared configuration contract.
2. Dexie database foundation and safe, forward-compatible migration.
3. Rooms, room types, and room availability.
4. Guest registration and bookings.
5. Check-in, checkout, and room moves.
6. Guest folio, billing, and payments.
7. Night audit and reconciliation.
8. Housekeeping, maintenance, and reports.
9. Offline synchronization and Android integration.

The initial release boundary is not fully approved. Earlier roadmap drafts put the schema and toggle together, and some put sync/hardening earlier. The latest staged order above should be treated as the current proposal, but dependencies must be revisited before implementation: a multi-device reservation lock and shared service contract may be prerequisites for final booking confirmation, not merely late “integration” work.

### Low-cost approach

**Verified/recommended in prior design documents:**

- Reuse the current app shell, Electron bridge, Dexie, feature gating, Firebase/cloud contract, backup, printing, and reporting infrastructure where their semantics fit.
- Add Stay-specific business logic and data models only where required.
- Do not add a paid NLP service, external AI service, paid WhatsApp API, OTA/channel manager, payment gateway, or new hosting/service dependency without separate business approval.
- A rule-based local assistant is a possible future enhancement, not a Phase 1 dependency.

The current documents do not establish concrete hosting prices, service-level commitments, or vendor costs. No new service should be assumed free merely because Firebase is already a dependency.

---

## 3. Overall technical architecture and existing technology stack

### Verified repository facts

The workspace is the Desktop application, not a monorepo containing the Android client or a dedicated Stay backend. The existing architecture is described as:

- Next.js App Router, React, TypeScript, and Tailwind.
- Electron desktop shell with a narrow preload/IPC bridge.
- Dexie over IndexedDB as the local transactional store.
- Optional Firebase authentication/cloud services and a defined cloud data contract.
- Local-first application behavior; cloud synchronization is not the primary local transaction store.
- Versioned Dexie schema declarations and local backup/restore infrastructure.
- Existing restaurant route and module within the shared application shell.

The repository references supporting these facts include `src/lib/db/index.ts`, `src/lib/cloud/cloudContract.ts`, `src/lib/business/verticalProfile.ts`, `src/lib/features/featureSwitches.ts`, `src/components/features/FeatureGate.tsx`, `src/components/admin/AdminControlHost.tsx`, `adminLink.js`, `main.js`, and `preload.js`.

### Architecture fit

The shared shell and local-first store are reusable platform foundations. They do not themselves provide:

- a Stay domain model,
- a central atomic booking/room allocation service,
- a tenant-level Stay activation contract shared across clients,
- a complete Stay role/permission model,
- a cloud-enforced security boundary for local Desktop data, or
- a lodging ledger and night-audit process.

Those capabilities are proposals requiring implementation and, in some cases, platform work outside this repository.

---

## 4. Restaurant and Stay module separation

### Approved direction

Stay is an optional child module under the existing Restaurant vertical. Existing Restaurant behavior and structure must remain unchanged.

### Separation rules

- Keep Restaurant routes, data, and flows working when Stay is disabled.
- Give Stay its own route namespace, operational services, records, and business rules.
- Use the existing `business_id` tenant identity, but scope every Stay record and query to the active business.
- Keep Stay financial records in a distinct financial domain; do not put lodging charges or payments into Restaurant sales.
- Do not turn the existing Restaurant profile into an assumption that all restaurant businesses are lodging properties.
- Do not create a separate independent Stay database or a second Android activation system.

### Existing route and feature precedent

**Verified:** The application uses a `FeatureGate` in the shared shell and has a `/restaurant` route that can be blocked based on Restaurant mode. This is a UI/route precedent, not proof that local DB calls are protected or that a Stay module exists.

**Proposal:** Stay navigation, direct route entry, and service operations all check the central business-scoped activation state. A route hide alone is insufficient.

---

## 5. Central Admin toggle architecture for Desktop and Android

### Verified current capability

The Desktop has a real Admin remote-control path:

- Electron exposes `getAdminControl()` and change notifications through the desktop bridge.
- `adminLink.js` cleans and persists the last control payload in `admin_control.json`.
- `AdminControlHost` applies feature overrides to local storage.
- Feature switches and Restaurant mode are read by the UI and affect routes/features.
- The stored control is available offline.

This existing mechanism is primarily a per-PC control payload, and the existing feature system is primarily UI/feature gating. It is **not** already a complete business-scoped Stay entitlement or a server-enforced Stay data-access policy. The Admin Console/backend implementation is not present in this Desktop repository.

### Approved direction and shared contract proposal

Stay activation is centrally controlled by Kamai Plus Admin and is **business-scoped**. It is independent of the employee permission decision. Desktop and Android must consume the same contract; Android must not maintain an independent Stay toggle.

Proposed minimum configuration:

```json
{
  "business_id": "business identifier",
  "module": "stay",
  "enabled": true,
  "state": "enabled",
  "version": 1,
  "updated_at": "ISO-8601 timestamp",
  "updated_by": "admin identifier or null",
  "source": "admin_console",
  "expires_at": "ISO-8601 timestamp or null",
  "cache_ttl_seconds": 0
}
```

`enabled`/`state` semantics, contract location, expiry value, and TTL value still require a single canonical contract definition. The names above consolidate fields from existing proposals; they are not implemented schema.

### Behavior

- **Enabled:** Module activation permits eligible users to attempt access, subject to their own permissions and business scope.
- **Disabled:** Block new Stay operations and access paths; preserve existing Stay data. Do not delete or transform records.
- **Re-enabled:** Restore access to retained data after valid configuration is loaded and ordinary permission checks pass.
- **Maintenance state:** The earlier contract draft included `maintenance`; whether this is distinct from disabled and what it permits is unresolved.
- **Employee permissions:** A separate authorization check determines which roles/users can view rooms, manage bookings, check in/out, post payments/refunds, close audits, or manage housekeeping. Central activation does not grant these permissions.

### Cache expiry and propagation

**Proposal:** Clients may use only the last valid cached config until its expiry. Once expired, fail closed for Stay operations until a fresh valid config is obtained. A disable event should invalidate active Stay UI/service state and block new actions. A config version supports ordering/staleness checks.

**Unresolved:** No specific TTL, maximum offline grace period, polling/check-in cadence, push mechanism, or propagation SLA has been finalized. “Next sync/check-in cycle” is not a quantified guarantee. Business policy must determine whether read-only access to historical Stay records remains available after expiry or whether all access is blocked.

### Offline behavior

With a valid, non-expired cache, clients follow the last known state; a device offline cannot learn a new central disable until it reconnects. After expiry, fail closed for new Stay activity. This is a practical policy, not immediate revocation while offline.

---

## 6. Security, roles, permissions and business-level isolation

### Layers

1. **UI access control:** hide navigation/actions and block direct routes for usability.
2. **Application service checks:** validate module activation, user/role permission, active `business_id`, record ownership, and workflow status on every operation.
3. **Cloud-side policy enforcement:** authoritative enforcement for operations that pass through a service/cloud boundary, if implemented.
4. **Local data store:** Dexie queries and service checks provide application consistency, not a security boundary against a user controlling the device.

### Suggested permissions (not yet approved as a role matrix)

- `stay.view`
- `stay.bookings.manage`
- `stay.checkin.manage`
- `stay.checkout.manage`
- `stay.payments.manage`
- `stay.refunds.manage`
- `stay.audit.manage`
- `stay.housekeeping.manage`
- `stay.maintenance.manage`

The final role-to-permission matrix and who can enable/disable Stay remain unresolved. Admin module activation must not be conflated with employee permissions.

### Business isolation

Each Stay record should include or be unambiguously associated with `business_id`. Queries and mutations must validate that the active business matches the record's business. Cross-business ID guessing, stale references, imports, and backup restore must not bypass that check.

### Honest security limitation

This is a local-first Electron app with local IndexedDB data. A technically capable user who controls the machine can inspect or alter local data and bypass frontend/application checks. Local guards are valuable for normal operation and error prevention but cannot guarantee confidentiality or integrity against the device owner. Central policy can enforce operations that require the service, but it cannot retroactively protect offline local data already present on a device.

---

## 7. Database architecture and proposed Stay entities

### Existing database

**Verified:** The existing Dexie database is retail-oriented and includes businesses, products, customers, sales, ledger transactions, cash registers/expenses, audit logs, purchases, and related tables. No Stay tables or schema migration are present in the design materials' repository assessment.

No schema changes are part of this review.

### Proposed relationship model

```text
businesses
  ├─ room_types ─ rooms
  ├─ guests
  ├─ payers
  ├─ bookings ─ booking_guests ─ guests
  │      └─ stays ─ stay_guests ─ guests
  │           ├─ folios ─ folio_entries
  │           │             └─ payment_allocations ─ stay_payments
  │           ├─ invoices ─ invoice_lines
  │           ├─ refunds / credit_memos
  │           ├─ stay_events / occupancy history
  │           └─ housekeeping / maintenance / lost-and-found
  └─ business_days ─ night_audit_sessions ─ night_audit_reconciliations
```

This is the consolidated conceptual model, not an approved physical Dexie table list. Every entity would need primary key, business scope, timestamps, audit actor, status, indexes, and migration/back-up compatibility as appropriate.

### Entity inventory and purpose

| Entity | Purpose | Design status |
|---|---|---|
| `room_types` | Categories, capacity, and defaults for rooms | Proposed core |
| `rooms` | Physical room identity, type, and operational status | Proposed core |
| `room_tariffs` | Rate definitions and effective windows | Proposed; rate model incomplete |
| `guests` | Guest identity/profile independent of a single booking | Proposed |
| `bookings` | Reservation request/status and stay dates | Proposed core |
| `booking_guests` | Booking-to-guest many-to-many relation | Proposed |
| `booking_modification_history` | Append-only record of booking changes | Proposed |
| `stays` | Operational occupancy lifecycle | Proposed core |
| `stay_guests` | Stay-to-guest relation | Proposed |
| `stay_events` / `room_occupancy_events` | Lifecycle/room transitions, including check-in/out and room moves | Prefer one event stream; exact name/scope unresolved |
| `rate_plan_history` | Preserve rate changes applied to a stay | Proposed; snapshot design incomplete |
| `folios` | Account/ledger boundary for a booking or stay | Proposed core |
| `folio_entries` | Chronological charges, taxes, payment postings, refunds, adjustments | Proposed financial source of truth |
| `stay_payments` | Tender, payer, reference, status, idempotency | Proposed |
| `payment_allocations` | Allocate a payment amount to folio charges/balance | Proposed |
| `payers` / `payer_links` | Represent guest, company, travel agent, or third-party payer | Proposed; link granularity unresolved |
| `invoices` / `invoice_lines` | Issued invoice snapshots and line detail | Proposed |
| `tax_calculations` | Tax basis/rate/amount and jurisdiction snapshots | Proposed; legal/tax policy unresolved |
| `refunds` | Refund lifecycle tied to original payment | Proposed |
| `credit_memos` | Immutable correction/credit documentation | Proposed |
| `business_days` | Business-local day boundary and open/closed state | Proposed; timezone/start/cutoff unresolved |
| `night_audit_sessions` | One audit run for a business date | Proposed |
| `night_audit_reconciliations` | Per-folio/payment/cash comparison and variance | Proposed |
| `housekeeping_tasks` | Cleaning/inspection work queue | Proposed operational phase |
| `maintenance_requests` | Room maintenance and availability blocking | Proposed operational phase |
| `lost_and_found` | Property/item tracking tied optionally to a stay/guest | Proposed operational phase |

### Proposed entities not required as separate tables without further need

- Separate `check_ins` and `check_outs`: generally redundant if `stays` hold timestamps and `stay_events` records transitions.
- Separate `occupancy_history`, `room_status_history`, and `stay_events`: may duplicate one another. Prefer one event/history design unless a distinct query or retention need is demonstrated.
- `guest_profiles`: optional; do not split from `guests` without privacy/access or lifecycle justification.
- `folio_accounts`: optional for master accounts or multiple independently settled folios; not required for a basic single-folio stay.
- `room_service_orders`: earlier proposed; scope and ownership unclear. If Restaurant order is linked, preserve its original record and use an explicit cross-domain reference rather than duplicating a sale.
- `stay_charges`: earlier proposal; its role overlaps `folio_entries`. Prefer a charge-specific detail/descriptor linked to a ledger entry only if needed; avoid two authoritative charge records.

### Indexes and integrity constraints proposed

Useful business-scoped indexes include business + status/date, room/date/status, business + guest, booking number, invoice/payment/refund number, and folio + posting time. Proposed uniqueness rules include room number per business, unique business-scoped booking/stay/document numbers, idempotency key per operation, and no overlapping confirmed room allocation or active occupancy.

Dexie/IndexedDB does not provide relational foreign-key enforcement or a cross-device unique constraint. Referential integrity and concurrency need application/service validation; local indexes alone cannot prove global uniqueness.

### Financial duplication warning

The documents currently suggest both `folio_entries` and reusing `ledger_transactions`. They also make `stay_payments` and payment-kind folio entries. Before schema implementation, define exactly which is the one authoritative posting:

- `stay_payments` should identify the received tender and its idempotency key.
- A single folio ledger posting should reflect the payment/credit effect.
- `payment_allocations` should allocate that posting; it must not create another accounting charge/payment.
- `ledger_transactions` must either be the same canonical ledger representation (with Stay domain tags) or not be written for the same event. Do not post the same economic event in both ledgers.

This mapping is a critical modeling gap, despite the direction that folio entries are financial truth.

---

## 8. Room, booking, guest and occupancy workflows

### Distinct concepts and states

1. **Room-category reservation:** A request reserves capacity for a room type/category without selecting a physical room.
2. **Specific room assignment:** A physical room is associated with a confirmed booking or stay; the system must check maintenance and availability.
3. **Temporary hold:** A time-limited, provisional allocation used while confirmation is pending. Expiration and release behavior still need specification.
4. **Confirmed booking:** A reservation accepted only after authoritative availability validation and atomic allocation.
5. **Check-in:** The stay begins; room occupancy becomes active after validation.
6. **Occupancy:** Current room-to-stay assignment, with date/time interval.
7. **Room move:** Close the prior room assignment and create the new assignment as an auditable event; recalculate any affected charges under approved rules.
8. **Checkout:** Ends occupancy and initiates final folio/invoice/settlement workflow.
9. **Cleaning:** Post-checkout or service status; the room may remain unavailable until cleaned/inspected.
10. **Maintenance block:** Makes a room unavailable for booking/assignment for a defined period or until clearance.

### Atomic confirmation and race handling

**Approved design requirement:** Do not rely on Firebase document replication to prevent two devices from booking the same room.

Final room assignment must be serialized at an authoritative business-level transaction boundary. That boundary must atomically:

1. validate business activation and requested dates;
2. check overlapping confirmed assignments/active stays and maintenance blocks;
3. verify the hold/token is valid and unexpired;
4. claim the room/date interval with a version/lock or equivalent conditional write;
5. persist the confirmed booking/allocation and its audit event; and
6. return one definitive success or conflict result.

**Unresolved implementation:** No such authoritative service is implemented in this Desktop repository. A Firestore transaction/conditional service or another coordinated service could be evaluated, but the exact service, lock representation, expiration, and transaction scope have not been selected. Dexie transactions only coordinate a single local database and cannot serialize independent devices.

Offline booking requests remain drafts/provisional until the authoritative boundary accepts them. A provisional request may be rejected after reconnection; UI must communicate this and preserve the request history.

---

## 9. Folio, billing, GST, payments and refunds

### Financial source of truth

**Approved direction:** The Stay folio ledger and its append-only entries are the financial truth; invoices are issued snapshots/summaries; payment records describe tenders; allocations connect payments to balances. This is separate from Restaurant sales.

### Proposed lifecycle

Booking → advance/deposit → check-in → room and ancillary charges → partial/split payments → final invoice → checkout → audit.

- A deposit creates a payment/tender record and a corresponding folio posting.
- Room/additional charges post to the stay folio; Restaurant sales remain separate unless explicitly linked with a clear cross-domain reference.
- A split tender is represented by multiple tender records and allocations; it should not be collapsed into a `split` pseudo-payment if the component tenders need reconciliation.
- Multiple payers use payer identity/link records; each payment identifies the actual payer.
- Payment reversal is a new compensating record/entry, never silent mutation of a posted payment.
- Refund is tied to an original payment and payer, with approval/status/reason and an auditable folio effect.
- An issued invoice is immutable. Corrections use a credit memo or adjustment and reference the original invoice.
- Outstanding balance is calculated from posted ledger entries and allocations, not copied from a payment or invoice summary.

### Paise and debit/credit convention

Store money as integer paise. Proposed sign convention:

- Positive amounts increase the guest’s amount owed (debit to folio exposure): room/ancillary charge, tax, debit adjustment.
- Negative amounts reduce the amount owed (credit): payment applied, discount, refund/credit, credit adjustment.
- `folio_balance_paise = opening_balance_paise + sum(posted folio entry amounts)`.
- If entries are instead stored as unsigned amounts with entry-type rules, the calculation must consistently apply type signs; do not mix both conventions.
- `payment_allocations` sum must not exceed the posted payment amount or the eligible outstanding amount, subject to approved overpayment/deposit behavior.

The existing draft formula subtracts refunds from the balance even though one other draft says a refund creates a negative folio entry; those descriptions can double-subtract a refund. The single-signed-entry calculation above is the clean conceptual target, but the exact representation of refund and payment is still a schema decision.

### Taxes and rates

Current docs propose integer paise, tariff effective windows, rate history, line-level tax snapshots, and no hardcoded tax rate. They do **not** finalize:

- rate snapshot fields and exact freeze point at booking;
- whether changes after booking require guest consent or apply only prospectively;
- rate change while occupied and room-move re-rating;
- extra-person charges;
- hourly, daily, weekly, or package rates and rounding rules;
- inclusive/exclusive GST calculations and rounding;
- GST registration/configuration and legally required invoice snapshot fields;
- applicable tax rates, classification, or legal invoice rules.

**Design requirement:** Preserve the rate and tax inputs used for each confirmed booking/posted charge/invoice so later configuration changes cannot rewrite history. Tax rates must be data/configuration-driven and never hardcoded in application logic. Applicable policy requires product/accounting and legal review.

### Cash and revenue

Cash reconciliation compares expected tenders to counted cash and records variance separately; it must not silently alter a folio payment. Revenue and ADR/RevPAR are derived using a defined business date and room-night basis. The docs propose room revenue / sold room nights for ADR and room revenue / available room nights for RevPAR, but definitions for unavailable rooms, complimentary stays, taxes, cancellations, and ancillary revenue still need approval.

### Idempotency and audit

Every financial operation needs a stable client request/idempotency key that survives retries and restarts. A retry should return the same logical operation, not duplicate it. Enforce uniqueness at the authoritative service as well as local checks. Record actor, timestamp, reason/reference, status transitions, and reversal links.

---

## 10. Night audit and financial reconciliation

### Current design direction

Night audit is a serial, business-date close with one active session per business date. It reconciles folios, charges, payments/refunds, and expected versus counted cash. It must not duplicate a close or silently mutate completed transactions.

### Required workflow (policy still incomplete)

1. Determine the business date from business-local timezone and configured business-day start.
2. Open one audit session for the business date; reject a second active session.
3. Establish and record the transaction cutoff.
4. Identify unposted/outbox-pending transactions and unresolved provisional booking/payment/refund operations.
5. Reconcile room/folio charges, taxes, discounts, payments, reversals, refunds, invoices, and balances.
6. Reconcile expected tender totals against cash count and other payment settlement evidence; record variance separately.
7. Present exceptions and require appropriate closing authorization.
8. Close exactly once and persist immutable audit results/history.
9. Open the next business date without rewriting prior-day postings.

### During audit and late events

The existing documents do not define allowed operations during audit, exception authority, or late-arriving transaction treatment. Recommended minimum: once cutoff/close begins, new transactions are tagged to the appropriate business date by the agreed policy; a transaction arriving after cutoff must be surfaced as a late/unposted exception or posted to a later date with an explicit linked correction. Never silently backdate, discard, or rewrite a completed transaction.

### Reopen policy

Reopening requires an authorized actor, reason, timestamp, linked prior audit, and append-only reopen event. The prior close remains intact; any correction is a new audit/reconciliation record. Who may approve a reopen and whether a second approver is required are unresolved.

### Unresolved business rules

- Property timezone and daylight-saving/time-change behavior.
- Business-day start time and transaction cutoff.
- Which transaction types may occur during audit.
- Blocking criteria for unposted transactions or unsettled folios.
- Allowed and approved exceptions, and who can authorize them.
- Closing and reopening authority.
- How late synced transactions are dated and reconciled.
- Next-day opening balances and carry-forward rules.

These are not defined by the current repository or the prior design documents and need explicit product/accounting approval.

---

## 11. Offline-first architecture, cloud synchronization and conflicts

### Verified current pattern

The Desktop uses Dexie, a cloud outbox middleware, a sync scheduler, and a cloud contract mapping layer. The cloud contract is optional/replication-oriented. The documented implementation does not show a centralized accommodation booking lock or a multi-device Stay transaction engine.

### Operation classes

| Class | Operations | Result |
|---|---|---|
| **A — safe offline** | Local booking draft, notes, queued housekeeping/cleaning updates, unfinalized audit draft | Persist locally, visibly pending sync |
| **B — provisional offline** | Temporary hold, booking request, check-in draft, payment draft, refund draft, audit preparation | Preserve request and mark provisional; no final business commitment |
| **C — online authoritative validation required for final confirmation** | Room allocation/confirmed booking, check-in finalization, payment posting, refund processing, invoice issuance/correction, night-audit close/reconciliation | Require authoritative conflict/idempotency/policy validation before showing success |

**Important distinction:** A receipt/physical tender may have occurred while offline, but the software cannot honestly claim that remote settlement or globally unique ledger posting has been confirmed until validated. The UI and recovery process must distinguish recorded locally from authoritative posting.

### Conflict rules

- Room/date allocation: centralized or serialized conditional transaction; last-write-wins is unsafe.
- Check-in: atomically confirm room allocation and active stay; reject if another active assignment exists.
- Payments/refunds: unique idempotency key; detect duplicates and mark ambiguous results for review rather than posting again.
- Folio events: append-only; reconcile versions and preserve reversals.
- Night audit: one unique `(business_id, business_date)` final close; duplicates return the prior close or a conflict.
- Housekeeping/notes: last-write-wins may be acceptable for non-financial fields only if actor/history and conflict semantics are sufficient.

### Retry and restart

The proposed outbox should persist entity/action/business identifiers, stable request ID, payload identity, creation time, attempt state, and last error. Retry with bounded backoff; restart resumes the same operation ID. A payment with unknown remote outcome must be queried/reconciled by idempotency key before resubmission. Never mint a fresh key for a retry of the same user action.

### Admin disable while offline

A device cannot receive a new disable while disconnected. Apply the last valid cached config only until expiry; on expiry, fail closed for new Stay activity. On reconnect, fetch the newest version, invalidate stale UI/service state, and preserve local records. The precise grace/expiry interval and historical read policy remain unresolved.

---

## 12. Desktop and Android integration strategy

**Verified:** This workspace is the Desktop codebase; Android implementation is not present here. The Desktop already has the business-scoped cloud contract patterns and a local admin-control cache.

**Approved direction:** Desktop and Android must use one shared module activation contract, IDs, booking/stay statuses, financial signs, idempotency rules, tax/rate snapshot semantics, and conflict outcomes. Do not create a second Stay database or Android-specific activation system.

Required cross-platform agreement:

- same `business_id` and Stay identifiers;
- same config version, source, timestamp, expiry, and enable/disable semantics;
- same room/booking/stay state transitions;
- same folio/payment/refund/invoice contract;
- same idempotency and retry behavior;
- same authoritative room-allocation boundary.

The actual Android repo, configuration transport, and server-side transaction boundary are outside this workspace and must be inspected/validated before claiming cross-platform compatibility.

---

## 13. Marathi and English language support, with future Hindi support

**Product requirement:** Support Marathi and English for the initial product direction, with Hindi considered for a future phase.

The current workspace has an i18n layer, but the Stay translations, coverage requirements, and Android parity are not implemented or validated by the documents reviewed. “Marathi-first” appears in an earlier roadmap; the latest user wording sets Marathi and English support with future Hindi support.

### Proposed localization requirements

- All Stay labels, status messages, validation errors, help, printed receipts/invoices, and date/number displays should use the existing localization approach where applicable.
- Missing translations must be detectable; avoid silently mixing languages in a workflow.
- Language choice should be available to the user/business under the existing application conventions; exact ownership/default behavior is unresolved.
- Test each workflow in Marathi and English; add Hindi when that phase is approved.
- Ensure offline operation does not require fetching translation strings.

Whether language selection is per user, per device, or per business, and what languages are used on legal invoices, remain decisions requiring product approval.

---

## 14. UI/UX principles for less technically experienced lodge owners and staff

The target user should be able to complete common lodge work without an accountant or technical expert beside them. This is a product goal, not a verified current Stay capability.

Recommended principles:

- Plain Marathi/English wording and consistent icons with text labels.
- Guided workflows with explicit status and next action.
- Make “draft,” “provisional,” “confirmed,” “posted,” “settled,” and “closed” visibly different.
- Show room availability and maintenance/cleaning blocks before allowing selection.
- Explain conflicts and network-dependent actions without losing entered information.
- Keep common actions discoverable; do not hide core actions behind technical settings.
- Provide confirmations for irreversible financial/audit actions, and clear correction paths.
- Use accessible spacing, readable type, low cognitive load, keyboard/touch support appropriate to Desktop and Android.
- Avoid requiring bookkeeping knowledge to understand a folio balance; show charges, payments, and amount due in understandable terms while preserving audit detail.

Exact usability standards, user research, and acceptance thresholds remain to be decided through lodge-owner UAT.

---

## 15. Staged implementation and rollout roadmap

The latest user-provided order is the current proposed rollout:

| Phase | Scope | Gate / dependency |
|---|---|---|
| 1 | Admin Stay toggle and configuration contract | Resolve contract authority, business scope, cache expiry, propagation, and permission separation |
| 2 | Dexie database foundation and safe migration | Approve physical model, financial posting semantics, backup/restore compatibility, migration tests |
| 3 | Rooms, room types, availability | Select authoritative reservation/locking boundary before final multi-device confirmation |
| 4 | Guest registration and bookings | Provisional offline requests must reconcile safely |
| 5 | Check-in, checkout, room moves | Occupancy and financial transition rules must be explicit |
| 6 | Folio, billing, payments | Finalize source-of-truth mapping, rates/tax snapshots, idempotency, payer/split rules |
| 7 | Night audit and reconciliation | Approve business-day/cutoff, exceptions, close/reopen policy |
| 8 | Housekeeping, maintenance, reports | Define room-state transitions and report definitions |
| 9 | Offline synchronization and Android integration | Validate the Android source and shared authoritative service/config contract |

This order is staged, not a commitment to defer all sync work. The concurrency service and shared config contract may be prerequisites to phases 3–7. Stage detailed technical design in advance so that the app does not ship local-only “confirmed” operations that cannot be made safe across devices.

### Rollout proposal

Prior documents recommend regression testing, internal alpha, a small controlled beta/pilot, and production smoke checks. They do not identify a specific pilot customer, rollout size, support staffing, rollback mechanism, or release date; these remain to be planned.

---

## 16. Testing strategy

Testing should proceed incrementally with each phase and preserve existing Restaurant/Retail behavior.

### Unit

- state transitions and module/permission checks;
- date overlap and room availability rules;
- temporary-hold expiration;
- integer-paise rate/tax calculation and inclusive/exclusive rounding;
- folio debit/credit balance, split allocation, refunds, reversals, invoice corrections;
- idempotency behavior;
- occupancy, ADR, RevPAR and business-day definitions after those definitions are approved.

### Integration

- Dexie transaction boundaries and business-scoped queries;
- config loading, version ordering, cache expiry, and route/service reactivity;
- outbox retry/restart behavior;
- local migration and backup/restore;
- cloud contract mapping without overwriting Restaurant/Retail records.

### Migration

- upgrade from every supported prior Dexie version;
- no loss/change to existing Restaurant/Retail/business data;
- failed/interrupted upgrade recovery;
- backup restore before/after Stay enablement;
- validate indexes and data integrity without destructive migration.

### Concurrency and conflict

- two devices book overlapping periods for the same room/category;
- simultaneous room assignment/check-in;
- same payment/refund retried after timeout/restart;
- duplicate invoice numbering and duplicate night-audit close;
- late sync after cutoff and stale version handling.

### Security and access

- direct URL and local service calls while disabled;
- expired/stale cache;
- employee permission denial;
- cross-business identifier access;
- attempted local tampering tests as application robustness checks, while recognizing they cannot prove security against the device owner.

### Alpha, beta, UAT and production smoke

- **Alpha:** internal staff exercises realistic bookings, room moves, payment, checkout, offline drafts, and existing Restaurant regression.
- **Beta/pilot:** selected small lodge(s); reconcile real-world cases against a controlled parallel record and review support/error reports.
- **UAT:** lodge owner and staff validate Marathi/English workflows, terminology, day-close expectations, and recovery from mistakes.
- **Production smoke:** Stay disabled/enabled, business scoping, booking conflict, payment retry, checkout/invoice, admin disable, backup/restore, and Restaurant unaffected.

No numerical performance thresholds, pilot size, or sign-off authority are established yet.

---

## 17. Performance, reliability, scalability, backup and recovery

### Performance

Availability lookups should use indexed business/date/room/status data rather than full scans. Guest/booking/status and folio/time queries also need appropriate business-scoped indexes. Load testing must cover the largest expected room count and history volume; those product limits are not yet specified.

### Reliability and scalability

- Dexie transactions protect local atomic writes only.
- Cloud replication alone does not ensure global uniqueness or serializable booking/payment semantics.
- Multi-device correctness depends on the still-unselected authoritative transaction service.
- Retry queues must be durable and idempotent.
- Failures and unresolved conflicts must be visible to users/administrators, not silently dropped.

### Backup and recovery

The repo has an existing local backup/restore mechanism. Stay must be included only through an explicitly tested backup contract:

- include Stay records, configuration version/state as appropriate, and sync/outbox recovery metadata;
- do not let an old backup overwrite a newer central activation policy;
- preserve referential links and ledger/event history;
- test interrupted writes, application restart, restore to a new device, and resync;
- financial data must not be “repaired” by destructive deduplication without an auditable correction.

Retention, encryption-at-rest beyond platform/IndexedDB behavior, backup schedule guarantees, and cross-device restore conflict policy are unresolved. Do not infer cloud backup from optional Firebase sync.

---

## 18. Risks, limitations and unresolved architectural decisions

### Main risks

- Restaurant/Retail regression in a shared app shell.
- Double booking or double check-in across devices without authoritative atomic allocation.
- Duplicate or inconsistent financial entries due to overlapping folio/payment/ledger models.
- Stale admin configuration during offline operation.
- Local data tampering or extraction by a device owner.
- Incorrect GST/rate/invoice behavior without a validated domain/legal policy.
- Night audit errors without timezone, cutoff, exception, and reopen rules.
- Translation gaps that make high-risk financial workflows confusing.
- Unbounded historical data and slower reports/backups as a property grows.

### Unresolved decisions requiring approval before the affected phase

1. **Admin contract:** authoritative service/config location; whether the existing desktop check-in transports a business-wide config; source of truth and Android transport.
2. **Cache policy:** exact TTL/expiry, refresh interval, offline grace, active-session behavior, and whether read-only historical access survives expiry.
3. **State semantics:** whether `enabled` boolean plus state is needed; meaning of `maintenance`.
4. **Permissions:** role/user model and approval authorities.
5. **Room allocation:** exact centralized/serialized service and lock/hold lease semantics.
6. **Schema:** canonical event/history design; whether optional guest profile/folio account/payer-link entities are justified.
7. **Ledger:** exact mapping between `folio_entries`, `stay_payments`, `payment_allocations`, `refunds`, `credit_memos`, and existing `ledger_transactions`, avoiding duplicate postings.
8. **Rates/tax:** booking snapshots, changes during occupancy, pricing units, extra-person policy, tax inclusivity/rounding, GST setup, and invoice rules.
9. **Night audit:** timezone, start/cutoff, transaction handling during close, unposted transaction policy, exception authorization, close/reopen permissions, late sync, next-day opening.
10. **Offline policy:** physical tender capture and ambiguous payment outcomes; permitted access to historic records after config expiry.
11. **Android:** verify its source repository, shared cloud/service implementation, release coordination, and platform parity.
12. **Localization:** language selector/default scope, translation ownership, Hindi timing, and invoice language requirements.
13. **Product scope:** which lodging types and which launch reports/operational features are required.
14. **Operations:** pilot customer, support procedures, retention, recovery objectives, and release/rollback plan.

---

## 19. Phase-wise acceptance criteria

| Phase | Acceptance criteria |
|---|---|
| 1. Admin toggle/config | A single business-scoped versioned contract is consumed by Desktop and Android; `updated_at`, `updated_by`, `source`, and expiry are validated; offline expiry and propagation behavior are specified; disable blocks new operations and preserves records; permissions remain separate; existing Restaurant remains unaffected. |
| 2. Database foundation | Approved relational model and financial posting mapping; safe additive Dexie migration; correct business indexes; existing data preserved; backup/restore and migration interruption tests pass. |
| 3. Rooms/availability | Room types, rooms, maintenance/cleaning state and holds are distinct; overlapping room allocation has one authoritative winner under concurrent attempts; all state changes audited. |
| 4. Guests/bookings | Guest and multi-guest relations work; category reservation differs from room assignment; offline drafts remain provisional; confirm/cancel/modification histories are preserved. |
| 5. Check-in/out/moves | Final check-in atomically claims room/occupancy; checkout releases occupancy and initiates approved settlement; room move preserves both assignments and charge history; duplicate transition is idempotent. |
| 6. Folio/billing/payments | Integer-paise signs/balance rules approved; each economic event is posted once; deposits, split tenders, multiple payers, allocations, reversal/refund, invoice snapshots and credit corrections reconcile; GST/rate snapshots tested. |
| 7. Night audit | Business date/cutoff, exception and approval rules approved; one active/final close per date; unposted items identified; variance recorded separately; late transactions and reopen produce linked audit records, never silent edits. |
| 8. Operations/reports | Housekeeping and maintenance transitions are consistent with availability; reports use approved definitions; permissions and multilingual workflows tested. |
| 9. Offline/Android integration | Retry/restart/conflict recovery passes across clients; authoritative lock/idempotency service is shared; both clients interpret the same config and records; alpha/beta/UAT and production release gates pass. |

Acceptance thresholds (timings, maximum data volume, sync delay, and error-rate limits) must be set before performance sign-off.

---

## 20. Final implementation readiness assessment

### Assessment

**Overall architecture:** Suitable in principle for a single-shell, local-first Stay sub-module under Restaurant.  
**Ready to begin Phase 1 implementation:** **Partially ready — requires explicit user approval and resolution of Phase 1-specific contract decisions first.**  
**Ready for full implementation:** No.

### Critical blockers

- The central business-scoped activation contract is not implemented in the Desktop repository or verified in the Admin Console/backend/Android repositories.
- No authoritative multi-device room-allocation transaction boundary is selected or evidenced.
- Financial truth is directed to folio entries, but the payment/ledger event mapping still risks duplicate accounting.
- Night-audit business date, cutoff, exception, and approval rules are not defined.
- Rate/GST snapshot and legal invoice policy are not defined.

### Decisions requiring user/product approval

- Confirm the exact Stay activation contract source and cache/expiry/propagation policy.
- Confirm roles and permissions separately from module enablement.
- Select the authoritative service boundary for room allocations.
- Approve the financial posting model and lodge accounting conventions.
- Define night-audit and rate/GST policies with appropriate domain/accounting input.
- Confirm the launch language requirements as Marathi + English, with Hindi later, and decide language-selection scope.
- Confirm the target lodging types and release/pilot gates.

No phase has been started. This report does not imply approval to implement.

---

## Final summary table

| Area | Current decision | Status | Remaining work |
|---|---|---|---|
| Product placement | Stay is a child module under Restaurant in the shared app | Confirmed | Preserve Restaurant behavior and validate launch scope |
| User goal | Usable by small lodge owner/staff without accountant or technical expert | Confirmed | Validate through lodge-owner UAT |
| Admin activation | Centrally controlled, business-scoped, not employee permission | Partially defined | Select canonical service/transport and publish exact contract |
| Config cache | Versioned with expiry; fail closed for new Stay operations after expiry | Partially defined | Approve TTL, refresh, offline grace, historical read policy |
| Desktop + Android | One shared contract and semantics; no separate Android toggle/database | Confirmed (direction) | Inspect Android repo and implement/verify parity |
| Security | UI/service/cloud layers; local checks are not a boundary against device owner | Confirmed | Implement and test within realistic limits |
| Roles/permissions | Separate from central module activation | Partially defined | Approve role matrix and authorities |
| Room allocation | Atomic/serialized authoritative confirmation; replication alone is insufficient | Confirmed (requirement) | Select and verify authoritative service/lock semantics |
| Booking offline | Draft/provisional until authoritative validation | Confirmed | Define hold expiry and user-facing conflict recovery |
| Stay data model | Business-scoped Stay entities separate from Restaurant sales | Partially defined | Approve physical schema and remove overlapping entities |
| Financial truth | Folio ledger/entries are intended source of truth; integer paise; append-only/idempotent | Partially defined | Resolve exact posting/sign mapping and ledger_transactions reuse |
| Rates and GST | Historical snapshots needed; rates not hardcoded | Partially defined | Decide pricing units, tax/legal rules, snapshot fields |
| Night audit | One serial close per business date; no silent transaction rewrites | Partially defined | Set timezone, day start/cutoff, exceptions, approvals and reopen rules |
| Offline payments/refunds | Draft/provisional offline; final posting/processing validated online | Partially defined | Specify physical tender capture and uncertain-outcome workflow |
| Languages | Marathi and English; Hindi future | Confirmed (direction) | Define selector/default, translation scope, invoice language and QA gates |
| Housekeeping/maintenance | Required operational areas, staged after core workflows | Partially defined | Define statuses, task ownership, availability interactions |
| Reports | Occupancy, room revenue, ADR/RevPAR and reconciliation envisioned | Partially defined | Approve formula definitions and launch priorities |
| Cost/dependencies | Reuse existing stack; avoid unnecessary paid services | Confirmed (principle) | Evaluate any proposed service/dependency before adoption |
| Performance/recovery | Indexed queries, durable idempotent sync, tested backup/restore required | Partially defined | Set scale targets, retention and recovery objectives |
| Phase 1 readiness | Architecture can proceed only after Phase 1 decisions and explicit approval | Requires approval | Approve contract details and authorize Phase 1 |

---

## Exact files reviewed

The following existing Stay design and architecture documents were read for this consolidation:

### Current root-level Stay design package

- `STAY_ADMIN_TOGGLE_DESIGN.md`
- `STAY_DATABASE_SCHEMA.md`
- `STAY_SYNC_ARCHITECTURE.md`
- `STAY_FINANCIAL_ARCHITECTURE.md`
- `STAY_SECURITY_DESIGN.md`
- `STAY_ANDROID_DESKTOP_INTEGRATION.md`
- `STAY_IMPLEMENTATION_BLUEPRINT.md`
- `STAY_TEST_STRATEGY.md`
- `STAY_ARCHITECTURE_DECISIONS.md`

### Earlier root-level discovery and planning documents

- `KAMAI_STAY_ARCHITECTURE.md`
- `DATABASE_CHANGE_PLAN.md`
- `DEVELOPMENT_ROADMAP.md`
- `RISK_REGISTER.md`
- `COST_AND_DEPENDENCY_REGISTER.md`
- `EXISTING_FEATURE_INVENTORY.md`
- `SYSTEM_ARCHITECTURE.md`

### `docs/kamaiplus-stay/`

- `docs/kamaiplus-stay/01-project-understanding.md`
- `docs/kamaiplus-stay/02-existing-workflows.md`
- `docs/kamaiplus-stay/03-recent-documentation-review.md`
- `docs/kamaiplus-stay/04-stay-feasibility-analysis.md`
- `docs/kamaiplus-stay/05-proposed-architecture.md`
- `docs/kamaiplus-stay/06-database-api-impact.md`
- `docs/kamaiplus-stay/07-admin-toggle-design.md`
- `docs/kamaiplus-stay/08-risk-assessment.md`
- `docs/kamaiplus-stay/09-testing-strategy.md`
- `docs/kamaiplus-stay/10-implementation-roadmap.md`
- `docs/kamaiplus-stay/11-open-questions.md`

## Exact files modified during this documentation task

- `STAY_FINAL_ARCHITECTURE_REVIEW.md` — created.

No existing source files, schema files, or prior architecture documents were modified or deleted.
