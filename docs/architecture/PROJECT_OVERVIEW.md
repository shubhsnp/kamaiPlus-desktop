# Kamai Plus Stay — Project Overview

**Last workspace review:** 2026-11-16
**Project state:** Preparation and T0 investigation only; integrated Phase 1 is **NOT READY**.

## Purpose and product direction

Kamai Plus Stay is intended to add lodge/hotel management to the existing Kamai Plus Desktop and Android applications. It is not authorized to become a separate standalone application. Restaurant must remain stable and operationally separate from Stay. The target user includes small lodge owners and employees in rural Maharashtra who may not have an accountant or technical expert available.

**Approved product requirements from the owner**

- Stay is a module in the existing Kamai Plus products, not a separate app.
- Central Admin activation is required, at business level, with consistent behavior on Desktop and Android.
- Reuse existing authentication, business identity, and permissions where viable; do not create parallel employee authentication.
- Marathi and English are initial Stay languages; Hindi is a future target.
- Keep the Restaurant experience and existing records unaffected.
- The current approved task is preparation only. No Stay source, schema, migration, or deployment work is authorized.

## Current repository evidence

Only the Kamai Plus Desktop repository is present in the workspace. Its existing stack is Next.js, React, TypeScript, Electron, Dexie/IndexedDB, and Firebase client SDK. There is no Stay route/domain/schema/lease/permission in the inspected source.

The codebase already has Restaurant, vertical-profile, local feature-switch, generic per-device Admin-control, local master-password, cloud-account, and staff-record paths. These are existing product mechanisms, not proof of a Stay entitlement or cross-platform authorization design.

## Evidence labels

- **Verified implementation:** directly found in the available source.
- **Approved decision:** an explicit owner direction recorded here; not automatically an implemented feature.
- **Proposed design:** recommendation that still needs required approval or implementation.
- **Unknown:** not verified by available source.
- **Blocked:** cannot proceed safely until a named dependency or decision is supplied.
- **Completed task:** work completed and validated; documentation-only activity is not app implementation.

## Current status at a glance

| Area | Status |
|---|---|
| Desktop repo/source discovery | Completed for this preparation; source remains unchanged |
| Git worktree audit | Completed read-only; existing modifications/untracked assets are preserved |
| Stay Phase 1 Admin/backend | Blocked: repositories and service source unavailable |
| Canonical business identity | Partial: Desktop local/cloud mapping verified; Admin/Android/licence association unknown |
| Employee authentication/permissions | Blocked: no verified Desktop staff session or Stay permission; external implementation unavailable |
| Android parity | Blocked: Android repository unavailable |
| Phase 1 implementation | Not started and not authorized |
| Tests/build during this documentation task | Not run |

## Continuity protocol

At the start of a new task, read `AGENTS.md`, `ENGINEERING_BIBLE.md`, `CURRENT_PROJECT_STATUS.md`, `ACTIVE_TASK.md`, and relevant approved/open decision documents. Then inspect the exact current source. Do not infer external behavior from Desktop documentation.

At completion, update `CURRENT_PROJECT_STATUS.md`, `ACTIVE_TASK.md`, and `CHANGELOG_AI_DEVELOPMENT.md`; state tests actually run and blockers. Do not commit, push, change remotes, deploy, or modify application source without explicit approval.

## Navigation

- `SYSTEM_ARCHITECTURE.md` — current architecture notes and source-verified corrections.
- `REPOSITORY_INVENTORY.md` — repository evidence, source map, Git baseline, and documentation reviewed.
- `APPROVED_ARCHITECTURE_DECISIONS.md` — owner-approved product constraints, separated from technical recommendations.
- `OPEN_DECISIONS_AND_BLOCKERS.md` — unresolved approval and external access gates.
- `DEVELOPMENT_ROADMAP.md` — staged product roadmap and current gate.
- `ACTIVE_TASK.md` — current preparation task and next safe action.
- `TEST_STRATEGY.md` — validation plan and evidence rules.
- `CHANGELOG_AI_DEVELOPMENT.md` — documentation and status history.
