# 04. Stay Feasibility Analysis

## Executive finding

KamaiPlus Stay is feasible in this repository, but only as a new vertical domain layered onto the existing architecture. The repository does not currently contain a second business app, nor does it contain any server-side platform that would naturally support a standalone lodging platform without new data models and flows.

## Feasibility by dimension

### 1. Platform feasibility: High

The app already supports more than one business model through a vertical profile pattern:

- `src/lib/business/verticalProfile.ts`
- `src/lib/features/featureSwitches.ts`
- `src/app/restaurant/page.tsx`

This is a strong indication that a Stay vertical can be integrated into the same product shell without establishing a new desktop app.

### 2. Data model feasibility: Medium to High

The data model is already local-first and cloud-aware. The app uses Dexie and a cloud contract layer. For Stay, the main work is not database mechanics but domain modeling:

- room / occupancy / booking entities
- tariffs and rate plans
- check-in and check-out flows
- deposits and stay ledger entries
- housekeeping and service items

These are new business entities, but they can fit into the existing database strategy.

### 3. UI feasibility: High

The codebase already demonstrates a pattern for vertical-specific UI: restaurant screens are functionally distinct from generic retail flows. That validates a Stay interface as a module or page family inside the shared shell.

### 4. Security feasibility: Medium

The repo already has admin control, local-only licence enforcement, and feature switch gating. It does not currently implement a separate multi-tenant permission boundary for a lodging vertical. That means a Stay module will need explicit access control and admin gating, not just menu hiding.

### 5. Reporting feasibility: High

The app has strong reporting and financial data components. These can be extended to occupancy reports, room income, daily occupancy, deposit ledger, and no-show / cancellation summaries.

## Reusable components

The following should be reused directly:

- `verticalProfile` and feature-switch architecture
- `db/index.ts` data access layer pattern
- local backup / restore pipeline
- cloud sync contract and write transforms
- billing and invoice engine
- customer and khata model
- reporting engine
- print and WhatsApp pipelines
- admin control and feature switch override model

## New components required

The following are not present and must be created from scratch:

- room inventory and room master data
- booking / occupancy lifecycle
- check-in / check-out screens
- room rates and stay packages
- guest profile and stay ledger
- stay-specific invoice / receipt logic
- service item and housekeeping item model
- occupancy analytics
- stay-specific feature activation and permissions

## Reuse vs. new build matrix

| Capability | Reuse? | Notes |
|---|---|---|
| Product catalog | Yes | Use as service items / extras / amenities |
| Sales / billing | Yes | Core bill engine is reusable |
| Customer ledger | Yes | Strong match for guest balances |
| Inventory engine | Yes | With room / amenity inventory logic |
| Vertical profile system | Yes | Existing pattern is ideal |
| Cloud sync contract | Yes | Must extend with Stay collections |
| Restaurant screens | Partially | Useful as hospitality model reference |
| Hotel room / booking model | No | Must be designed anew |
| Stay admin config | No | Must be designed anew |
| Entering room occupancy state | No | Must be designed anew |

## Recommendation

The safest and most realistic implementation is:

- a single shared app
- one central admin toggle
- a Stay business profile in the same application shell
- separate Stay modules and data collections
- no new standalone app at this stage

This aligns with the current architecture to a higher degree than a brand-new app or a separate backend microservice.

## Risk level by feasibility

- Product fit: High
- Code reuse: High for platform; Medium for domain logic
- Security integration: Medium
- Operational complexity: Medium
- Architectural risk: Medium, if Stay is designed as a vertical rather than as ad hoc screen additions

## Conclusion

KamaiPlus Stay is feasible using the existing desktop-first architecture, but only if treated as a new product vertical with dedicated room and stay domain models. The platform logic is reusable; the hospitality logic itself is not currently implemented and must be designed intentionally.
