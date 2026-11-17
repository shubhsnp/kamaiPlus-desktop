# Kamai Plus Stay — Phase 1 External Dependencies

**Status:** Dependency inventory and evidence register; no implementation started  
**Readiness:** **NOT READY** for integrated Phase 1  
**Investigation basis:** Current Desktop source, current Git status, and the six Stay planning/readiness documents reread for this task.

## 1. Workspace inventory and source boundaries

The current working directory is `D:\KamaiPlus Workspace`; the only Git repository found is `D:\KamaiPlus Workspace\KamaiPlus Desktop App` on branch `main`.

### Available and directly inspected

- Kamai Plus Desktop application: Next.js/React/TypeScript, Electron main/preload, Dexie/IndexedDB, Firebase client SDK, Restaurant code, current E2E scripts.
- Existing Admin/feature code: `adminLink.js`, `main.js`, `preload.js`, `src/lib/desktop/desktopBridge.ts`, `src/lib/admin/adminControl.ts`, `src/components/admin/AdminControlHost.tsx`, `src/lib/features/featureSwitches.ts`, `src/lib/business/verticalProfile.ts`, `src/components/features/FeatureGate.tsx`.
- Identity/auth/staff code: `src/components/auth/AuthForm.tsx`, `src/lib/auth.ts`, `src/lib/auth/session.ts`, `src/lib/cloud/cloudAccount.ts`, `src/lib/cloud/staff.ts`, `src/components/settings/staff/StaffPermissionsDialog.tsx`, `src/components/layout/BusinessProvider.tsx`.
- Test commands declared in `package.json`: `test:e2e`, `test:electron`, `test:smoke`, and `test:cloud`. No conventional unit-test runner or `src` unit-test suite was found.

### Not available or not verifiable here

| Dependency | Evidence required | Current state |
|---|---|---|
| Android app repository | Current auth, business selection, staff session, config/cache, offline, route/service and test implementation | Not present in workspace; Desktop docs/tests contain references only |
| Admin Console repository | Business-scoped Stay toggle, Admin identity/authorization, write/audit path | Not present; existing Desktop documentation describes per-licence/global controls only |
| Firebase Cloud Functions | Business resolver, Admin authorization, lease issuance, staff session/permission checks | No Functions source tree present; endpoint names and file paths are comments/docs only |
| Firestore security rules | Current tenant/staff read-write enforcement and Admin-only config writes | No `firestore.rules` present; deployed rules not queried |
| Shared Stay contract/package | Canonical serializable models and cross-platform fixture ownership | No shared package found |
| Non-production Firebase environment | Test businesses/users, test rules/functions and project ownership | Not verified; no live access test |
| Deployment/release permission | Authorized owner and procedure for Admin/backend/rules deploys | Not verified; no deploy performed |
| Support and acceptance owners | Named Desktop, Android, Admin/backend and lodge UAT sign-off | Not identified in available source |

`.firebaserc` and `.env.local` exist in the Desktop repository, but their contents were not read. Their presence does not prove access to a staging project, current deployed services, or deployment permission. No credentials or secrets are included in this report.

## 2. Current implementation evidence

### Verified Desktop behavior

1. `src/lib/business/verticalProfile.ts` has six vertical IDs including `restaurant`, but no `stay`.
2. `src/lib/features/featureSwitches.ts` contains existing shop features and `restaurant_mode`; it has no Stay feature/permission.
3. `adminLink.js` cleans generic remote control and stores it in user-data `admin_control.json`. `src/lib/desktop/desktopBridge.ts` exposes `AdminControl` fields for mode/features/minimum version/check-in/commands, not business ID, Stay config, or lease.
4. `main.js` checks in to the licence service with a 60-minute default and a 15–360 minute Admin-configured interval. The timer ticks every five minutes. `preload.js` exposes generic control IPC; `AdminControlHost` applies feature overrides and lock/update/read-only screens.
5. The Desktop licence request in `licence.js` contains action, key, machine ID/name, app version, and optional health/report. It does not contain canonical `business_id` or Firebase ID token. The client verifies the signed licence for the machine; this does not establish a Stay business entitlement.
6. `src/lib/firebase/cloudAvailability.ts` sets `CLOUD_SYNC_ENABLED = false`; general cloud sync code paths are gated off. Google/Firebase account-linking code exists but must not be mistaken for an active business config service.
7. Onboarding/local Dexie business IDs are different from cloud `biz_<Firebase uid>`. The Desktop cloud contract maps them as separate values. `BusinessProvider` reads the first local business; this is not a verified multi-business resolver.
8. `AuthForm.tsx` unlocks a local profile with a master password. `src/lib/auth/session.ts` has JWT helper functions but no production call site was found. `src/lib/cloud/staff.ts` manages staff records and generic non-Stay permissions; `StaffPermissionsDialog.tsx` is deprecated/empty.
9. No Stay route, Stay service, Stay config/lease implementation, Stay permission, schema, or migration exists in the inspected source. No exact Stay contract identifiers (`stay_enabled`, `stay.view`, `stay.manage`, `module_config`, `StayModule`, `stayConfig`) were found in source/scripts/Electron entry points.

