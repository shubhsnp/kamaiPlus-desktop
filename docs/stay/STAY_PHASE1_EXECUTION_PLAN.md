# Kamai Plus Stay — Phase 1 Execution Plan

**Status:** Preparation only; no application implementation is authorized or performed  
**Recommendation:** **NOT READY** for cross-platform Phase 1 implementation  
**Scope:** Stay module activation/configuration and minimum access boundary only. No Stay operations, schema changes, or migrations.

## 1. Executive recommendation

The architecture is feasible in principle, but the currently available Desktop repository is not sufficient to complete Phase 1. It has a generic per-device/global Admin-control path, but no verified business-scoped Stay entitlement or lease. The Android/Admin repository, Cloud Functions, and deployed Firestore rules are unavailable. Desktop cloud sync is explicitly disabled, local and cloud business IDs differ, and the ordinary Desktop login is a local owner/master-password profile rather than a verified employee session.

Accordingly:

- Do not begin an integrated Stay toggle, route, or permission implementation now.
- First obtain the external Android/Admin/backend source and staging access, confirm canonical business identity and employee authentication, and freeze the shared contract with owner approval.
- Once those gates are met and source-code work is approved, the first low-risk Desktop code task is a pure, side-effect-free config/lease parser and access-policy validator with deterministic tests. Do not connect it to UI, Electron IPC, storage, or a backend until the contract and trusted identity inputs are approved.

This is not a request to start that code task. This document and its companion planning files are documentation-only deliverables.

## 2. Current workspace and implementation reassessment

### 2.1 Verified current Desktop source

Direct inspection of the current code confirms:

| Area | Current implementation | Phase 1 consequence |
|---|---|---|
| Stay module | No Stay route, module service, config model, lease/cache, or `stay.view`/`stay.manage` permission found in current `src`, Electron entry points, or scripts. | No Stay activation task is completed in source. |
| Vertical profile | `src/lib/business/verticalProfile.ts` has `grocery`, `pharmacy`, `clothing`, `hardware`, `restaurant`, and `retail`; no Stay vertical. | Keep Stay out of the existing vertical profile. “Under Restaurant” is product/module placement, not a reason to alter Restaurant profiles. |
| Feature switches | `src/lib/features/featureSwitches.ts` defines the generic switch list and the separate `restaurant_mode` override. Stay is absent. | Do not add business activation to `FeatureId`, Restaurant preset logic, or generic local feature overrides. |
| Admin control | `adminLink.js` cleans a per-PC response into generic mode/features/version/check-in/command fields and saves `admin_control.json`. `src/lib/desktop/desktopBridge.ts` models those fields. | This is not a business config or lease; do not make a malformed Stay response fall back to generic `normal` control. |
| Electron delivery | `main.js` polls the licence service and forwards generic control via `preload.js`; `AdminControlHost` applies feature overrides and lock/read-only/update UI. | Existing controls can be preserved as-is. Any Stay transport needs a separately approved business-aware authorization contract. |
| Route handling | `AppShell.tsx` wraps authenticated content in `FeatureGate`; `FeatureGate.tsx` gates existing features and Restaurant mode. `Sidebar.tsx` currently has no Stay entry. | A future Stay route needs independent activation and permission checks at route and service boundaries. |
| Cloud identity | `cloudAccount.ts` derives `biz_<Firebase uid>`; onboarding/local data uses a distinct local ID; cloud mapping carries both. | The cloud ID is not a substitute for an authenticated business resolver. |
| Cloud availability | `src/lib/firebase/cloudAvailability.ts` sets `CLOUD_SYNC_ENABLED = false`; general Firestore sync paths return without syncing. | Existing cloud sync cannot be assumed to transport or authorize Stay config. |
| Authentication | `AuthForm.tsx` unlocks a local profile with the local master password. Google/Firebase account linking is distinct. | No verified Desktop employee session exists to enforce Stay staff permissions. |
| Staff permissions | `src/lib/cloud/staff.ts` has Restaurant/retail-oriented flags; no Stay grants. `StaffPermissionsDialog.tsx` is deprecated and returns no UI. | Reuse/extend the existing staff path only after its external sign-in and enforcement are verified. No parallel auth system. |
| Database | No Stay schema/table or migration is present. | No database work belongs in this phase. |
| Tests | `package.json` provides custom E2E/smoke/cloud scripts; no conventional unit-test file set or Jest/Vitest runner was found under `src`. | Add focused pure tests using existing project conventions; do not add a dependency just for this phase. |

