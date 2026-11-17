# Changelog

All notable changes to the **Kamai Plus Desktop** application are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [4.189.0] - 2026-11-17

### Added
- **Kamai Plus Stay (Hospitality Module):** Complete lodge and hotel management vertical.
  - Interactive Room Rack with status badges (`Available`, `Occupied`, `Cleaning`, `Maintenance`).
  - 4-Click Quick Walk-in Check-in modal (`NewBookingDialog.tsx`).
  - Native calendar date picker with Marathi presets (`StayDatePicker.tsx`).
  - 12-hour AM/PM hospitality time selector (`StayTimePicker.tsx`).
  - Visual category selection cards with live room counts (`RoomCategorySelector.tsx`).
  - Advance Deposit Receipts and 2-step Checkout settlement (`PaymentReceiptModal.tsx`, `CheckOutWizard.tsx`).
  - Dual-format receipt printing (Standard A4 and 80mm Thermal POS).
  - 1-click WhatsApp receipt sharing (`WhatsAppShareDialog.tsx`).
  - Housekeeping turnover board with auto-transition on checkout (`HousekeepingBoard.tsx`).
  - Full refund issuance with audit reason tracking (`IssueRefundDialog.tsx`).
  - Daily collection and occupancy reports (`StayReportsPage.tsx`).
- **Offline Typography:** Bundled Plus Jakarta Sans & JetBrains Mono offline fonts across desktop app.

### Changed
- Streamlined project structure: Consolidated 50+ root Markdown documents into `docs/architecture/`, `docs/stay/`, and `docs/archive/`.
- Relocated retail vertical sample catalogs into `data/catalogs/`.
- Hardened production `.gitignore`.

### Fixed
- Fixed room category asynchronous selection desync bug.
- Fixed 4-step wizard fatigue by unifying walk-in check-in into a single modal.
- Fixed `FolioView` modal wrapping and prop types.
- Standardized all components on `language` prop; achieved clean `tsc --noEmit` build with 0 errors.

---

## [4.188.0] - 2026-11-10

### Added
- **Restaurant POS Enhancements:** Compact 44px cart layout.
- Added keyboard shortcuts (`F8`, `F9`, `F10`) for fast billing tender.
- Fixed WhatsApp navbar panel crop.

---

## [4.187.0] - 2026-11-05

### Added
- WhatsApp linked device indicator in top bar (green when linked, gray when offline).
- Automatic background bill dispatch from shop's own phone number.

---

## [4.186.0] - 2026-10-31

### Added
- Dedicated independent KOT printer configuration for restaurants.
- Persistent printer selection eliminating printer selection prompts during active billing.