### Documentation-only or unknown

- Desktop docs describe Admin Console data in `desktop_licences/{KEY}` / `platform_settings/desktop_control`, a `desktopLicence` function, an external staff Cloud Function, Android staff auth, and Firestore rule behavior. These are not verified current external implementations.
- A proposed path such as `businesses/{business_id}/module_config/stay` is not present in the Desktop source and is not approved by evidence here.
- Whether a licence key is server-associated with a canonical business ID is unknown.
- Android/Admin use of `biz_<Firebase uid>` is documented in Desktop materials but not independently verified.
- No lease issuer, lease signature format, lease TTL, server-clock behavior, or Stay-specific cloud authorization was found.

## 3. External work and exact decision dependencies

### 3.1 Canonical business identity

External owners must prove and document the mapping between:

- Desktop local Dexie ID (onboarding creates an ID from a shortened UID plus timestamp; a fallback ID can also be generated).
- Desktop cloud ID (`biz_<Firebase uid>`, currently held separately from local ID).
- Android business ID and Android business selection.
- Admin Console business ID.
- Desktop licence key, machine ID, and sync device ID.

None of the last three device identifiers is a business ID. Do not issue a business lease based solely on a client-supplied ID. The backend must derive/verify the business from an authenticated identity or an explicit server-maintained association. Which approach is available is unknown until the external code is inspected.

### 3.2 Admin config and lease service

The Admin/backend owners must decide and implement:

- One durable business-scoped config with fields `business_id`, `module`, `enabled`, `version`, `updated_at`, `updated_by`, `source`; no expiry on this record.
- A separate client lease with `fetched_at`, `last_successful_refresh_at`, `expires_at`, `last_server_time`, `cached_config_version`.
- Authorized Admin writes, monotonic versioning, audit history, secure business resolution, and server-time lease creation.
- Response integrity/signature scheme and key management.
- Whether an existing backend service can safely be reused or a new one is required. No new endpoint name, collection path, or deployed feature is asserted by this plan.
- Approved refresh interval, lease duration, expiry boundary, clock handling, and online propagation target. The earlier 15-minute refresh and 24-hour lease are proposals only.

### 3.3 Authentication and employee authorization

Required evidence and decisions:

- Android's actual staff code/session/token issuance, business/role claims, permission enforcement and removal/revocation behavior.
- Desktop's supported staff sign-in path. Current local `local_admin` unlock and Google cloud account are not employee sessions.
- Whether the existing staff system can be reused on Desktop and how it presents the verified staff ID/business to the app.
- Approved role/permission mapping, at minimum separate `stay.view` and `stay.manage` (or an explicit equivalent); do not silently infer rights from generic role names.
- Explicit owner access policy for local master-password login.
- Where policy is enforced on the server for cloud operations; a renderer/localStorage permission alone is not authoritative.

No separate Stay authentication system should be built.

### 3.4 Offline/revocation policy

Owner approval is required for:

- Lease TTL and refresh frequency.
- Whether cached enabled access remains available until lease expiry.
- Denial behavior after expiry, including whether local historic records are read-only.
- Whether a known Admin disable allows any read-only history.
- Active screen invalidation and pending operation preservation/reconciliation.
- User-facing Marathi/English status/error language.

An offline device cannot receive an immediate remote disable. After a valid lease expires without refresh, fail closed for new Stay activity. Never reinterpret an old durable Admin document as disabled solely because of document age.

## 4. Dependency ownership map

| Work | Owning repository/service | Must be available before |
|---|---|---|
| Admin toggle UI, Admin identity and durable config writes | Android/Admin Console repository | Contract implementation |
| Canonical business resolver and lease issuer | Firebase Cloud Functions/backend or approved existing service | Any client config/lease consumption |
| Server-side tenant, staff and Admin policy | Cloud Functions and Firestore rules | Security acceptance |
| Desktop config/lease parser, cache, IPC and guards | Desktop repository | Contract/identity/permission approval |
| Android config/lease consumer and guards | Android application repository | Contract and auth approval |
| Shared contract fixtures | Agreed cross-repo test location or source package | Client integration |
| Admin/backend integration acceptance | Staging Firebase + Admin/backend owners | Cross-platform acceptance |
| Desktop/Android parity acceptance | Both app repos + staging | Phase 1 completion |
| Restaurant regression | Desktop repository and existing test environment | Every Desktop integration change |

