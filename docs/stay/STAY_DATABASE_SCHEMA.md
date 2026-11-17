# STAY_DATABASE_SCHEMA.md

## Scope and constraints

This document is design-only. It does not create database tables or modify the existing Dexie schema.

### Verified repo facts

- The current app uses Dexie over IndexedDB: `src/lib/db/index.ts`.
- Existing tables are retail-first and include `businesses`, `categories`, `products`, `customers`, `suppliers`, `sales`, `inventory_movements`, `ledger_transactions`, `cash_registers`, `cash_expenses`, `sales_returns`, `marketing_templates`, `audit_logs`, `purchase_bills`.
- There is no Stay module schema in the repo today.
- The app already uses `business_id` as the tenant/business boundary for most records and keeps the cloud contract explicit through `src/lib/cloud/cloudContract.ts`.
- `custom` and `saleMath` logic already treat money as integer paise and keep tax calculations separate from item storage.

### Design principles

1. Keep Stay data separate from Restaurant sales and retail records.
2. Use the same `business_id` tenant model as the rest of the app.
3. Store all financial entries as a separate ledger domain, never mixed into restaurant `sales` rows.
4. Represent room/booking/stay state as immutable events plus current-state tables.
5. Prefer append-only audit trails for changes to rates, availability, folios, payments and night audit reconciliations.

## Necessity review for the proposed tables

The user-proposed tables are directionally useful, but some are redundant or should be refactored into more canonical records.

### Necessary as-is

- `rooms` — yes, required for room inventory and occupancy.
- `room_types` — yes, required for category-level definitions, capacity, pricing defaults, and room attributes.
- `room_tariffs` — yes, required to manage rate plans and room price logic.
- `bookings` — yes, required to hold reservation intent before check-in.
- `booking_guests` — yes, required because a booking may include multiple guests and a guest may be on many bookings.
- `stays` — yes, required as the operational lifecycle record for an occupied room.
- `stay_charges` — yes, required to keep room charges and ancillary service charges separate from payment records.
- `stay_payments` — yes, required for cash/UPI/card/credit and split allocations.

### Needed but should not be standalone `check_ins` / `check_outs` tables

- `check_ins` — not a separate table if `stays` already hold `check_in_at` and `check_in_by`; keep an append-only `stay_events` log instead.
- `check_outs` — same as above; track checkout in `stays` and `stay_events`.

### likely necessary but should be modeled differently

- `occupancy_history` — useful as an append-only room state event stream, but better named `room_occupancy_events` or `stay_events` to avoid duplication with check-in/check-out tables.
- `housekeeping_tasks` — yes, required operationally.
- `maintenance_requests` — yes, required for room readiness and asset maintenance.
- `lost_and_found` — yes, required for guest issues and property loss tracking.
- `night_audit_sessions` — yes, required for daily closure and reconciliation.

## Additional entities required

The Stay domain needs more than the initial list because lodging operations require folios, allocations, billing and audit requirements.

### Core reference and operational entities

- `guests` — canonical guest master record; used by `booking_guests` and `stay_guests`.
- `guest_profiles` — optional profile extensions (ID info, preferences, communication, emergency contact).
- `business_days` — daily accounting and operational date boundaries.
- `stay_events` — lifecycle event log for check-in, checkout, room change, rate change, payment, refund, invoice issue, no-show, cancellation, maintenance, housekeeping, audit closure.
- `booking_modification_history` — append-only audit of status and date changes.
- `rate_plan_history` — immutable historical records of rate plan application over time.
- `room_status_history` — occupancy, clean/dirty status changes and blocked-room state.
- `night_audit_reconciliations` — one record per reconciliation run comparing issued charges, payments and expected balance.
- `folio_accounts` — optional master accounts used when a stay may have multiple ledgers or payer groups.

### Financial entities

