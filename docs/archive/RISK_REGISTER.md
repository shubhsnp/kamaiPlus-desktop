# Risk Register

## Critical risks
### 1. Restaurant regression
Probability: Medium
Impact: High
Reason: Existing app architecture is shared and vertical-aware; a new Stay module could accidentally affect restaurant logic.
Mitigation: preserve the current restaurant routes and app shell, isolate Stay code, and gate by admin toggle + module guard.

### 2. Module access bypass
Probability: Medium
Impact: High
Reason: UI-only hiding is not enough.
Mitigation: enforce route, permission, and data-access checks for every Stay operation.

### 3. Financial integrity failure
Probability: Medium
Impact: High
Reason: room charges and stay folio changes carry financial risk.
Mitigation: enforce audit trail, immutable records, and explicit adjustments.

## High risks
### 4. Data leakage across business modes
Probability: Medium
Impact: High
Reason: restaurant and stay data may be mixed if tables are shared without vertical scoping.
Mitigation: use `business_id` and `vertical` / `module` scoping on Stay tables.

### 5. Cloud sync drift
Probability: Medium
Impact: High
Reason: shared contract changes can accidentally overwrite or cross-apply data.
Mitigation: versioned schema and merge-safe data handling.

### 6. Permission conflicts
Probability: Medium
Impact: High
Reason: staff role boundaries must be clear.
Mitigation: role model and access checks for room, billing, and refunds.

## Medium risks
### 7. Offline operation inconsistency
Probability: High
Impact: Medium
Reason: the app is offline-first; Stay must reconcile local and server state safely.
Mitigation: queue actions with retry-safe semantics and idempotency.

### 8. Night audit complexity
Probability: Medium
Impact: Medium
Reason: closing a lodging day is a sensitive financial operation.
Mitigation: require explicit validation, unresolved issue display, and strict closing rules.

### 9. Reporting ambiguity
Probability: Medium
Impact: Medium
Reason: occupancy, ADR, RevPAR, and collections require consistent definitions.
Mitigation: define rules before implementation and validate against real scenarios.

## Low risks
### 10. Documentation drift
Impact: Low
Probability: Medium
Reason: additional module features require doc updates.
Mitigation: update the design docs and status notes after each milestone.

## Conclusion
The biggest risk is not a technical failure in the app shell but a business-logic and access-control failure in the new Stay module. The design must prioritize isolation, admin toggle enforcement, and financial integrity.