### 2.2 Existing Git changes to preserve

At the start of this preparation, the `main` branch worktree was already dirty. These changes are not attributed to this task and must not be reverted or overwritten:

**Modified tracked files**

- `scripts/e2e_simulation.ts`
- `scripts/electron_e2e.mjs`
- `src/components/billing/BillPrinterSetup.tsx`
- `src/components/restaurant/FastPosScreen.tsx`
- `src/components/restaurant/OrderPanel.tsx`
- `src/components/restaurant/OrderScreen.tsx`
- `src/components/restaurant/PayDialog.tsx`
- `src/components/restaurant/RestaurantPage.tsx`
- `src/components/settings/PrintSettingsCard.tsx`
- `src/lib/constants/version.ts`
- `src/lib/restaurant/words.ts`
- `src/lib/whatsNew/changelog.ts`
- `src/lib/whatsNew/changelogOlder.ts`
- `src/locales/hi.json`
- `src/locales/mr.json`

**Pre-existing untracked design/catalog work**

- `COST_AND_DEPENDENCY_REGISTER.md`, `DATABASE_CHANGE_PLAN.md`, `DEVELOPMENT_ROADMAP.md`, `EXISTING_FEATURE_INVENTORY.md`, `KAMAI_STAY_ARCHITECTURE.md`, `RISK_REGISTER.md`, `SYSTEM_ARCHITECTURE.md`
- Existing Stay design documents, including the six documents reviewed for this plan and the rest of the Stay package
- `docs/kamaiplus-stay/`
- Existing `kamaiPlus_*_batch1.json` catalog files (exact names are in the worktree status)

The three planning documents created for this task are new documentation files. No existing source, tests, locale, schema, design document, or catalog file was modified.

### 2.3 Completed, incomplete, and not implemented

| Phase 1 item | Current status |
|---|---|
| Desktop generic Admin control plumbing | Implemented for per-PC/global control, not Stay or business-scoped activation. |
| Business-scoped Stay Admin config | Not implemented or verified in any available Admin/backend source. |
| Client lease issuance/validation | Not implemented. |
| Desktop config/lease consumer | Not implemented. |
| Canonical Desktop/Admin/Android ID mapping | Desktop local-to-cloud mapping is verified; Admin/Android/licence association is unresolved. |
| Desktop employee authentication and Stay permissions | Not implemented/verified. |
| Stay route/service guards | Not implemented; no Stay route/service exists. |
| Android parity | Cannot be verified; Android repository is absent. |
| Admin/backend enforcement | Cannot be verified; source and deployed rules are absent. |
| Tests for Stay activation | Not implemented. Existing Phase 1 test cases are plans, not test results. |
| Restaurant protection | Existing Restaurant code exists; no Stay changes are present to regress it. Preserve all current and uncommitted Restaurant work. |

## 3. Prior-document status and corrections to carry forward

Use the latest decisions in `STAY_PHASE1_FINAL_DECISIONS.md` and the evidence boundary in `STAY_CROSS_REPOSITORY_READINESS.md` as the current planning basis. Earlier documents remain useful for requirements and tests, but these points are superseded or still proposals:

1. `STAY_FINAL_ARCHITECTURE_REVIEW.md` §5 has an illustrative config sample combining `state`, `expires_at`, and `cache_ttl_seconds`. It is superseded by the final decision: durable Admin config has `enabled` and no expiry; client lease/cache is separate; do not duplicate `enabled` with `state`.
2. The earlier “partially ready” Phase 1 assessment is superseded by the later final decision and cross-repository assessment: **not ready to implement** until external identity, backend, permission, and staging evidence is available.
3. Any sample Firestore path or proposed endpoint in the design documents is a proposal only. No path or Stay API is an existing implementation.
4. The 24-hour lease and 15-minute refresh interval are recommendations in the decision documents, not approved policy or current Desktop behavior. Obtain owner approval before hardcoding either.
5. The proposed roadmap puts Android/offline synchronization late, but canonical config, auth, business mapping, and the authoritative service boundary are prerequisites to cross-platform acceptance and to any operation that could claim a confirmed result.
6. Phase 1 test cases for pending operation/outbox handling should use test doubles in this phase. Stay booking/payment/outbox behavior does not yet exist and remains out of scope.

