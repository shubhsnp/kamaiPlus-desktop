# Kamai Plus Stay — Cross-Repository Readiness Investigation

**Investigation date:** 2026-11-16  
**Mode:** Read-only repository and source inspection  
**Verdict:** **NOT READY for Phase 1 implementation**  
**Scope note:** Findings below distinguish executable code present in this workspace from comments/design documents about external systems. External repositories and live Firebase permissions were not available for verification.

## 1. Workspace and repository inventory

### 1.1 Repositories found

The workspace root `D:\KamaiPlus Workspace` contains one top-level directory: `KamaiPlus Desktop App`. A bounded repository-marker scan found one Git repository at `D:\KamaiPlus Workspace\KamaiPlus Desktop App\.git`. No Android/Admin repository or Git submodule is present.

The available repository is the Desktop application:

- `package.json` identifies a Next.js/React/TypeScript application packaged with Electron.
- Desktop source includes Dexie/IndexedDB, Firebase client integration, Electron main/preload code, and existing Restaurant features.
- `firebase.json` contains an updates-hosting target only. It has no `functions`, `firestore`, or emulator deployment configuration.
- No `firestore.rules`, `functions/` source tree, `admin_console/`, Android `pubspec.yaml`, Android Gradle project, Android Firebase model/service files, or shared cross-repository package was found in the workspace.
- The Desktop end-to-end harness explicitly asserts that no stale `firestore.rules` copy exists locally. Its checks for Android Admin models, Firestore rules, and Admin services are conditional on a sibling `KamaiPlus Android` directory; that directory is absent.
- `.firebaserc` and `.env.local` exist, but their contents were not read or reported. No credentials or secret values are included in this report.

### 1.2 Working-tree condition

The Desktop Git worktree was already dirty when inspected, with modified Restaurant/UI/locale/test files and numerous untracked design/catalog files. These existing changes were left untouched. This report is the only file created for this investigation; no application source, schema, migration, or deployment configuration was changed.

### 1.3 Repository availability and verification boundary

| Component | Available here? | Evidence level |
|---|---:|---|
| Desktop app source | Yes | Directly inspected |
| Android app source | No | References only in Desktop docs/tests |
| Admin Console source | No | References only in Desktop docs/tests |
| Firebase Cloud Functions source | No | Endpoint references only in Desktop source/docs |
| Deployed Firestore security rules | No | Not present; not queried live |
| Shared Stay model/API package | No | No shared package found |
| Firebase staging project and test accounts | Not verified | `.firebaserc`/`.env.local` contents intentionally not inspected; no live access test |
| Firebase deployment permissions | Not verified | No deployment attempted |

`ENGINEERING_BIBLE.md`, `docs/PLATFORM_TRACKER.md`, and `docs/CLOUD_DATA_CONTRACT.md` contain useful implementation history and external path references. They are documentation, not a substitute for inspecting the absent source or deployed rules.

## 2. Actual business identity flow

### 2.1 Desktop local business ID — verified code

- `src/components/onboarding/onboardingSubmit.ts` creates a local business ID in the form `biz_${safeUidSlice}_${Date.now()}`. The UID source is the current local user UID/ID or a phone-derived fallback; the UID is sanitized and truncated to eight characters.
- `src/lib/db/index.ts` can create a fallback local business ID as `biz_${Date.now()}` when no local business exists.
- `BusinessProvider` reads the first row in `db.businesses`; `AuthForm` uses that local row's `id` for its local owner profile. This provider does not establish a general multi-business selector.
- Restore and cloud-pull paths can retain an existing local business ID. These IDs are local Dexie identities, not proof of cloud or Admin identity.

### 2.2 Desktop cloud business ID — verified code, but sync is currently gated off

- `src/lib/cloud/cloudAccount.ts` creates `biz_<Firebase uid>` after Google sign-in and stores the cloud account locally.
- `src/lib/cloud/cloudPush.ts` carries both `account.bizId` and `localBiz.id` as distinct values.
- `src/lib/cloud/cloudContract.ts` maps outgoing cloud `business_id` to the cloud `bizId`; `src/lib/cloud/cloudPull.ts` maps pulled records back to the local business identity.
- `src/lib/firebase/cloudAvailability.ts` currently sets `CLOUD_SYNC_ENABLED = false`, which gates the general cloud-sync paths. Firebase Auth and cloud-account linking code exist, but this does not establish an active Stay configuration service.

