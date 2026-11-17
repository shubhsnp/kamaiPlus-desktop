# 03. Recent Documentation Review

## Review scope

The relevant documentation in this workspace is concentrated in:

- `AGENTS.md`
- `ENGINEERING_BIBLE.md`
- `docs/PLATFORM_TRACKER.md`
- `docs/VERTICAL_PLAN.md`
- `docs/CLOUD_DATA_CONTRACT.md`
- `docs/FUTURE_SCOPE.md`
- `docs/HELP_SYNC.md`
- `docs/LAPTOP_UI_PLAN.md`

This is the current authoritative material for product decisions. The older archive files in `docs/archive/` are historical and not the primary map for current architecture.

## File-by-file review

### `AGENTS.md`

Purpose: project rules and guardrails for AI work.

Important decisions:

- read `ENGINEERING_BIBLE.md` first
- do not modify live product logic without verifying repository truth
- maintain security and product safety boundaries
- preserve the current app and avoid regressions

Limitations:

- not an architecture document; it is a policy file

### `ENGINEERING_BIBLE.md`

Purpose: canonical product map for the desktop app.

Important decisions:

- the app is a Next.js + Electron desktop POS app
- the system is offline-first and local-data-first
- money is integer paise, not floats
- Firebase is optional and not the primary data source
- a single app supports a universal retail product line

Limitations:

- it is written for the current retail product, not a lodging product
- it does not define a Stay vertical or its tables

### `docs/PLATFORM_TRACKER.md`

Purpose: cross-platform decision log for Desktop + Android + website.

Important decisions:

- the desktop and Android apps should converge around shared product logic
- Firebase and cloud sync are part of the shared platform plan
- the website and admin flows are intentionally kept separate from direct app logic

Limitations:

- it is a tracker, not a product spec for Stay
- it documents a multi-platform plan, not a hospitality domain design

### `docs/VERTICAL_PLAN.md`

Purpose: emerging vertical architecture and product presets.

Important decisions:

- vertical selection is a real product architecture concept
- the product supports different business presets (`grocery`, `restaurant`, etc.)
- there is already a pattern for vertical-specific feature switching and profile configuration

This is the most relevant existing document for a Stay vertical because it shows the app is already designed to extend by business category rather than by standalone app creation.

### `docs/CLOUD_DATA_CONTRACT.md`

Purpose: cross-app cloud data mapping.

Important decisions:

- cloud data uses a shared schema with business IDs and paise-based money values
- collections are normalized across Desktop and Android
- one business can own a consistent product and sales cloud model

This matters directly for Stay because new domain tables should attempt to follow the same data contract discipline rather than inventing ad hoc fields.

### `docs/FUTURE_SCOPE.md`

Purpose: planned improvements and backlog items.

Important decisions:

- the repo already documents modular improvements and vertical-related future work
- the backlog includes product evolution concepts, but not a Stay module

Limitations:

- it is a planning backlog, not a verified implementation map

### `docs/HELP_SYNC.md` and `docs/help-map.json`

Purpose: app-tour and help-guide synchronization.

Important decisions:

- UI changes need help-impact tracking and version queueing
- product screens and help text are explicitly linked to app files

Limitations:

- not relevant to Stay implementation logic itself, but relevant to release hygiene if Stay adds screens

### `docs/LAPTOP_UI_PLAN.md`

Purpose: desktop UX planning for multi-screen product work.

Important decisions:

- the app is designed around a reusable shell with different vertical needs
- there is a documented design system and multi-vertical layout expectation

Limitations:

- it does not carry Stay-specific tasks yet

## Latest technical decisions that matter for Stay

The strongest current decisions are:

1. the app is a single desktop product with vertical configuration, not a bundle of standalone apps
2. the product already uses a vertical profile mechanism
3. restaurant mode is the clearest example of a domain-specific vertical inside a shared app
4. cloud data contracts and feature switches are intentionally standardized

## Conflicts and unresolved questions

The main unresolved questions are not code issues but product questions:

- whether Stay is a business profile inside the same app or a different product surface
- whether guest room data should live in the same business document or a separate collection set
- whether the admin toggle should live in the desktop app only or also be enforced in cloud config
- whether the app will need room calendars, occupancy rules, or a booking engine

## Conclusion

The current documentation is consistent: there is no existing implementation for Stay, but the architecture already supports a new business vertical inside the same application shell. This makes Stay feasible as a planned extension, provided the domain design is treated as a real product addition rather than a small edit to an existing screen.
