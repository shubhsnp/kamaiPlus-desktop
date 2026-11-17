# 11. Open Questions

## Product questions

### 1. Should Stay be a business vertical inside the current KamaiPlus app?

This is the most important product decision. The current repo strongly points to the “same app, different vertical” model, but it should still be formally approved.

### 2. What exact accommodation domain is in scope?

The repo does not define whether Stay includes:

- lodges / hostels
- small hotels
- room rentals
- guesthouse bookings
- only room billing or full occupancy management

### 3. Is room inventory a first-class product or a loose service catalog?

This affects the data model significantly. If the product is only for room billing and guest ledger, a simpler model may be enough. If full occupancy management is required, a richer room and booking model is necessary.

### 4. Will there be a separate staff permission model for Stay?

Current repo patterns support role-based access, but the specific Stay roles are not yet defined.

## Data questions

### 5. Should Stay data share the same `business_id` model?

The recommended answer is yes, but it must be confirmed. This would allow business-level consistency while keeping a separate Stay domain namespace.

### 6. Should Stay use separate collections or sub-collections under the same business?

This is a design choice. The safer default is separate Stay collections with explicit `business_id` and `vertical` scoping.

## Admin / config questions

### 7. Where should the master toggle live?

The recommended answer is the admin control / business config layer, reused with the existing remote-control pattern in the repo. This still needs product-level signoff.

### 8. Should the toggle also block API/data calls in the cloud layer?

Recommended: yes. A UI hide alone is not acceptable for a gated module.

## Reporting and legal questions

### 9. What Stay reports are mandatory at launch?

Examples include occupancy, room revenue, deposits, and unpaid stay dues. These should be prioritized from the business requirement scope.

### 10. Are there legal or GST requirements for stay bills and lodging invoice formats?

This matters for taxation and invoice rules. The repo currently models GST and invoice logic for retail and restaurant use and would need a Stay-specific legal interpretation.

## Implementation questions

### 11. Do we need offline room availability calculation during network loss?

The app is offline-first; this may be required for real-store reliability.

### 12. Should stay config and records sync to Firebase or remain desktop-local only for launch?

The current product architecture supports both. A launch decision is needed.

## Conclusion

The most important unknowns are product scope and feature gating. The codebase supports a Stay vertical, but the exact business rules and security model still need stakeholder approval before implementation begins.
