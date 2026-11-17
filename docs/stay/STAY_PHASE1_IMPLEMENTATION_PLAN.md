# Kamai Plus Stay — Phase 1 Implementation Plan

**Status:** Planning only — no implementation authorized or performed  
**Scope:** Admin Stay activation/configuration contract and minimum route/service access guards  
**Primary evidence:** Current Desktop source, `ENGINEERING_BIBLE.md`, `docs/PLATFORM_TRACKER.md`, `docs/CLOUD_DATA_CONTRACT.md`, and `STAY_FINAL_ARCHITECTURE_REVIEW.md`

## 1. Phase 1 objective

Add a business-scoped, centrally managed Stay activation state that Desktop and Android can consume from one canonical Admin contract. A separate, short-lived client authorization lease permits offline use of a recently validated configuration. The state must be distinct from employee permissions. When Stay is disabled, it must prevent new Stay operations while preserving records. It must not change Restaurant behavior.

Phase 1 does **not** create Stay database tables, migrations, room workflows, or financial operations. The guards should be defined so later Stay services can call them, but no Stay data service exists yet to protect.

## 2. Admin integration investigation

### 2.1 Existing configuration source and delivery path

**Verified Desktop implementation:**

1. The Desktop main process calls the existing licence refresh endpoint through `licence.js`.
2. The endpoint is documented as the `desktopLicence` Firebase Cloud Function. The Desktop source parses an optional `body.control`.
3. Admin control fields are cleaned and saved in the Electron user-data directory as `admin_control.json` by `adminLink.js`.
4. `main.js` sends a `kp:admin-control` IPC event when the saved control changes and also serves the persisted control to the renderer.
5. `preload.js` exposes `getAdminControl()` and `onAdminControl()`.
6. `AdminControlHost` receives the control and applies `features` to local storage through `applyFeatureOverrides`.
7. `FeatureGate` and feature-switch consumers use those values for route/feature UX.

The check-in schedule in the Desktop code is configurable through `checkin_minutes` (15–360 minutes) with a 60-minute default. A main-process timer ticks every five minutes. The first installed-app tick is scheduled about one minute after the watch starts. The repo does not show a guaranteed push channel for admin-control changes.

### 2.2 Central source documented outside this Desktop repository

`ENGINEERING_BIBLE.md` documents that the Admin Console is in the separate KamaiPlus Android repository. It writes control fields to Firestore `desktop_licences/{KEY}.admin_control` for one licence/device or `platform_settings/desktop_control` for all Desktops. The `desktopLicence` function in that external repository merges the per-key and global controls and returns the result to Desktop. `docs/PLATFORM_TRACKER.md` records deployment work for that function/Admin Console, but those implementation files are not present in this Desktop workspace and were not independently inspected here.

### 2.3 Is business-scoped activation currently supported?

**No Stay-specific business-scoped activation was verified.**

The current control is per-PC/per-licence or global-to-Desktops. The Desktop `AdminControl` type has `mode`, `features`, minimum version and check-in information; it has no `business_id`, Stay module contract, `updated_by`, or config expiry. The generic `features` map is applied as UI feature overrides.

The existing Cloud Data Contract uses a shared cloud business identifier, but the Desktop local business ID and cloud business ID can differ through the cloud context mapping. A Phase 1 implementation must resolve this identity explicitly; it must not assume a licence key, local business ID, Firebase UID, and cloud `business_id` are interchangeable.

### 2.4 Business identity mapping — verified and unverified

