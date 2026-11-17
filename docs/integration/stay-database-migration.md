# KAMAI STAY — DATABASE MIGRATION SPECIFICATION

**Document:** `docs/integration/stay-database-migration.md`  
**Database Engine:** IndexedDB (via Dexie.js v4)  
**Schema Target:** `src/lib/db/index.ts`  
**Last Updated:** November 2026  

---

## 1. Migration Overview

In Dexie.js, database evolution is managed via sequential `db.version(x).stores(...)` declarations.
Adding the Stay module requires **additive schema declarations only**.
No existing tables or records in the user's database are migrated, altered, or deleted.

---

## 2. Upstream Schema Diff (`src/lib/db/index.ts`)

### Additive Store Definitions:
```typescript
// Append the following stores to the active Dexie database version:
rooms: 'id, business_id, room_type_id, number, floor, status, is_active',
stay_room_types: 'id, business_id, name, code, is_active',
stay_bookings: 'id, business_id, booking_reference, room_id, room_type_id, primary_guest_id, status, check_in_date, check_out_date',
stay_guests: 'id, business_id, phone, name',
stay_folios: 'id, business_id, booking_id, status',
stay_folio_entries: 'id, business_id, folio_id, entry_type, entry_date',
stay_payments: 'id, business_id, folio_id, booking_id, payment_method, paid_at',
stay_housekeeping_tasks: 'id, business_id, room_id, status, assigned_to',
stay_settings: 'id, business_id'
```

---

## 3. Backward Compatibility & Rollback Safety

1. **Non-Destructive Execution:**
   - Existing restaurant tables (`tables`, `orders`, `order_items`, `menu_items`) are untouched.
   - Existing retail tables (`products`, `customers`, `sales`, `cash_registers`) are untouched.
2. **Fresh Installation Auto-Seeding:**
   - On clean databases where no room categories exist, `RoomCategorySelector.tsx` provides an inline 1-click **"मानक कॅटेगरी तयार करा (Create Default Categories)"** seeder.
   - Ensures front-desk operators are never blocked by empty dropdown states.
3. **Rollback Strategy:**
   - If Stay is disabled or removed in a future release, the 9 Stay tables simply remain dormant in IndexedDB with zero impact on POS billing or dining operations.
