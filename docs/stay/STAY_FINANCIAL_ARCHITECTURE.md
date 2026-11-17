# STAY_FINANCIAL_ARCHITECTURE.md

## Scope

This document covers the lodging financial lifecycle and the rules for ledger design, split payments, refunds, invoices and night audit. It is intentionally a design document only.

## Verified repo facts

- `src/lib/db/index.ts` already includes `ledger_transactions` and `cash_registers` tables, which are valid retail-side accounting structures.
- `src/lib/cloud/cloudContract.ts` maps sales and payment logic to a cloud document contract, and it already distinguishes money fields and tax calculations.
- There is no accommodation-specific folio/ledger model in the repo today.
- The repo does not currently mix Restaurant settlement data with accommodation financial operations; that separation is a design requirement that must be preserved.

## Design principle

Stay financial records must stay in their own ledger domain and never share a `sales`/restaurant accounting bucket with `sales` or `cash_registers` that are currently retail-focused.

Recommended rule:
- `financial_domain = 'restaurant'` for restaurant sales
- `financial_domain = 'stay'` for lodging folios, charges, payments and refunds
- `business_id` remains the shard key

## The financial lifecycle

Booking → Advance Payment → Check-in → Room Charges → Additional Charges → Partial Payments → Final Invoice → Checkout → Night Audit

### 1. Booking stage

A stay begins with a reservation or direct booking. The booking may reserve a room for a date window, but it does not create a posted financial transaction unless:
- a deposit is taken
- a room charge is scheduled
- an advance payment is applied

The booking should create a `booking` record plus a `folio` record in `open` status if the business requires an account from the start.

### 2. Advance payment

If the guest pays a deposit before arrival:
- create a `stay_payments` row with `payment_method`, `amount_paise`, `status = posted`
- create a `folio_entries` row with `entry_type = 'deposit'` or `entry_type = 'advance_payment'`
- the folio balance becomes net of the deposit, not a restaurant sale
- the deposit must be linked to a `payers` row and optionally `payment_allocations`

### 3. Check-in

At check-in:
- a `stays` row becomes `checked_in`
- the room state changes to occupied
- `stay_events` logs the check-in action
- the folio opens if it was not already created
- room rate may be applied as a scheduled charge depending on business rules

The room start date and expected checkout date should be stored in `stays` and in the folio schedule.

### 4. Room charges and additional charges

Room charges are posted to the stay folio as ledger entries:
- `room_charge`
- `service_charge`
- `laundry`
- `restaurant_order` (if the stay is integrated later; but must be separated and clearly tagged)
- `discount`
- `tax`
- `adjustment`
- `refund`

Important: restaurant orders should not be inserted into room folios unless they are explicitly mapped as a linked service charge for the guest stay. The system must not let restaurant sales data bleed into the stay account.

### 5. Partial payments

Payments against the folio are recorded in two layers:
1. `stay_payments` captures the tender and source
2. `payment_allocations` links amount to each folio entry or open balance bucket

This keeps split payment and multiple payer logic explicit.

## Folio balance calculation

The folio balance is calculated as:
- opening_balance_paise
- + posted charges
- + taxes
- - discounts
- - payments applied
- - refunds
- ± manual adjustments

The full equation should be:
- `folio_balance = opening_balance + charges + taxes + adjustments - applied_payments - refunds`

A folio is settled when:
- final invoice amount equals amount received + outstanding credit
- the room is checked out
- the room and charges are closed in `night_audit_sessions`

## Split payment logic

Split payment is represented by multiple tender rows within a single guest folio.

Recommended model:
- one `stay_payments` record per payment tender
- `payment_allocations` links each tender to one or more folio entries
- a final payment can be split across cash, UPI, card, advance credit or external payer

Example:
- cash = 1500
- card = 2000
- wallet = 500
- total = 4000

The payment allocation should be rule-based:
- allocate towards room charges first
- allocate towards taxes as required by legal rules or local accounting policy
- allocate residual against late fees or other ancillary charges

