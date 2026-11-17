# Current Project Status

**As of:** 2026-11-16
**Overall Stay status:** Preparation only; integrated Phase 1 **NOT READY**.

## Completed during current preparation

- **Completed task:** Read all 50 workspace Markdown documents and reviewed relevant current Desktop source for identity, Admin control, auth/staff, cloud, vertical profiles, database, and tests.
- **Completed task:** Read-only Git audit; recorded the pre-existing dirty worktree in `REPOSITORY_INVENTORY.md`.
- **Completed task:** T0 evidence boundary established for the available Desktop repository.
- **Completed task:** Created persistent project-memory documents and appended current status to existing roadmap/architecture/instructions.

These are documentation/discovery completions only. No Stay application task is completed.

## Verified implementation

- Only Desktop source is available in the workspace.
- No Stay route, domain, activation config/lease consumer, permission, or Dexie entity/migration is present.
- Desktop local business ID and cloud business ID are distinct; Desktop mapping is locally implemented.
- Desktop has generic per-device Admin control but no verified business-scoped Stay authorization.
- Desktop's usual login is a local owner/master-password profile; no verified Desktop per-employee Stay session exists.
- Staff model has generic permission fields; the permissions dialog is deprecated/empty and no Stay grants exist.
- The old global cloud sync gate is disabled, but a separate user-enabled cloud outbox and direct Firebase paths exist.

## Approved decision

- Stay is an integrated module in existing Kamai Plus Desktop and Android products, not a standalone application.
- Restaurant functionality and existing records must remain unaffected.
- Stay is intended to reuse existing authentication, identity, and permission mechanisms, not introduce parallel employee auth.
- Stay launches in English and Marathi; Hindi is future work.
- No source code, schema, migration, production rules, or deployment changes are authorized by the current preparation task.

## Blocked / unknown

- Android, Admin Console, Cloud Functions, and Firestore rules source is absent.
- Canonical identity mapping across Desktop, Android, Admin, and licence association is unresolved.
- Backend authorization and lease issuance are unverified.
- Desktop staff authentication and cross-platform permission enforcement are unresolved.
- Staging environment, credentials, deployment permissions, and named acceptance owners are not verified.
- Owner approvals remain open for the proposed config contract, lease policy, owner/staff access semantics, and expiry/history behavior.

## Git and preservation state

The pre-task branch was `main`, ahead of `origin/main` by 13 commits, with existing tracked modifications, untracked Stay/design documents, and eight untracked catalog JSON files. Exact paths are in `REPOSITORY_INVENTORY.md`. Those changes have been preserved. No GitHub operations, commits, pushes, branch changes, or remote changes were performed.

## Validation record

- Documentation review: completed.
- Source inspection: completed for identified Desktop paths.
- Tests/build/lint: **not run**; no application code changed.
- Final worktree status verified: the pre-existing source/test/locale changes remain present; this task added no application source, tests, locale data, schema, or migration. The only tracked-file modification from this task is the continuity section in `AGENTS.md`; project-memory and roadmap/architecture Markdown files are new or pre-existing untracked documentation.

## Next recommended action

Obtain read-only access to the Android/Admin/Functions/rules repositories and a non-production environment, then resume T0 by proving canonical identity, Admin write authorization, backend lease enforcement, and actual employee auth/permission behavior. Do not start Desktop implementation before these blockers and owner approvals are resolved.
