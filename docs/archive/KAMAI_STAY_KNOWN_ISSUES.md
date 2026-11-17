# Kamai Plus Stay — Known Issues & Limitations

**Version:** Stay Module v0.1.0 (Local Dev Preview)  
**Date:** 2026-11-17  
**Environment:** Local development prototype — NOT production ready

> [!CAUTION]
> This document describes **by-design limitations** of the Phase 1 local dev implementation. None of these are bugs to be fixed immediately — they are accepted limitations of the current prototype scope. Each issue has a proposed resolution path.

---

## KI-001 — Multi-Device Booking Conflicts

| Field | Detail |
|-------|--------|
| **Severity** | High (in production) / Accepted (local dev) |
| **Component** | `availabilityService.ts`, `bookingRepository.ts` |
| **Description** | The availability check (`hasOverlappingBooking`) queries the **local Dexie/IndexedDB** only. If two devices are used simultaneously, both could book the same room for the same dates without conflict detection. |
| **By Design?** | Yes — this is a local-only prototype. Multi-device locking requires a backend booking lock. |
| **Code Warning** | `availabilityService.ts` contains JSDoc: `LOCAL CHECK ONLY - not a multi-device booking lock` |
| **Resolution Path** | Implement server-side booking lock via Cloud Functions + Firestore transaction in a future phase. |
| **Status** | ⚠️ Open — Accepted for Phase 1 |

---

## KI-002 — No Server-Side Validation of Bookings

| Field | Detail |
|-------|--------|
| **Severity** | High (in production) / Accepted (local dev) |
| **Component** | `bookingService.ts` |
| **Description** | All booking validation is client-side. There is no authoritative backend that validates or rejects bookings. A malformed or malicious client could create invalid booking records. |
| **By Design?** | Yes — backend unavailable in Phase 1. |
| **Resolution Path** | Cloud Functions to validate before committing to Firestore. |
| **Status** | ⚠️ Open — Accepted for Phase 1 |

---

## KI-003 — No Real Admin Console Activation

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Component** | `stayActivation.ts` |
| **Description** | The Stay module is activated via `STAY_DEV_ENABLED = true` constant and `localStorage` flag. This is a developer-only mechanism. In production, activation should be controlled by the Admin Console backend (business-scoped, not device-local). |
| **By Design?** | Yes — Admin Console backend not available. |
| **Code Warning** | JSDoc in `stayActivation.ts`: `DEV ONLY - production activation requires Admin Console backend` |
| **Resolution Path** | Replace with Admin Console API call that sets and validates a business-scoped activation token. |
| **Status** | ⚠️ Open — Dev only |

---

## KI-004 — Offline Bookings Are Provisional

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Component** | `types.ts` (`Booking.is_provisional`), `bookingService.ts` |
| **Description** | Bookings created while offline are flagged `is_provisional: true`. They are not confirmed with any backend. If another device creates the same booking concurrently while offline, a conflict arises on sync. |
| **By Design?** | Yes — offline support is intentional; provisional flag is the agreed mechanism. |
| **Resolution Path** | Implement offline sync reconciliation strategy (last-write-wins vs. conflict queue). |
| **Status** | ⚠️ Open — Accepted provisional behavior |

---

## KI-005 — No Real Employee Authentication

| Field | Detail |
|-------|--------|
| **Severity** | High (in production) / Accepted (local dev) |
| **Component** | All stay services |
| **Description** | Stay operations are not scoped to an authenticated employee session. Any user of the app can perform any Stay action. There is no role-based access control (RBAC) on Stay features. |
| **By Design?** | Yes — employee auth is not implemented in Desktop yet. |
| **Resolution Path** | Integrate with employee auth service when available; scope Stay permissions to roles (front-desk, manager, housekeeping). |
| **Status** | ❌ Blocked — Employee auth service not available |

---