- `folios` — the guest folio / stay bill ledger master.
- `folio_entries` — every charge, payment, refund, discount, tax, adjustment and manual correction.
- `payment_allocations` — map payment amounts to specific charges or folio balance segments.
- `payers` — a person or party entity attached to a visit, even when the bill is not in the same guest profile.
- `payer_links` — many-to-many links between folios/stays and payer records.
- `invoices` — final summary docs for stays.
- `invoice_lines` — per-line invoice items, taxes, service charges and discounts.
- `tax_calculations` — tax basis, rate, amount, and jurisdiction metadata for each tax component.
- `refunds` — refund records tied to original payers and folio entries.
- `credit_memos` — optional document for invoice corrections.
- `ledger_transactions` reuse — not a new table, but a domain-specific ledger record set kept segregated by `financial_domain = 'stay'` and `entity_type = 'stay_folio'`.

## Proposed relational model

The model below is conceptual and intentionally conservative.

### 1. Core dimension tables

#### businesses
- Primary key: `id`
- Required: existing shared tenant record
- Relationship: parent of all Stay records
- Notes: keep business-scoped tenant logic as is

#### room_types
- PK: `id`
- FK: `business_id -> businesses.id`
- Fields:
  - `name`
  - `code`
  - `capacity_adults`, `capacity_children`
  - `base_occupancy`, `max_occupancy`
  - `standard_rate_amount` / `base_price_paise`
  - `is_active`
  - `created_at`, `updated_at`, `created_by`, `updated_by`
- Indexes:
  - `(business_id, is_active)`
  - `(business_id, code)`

#### rooms
- PK: `id`
- FK: `business_id -> businesses.id`, `room_type_id -> room_types.id`
- Fields:
  - `number`, `floor`, `status` (`vacant`, `occupied`, `dirty`, `maintenance`, `blocked`, `out_of_order`)
  - `status_reason`
  - `is_available_for_booking`
  - `last_cleaned_at`, `last_occupied_at`
  - `created_at`, `updated_at`
- Indexes:
  - `(business_id, status)`
  - `(business_id, number)`
  - `(business_id, room_type_id)`
- Constraint: room number unique per business

#### guests
- PK: `id`
- FK: `business_id -> businesses.id`
- Fields:
  - `first_name`, `last_name`, `phone`, `email`, `id_type`, `id_number`, `nationality`
  - `preferred_language`, `loyalty_id`
  - `created_at`, `updated_at`
- Indexes:
  - `(business_id, phone)`
  - `(business_id, email)`

### 2. Booking lifecycle

#### bookings
- PK: `id`
- FK: `business_id -> businesses.id`, `room_type_id -> room_types.id`, `primary_guest_id -> guests.id` (nullable)
- Fields:
  - `booking_number`
  - `status` (`pending`, `confirmed`, `checked_in`, `completed`, `cancelled`, `no_show`, `modified`)
  - `arrival_at`, `departure_at`
  - `expected_arrival`, `expected_departure`
  - `source` (`direct`, `ota`, `travel_agent`, `walk_in`)
  - `notes`, `special_requests`
  - `created_at`, `updated_at`, `created_by`, `updated_by`
- Indexes:
  - `(business_id, status, arrival_at)`
  - `(business_id, booking_number)`
  - `(business_id, primary_guest_id)`

#### booking_guests
- PK: `id`
- FK: `booking_id -> bookings.id`, `guest_id -> guests.id`
- Fields:
  - `guest_role` (`primary`, `adult`, `child`, `companion`)
  - `is_primary_contact`
  - `created_at`
- Indexes:
  - `(booking_id, guest_id)`

#### booking_modification_history
- PK: `id`
- FK: `booking_id -> bookings.id`, `changed_by_user_id` (nullable if a user table exists)
- Fields:
  - `field_name`
  - `old_value`, `new_value`
  - `reason`
  - `created_at`
- Indexes:
  - `(booking_id, created_at)`

### 3. Stay and room occupancy

#### stays
- PK: `id`
- FK: `business_id -> businesses.id`, `booking_id -> bookings.id` (nullable), `room_id -> rooms.id`, `primary_guest_id -> guests.id`
- Fields:
  - `stay_number`
  - `status` (`reserved`, `checked_in`, `checked_out`, `cancelled`, `extended`)
  - `check_in_at`, `check_out_at`
  - `expected_checkout_at`, `actual_checkout_at`
  - `room_rate_paise`, `tax_rate`, `invoice_status`
  - `created_at`, `updated_at`
- Indexes:
  - `(business_id, status, check_in_at)`
  - `(room_id, status)`
  - `(booking_id)`

