# Approved Architecture Decisions

**Purpose:** Record only explicit owner directions and verified foundational facts. Recommendations are not approvals.

## Owner-approved product requirements

| ID | Decision | Scope/status |
|---|---|---|
| AD-01 | Kamai Plus Stay is a module within the existing Kamai Plus Desktop and Android products; it is not authorized as a standalone application. | Approved product direction; no Stay implementation exists yet. |
| AD-02 | Restaurant functionality and existing Restaurant data must remain stable and unaffected by Stay work. | Approved constraint; every future change needs regression validation. |
| AD-03 | Use existing authentication, business identity, and permissions where feasible. Do not create a parallel employee authentication system. | Approved constraint; current Desktop capability is insufficiently verified for Stay authorization. |
| AD-04 | Initial Stay language support is English and Marathi; Hindi is a future target. | Approved product direction; Stay translations do not exist. |
| AD-05 | Stay should be comfortable for small lodge owners and staff, including less technically experienced users. | Approved usability goal. |
| AD-06 | Current work is preparation only. Do not alter source, schema, migrations, production Firebase rules, or deploy without explicit approval. | Current task boundary. |
| AD-07 | Preserve all existing tracked and untracked work; no GitHub operations or Git mutations without explicit approval. | Current safety requirement. |

## Verified foundational implementation (not new decisions)

- Desktop is a Next.js/React/TypeScript application packaged in Electron.
- Desktop local persistence uses Dexie/IndexedDB.
- Existing Restaurant and non-Restaurant profiles share the Desktop shell.
- Generic Admin/device control and local feature switches exist, but are not a Stay business entitlement.
- Desktop local and cloud business identifiers are separate.
- Desktop's local master-password login is not a per-employee session.
- No Stay domain, route, config lease, permission, or schema is implemented.

## Not approved by this document

These remain proposals/open decisions, not implementation instructions:

- Whether Stay is a separate business vertical or a module within an existing profile.
- Admin configuration collection/path, backend endpoint, or transport.
- Canonical business ID and licence-to-business association.
- Lease signing/integrity mechanism, duration, refresh cadence, offline tolerance, and expiry UX.
- Historical read-only behavior after expiry or explicit remote disable.
- Owner access through local master-password login and employee role-to-permission mappings.
- Exact permission vocabulary, route namespace, cache storage, and remote-disable behavior.

See `OPEN_DECISIONS_AND_BLOCKERS.md` and the existing `STAY_PHASE1_FINAL_DECISIONS.md`. That final decisions document is a recommendation record and explicitly requires owner approval.
