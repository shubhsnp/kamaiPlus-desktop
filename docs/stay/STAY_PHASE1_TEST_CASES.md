# Kamai Plus Stay — Phase 1 Test Cases

**Status:** Test design only; no test code added or run  
**Scope:** Business-scoped Admin activation, cached configuration, minimum authorization/route behavior, and Restaurant regression

## Test conventions

Use the two separate records proposed in `STAY_PHASE1_IMPLEMENTATION_PLAN.md`.

Authoritative Admin config: `business_id`, `module`, `enabled`, `version`, `updated_at`, `updated_by`, `source`.

Client lease/cache: `fetched_at`, `last_successful_refresh_at`, `expires_at`, `last_server_time`, `cached_config_version` (plus integrity proof/envelope if selected).

The Admin config has no expiry. A lease is issued by an authorized backend from the current config using server time; an unchanged config may receive a fresh lease on each successful refresh. Tests should use an injectable clock and deterministic fake Admin/config transport. Avoid tests that depend on wall-clock timing, a live Firebase project, or actual Admin Console credentials.

## A. Enable and disable

| ID | Scenario | Steps | Expected result |
|---|---|---|---|
| P1-EN-01 | Enable a disabled business | Return a valid, newer `enabled: true` config for Business A; refresh the config state. | Stay navigation and route become available only to a user with `stay.view`; no existing Restaurant setting changes. |
| P1-EN-02 | Disable while app is open | Start with valid enabled config; publish a newer disabled version while renderer is open. | Stay view is invalidated, new Stay actions are denied, pending work is preserved and paused, and user sees a clear disabled state. |
| P1-EN-03 | Disable then re-enable | Apply enabled v1, disabled v2, enabled v3. | v2 blocks actions; v3 restores eligible access. Records are preserved; paused operations are not blindly replayed. |
| P1-EN-04 | Missing config | Return no config for a business. | Fail closed for Stay; do not infer activation from Restaurant mode, a vertical profile, or an older generic feature override. |
| P1-EN-05 | Invalid config | Return unknown module, wrong field types, missing business ID, invalid date, or malformed JSON. | Reject as invalid; show a safe error/blocked state; no access is granted and errors are reportable. |
| P1-EN-06 | Config read/storage failure | Simulate IPC, cache read, or cache write rejection. | Do not treat failure as enabled. Existing Restaurant remains usable; Stay is blocked/provisional according to the approved cache policy. |
| P1-EN-07 | Duplicate enable/disable delivery | Deliver the same config version more than once. | No duplicate state transition, repeated side effect, or accidental pending-operation replay. |

## B. Version, business scope, and stale responses

| ID | Scenario | Steps | Expected result |
|---|---|---|---|
| P1-SC-01 | Two businesses with different activation | Configure Business A enabled v4 and Business B disabled v7; switch/test separate business contexts. | Each context uses only its matching config. A's enabled state never enables B. |
| P1-SC-02 | Wrong-business payload | Active business A receives config for business B. | Reject before rendering data or calling a service; record a business mismatch outcome. |
| P1-SC-03 | Missing canonical ID mapping | Local business ID exists but cloud/business identity cannot be resolved. | Fail closed for new Stay access; do not compare a local ID to a licence key or assume it equals `biz_<uid>`. |
| P1-SC-04 | Delayed older config | Apply v9, then deliver v8. | Keep v9; older update is ignored and cannot re-enable a disabled module. |
| P1-SC-05 | Same version, conflicting content | Deliver two payloads with the same version but different `enabled` values. | Treat as inconsistent/invalid; fail closed for new operations and surface a diagnostic; do not use arrival order as conflict resolution. |
| P1-SC-06 | Newer version with older timestamp | Deliver a higher version with inconsistent `updated_at`. | Follow the approved contract validation policy; do not silently roll back by timestamp. Flag contract inconsistency. |
| P1-SC-07 | Global desktop feature conflict | Generic remote `features` contains `stay_enabled: true` while business config says disabled. | Business activation contract wins for Stay; generic PC feature map must not override it. Restaurant and existing feature precedence remain unchanged. |
| P1-SC-08 | Same licence used with another business context | Simulate licence/control payload associated with one PC while active business identity differs. | Deny Stay until the canonical business association is confirmed; do not treat per-key control as business-scoped automatically. |
| P1-SC-09 | Durable Admin config is older than 24 hours | Leave `enabled: true` and its version unchanged for more than 24 hours; request a refresh online. | Admin state remains enabled. Backend issues a new lease from the unchanged config; document age alone never disables the business. |
| P1-SC-10 | Backend returns config for a different business | Authenticated client asks for Business A; backend response contains Business B config/lease. | Reject before cache update; do not use caller-supplied identity as proof of membership. |