#### stay_guests
- PK: `id`
- FK: `stay_id -> stays.id`, `guest_id -> guests.id`
- Fields:
  - `relationship`, `is_primary_contact`
  - `created_at`
- Indexes:
  - `(stay_id, guest_id)`

#### room_occupancy_events or stay_events
- PK: `id`
- FK: `business_id -> businesses.id`, `room_id -> rooms.id` (nullable), `stay_id -> stays.id` (nullable)
- Fields:
  - `event_type` (`checked_in`, `checked_out`, `room_change`, `blocked`, `cleaned`, `maintenance`, `payment`, `invoice`, `audit`)
  - `event_at`
  - `actor_type`, `actor_id`
  - `payload_json`
- Indexes:
  - `(business_id, event_type, event_at)`
  - `(stay_id, event_at)`
- Rationale: this replaces redundant `check_ins` and `check_outs` tables.

### 4. Rate plan and pricing

#### room_tariffs
- PK: `id`
- FK: `business_id -> businesses.id`, `room_type_id -> room_types.id`, `rate_plan_id` (if separate table exists)
- Fields:
  - `name`
  - `effective_from`, `effective_to`
  - `base_rate_paise`
  - `weekend_rate_paise`
  - `occupancy_multiplier`
  - `is_active`
  - `created_at`, `updated_at`
- Indexes:
  - `(business_id, room_type_id, effective_from)`

#### rate_plan_history
- PK: `id`
- FK: `business_id -> businesses.id`, `stay_id -> stays.id`, `room_tariff_id -> room_tariffs.id`
- Fields:
  - `applied_from`, `applied_to`
  - `old_rate_paise`, `new_rate_paise`
  - `reason`
  - `created_at`
- Notes: required because room rates and supplements may change after reservation and during stay.

### 5. Folio and financial ledger

#### folios
- PK: `id`
- FK: `business_id -> businesses.id`, `stay_id -> stays.id`, `booking_id -> bookings.id` (nullable)
- Fields:
  - `folio_number`
  - `status` (`open`, `settled`, `void`, `adjustment_pending`)
  - `opening_balance_paise`, `closing_balance_paise`
  - `currency`
  - `created_at`, `updated_at`
- Indexes:
  - `(business_id, stay_id)`
  - `(folio_number)`

#### folio_entries
- PK: `id`
- FK: `business_id -> businesses.id`, `folio_id -> folios.id`, `stay_id -> stays.id`, `room_id -> rooms.id` (nullable), `charge_type_id` (if a reference dimension exists) 
- Fields:
  - `entry_type` (`room_charge`, `service_charge`, `tax`, `discount`, `payment`, `refund`, `adjustment`, `deposit`)
  - `amount_paise`
  - `balance_after_paise`
  - `currency`, `posting_at`, `posted_by`
  - `reference_type`, `reference_id`
  - `created_at` 
- Indexes:
  - `(folio_id, posting_at)`
  - `(stay_id, entry_type, posting_at)`

#### payment_allocations
- PK: `id`
- FK: `business_id -> businesses.id`, `payment_id -> stay_payments.id`, `folio_entry_id -> folio_entries.id`
- Fields:
  - `allocated_amount_paise`
  - `allocation_rule`
  - `created_at`
- Indexes:
  - `(payment_id, folio_entry_id)`

#### stay_payments
- PK: `id`
- FK: `business_id -> businesses.id`, `folio_id -> folios.id`, `stay_id -> stays.id`, `payer_id -> payers.id` (nullable)
- Fields:
  - `payment_number`
  - `payment_method` (`cash`, `upi`, `card`, `bank_transfer`, `credit`, `wallet`, `split`)
  - `amount_paise`
  - `status` (`pending`, `posted`, `reversed`, `failed`, `refunded`)
  - `reference_number`, `channel`, `is_duplicate_check_passed`
  - `created_at`, `updated_at`
- Indexes:
  - `(business_id, created_at)`
  - `(folio_id, status)`

#### payers
- PK: `id`
- FK: `business_id -> businesses.id`
- Fields:
  - `name`, `phone`, `email`, `payer_type` (`guest`, `company`, `travel_agent`, `family_member`, `third_party`)
  - `created_at`
- Indexes:
  - `(business_id, phone)`

