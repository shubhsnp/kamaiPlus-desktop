# Kamai Plus Stay — Phase 1 Open Decisions

**Status:** Decision log for planning; no implementation performed  
**Purpose:** Identify choices that must be resolved before Phase 1 work can be safely authorized.

## 1. Confirmed repository findings

- The Desktop has an Admin remote-control pipeline via `licence.js` → `main.js` → `adminLink.js` cache → IPC/preload → `AdminControlHost`.
- Existing Admin control comes from the `desktopLicence` refresh response, according to Desktop source and the product architecture references.
- `ENGINEERING_BIBLE.md` documents the Admin Console and Cloud Function implementation in the separate Android repository. Documented control storage is per licence in `desktop_licences/{KEY}.admin_control` and global-to-Desktops in `platform_settings/desktop_control`.
- Desktop check-ins default to hourly; current control permits 15–360 minute intervals. Main process timer ticks every 5 minutes. This is device-oriented control, not a Stay business activation contract.
- `AdminControl` and `cleanControl` contain no `business_id`, Stay activation object, Admin actor, or expiry.
- Desktop feature overrides are applied to local storage and used by feature/route UX. They do not constitute a Stay data-access boundary.
- `BusinessProvider` loads a local business record, while the cloud contract maps local rows through a cloud business identity. The identity mapping must be reconciled before using an Admin config keyed by business.
- Android, Admin Console source, Cloud Function source, and Firestore rules are not in this Desktop workspace. Their current implementation must be confirmed in their repository before cross-platform claims or changes.
- Desktop `cloudAccount.ts` derives the cloud business ID as `biz_<Firebase uid>`; `cloudContract.ts` writes this ID to cloud records, while `cloudPull.ts` retains/maps records to a local `localBizId`. `BusinessProvider` selects the first local Dexie business row, and `AuthForm` uses its local `id` for the local owner profile. These IDs are not inherently equal.
- Desktop `licence.js` binds a licence key to a machine-derived `machine_id`; `cloudPush.ts` separately creates a `desk_*` sync device ID. Neither is the business ID. Existing Admin control is per licence key or global-to-Desktop.
- The ordinary Desktop login in `AuthForm` creates a local `local_admin` profile unlocked by the local master password. Google/Firebase auth is separately linked for cloud sync. There is no verified general per-employee Desktop sign-in flow.
- `cloud/staff.ts` defines generic staff roles and `StaffPermissions` for discount/cancel/table/report/cash-drawer capabilities, but no Stay permissions. `StaffPermissionsDialog` is deprecated and returns no UI. Staff join-code auth and Firestore-rule enforcement are documented as external Android Cloud Function/rules behavior, not verified here for Desktop.

## 2. Canonical configuration choices

### D1 — Where is the single source of truth?

**Question:** Should the canonical business/module config live in a business-scoped Firestore document and be copied into Desktop's licence response, or should the licence control payload itself become the canonical store?

**Recommendation:** Use a single business-scoped config document as the authoritative source. Desktop and Android obtain it with a server-issued lease. Prefer a business-aware endpoint; the existing Desktop `desktopLicence` may transport the response only if the backend verifies the business association. Per-device controls remain transport/presentation metadata only.

**Reason:** The current control record is tied to a PC licence and has a global Desktop override. That is not equivalent to business activation. A single shared business document prevents two independently edited values.

**Required investigation:** Confirm existing business document paths, Admin-only write authority, Firebase security rules, Desktop config read credentials, and Android repository implementation.

**Status:** Requires approval and external repository investigation. No proposed path is verified.

### D2 — What is the canonical business ID and how is each ID mapped?

**Verified Desktop mapping:** the local ID is the first `db.businesses` row's `id` (`BusinessProvider` / `AuthForm`); the cloud ID is `biz_<Firebase uid>` created in `cloudAccount.ts`. `cloudPush.ts` passes the cloud ID and local ID as separate context values; `cloudContract.ts` writes the cloud ID and `cloudPull.ts` maps returned rows back to the local ID.

**Unknown external mappings:** Current Admin Console business ID, deployed Android business ID resolution, and whether a Desktop licence key is associated to a business are not established by this Desktop repo. Existing Admin control uses per-PC licence or global Desktop addressing. Android's `biz_<uid>` mapping is documented in the Desktop cloud contract, but its source implementation has not been inspected in this workspace.

**Recommendation:** Use the canonical cloud `business_id` only after external Admin and Android code confirm it is the same identifier. Add an explicit server-authorized resolver from each client context. Never substitute a licence key, machine ID, local row ID, staff ID, or sync device ID.

