# Kamai Plus Stay — Reservation UX Design Specification

---

## 1. Design Overview

The reservation modal (`NewBookingDialog.tsx`) is the central nerve center for lodge front-desk operations. It serves two distinct use cases with a single top tab toggle:

1. **Walk-in (चालत आलेले - Immediate Check-in)**:
   - For guests standing at the counter.
   - Requires room assignment.
   - Instantly creates the booking, creates an open folio, marks the room occupied, and generates a stay record.
2. **Advance Reservation (अ‍ॅडव्हान्स बुकिंग - Future Dates)**:
   - For phone or online bookings for future dates.
   - Room number assignment is optional (can assign at check-in).
   - Allows recording advance token payments.

---

## 2. Component Layout & Interaction Flow

```
┌────────────────────────────────────────────────────────┐
│  🏨 New Walk-in Check-in / Advance Reservation         │
├────────────────────────────────────────────────────────┤
│  [ 🟢 1. Walk-in (Immediate) ] [ 🟣 2. Advance (Future)]│
├────────────────────────────────────────────────────────┤
│  📅 STAY DURATION                                      │
│  Check-in Date:  [ 17 Nov 2026 (आज) ▾ ]  Time: [12:00 PM]│
│  Check-out Date: [ 19 Nov 2026 ▾ ]       Time: [11:00 AM]│
│  Duration: 2 Nights                                    │
├────────────────────────────────────────────────────────┤
│  🛏️ ROOM CATEGORY (Click to select)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Deluxe AC    │  │ Double NonAC │  │ Family AC    │  │
│  │ ₹1,800/n ✓   │  │ ₹1,200/n     │  │ ₹2,500/n     │  │
│  │ 3 free rooms │  │ 5 free rooms │  │ 1 free room  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                        │
│  Assign Room: [ Room 101 (Floor 1) ▾ ] Adults: [ 2 ]   │
├────────────────────────────────────────────────────────┤
│  👤 GUEST PROFILE                                      │
│  Mobile No: [ 9822012345 ] (Autofills if known)        │
│  Full Name: [ Rahul Patil               ]              │
├────────────────────────────────────────────────────────┤
│  💳 TARIFF & SETTLEMENT                                │
│  Rate/Night: [ ₹1,800 ]  Total Estimated: ₹3,600.00    │
│  Advance:    [ ₹500   ]  Mode: [ UPI / QR ▾ ]          │
├────────────────────────────────────────────────────────┤
│  [ Cancel ]              [ 🟢 Check-in Guest Now ]     │
└────────────────────────────────────────────────────────┘
```

---

## 3. Room Category Selection Fix Architecture

To guarantee the user never encounters the "No room category selected" bug:
1. **Visual Card Selection**: Each category is represented as a clickable card/pill button with its rack rate and available room count. Clicking a card immediately updates `selectedRoomTypeId`, `tariffRupees`, and clears any category validation errors.
2. **Cold-Start Auto-Seeding**: If a new lodge has zero categories in IndexedDB, an inline alert with a 1-click **"+ Seed Standard Categories"** button creates `Single Non-AC`, `Double Non-AC`, `Deluxe AC`, and `Family AC` within 500ms without leaving the dialog.
3. **Controlled Component Guarantee**: Form state always maintains a valid `selectedRoomTypeId` as long as categories exist in the database.