## KI-006 — GST / Tax Configuration Pending

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Component** | `financialService.ts`, `StaySettings` type |
| **Description** | GST and tax calculation rules have not been implemented. The `StaySettings` type includes a placeholder for tax configuration, but the financial service does not compute or apply GST to folios or bills. |
| **Pending** | Business rules confirmation required: GST slab, composition scheme, HSN/SAC code for lodging services. |
| **Resolution Path** | Once business rules are confirmed, implement `calculateGST(amountPaise, rate)` in `financialService.ts`. Add GST line items to folio entries. |
| **Status** | ❌ Blocked — Business rules not confirmed |

---

## KI-007 — Financial Calculations Use Integer Paise — Rounding Behavior

| Field | Detail |
|-------|--------|
| **Severity** | Low (by design) |
| **Component** | `financialService.ts`, all financial types |
| **Description** | All monetary values are stored and computed as **integer paise** (₹1 = 100 paise). This prevents floating-point precision errors but introduces rounding concerns for: percentage discounts, GST splits (CGST/SGST), and per-night proration of weekly/monthly rates. |
| **Rounding Rule** | Floor (round down) for discounts; round half-up for taxes. This must be confirmed with the business owner. |
| **Display** | UI converts paise to rupees: `₹${(paise / 100).toFixed(2)}`. |
| **Example** | ₹999 room rate for 3 nights = 99900 paise × 3 = 299700 paise = ₹2997.00 (exact, no rounding needed for whole-rupee rates). |
| **Edge Case** | 10% discount on ₹999 = 99.9 paise → rounds to 99 paise (₹0.99 discount, not ₹1.00). |
| **Resolution Path** | Document and confirm rounding rules with business; add rounding tests. |
| **Status** | ⚠️ Open — Rounding rule pending business confirmation |

---

## KI-008 — Restaurant Module Regression Risk

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Component** | `src/lib/db/index.ts`, `src/components/layout/Sidebar.tsx` |
| **Description** | The only two existing files modified are `db/index.ts` (new Dexie version) and `Sidebar.tsx` (new nav link). A Dexie version bump could cause issues if the migration is not clean. The Sidebar change could break layout if the Stay link is improperly conditionally rendered. |
| **Mitigation** | Dexie version incremented (not reset); only new tables added, no existing tables altered. Sidebar link gated by `isStayEnabled()` — hidden by default for non-Stay builds. |
| **Verification** | Run restaurant module smoke test after Stay implementation; verify all existing routes still function. |
| **Status** | ⚠️ Open — Must verify post-implementation |

---

## KI-009 — No Automated Tests in Phase 1

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Component** | All stay modules |
| **Description** | Phase 1 creates no automated unit or integration tests. All testing is manual UAT. |
| **Resolution Path** | Implement tests per `KAMAI_STAY_TEST_STRATEGY.md` in Phase 2. |
| **Status** | ⚠️ Open — Phase 2 |

---

## KI-010 — Booking Reference Uniqueness Not Guaranteed

| Field | Detail |
|-------|--------|
| **Severity** | Low (local dev) / Medium (production) |
| **Component** | `bookingService.ts` |
| **Description** | Booking reference format `STY-DDMM-NNNN` sequence counter is local to the device. Two devices could generate the same reference. |
| **Resolution Path** | Generate booking references server-side (or use UUID-based references in production). |
| **Status** | ⚠️ Open — Accepted for local dev |

---

## Summary Table

| ID | Issue | Severity | Status |
|----|-------|----------|--------|
| KI-001 | Multi-device booking conflicts | High | ⚠️ Accepted |
| KI-002 | No server-side booking validation | High | ⚠️ Accepted |
| KI-003 | No real Admin Console activation | Medium | ⚠️ Dev only |
| KI-004 | Offline bookings provisional | Medium | ⚠️ Accepted |
| KI-005 | No employee authentication | High | ❌ Blocked |
| KI-006 | GST/tax config pending | Medium | ❌ Blocked |
| KI-007 | Paise rounding behavior | Low | ⚠️ Rule pending |
| KI-008 | Restaurant regression risk | Medium | ⚠️ Must verify |
| KI-009 | No automated tests | Medium | ⚠️ Phase 2 |
| KI-010 | Booking reference uniqueness | Low | ⚠️ Accepted |
