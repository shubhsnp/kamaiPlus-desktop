# Kamai Plus Stay — User Acceptance Testing (UAT) Scenarios

**Version:** Stay Module v0.1.0 (Local Dev Preview)  
**Date:** 2026-11-17  
**Scope:** Manual Verification and End-to-End Test Scripts for Front Desk & Lodge Operations

---

## Pre-requisites & Test Setup
Before executing these scenarios:
1. Ensure the app is running in dev mode with `STAY_DEV_ENABLED = true` (`localStorage.setItem('kamai_stay_dev_enabled', 'true')`).
2. Navigate to **Stay > Setup**:
   - Create Room Type: "Deluxe AC" (Code: `DAC`, Base Rate: ₹1,500 / 150000 paise).
   - Create Room Type: "Standard Non-AC" (Code: `SNA`, Base Rate: ₹1,000 / 100000 paise).
   - Create Rooms: 101 (DAC, Floor 1), 102 (DAC, Floor 1), 201 (SNA, Floor 2), 202 (SNA, Floor 2), 203 (SNA, Floor 2).

---

## Scenario 1: Walk-In Guest Books 1 AC Room for 2 Nights, Pays Advance ₹500

### Objective
Verify walk-in booking creation, immediate check-in, advance deposit posting, and folio initialization.

### Step-by-Step Instructions
1. Navigate to **Stay > Bookings** (or Front Desk).
2. Click **New Booking** / **Walk-in**.
3. Select Room Type: **Deluxe AC**, Room: **101**.
4. Set Dates: Check-in = Today, Check-out = Today + 2 days (2 nights).
5. Enter Guest Details:
   - Name: `Ramesh Kumar`
   - Phone: `9876543210`
   - ID Type: `Aadhaar`, ID Number: `1234-5678-9012`
6. Enter Advance Payment:
   - Amount: `₹500` (50000 paise)
   - Method: `Cash`
7. Click **Confirm & Check In**.

### Expected Outputs
- Booking created with status `checked_in`.
- Room 101 status changes to `occupied`.
- Folio generated with:
  - Room charges: ₹3,000 (2 nights × ₹1,500).
  - Advance payment entry: -₹500 (Credit).
  - Net Balance Due: ₹2,500.
- Booking reference displayed (e.g., `STY-1711-0001`).

### What Can Go Wrong
- Advance payment fails to register in `stay_payments` / folio entries.
- Room status remains `available` or fails to update in Dexie.
- Nights calculation returns 1 or 3 instead of 2.

---

## Scenario 2: Advance Reservation for Future Date

### Objective
Verify advance room reservation without immediate check-in or room blocking for current date.

### Step-by-Step Instructions
1. Navigate to **Stay > Bookings > New Booking**.
2. Select Booking Type: **Advance Reservation**.
3. Set Dates: Check-in = 7 days from today, Check-out = 10 days from today (3 nights).
4. Room Type: **Standard Non-AC**, Room: **201**.
5. Guest: `Anita Sharma`, Phone: `9812345678`.
6. Advance Payment: ₹1,000 via `UPI` (Ref: `UPI998877`).
7. Click **Save Reservation**.

### Expected Outputs
- Booking created with status `confirmed`.
- Room 201 current status remains `available` (until the check-in date).
- Availability grid reflects Room 201 as reserved on selected future dates.
- Advance payment recorded under booking.

### What Can Go Wrong
- Future booking incorrectly marks Room 201 as `occupied` today.
- Booking status defaults to `checked_in` instead of `confirmed`.

---

## Scenario 3: Check-In, Add Extra Charge, Full Checkout

### Objective
Test adding intermediate folio charges (room service, extra bed) and full zero-balance settlement at checkout.

### Step-by-Step Instructions
1. Open the checked-in booking for Room 101 (`Ramesh Kumar`).
2. Navigate to **Folio Details**.
3. Click **Add Charge**:
   - Charge Type: `Additional / Room Service`
   - Description: `Extra Bed & Breakfast`
   - Amount: `₹350` (35000 paise)
4. Verify folio total updates to ₹3,350 total charges, ₹500 paid, ₹2,850 balance due.
5. Click **Process Check-Out**.
6. In Checkout Modal:
   - Enter Payment: ₹2,850 via `UPI`.
