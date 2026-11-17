# Kamai Plus Stay — Risk Register

**Version:** Stay Module v0.1.0 (Local Dev Preview)  
**Date:** 2026-11-17  
**Owner:** QA & Documentation Team

---

## Risk Matrix Summary

| Severity \ Probability | High | Medium | Low |
|-----------------------|------|--------|-----|
| **Critical / High**   | RSK-01 (Multi-Device Conflict) | RSK-04 (Employee Auth / RBAC) | RSK-02 (Data Loss on Crash) |
| **Medium**            | RSK-06 (Offline Sync Collision)| RSK-07 (Restaurant Regression)| RSK-03 (Paise Rounding Math)|
| **Low**               | — | RSK-05 (Admin Console Activation) | — |

---

## Risk Log

| Risk ID | Risk Description | Severity | Probability | Impact Area | Mitigation Strategy | Status |
|---------|------------------|----------|-------------|-------------|---------------------|--------|
| **RSK-01** | **Multi-device booking conflicts:** Multiple front desk terminals or mobile devices book the same room for the same date window without conflict detection. | **High** | **High** | Front Desk Operations, Guest Experience | Local checks warn that backend locking is required. Phase 2 introduces cloud reservation locking with Firestore distributed transactions. Bookings marked `is_provisional: true`. | ⚠️ Open (Accepted for local dev) |
| **RSK-02** | **Data integrity on abrupt power failure / crash:** Desktop application closes during Dexie transaction while generating folio or booking. | **High** | **Low** | Database Consistency | Use atomic Dexie transactions (`db.transaction('rw', [...])`) when mutating booking + room + folio in a single operation. | ✅ Mitigated by Design |
| **RSK-03** | **Paise math rounding & fractional tax mismatch:** Converting percentages (discounts, GST) to integer paise results in ±1 paise discrepancy across invoices. | **Medium** | **Low** | Accounting & Financial Reporting | Standardize on integer paise everywhere (`Math.round()` on percentage calculations). Maintain clear rounding audit trail in folio line items. | ✅ Mitigated by Design |
| **RSK-04** | **Missing employee authentication & audit logging:** Any workstation user can modify rates, delete bookings, or cancel bills without staff identification. | **High** | **Medium** | Fraud Prevention, Accountability | Introduce placeholder `staff_id` or `employee_name` in audit log schema. Block production release until central employee auth is integrated. | ❌ Open / Blocked |
| **RSK-05** | **Bypassable local feature activation:** Stay module is toggled via `localStorage` or dev flag instead of cryptographically signed enterprise license. | **Low** | **Medium** | Commercial Licensing | Document as local dev preview only. Production deployment must check backend license entitlements before rendering Stay module routes. | ⚠️ Open (Dev Only) |
| **RSK-06** | **Offline synchronization conflicts:** Bookings created offline overwrite cloud records during reconnect sync. | **Medium** | **High** | Sync Engine | Flag all offline records with `is_provisional: true` and `created_at` timestamp. Cloud sync must resolve conflicts via server-side reconciliation rules. | ⚠️ Open (Phase 2) |
| **RSK-07** | **Restaurant module regression:** Dexie database upgrade or layout changes inadvertently break Restaurant POS, KOT printing, or table ordering. | **Medium** | **Low** | Restaurant POS Operations | Additive Dexie schema version increment only (no alterations to existing tables). Strict isolation of Stay routes and components. Pre-release regression smoke test. | ✅ Mitigated & Monitored |

---

## Contingency Plans

1. **If Dexie Schema Migration Fails:**
   - Database rollback script or Dexie error handler prompts user to backup data before reloading previous version schema.
2. **If Restaurant POS Encounters Regressions:**
   - Gating `STAY_DEV_ENABLED = false` immediately restores original sidebar and unloads Stay modules without altering restaurant data.
