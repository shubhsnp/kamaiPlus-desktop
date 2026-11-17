# Kamai Plus Stay — Phase 1 Final Decisions

**Status:** Recommended architecture and decision record; owner approval required  
**Implementation status:** Planning/documentation only. No source code, database schema, or migration changes were made.  
**Readiness:** **NOT READY to implement.** Phase 1 planning is sufficiently detailed, but its identity, backend, and employee authorization gates are unresolved.

## 1. Final recommended architecture

Stay activation is a business-scoped Admin entitlement, separate from Restaurant feature switches and separate from employee permissions. Desktop and Android consume the same durable Admin configuration and the same short-lived authorization lease. A backend is responsible for authoritative reads, business association checks, and lease issuance.

Recommended flow:

1. The authorized Admin Console updates one durable config for one canonical business and module.
2. The backend validates the Admin writer, increments the config version, and records the actor and update time.
3. An authenticated Desktop or Android client requests the current config/lease. The backend must derive or verify the business identity; it must not trust an arbitrary renderer-supplied ID.
4. The backend reads the durable config and issues a time-limited lease for that exact business, module, and config version.
5. The client stores config and lease separately, validates the response, and allows offline operation only while that lease remains valid and the config says enabled.
6. On refresh failure after lease expiry, the client denies new Stay operations. It does not alter the durable Admin config or describe the business as remotely disabled.
7. An explicit newer `enabled: false` config blocks new operations when received. Offline devices cannot receive that change until reconnecting and must stop new operations when their existing lease expires.

The proposed Firestore path `businesses/{canonicalBusinessId}/module_config/stay` is a recommendation, not an existing repository fact. Prefer a business-aware backend endpoint for lease issuance. The current `desktopLicence` endpoint may transport the response only if it can prove the authenticated business association; a device licence alone is not that proof.

## 2. Durable Admin configuration and client lease

### 2.1 Durable Admin configuration

```json
{
  "business_id": "canonical-business-id",
  "module": "stay",
  "enabled": true,
  "version": 1,
  "updated_at": "2026-11-16T12:00:00.000Z",
  "updated_by": "admin-user-id",
  "source": "admin_console"
}
```

The durable document has **no expiry**. A business does not become disabled because an unchanged config document is older than 24 hours. Admin changes increment `version`; `updated_at` and `updated_by` support auditability; `source` is a constrained provenance value. `state` is not duplicated alongside `enabled`.

### 2.2 Client authorization lease/cache

```json
{
  "fetched_at": "2026-11-16T12:00:00.000Z",
  "last_successful_refresh_at": "2026-11-16T12:00:00.000Z",
  "expires_at": "2026-11-17T12:00:00.000Z",
  "last_server_time": "2026-11-16T12:00:00.000Z",
  "cached_config_version": 1
}
```

- The backend issues the lease after reading the current durable config and verifying business membership or an explicit server-maintained licence-to-business association.
- `last_server_time` and `expires_at` are based on server time, not an Admin document TTL.
- An unchanged enabled config can receive a new lease on each successful refresh. Admin does not need to edit/re-save the config.
- `cached_config_version` binds the lease to the exact config version; reject mismatches, old versions, malformed responses, and same-version conflicting payloads.
- `fetched_at` records when the config/lease bundle was received and cached, while `last_successful_refresh_at` records the most recent successful server validation. Failed refreshes that return no valid bundle do not move either timestamp forward or extend the lease.
- A server-signed envelope covering business, module, enabled value, config version, and lease expiry is recommended. Signing-key placement and verification design require backend/security review.
- When `now >= expires_at` and refresh is unavailable, fail closed for all new Stay operations even if the cached durable config says enabled. Read-only history after lease expiry is a separate owner decision.
- Signed server time and a persisted high-water mark can reduce accidental local clock rollback. They do not secure a local-first Electron app from a technically capable device owner.

**Recommended but unapproved policy values:** refresh at startup, foreground, reconnect, and at least every 15 minutes while Stay is active; a 24-hour lease as an initial offline tolerance. Neither value is an existing implementation or a remote-disable guarantee.

## 3. Verified identity mapping and unresolved external identities