## 5. Current Git changes to preserve

The initial status check showed branch `main` and a dirty worktree. No existing changes were modified by this planning task.

**Modified tracked files present at inspection**

```text
scripts/e2e_simulation.ts
scripts/electron_e2e.mjs
src/components/billing/BillPrinterSetup.tsx
src/components/restaurant/FastPosScreen.tsx
src/components/restaurant/OrderPanel.tsx
src/components/restaurant/OrderScreen.tsx
src/components/restaurant/PayDialog.tsx
src/components/restaurant/RestaurantPage.tsx
src/components/settings/PrintSettingsCard.tsx
src/lib/constants/version.ts
src/lib/restaurant/words.ts
src/lib/whatsNew/changelog.ts
src/lib/whatsNew/changelogOlder.ts
src/locales/hi.json
src/locales/mr.json
```

These are pre-existing user changes, including Restaurant/billing, tests, locale, and release-note work. Do not revert, format, or overwrite them as part of Stay preparation.

**Pre-existing untracked documents/catalogs present at inspection**

```text
COST_AND_DEPENDENCY_REGISTER.md
DATABASE_CHANGE_PLAN.md
DEVELOPMENT_ROADMAP.md
EXISTING_FEATURE_INVENTORY.md
KAMAI_STAY_ARCHITECTURE.md
RISK_REGISTER.md
SYSTEM_ARCHITECTURE.md
STAY_ADMIN_TOGGLE_DESIGN.md
STAY_ANDROID_DESKTOP_INTEGRATION.md
STAY_ARCHITECTURE_DECISIONS.md
STAY_CROSS_REPOSITORY_READINESS.md
STAY_DATABASE_SCHEMA.md
STAY_FINAL_ARCHITECTURE_REVIEW.md
STAY_FINANCIAL_ARCHITECTURE.md
STAY_IMPLEMENTATION_BLUEPRINT.md
STAY_PHASE1_FINAL_DECISIONS.md
STAY_PHASE1_IMPLEMENTATION_PLAN.md
STAY_PHASE1_OPEN_DECISIONS.md
STAY_PHASE1_TEST_CASES.md
STAY_SECURITY_DESIGN.md
STAY_SYNC_ARCHITECTURE.md
STAY_TEST_STRATEGY.md
docs/kamaiplus-stay/
kamaiPlus_*_batch1.json catalog files
```

The current task adds only the three requested Markdown planning deliverables. Preserve the existing untracked Stay/design/catalog work; do not assume it should be committed or cleaned up.

## 6. Readiness gates

### Blocked until external repositories/access are available

- Verify Admin Console's actual writer and business ID.
- Verify Android's actual business identity and employee login/permission model.
- Inspect Cloud Functions and deployed Firestore rules; confirm server authorization and any licence-to-business association.
- Obtain non-production staging/test identities and validate current deployed versions.
- Name the owners of Admin/backend, Android, Desktop, and acceptance/release sign-off.

### Blocked until owner/platform decisions are approved

- Canonical config authority and client authentication method.
- Lease integrity, TTL, refresh, expiry and offline/history policy.
- Local owner access and employee permission mapping.
- Route namespace and failure UX.
- Cache storage location and whether Electron main or an authenticated renderer service performs the refresh.

### Source changes explicitly not approved by this preparation

- No application source changes.
- No `FeatureId` or vertical-profile changes.
- No Admin control or license-flow changes.
- No staff/authentication changes.
- No Stay route or database/schema/migration changes.
- No endpoint, Firestore path, or rule changes.
- No Android/Admin/backend implementation.

## 7. First safe next step and verdict

**Immediate next step:** Obtain the Android/Admin/Functions/rules source and staging access, then complete T0/T1 in `STAY_PHASE1_TASK_BREAKDOWN.md`. This is the only safe work that can proceed now without implementing against unknown identity or authorization.

**First code task after explicit approval and contract freeze:** Add a pure Desktop config/lease parser and policy helper with deterministic tests. Keep it disconnected from UI, storage, Electron IPC, and network until trusted business identity, lease verification, and backend transport are settled.

**Final verdict:** **NOT READY** for integrated Phase 1 implementation. Desktop-only work cannot complete the central Admin toggle, business authorization, employee access, Android parity, or backend enforcement. Wait for explicit approval before modifying application source.