**Status:** Critical blocker. Desktop mapping is verified; Admin Console, Android implementation, and licence-to-business association remain unverified and must be settled before activation/lease implementation.

### D3 — How are durable configuration and the client lease separated?

**Recommendation:** Authoritative Admin config contains `business_id`, `module`, `enabled`, `version`, `updated_at`, `updated_by`, and `source`. It is durable and has no expiry. Client lease/cache separately contains `fetched_at`, `last_successful_refresh_at`, `expires_at`, `last_server_time`, and `cached_config_version`.

**Field notes:**
- `version` gives monotonic ordering; `updated_at` is for human audit, not ordering alone.
- `updated_by` is an Admin identity or nullable only for an explicitly documented automated change.
- `source` is a constrained provenance value such as `admin_console`; do not change it to `device_cache` locally.
- An unchanged Admin document older than 24 hours remains unchanged; document age alone must not disable Stay.

The backend issues/renews the lease after reading the current Admin config and validating business membership or an explicit server-maintained licence/business association. It generates `last_server_time` and `expires_at` from server time. An unchanged enabled config can receive a new lease on refresh. The client accepts only a lease bound to the exact business/module/config version and rejects expired or invalid leases. If refresh fails after expiry, deny new Stay operations even though the durable config remains enabled. A signed lease/envelope is recommended; it does not secure local data from the device owner.

**Status:** Recommended; lease TTL, signing design, and backend issuer require owner approval and external service design.

### D4 — Is a maintenance/limited state needed in Phase 1?

**Question:** Earlier drafts mention `limited` or `maintenance`, while another decision says use one boolean.

**Recommendation:** Phase 1 uses only `enabled: boolean`. If a maintenance/limited state has distinct user-visible and operational behavior, define it in a later version with a formal state machine.

**Status:** Requires approval; recommendation is to exclude for Phase 1.

## 3. Cache, refresh, and disable decisions

### D5 — Refresh frequency and online propagation target

**Recommendation:** Refresh before enabling Stay at startup; refresh on app foreground and network recovery; while Stay is active and online, target no more than 15 minutes between successful checks. The current Desktop has a 60-minute default and a 15–360 minute Admin-configurable interval, so this target requires a policy decision and perhaps a separate Stay-specific cadence. A connected-device update is bounded by the chosen refresh mechanism plus network/server delay; do not promise instantaneous propagation.

**Trade-off:** Polling more often improves online disable latency but adds requests/load and may affect Admin service cost. A live Firestore listener can improve online propagation but still cannot notify an offline device and requires compatible auth/rules.

**Status:** Requires approval and confirmation of server load/cost.

### D6 — Maximum client lease duration

**Recommendation:** Begin with a proposed 24-hour lease duration from server-issued time, subject to operational testing. The durable Admin config has no TTL/expiry and may be refreshed at any age. On lease expiry, deny new Stay operations if a refresh cannot succeed. Treat the number as a policy proposal, not an existing guarantee.

**Trade-off:** A longer lease supports intermittent connectivity but prolongs use of stale enabled state; a shorter lease reduces stale access but can make Stay unavailable during an outage. A refresh can renew unchanged enabled config; 24 hours is not a requirement to edit/re-save Admin configuration.

**Status:** Requires explicit approval; exact TTL is not finalized.

### D7 — Historical read access when the lease expires or Admin disables Stay

**Recommendation:** If the cached enabled config remains but its lease has expired, deny all new Stay operations. Permit read-only access to already-local historical Stay records only if this separate access policy is approved; disallow edits, queueing, and automatic sync/replay. Clearly display that authorization could not be refreshed.

**Explicit remote disable:** A fresh `enabled: false` is a known Admin decision. Recommended default is to block all Stay routes except a status/support screen. Whether that known-disabled state should still permit historical read-only access is a separate user policy question.

**Trade-off:** Historical read-only access helps retrieve records during service outages but exposes locally cached business information to current device users. Since local data is already on device, access still requires user/business permission and the product's privacy policy.

**Status:** Requires approval.

### D8 — What happens to active screens and pending operations after disable?

**Recommendation:** On receipt of a newer disabled version, immediately deny new actions, invalidate the active Stay screen, preserve local data, and pause Stay outbox sends. Mark unsynchronized operations for reconciliation. Never delete them or automatically replay them after re-enable without validating each operation.