## 4. Target architecture

### 4.1 Canonical data contract

One Admin-authoritative config is business-scoped and shared by Desktop and Android:

```text
business_id
module = "stay"
enabled
version
updated_at
updated_by
source
```

It is durable and has no expiry. Do not include an Admin-document TTL or disable the business just because the document has not changed recently.

The client authorization lease is separate:

```text
fetched_at
last_successful_refresh_at
expires_at
last_server_time
cached_config_version
```

The approved integrity/signature envelope, authentication input, lease duration, endpoint/transport, cache storage, and clock policy remain contract decisions. Validate the server response against the canonical business/module/version; reject missing, malformed, mismatched, expired, or stale data. Failure must not create an enabled default.

### 4.2 Authorization layers

An allowed Stay action requires all independent checks:

1. Authenticated user/session from the approved existing identity path.
2. Trusted canonical active `business_id`; it must match the config and requested data.
3. Valid durable config with `module === "stay"` and `enabled === true`.
4. Valid, unexpired lease bound to the exact config version.
5. Explicit permission for the operation (minimum `stay.view` and `stay.manage`, subject to approved policy).
6. Service-level guard; route/navigation checks are additional UX guards, not the sole enforcement.

Admin module activation does not grant employee permissions. Local Electron/Dexie guards cannot secure data from the device owner. Cloud-side enforcement applies only to operations actually handled by the secured service/rules.

### 4.3 Flow

```text
Kamai Plus Admin [external repo]
  └─ authorized business-scoped durable config
       └─ existing or newly approved backend service [external repo]
            ├─ verifies caller/business association
            ├─ reads config and issues server-timed lease
            └─ enforces server-side policy where applicable
                 ├─ Desktop: validate/cache → service guard → route/nav
                 └─ Android: same contract/lease → service guard → route/nav
```

The current Desktop licence check-in is device-key/machine-ID based and does not send canonical `business_id` or Firebase ID token. It may only be reused if the external backend proves a trusted business association. Do not treat the current generic control response as the new contract.

## 5. Behavior and implementation boundaries

### Admin activation

- Admin enable/disable changes one business's durable config and increments its version.
- A confirmed disabled response blocks new Stay actions on receipt and preserves records.
- Admin config remains enabled or disabled regardless of document age; only the separate lease expires.
- No immediate remote-disable claim is made for offline devices.

### Offline and expiry

- Online startup/refresh behavior, background cadence, lease TTL, server-time validation, and history access after expiry require approval.
- Recommended behavior is to use the last valid enabled config only while its matching lease is unexpired.
- Missing/expired/invalid lease or wrong business fails closed for new Stay activity.
- A fresh disabled config takes effect immediately on receipt.
- Pending operations are preserved and paused on disable/expiry; never silently deleted or automatically replayed after re-enable.
- Read-only historical access after expiry/explicit disable is unresolved; do not implement it by default without approval.

### Employee permissions

- Verify and reuse the existing staff identity/session path before adding Stay permissions.
- If Desktop cannot consume the existing staff session, resolve that integration with the Admin/backend/Android owners; do not create a second login system.
- Decide explicitly whether the local `local_admin` owner profile can access Stay and define its local-only limitations.
- Do not infer access from labels such as `manager`, `cashier`, or generic `role`.

### Desktop-only work

Can be developed in this repository only after the shared contract and trusted identity inputs are approved:

- Pure typed parser/validator and policy helpers.
- Dedicated config/lease state separate from generic admin-control feature overrides.
- Desktop transport/cache adapter only after the authorized server contract is available.
- Stay-specific route and service guards, once a route exists.
- Deterministic Desktop tests and Restaurant regression tests.

Desktop-only work cannot deliver Admin activation, prove business ownership, establish employee authentication, or complete Phase 1.

### External work

Admin UI/writer, backend identity resolution and lease issuance, Firestore rules, external staff/session enforcement, Android client, and cross-platform integration require the missing repositories and staging environment. Detailed ownership and dependencies are in `STAY_PHASE1_EXTERNAL_DEPENDENCIES.md`.

## 6. Ordered execution gates

