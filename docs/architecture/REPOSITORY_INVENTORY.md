# Repository Inventory and T0 Evidence

**Inventory date:** 2026-11-16
**Scope:** Available workspace and current Desktop source/documentation; no external repository or live service was queried.

## Workspace and repositories

| Component | Availability | Evidence/status |
|---|---|---|
| Kamai Plus Desktop | Available at `D:\KamaiPlus Workspace\KamaiPlus Desktop App` | Only Git repository found; source and 50 Markdown documents reviewed |
| Android application | Not present | References in Desktop documents are documentation-only |
| Admin Console | Not present | Generic Desktop control client exists; Admin writer/UI not verified |
| Firebase Cloud Functions/backend | Not present | No Functions source tree found |
| Firestore security rules | Not present | No `firestore.rules` found; deployed rules not queried |
| Shared Stay package/API | Not present | No shared contract implementation found |
| Staging Firebase/service environment | Unknown | Not accessed or verified |

The root `firebase.json` configures Firebase Hosting for Desktop update files. This is not evidence that Admin/Functions/rules source is present or that a staging/deployment environment is available. Firebase client configuration and SDK code do not prove current production rule behavior.

## Desktop architecture and relevant source

| Responsibility | Verified paths / behavior |
|---|---|
| App architecture | `package.json`, `ENGINEERING_BIBLE.md`, `src/app/layout.tsx`; Next.js/React/TypeScript rendered in Electron |
| Electron main/preload | `main.js`, `preload.js`, `adminLink.js`, `licence.js`; IPC and machine/licence handling |
| Local database | `src/lib/db/index.ts`; Dexie/IndexedDB, 14 existing tables; no Stay entities |
| Vertical profile | `src/lib/business/verticalProfile.ts`; grocery, pharmacy, clothing, hardware, restaurant, retail; no Stay |
| Feature switches | `src/lib/features/featureSwitches.ts`; local switches and Restaurant mode, no Stay authorization |
| Generic Admin control | `src/lib/admin/adminControl.ts`, `src/components/admin/AdminControlHost.tsx`, `src/lib/desktop/desktopBridge.ts`; per-device generic controls, not business-scoped Stay config |
| Routes and UI gating | `src/components/features/FeatureGate.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/layout/AppShell.tsx`; no Stay route |
| Business context | `src/components/layout/BusinessProvider.tsx`; reads first local business; not a verified cross-platform business resolver |
| Local login | `src/components/auth/AuthForm.tsx`, `src/lib/auth.ts`, `src/lib/auth/masterPassword.ts`; local owner/master-password path |
| Cloud identity/mapping | `src/lib/cloud/cloudAccount.ts`, `src/lib/cloud/cloudContract.ts`, `src/lib/cloud/cloudPull.ts`, `src/lib/cloud/cloudPush.ts` |
| Staff model | `src/lib/cloud/staff.ts`, `src/components/settings/staff/StaffPermissionsDialog.tsx`, `src/components/settings/staff/StaffTab.tsx`; no Stay grant; Desktop permissions UI is deprecated/empty |
| Cloud sync gates | `src/lib/firebase/cloudAvailability.ts`, `src/lib/firebase/lazyCloud.ts`, `src/lib/firebase/backgroundSync.ts`; legacy sync disabled; separate cloud outbox and other Firebase paths also exist |
| Tests | `scripts/e2e_simulation.ts`, `scripts/electron_e2e.mjs`, `package.json`; project-specific E2E/smoke/cloud commands; no conventional unit-test runner identified |

## Business and device identity mapping