### Identity mapping acceptance

| ID | Scenario | Steps | Expected result |
|---|---|---|---|
| P1-ID-01 | Local-to-cloud mapping | Create/select local `db.businesses` row and link Google account; inspect the resolver/context used by sync. | Local row ID remains distinct; canonical cloud ID resolves to `biz_<Firebase uid>` by the documented Desktop mapping. |
| P1-ID-02 | Missing cloud account | Have a local business with no linked Google account. | Do not invent a cloud/Admin business ID; deny business-scoped lease issuance and Stay cloud authorization. |
| P1-ID-03 | Licence/device IDs are distinct | Compare `licence.js` machine ID and licence key with `cloudPush.deviceId()` and the cloud business ID. | No value is substituted for `business_id`; backend must verify any explicit licence-to-business association. |
| P1-ID-04 | Admin/Android identity parity | In external repositories, resolve the same business in Admin Console and Android and compare with Desktop `biz_<uid>`. | Exact equality and ownership relationship are proven by code/config and integration tests; Desktop-only tests are insufficient. |

## C. Authentication and employee permissions

| ID | Scenario | Steps | Expected result |
|---|---|---|---|
| P1-AU-01 | Unauthenticated user | Enabled config and valid lease, no valid existing staff/user session. | Stay route and service access denied with `AUTH_REQUIRED`. |
| P1-AU-02 | Authenticated but no Stay permission | Enabled config, valid user with no `stay.view`. | Navigation/route and data service deny access with `PERMISSION_DENIED`. |
| P1-AU-03 | View-only staff | Valid user with `stay.view` but no `stay.manage`. | May view allowed module landing/status content; mutation entry point is denied. |
| P1-AU-04 | Manager/owner allowed action | Valid config/lease and identity from the approved existing auth flow with explicit Stay permission. | Access granted only for the permitted action and matching business. Generic role names alone do not grant rights. |
| P1-AU-05 | Permission changes while view is open | Revoke permission or switch session identity while Stay is active. | UI re-evaluates; subsequent service call is denied. Do not rely on stale component state. |
| P1-AU-06 | Forged local role | Modify renderer/local user role without matching trusted session/permission source. | Application guard must not treat a client-editable role as authoritative cloud authorization. Document local-device limitation; cloud calls reject unauthorized claims. |
| P1-AU-07 | Session expiry/logout | Expire session or log out while Stay is open. | Stay actions stop and sensitive UI is cleared/covered; local records are not deleted. |
| P1-AU-08 | Desktop owner-only login | Unlock the current Desktop local master-password profile (`local_admin`) without an employee identity. | Follow an explicitly approved owner policy; do not treat `local_admin`, Google cloud-sync account, or a cached role as a per-employee authorization token. |
| P1-AU-09 | Staff Stay permissions | Extend the existing staff record with approved `stay.view`/`stay.manage` grants; test read and manage independently. | Existing staff identity/session is reused; permission data is parsed and enforced by Desktop and backend/rules. No parallel authentication is introduced. |
| P1-AU-10 | Deprecated permissions editor | Exercise the current `StaffPermissionsDialog` (currently deprecated/empty) before and after the approved extension. | Stay permission management is available only through the approved existing staff-management path; unrelated legacy permission controls are not assumed to work. |

## D. Online/offline, refresh, expiry, and restart

