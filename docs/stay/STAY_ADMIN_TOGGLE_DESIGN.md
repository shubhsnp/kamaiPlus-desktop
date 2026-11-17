# STAY_ADMIN_TOGGLE_DESIGN.md

## Verified facts

The repo already contains an actual remote-control mechanism for module-level feature gating.

Relevant implementation:
- `src/lib/admin/adminControl.ts`
- `src/components/admin/AdminControlHost.tsx`
- `src/lib/features/featureSwitches.ts`
- `adminLink.js`
- `src/lib/desktop/desktopBridge.ts`
- `ENGINEERING_BIBLE.md` sections about Admin Console remote control and restaurant mode

What the implementation does:
- `AdminControlHost` reads `getAdminControl()` from the Electron bridge.
- `AdminControlHost` calls `applyFeatureOverrides(c?.features)` and stores forced switches in `localStorage` under `kamai_admin_feature_overrides`.
- `readFeatureSwitches()` merges the shop’s own feature config with the admin override values.
- `restaurant_mode` is treated as an admin-only override, not a normal feature row.
- `adminLink.js` keeps the last control payload in the user data directory as `admin_control.json` and reuses it offline.
- The control is part of the desktop licence check-in model, not a local-only setting created inside the page.

## What exists now

This is not a general “module registry” with ADD-ON feature toggle architecture. The current pattern is feature-level remote control, specifically for things like:
- feature on/off overrides
- public app lock mode
- read-only billing mode
- update requirement enforcement
- per-PC control packages from the Admin Console

The repo also confirms that admin-controlled features can be used to enable or disable a vertical-specific behaviour such as restaurant mode.

## Verified admin toggle behavior

The current implementation is:
- per-device state stored in `admin_control.json`
- forced feature map stored in `localStorage: kamai_admin_feature_overrides`
- app runtime reads these values to affect navigation and feature visibility
- if the app is locked or read-only, the UI blocks the app or billing flow

Important caveat:
- the code is designed to hide or block UI based on the remote control state, but it does not by itself create a secure backend enforcement boundary for a module that must be impossible to access if disabled.

## Required design for Stay

Stay must be designed as a centrally controlled feature with these layers:

1. Admin master toggle in the Admin Console / central config
2. App receives it through the current remote-control pipeline
3. Desktop stores it locally for offline fallback
4. App checks Stay enablement before rendering the Stay route
5. App data layer denies Stay reads/writes when disabled
6. App keeps existing restaurant data and route state untouched

The required toggle model should be explicitly named and treated differently from ordinary feature switches.

Recommended fields:
- `stay_enabled: boolean`
- `stay_module_state: 'enabled' | 'disabled' | 'limited'`
- `stay_scope: 'business' | 'global' | 'device'`
- `stay_updated_at: ISO string`
- `stay_updated_by: admin user id`

## Business vs device scope

The repo’s current remote-control pattern is effectively per-device, with a persisted `admin_control.json` file and hourly check-in from the desktop licence server. That means the existing design is closest to a device-targeted control, not a pure tenant-wide ACL system.

For Stay, the correct model is:
- base admin business activation state
- per-business permission model for employee access
- default per-device reason to hide or disable the module

This supports the requirement that “Stay is optional under Restaurant” while also supporting tenant-level activation where consistent with the existing architecture.

## Recommended behavior

When `stay_enabled = false`:
- Stay route is blocked even if a user manually enters the URL
- Stay data reads are blocked
- Stay write operations are rejected
- current restaurant functionality continues as normal
- existing Stay records remain intact and reappear when enabled again

When `stay_enabled = true`:
- the route and module can be accessed by authorized staff
- business-specific permissions remain enforced by employee role
- the module is still limited by business-level and per-user permission checks

## Offline behavior

The app keeps the last admin control payload offline. This is good for safe failure handling, but it introduces a critical requirement:
- the app must treat a stale admin config as stale state and revalidate it on next startup or sync event
- if Stay is disabled while a user is active, the UI should degrade safely, not leave stale in-memory room state visible

## Desktop and Android integration requirement

The admin toggle should not be a separate Android-only setting. The same control contract should be shared by both clients:
- `stay_enabled`
- `stay_last_updated`
- `stay_access_level`
- `stay_business_scope`
- `stay_version`

This should be carried through the same check-in/control path or a shared admin config contract, without introducing a second independent Stay activation system.

## Recommendation

Use the existing admin-control mechanism as the transport and add a specific Stay activation state to it, rather than creating a new separate toggle implementation.

This is the safest architecture because it reuses what is already verified in the repo and keeps the control in the same Trust domain as the admin console and app lock modes.

## Verified gaps

The repo does not yet show a full backend-enforced module access check for a Stay route. The current app hides features and blocks screens locally, but it does not yet supply a strict “data access is denied if the module is off” contract at the database layer.

That must be added for Stay.

## Recommendation summary

- The existing admin remote-control mechanism is real and implemented.
- The configuration is stored locally as `admin_control.json` and receives updates via the admin check-in flow.
- It is not a pure tenant-wide dynamic registry in this repo; it is effectively a remote control payload delivered to a device.
- Stay should reuse this model, but with a dedicated `stay_enabled` guard enforced at route and data access layers.

## Final architecture decision: business-scoped central Stay activation

### Decision
Stay activation is centrally controlled by Kamai Plus Admin and scoped to each business, not to individual employees and not to a single device-only switch.

### Reason
The repo’s actual admin control model is a centralized remote-control payload and the business model is already scoped by `business_id`. Stay must follow that model rather than becoming a local-only feature toggle.

### Alternatives considered
- Device-only toggle: rejected.
- Android-only toggle: rejected.
- User-level toggle: rejected because it is not the correct activation boundary.

### Risks
- Stale cached config could allow access after a disable if expiry is not enforced.
- If config is not refreshed quickly, some devices may continue to operate under older values.

### Testing implications
- route blocked when `enabled = false`
- service-level data access denied when `enabled = false`
- re-enable restores access only after fresh config validity check
- business mismatch is rejected

### Contract requirements
- `module = 'stay'`
- `enabled: boolean`
- `state: 'enabled' | 'disabled' | 'maintenance'`
- `business_id: string`
- `version: number`
- `updated_at: ISO-8601`
- `updated_by: string | null`
- `source: 'admin_console' | 'cloud_sync' | 'device_cache'`
- `expires_at: ISO-8601 | null`
- `cache_ttl_seconds: number`

### Offline policy
Cached config may be used only until expiration. After expiry, Stay must be treated as disabled until the next valid state is downloaded or the app revalidates the central state.

### Propagation policy
Changes should be visible within the next admin-sync/check-in cycle; if a device remains offline, it must continue only under a non-expired cached value.