**Offline limitation:** If the device is disconnected, it cannot learn about a new disable. Its last valid config/lease may remain usable until reconnect or lease expiry. No client-side policy can promise immediate offline revocation.

**Status:** Recommended; approve user-facing recovery wording and the pending-operation state handling.

## 4. Authentication, permissions and business policy

### D9 — Who may use Stay?

**Verified gap:** The current Desktop's normal `AuthForm` creates a local `local_admin` profile unlocked by a master password, not a per-employee identity. Google/Firebase auth is used for cloud sync. `src/lib/auth/session.ts` defines a JWT payload with `staff_id`, `business_id`, and broad roles, but repository search found no production call sites for its sign/verify functions. It is not evidence that Desktop already has employee sign-in. Existing staff documents have generic roles and only retail/Restaurant-oriented flags; the permissions dialog is deprecated/empty.

**Recommendation for Phase 1:** Do not create a parallel authentication system. Reuse an existing staff sign-in/session if available and verified in the external Android/backend code; extend that model with explicit `stay.view` and `stay.manage` grants or a documented role mapping, and enforce them in the existing server/rules path. Desktop must obtain the same verified staff identity before using these grants. Decide separately whether the existing local owner master-password profile is allowed as owner-only access; it cannot represent employee identity or provide server authorization.

**Minimum additional work if current staff auth cannot be reused in Desktop:** integrate the existing staff session issuance/verification path (not a new login system), parse active staff identity and business association, add the two permission fields to the existing staff document/editor/validator, and update Cloud Function/Firestore rules and tests. External source review is required to determine exact files and current guarantees.

**Status:** Requires approval of owner policy/role mapping and external authentication/permission evidence; current Desktop is insufficient by itself.

### D10 — How are central activation and permissions separated?

**Recommendation:** Admin activation controls whether the business has the module. Employee permissions control what an authenticated user can do inside the active module. Neither implies the other. Admin Console toggle is not an employee role grant.

**Status:** Confirmed policy direction; role matrix requires approval.

### D11 — What is the cloud enforcement boundary?

**Recommendation:** Admin-only writes for activation; service/cloud checks for operations that require online final confirmation; local service guards for application correctness. Document that local Electron/IndexedDB checks cannot protect against the device owner.

**Question:** Which Cloud Function or other service will authorize reads/writes for future Stay records, and how does that work with local-first offline operation?

**Status:** Requires backend/Admin architecture decision. Not implemented in this Desktop repo.

## 5. Restaurant and integration policy

### D12 — How is Restaurant kept unchanged?

**Recommendation:** Stay activation remains a separate config resolver and guard. Do not add a generic `FeatureId` or alter restaurant mode, preset precedence, sales tables, or Restaurant route flow as part of Phase 1. Add Stay route/nav separately and regression-test Restaurant with activation missing, enabled, and disabled.

**Status:** Confirmed design constraint.

### D13 — What is the route namespace?

**Question:** Should Stay use `/restaurant/stay`, `/stay`, or another route?

**Recommendation:** Select a namespaced route that communicates the Restaurant parent, then ensure nested paths all pass the guard. Route naming does not change module activation semantics.

**Status:** Requires approval before navigation implementation.

### D14 — How is the contract delivered to Android and Desktop?

**Recommendation:** Both clients consume the same durable Admin config and server-issued lease contract. Desktop may receive a copy via its existing licence check-in only after the backend securely resolves/validates the business association; that response is a transport/cache path, not a second source of truth. The existing per-licence check-in does not currently prove business membership.

**Required validation:** Compare Android serialization, ID mapping, employee auth/rules, lease issue/expiry, and route/service enforcement. Android source is absent here.

**Status:** Requires external repo inspection and cross-platform owner approval.

## 6. Phase 1 implementation boundaries and repository dependencies

### A. Desktop implementation

**Repository:** This Desktop workspace.  
**Scope:** Resolve the current active local business and its cloud ID; consume only a backend-authorized config/lease; persist the durable config separately from client lease metadata; validate version, business, lease integrity and expiry; integrate with the existing Electron bridge; add Stay route/service guards; reuse the existing staff identity only if its Desktop authentication path is verified; preserve Restaurant behavior.  
**Dependencies:** Approved canonical business resolver, backend endpoint/lease contract, owner-access policy, employee auth/permission design, external Firestore access policy.  
**Acceptance:** Desktop unit/integration and Restaurant regression tests pass. This does not complete Phase 1.

### B. Admin/backend implementation

