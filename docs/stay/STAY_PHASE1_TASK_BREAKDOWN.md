# Kamai Plus Stay — Phase 1 Task Breakdown

**Status:** Proposed task plan only; no implementation started  
**Precondition:** Do not change application source until the owner approves Phase 1 and the shared contract/identity/auth gates are resolved.

## Task order and dependency graph

```text
T0 External source/staging verification
  └─ T1 Shared contract and policy approval
       ├─ T2 Admin/backend authoritative config + lease
       ├─ T3 Desktop pure contract and policy core
       │    └─ T2 + T3 → T4 Desktop transport/cache/bridge
       │                   └─ T5 Desktop access wiring and regression
       └─ T2 → T6 Android shared-contract integration
                  └─ T5 + T6 → T7 Cross-platform staging acceptance
```

T2 and T3 may proceed in parallel only after T1 freezes the contract. T4 depends on T2 and T3; T6 depends on T2 and T1. T7 depends on all client/backend tracks. Desktop-only success is not Phase 1 completion.

## T0 — Verify external source, deployed behavior, and access

**Objective:** Replace documentation-only claims with evidence from current Android/Admin/Functions/rules source and an authorized non-production environment.

**Repository/files involved**

- **Available Desktop:** `STAY_CROSS_REPOSITORY_READINESS.md`, `STAY_PHASE1_FINAL_DECISIONS.md`, `ENGINEERING_BIBLE.md`, `docs/CLOUD_DATA_CONTRACT.md`, `docs/PLATFORM_TRACKER.md`.
- **Required external sources:** Android application, Admin Console, Cloud Functions (documentation references include `functions/licence_core.js` and `functions/staff_core.js`), `firestore.rules`, and their tests/deployment configuration. These paths/implementations are not present in this workspace and must be confirmed.
- Firebase staging project, current deployed rules/functions, test identities, and authorized read access.

**Dependencies:** Repository access and accountable Admin/backend/Android owners.

**Expected behavior/output:** Evidence table identifies actual Admin writer, business identity resolution, licence association, staff login/session and permission enforcement, current rules/function versions, staging test path, and deployment ownership. No source changes.

**Failure scenarios:** External repository missing; source differs from docs; staging unavailable; no safe test business/account; deployed function/rules cannot be inspected; secrets would need to be exposed in a report.

**Unit tests:** None; this is a read-only evidence gate.

**Integration tests:** None until a test environment is available.

**Acceptance criteria:** Every external claim used by later tasks is labeled verified, documentation-only, or unknown. No credentials/secrets are copied into planning docs. Owner accepts the remaining known limitations.

## T1 — Freeze the shared activation, lease, identity, and permission contract

**Objective:** Resolve all shared decisions before clients encode incompatible assumptions.

**Files involved:** No application source files. Update the approved contract/decision record if the owner requests it. Create shared JSON fixtures only after approval and in a repository all client owners can use.

**Dependencies:** T0; owner and platform/security approval.

**Expected contract**

- Durable Admin config: `business_id`, `module: "stay"`, `enabled`, `version`, `updated_at`, `updated_by`, `source`; no expiry and no duplicate `state`.
- Client lease/cache: `fetched_at`, `last_successful_refresh_at`, `expires_at`, `last_server_time`, `cached_config_version`; define the signed/integrity envelope separately.
- Canonical business identity and trusted resolver for Desktop, Admin, Android, and any licence association.
- Existing authentication path and employee permission source; minimum Stay capabilities and explicit owner access policy.
- Refresh/lease TTL, clock/rollback handling, propagation target, expired-history access, disable and pending-work behavior.
- Route namespace and user-facing behavior are approved. Initial language support is Marathi and English; Hindi remains future work, using existing i18n conventions.

**Failure scenarios:** Admin and Android use different business IDs; terms conflict; `updated_at` is mistakenly used as lease expiry; the endpoint trusts renderer-supplied business ID; roles imply access without explicit policy; no one approves offline-history behavior.

**Unit tests:** Contract fixture/schema validation vectors for valid, malformed, missing, wrong-business, stale-version, and expired-lease cases.

**Integration tests:** Shared fixture round-trip in Desktop and Android once both sources are available.

**Acceptance criteria:** One approved wire contract and decision record; no unresolved ambiguity on canonical IDs, lease integrity/expiry, employee identity, or explicit disable behavior.

## T2 — Implement Admin-authoritative config and backend lease authorization

**Objective:** Provide one durable business-scoped activation source and a server-authorized way for both clients to obtain it.

**Files involved (external, unverified until T0):** Admin Console model/form/service; Cloud Function or existing backend service selected by T1; Firestore rules; backend and Admin tests. Desktop documentation references `admin_console/lib/models/admin_models.dart`, `functions/licence_core.js`, `functions/staff_core.js`, and `firestore.rules` as external locations, not confirmed Stay integration files.

**Dependencies:** T0 and T1; approved canonical business resolver; staging credentials and deployment owner.