Therefore the currently verified Desktop relationship is:

```text
local Dexie business ID (biz_<short UID>_<timestamp> or fallback)
       ↕ explicit Desktop sync context mapping
cloud business ID (biz_<Firebase UID>)
```

The local ID is not simply interchangeable with the cloud ID.

### 2.3 Android, Admin, licence, and device IDs

| Identity | What is verified | What remains unknown |
|---|---|---|
| Android business ID | Desktop `docs/CLOUD_DATA_CONTRACT.md` documents `biz_<Firebase uid>` as the shared Firestore business ID. | Android implementation and deployed behavior are not available to inspect. |
| Admin Console business ID | Existing Desktop Admin documentation refers to per-key `desktop_licences/{KEY}` controls and global `platform_settings/desktop_control`. | No business-scoped Admin ID or Stay config source is verified. |
| Desktop licence key | Desktop `licence.js` sends the key to `desktopLicence`; docs identify the key record under `desktop_licences/{KEY}`. | No verified association to a business ID is present in this workspace. |
| Machine ID | Desktop computes a machine-derived ID and binds the signed local licence to it. | It identifies a PC for licence purposes, not a business. |
| Cloud sync device ID | `cloudPush.ts` creates a separate `desk_*` identifier for sync operations. | It is not a licence key or business ID. |

**Conclusion:** Desktop's local-to-cloud mapping is verified. The Admin Console and Android business mappings, and any server-maintained licence-to-business association, are unknown. Phase 1 must not substitute a licence key, machine ID, local row ID, staff ID, or `desk_*` ID for canonical `business_id`.

## 3. Admin activation flow

### 3.1 Existing Desktop remote control — verified Desktop side

The existing Desktop control path is device-oriented:

1. Electron main-process `licence.js` posts a licence action, key, machine ID/name, app version, and optional health/report data to the `desktopLicence` endpoint.
2. The response may include `body.control`. The Desktop client code does not send a Firebase ID token or `business_id` in this licence request.
3. `adminLink.js` `cleanControl()` whitelists mode, reason, feature overrides, minimum version/update hold, check-in minutes, and commands. Unknown fields are dropped.
4. `adminLink.js` saves the cleaned control in user-data `admin_control.json`.
5. `main.js` checks in at its configured interval and sends changed control to the renderer through Electron IPC; `preload.js` exposes `getAdminControl()` and `onAdminControl()`.
6. `AdminControlHost` applies feature overrides and lock/read-only/update UI behavior. The generic `FeatureGate` is a renderer route/UX gate; it does not implement a Stay service or database boundary.

The current control type has no Stay module, `business_id`, config version, or authorization lease.

### 3.2 Admin writer and Firestore location — documentation-only evidence

Desktop `ENGINEERING_BIBLE.md` and `docs/PLATFORM_TRACKER.md` say the separate Admin Console writes per-PC/per-licence control to `desktop_licences/{KEY}.admin_control` and global-to-Desktop control to `platform_settings/desktop_control`, and that `desktopLicence` merges these controls. The Admin Console and Cloud Function sources are absent, so current writes, role checks, exact deployed schema, and deployment status were not independently verified.

No business-scoped Stay toggle or durable Stay config was found in the Desktop code. Existing Restaurant mode is a separate Admin/feature mechanism and is not proof of Stay activation.

### 3.3 Propagation behavior

- The verified Desktop licence check-in is periodic: the main-process watch ticks every five minutes and performs a check-in when the configured interval elapses. The default check-in interval is one hour; the generic Admin control can set 15–360 minutes.
- Desktop also contains `desktopLiveListener.ts`, which listens to `desktop_signals/{licenceKey}` and `desktop_signals/global`. A newer ping triggers `refreshLicence()`; the client then obtains and validates the control through the licence endpoint. The signal is not itself the authoritative command/config.
- Successful Firestore listener reads depend on external Firebase Auth state and deployed Firestore rules. Those were not tested in this investigation. Historical Desktop documentation records permission issues, but does not prove current production rules.
- None of these mechanisms proves immediate delivery to an offline device. The listener is not a Stay business-config subscription.

## 4. Backend authorization flow

### 4.1 What Desktop code establishes