**Repository:** KamaiPlus Android/Admin repository and Firebase project configuration; not available in the Desktop workspace.  
**Scope:** Inspect existing business records and Admin identities; add Admin-only durable module config/version/audit writes; establish the authoritative business ID; issue a server-timed lease on refresh after verifying business association; enforce config/lease and staff permissions for server-mediated operations; update Firestore rules/Cloud Functions and audit logs.  
**Likely documented files to verify:** `admin_console/admin_models.dart` (and related Admin screens/services), `functions/licence_core.js`, `functions/staff_core.js`, `firestore.rules`, and Cloud Function tests. These paths are based on Desktop documentation; current external code/deploy status must be inspected.

### C. Android implementation

**Repository:** KamaiPlus Android application repository; not available in this workspace.  
**Scope:** Confirm Android business ID resolution and staff session; consume the identical durable config and server-issued lease; enforce the same version/expiry/business/permission rules; surface stale/offline/disabled states; add Android tests.  
**Likely documented integration files to verify:** `lib/services/firestore_sync_service.dart`, `lib/models/models.dart`, `lib/core/database/local_database.dart`, and existing auth/staff services. These are references, not verified Stay integration points.

### D. Cross-platform integration and acceptance

**Repositories/access:** Both app repositories, Admin/backend source, Firebase staging project/rules, and test-owner access are required.  
**Scope:** Shared fixtures/schema validation; Admin write → lease issuance → Desktop and Android consumption; identity parity; stale-version/disable propagation while online; offline expiry; staff permission behavior; regression testing.  
**Completion rule:** Phase 1 is not complete based on Desktop-only testing.

### Phase 1 must not include

- Dexie table or migration work.
- Room/booking/check-in/payment/night-audit workflows.
- Changes to Restaurant or existing sales/ledger semantics.
- Claims of immediate offline revocation or device-owner-proof local security.

### Exact implementation files/services identified for later work

**Desktop existing files:** `licence.js`, `adminLink.js`, `main.js`, `preload.js`, `src/lib/desktop/desktopBridge.ts`, `src/components/admin/AdminControlHost.tsx`, `src/lib/admin/adminControl.ts`, `src/components/features/FeatureGate.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/layout/AppShell.tsx`, `src/components/layout/BusinessProvider.tsx`, `src/lib/cloud/cloudAccount.ts`, `src/lib/cloud/cloudContract.ts`, `src/lib/cloud/cloudPull.ts`, `src/lib/cloud/cloudPush.ts`, `src/lib/auth.ts`, `src/lib/auth/session.ts`, `src/lib/cloud/staff.ts`, `src/components/auth/AuthForm.tsx`, and `src/components/settings/staff/StaffPermissionsDialog.tsx`.

**Desktop new/changed authorization work likely needed:** typed config/lease parser and integrity/expiry validator; centralized activation/business/permission policy; integrate an existing verified employee session; add Stay fields to the existing staff permission model/editor only after the shared authorization contract is agreed; focused tests. Exact new filenames follow repo conventions after approval.

**External systems:** Admin Console models/screens, `desktopLicence` and/or a dedicated business-aware lease endpoint, staff Cloud Function/session issuance, Firestore rules, Android config/cache/guard/auth code. Exact current external paths/branch/deploy status must be verified before change.

## 7. Approval checklist

Phase 1 should not start until the owner confirms:

- [ ] One authoritative config location and authorized Admin writer.
- [ ] Canonical `business_id` mapping for Desktop, Admin Console, and Android, plus any server-verified licence-to-business association.
- [ ] Durable Admin fields and separate lease fields/semantics; config age must not disable Stay.
- [ ] Refresh policy and maximum online propagation target.
- [ ] Lease duration/expiry policy and expired-history read policy.
- [ ] Explicit disable behavior for history and active/pending work.
- [ ] Employee authentication and permission model, including Desktop use of existing staff identity and owner access policy.
- [ ] Stay route namespace and support/error UX.
- [ ] External Admin/Android repository access and test ownership.
- [ ] Phase 1 test/acceptance sign-off.

## Readiness recommendation

**READY WITH CONDITIONS** for planning only; **NOT READY to implement yet**.

The existing Desktop licence-control transport/cache can be evaluated for reuse, but it does not establish a business association or employee identity. Critical blockers remain: external canonical business ID, authorized lease issuer and integrity, Admin write/rules design, Android compatibility, employee sign-in/Stay permissions, lease duration, and owner/offline-history policy. No source/schema modifications have been made while preparing these documents.
