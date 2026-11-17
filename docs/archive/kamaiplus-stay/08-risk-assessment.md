# 08. Risk Assessment

## 8.1 Critical risks

### 1. Existing restaurant and retail regression

Severity: Critical
Probability: Medium
Impact: High

Reason:

- the app is one shared shell with vertical-specific behavior
- a bad toggle or shared data model could affect the restaurant flow or retail flow

Mitigation:

- isolate Stay data and routes
- keep retail tables untouched
- add regression suites for restaurant and retail sales
- keep all new Stay logic behind explicit guard checks

### 2. Data leakage between business modes

Severity: Critical
Probability: Medium
Impact: High

Reason:

- the same business record can be used by multiple verticals in a shared app

Mitigation:

- enforce `business_id + vertical` query filters
- ensure Stay records never cross-pollinate with retail records
- use route and table-level access guards

### 3. Incomplete feature gating

Severity: Critical
Probability: Medium
Impact: High

Reason:

- UI-only hiding is not enough in a multi-mode environment

Mitigation:

- route guard + permission guard + read/write guard + audit logging

## 8.2 High risks

### 4. Cloud sync incompatibility

Severity: High
Probability: Medium
Impact: High

Reason:

- cloud schema is a shared contract and must be extended carefully

Mitigation:

- keep all new Stay fields versioned
- test merge semantics
- avoid overwriting existing retail records

### 5. Session drift when configuration changes

Severity: High
Probability: Medium
Impact: High

Reason:

- local session state can stale out while config is changed

Mitigation:

- refresh config on app startup and admin events
- close or disable Stay UI on config change
- preserve user feedback and provide re-auth flow if necessary

### 6. Permission conflicts across staff roles

Severity: High
Probability: Medium
Impact: High

Reason:

- same app may have staff roles with different vertical access

Mitigation:

- define a clear permission model for Stay: rooms, bookings, billing, check-in/out, room charges, reports
- validate access at both UI and API/data levels

## 8.3 Medium risks

### 7. Reuse of generic ledger model causes incorrect semantics

Severity: Medium
Probability: Medium
Impact: Medium

Reason:

- ledger transactions are generic and may not capture occupancy semantics cleanly

Mitigation:

- add Stay-specific charge and payment entities
- keep a ledger mapping layer for settlements and balances

### 8. Reporting complexity

Severity: Medium
Probability: Medium
Impact: Medium

Reason:

- daily occupancy and room revenue reports are less straightforward than simple sales reports

Mitigation:

- add clear report definitions before implementation
- separate occupancy report from financial reporting contracts

### 9. Offline/temporary network loss

Severity: Medium
Probability: High
Impact: Medium

Reason:

- current app is offline-first

Mitigation:

- support queued local updates for stay activity
- reconcile later once the network returns

## 8.4 Low risks

### 10. UI complexity

Severity: Low
Probability: Medium
Impact: Low

Reason:

- the app already has modular components, so UI structure is manageable

Mitigation:

- use existing billing and restaurant patterns as the design basis

### 11. Documentation drift during rollout

Severity: Low
Probability: Medium
Impact: Low

Reason:

- feature addition can create stale help and architecture docs

Mitigation:

- update `docs/HELP_SYNC.md` and the relevant help map if new screens are shipped

## Conclusion

The biggest technical risks are not around the app shell itself; they are around configuration, access control, and data isolation. If the Stay module is implemented with explicit vertical scoping and a true admin master switch, the risk profile is manageable.
