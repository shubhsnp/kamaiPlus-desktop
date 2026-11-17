# Kamai Plus Stay — Comprehensive UX Audit Report

**Date:** 2026-11-17  
**Author:** Combined Senior Engineering & Product Team  
**Scope:** Complete UX, workflow, form, navigation, and validation audit of Kamai Plus Stay  
**Target Users:** Indian lodge owners, budget hotel operators, and receptionists (often with limited computer literacy and Marathi/Hindi preference)

---

## 1. Executive Summary

A comprehensive, end-to-end audit of the Kamai Plus Stay desktop module was conducted across all screens, workflows, dialogs, forms, and service integrations.

While the data foundation and integer-paise financial model implemented in v0.1.0 were architecturally sound, the initial user interaction model exhibited several friction points, confusing interactions, and critical defects that prevented small lodge owners from operating the system comfortably.

All identified issues have been analyzed to their root causes and addressed with practical, accessible, touch-friendly solutions.

---

## 2. Comprehensive Behavior & Defect Matrix

| Area | Observed Behavior | Problem / Defect | Root Cause | Implemented Solution |
|---|---|---|---|---|
| **Room Category Selection** | Selecting a category in the dropdown still produced "Please choose a room category" or "No room category selected". | High severity blocker. User sees a category visually on screen, clicks continue, but is blocked by validation. | In controlled `<select value={selectedRoomTypeId}>`, when options loaded asynchronously and no empty placeholder was present, the browser visually rendered the first `<option>`, but React state remained `""`. Also, if 0 categories existed on a fresh install, the select was completely empty. | Created `RoomCategorySelector` with visual category cards/pills, synchronous state synchronization, and an inline 1-click **"Seed Standard Categories"** button to eliminate cold-start empty states. |
| **Date & Time Picker** | Reservation form used plain HTML `<input type="date">` without time pickers, calendar popup, or Marathi translations. | Confusing. Receptionists could not see calendar grids, pick standard hospitality hours (12:00 PM check-in / 11:00 AM check-out), or easily calculate stay duration. | Reliance on unstyled native browser inputs lacking custom hospitality controls. | Built custom `StayDatePicker` with month/year navigation, quick presets (Today, Tomorrow, +2 Nights, +3 Nights), past date restriction, and `StayTimePicker` with 12h AM/PM selector and standard presets. |
| **Reservation Workflow** | 3-step modal requiring guest registration in Step 1 before room availability or pricing could be inspected. | Unnatural mental model. When a walk-in guest asks "खोली रिकामी आहे का?", asking for their full name and phone before checking availability causes unnecessary clicks and customer delays. | Rigid multi-step wizard architecture. | Streamlined into a unified, direct reservation & walk-in screen with live rack rates, instant availability counters, and 1-click **"Check-in Guest Now"**. |
| **Check-in Workflow** | 5-step wizard (Mode → Guest → Room → Payment → Confirmation). | Excessive clicks (15+ clicks for a simple check-in). Receptionists at busy counters were overwhelmed. | Enterprise PMS over-engineering. | Reduced to a 2-step guided flow or direct 1-click check-in from dashboard arrivals and room cards. |
| **Check-out Workflow** | 4-step wizard (Review stay → Review bill → Collect payment → Confirmation). | At checkout when the guest is leaving with bags, 4 clicks through separate modal screens created frustrating friction. | Split steps across unnecessary screens. | Unified into a 2-step flow: Screen 1 shows Stay summary + itemized bill + settlement in one view; Screen 2 shows clean printable receipt with 1-click print. |
| **Navigation & Links** | Clicking "Folio" on Bookings page redirected the user to `/stay/reports`! | Functional disconnect. Navigated to general reports instead of opening the guest folio or checkout. | Placeholder navigation route in initial draft. | Fixed to open `CheckOutWizard` directly or display itemized `FolioView`. |
| **Housekeeping Board** | Hardcoded `default_business` instead of canonical business ID from `useBusiness()`. | Multi-tenant inconsistency. Rooms could fail to load if local business ID differed from `default_business`. | Inconsistent hook usage across modules. | Standardized on `useBusiness()` across all Stay components. Added 1-click "Mark Cleaned & Ready" action. |
| **Error Messages** | Technical English error messages ("category is required", "status transition invalid"). | Confusing to less-educated or Marathi-first staff. | Missing human-centered localization layer. | Created `STAY_MESSAGES` in `validationMessages.ts` providing warm, friendly bilingual (Marathi + English) explanations next to fields. |

---

## 3. Competitive UX Benchmark Analysis

| Product | Strengths Observed | Unnecessary Complexity | Kamai Plus Stay Approach |
|---|---|---|---|
| **eZee Absolute** | Comprehensive room rack grid. | Multi-tier corporate billing, GDS engine switches, overwhelming density. | Simplified visual room rack with 1-click status actions (Book, Check-in, Settle, Clean). |
| **Hotelogix** | Fast front-desk operations. | Cluttered forms with 25+ fields for simple walk-in reservations. | Maximum 5 essential fields for walk-in; rest optional or automated. |
| **Cloudbeds** | Clean modern aesthetic. | Requires high English proficiency and technical onboarding. | Native Marathi-first terminology with familiar Indian terms (पाहुणे, खोली क्रमांक, आगाऊ, बाकी). |
| **Physical Register** | Zero latency, familiar to all staff, no computer jargon. | No automatic bill math, double-booking risks, hard to audit collection. | Matches the speed of a register while automating tariff calculation, bill receipts, and conflict prevention. |
