# Kamai Plus Stay — Changelog

All notable changes to the Stay module are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

> [!WARNING]
> **Local development prototype — NOT production ready.**  
> This version is a local dev preview. No production deployment, no backend integration, no multi-device support.

---

## [Stay Module v0.1.0] — 2026-11-17 (Local Dev Preview)

### Session: Foundation + Core UI Implementation (Swarm Build)

**Build method:** Parallel swarm build — 4 agents (`architect`, `ui-builder`, `folio-builder`, `docs-qa`)  
**TypeScript check:** `tsc --noEmit` passed cleanly with **0 errors**.

---

### Added — Foundation Layer (`src/lib/stay/`)

| File | Description |
|------|-------------|
| `src/lib/stay/stayActivation.ts` | Dev-only feature flag; `STAY_DEV_ENABLED`, `isStayEnabled()`, `useStayEnabled()`, `setStayDevEnabled()` |
| `src/lib/stay/types.ts` | Complete TypeScript domain models — RoomStatus, BookingStatus, RoomType, Room, Guest, Booking, StayRecord, Folio, FolioEntry, StayPayment, HousekeepingTask, StaySettings, StayAuditLog |
| `src/lib/stay/validation.ts` | Input validation functions returning `{valid: boolean, errors: string[]}` |
| `src/lib/stay/index.ts` | Public API barrel — re-exports all stay module types and functions |

#### Repository Layer

| File | Description |
|------|-------------|
| `src/lib/stay/repositories/roomTypeRepository.ts` | CRUD for `room_types` Dexie table |
| `src/lib/stay/repositories/roomRepository.ts` | CRUD for `rooms` Dexie table with status filtering |
| `src/lib/stay/repositories/guestRepository.ts` | CRUD for `stay_guests` Dexie table |
| `src/lib/stay/repositories/bookingRepository.ts` | CRUD for `stay_bookings` Dexie table with overlap queries |
| `src/lib/stay/repositories/folioRepository.ts` | CRUD for `stay_folios` and `stay_folio_entries` |

#### Service Layer

| File | Description |
|------|-------------|
| `src/lib/stay/services/availabilityService.ts` | `calculateNights()`, `hasOverlappingBooking()` — LOCAL CHECK ONLY |
| `src/lib/stay/services/bookingService.ts` | Full booking lifecycle: `createReservation`, `confirmReservation`, `cancelReservation`, `checkIn`, `checkOut` |
| `src/lib/stay/services/financialService.ts` | Folio management: `postRoomCharge`, `postAdditionalCharge`, `postDiscount`, `recordPayment`, `calculateFolioBalance`, `generateFinalBillSummary` |

---

### Added — UI Layer (`src/components/stay/` and `src/app/stay/`)

#### Dashboard & Layout

| File | Description |
|------|-------------|
| `src/components/stay/StayModule.tsx` | Stay module shell with top-level navigation tabs |
| `src/components/stay/dashboard/StayDashboard.tsx` | Dashboard with occupancy rates, today's arrivals/departures, quick actions |
| `src/app/stay/page.tsx` | Root Stay dashboard route |

#### Rooms Management

| File | Description |
|------|-------------|
| `src/components/stay/rooms/RoomsPage.tsx` | Room grid view, floor filter, status management |
| `src/components/stay/rooms/RoomCard.tsx` | Individual room card with quick status actions |
| `src/components/stay/rooms/AddRoomDialog.tsx` | Dialog for creating rooms |
| `src/components/stay/rooms/AddRoomTypeDialog.tsx` | Dialog for creating room types with base rates |
| `src/app/stay/rooms/page.tsx` | Rooms route |

#### Bookings & Front Desk

| File | Description |
|------|-------------|
| `src/components/stay/bookings/BookingsPage.tsx` | Reservation list with status tabs and search |
| `src/components/stay/bookings/NewBookingDialog.tsx` | Walk-in and advance reservation modal |
| `src/components/stay/guests/GuestSearchInput.tsx` | Guest lookup autocomplete input |
| `src/app/stay/bookings/page.tsx` | Bookings route |

