# 07. Admin Toggle Design

## Goal

Implement a single master toggle that enables or disables KamaiPlus Stay centrally. The toggle must be enforced across the app and any cloud-driven client configuration, not just hidden from the menu.

## Why this must be security-first

The repo already has multiple forms of remote control and feature gating:

- `src/lib/admin/adminControl.ts`
- `src/lib/features/featureSwitches.ts`
- `src/components/admin/AdminControlHost.tsx`
- `src/components/admin/AdminMessageBanner.tsx`

This makes the admin control model the natural place for the Stay master switch. However, a visual hide is insufficient. The module must be guarded at route, permission, and data-access levels.

## Recommended toggle model

### Master config field

Add a business-level or admin-level config value such as:

- `stay_enabled: true | false`
- `stay_version: 'v1'`
- `vertical: 'retail' | 'restaurant' | 'stay'`

This should be stored in the shop config and mirrored through the admin control system so desktop clients and any other client share the same value.

## Enforcement design

### 1. App startup

On startup, the app loads:

- business profile
- admin override config
- feature switches
- stay module flag

Then it resolves:

- `isStayEnabledForBusiness`
- `isStayRouteAllowed`
- `isStayWriteAllowed`

### 2. Route guard

All Stay routes should enforce the flag before rendering the page. This should be a server/client guard, not a UI-only condition.

Recommended rule:

- if disabled and user is not explicitly permitted, render a blocked access state
- if disabled and user has a valid admin role, allow access to the config page only

### 3. Data access guard

At the data layer, all Stay read/write operations should fail closed when the module is disabled.

Recommended logic:

- block writes to `rooms`, `bookings`, `stay_charges`, `stay_payments`
- block route fetches for stay records
- log the blocked access to the audit log
- do not silently degrade to retail data

## Synchronization design

Because the app is local-first, config changes must be safe.

Recommended practices:

- cache the toggle locally with a short TTL
- refresh it on app launch and on any admin control event
- mark current session state as stale if the config changes while the app is open
- force route re-evaluation on config change
- close or reinitialize active stay sessions safely when the toggle flips off

## Session safety requirements

If Stay is active when the admin disables it:

- active room sessions should be gracefully closed or restricted
- unfinished check-ins should remain read-only or be securely invalidated
- any in-memory state must be purged or locked
- UI should refresh without inconsistent state

This should be treated as a configuration change event, not just a filter change.

## Recommended implementation shape

Use the existing pattern already present in the repo:

- admin control stored centrally
- local override values in localStorage / app state
- active route validation at runtime
- audit logging for disabled access attempts

This fits the current project architecture better than introducing a brand-new auth model for this feature.

## Security checklist

- module disabled by admin blocks direct URL access
- data access is blocked even if the route is manually entered
- user permissions are validated
- old sessions are invalidated safely
- config changes propagate to the UI and service layer
- audit log records attempted access to a disabled module

## Conclusion

The master toggle should be implemented as a true access-control feature, not just a UI toggle. The repo already contains the right patterns for remote control and feature gates; Stay should reuse them.
