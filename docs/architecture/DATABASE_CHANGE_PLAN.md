# Database Change Plan

## Current state
The current database is defined in `src/lib/db/index.ts` and is strongly retail-focused. The tables are aligned to standard POS and business inventory flow, not lodging operations.

## Existing tables to retain
- `businesses`
- `categories`
- `products`
- `customers`
- `suppliers`
- `sales`
- `inventory_movements`
- `ledger_transactions`
- `cash_registers`
- `cash_expenses`
- `sales_returns`
- `marketing_templates`
- `audit_logs`
- `purchase_bills`

## New Stay tables required
Planned additions for the first viable Stay implementation:
- `rooms`
- `room_types`
- `room_tariffs`
- `bookings`
- `booking_guests`
- `stays`
- `stay_charges`
- `stay_payments`
- `check_ins`
- `check_outs`
- `occupancy_history`
- `housekeeping_tasks`
- `maintenance_requests`
- `lost_and_found`
- `night_audit_sessions`

## Recommended design principles
- keep all Stay records under the same `business_id`
- create a `module` or `vertical` field on Stay data
- add indexes for room status, guest, date, booking, and financial queries
- preserve existing restaurant and retail tables unchanged
- add merge-safe update logic and audit records for critical changes

## Recommended indexing examples
- `business_id + room_id + status`
- `business_id + booking_date`
- `business_id + check_in_date`
- `business_id + check_out_date`
- `business_id + guest_id + status`
- `business_id + updated_at`

## Safety rules
- do not mutate completed financial transactions silently
- do not merge Stay financial records into restaurant sales records
- do not reuse restaurant order tables for room and folio data without an explicit design approval
- keep room status consistent with booking, housekeeping, and maintenance records

## Database risk summary
The main risk is improper data mixing between restaurant and Stay operations, especially in financial records, customer data, and room occupancy state.

## Conclusion
The repo can support Stay via a backward-compatible extension of the existing local-first database, but the Stay domain requires a new set of tables and explicit data isolation rules.