## Multiple payers and split payer representation

A stay may have multiple payers:
- primary guest
- company payer
- travel agent
- family member
- third-party settlement

Model this with:
- `payers` master table
- `payer_links` to associate each payer with a stay or folio
- `stay_payments` with `payer_id`
- `payment_allocations` to allocate payment amounts to specific folio entries

If a payer is not a guest, it should still be represented as a payer record, not a guest record.

## Refunds

Refunds must be a first-class sub-ledger entry, not a negative sale.

Rules:
- each refund creates a `refunds` row and a negative `folio_entries` entry
- the refund must reference an original `stay_payments` row or an invoice reference
- refunds should not be allowed to exceed the paid amount unless a credit memo is issued
- all refunds should be linked to a payer and a reason code

Recommended statuses:
- `pending_approval`
- `approved`
- `processed`
- `reversed`
- `failed`

## Invoice corrections

Invoice corrections are not a rewrite of old financial entries. They are new entries that express the delta.

Recommended approach:
- issue the original invoice as immutable, with `status = issued`
- create a `credit_memos` or `adjustment_entry` record for correction
- create a `folio_entries` adjustment with a negative or positive delta
- update invoice status only when the correction is approved and issued

Good practice:
- keep the corrected invoice linked to the original invoice id
- never mutate the original totals in place without an audit trail

## Cash reconciliation

Cash reconciliation belongs to daily operations and should be separate from the folio ledger.

Recommended process:
- `business_days` open the current day
- `night_audit_sessions` close the financial day
- `night_audit_reconciliations` compare expected cash vs actual cash
- any variance is recorded as:
  - `cash_variance`
  - `cash_shortage`
  - `cash_overage`
  - `manual_adjustment`

The cash ledger must be distinct from room and stay ledger records. A cash mismatch does not erase or override a folio payment entry; it creates a separate reconciliation entry.

## Daily revenue calculations

Daily revenue should be derived in a reconciliation view rather than stored as a mutable total only.

Use a daily aggregation on folio entries:
- sum all `room_charge` entries for the business day
- sum all major ancillary charges for the day
- subtract refunds and voided amounts
- include taxes only if the business reports tax-inclusive or tax-exclusive totals separately

This ensures the revenue summary remains consistent with the underlying ledger and not a one-off cash estimate.

## ADR and RevPAR

### ADR (Average Daily Rate)
For a business day or reporting period:
- `ADR = total_room_revenue / number_of_rooms_sold`

Interpretation:
- `total_room_revenue` should include room charges only, not all other guest charges
- `number_of_rooms_sold` is the count of occupied room nights sold

### RevPAR (Revenue per Available Room)
- `RevPAR = total_room_revenue / total_available_rooms`

This should use the same business day definition as the audit and room inventory schedule.

## Duplicate financial entry prevention

The repo already has a strong pattern of storing rows with IDs and `created_at` timestamps. Stay financial records must enforce more:

- `idempotency_key` per payment or refund request
- unique triplicate guard on invoice number, refund number and payment number
- a payment row cannot be duplicated when the same `client_request_id` or same `reference_number` is retried
- folio entries must not be inserted without a valid `stay_id` and `folio_id`
- any financial mutation must pass a ledger validation before commit

## Reuse of existing accounting objects

### Potential reuse

Existing `ledger_transactions` is a good match for the concept of a generic internal accounting row, but only if it is segregated by a distinct `financial_domain` and `entity_type`.

Recommended usage:
- `financial_domain = 'stay'`
- `entity_type = 'stay_folio' | 'stay_payment' | 'refund' | 'night_audit'`
- `party_type = 'guest' | 'payer' | 'room' | 'cash'` 

### Not to reuse directly as-is

Using the generic `sales` table or restaurant sales accounts for accommodation would create a mixed-accounting model. This must not happen. The Appetite: keep Stay ledger entries separate from Restaurant sales, cash register shift logic, and product-level inventory transactions.