| Identity | Desktop evidence | Relationship / status |
|---|---|---|
| Desktop local business ID | `BusinessProvider` reads the first row from `db.businesses`; `AuthForm` stores that row's `id` in the local user. `cloudPull.ts` calls this `localBizId` and restores cloud rows under it. | Local IndexedDB key; not necessarily the cloud business ID. |
| Desktop cloud business ID | `cloudAccount.ts` derives `bizId` as `biz_${Firebase uid}` after Google sign-in and stores the account locally. `cloudPush.ts` supplies that value as cloud context. `cloudContract.ts` writes it to cloud `business_id`; `cloudPull.ts` maps it back to the existing `localBizId`. | Verified implementation mapping: local row ID ↔ cloud `biz_<uid>` is held in the active cloud account/context, not by making the local ID equal to it. |
| Admin Console business ID | No business-scoped Stay Admin config is in this Desktop repo. Existing Admin control is addressed by Desktop licence key or globally to Desktop clients. | Unknown. External Admin Console source and deployed data must be inspected; do not infer it equals `biz_<uid>`. |
| Android business ID | Desktop `docs/CLOUD_DATA_CONTRACT.md` documents the shared path `businesses/{bizId}` and `bizId = biz_<Firebase uid>`, but Android source is outside this workspace. | Documented contract, not independently verified against current Android source or deployment. |
| Desktop licence/device identity | Root `licence.js` derives `machine_id` from the PC, sends it with the licence key, and verifies the signed licence names that machine. Admin controls are stored per `desktop_licences/{KEY}` or globally. Separately, `cloudPush.ts` creates a `desk_*` cloud-sync device ID. | Three distinct values: licence key, machine ID, and sync device ID. None is a business ID. No current verified association maps a licence to a business for Stay entitlement. |

**Critical integration requirement:** the Admin/backend must resolve and authorize the canonical business ID from an authenticated business context, or validate an explicit server-maintained licence-to-business association. It must not trust an arbitrary `business_id` supplied by the Desktop renderer. The owner Google account's `biz_<uid>` is a current Desktop cloud convention, not proof that the Admin Console or Android uses the same canonical ID today.

### 2.5 Android integration required

The Android/Admin Console repository is outside this workspace. It must:

- publish the canonical business/module config, not an Android-local Stay flag;
- use the same durable config schema and separate lease/version/expiry semantics as Desktop;
- resolve the same canonical `business_id`;
- display the business activation state in the Admin Console;
- ensure only authorized Kamai Plus Admin operations can change the activation;
- update the Android app to consume the same config and enforce the same activation semantics.

The documented Desktop Admin pipeline can transport state to Desktop, but is currently tied to PC licences. It can be extended to deliver the business config; that extension is proposed, not verified. The shared source of truth should be independent of per-device feature overrides.

## 3. Recommended Admin configuration and client authorization lease

### 3.1 Payload

```json
{
  "business_id": "biz_<canonical-id>",
  "module": "stay",
  "enabled": true,
  "version": 1,
  "updated_at": "2026-11-16T12:00:00.000Z",
  "updated_by": "admin-user-id",
  "source": "admin_console"
}
```

The sample is illustrative only; it is not an existing repository payload.

### 3.2 Authoritative Admin configuration

The Admin configuration is durable and has **no time-based expiry**. A business does not become disabled merely because an unchanged configuration document is older than 24 hours. Admin changes increment `version` and update audit fields; absence of a refresh lease is a client authorization condition, not an Admin `enabled: false` change.

| Field | Keep? | Reason |
|---|---|---|
| `business_id` | Yes | Essential tenant binding; validate against the active canonical business identity. |
| `module` | Yes | Identifies this record as the Stay activation contract and permits safe extension to other modules. |
| `enabled` | Yes | One unambiguous activation value. Do not duplicate it with `state: enabled/disabled`. |
| `version` | Yes | Monotonic per business/module revision; rejects older cached or delayed responses. |
| `updated_at` | Yes | Audit/display timestamp for the Admin change. It is not a substitute for monotonic `version`. |
| `updated_by` | Yes | Administrative accountability; allow `null` only for documented system-generated changes. |
| `source` | Yes, constrained | Provenance, e.g. `admin_console`. Do not use `device_cache` as the contract source: cache state belongs in local metadata. |

Omit a second `state` field. If a future maintenance mode needs behavior different from enabled/disabled, define an explicit state machine in a separately reviewed version; do not introduce ambiguous combinations such as `enabled: true, state: disabled`.

### 3.3 Client authorization lease/cache

Keep the short-lived lease separate from the durable Admin document. The recommended client-side lease/cache record is:

