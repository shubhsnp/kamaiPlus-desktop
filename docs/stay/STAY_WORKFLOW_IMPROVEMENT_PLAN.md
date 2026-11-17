# Kamai Plus Stay — Workflow Improvement Plan

**Date:** 2026-11-17  
**Guiding Principle:** *"Minimum clicks. Minimum typing. Maximum clarity. Zero unnecessary confusion."*

---

## 1. Core Front-Desk Operational Journey

A lodge receptionist's daily work follows a clear circular rhythm:

```
[Guest Arrives]
       ↓
[Check Availability & Tariff]  <-- 1 click on Dashboard or Room Rack
       ↓
[Record Guest & Room Key]     <-- Phone autofills returning guest name
       ↓
[Check-in Complete]           <-- Room turns Red (Occupied)
       ↓
[Stay & Service Posting]      <-- Optional extra services / food charges
       ↓
[Checkout & Settle]           <-- Clear bill: Charges - Advance = Balance Due
       ↓
[Print Tax Receipt]           <-- 1-click printable receipt
       ↓
[Room to Housekeeping]        <-- Room turns Blue (Cleaning)
       ↓
[Mark Cleaned]                <-- 1 click on Housekeeping Board
       ↓
[Room Available Again]        <-- Room turns Green (Available)
```

---

## 2. Click Reduction & Simplification Metrics

| Workflow | Old Clicks / Screens | Redesigned Clicks / Screens | Improvement |
|---|---|---|---|
| **Walk-in Check-in** | 12 clicks across 3-5 screens | **3-4 clicks on 1 unified dialog** | **67% reduction in clicks; 0 page switches** |
| **Room Status: Clean to Ready** | 4 clicks via dropdown menu | **1 click directly on Room Card / Board** | **75% reduction in clicks** |
| **Guest Checkout & Bill** | 8 clicks across 4 wizard steps | **2 clicks: Settle → Print** | **75% reduction in clicks** |
| **Arrival Check-in from List** | 5 clicks via full wizard | **1 click "Check-in" button** | **80% reduction in clicks** |

---

## 3. Contextual Action Guidelines

Every screen now presents actions directly within the operator's line of sight:

1. **On Available Room Card (Green)**:
   - Primary Action: `[+ Check-in]` (Opens walk-in modal pre-filled with this room)
   - Secondary: Status dropdown to set Maintenance if AC needs repair
2. **On Occupied Room Card (Red)**:
   - Primary Action: `[Bill & Checkout]` (Opens checkout & settlement modal for that room)
   - Secondary: View guest name
3. **On Cleaning Room Card (Sky Blue)**:
   - Primary Action: `[✓ Mark Cleaned]` (Immediately updates room to Available)
4. **On Today's Arrivals (Dashboard)**:
   - Direct `[Check-in]` button right on the row
5. **On Today's Departures (Dashboard)**:
   - Direct `[Bill & Checkout]` button right on the row