- The licence client verifies the returned Ed25519-signed licence locally, checks the payload's machine ID, and enforces the signed licence validity date using a persisted clock high-water mark.
- The online licence request is device-key/machine-oriented. The request body shown in `licence.js` has no Firebase ID token and no `business_id`.
- Staff-management join-code creation in `src/lib/cloud/staff.ts` does obtain the owner's Firebase ID token and sends it as a Bearer token to the external `staff` Cloud Function. The Desktop code only implements the client request.
- Desktop Firestore reads/writes use the Firebase client SDK and therefore depend on deployed Firestore rules; those rules are not present locally.

### 4.2 What cannot be verified

The `desktopLicence`, `staff`, and related Cloud Function implementations are not in the workspace. Consequently this investigation cannot verify:

- Server-side licence-key validation, Admin authentication/authorization, or exact Firestore transaction behavior.
- Whether a device licence is mapped to a business, or whether the server can securely determine which business the Desktop should access.
- Any existing business-scoped module config read/write API.
- Lease issuance, server-time expiry, signed lease validation, replay/version policy, or business membership checks.
- Staff join-code exchange, custom token claims, staff deactivation/revocation, or function-level authorization.
- Whether Firestore rules enforce tenant/business ownership and staff role/permission boundaries as described in the Desktop documentation.

The locally embedded public key verifies a licence response's signature; it does not prove a Stay entitlement or authorize business-scoped Stay data access.

## 5. Desktop staff authentication and permissions

### 5.1 Verified implementation

- The ordinary Desktop `AuthForm` creates a local `local_admin` profile and uses a local master password to unlock it. This is local owner access, not per-employee authentication.
- Google sign-in/Firebase Auth code exists in `cloudAccount.ts` for linking the shop's cloud account. It is not the employee sign-in flow.
- `src/lib/auth/session.ts` defines a JWT payload with `staff_id`, `business_id`, phone, and broad roles. Repository search found no production call sites for its signing/verifying functions; the helper is not evidence of active Desktop employee authentication.
- `src/lib/cloud/staff.ts` defines staff role options and a `StaffPermissions` type for discount, cancel-item, table, report, and cash-drawer capabilities. It parses and writes such fields on staff documents.
- No `stay.view` or `stay.manage` permission exists in the Desktop model. Searches found no current authorization use of the existing permission flags beyond parsing/writing them.
- `StaffPermissionsDialog` is explicitly deprecated and returns `null`.
- Desktop Settings → Staff can manage staff records and request a one-time join code from the external staff function. This is not a Desktop staff login implementation.

### 5.2 Assessment

The Desktop can represent some staff metadata and request staff join codes, but it does not currently establish a verified signed-in employee identity for Desktop Stay actions or enforce Stay-specific permissions. A separate local role system should not be added. The existing external staff authentication and enforcement path must be inspected, then deliberately integrated/reused or extended for Desktop and Stay.

Owner access through the local master-password profile is a separate policy decision. It must not be presented as server-side employee authorization.

## 6. Android staff authentication and permissions

### Verified versus documented

No Android source is present. Desktop comments and engineering documents describe a staff join-code flow, an external `staff_core.js` Cloud Function, staff-specific sign-in, and Firestore rules that restrict staff to permitted work. The documents also mention custom claims and staff revocation behavior. These are **documentation-only references for this investigation**, not findings verified from current Android code or deployed rules.

### Required external verification

Inspect the Android app's actual:

- Google/owner authentication and business selection/resolution.
- Staff join-code redemption and custom-token/session creation.
- Staff identity, role, active-state and business claims.
- Role and per-user permission models and where each is enforced.
- Sign-out/revocation behavior after staff removal.
- Stay-specific support (currently unverified) and compatibility with Desktop's proposed permission checks.

## 7. Firestore security rules and Cloud Function enforcement

- No `firestore.rules` or Cloud Functions source is present in the Desktop repo.
- `firebase.json` configures only the Desktop update-hosting target; it does not deploy Functions or Firestore rules.
- The Desktop E2E suite intentionally checks that no stale local `firestore.rules` copy exists and conditionally inspects the Android repository if available.
- The Desktop cloud data contract documents the expected `businesses/{bizId}/...` path and `biz_<Firebase uid>` convention, but it does not establish the current deployed rules.
- Direct Firebase SDK use in the Desktop means effective server-side read/write policy depends on the external deployed Firestore rules. No live rules test was performed.
- Current Desktop UI/route guards are not a security boundary against a user controlling the device. Any cloud-side Stay enforcement must be implemented and verified in Functions/rules; local guards support correctness and UX only.

