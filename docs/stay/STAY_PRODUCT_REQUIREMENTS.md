# KAMAI PLUS STAY — PRODUCT REQUIREMENTS DOCUMENT (PRD)

**Product:** Kamai Plus Stay  
**Version:** 1.2.0  
**Authority:** Permanent CTO & Lead Product Manager  
**Target Market:** Indian Lodges, Budget Hotels, Guest Houses, Family-run Accommodations  
**Last Updated:** November 2026  

---

## 1. Product Vision & Mission

Kamai Plus Stay is designed to be **the easiest hotel and lodge management system to operate in India**.
It replaces paper registers, physical notebooks, and complex legacy software with an intuitive, Marathi-first desktop application that runs offline and requires zero technical training.

### Core Priorities (in order):
1. **Simplicity:** Minimum clicks, minimum typing, maximum clarity.
2. **Reliability:** 100% offline-first execution via local IndexedDB.
3. **Financial Accuracy:** Integer paise accounting with zero rounding drift.
4. **Operational Efficiency:** Walk-in check-in completed in under 45 seconds.
5. **Data Integrity:** Isolated schema, zero regression in Restaurant module.
6. **Security & Privacy:** Scoped business multi-tenancy, safe input sanitization.

---

## 2. User Personas

| Persona | Role | Environment | Key Pain Points |
|---|---|---|---|
| **Ramesh (Lodge Owner)** | Owner / General Manager | 15-room highway lodge, semi-urban Maharashtra | Missing money records, manual tariff math mistakes, staff theft risks. |
| **Pravin (Receptionist)** | Front-desk operator | Rotating shifts, basic smartphone user | Fast check-in required when guest arrives tired at 11 PM; hates complex multi-screen wizards. |
| **Sunita (Housekeeper)** | Room cleaning staff | Non-English speaker | Needs to know which room is vacant and needs cleaning without shouting across corridors. |

---

## 3. Functional Requirements by Module

### 3.1 Room Rack & Availability
- Visual card grid displaying room numbers, floor, room category, and current status.
- Real-time room status badges:
  - `Available (उपलब्ध)`: Green
  - `Occupied (पाहुणे आहेत)`: Red
  - `Cleaning (सफाई आवश्यक)`: Amber
  - `Maintenance (दुरुस्ती सुरू)`: Slate
- Direct 1-click contextual actions from room cards:
  - `+ चेक-इन (Quick Check-in)` on available rooms.
  - `बिल व चेक-आउट (Bill & Checkout)` on occupied rooms.
  - `✓ सफाई झाली (Mark Cleaned)` on cleaning rooms.

### 3.2 Walk-in & Reservation Management
- **Unified Dual-Mode Dialog:** Fast toggle between Walk-in (immediate check-in) and Advance Reservation.
- **Smart Date Picker:** 1-click presets (`आज`, `उद्या`, `+2 रात्री`, `+3 रात्री`) with automatic nights calculation.
- **Smart Time Picker:** 12-hour AM/PM grid with standard check-in (`12:00 PM`) and check-out (`11:00 AM`) presets.
- **Visual Category Picker:** Cards with rack rates and live room counts; auto-seeding on fresh installs.
- **Guest Autocomplete:** 10-digit mobile lookup instantly fills returning guest records.

### 3.3 Financial Management & Payments
- **Integer Paise Storage:** All rates, charges, and balances calculated as integer paise.
- **Multi-Method Support:** Cash, UPI (with UTR reference), Card, and Bank Transfer.
- **Advance Deposits:** Optional deposit collection during booking with instant receipt generation.
- **Partial Payments:** Multiple payment entries recorded against a single stay folio.
- **Refunds:** Explicit refund records with mandatory reasons and negative ledger postings.
- **Receipts:** Dual-format printing (Standard A4 and 80mm Thermal) and 1-click WhatsApp transmission.

### 3.4 Housekeeping
- Dedicated board grouping rooms by status (`सर्व`, `सफाई आवश्यक`, `सफाई सुरू`, `तयार`).
- 1-click status transitions.
- Automatic handoff to `cleaning` immediately upon guest checkout.

### 3.5 Reports & Daily Reconciliation
- Daily collection report itemizing cash, UPI, card, advance, and net collections.
- Occupancy reports calculating room nights sold and occupancy percentage.