| ID | Scenario | Steps | Expected result |
|---|---|---|---|
| P1-OF-01 | Startup online | Start with a valid config/lease cache and online transport; return the current config with a new lease. | Renderer uses only validated config/lease; state is cached separately and a new lease is applied. |
| P1-OF-02 | Startup offline with valid unexpired enabled lease | Start offline with a matching enabled config and unexpired lease. | Apply only within the approved offline policy; display offline/stale status and do not claim remote confirmation. |
| P1-OF-03 | Startup offline without cache | Start offline with no valid config. | Fail closed for Stay; do not create an enabled default. |
| P1-OF-04 | Reconnect after offline period | Start with valid cached config/lease; go offline, then online; server returns current config and renewed lease. | Apply any new config version and replace the lease, re-evaluate route/services, and reconcile paused operations individually. |
| P1-OF-05 | Network returns before scheduled poll | Simulate network restoration before the normal timer. | Trigger a refresh promptly if that policy is implemented; otherwise remain clearly offline until poll and do not promise immediate update. |
| P1-OF-06 | Lease expires offline | Advance injected clock past lease `expires_at` with last known enabled Admin config. | Fail closed for new Stay operations; cached `enabled: true` does not extend the expired lease. Read-only local history is allowed only if separately approved; no mutation/outbox replay. |
| P1-OF-07 | Expiry boundary | Test immediately before, exactly at, and after `expires_at`. | Treat expiry as expired at the defined boundary (recommended: `now >= expires_at`); deterministic clock-based result. |
| P1-OF-08 | Explicit remote disable before cache expiry | Receive a valid newer disabled version while prior enabled cache is still valid. | Disable takes effect immediately on receipt; older unexpired cache cannot override it. |
| P1-OF-09 | Device offline during remote disable | Disconnect device, disable Stay centrally, keep device offline. | Device may remain on its cached state until it reconnects or its lease expires. No test or UI may claim instant remote revocation. |
| P1-OF-10 | Application restart with cache | Restart after caching enabled/disabled Admin config and a valid/expired lease. | Reload Admin config and lease separately; enforce cached-version equality and expiry; preserve pending queue state. |
| P1-OF-11 | Clock rollback/forward | Change device time around cache expiry. | Detect/report anomalous time where feasible; enforce policy conservatively. Document that a device owner can tamper with local time/cache, so this is not a security guarantee. |
| P1-OF-12 | Refresh cadence | Use fake clock and scheduler to verify startup, focus, connectivity, and periodic refresh triggers. | Meet approved interval; with proposed 15-minute target, no online Stay config is left unrefreshed beyond the target except reported transport failure. |
| P1-OF-13 | Server timeout/error | Timeout or return server error during refresh. | Keep last valid cache only until expiry; show stale/offline status; do not reset to enabled or silently discard cache. |
| P1-OF-14 | Refresh unchanged config | Refresh a durable enabled config without Admin edits. | Backend issues a new server-timed lease; config version and `updated_at` remain unchanged; `last_successful_refresh_at`/`fetched_at` advance only after success. |
| P1-OF-15 | Lease/config version mismatch | Pair a valid-looking lease for version N with cached config version N+1, or vice versa. | Reject the pair and fail closed for new operations; do not pick the most permissive value. |
| P1-OF-16 | Forged or altered lease | Alter business ID, enabled value, version, or expiry in a signed response/cache. | Integrity validation rejects it; document local-device-owner limitations. |
| P1-OF-17 | Client clock rollback | Issue lease using server time, move local time backward, and restart/reload cache. | Apply approved anti-rollback/high-water policy; expired lease cannot be extended by rewriting client timestamps. A capable device owner remains outside the security guarantee. |

## E. Active screens and unsynchronized operations

| ID | Scenario | Steps | Expected result |
|---|---|---|---|
| P1-PD-01 | Disable with active Stay screen | Open a Stay page, then receive disabled config. | Invalidate actionable state and show disabled status; no further mutation starts. |
| P1-PD-02 | Disable with pending local operation | Create a simulated pending Stay request, then disable. | Preserve payload and history; pause sync; mark blocked/needs review. Do not delete, silently submit, or replay after re-enable without revalidation. |
| P1-PD-03 | Re-enable with pending work | Re-enable after P1-PD-02. | Pending request remains individually reviewable and requires explicit/authoritative revalidation; no automatic duplicate side effect. |
| P1-PD-04 | Ambiguous request outcome | Server may have accepted an operation but client timed out; then module is disabled. | Resolve by stable request ID/status query when available; do not mint a new request ID or repeat blindly. |

Phase 1 has no implemented Stay data/outbox operations; these cases validate the activation lifecycle interface and may initially use a test double. Full business-operation verification belongs to later Stay phases.

## F. Direct routes and service-level protection

| ID | Scenario | Steps | Expected result |
|---|---|---|---|
| P1-GD-01 | Direct route while disabled | Navigate directly to Stay route, with/without query, trailing slash, or nested path. | Block route and do not load operational data. |
| P1-GD-02 | Direct route with missing config or expired lease | Open route without a valid config/lease pair. | Apply fail-closed operation policy and approved expired-history read policy; no mutation controls. |
| P1-GD-03 | Call service without UI | Invoke the shared Stay access helper/service directly while disabled. | Deny with `MODULE_DISABLED`; route guard is not the only check. |
| P1-GD-04 | Cross-business entity reference | Call a future service with Business A context and a Business B object ID. | Deny with `BUSINESS_MISMATCH`; no data returned or changed. |
| P1-GD-05 | Stay config failure isolation | Force malformed Stay config while using Restaurant routes. | Restaurant route, POS, tables/orders, and existing feature switches remain unchanged. |