## 8. Missing dependencies and access

Before Phase 1 can be implemented or accepted, provide or verify:

1. The KamaiPlus Android repository, including application auth/business selection, Admin Console, Cloud Functions, Firestore rules, and tests.
2. The exact deployed Firebase project/environment for Admin config and a non-production staging project/test accounts.
3. Read access to current deployed Firestore rules and function versions, and authorized staging/deployment access for the responsible owners.
4. The canonical business identity shared across Desktop, Admin Console, Android, and any licence association.
5. A business-aware authorization/lease endpoint contract and its verified server-side authentication, authorization, expiry, version, and integrity behavior.
6. A verified Desktop employee identity path that reuses the existing staff system, plus an approved `stay.view`/`stay.manage` permission policy.
7. Joint Desktop/Android/Admin test ownership and release/deployment approval.

The Desktop `.env.local` file was not read and must not be treated as evidence that staging credentials or deployment privileges are available. No secrets or credential contents were accessed for this report.

## 9. Cross-platform integration diagram

### Existing behavior (verified Desktop client; external implementation documented, not verified)

```text
Admin Console / Firestore controls [external source not present]
        │ per-licence or global Desktop control (documented)
        ▼
desktopLicence Cloud Function [source not present]
        │ signed licence + optional control response
        ▼
licence.js ── signature/machine validation
        ▼
main.js ── adminLink.js ── userData/admin_control.json
        │
        ├── preload.js IPC ── AdminControlHost / generic feature UX
        │
        └── desktop_signals ping (if readable) ── refreshLicence()

No business-scoped Stay config or client lease exists in this path.
```

### Proposed Phase 1 target (not implemented)

```text
Authorized Admin Console
        │ writes versioned durable config (Admin-only)
        ▼
Canonical business/module config store
        │
        ▼
Business-aware authorization service
  - authenticates requester
  - resolves/validates canonical business ID
  - checks current enabled config and staff/business policy
  - issues time-limited, integrity-protected lease using server time
        │
        ├─────────────────────────┐
        ▼                         ▼
Desktop client                 Android client
config + lease cache           same config + lease cache
route/service checks           route/service checks
existing staff identity        existing staff identity
        └──────────┬──────────────┘
                   ▼
        Cloud Functions / Firestore rules
        enforce server-side policy for cloud operations
```

The canonical document path, lease issuer, caller authentication method, and ID resolver remain architectural decisions, not verified current services.

## 10. Dependency map

| Responsibility | Owning component/repository | Current evidence | Phase 1 dependency |
|---|---|---|---|
| Local business data and offline owner login | Desktop app | Verified Dexie business IDs and local master-password profile | Desktop integration; decide owner policy |
| Desktop cloud business mapping | Desktop app | Verified `biz_<Firebase uid>` mapping, but `CLOUD_SYNC_ENABLED` is false | Canonical resolver and approved authorized config fetch path |
| Desktop licence/device validation | Desktop app `licence.js` + external `desktopLicence` | Client verification verified; server implementation absent | Do not reuse as business auth without verified server association |
| Current Desktop Admin-control rendering/cache | Desktop app `adminLink.js`, `main.js`, `preload.js`, `AdminControlHost` | Verified device/global feature-control client path | Must remain separate from Stay business activation |
| Android app auth, business selection, staff login | Android app repository | Not available; documentation references only | Repository/source and integration tests required |
| Admin activation UI and durable config | Admin Console repository | No Stay config; current control only documented | Admin-only business-scoped writer/schema required |
| Lease and API authorization | Firebase Cloud Functions/backend | No current Stay lease service found | Implement/verify server-issued lease and owner/staff checks |
| Data tenant/staff access enforcement | Deployed Firestore rules | Rules absent locally; live rules not checked | Verify/update rules; test in staging |
| Shared models/contracts | Desktop docs and TS cloud contract only | No shared code package; Android source absent | Agree identical wire contract and shared fixtures |
| End-to-end acceptance/deployment | Desktop + Android/Admin/backend + Firebase staging | Staging/deploy access not verified | Named owners, test credentials, staging and approval |

## 11. Exact work required before Phase 1 implementation