**Expected behavior**

- Only authorized Kamai Plus Admin operations can change the durable business/module config.
- Version and audit actor/time/source are written atomically under the approved contract.
- Backend derives or verifies caller/business association; it never trusts an arbitrary client `business_id`.
- Backend returns current durable config and a server-timed lease bound to the exact business/module/version.
- Unchanged config can receive a new lease without Admin editing it.
- Service/rules enforce tenant and permission policy for operations crossing the server boundary.

**Failure scenarios:** Normal business user writes config; wrong business requests a lease; missing config; version collision; expired/invalid auth; stale or malformed lease; backend outage; rules disagree with Functions.

**Unit tests:** Admin authorization, monotonic versioning, lease creation/validation, server-time expiry, wrong-business denial, unchanged-config refresh.

**Integration tests:** Admin write → backend read/lease → Firestore/rules tests in staging; unauthorized client write; revocation and active staff state.

**Acceptance criteria:** Durable Admin config has no TTL; lease expiry is independent; unauthorized/wrong-business requests fail; logs/audit capture actor and version; tests run against the same source/config intended for deployment.

## T3 — Build the Desktop pure contract and access-policy core

**Objective:** Parse and evaluate the approved contract without coupling policy to React, IndexedDB, localStorage, Electron, or a network endpoint.

**Files involved (proposed new paths, not existing):**

- `src/lib/stay/activationContract.ts`
- `src/lib/stay/activationPolicy.ts`
- Focused assertions in the existing `scripts/e2e_simulation.ts` harness, or a narrowly scoped test file/run path approved by project conventions.

**Dependencies:** T1; can proceed in parallel with T2 only after the contract is frozen.

**Expected behavior**

- Strictly validate required types, module, canonical business, version, timestamps, lease binding, and approved integrity state.
- Reject invalid/missing/expired/mismatched values; never default to enabled.
- Evaluate activation, authentication status, business match, and action permission as separate inputs with structured denials.
- Use an injectable clock for deterministic expiry tests.
- Keep generic `AdminControl`, `FeatureId`, Restaurant mode, and vertical profile untouched.

**Failure scenarios:** Parser accepts malformed content; same version with different `enabled`; old response overrides newer; config/lease versions differ; local or cloud ID is used where canonical ID is required; permission omitted.

**Unit tests:** Valid enabled/disabled pair; missing/malformed config; invalid time; expired/boundary lease; stale/same-version conflict; wrong business; no auth/no permission; clock injection.

**Integration tests:** Shared approved fixtures consumed by the parser; no network or disk required.

**Acceptance criteria:** All denial cases fail closed; no UI/storage/backend dependency; all policy behavior is covered by deterministic tests; no new dependency is required.

## T4 — Integrate Desktop authorized refresh, separate cache, and narrow bridge

**Objective:** Consume the approved backend response and persist config/lease without conflating them with device-level Admin control.

**Existing candidate files**

- `licence.js`, `adminLink.js`, `main.js`, `preload.js`
- `src/lib/desktop/desktopBridge.ts`
- `src/components/admin/AdminControlHost.tsx` only if a lifecycle event needs a shell-level response
- `src/lib/cloud/cloudAccount.ts` only after a trusted identity method is approved
- New Desktop adapter/cache modules to be named after the persistence/transport boundary is approved.

**Dependencies:** T1, T2, T3; verified token/session/business resolution; explicit cache storage choice and approval to modify source.

**Expected behavior**

- Obtain config/lease only using the approved authenticated client/service flow.
- Use a separate typed payload/cache from `admin_control.json` and `ADMIN_FEATURES_KEY`.
- Enforce expiry/version and refresh on approved startup/foreground/reconnect/cadence events.
- Preserve the last valid cache only until its signed/server expiry; never renew offline.
- On fresh disable or expiry, invalidate current access state and pause new Stay work; preserve pending state.
- Keep legacy Admin lock/read-only/update controls and Restaurant behavior unchanged.

**Failure scenarios:** No linked/authenticated account; current Cloud sync remains disabled; endpoint unavailable; invalid signature; cache corruption; disk write failure; wrong business response; IPC event out of order; app restarts with expired cache.

**Unit tests:** Cache replacement/retention, failed refresh does not extend lease, version ordering, event transitions, restart reload, cache corruption.

**Integration tests:** Mock backend transport and Electron bridge; startup/online/offline/reconnect/restart flows; existing Admin control tests remain unchanged.

**Acceptance criteria:** Stay state is isolated from generic control state; invalid/missing/expired authorization fails closed; no new endpoint/path is invented as an existing service; Restaurant controls remain unchanged.

## T5 — Add Desktop access guards and reuse the approved permission source

**Objective:** Protect any future Stay entry path and service call while preserving the shared Restaurant shell.

**Existing candidate files**