#### payer_links
- PK: `id`
- FK: `stay_id -> stays.id`, `folio_id -> folios.id`, `payer_id -> payers.id`
- Fields:
  - `allocation_ratio`, `is_primary_payer`, `created_at`

#### invoices
- PK: `id`
- FK: `business_id -> businesses.id`, `stay_id -> stays.id`, `folio_id -> folios.id`
- Fields:
  - `invoice_number`
  - `invoice_type` (`stay_final`, `miscellaneous`, `tax_invoice`, `credit_note`)
  - `status` (`draft`, `issued`, `void`, `cancelled`, `paid`)
  - `subtotal_paise`, `tax_total_paise`, `grand_total_paise`
  - `issued_at`, `paid_at`
- Indexes:
  - `(business_id, invoice_number)`
  - `(folio_id, issued_at)`

#### invoice_lines
- PK: `id`
- FK: `invoice_id -> invoices.id`, `folio_entry_id -> folio_entries.id` (nullable)
- Fields:
  - `description`, `amount_paise`, `tax_amount_paise`, `discount_amount_paise`
  - `created_at`

#### tax_calculations
- PK: `id`
- FK: `business_id -> businesses.id`, `folio_entry_id -> folio_entries.id`, `invoice_line_id -> invoice_lines.id` (nullable)
- Fields:
  - `tax_name`, `tax_rate`, `taxable_amount_paise`, `tax_amount_paise`, `jurisdiction`
  - `created_at`

#### refunds
- PK: `id`
- FK: `business_id -> businesses.id`, `stay_id -> stays.id`, `payment_id -> stay_payments.id`, `payer_id -> payers.id`
- Fields:
  - `refund_number`, `amount_paise`, `status`, `reason`, `initiated_at`, `settled_at`

#### credit_memos
- PK: `id`
- FK: `business_id -> businesses.id`, `invoice_id -> invoices.id` 
- Fields:
  - `memo_number`, `amount_paise`, `reason`, `created_at`

### 6. Operations and compliance

#### housekeeping_tasks
- PK: `id`
- FK: `business_id -> businesses.id`, `room_id -> rooms.id`, `assigned_to_user_id` (if user table exists)
- Fields:
  - `task_type` (`clean`, `inspection`, `turn_down`, `special_service`)
  - `status` (`pending`, `in_progress`, `done`, `blocked`)
  - `scheduled_for`, `completed_at`, `notes`
- Indexes:
  - `(room_id, status)`
  - `(business_id, scheduled_for)`

#### maintenance_requests
- PK: `id`
- FK: `business_id -> businesses.id`, `room_id -> rooms.id`
- Fields:
  - `request_type`, `priority`, `status`, `reported_at`, `resolved_at`, `notes`
- Indexes:
  - `(room_id, status)`

#### lost_and_found
- PK: `id`
- FK: `business_id -> businesses.id`, `stay_id -> stays.id` (nullable), `guest_id -> guests.id` (nullable)
- Fields:
  - `item_name`, `item_description`, `status` (`found`, `claimed`, `disposed`)
  - `found_at`, `claimed_at`, `claimed_by`

#### night_audit_sessions
- PK: `id`
- FK: `business_id -> businesses.id`, `audit_by_user_id` (if user table exists)
- Fields:
  - `session_number`
  - `status` (`open`, `locked`, `closed`, `reopened`)
  - `opened_at`, `closed_at`, `reconciliation_at`
  - `expected_cash_paise`, `actual_cash_paise`, `variance_paise`
- Indexes:
  - `(business_id, opened_at)`

#### night_audit_reconciliations
- PK: `id`
- FK: `business_id -> businesses.id`, `night_audit_session_id -> night_audit_sessions.id`, `folio_id -> folios.id` (nullable)
- Fields:
  - `expected_amount_paise`, `actual_amount_paise`, `variance_paise`
  - `reconciled_by`, `reconciled_at`

#### business_days
- PK: `id`
- FK: `business_id -> businesses.id`
- Fields:
  - `day_start_at`, `day_end_at`, `status` (`open`, `closed`, `reopened`)
  - `opened_by`, `closed_by`
- Indexes:
  - `(business_id, day_start_at)`

## Key constraints and status fields

