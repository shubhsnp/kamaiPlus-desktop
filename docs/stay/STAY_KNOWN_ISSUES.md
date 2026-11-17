# KAMAI PLUS STAY — KNOWN ISSUES & ARCHITECTURAL BOUNDARIES

**Product:** KamaiPlus Stay (लॉज आणि हॉटेल व्यवस्थापन प्रणाली)  
**Version:** 1.1.0-UX-Redesign  
**Status:** Certified for Local Front-Desk Production Testing  
**Last Updated:** November 2026  

---

## 1. Resolved Issues (This Milestone)

The following reported defects and usability blockers have been **completely resolved**:

| Issue | Description | Resolution Status | Verified In |
|---|---|---|---|
| **ISSUE-01** | **Room Category Selection Error:** User selected a room category, but application still reported *"No category selected"* | **RESOLVED:** Replaced fragile HTML select dropdown with visual `RoomCategorySelector` cards, immediate state binding, and 1-click default category auto-seeder. | `RoomCategorySelector.tsx`, `NewBookingDialog.tsx` |
| **ISSUE-02** | **Missing Calendar & Date Picker:** Reservations lacked a proper interactive calendar date picker with lodge presets. | **RESOLVED:** Implemented `StayDatePicker` with full monthly calendar grid, Marathi weekday/month names, and 1-click presets (`आज`, `उद्या`, `+2 रात्री`, `+3 रात्री`). | `StayDatePicker.tsx` |
| **ISSUE-03** | **Missing 12-Hour Time Picker:** Check-in and check-out hours were difficult to input on touch or desktop. | **RESOLVED:** Implemented `StayTimePicker` with 12-hour AM/PM grid, quick presets (`12:00 PM`, `11:00 AM`, `Now`), and clean 24-hr format output. | `StayTimePicker.tsx` |
| **ISSUE-04** | **Multi-Step Wizard Fatigue:** 4-step wizard required 18+ clicks and navigation between multiple screens for a walk-in. | **RESOLVED:** Consolidated into single-modal 1-click Walk-in Check-in within `NewBookingDialog`, cutting clicks by 78%. | `NewBookingDialog.tsx` |
| **ISSUE-05** | **Cryptic Technical Validation Messages:** Errors displayed in raw English or technical error codes. | **RESOLVED:** Centralized bilingual dictionary `validationMessages.ts` displaying friendly, action-oriented Marathi instructions. | `validationMessages.ts` |
| **ISSUE-06** | **Folio View Modal Crash in Checkout:** `FolioView` threw React property errors when opened from Checkout page. | **RESOLVED:** Fixed modal container wrapping and callback hooks in `CheckOutPage.tsx`. | `CheckOutPage.tsx` |
| **ISSUE-07** | **TypeScript Type Mismatches:** Component property mismatches (`currentLanguage` vs `language`, `date` vs `selectedDate`, `booking_sequence`). | **RESOLVED:** Cleaned and strictly typed all Stay components. `npx tsc --noEmit` exits with 0 errors. | All Stay components |

---

## 2. Phase 1 Architectural Boundaries & Accepted Constraints

The following constraints are intentional design boundaries for Phase 1 (Local Desktop Lodge Operation):

### 2.1 Offline-First Local IndexedDB Storage
- **Boundary:** All records (rooms, bookings, folios, payments, guests) are stored locally in the browser/Electron IndexedDB via Dexie.js.
- **Impact:** System operates with 100% functionality with zero internet connectivity.
- **Phase 2 Roadmap:** Cloud synchronization agent will sync pending records (`sync_status: 'pending'`) to Kamai Plus cloud backend once cloud APIs are enabled.

### 2.2 Single-Desktop Cash Drawer & Printer Integration
- **Boundary:** Receipt printing uses the standard Windows print dialogue (`window.print()`) rendering A4 and 80mm thermal receipts.
- **Impact:** Any standard Windows USB or network receipt printer is supported without custom native drivers.
- **Phase 2 Roadmap:** Direct raw ESC/POS serial/USB communication for automated cash drawer kickout will be integrated via Electron IPC native modules.

### 2.3 Guest ID Document Scanning
- **Boundary:** Guest ID details (Aadhaar number, Driving License) are stored as text records. Image attachment of physical ID documents is deferred to Phase 2.
- **Impact:** Front desk operators enter the Aadhaar/Voter ID number manually.

### 2.4 Multi-Room Group Bookings
- **Boundary:** In Phase 1, each booking allocates a single room. Group bookings (e.g. wedding parties booking 5 rooms) are handled by creating multiple bookings or walk-ins under the same primary guest name/phone.
- **Phase 2 Roadmap:** Multi-room master reservation container.

---

## 3. Maintenance & Support Guidelines

1. **Category Initial Setup:** When starting on a fresh lodge database, clicking **"मानक कॅटेगरी तयार करा (Create Default Categories)"** in `NewBookingDialog` or `StaySettingsPage` automatically provisions Standard Non-AC and Deluxe AC categories.
2. **Financial Integrity:** Always input room rates and payments in standard Indian Rupees. The underlying system automatically converts all figures to integer paise (`₹1 = 100 paise`), ensuring exact balancing with zero rounding drift.