```json
{
  "fetched_at": "2026-11-16T12:00:00.000Z",
  "last_successful_refresh_at": "2026-11-16T12:00:00.000Z",
  "expires_at": "2026-11-17T12:00:00.000Z",
  "last_server_time": "2026-11-16T12:00:00.000Z",
  "cached_config_version": 1
}
```

`fetched_at` records when the client received and cached a valid config/lease bundle; `last_successful_refresh_at` records the most recent response that passed validation and renewed the lease (failed refreshes leave it unchanged); `last_server_time` and `expires_at` are issued by the backend; `cached_config_version` binds the lease to the exact Admin config version. These are not Admin-authored fields and must not be written back to the authoritative configuration document.

**Issuance and validation proposal:**

1. On a successful online refresh, an authorized backend reads the durable Admin config, checks authenticated business membership or an explicit server-maintained licence/business association, and returns the config plus a lease for that config version.
2. The backend sets `last_server_time` and `expires_at` using server time and the approved lease duration. An unchanged, still-enabled Admin document can receive a new lease on each successful refresh.
3. The response should be integrity-protected by a server-signed lease/envelope that covers the canonical business ID, module, config version, enabled value, and expiry. Signature validation can detect corruption/forgery by ordinary app paths; it cannot protect local data from the device owner who controls the Electron machine.
4. Desktop and Android persist the Admin config and lease as separate logical records. They accept a lease only if its signature/response is valid, `cached_config_version === config.version`, business/module match the active context, timestamps are well-formed, and server-time/expiry validation succeeds.
5. Before each new Stay operation, an application service checks the latest known config version and lease. `enabled: false` denies immediately upon receipt. If the lease expires and refresh fails, deny new operations even when the last Admin config says enabled. Preserve historical local data; do not reinterpret lease expiry as an Admin disable.
6. On refresh failure, retain the last valid lease only until its `expires_at`; never extend it using the device clock or by rewriting the old `fetched_at`. On successful refresh, replace it with the newer verified lease. Reject lower versions; treat same-version/different-content responses as invalid.

**Lease duration recommendation:** 24 hours from server issue time is a starting policy proposal, not a document expiry and not yet approved. The server may issue the lease again without requiring an Admin edit. Online refresh is recommended at startup, foreground, reconnect, and no less often than every 15 minutes while Stay is active; a successful refresh is bounded by network/server delay, not an immediate push guarantee. Offline devices cannot learn of a remote disable and must stop new Stay operations once their lease expires.

Device wall-clock rollback and local cache modification remain limitations of a user-controlled PC. A signed server timestamp and a persisted high-water mark can reduce accidental rollback; they do not establish device-owner-proof security.

### 3.4 Canonical source recommendation

**Proposal:** Make a business-scoped Firestore config document the single source of truth, using the existing business path convention, for example:

`businesses/{canonicalBusinessId}/module_config/stay`

Admin writes should be authorized by the Admin service/privileged Admin Console rules, not by ordinary merchant/client writes. Desktop and Android should consume the same payload. Prefer a business-aware backend endpoint that issues the client lease from this canonical document. The existing Desktop licence check-in may transport a copy only if the backend independently verifies the business association; its current per-PC licence key is not proof of business identity and must not become a second source of truth.

This path is a proposal, not an existing implemented path. Before coding, inspect the Admin Console repository, deployed function, and Firestore rules to confirm the exact document path and write authority.

## 4. Offline and propagation policy

### 4.1 Recommended refresh frequency

- Refresh on installed-app startup before enabling Stay operations.
- Refresh when the app returns to foreground and when network connectivity is restored.
- While online and Stay is enabled, target a refresh at least every **15 minutes**.
- Reuse the current Desktop check-in path where feasible. Its existing default is 60 minutes and Admin-configured range is 15–360 minutes, so the 15-minute target requires an explicit Phase 1 policy/configuration change; it is not current behavior.
- If polling every 15 minutes is not acceptable for load/cost, a shared Firestore listener may improve online propagation, but requires authorization/rules and lifecycle design. It does not solve offline revocation.