#### Check-In

| File | Description |
|------|-------------|
| `src/components/stay/checkin/CheckInPage.tsx` | Arrivals page with pending check-in list |
| `src/components/stay/checkin/CheckInWizard.tsx` | Step-by-step guest registration and room assignment |
| `src/app/stay/checkin/page.tsx` | Check-in route |

#### Check-Out & Billing

| File | Description |
|------|-------------|
| `src/components/stay/checkout/CheckOutPage.tsx` | Departures page with departing guest list |
| `src/components/stay/checkout/CheckOutWizard.tsx` | Bill review, payments, room release |
| `src/components/stay/checkout/FinalReceipt.tsx` | Printable final bill receipt |
| `src/app/stay/checkout/page.tsx` | Check-out route |

#### Folio

| File | Description |
|------|-------------|
| `src/components/stay/folio/FolioView.tsx` | Itemized charges, payments, balance due |
| `src/components/stay/folio/AddChargeDialog.tsx` | Dialog to add extra charges to folio |
| `src/components/stay/folio/RecordPaymentDialog.tsx` | Dialog to record payments |

#### Housekeeping

| File | Description |
|------|-------------|
| `src/components/stay/housekeeping/HousekeepingBoard.tsx` | Kanban board for cleaning tasks |
| `src/components/stay/housekeeping/HousekeepingTaskCard.tsx` | Task card for room cleaning |
| `src/app/stay/housekeeping/page.tsx` | Housekeeping route |

#### Reports

| File | Description |
|------|-------------|
| `src/components/stay/reports/StayReportsPage.tsx` | Tabbed reports hub |
| `src/components/stay/reports/DailyCollectionReport.tsx` | Payment collection report by payment mode |
| `src/components/stay/reports/OccupancyReport.tsx` | Occupancy %, ADR, RevPAR metrics |
| `src/app/stay/reports/page.tsx` | Reports route |

#### Settings

| File | Description |
|------|-------------|
| `src/components/stay/settings/StaySettingsPage.tsx` | Check-in/out times, tax and policy settings |
| `src/app/stay/settings/page.tsx` | Settings route |

---

### Modified — Existing Files

| File | Change |
|------|--------|
| `src/lib/db/index.ts` | Incremented Dexie schema to version 5; added 11 Stay tables (`room_types`, `rooms`, `stay_guests`, `stay_bookings`, `stay_records`, `stay_folios`, `stay_folio_entries`, `stay_payments`, `stay_housekeeping`, `stay_settings`, `stay_audit_logs`) + Table declarations on `VyaparSetuDatabase` class |
| `src/components/layout/Sidebar.tsx` | Added Stay navigation group gated by `useStayEnabled()` |
| `src/locales/en.json` | Added Stay module localization keys |
| `src/locales/mr.json` | Added Stay module Marathi translations |

---

### Documentation Created (Workspace Root)

| File | Description |
|------|-------------|
| `KAMAI_STAY_IMPLEMENTATION_STATUS.md` | Implementation tracking per module |
| `KAMAI_STAY_CHANGELOG.md` | This changelog |
| `KAMAI_STAY_KNOWN_ISSUES.md` | Documented limitations and open issues |
| `KAMAI_STAY_TEST_STRATEGY.md` | Unit, integration, UAT, and regression test plan |
| `KAMAI_STAY_UAT_SCENARIOS.md` | 7 step-by-step UAT scenarios |
| `KAMAI_STAY_RISK_REGISTER.md` | Risk register with severity and mitigation |

---

## [Pre-Stay v0.0.0] — 2026-11-16

T0 readiness investigation. Documentation only. No application source changed.  
See `ACTIVE_TASK.md` and `CHANGELOG_AI_DEVELOPMENT.md` for details.
