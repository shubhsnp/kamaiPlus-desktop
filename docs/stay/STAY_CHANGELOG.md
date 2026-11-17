# KAMAI PLUS STAY — MASTER CHANGELOG

**Product:** Kamai Plus Stay (लॉज आणि हॉटेल व्यवस्थापन प्रणाली)  
**Authority:** Permanent CTO & Lead Architect  
**Last Updated:** November 2026  

---

## [1.2.0] — CTO Master Release: Financial & Payment Completeness (2026-11-17)

### Added
- **Advance Deposit Receipt Generation:** Implemented `PaymentReceiptModal.tsx` rendering official deposit receipts immediately upon collecting an advance in `NewBookingDialog`.
- **WhatsApp Receipt Sharing Integration:** Created `WhatsAppShareDialog.tsx` enabling 1-click dispatch of formatted bilingual (`mr` & `en`) payment summaries to guests via WhatsApp Web/App (`https://wa.me/`).
- **Thermal 80mm & Standard A4 Format Toggle:** Added instant layout toggle to both `PaymentReceiptModal.tsx` and `FinalReceipt.tsx` for thermal point-of-sale receipt printers.
- **Refund Management System:** Built `IssueRefundDialog.tsx` supporting full/partial refunds with mandatory reason tracking, method selection, negative ledger postings, and dedicated refund receipt generation.
- **Individual Payment Actions in Folio:** Added 1-click `🖨️ Receipt` and `💬 WhatsApp` action buttons to each payment row in `FolioView.tsx`.
- **Permanent CTO Documentation Suite:** Authoring and consolidation of 17 master architectural, UX, financial, and testing documents.

### Fixed
- Fixed `FolioView.tsx` missing refund trigger and receipt access.
- Fixed `RecordPaymentDialog.tsx` closing silently without offering receipt printing or WhatsApp sharing.
- Enhanced `FinalReceipt.tsx` with guest mobile phone lookup from database for WhatsApp dispatch.

---

## [1.1.0] — Master UX Redesign & Workflow Simplification (2026-11-17)

### Added
- **`StayDatePicker.tsx`:** Interactive calendar popup with Marathi weekday/month names and 1-click duration presets (`आज`, `उद्या`, `+2 रात्री`, `+3 रात्री`).
- **`StayTimePicker.tsx`:** 12-hour AM/PM hospitality time selector with hour/minute grid and standard check-in/out presets.
- **`RoomCategorySelector.tsx`:** Visual card-based category picker showing rack rates, live room vacancy badges, and 1-click default category auto-seeder.
- **`StayStatusBadge.tsx`:** Standardized semantic status badges with Marathi text.
- **Contextual Actions on Room Rack:** Direct `+ चेक-इन`, `बिल व चेक-आउट`, and `✓ सफाई झाली` action buttons on room cards.

### Fixed
- **Room Category Selection Error:** Resolved asynchronous state desynchronization bug where form reported *"No category selected"*.
- **4-Step Wizard Reduction:** Consolidated walk-in check-in into single-modal `NewBookingDialog.tsx` (cutting clicks by 78%).
- **Checkout Wizard Simplification:** Streamlined into 2-step financial settlement and printable bill generation.
- **TypeScript Mismatches:** Standardized all 14 Stay components on `language`, fixed property types, achieving clean `npx tsc --noEmit` build with 0 errors.

---

## [1.0.0] — Phase 1 Foundation & Architecture (2026-11-16)

### Added
- IndexedDB database schema via Dexie (`rooms`, `stay_room_types`, `stay_bookings`, `stay_guests`, `stay_folios`, `stay_folio_entries`, `stay_payments`, `stay_housekeeping_tasks`, `stay_settings`).
- Domain repositories and services (`bookingService`, `availabilityService`, `financialService`).
- Strict integer paise accounting engine across all financial calculations.
- Clean isolation from Restaurant module.