7. Click **Complete Check-Out & Generate Invoice**.

### Expected Outputs
- Folio status marked `closed` with balance `₹0.00`.
- Booking status updated to `checked_out`.
- Room 101 status transitions to `cleaning`.
- Final bill receipt generated with itemized summary.

### What Can Go Wrong
- Rounding discrepancy between rupee input and paise storage.
- System allows checkout without prompting for ₹2,850 balance.
- Room goes straight to `available` instead of `cleaning`.

---

## Scenario 4: Early Checkout

### Objective
Verify recalculation of room charges when a guest checks out earlier than planned.

### Step-by-Step Instructions
1. Check-in a guest into Room 102 for 4 nights (Base rate: ₹1,500/night, Total ₹6,000).
2. On Day 2, guest requests early checkout (actual stay: 1 night).
3. Open Check-Out Panel for Room 102.
4. Select **Early Checkout / Adjust Dates**:
   - Set new checkout date to today (1 night).
5. Review updated charges: ₹1,500 room charge.
6. Record payment for ₹1,500 and complete checkout.

### Expected Outputs
- Folio adjusted from 4 nights (₹6,000) to 1 night (₹1,500) or proration fee applied.
- Booking checkout date updated.
- Room marked `cleaning`.

### What Can Go Wrong
- System retains the original 4-night charge, overbilling guest.
- Booking record date mismatch causing DB query errors.

---

## Scenario 5: Room Change During Stay

### Objective
Handle mid-stay room upgrade or maintenance relocation.

### Step-by-Step Instructions
1. Guest is staying in Room 201 (Standard Non-AC @ ₹1,000/night).
2. Due to AC request, guest moves to Room 102 (Deluxe AC @ ₹1,500/night) for remaining nights.
3. In Booking Details, select **Change Room**:
   - Select Target Room: 102.
   - Choose whether rate changes to new room rate for remaining period.
4. Confirm change.

### Expected Outputs
- Room 201 status reverts to `cleaning`.
- Room 102 status becomes `occupied`.
- Booking record reflects new room assignment (or stay record split).
- Additional charge entry added for price differential if applicable.

### What Can Go Wrong
- Room 201 left in `occupied` state, locking both rooms.
- Previous charges erased or doubled.

---

## Scenario 6: Group Booking (3 Rooms, 1 Guest Party)

### Objective
Validate booking multiple rooms under a single coordinator contact.

### Step-by-Step Instructions
1. Go to **New Booking > Group / Multi-Room**.
2. Contact Name: `Vijay Traders Group`, Phone: `9900112233`.
3. Select Rooms: 101, 102, 202.
4. Dates: 2 nights for all rooms.
5. Advance Payment: ₹3,000 total.
6. Click **Confirm Group Reservation**.

### Expected Outputs
- Three distinct room reservations created sharing a group identifier or linked reference.
- Advance payment either split across folios or placed on a master folio.
- All three rooms marked `reserved` or `occupied`.

### What Can Go Wrong
- Single room ID constraint prevents multi-room assignment without creating 3 separate bookings.
- Master advance payment not credited to individual room bills.

---

## Scenario 7: Partial Payment, Balance at Checkout

### Objective
Ensure accurate multi-installment tracking and folio balance reconciliation.

### Step-by-Step Instructions
1. Check in Room 203 for 3 nights (₹3,000 total).
2. Day 1: Guest pays ₹1,000 cash.
3. Day 2: Guest pays ₹500 UPI.
4. Day 3 (Checkout): Outstanding balance should show ₹1,500.
5. Guest pays remaining ₹1,500 via Card.
6. Finalize checkout.

### Expected Outputs
- Folio displays 3 distinct payment transactions:
  - Payment 1: ₹1,000 (Cash)
  - Payment 2: ₹500 (UPI)
  - Payment 3: ₹1,500 (Card)
- Net balance computes to ₹0.00.
- Checkout completes successfully.

### What Can Go Wrong
- Cumulative balance computation calculates incorrectly from multiple payment entries.
- Payment method not captured properly per transaction.