## Night audit process

Night audit should run after checkout and before daily close.

Sequence:
1. open `night_audit_sessions`
2. collect all folio entries since last close
3. reconcile room charges, taxes, payments and refunds
4. verify cash and card settlement totals
5. lock the business day
6. generate final summaries and bring the next day into open state

Any variance becomes a separate audit reconciliation record.

## Recommendation summary

- Create a distinct Stay ledger domain.
- Keep folio entries immutable and append-only.
- Separate room charges from restaurant sales.
- Use `stay_payments` + `payment_allocations` for all split-payment logic.
- Keep cash reconciliation in `night_audit_sessions` and `night_audit_reconciliations`.
- Calculate ADR/RevPAR from room charge revenue, not from all ancillary or restaurant flows.
- Add strict idempotency and business-day reconciliation before final settlement.

## Finalized financial truth and conventions (2026-11-16)

### Decision
The authoritative source of financial truth for Stay is the folio ledger, not the payment list or invoice summary alone. Every financial operation produces an auditable ledger entry and must be idempotent.

### Reason
This line is necessary to avoid duplicate accounting when payments are retried, refunds are processed, room charges are posted, and invoice corrections are issued.

### Alternatives considered
- Using invoice totals as source of truth only: rejected because invoice totals are derived and not sufficiently granular.
- Using payment summary as source of truth only: rejected because it ignores room charges, tax and refunds.
- Mixing restaurant `sales` records into lodging: rejected because it destroys account separation.

### Risks
- ledger entry duplication if idempotency keys are weak
- balance drift if allocation rules are not consistent
- overposting when multiple payers share one folio

### Testing implications
- validate posted charge + payment + refund balances
- validate invoice correction creates delta entries rather than overwriting original
- validate retries return the same object and same ledger posting
- validate cash variance is recorded separately from folio entries

### Financial conventions
- Monetary values are integer paise.
- `folio_entries` are the authoritative posting rows.
- `stay_payments` capture tender method and payer, but do not replace ledger posting.
- `payment_allocations` map a payment to one or more folio entries.
- `invoices` are derived summaries, not the source of ledger truth.
- `refunds` create a negative folio entry and associated payment reversal record.
- `credit_memos` represent corrected or adjusted invoice deltas.

### Balance calculation
`folio_balance_paise = opening_balance_paise + posted_charges_paise + posted_taxes_paise + adjustments_paise - payments_applied_paise - refunds_paise`

Where:
- positive amounts are debit increases in folio exposure
- negative amounts are credits or reductions in folio exposure
- `payment_allocations` allocate actual cash/card/UPI values to specific charge items
- outstanding balance is `max(folio_balance_paise, 0)` if the business uses accrual tracking for unpaid amounts

### Payment and payer rules
- Multiple payers are represented by `payers` + `payer_links`.
- Split payments are recorded as multiple `stay_payments` rows and mapped to `payment_allocations`.
- A single payment can be allocated across room charges, taxes and ancillary charges.
- Payment reversals must produce reversal entries, never silent overwrite.

### Invoice correction rules
- invoice correction creates new `folio_entries` or `credit_memos`, not mutation of the original invoice total
- original invoice remains immutable and auditable
- corrected version references original invoice for traceability

### Cash reconciliation
- cash variance stays in `night_audit_reconciliations` and `night_audit_sessions`
- separate from folio and stay payments
- a shortfall or overage is recorded as a variance entry, never as a silent manual change to a folio payment

## Unresolved decisions

- Whether a single `cash_registers` record can be reused for Stay cash counts under a lodging domain tag or whether lodging cash should use a completely separate cash account model.
- Whether the app will issue tax-inclusive or tax-exclusive folio invoice lines by default.
- Whether fees for certain ancillaries should be treated as room revenue or service revenue for ADR purposes.
