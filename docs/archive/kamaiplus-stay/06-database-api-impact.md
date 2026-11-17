# 06. Database and API Impact

## 6.1 Current database model

The current workspace confirms a local-first Dexie database with tables such as:

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

This is defined at `src/lib/db/index.ts` and the cloud contract model is defined in `src/lib/cloud/cloudContract.ts`.

## 6.2 Reusable tables

The following tables can be retained and extended:

- `businesses` — keep business identity and vertical metadata
- `customers` — guest records may be a subtype of customer or new guest entity
- `products` — can model room add-ons, amenities, and service catalog items
- `categories` — room service / amenities categories
- `ledger_transactions` — keep stay balances and settlement transactions
- `sales` — for room charges, room service, and billing jobs
- `cash_registers` and `cash_expenses` — still valid for stay operations
- `audit_logs` — still appropriate

## 6.3 New tables required

The following should be added for a full Stay vertical:

- `rooms`
- `room_types`
- `room_tariffs`
- `bookings`
- `booking_guests`
- `check_ins`
- `check_outs`
- `stays`
- `stay_charges`
- `stay_payments`
- `occupancy_history`
- `housekeeping_tasks`
- `room_service_orders`
- `booking_events`

## 6.4 Data isolation strategies

Recommended isolation approach:

- all Stay data remains scoped under the same `business_id`
- each room and booking references a `business_id` and `guest_id` / `customer_id`
- separate collection names keep Stay entities isolated from retail tables
- maintain a `vertical` field at the business and record level
- use query filters by `business_id` + `vertical` + `status`

This avoids data leakage between retail and Stay while still sharing business identity and reporting infrastructure.

## 6.5 API impact

There are no backend API routes in this repo. The app uses a local-only model with optional Firebase cloud operations. That means a Stay implementation would require new API-style or sync-layer endpoints in the same cloud abstraction layer, not a brand-new server stack unless the project later adds one.

### Likely new API/sync operations

- `createRoom`
- `updateRoomStatus`
- `createBooking`
- `checkInGuest`
- `checkOutGuest`
- `addStayCharge`
- `addStayPayment`
- `fetchRoomAvailability`
- `fetchOccupancySummary`
- `getStayLedger`
- `toggleStayModule`

## 6.6 Versioning and compatibility

Because the current stack has no server API versioning layer in this repo, versioning will need to happen at the business-config and cloud-schema level.

Recommended approach:

- keep `schema_version` on every new Stay table
- keep `business_vertical_version` at the business profile level
- use merge-safe update logic for cloud write operations
- avoid destructive migrations during production rollout

## 6.7 Migration strategy

The instructions explicitly forbid executing migrations. The recommended plan is:

1. add new tables in a forward-compatible way
2. keep legacy retail tables intact
3. add a migration ledger and audit trail
4. backfill new Stay records only when a shop opts in
5. validate data after enablement without touching existing restaurant or retail records

## 6.8 Compatibility concerns

- no change to the retail sales table structure unless an additional Stay charge model is required
- no change to existing customer and stock data without a backward-safe mapping
- no route or screen assumptions should assume `restaurant` or `retail` behavior forever

## 6.9 Performance implications

Stay adds more temporal and occupancy-related queries, including room availability checks and daily occupancy summaries. The current local-first design is favorable, but the app should avoid large in-memory scans by adding indexes such as:

- `business_id + room_id + status`
- `business_id + check_in_date`
- `business_id + checkout_date`
- `business_id + room_status`
- `business_id + guest_id + status`

## Conclusion

The database layer can support a Stay vertical, but it needs extra collections and more precise indexing. The API impact is moderate because no server route layer exists in this repo; the project instead relies on a cloud contract abstraction and optional Firebase sync. The safest integration is to add Stay-specific storage and sync models without disturbing the existing retail and restaurant data model.
