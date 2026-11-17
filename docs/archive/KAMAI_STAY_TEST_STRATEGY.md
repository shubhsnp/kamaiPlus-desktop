# Kamai Plus Stay — Test Strategy

**Version:** Stay Module v0.1.0 (Local Dev Preview)  
**Date:** 2026-11-17  
**Scope:** Foundation, Data Persistence (Dexie), Services, UI Workflows, and Regression Protection

---

## 1. Executive Summary & Quality Objectives

The Stay module introduces lodging and property management features (rooms, bookings, check-in/out, folios, paise accounting) alongside the existing Restaurant POS system.
The quality goals for Stay v0.1.0 are:
1. **Mathematical Accuracy:** 100% precision in financial calculations via integer paise arithmetic (no floating point drift).
2. **Zero Regression:** Ensure Restaurant POS, Inventory, KOT, and Settings operate without interruption or database corruption.
3. **Robust State Transitions:** Strict lifecycle management for bookings (`enquiry` → `confirmed` → `checked_in` → `checked_out` / `cancelled`) and rooms (`available` → `occupied` → `cleaning` → `available`).
4. **Data Isolation:** All entities strictly keyed by `business_id`.

---

## 2. Test Pyramid & Coverage Plan

```
           / \
          /   \     UAT / Manual Scenarios (7 Core Flows)
         /-----\
        /   E2E \   Integration Flows (Dexie + Services + UI Panels)
       /---------\
      / Component \ Component Tests (React Testing Library / Mock Repos)
     /-------------\
    /   Unit Tests  \ Core Business Logic (availabilityService, financialService, validation)
   /-----------------\
```

### 2.1 Unit Test Coverage Plan

| Target Service / Function | Key Test Conditions & Edge Cases | Target Coverage |
|---------------------------|----------------------------------|-----------------|
| `availabilityService.calculateNights` | Same-day check-in/out (day use/0 or 1 night), multi-night standard, cross-month (Jan 31 - Feb 2), leap year (Feb 28 - Mar 1), invalid reverse dates (`checkIn > checkOut`). | 100% |
| `availabilityService.hasOverlappingBooking` | Exact match dates, partial overlap (ends during existing, starts during existing), enclosing booking, adjacent bookings (checkout date = next check-in date: must NOT conflict), excluded booking ID (self edit). | 100% |
| `financialService.postRoomCharge` | Base rate × nights in paise; 0 nights; positive integer validation. | 100% |
| `financialService.postAdditionalCharge` | Extra bedding, laundry, room service line items in paise; ensure correct entry type assignment. | 100% |
| `financialService.postDiscount` | Fixed paise discount vs percentage calculation; capping discount so balance does not drop below zero unless explicitly credited. | 100% |
| `financialService.recordPayment` | Advance payments, checkout payments, refund entries, multiple partial payments summing to total. | 100% |
| `financialService.calculateFolioBalance` | Sum(charges) - Sum(discounts) - Sum(payments) = outstanding balance. Zero balance check. | 100% |
| `validation.ts` | Mobile phone format (10 digits), guest name presence, valid date ranges, positive integer paise validation. | 100% |

---

## 3. Integration Test Plan

Integration tests verify Dexie database interactions, transaction atomicity, and service orchestration:

1. **Booking Lifecycle Integration:**
   - Create guest → Create booking → Verify `stay_bookings` record and `room.status = 'reserved'`.
   - Check-in booking → Create `stay_records` + `stay_folios` + initial room charge `stay_folio_entries` → Verify `room.status = 'occupied'`.
   - Post extra charge → Verify `stay_folio_entries` appended.
   - Record payment → Verify `stay_payments` entry and folio balance recalculated.
   - Checkout → Verify full payment required or balance verified → Set `stay_records.status = 'completed'`, `room.status = 'cleaning'`, `stay_folios.status = 'closed'`.

2. **Dexie Migration & Schema Integrity:**
   - Upgrade from previous Dexie schema version to new version.
   - Verify all 11 new tables exist with proper primary keys and secondary indices.
   - Verify existing restaurant data (`orders`, `kot`, `menu_items`, `customers`) remains intact and unmodified.

---

## 4. Negative & Boundary Test Cases

| Test Case ID | Test Category | Input / Action | Expected Result |
|--------------|---------------|----------------|-----------------|
| NEG-01 | Overlapping Booking | Attempt booking room 101 for Nov 20-22 when Nov 21-23 is confirmed | Rejected with error `Room already booked for selected dates` |
| NEG-02 | Inverted Dates | Check-in date: 2026-11-25, Check-out date: 2026-11-20 | Validation failure: `Check-out must be after check-in` |
| NEG-03 | Negative Money | Post charge with amount = -500 paise | Rejected by `validatePayment` / `postAdditionalCharge` |
| NEG-04 | Float Currency Input | Pass float `150.50` into paise functions | Schema / TypeScript type guard rejects; math functions require `Math.round` or throw integer assertion |
| NEG-05 | Checkout with Outstanding Balance | Attempt checkout without settling pending balance | UI warning / Confirmation modal required before proceeding |
| NEG-06 | Duplicate Room Number | Create room "101" when room "101" exists on same floor/property | Validation rejects duplicate room number |
| NEG-07 | Deactivating Occupied Room | Attempt to set room status to `out_of_service` while occupied | Action blocked until guest is checked out or moved |

---

## 5. Regression Test Plan (Restaurant & Desktop App)

Given that `src/lib/db/index.ts` and `src/components/layout/Sidebar.tsx` are updated:

1. **Restaurant POS Core Flows:**
   - Create Table Order / Dine-in order.
   - Generate KOT and print preview.
   - Complete checkout and bill settlement in Restaurant module.
   - Verify Dexie queries to `orders`, `order_items`, and `kot` return correct records.
2. **Sidebar Navigation:**
   - When `STAY_DEV_ENABLED = true`, verify "Stay" navigation item appears.
   - When `STAY_DEV_ENABLED = false` or feature switch off, verify "Stay" is completely hidden.
   - Verify switching between Restaurant POS, Inventory, and Stay views preserves in-memory states without app crash.
3. **App Boot & LocalStorage:**
   - Verify initial app startup loads Dexie DB without version mismatch exceptions.

---

## 6. Edge Cases & Temporal Tests

1. **Same-Day Check-In / Check-Out:**
   - Guest checks in at 10:00 AM and checks out at 6:00 PM same day.
   - Ensure nights calculation handles 0 nights or 1 minimum day charge per property policy.
2. **Month-End / Leap Year Transitions:**
   - Check-in: Feb 28, Check-out: Mar 2 (evaluates leap day in leap years or standard 2 nights).
   - Check-in: Dec 31, Check-out: Jan 2 (crosses calendar year boundary).
3. **Midnight Booking:**
   - Booking made at 23:58 for immediate check-in.
4. **Room Swapping Mid-Stay:**
   - Guest moves from Room 101 to Room 202 on Day 2 of a 4-day stay. Proration of charges between different room rates.

---

## 7. QA Acceptance Criteria for Swarm Delivery

- [ ] All 11 new tables created in Dexie DB schema.
- [ ] TypeScript compilation (`tsc --noEmit`) passes without errors.
- [ ] Clean isolation between Stay code (`src/lib/stay`, `src/components/stay`, `src/app/stay`) and legacy modules.
- [ ] Comprehensive documentation delivered in workspace root.