| Identity | Verified evidence | Must not be conflated with |
|---|---|---|
| Desktop local business ID | `src/components/onboarding/onboardingSubmit.ts` builds `biz_<sanitized first 8 characters of user ID>_<timestamp>`; stored in local Dexie business row. `AuthForm.tsx` can use `biz_pending` before a local business exists. | Cloud business ID, Android ID, Admin ID |
| Desktop cloud business ID | `src/lib/cloud/cloudAccount.ts` derives `biz_<Firebase uid>` for a linked cloud account. | Local business ID |
| Local-to-cloud mapping | `src/lib/cloud/cloudContract.ts` carries local and cloud IDs separately; `cloudPull.ts` maps remote rows into local context without rewriting local identity. | Proof of Admin/Android identity parity |
| Admin Console business ID | No Admin source available. | Desktop IDs or license key |
| Android business ID | No Android source available. Desktop docs describe a possible contract, but do not verify Android code. | Any ID without Android/backend evidence |
| Desktop licence key | Sent by `licence.js` to the `desktopLicence` service. | Business ID |
| Desktop machine ID | Machine-derived, hashed identifier used for licence/device binding. | Business ID or employee identity |
| Cloud sync device ID | `src/lib/cloud/cloudPush.ts` creates a `desk_*` identity for the computer. | Licence key, canonical business ID |

**T0 result:** The Desktop local/cloud relationship is verified, but a single canonical business ID across Desktop, Admin, Android, and any licence association is not. A client-supplied ID or device licence alone cannot safely prove business membership.

## Admin and authorization flow

**Verified Desktop flow:** `main.js` initiates licence check-in through `licence.js`; the request contains licence/device/application health fields. A successful response's `body.control` is cleaned and persisted per device in `admin_control.json` by `adminLink.js`; Electron IPC forwards it to the renderer; `AdminControlHost` applies forced local feature overrides. Default check-in is hourly, a server control may set 15–360 minutes, and a five-minute main-process tick performs checks.

**Important boundary:** this is a per-device generic control transport. It has no verified business ID, Stay module config, lease, authenticated business association, or Stay-specific service authorization. It is not proof of a business-scoped Admin toggle.

**Employee access:** Desktop's usual local unlock is not per-employee authentication. A Google/Firebase cloud account is separate from a staff session. Staff records contain generic flags, but the Desktop permission dialog is empty/deprecated and Stay permission names are absent. Cloud Function and Firestore enforcement cannot be verified without their source.

## Cloud behavior nuance

`CLOUD_SYNC_ENABLED = false` guards the legacy lazy/background sync and onboarding Firestore paths. A separate outbox sender in `src/lib/cloud/cloudPush.ts` can be enabled per computer with a linked account; direct Firebase uses also exist for staff and Restaurant features. Therefore “all cloud sync is disabled” is inaccurate. None of these current paths is a verified Stay configuration/lease service.

## Git baseline and preservation

Read-only status at the start of the documentation task:

- Branch: `main`, ahead of `origin/main` by 13 commits.
- Existing modified tracked files:
  `scripts/e2e_simulation.ts`, `scripts/electron_e2e.mjs`,
  `src/components/billing/BillPrinterSetup.tsx`,
  `src/components/restaurant/FastPosScreen.tsx`,
  `src/components/restaurant/OrderPanel.tsx`,
  `src/components/restaurant/OrderScreen.tsx`,
  `src/components/restaurant/PayDialog.tsx`,
  `src/components/restaurant/RestaurantPage.tsx`,
  `src/components/settings/PrintSettingsCard.tsx`,
  `src/lib/constants/version.ts`,
  `src/lib/restaurant/words.ts`,
  `src/lib/whatsNew/changelog.ts`,
  `src/lib/whatsNew/changelogOlder.ts`,
  `src/locales/hi.json`, and `src/locales/mr.json`.
- Pre-existing untracked product-catalog JSON:
  `kamaiplus_agri_inputs_batch1.json`,
  `kamaiplus_catalog_batch1.json`,
  `kamaiplus_cosmetics_general_batch1.json`,
  `kamaiplus_garments_footwear_batch1.json`,
  `kamaiplus_hardware_paint_batch1.json`,
  `kamaiplus_pharmacy_catalog_batch1.json`,
  `kamaiplus_restaurant_cafe_batch1.json`,
  `kamaiplus_stationery_books_batch1.json`.