| Order | Gate/task | Owner/repository | Completion condition |
|---:|---|---|---|
| 0 | Acquire and inspect Android/Admin/Functions/rules source; verify staged deployments | External owners | Source and environment evidence available; documented claims checked against source/deployed config. |
| 1 | Approve canonical business ID, durable config, lease, authentication, permissions, offline/history policy | Product + platform owners | One shared contract and explicit decisions approved; no unresolved identity/auth blocker. |
| 2 | Implement Admin-authoritative config and backend lease/enforcement | Admin/backend repository | Admin writes are authorized/audited; correct business receives server-timed version-bound lease; wrong-business/unauthenticated requests fail. |
| 3 | Implement Desktop pure contract/policy validation | Desktop repository | Deterministic parser/policy tests pass; no storage/IPC/network/UI changes in this isolated task. |
| 4 | Integrate Desktop authorized refresh, cache and IPC/provider | Desktop repository | Uses approved trusted identity and transport; invalid/expired states fail closed; Restaurant untouched. |
| 5 | Integrate Desktop route/navigation and service guard; staff permission source | Desktop repository + shared auth owner | Direct route and non-UI service calls deny invalid activation, business, session, or permission. No parallel auth. |
| 6 | Integrate Android with the same contract and existing auth | Android repository | Same fixture behavior, version/expiry rules and permission semantics. |
| 7 | Cross-platform staging acceptance | All repositories | Admin → backend → Desktop/Android lifecycle, business isolation, online/offline, restart, permission, and Restaurant tests pass. |

Dependencies are real gates, not just suggested ordering. Do not start tasks 3–6 against placeholder business IDs or mock authorization and later call them integrated.

## 7. Test plan

Use `STAY_PHASE1_TEST_CASES.md` as the detailed scenario source. At minimum:

| Requirement | Existing case IDs |
|---|---|
| Admin enable, disable, re-enable, malformed/missing config | P1-EN-01 through P1-EN-07 |
| Two businesses, wrong business, stale/same-version response | P1-SC-01 through P1-SC-10 |
| Authentication and employee permission restrictions | P1-AU-01 through P1-AU-10 |
| Offline startup, reconnection, expiry, refresh, restart | P1-OF-01 through P1-OF-17 |
| Active screen and paused pending operations | P1-PD-01 through P1-PD-04 |
| Direct URL and service-call protection | P1-GD-01 through P1-GD-05 |
| Restaurant non-regression and existing data | P1-RG-01 through P1-RG-06 |
| Desktop/Android parity and Admin write policy | P1-AX-01 through P1-AX-07 |

### Test harness guidance

- `package.json` currently has `test:e2e` (`scripts/e2e_simulation.ts`), `test:electron`, `test:smoke`, and `test:cloud`. There is no conventional unit-test runner configured.
- Keep contract/policy tests deterministic with an injected clock and fake transport. Follow existing test-harness conventions; do not install a test dependency without a demonstrated need.
- Use Electron E2E for direct navigation, restart, and user-visible lifecycle only when those UI paths exist.
- Use external staging/Functions/Firestore rules tests for Admin authorization, business isolation, and issued leases. Desktop mocks do not prove backend enforcement.
- Overall acceptance requires Android and Desktop shared fixtures and staging integration. A Desktop-only result is not Phase 1 completion.

## 8. Phase 1 acceptance and non-goals

Phase 1 is complete only when:

1. Admin has one authorized durable business-scoped config with monotonic version/audit fields.
2. Backend issues and validates a lease independently from Admin config age.
3. Desktop and Android use the same canonical business ID and contract.
4. Existing employee identity is reused and explicit Stay permission checks are verified.
5. Missing, invalid, wrong-business, disabled, stale, and expired state fails closed for new Stay operations.
6. Offline behavior, active screen invalidation, and pending-operation preservation are tested without claiming instant offline revocation.
7. Direct routes and future service entry points are guarded independently.
8. Existing Restaurant features, data, feature precedence, and uncommitted Restaurant changes are preserved.
9. Desktop, Admin/backend, Android, and cross-platform acceptance gates pass.

**Explicitly out of scope:** rooms, room availability, guests, bookings, check-in/out, folios, payments, invoices, night audit, Stay database tables, Dexie migrations, Restaurant business-logic changes, and Android-specific activation systems.

## 9. Approval boundary

No source changes have been made. Before implementation, obtain owner approval for the contract and policy gates in `STAY_PHASE1_FINAL_DECISIONS.md`, plus access to the missing repositories and staging environment. Then approve a discrete task; the recommended first coding task is the isolated Desktop contract parser/policy helper, not a working toggle or route.
