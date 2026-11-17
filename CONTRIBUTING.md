# Contributing to Kamai Plus Desktop

Thank you for contributing to **Kamai Plus Desktop**. To maintain world-class quality, reliability, and security for thousands of Indian merchant users, please adhere to these standards.

---

## 1. Core Engineering Principles

1. **Integer Paise Financial Rule:**
   - NEVER store or calculate currency as floating-point numbers in database entities or services.
   - All rates, charges, payments, and balances must be in **integer paise** (`1 Rupee = 100 Paise`).
   - Convert to rupees only at the final UI rendering boundary.

2. **Offline-First Resilience:**
   - Every feature must operate without internet connectivity.
   - Client-side persistence must use IndexedDB via Dexie.js (`src/lib/db/index.ts`).
   - Every mutation must support `sync_status: 'pending'`.

3. **Multi-Tenancy:**
   - All database queries must be scoped to the active `business_id` from `useBusiness()`.

4. **Zero-Regression Mandate:**
   - Modifying or adding a new vertical (e.g. Stay) must NEVER alter or break existing verticals (e.g. Restaurant, Retail).

---

## 2. Development Workflow

1. **Branching Strategy:**
   - `main`: Production-stable release branch.
   - `develop`: Integration branch for active feature development.
   - `feature/<name>`: Dedicated branch for new features or vertical expansions.
   - `bugfix/<name>`: Dedicated branch for defect resolutions.

2. **Code Standards:**
   - Use strict TypeScript without `any` where possible.
   - Keep components under 300 lines of code; extract complex subcomponents or domain logic into `services/` or `hooks/`.
   - Run type checks before opening any PR:
     ```powershell
     npx tsc --noEmit
     ```

3. **Commit Conventions:**
   Follow Conventional Commits:
   - `feat(scope): ...` for new capabilities.
   - `fix(scope): ...` for bug fixes.
   - `docs(scope): ...` for documentation updates.
   - `refactor(scope): ...` for architectural improvements without behavior changes.

---

## 3. Pull Request Guidelines

Before submitting a Pull Request:
1. Ensure `npx tsc --noEmit` exits with `0 errors`.
2. Verify that light and dark themes render cleanly.
3. Verify that Marathi (`mr`), Hindi (`hi`), and English (`en`) translations exist for all user-facing strings.
4. Verify that physical print previews and WhatsApp share triggers operate cleanly.