The practical online propagation target is the refresh interval plus connection/service delay, not an instantaneous guarantee.

### 4.2 Lease expiry recommendation

**Proposed starting policy:** Issue each client lease with an absolute `expires_at` no more than **24 hours** after successful server validation. The durable Admin config has no expiry. An unchanged `enabled: true` config remains enabled in the Admin system and can receive a fresh lease on the next authorized refresh.

Trade-off:
- A longer expiry supports rural/intermittent connectivity but leaves devices using stale authorization longer.
- A shorter expiry reduces stale access but can make Stay unavailable during an outage.

No client can learn about a remote disable while disconnected. A 24-hour lease does not provide immediate remote revocation and must not be described as doing so. If the lease expires offline, fail closed for new Stay operations even if the cached Admin config says enabled. Local clock changes are also a limitation on a user-controlled Desktop; signed/validated server time and a persisted high-water mark can reduce accidental tampering but cannot make the local device a hardened security boundary.

### 4.3 Offline behavior

| Condition | Recommended behavior |
|---|---|
| Fresh valid config says enabled and a valid lease covers the same version | Allow activation checks to continue, subject to authentication, employee permissions, and business match. |
| No cache and refresh unavailable | Fail closed for new Stay activity; do not infer enabled from Restaurant mode or vertical profile. |
| Last valid enabled config has an unexpired lease and network is down | Permit normal local-first activity only to the extent allowed by later Stay operation policy; Phase 1 itself defines no booking/payment workflows. Clearly mark the lease as offline. |
| Lease has expired and refresh is unavailable | Fail closed for all new Stay operations even if the durable Admin config remains enabled. Permit **read-only access to locally stored historical Stay records** only if approved as a distinct read policy; no edits, queueing, or outbox replay. |
| A fresh remote config explicitly says disabled | Block Stay routes and all new Stay service operations, regardless of an older cache. Preserve local records. The recommendation is to show a disabled/status screen rather than expose historical records until the user/admin explicitly approves read-only history during a known disable. |
| Config changes from enabled to disabled while online | Invalidate active Stay UI state, stop new actions, and pause Stay outbox sends. Preserve every pending operation and label it `blocked_by_module_disable`/needs review; do not delete, silently apply, or auto-replay it after re-enable. |
| Config changes from disabled to enabled | Re-evaluate the active business and employee permission; allow access only after the new version is valid. Pending operations remain individually reconciled; do not blindly replay. |

The distinct treatment of an **expired client lease** versus **explicit remote disable** is intentional: expiry means the client cannot determine current status and must fail closed for new operations, while explicit disable is a known Admin decision. The separate read-only history policy needs product approval.

## 5. Security and minimum Phase 1 authorization checks

These are separate checks; passing one must not imply the others:

1. **Module activation:** Durable Admin config says this business is enabled, and a valid unexpired lease authorizes the client to rely on that config offline.
2. **User authentication:** The current user/session is valid. The Desktop's ordinary `AuthForm` creates a local `local_admin` user and its owner master password unlocks that local profile. Google/Firebase auth is separately used for cloud sync. This is not currently a general per-employee Desktop sign-in flow.
3. **Employee permission:** The authenticated employee may perform a specific Stay action. Existing `StaffPermissions` only contains Restaurant/retail-oriented flags (`can_discount`, `can_cancel_item`, `can_change_table`, `can_view_reports`, `can_access_cash_drawer`, and discount limit); no `stay.view` or `stay.manage` is present. `StaffPermissionsDialog` is deprecated and returns no UI. Existing staff are managed in `businesses/{biz}/staff/{staffId}` and join-code authentication/role enforcement are documented as Android Cloud Function and Firestore-rules behavior, not verified here for Desktop use. Do not create a parallel login/authentication system.
4. **Business isolation:** The canonical business from the trusted session/context equals the config and record `business_id`; reject missing or mismatched identities.
5. **Service-level enforcement:** Every future Stay query/mutation calls a shared guard, not just the route. Cloud operations must also enforce business and Admin policy where server-mediated.

### Minimum Phase 1 authorization work