### Required status fields

Every lifecycle table should include:
- `status`
- `created_at`, `updated_at`
- `created_by`, `updated_by`
- `deleted_at` or a soft-delete flag if the product allows business revert/remove actions

### Required audit rules

- All updates to rates, payments, folios, invoices, refunds, and night audit results must be append-only when the historical state matters.
- Do not overwrite a historical ledger entry; create a new one or a reversal entry instead.
- Keep a `version` number or `updated_at` timestamp for optimistic concurrency control.

### Typical constraints

- Unique room number per business.
- Unique booking_number per business.
- Unique stay_number per business.
- Unique invoice_number per business.
- Unique payment_number per business.
- A folio should not have a check-in and check-out on the same room overlap in unapproved state.
- A room cannot be assigned to more than one active stay at the same time.

## Why this schema is necessary

These tables are not redundant:
- `bookings` are reservation intent and availability logic.
- `stays` are the actual occupancy state and financial exposure.
- `folios` are the lodge ledger, independent of the restaurant sale ledger.
- `folio_entries` are the immutable chronological accounting record.
- `stay_payments` and `payment_allocations` resolve tender and split-payment behavior.
- `night_audit_sessions` and reconciliation entries protect the daily closing process and cash variance management.

## Recommendation summary

The main implementation should keep the following three boundaries very clean:
1. Room lifecycle
2. Guest reservation/stay lifecycle
3. Financial ledger / settlements

The repo already has a `business_id`-based tenant model and a separate ledger pattern (`ledger_transactions` in `src/lib/db/index.ts`). Stay should extend the same pattern while staying in a separate financial domain so Restaurant records are never mixed into lodging accounting.

## Finalized relationship model (2026-11-16)

### Decision
The authoritative relationship model is:
- business -> room_types -> rooms
- business -> guests and payers
- business -> bookings -> stays
- stay -> folios -> folio_entries
- folios -> stay_payments -> payment_allocations
- stay -> invoices -> invoice_lines
- stay -> night_audit_sessions -> night_audit_reconciliations

### Reason
This preserves a clear separation between operational room state and financial account posting, while keeping all records tied to `business_id` and avoiding an accidental mix with Restaurant sales data.

### Alternatives considered
- A single booking table also carrying folio and payment state: rejected because it mixes lifecycle and accounting responsibilities.
- Creating independent `check_ins` and `check_outs` tables: rejected because lifecycle events are better modeled as append-only event records.
- Using restaurant `sales` records as accommodation financial truth: rejected because it collapses separate accounting domains.

### Risks
- Over-large event logs if every minor room change is recorded as a separate event.
- Schema drift if guest, payer and room lifecycle data are not versioned correctly.

### Testing implications
- verify room uniqueness and active stay overlap rules
- verify folio postings are posted only once per idempotency key
- verify invoice and payment link consistency
- verify audit logs do not overwrite historical state

### Final reservation and occupancy distinction
- Room category reservation: a room type or room group is held before specific room assignment.
- Specific room assignment: a room id is assigned to a booking or stay.
- Temporary room hold: provisional hold without confirmed check-in.
- Confirmed booking: final reservation state accepted after room availability validation.
- Check-in: active occupancy begins.
- Occupancy: room + stay active state.
- Room move: related stay moves to a different room with a new event and ledger note.
- Checkout: final end of occupancy.
- Cleaning: operational room state after checkout or during turnover.
- Maintenance blocking: room not available due to maintenance or out-of-order status.

### Atomic reservation confirmation mechanism
A reservation is confirmed only when the following is true:
1. room availability is checked against active stay windows for that room
2. the room state is not blocked for maintenance, cleaning or out-of-order
3. the booking state is written with a version or lock token
4. room occupancy is updated atomically with the booking confirmation
5. any provisional hold is resolved to `confirmed` or `rejected` with event history

## Unresolved decisions

- Whether the app should use a single `stay_events` audit log or both event log + status table.
- Whether multi-payer settlement is represented as a payer master table or as a payer link on a folio.
- Whether the system keeps a separate `cash_registers` domain for Stay or reuses a distinct ledger account under a lodging-specific cash account type.
- Whether each hotel property requires a full multi-room rate plan table or a simplified room tariff matrix.
