# Kamai Plus Stay — Test Strategy

**Status:** Strategy only. No Stay test has run because Stay is not implemented.
**Primary rule:** Distinguish client mocks from backend/rules enforcement and Desktop-only checks from cross-platform acceptance.

## Traceability and evidence

- Use `STAY_PHASE1_TEST_CASES.md` as the detailed Phase 1 scenario catalog (P1-EN, P1-SC, P1-AU, P1-OF, P1-PD, P1-GD, P1-RG, P1-AX).
- Record requirement ID → implementation task/file → test case → result → build/version.
- Mark unimplemented/planned test cases as **Not run**, not passed.
- Server-side identity, Admin authorization, and Firestore rules require tests against actual backend/rules source and a non-production environment.
- Shared Desktop/Android fixtures should be added only after the canonical contract is approved and an owner/location is assigned.

## Existing validation infrastructure

**Verified:** `package.json` declares project-specific commands including E2E simulation (`scripts/e2e_simulation.ts`), Electron E2E (`scripts/electron_e2e.mjs`), smoke, and cloud validation. No conventional unit-test runner or existing Stay tests were identified.

**Not performed during this documentation task:** test suite, type check, build, lint, staging tests, or Android tests. Historical results in existing docs are not a current run.

## Test levels and future scope

| Level | Focus | Evidence needed |
|---|---|---|
| Pure unit | Config/lease parsing, version binding, expiry boundary, clock handling, access policy | Approved contract; deterministic fake clock; malformed/missing/stale input cases |
| Component | Activation state, status, blocked screens, permission-specific UI, translations | Real existing UI patterns; no UI-only security claim |
| Desktop integration | Electron transport, trusted identity, cache refresh, restart/offline transitions | Approved backend contract; test transport and storage; actual route/service calls |
| Backend/API | Admin writes, business association, lease issue/refresh, version/audit, wrong-business denial | Actual Functions/API source, staging, auth identities |
| Database/security | Firestore rules tenant isolation, client write/read restrictions, Admin-only config writes | Current rules source and emulator/staging tests; never infer from UI behavior |
| Migration | Stay schema/data migration and rollback | **Out of scope for Phase 1 prep**; no schema or migration exists or is authorized |
| Desktop regression | Restaurant mode, sales, tables/orders, existing records, generic Admin control | Existing regression harness, pre-existing user changes preserved |
| Android regression | Existing staff/auth, current business workflows, offline behavior | Android repository and test environment required |
| Cross-platform | Admin → backend → Desktop/Android config/lease parity | Shared approved contract and staging; Desktop-only tests are insufficient |
| Reliability/performance | Refresh/retry, app restart, clock skew, large data, process termination | Approved lease policy and implemented service |
| UAT / alpha / beta / release | Rural lodge owners and staff, accessibility, localization, support and rollback | Named pilot users/owners, approved release plan; not available yet |

## Required Phase 1 scenario groups

1. Admin enable/disable/re-enable, authorized writer and audit version.
2. Two distinct businesses; wrong-business config/lease/route/service access denied.
3. Missing, malformed, old, conflicting-same-version, and expired config/lease.
4. Offline startup within/outside a valid lease; reconnect, refresh, explicit disable, and restart.
5. Role/permission restrictions and owner-policy behavior; no implicit generic-role access.
6. Active screen expiry/disable behavior; pending data preserved and not silently replayed.
7. Direct routes and direct service calls independently reject invalid state.
8. Restaurant behavior/data untouched; current generic Admin controls unaffected.
9. Desktop and Android consume shared fixtures and enforce the same business/version/expiry/permission semantics.
10. English and Marathi user-facing activation/expiry/error flows; Hindi deferred.

## Acceptance discipline

- Fail closed for new Stay operations on missing/invalid/wrong-business/disabled/expired authorization.
- Do not claim immediate disable for offline clients.
- Do not automatically disable a durable Admin config merely because its update time is old; lease expiry is separate.
- Do not treat route hiding as authorization or client-only tests as backend security proof.
- Integrated Phase 1 cannot pass on Desktop-only results. Admin/backend, Desktop, Android, and cross-platform gates all need evidence and owner sign-off.
