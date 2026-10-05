<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 🛡️ IRONCLAD ENGINEERING CONSTITUTION FOR ALL AI AGENTS

You are working on **KamaiPlus (Kamai+)**, an offline-first Billing POS and Retail Management Platform for Indian Small Businesses. Every AI agent MUST strictly adhere to the following rules without exception. Breaking these rules causes user frustration, regressions, and broken builds.

---

## 📕 RULE 0: READ `ENGINEERING_BIBLE.md` FIRST — BEFORE ANY CODE

`ENGINEERING_BIBLE.md` in the repo root is the **canonical, code-verified map** of this
application: routes, Dexie schema, which file writes which table, the sale-completion
sequence, the print pipeline, the performance contract, and a registry of problems that
are already solved and must not regress.

1. **Open it before you plan or edit anything.** It exists so you do not have to scan
   180 files, and so you do not re-break something that was already fixed.
2. **Never invent a file, component, function or table name.** Verify it exists first
   (`ls`, `rg`). The old hand-written docs (`SYSTEM_ARCHITECTURE.md`, `HANDOVER.md`,
   `KamaiPlus_Complete_App_Documentation.md`) are stale history in `docs/archive/` — do
   not plan from them; the Bible is the only current map.
3. **If you discover the Bible is wrong, correct it in the same commit as your change.**
   A stale map causes the exact double-work and hallucination it was written to prevent.
4. **Every bug you fix gets an invariant** in SUITE 9 of `scripts/e2e_simulation.ts`
   (or the fitting suite), so it cannot silently come back.

## 🎯 RULE 1: ATOMIC TASK ISOLATION & SURGICAL MODIFICATION (ONE THING AT A TIME)
1. **Strict Single-Scope Focus:** Work on ONLY the specific button, feature, modal, or page requested by the user. Do NOT attempt to refactor, "clean up", or redesign adjacent components in the same prompt.
2. **Zero Unsolicited Rewrites:** NEVER re-architect, simplify, or rewrite working features, styling, or handlers in existing files.
3. **No Silent Removals:** Never remove or disable an existing button, badge, modal, input, calculation, or handler unless the user explicitly commands you to delete it.
4. **Preserve Solved Problems:** Once an issue is solved (e.g. PDF generation, invoice QR codes, modal spacing, form validation, logout authentication), NEVER touch or revert that logic during unrelated tasks.

---

## 🚫 RULE 2: ZERO CROSS-PAGE REGRESSIONS & STYLE ISOLATION
1. **Component-Level Scoping:** All Tailwind styling must be self-contained on the specific component. NEVER add sweeping global CSS rules in `src/app/globals.css` or layout wrappers that unintentionally break other pages.
2. **Page Container Hygiene:** Standalone portal pages (e.g., `/admin`, `/onboarding`, `/auth`, `/invoice`) and standard POS shell pages (`/`, `/billing`, `/products`, `/khata`, `/settings`) have distinct layout requirements. Never mix their container styling.
3. **Modal & Drawer Isolation:** Always encapsulate dialogs, drawers, and popups inside modular components in `src/components/<feature>/` so that modifying one modal never alters the parent page layout.

---

## 🔍 RULE 3: MANDATORY DEPENDENCY AUDIT BEFORE MODIFYING SHARED CODE
Before editing ANY shared file in:
- `src/types/` (Global TypeScript models)
- `src/lib/` (Database, utilities, formatting, validation, math engines)
- `src/components/ui/` or `src/components/common/` (Shared UI widgets)
- `src/components/layout/` (AppShell, Navbar, Sidebar)

**YOU MUST:**
1. Run a `grep_search` to identify every single consumer page/component across the codebase.
2. Verify that the change is 100% backward-compatible.
3. Explain the side-effects in simple Hinglish to the user before proceeding.

---

## 🧪 RULE 4: TEST SUITE LOCK-IN (PREVENTING RECURRING BUGS)
1. **Add Invariants for Every Fix:** Whenever a bug is fixed or a critical feature is added (e.g. invoice formatting, validation rules, math accuracy), you MUST add automated assertion checks to `scripts/e2e_simulation.ts`.
2. **Never Break Existing Tests:** The simulation suite (`scripts/e2e_simulation.ts`) contains 238+ active financial, security, validation, and hardware tests. All tests MUST pass 100% with 0 failures before any commit.

---

## 🧩 RULE 5: MODULAR DECOMPOSITION (MAX 400 LINES PER FILE)
1. **Deconstruct Monolithic Pages:** If a page or component exceeds 400 lines or manages multiple distinct tasks (e.g. toolbars, modals, tables, analytics), decompose it into focused sub-components inside `src/components/<feature>/`.
2. **Single Responsibility Principle:** Each file must do one thing well (e.g., `InvoiceModal.tsx`, `AdminMerchantsTab.tsx`, `AddProductModal.tsx`). This completely isolates edits so that modifying one widget CANNOT break the rest of the application.

---

## 📌 RULE 6: MANDATORY VERIFICATION, VERSION BUMP & GIT COMMIT PROTOCOL
Whenever completing work and committing to Git:
1. **TypeScript Validation:** Run `npx tsc --noEmit` and verify **0 compile errors**.
2. **Automated E2E Test Suite:** Run `npx tsx scripts/e2e_simulation.ts` and verify **100% tests pass**.
3. **Application Version Increment:** Increment application version by **+0.1** in both `package.json` and `src/lib/constants/version.ts` (e.g. `4.00.0` -> `4.01.0`). Add the new version's row to `docs/HELP_SYNC.md` (Rule 7) — the tests fail without it.
4. **Clean Commit Message:** Commit with descriptive version tag: `git commit -m "<type>(v<NEW_VERSION>): <description>"`.
5. **Push to Main:** Execute `git push origin main` and confirm clean deployment.

---

## 📖 RULE 7: THE HELP GUIDES FOLLOW THE APP
kamaiplus.com/help (website repo `D:\My Web Sites\KamaiPlus Website`) has 16 guides that describe this app button by button, with real screenshots. A change here can make a guide wrong. Full process: `docs/HELP_SYNC.md`.
1. **Before every version bump** run `node scripts/help_impact.mjs` (or `node scripts/help_impact.mjs <ref>` for several commits). It lists the guides whose screens you touched (`docs/help-map.json`). Open those guides and check what you changed: button names, steps, numbers, screenshots.
2. **Queue it:** add a row to the queue in `docs/HELP_SYNC.md` — version, what the shop sees differently (shop words), guides, status `pending`. Nothing visible changed → `none`. Suite 9 §9j(ai) fails if the current version has no row.
3. **New screen or new guide?** Add it to `docs/help-map.json` (sources + app-tour stages). The tests fail if a guide on the website is missing from the map, or a map pattern matches no file.
4. **When a version reaches shops**, set its rows to `released`; the website's `npm run check` then fails until the guides (English + Hindi + screenshots) are updated. Deploy the website with the release, then set the rows to `on website (site v…)`. Never deploy guides for an app version the shops do not have yet.
