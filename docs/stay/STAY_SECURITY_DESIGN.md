# STAY_SECURITY_DESIGN.md

## Verified facts

The repo has a UI-level feature guard model already:
- `src/components/layout/AppShell.tsx` wraps children in `<FeatureGate pathname={pathname}>`.
- `src/components/features/FeatureGate.tsx` checks `featureForPath(pathname)` and blocks routes wheSTAY_SECURITY_DESIGN.mdn the feature is turned off.
- `src/lib/features/featureSwitches.ts` defines `readFeatureSwitches()`, `restaurantModeFromRaw()`, and `isRestaurantMode()`.
- `src/lib/admin/adminControl.ts` is the actual admin override model for read-only and mode lock, and it stores admin overrides in `localStorage`.

The current app therefore has:
- route gating based on feature switches
- admin remote-control overrides
- read-only / lock mode

What it does not show is:
- a permission guard for user roles
- a business/tenant guard for data isolation
- a data-access guard preventing direct DB calls when a module is disabled
- a backend-enforced auth layer for desktop local-first execution

## Security model required for Stay

Because this app is fundamentally local-first desktop software, a route-level guard cannot be treated as real security. Frontend checks are only anti-navigation controls.

The required security stack is:
1. Route guard
2. Feature activation guard
3. Permission guard
4. Business/tenant guard
5. Data-access guard
6. Audit logging

## Route and feature activation guard

The route must be blocked if the Stay feature is disabled, even if a user types the URL directly.

The repo already proves the pattern for Restaurant:
- `FeatureGate` checks the path and blocks `/restaurant` if the app is not in restaurant mode.

For Stay, the implementation should use the same pattern:
- `/stay` and its sub-routes should check `stay_enabled`
- the check must occur both in the UI and at the data-access layer
- if the flag is off, show a blocked screen and refuse navigation to the module

## Permission guard

The app must check staff roles or permissions before exposing stay operations.

Recommended permission categories:
- `stay.view`
- `stay.bookings.manage`
- `stay.checkin.manage`
- `stay.checkout.manage`
- `stay.payments.manage`
- `stay.refunds.manage`
- `stay.audit.manage`
- `stay.housekeeping.manage`
- `stay.maintenance.manage`

The permission check should be enforced both before rendering actions and before data mutation.

## Business/tenant guard

The repo already uses `business_id` and the shared business model in `src/lib/db/index.ts` and `src/lib/cloud/cloudContract.ts`.

For Stay, every access path must enforce:
- user belongs to the business
- active business_id matches the stay record
- data access is filtered by `business_id`
- no cross-business room or booking can be accessed through a stale id

This is especially important because the app is local-first and database records may be restored from backup or local sync.

## Data-access guard

This is the critical missing layer:

A UI guard only hides a screen; it does not prevent a user from invoking local data access calls or reading a cached local record.

The required rule is:
- any `getStay`, `saveStay`, `createBooking`, `postPayment`, `closeNightAudit`, or other business service must first check `module_enabled` and `business_id` access
- if the Stay module is disabled, the service must reject the action with a structured error
- the DB layer itself should optionally guard read/write access with a business module permission context

The repo has a strong pattern for theme and feature settings, but no analogous module-level guard is present in the current app.

## Local-first desktop limitation

The most important limitation is that a user who controls their own machine can bypass app-level guards.

Because the desktop app runs locally in Electron and stores data in IndexedDB, the honest design is:
- frontend guards = UX protection only
- local-service guards = local enforcement for honest usage
- cloud or admin config = central policy source for recommended control
- non-technical enforcement = outside this codebase, via business process and Admin Console policy

This means no one should treat the UI guard as a security boundary against a technically capable user.

## Admin disable enforcement during offline use

The repo already persists admin control in `admin_control.json` and `kamai_admin_feature_overrides` to keep the last settings alive during offline operation.

For Stay the same pattern should be used, but with explicit enforcement:
- if the last known admin config says `stay_enabled = false`, the Stay route and data layer must refuse access
- if the app is offline and the admin state is stale, it should continue to operate under the last known good config until the next sync or check-in
- on the next successful admin sync, the service should apply the newest state and revalidate the module state

This is a policy contract, not just a screen hide.

## Authorization structure

Recommended structure:

- `AppShell`
  - route-assignment shell
  - feature/vertical route guard
- `StayGuard`
  - checks Stay enabled flag and route state
- `PermissionGuard`
  - checks role-based access against the active business and feature policy
- `BusinessGuard`
  - ensures the app is in the correct business context
- `DataAccessGuard`
  - validates `business_id`, stay ownership, and status before read/write

The repo has only `FeatureGate` and local feature config today. The Stay design should add the missing permission and access guards explicitly.

## Recommended enforcement model

Back-end-style rules in the app should be represented as a central service layer such as:
- `canAccessStayModule({ businessId, user, adminState })`
- `canReadStay({ businessId, stayId, user, adminState })`
- `canMutateStay({ businessId, stayId, action, user, adminState })`

If the check fails, operations return a structured error such as:
- `MODULE_DISABLED`
- `BUSINESS_MISMATCH`
- `PERMISSION_DENIED`
- `DATA_CONFLICT`

## Additional operational controls

Required for the Stay module:
- audit log of every room, stay and payment change
- business-scoped filtering for all queries
- escalation or alert on repeated unauthorized access attempts
- app-lock and read-only mode analogous to the existing admin remote control model

## Recommended conclusion

The repo’s current route gating is real and useful, but it is not a sufficient security model for Stay. Stay must be designed with full guard layering and explicit offline admin disable enforcement.

## Finalized security limitation statement (2026-11-16)

### Decision
The honest security model is:
- UI access control blocks navigation and hides features.
- application service checks decide whether a user can perform an action.
- cloud-side policy enforcement is the authoritative policy source when available.
- local database and local app code cannot be treated as a protection boundary against a user who controls their own device.

### Reason
This repo is Electron + IndexedDB + local-first storage; any route or local storage check can be bypassed by a technically capable user operating their own machine. This must be acknowledged explicitly rather than hidden behind a false claim of “secure by local database guard.”

### Alternatives considered
- Claiming local UI barrier is security: rejected.
- Treating local DB as a security boundary: rejected.
- Assuming a cloud-only check will protect all cases: rejected for desktop offline behavior.

### Risks
- local bypass can expose data and make changes if the app is used outside business policy
- stale local config may continue to permit operations after a central disable

### Testing implications
- test route guard bypass attempts
- test direct service access denial when module is disabled
- test business mismatch and permission mismatch rejection
- test cache expiry enforcement

### Enforcement layers
- UI layer: blocks navigation and hides buttons
- service layer: checks `stay_enabled`, `business_id`, permission, and state
- cloud/admin layer: central config and policy source
- database layer: local guard only for consistent app behavior, not against a user controlling the machine

## Unresolved decisions

- Whether business-level activation should be delivered through the existing desktop admin control model or through a separate shared configuration contract.
- Whether Android will use the same central admin config contract or its own application state copy.
- Whether the permission model is role-based, user-based, or both.