Existing authentication cannot currently satisfy a least-privilege staff authorization requirement for Stay. Reuse the existing staff identity/session and staff document when one is available; extend the existing permission model and enforcing service/rules rather than building another auth flow. For Desktop's current owner-only local login, decide explicitly whether owner access is allowed and how the signed-in staff identity is established before exposing employee-level actions.

Minimum additional work after approval:

- define a Stay permission schema on the existing staff member record (at least `stay.view`, `stay.manage`) and update its parse/validation/editor path;
- define a role-to-permission policy or explicit per-employee grants; existing generic roles (`owner`, `manager`, `cashier`, `staff`) and custom labels do not imply Stay rights;
- ensure the existing Cloud Function/session and Firestore rules validate the staff identity, active status, business, and permission for server-mediated operations; validate this in the external Android/backend repository;
- use the same verified signed-in staff identity in Desktop route and service checks; do not trust renderer/localStorage role fields as authoritative;
- preserve owner/master-password offline access only under an explicitly approved local policy. It is not a secure employee identity or cloud authorization.

Once that shared authorization source exists, a guard such as `canAccessStay({ config, lease, now, authenticatedUser, activeBusinessId, permission, action })` should require:

- valid authenticated session;
- valid config for `module === 'stay'` plus a valid, unexpired lease bound to `config.version`;
- config `business_id` exactly equals canonical active business ID;
- `enabled === true`;
- a specific employee permission for the requested action;
- explicit denial on malformed/missing config, stale version, storage/config parsing error, or business mismatch.

Return structured denials such as `AUTH_REQUIRED`, `MODULE_DISABLED`, `LEASE_EXPIRED`, `BUSINESS_MISMATCH`, and `PERMISSION_DENIED`. Do not turn errors into success-shaped defaults.

The current shared `FeatureGate` is a navigation UX guard. The local service guard is an honest-usage/application integrity check. Neither protects IndexedDB from a technically capable device owner. Server-side policy is authoritative only for operations that actually go through that server.

## 6. Restaurant protection and business isolation

- Keep all existing Restaurant routes, controls, feature-switch precedence, and data tables unchanged.
- Add a Stay-specific route guard; do not add `stay_enabled` to the generic `FeatureId` map unless a separately reviewed feature-gate design requires it.
- Use a separate Stay config resolver and service guard. An absent/invalid Stay config must close Stay only; it must not change Restaurant state.
- Do not write to Restaurant order/sales/ledger tables as part of activation.
- Keep all Stay queries business-filtered and verify ownership of each entity reference before a read/write.
- Direct navigation to a Stay URL must render a blocked/expired state and not load operational data.
- Every future Stay repository/service entry point must call the same guard, even when called without React/UI.
- Regression tests must show identical restaurant behavior before/after enabling/disabling Stay.

The proposed Stay route namespace is not finalized. Tests should use whichever route is selected and cover nested paths, query strings, trailing slashes, and direct URL entry.

## 7. Implementation boundaries (plan only)

### 7.1 Desktop implementation

Requires Desktop repository access. Resolve the local ID → cloud `biz_<uid>` context, obtain an authorized server-issued lease, persist config/lease separately, validate on startup/foreground/reconnect/periodic refresh, and apply route/service policy. Employee access depends on the shared staff authentication/permission decision; do not invent a local parallel role system. Add focused Desktop tests and existing Restaurant regression coverage.

### 7.2 Admin/backend implementation

Requires the KamaiPlus Android/Admin repository, deployed Firebase project configuration, and authorized access to Firestore rules/Cloud Functions. Confirm the Admin Console business identity, canonical business path, Admin-only write policy, server-side membership/licence binding, durable config version/audit behavior, and lease issuance/validation endpoint. A permanent config document must not expire; the service issues a short-lived lease on refresh. The existing `desktopLicence` path is licence/device-scoped and must not be treated as business authorization without a verified association.

### 7.3 Android implementation

Requires Android repository access. Confirm the current Firebase UID → business ID mapping and employee session/role enforcement; consume the identical Admin config and server-issued lease; use the same expiry/version/business rules; test offline expiry and cross-client fixtures. Android-only test results do not replace Desktop acceptance.