- Numerous pre-existing untracked architecture/Stay Markdown files are listed in the documentation inventory below. They were not overwritten or deleted.
- The remote was inspected read-only. No branch, remote, staging, credential, or deployment changes were made. No secrets were read.

This documentation task adds new project-memory files and targeted status addenda; no existing source or test was edited. Review the final Git diff to distinguish these doc changes from pre-existing user work.

## Markdown documentation reviewed

All 50 Markdown files were reviewed. This inventory is a review list, not a claim that every statement in them is implemented:

```text
AGENTS.md
COST_AND_DEPENDENCY_REGISTER.md
DATABASE_CHANGE_PLAN.md
DEVELOPMENT_ROADMAP.md
ENGINEERING_BIBLE.md
EXISTING_FEATURE_INVENTORY.md
KAMAI_STAY_ARCHITECTURE.md
RISK_REGISTER.md
STAY_ADMIN_TOGGLE_DESIGN.md
STAY_ANDROID_DESKTOP_INTEGRATION.md
STAY_ARCHITECTURE_DECISIONS.md
STAY_CROSS_REPOSITORY_READINESS.md
STAY_DATABASE_SCHEMA.md
STAY_FINAL_ARCHITECTURE_REVIEW.md
STAY_FINANCIAL_ARCHITECTURE.md
STAY_IMPLEMENTATION_BLUEPRINT.md
STAY_PHASE1_EXECUTION_PLAN.md
STAY_PHASE1_EXTERNAL_DEPENDENCIES.md
STAY_PHASE1_FINAL_DECISIONS.md
STAY_PHASE1_IMPLEMENTATION_PLAN.md
STAY_PHASE1_OPEN_DECISIONS.md
STAY_PHASE1_TASK_BREAKDOWN.md
STAY_PHASE1_TEST_CASES.md
STAY_SECURITY_DESIGN.md
STAY_SYNC_ARCHITECTURE.md
STAY_TEST_STRATEGY.md
SYSTEM_ARCHITECTURE.md
docs/CLOUD_DATA_CONTRACT.md
docs/DESKTOP_AUDIT_2026-10-09.md
docs/FUTURE_SCOPE.md
docs/HELP_SYNC.md
docs/LAPTOP_UI_PLAN.md
docs/PLATFORM_TRACKER.md
docs/UI_TOUR_PLAYBOOK.md
docs/VERTICAL_PLAN.md
docs/archive/HANDOVER.md
docs/archive/KamaiPlus_Complete_App_Documentation.md
docs/archive/SYSTEM_ARCHITECTURE.md
docs/kamaiplus-stay/01-project-understanding.md
docs/kamaiplus-stay/02-existing-workflows.md
docs/kamaiplus-stay/03-recent-documentation-review.md
docs/kamaiplus-stay/04-stay-feasibility-analysis.md
docs/kamaiplus-stay/05-proposed-architecture.md
docs/kamaiplus-stay/06-database-api-impact.md
docs/kamaiplus-stay/07-admin-toggle-design.md
docs/kamaiplus-stay/08-risk-assessment.md
docs/kamaiplus-stay/09-testing-strategy.md
docs/kamaiplus-stay/10-implementation-roadmap.md
docs/kamaiplus-stay/11-open-questions.md
.agents/rules/git_versioning.md
```

## Git/GitHub safety strategy

**Proposed, not executed:** preserve the current dirty worktree; capture `git status` and review diffs before any future change; obtain explicit approval before a backup method that writes files, creating/switching branches, staging, commits, pushes, remote changes, merges, or GitHub operations. Do not push this proprietary source to a public repository. Make a task branch only after approval and after a backup/recovery plan is agreed. No GitHub operation was performed for this preparation.