| Identifier | Verified Desktop behavior | Decision/status |
|---|---|---|
| Desktop local business ID | `BusinessProvider` reads the first row in `db.businesses`; `AuthForm` uses that row's `id` for its local profile. `cloudPull.ts` calls it `localBizId` and maps pulled data back to it. | Local IndexedDB identity; do not assume it equals the cloud ID. Multi-business selection is not established by this provider. |
| Desktop cloud business ID | `cloudAccount.ts` derives `bizId = biz_<Firebase uid>` after Google/Firebase sign-in. `cloudPush.ts` supplies it as cloud context. `cloudContract.ts` writes it to cloud `business_id`; `cloudPull.ts` retains/maps local rows under `localBizId`. | Verified Desktop cloud mapping. The local ID is not rewritten to the cloud ID by this mapping. |
| Admin Console business ID | Existing documented Admin control addresses `desktop_licences/{KEY}` or `platform_settings/desktop_control`; this is per-licence or global Desktop control. | No current business-scoped Stay Admin ID/path is verified. Admin Console source and deployed data are external and must be inspected. |
| Android business ID | Desktop `docs/CLOUD_DATA_CONTRACT.md` documents `biz_<Firebase uid>` and the `businesses/{bizId}` path as the shared contract. | Android implementation is outside this workspace. The documented contract is not independent proof of current Android code or deployment behavior. |
| Licence key | `licence.js` sends the key to `desktopLicence`; the Admin docs describe `desktop_licences/{KEY}`. | Per-computer licence identifier, not a business ID. |
| Machine ID | `licence.js` hashes a machine-derived value and the signed licence is checked against that ID. | Identifies a PC for licence binding; not a business ID. |
| Cloud sync device ID | `cloudPush.ts` creates a `desk_*` ID used as this PC's cloud sync/device identity. | Not a licence key or business ID. |

**Required resolution:** inspect Admin Console, deployed Cloud Functions, Firestore rules, and Android source to establish whether Admin and Android business IDs equal the Desktop cloud `biz_<uid>`. Also establish whether any server-maintained licence-to-business mapping exists. Until proven, do not treat any of these identifiers as interchangeable, and do not issue a business lease from a client-supplied ID alone.

## 4. Employee authentication and permissions

### Verified Desktop facts

- The normal `AuthForm` path creates a local `local_admin` profile and unlocks it with the local master password. This is not per-employee authentication.
- Google/Firebase auth is separately linked for cloud sync; it is not shown to be a Desktop employee session.
- `src/lib/auth/session.ts` defines a JWT payload with `staff_id`, `business_id`, phone, and broad roles, but repository search found no production call sites for its sign/verify functions. Its existence alone does not establish a working Desktop auth path.
- `src/lib/cloud/staff.ts` manages staff documents under `businesses/{biz}/staff/{staffId}` and exposes generic roles plus permissions for discount, cancel, table, reports, and cash drawer.
- There are no `stay.view` or `stay.manage` permissions in the current Desktop staff model.
- `src/components/settings/staff/StaffPermissionsDialog.tsx` is deprecated and returns no UI.
- Staff join-code sign-in, Cloud Function behavior, and Firestore rule enforcement are documented in the external Android repository, not verified here for Desktop.

### Recommendation

Do not introduce a parallel authentication system. Reuse an existing staff identity/session only after verifying its issuance and enforcement in the Android/backend source. Extend that existing identity/permission model to support, at minimum, `stay.view` and `stay.manage` (or explicitly approved role mappings), and enforce permissions in the existing server/rules path for cloud operations. The Desktop must obtain the same verified staff identity before using these grants.

Owner access through the current local `local_admin`/master-password path is a separate policy decision. If allowed, it is an owner-only local access rule, not employee identity or server authorization. Generic role names such as `manager` or `cashier` must not imply Stay rights without an approved explicit mapping.

Minimum additional work if the current staff sign-in cannot be reused on Desktop: integrate the existing staff session issuance/verification path, expose active staff and business identity to Desktop, extend the existing staff record permission model/editor/validator, and update Cloud Function/Firestore rules and tests. Do not build another login or role store.

## 5. Implementation boundaries and acceptance

### Phase A — Desktop implementation

**Repository/access:** `KamaiPlus Desktop App` repository and its existing test environment.

**Work:** Add validated config/lease consumption and cache; resolve local-to-cloud identity; connect to the approved business-aware lease endpoint; integrate with the existing Electron bridge; add route and service checks; integrate the approved staff session and permission source; preserve existing Restaurant behavior.

**Expected files to inspect/change after approval:**

- `licence.js`, `adminLink.js`, `main.js`, `preload.js`
- `src/lib/desktop/desktopBridge.ts`
- `src/components/admin/AdminControlHost.tsx`
- `src/lib/admin/adminControl.ts`
- `src/components/features/FeatureGate.tsx`
- `src/components/layout/Sidebar.tsx`, `src/components/layout/AppShell.tsx`, `src/components/layout/BusinessProvider.tsx`
- `src/lib/cloud/cloudAccount.ts`, `src/lib/cloud/cloudContract.ts`, `src/lib/cloud/cloudPull.ts`, `src/lib/cloud/cloudPush.ts`
- `src/lib/auth.ts`, `src/lib/auth/session.ts`, `src/components/auth/AuthForm.tsx`
- `src/lib/cloud/staff.ts`, `src/components/settings/staff/StaffPermissionsDialog.tsx`
- Focused test files in the repository's existing harness, identified after implementation approval.

