# Open Decisions and Blockers

**Status:** T0 remains blocked for integrated Phase 1. No source changes are authorized by this status record.

## Critical external evidence blockers

1. **Android source:** verify business selection/ID, employee sign-in/session, Stay config and permission enforcement, offline behavior, and tests.
2. **Admin Console source:** verify who can enable/disable, selected business identity, durable write, version/audit behavior, and Admin authorization.
3. **Cloud Functions/backend source:** verify authenticated business resolution, Admin write validation, lease issuance, server time, and authorization on server-mediated operations.
4. **Firestore rules:** obtain current source and safe staging evidence for tenant isolation, staff access, and Admin-only config writes.
5. **Staging and ownership:** identify a non-production Firebase project, test identities/businesses, repository owners, acceptance owners, and deployment/review process.

## Decisions requiring owner approval

| Topic | Question / recommended gate |
|---|---|
| Canonical business identity | Which server-verifiable identity is canonical across local Desktop, cloud Desktop, Admin, Android, and licence association? Do not assume IDs match. |
| Durable config | Approve one business-scoped record with `business_id`, `module`, `enabled`, `version`, `updated_at`, `updated_by`, `source`; no expiry on the Admin record. Path/transport remains unknown. |
| Client lease | Approve lease issuer, caller authentication, signature/integrity scheme, expiry, server-time validation, cache location, version binding, and refresh triggers. |
| Offline policy | Approve lease duration and refresh target; define fail-closed experience after expiry. No device can receive immediate remote disable while offline. |
| History access | Permit or deny read-only historical access after expiry or known disable? Not decided. |
| Active work | Define what happens to an active Stay screen and any unsynchronized operation when disable/expiry occurs. Preserve data; no silent discard or automatic replay. |
| Employee auth | Confirm an existing employee session can be used on Desktop and Android. If not, specify extension of the existing auth system; do not build a parallel login. |
| Permissions | Approve permission names/role mapping (candidate minimum: `stay.view`, `stay.manage`) and enforcement on both client and secured service paths. |
| Local owner | Decide whether local `local_admin`/master-password access grants Stay and clarify that local-only checks cannot secure data from the device owner. |
| Product profile | Confirm whether Stay is its own profile or a module within an existing business profile. Do not use `restaurant_mode` as a proxy without approval. |

## Verified Desktop facts and limits

- Onboarding creates local ID `biz_<sanitized 8-character user ID prefix>_<timestamp>`. Cloud account ID is separately `biz_<Firebase uid>`.
- Generic Admin control is currently per-device; it does not prove a business association or Stay lease.
- A linked cloud account, device licence, machine ID, and cloud sync device ID are distinct from the local business ID.
- The local owner/master-password unlock is not employee authentication.
- Generic staff permission fields exist; no Stay permissions are present and the Desktop permissions UI is deprecated.
- There is no Stay UI, service, schema, or migration.

## Implementation boundary

Until blockers and owner decisions are resolved, safe work is limited to read-only inspection, documentation, and test/contract planning. Do not add a placeholder endpoint, guessed path, fake business identity, mock authentication, Stay route, database schema, or implementation that could be mistaken for an integrated authorization boundary.

## Recommended next action

Request source access to Android, Admin Console, Cloud Functions, and Firestore rules, plus read-only access to staging configuration. Complete the cross-repository identity/auth/config evidence matrix before approving any source task.