### 7.4 Cross-platform integration and acceptance

Requires both repositories and a shared test environment. Test Admin writes, backend issuance, Desktop and Android parsing, business isolation, online propagation, offline lease expiry, employee authorization, and Restaurant non-regression. Phase 1 is not complete based on Desktop-only tests.

## 8. Exact files and services likely to change

### Existing Desktop files

| File | Planned Phase 1 responsibility |
|---|---|
| `adminLink.js` | Persist and validate the client config/lease cache separately from generic forced feature switches; keep durable Admin fields and lease metadata distinct. |
| `licence.js` | Parse activation/lease returned by the existing check-in only if the backend verifies the business association; a device licence is not the business ID. |
| `main.js` | Refresh/cache activation and lease, deliver updates to renderer, handle startup/foreground/network refresh policy, and stop authorizing operations at lease expiry. |
| `preload.js` | Expose a narrow typed getter/change event only if generic `getAdminControl` cannot safely provide the new config. |
| `src/lib/desktop/desktopBridge.ts` | Define the shared typed response and bridge contract. |
| `src/components/admin/AdminControlHost.tsx` | Consume activation status changes and invalidate Stay UI state; avoid changing existing global/Restaurant mode behavior. |
| `src/lib/admin/adminControl.ts` | Keep generic admin controls intact; add or delegate separate Stay config parsing/status logic only if consistent with existing pure-helper patterns. |
| `src/components/features/FeatureGate.tsx` | Add Stay direct-route gate without changing existing route-to-feature behavior. |
| `src/components/layout/Sidebar.tsx` | Show/hide the future Stay entry based on activation and permission. |
| `src/components/layout/BusinessProvider.tsx` | Supply/resolve active business identity if required. The canonical cloud/local ID mapping must be settled first. |
| `src/components/layout/AppShell.tsx` | Mount config/route state in the correct business/auth context only if a dedicated provider is needed. |
| `src/lib/auth.ts`, `src/lib/auth/session.ts`, `src/components/auth/AuthForm.tsx` | Reuse only after the actual Desktop auth path is agreed. Current `AuthForm` creates local `local_admin`; the JWT helper is not used by production code paths found in this repo. Do not treat either as employee authorization without validation. |
| `src/lib/cloud/cloudAccount.ts`, `src/lib/cloud/cloudContract.ts`, `src/lib/cloud/cloudPull.ts`, `src/lib/cloud/cloudPush.ts` | Resolve and test the existing local-business-ID ↔ `biz_<Firebase uid>` mapping; do not replace the local Dexie ID or conflate it with a device/licence ID. |
| `src/lib/cloud/staff.ts`, `src/components/settings/staff/StaffPermissionsDialog.tsx` | Reuse/extend existing staff record and permissions only after the external staff authentication/rules path is verified. Current Stay permissions are absent and the dialog is deprecated/empty. |

### New Desktop modules likely required

- A typed `stayModuleConfig` and separate lease contract/validator/cache-status resolver.
- A Stay access-policy helper (activation + lease + business + verified employee permission).
- Focused unit/integration tests in the existing test harness.

Exact filenames should follow project conventions after inspection; no files are being created in source during this planning task.

### External Admin/Android/backend services (not in this workspace)

- Admin Console screens/models (documented in the Android repo, including `admin_models.dart`).
- `desktopLicence` Cloud Function and its control-selection logic (documented in external `functions/licence_core.js`).
- Firestore rules/admin write authorization and shared business config rules.
- Android app config model, fetch/cache/expiry, route/service guards, and compatibility tests.

The external repository paths and current deployed implementations must be confirmed before Phase 1 starts.

## 9. Phase 1 non-goals

- No Dexie table or schema change.
- No migration.
- No room, booking, guest, folio, payment, invoice, or night-audit workflow.
- No Restaurant restructuring or sales/ledger changes.
- No claim of immediate remote revocation on an offline device.
- No claim that local guards secure data from the device owner.