- `src/components/layout/AppShell.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/features/FeatureGate.tsx` (modify only if a separate guard can be added without changing existing feature semantics)
- `src/lib/cloud/staff.ts`, `src/components/settings/staff/StaffPermissionsDialog.tsx`, `src/lib/auth.ts`, and `src/lib/auth/session.ts` only after source review proves the existing staff path can be reused.
- Proposed new pure service access helper/guard; no Stay service currently exists.

**Dependencies:** T1, T3, T4; approved route namespace; verified Desktop staff session and permission enforcement; source-change approval.

**Expected behavior**

- Check active business identity, module activation/lease, authenticated identity, and per-action permission independently.
- Deny direct route entry and service invocation when any required check fails.
- Do not add a Stay route/nav entry until its route/disabled UX is approved. No room/booking functionality is included.
- Use `tr()` and current language conventions for activation/status text. Initial language QA is Marathi and English; Hindi remains future work.

**Failure scenarios:** User enters URL manually; a child path bypasses route match; service called outside React; permission revoked while screen remains open; business switch leaves stale state; malformed config blocks Restaurant inadvertently.

**Unit tests:** Access helper for each structured denial, route normalization/nested paths, active-context change.

**Integration tests:** Direct route tests and service-call tests using the approved route; verify disabled/missing config isolates Stay only.

**Acceptance criteria:** Navigation is not the only check; no new Stay operation can begin without all checks; no changes to Restaurant route logic, feature-switch precedence, or data.

## T6 — Integrate Android with the same contract and existing authentication

**Objective:** Make Android consume the same canonical Admin config/lease and permission semantics, with no independent Stay toggle or database.

**Repository/files involved:** External Android application, Admin Console, Cloud Functions, Firestore rules, tests. Exact Android filenames must be discovered in T0; Desktop documentation references are not treated as verified paths.

**Dependencies:** T0–T2; Android repo access; current Android auth/business-selection/staff flow verified; owner approves required changes.

**Expected behavior:** Android uses identical canonical `business_id`, version/lease semantics, enabled state, offline expiry, session identity, and permission policy. Central disable is shared; no Android-local activation override.

**Failure scenarios:** Android resolves another business ID; local flag overrides Admin; stale offline cache persists beyond expiry; staff claims do not match Desktop; rules/client disagree.

**Unit tests:** Same shared fixtures and policy vectors used for Desktop.

**Integration tests:** Android authenticated request to staging; online enable/disable, offline startup/reconnect/expiry, app restart, employee permission denial.

**Acceptance criteria:** Android passes its own source tests and staging scenarios against the same backend contract. Desktop tests alone do not satisfy this task.

## T7 — Cross-platform acceptance and Restaurant regression

**Objective:** Prove the complete Admin → backend → Desktop/Android lifecycle and prevent Restaurant regressions.

**Files/systems involved:** Desktop tests (`scripts/e2e_simulation.ts`, `scripts/electron_e2e.mjs` as appropriate), Android tests, Admin/backend/rules tests, staging environment, shared fixtures.

**Dependencies:** T2–T6 complete; staging and test identities; named acceptance owners.

**Expected behavior:** Admin enable/disable is visible to both clients online according to the approved target; offline devices use only a valid lease; business isolation and employee permissions are consistent; data remains intact; Restaurant stays functional.

**Failure scenarios:** Client disagreement; wrong-business config; stale version; expired lease accepted; duplicate transition; offline disable portrayed as immediate; generic control overrides Stay; Restaurant regression; staging rules differ from deployed rules.

**Unit tests:** Run all contract/policy suites on both clients and backend.

**Integration tests:** Required cases from the test matrix below, then full Desktop regression and staging verification.

**Acceptance criteria:** All platform tracks signed off; Restaurant baseline tests pass; no security claim exceeds what cloud enforcement and local-device limitations support.

## Test-case traceability

Use the detailed cases in `STAY_PHASE1_TEST_CASES.md`; do not treat them as executed results.

| Requirement | Test-case references |
|---|---|
| Admin enable/disable, missing and malformed config | `P1-EN-01`–`P1-EN-07` |
| Wrong business, two businesses, stale config/version | `P1-SC-01`–`P1-SC-10`; `P1-ID-01`–`P1-ID-04` |
| Employee permission restrictions | `P1-AU-01`–`P1-AU-10` |
| Missing/expired config, offline startup/reconnect, restart | `P1-OF-01`–`P1-OF-17` |
| Active screen and pending operation behavior | `P1-PD-01`–`P1-PD-04` |
| Direct route and service access | `P1-GD-01`–`P1-GD-05` |
| Restaurant regression/data preservation | `P1-RG-01`–`P1-RG-06` |
| Desktop/Android parity | `P1-AX-01`–`P1-AX-07` |

## Stop conditions

Stop before source changes if canonical business identity is unresolved; if the backend cannot authenticate/authorize business membership; if the only available Desktop path is local `local_admin` but the required employee policy has not been approved; if an external repository or staging dependency is missing; or if implementation requires changing Restaurant logic to make Stay work.
