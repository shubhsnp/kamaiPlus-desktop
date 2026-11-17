# KAMAI STAY — UPSTREAM INTEGRATION GUIDE

**Document:** `docs/integration/stay-integration-guide.md`  
**Audience:** Upstream Principal Engineer, Code Reviewers, Release Managers  
**Purpose:** Step-by-step instructions for integrating the Kamai Stay module into the upstream Kamai Plus repository.  
**Last Updated:** November 2026  

---

## 1. Overview & Architecture

Kamai Stay is architected as an **autonomous, self-contained business module** designed to merge cleanly into Kamai Plus with minimal surface-area impact.

### Scope of Integration:
- **Zero Impact on Restaurant Vertical:** Table layout, KOT printing, and POS billing are completely unaffected.
- **Zero Impact on Retail POS:** Fast POS screens, barcode scanners, and inventory management continue operating with 100% fidelity.
- **Isolated Module Codebase:** 98% of all Stay files reside in dedicated subfolders:
  - `src/app/stay/` (App router pages)
  - `src/components/stay/` (UI components, dialogs, wizards, and pickers)
  - `src/lib/stay/` (Domain services, repositories, validators, and types)
  - `docs/stay/` (Module documentation)

---

## 2. Upstream Integration Touchpoints (The Only 3 Modified Files)

When merging the Stay branch into the upstream repository, verify that changes to existing shared files are limited strictly to these 3 locations:

### Touchpoint 1: Navigation Entry (`src/components/layout/Sidebar.tsx`)
Appends a single navigation item pointing to `/stay`.
```tsx
// Conditional rendering based on vertical license
{isStayEnabled && (
  <NavItem
    href="/stay"
    icon={<BedDouble className="w-5 h-5" />}
    label={t('Stay / Lodge')}
    active={pathname.startsWith('/stay')}
  />
)}
```

### Touchpoint 2: Dexie Schema Registration (`src/lib/db/index.ts`)
Adds the 9 dedicated Stay tables to the IndexedDB schema. No existing tables (`orders`, `tables`, `menu_items`, `customers`) are modified.

### Touchpoint 3: Localization JSON Files (`src/locales/{mr,hi,en}.json`)
Appends Stay-specific translation strings. No existing restaurant or retail keys are modified or deleted.

---

## 3. Step-by-Step Merge Procedure

1. **Fetch and Checkout:**
   ```bash
   git fetch origin
   git checkout -b merge/stay-module origin/main
   ```
2. **Merge the Stay Branch:**
   ```bash
   git merge origin/feature/stay-module
   ```
3. **Verify Zero Compilation Errors:**
   ```bash
   npx tsc --noEmit
   ```
4. **Run Regression Verification:**
   - Launch application: `npm run dev`
   - Test Restaurant POS (`/restaurant`) -> verify table creation, ordering, KOT printing.
   - Test Retail POS (`/billing`) -> verify barcode scan, payment tender, receipt print.
   - Test Stay (`/stay`) -> verify room rack, walk-in check-in, checkout, and housekeeping.
5. **Final Upstream Merge:**
   Submit clean Pull Request for the upstream owner's review.