**Acceptance:** Desktop config/lease/unit/integration tests pass; identity mapping is tested; direct route and service guards reject invalid/expired/disabled states; existing Restaurant and Admin-control regression tests pass. Desktop acceptance alone does not complete Phase 1.

### Phase B — Admin/backend implementation

**Repository/access:** KamaiPlus Android/Admin repository, Firebase project configuration, Firestore rules, Cloud Functions source, staging/deployment permissions, and Admin test access. These are not available in the Desktop workspace.

**Likely documented files to verify (not confirmed current paths):** `admin_console/admin_models.dart` and related Admin screens/services; `functions/licence_core.js`; `functions/staff_core.js`; `firestore.rules`; Cloud Function/Admin tests.

**Work:** Verify business identities and any licence association; choose authoritative config path; add Admin-only writes/version/audit; implement backend validation and lease issuance using server time; enforce staff/business/module policy for server-mediated operations; test rules, endpoint, and audit behavior.

**Acceptance:** Unauthorized writers cannot change activation; authorized Admin changes are audited; unchanged config can receive renewed lease; wrong-business requests fail; expired/invalid leases fail closed; endpoint/rules tests pass.

### Phase C — Android implementation

**Repository/access:** KamaiPlus Android repository and its existing Firebase/test environment; source is not available here.

**Likely documented integration files to verify (not confirmed Stay integration points):** `lib/services/firestore_sync_service.dart`, `lib/models/models.dart`, `lib/core/database/local_database.dart`, and existing auth/staff services.

**Work:** Verify Android business ID and staff identity paths; consume the same durable config and lease; apply shared business/version/expiry/permission semantics; add Android UI status and offline tests.

**Acceptance:** Android contract, lease, identity, permission, and offline behavior tests pass against shared fixtures and the authorized backend.

### Phase D — Cross-platform integration and acceptance

**Repository/access:** Desktop, Android/Admin/backend repositories, shared staging Firebase config, and both test owners.

**Work and acceptance:** Verify the Admin-write → backend-lease → Desktop/Android-consume lifecycle; identity parity; version/disable transitions; same lease expiry behavior; employee permission parity; and Restaurant regression. Use deterministic shared fixtures plus integration tests in staging.

**Overall completion rule:** Phase 1 is not complete based on Desktop-only testing. All four phase gates must pass and be signed off.

## 6. Decisions still requiring owner approval

1. Confirm the authoritative Admin config path and the Admin-only writer.
2. Confirm one canonical `business_id` across Desktop, Admin Console, Android, and any server-side licence association.
3. Approve lease issuance mechanism, integrity/signature scheme, 24-hour starting duration, 15-minute refresh target, and failure UX.
4. Approve whether read-only historical access is permitted after lease expiry or a known Admin disable.
5. Approve owner access through the local master-password profile and define employee role-to-permission policy.
6. Confirm reuse of existing staff auth, and allow changes to its existing records/rules/editor for `stay.view` and `stay.manage`.
7. Approve the Stay route namespace and status/error UX.
8. Provide repository and staging access for Admin/backend and Android work; name test and deployment owners.
9. Confirm that no Phase 1 work includes Dexie schema, migrations, room workflows, finance, or Restaurant restructuring.

## 7. Final readiness assessment

**Planning:** READY WITH CONDITIONS.  
**Implementation:** **NOT READY.**

The Desktop code paths now establish its local/cloud business mapping and expose the relevant staff/auth gaps. They do not establish Admin Console or Android identity parity, a licence-to-business association, a secure lease issuer, or a usable Desktop employee authorization path. Those are critical blockers, not implementation details to assume away. Begin implementation only after the owner resolves the decisions above and grants access to the external repositories and staging services.

## 8. Evidence reviewed for this decision record

Desktop code and references reviewed:

- `src/components/layout/BusinessProvider.tsx`
- `src/components/auth/AuthForm.tsx`
- `src/lib/cloud/cloudAccount.ts`
- `src/lib/cloud/cloudContract.ts`
- `src/lib/cloud/cloudPull.ts`
- `src/lib/cloud/cloudPush.ts`
- `src/lib/cloud/staff.ts`
- `src/lib/auth.ts`
- `src/lib/auth/session.ts`
- `src/lib/auth/masterPassword.ts`
- `src/components/settings/staff/StaffPermissionsDialog.tsx`
- `licence.js`
- `ENGINEERING_BIBLE.md`
- `docs/CLOUD_DATA_CONTRACT.md`
- `docs/PLATFORM_TRACKER.md`

The Android/Admin source, deployed Cloud Function code, and live Firestore rules were not available for direct inspection; statements about them above are explicitly identified as documented references or unresolved evidence.