### Gate 1 — Obtain and inspect external evidence

- Check out/provide the Android repository and inspect Admin Console, Android auth/staff flows, `functions/`, `firestore.rules`, tests, and current deployment configuration.
- Verify live/staging rule and Cloud Function versions with the responsible project owner; do not infer deployed state from source history.
- Document which identities Admin Console, Android, Desktop, and the licence service use.

### Gate 2 — Decide and implement the shared authorization contract

- Confirm the canonical `business_id` and a server-trusted mapping for each client.
- Decide the durable Admin config path/writer. The Admin document must not expire.
- Define the separate lease fields, issuer, signature/integrity approach, server-time calculation, refresh behavior, version binding, and expired-lease policy.
- Choose whether a new business-aware endpoint is needed. The current licence request sends device/license details, not a business ID or Firebase ID token; extending that endpoint requires proving how it authenticates the business.

### Gate 3 — Reuse and extend employee authorization

- Verify Android staff code redemption, token claims, role checks, active-state revocation, and Firestore rules from source and tests.
- Decide how Desktop obtains the same staff identity without creating a parallel authentication system.
- Add an approved mapping or explicit grants for `stay.view` and `stay.manage` in the existing staff authorization model and enforcing backend/rules.
- Decide if local `local_admin` owner access is permitted and document its local-only security limitation.

### Gate 4 — Client implementation and verification

- Desktop: consume validated config/lease; preserve local/cloud ID mapping; add route and service checks; integrate approved staff identity; preserve Restaurant/admin-control behavior.
- Android: consume the same config/lease and permission contract; align business identity and offline/expiry behavior.
- Admin/backend: secure Admin writes, lease issuance, and server-side authorization; add tests and deployment review.
- Cross-platform: test shared fixtures, business isolation, config changes, unchanged config renewal, expired lease, staff access, and online/offline transitions in staging.
- Do not declare Phase 1 complete from Desktop-only tests. Require all repository owners' acceptance and deployment sign-off.

## 12. Final readiness verdict

**NOT READY for Phase 1 implementation.**

The available Desktop source proves that a Desktop client can validate its device licence and consume generic per-device/global remote controls. It does **not** prove an existing business-scoped Stay entitlement, a lease service, a Desktop employee identity/Stay permission path, Android/Admin identity parity, or deployed Firestore/Cloud Function enforcement. The proposed architecture is technically plausible, but its critical authorities and repositories are absent from this workspace.

No source, database schema, migration, Restaurant behavior, Firebase rules, or deployment was changed. This investigation created only `STAY_CROSS_REPOSITORY_READINESS.md`. Wait for explicit approval and the external repository/staging access before implementation.

## 13. Evidence reviewed

### Directly inspected Desktop code/configuration

- `package.json`, `firebase.json`
- `licence.js`, `adminLink.js`, `main.js`, `preload.js`
- `src/lib/desktop/desktopBridge.ts`, `src/lib/desktop/desktopLiveListener.ts`
- `src/components/admin/AdminControlHost.tsx`, `src/components/features/FeatureGate.tsx`
- `src/components/layout/BusinessProvider.tsx`
- `src/components/auth/AuthForm.tsx`
- `src/components/onboarding/onboardingSubmit.ts`, `src/components/onboarding/cloudStoreRestore.ts`
- `src/lib/db/index.ts`
- `src/lib/cloud/cloudAccount.ts`, `src/lib/cloud/cloudContract.ts`, `src/lib/cloud/cloudPull.ts`, `src/lib/cloud/cloudPush.ts`, `src/lib/cloud/staff.ts`
- `src/lib/firebase/cloudAvailability.ts`, `src/lib/firebase/config.ts`
- `src/lib/auth.ts`, `src/lib/auth/session.ts`, `src/lib/auth/masterPassword.ts`
- `src/components/settings/staff/StaffPermissionsDialog.tsx`
- Relevant sections of `scripts/e2e_simulation.ts`

### Documentation and test references (not treated as proof of external implementation)

- `ENGINEERING_BIBLE.md`
- `docs/CLOUD_DATA_CONTRACT.md`
- `docs/PLATFORM_TRACKER.md`
- Conditional external-repository checks in `scripts/e2e_simulation.ts`

The Android/Admin source, Cloud Function implementations, deployed Firestore rules, and live staging authorization were not available for direct inspection.