## G. Restaurant regression and existing-data protection

| ID | Scenario | Steps | Expected result |
|---|---|---|---|
| P1-RG-01 | Restaurant mode enabled, Stay disabled | Run existing Restaurant flow with Stay config absent/disabled. | Existing Restaurant route, tables, orders, KOT, settlement, and configuration behave exactly as baseline. |
| P1-RG-02 | Restaurant mode enabled, Stay enabled | Run same Restaurant flows and visit Stay route. | Stay appears only where permission/config allow; Restaurant behavior and persisted data are unchanged. |
| P1-RG-03 | Stay disable while Restaurant active | Disable Stay while in a Restaurant route. | Only Stay state changes; Restaurant stays mounted/usable and no restaurant order is closed or modified. |
| P1-RG-04 | Existing Restaurant record preservation | Compare Restaurant local/cloud records before and after toggling Stay. | No record mutation, deletion, migration, or schema change occurs in Phase 1. |
| P1-RG-05 | Generic feature override compatibility | Exercise current admin feature overrides and Restaurant mode on/off. | Existing precedence and tests continue to pass; Stay activation remains a separate business-level check. |
| P1-RG-06 | Existing Admin lock/read-only controls | Apply global lock and read-only modes with Stay activation states. | Existing global lock/read-only behavior remains unchanged; precedence between global lock and Stay access is documented and consistent. |

## H. Android/Desktop contract compatibility

| ID | Scenario | Steps | Expected result |
|---|---|---|---|
| P1-AX-01 | Shared contract serialization | Serialize authoritative config and lease fixtures on Desktop and Android implementations. | Same config fields and types; same lease fields, timestamp semantics, version binding, and expiry behavior. |
| P1-AX-02 | Shared contract validation | Feed missing, wrong-type, unknown-module, stale, and wrong-business fixtures to both clients. | Both clients reject/handle identically and fail closed for new operations. |
| P1-AX-03 | Version transition parity | Apply enabled v1, disabled v2, enabled v3 on each client. | Same final state and no stale-version rollback. |
| P1-AX-04 | Offline expiry parity | Apply one unexpired then expired cache on each client. | Same new-operation deny and approved history behavior. |
| P1-AX-05 | Admin update propagation parity | Change the canonical business config and observe both clients online. | Both receive the same version; propagation is within the approved target when connected. No immediate guarantee is asserted offline. |
| P1-AX-06 | Business identity parity | Resolve the same business in Desktop local/cloud identity mapping and Android identity. | Contract `business_id` matches exactly; no licence-key or device-ID substitution. |
| P1-AX-07 | Admin write authorization | Attempt update from a normal business client and from authorized Admin path. | Ordinary client cannot activate/deactivate Stay; authorized Admin action is audited. |

These are joint acceptance tests. The Android repository, Admin Console source, Cloud Function, and Firestore rules must be available to execute them. Desktop-only mocks do not establish parity.

## Acceptance gate

### Phase-wise completion and acceptance boundary

**Desktop acceptance** requires Desktop source changes, tests for local/cloud identity mapping, lease persistence/validation, existing staff identity integration, route/service guards, and Restaurant regressions. It is not overall Phase 1 completion.

**Admin/backend acceptance** requires external Admin UI/write authorization, durable versioned config, verified business association, server-time lease issuance, lease integrity, and Cloud Function/Firestore-rules tests.

**Android acceptance** requires the same Admin config and lease contract, canonical identity mapping, offline expiry behavior, staff authorization integration, and Android-specific tests.

**Cross-platform acceptance** requires a shared non-production environment or deterministic shared fixtures proving serialization, Admin write → server lease → Desktop/Android consume, business isolation, disable/update propagation online, and consistent offline expiry. Overall Phase 1 is complete only after all tracks pass.

Phase 1 can be considered complete only when:

1. The authoritative config source and canonical business ID mapping are documented.
2. The same validated durable config and separate lease are delivered to Desktop and Android.
3. Config versioning and lease issue/refresh/expiry semantics are tested, including unchanged Admin config older than 24 hours.
4. Module activation, authentication, employee permission, business match, and service checks are independent and verified.
5. Disablement preserves local records and safely pauses pending operations.
6. Existing Restaurant/admin-control regression tests pass unchanged.
7. Admin writes and lease issuance are authorized and audited in the external control plane.
8. No claim is made that an offline device immediately receives remote disablement or that local guards protect data from its device owner.
9. All Desktop, Admin/backend, Android, and cross-platform acceptance gates pass; Desktop-only testing is not sufficient.
