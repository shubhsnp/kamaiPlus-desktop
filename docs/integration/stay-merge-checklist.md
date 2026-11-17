# KAMAI STAY — UPSTREAM MERGE & VERIFICATION CHECKLIST

**Document:** `docs/integration/stay-merge-checklist.md`  
**Target:** Clean Pull Request to Upstream Repository Owner (`sayrahul/kamaiplusDesktopApp`)  
**Last Updated:** November 2026  

---

## 1. Pre-Merge Verification Checklist

Prior to opening the upstream Pull Request, the developer must verify every item:

### 1.1 Scope & Isolation Checks
- [ ] No files in `src/components/restaurant/` were modified.
- [ ] No files in `src/lib/restaurant/` were modified.
- [ ] No files in `src/components/billing/` or `src/components/invoices/` were broken.
- [ ] Only 3 shared upstream files were modified:
  - `src/components/layout/Sidebar.tsx` (Stay menu item)
  - `src/lib/db/index.ts` (Stay table definitions)
  - `src/locales/{mr,hi,en}.json` (Bilingual string additions)
- [ ] All Stay source code resides exclusively in:
  - `src/app/stay/`
  - `src/components/stay/`
  - `src/lib/stay/`
  - `docs/stay/`

### 1.2 Code Quality & Build Checks
- [ ] `npx tsc --noEmit` exits with **0 errors**.
- [ ] No `any` types in domain models (`src/lib/stay/types.ts`).
- [ ] All monetary fields strictly use integer paise (`amount_paise`).
- [ ] No floating-point rounding math used in financial ledgers.
- [ ] No hardcoded secrets, API keys, or `.env` files staged in Git.

### 1.3 Functional & UI Regression Checks
- [ ] Restaurant POS launches and allows order entry, table layout change, and KOT generation.
- [ ] Retail billing launches and allows barcode lookup and thermal printing.
- [ ] Stay Room Rack renders and allows 4-click walk-in check-in.
- [ ] Advance deposit receipts print cleanly in both A4 and 80mm thermal formats.
- [ ] WhatsApp receipt link opens correctly with Marathi/English templates.
- [ ] Housekeeping board updates automatically when guest checks out.
- [ ] Both Light and Dark UI themes render cleanly with no text clipping.

---

## 2. Git PR Submission Steps

1. Create a dedicated integration branch:
   ```bash
   git checkout -b integration/stay-module-v1
   ```
2. Rebase onto latest upstream:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```
3. Push to independent origin:
   ```bash
   git push -u origin integration/stay-module-v1
   ```
4. Open Pull Request on GitHub:
   - Base repository: `sayrahul/kamaiplusDesktopApp` (`main`)
   - Head repository: `shubhsnp/kamaiPlus-desktop` (`integration/stay-module-v1`)
   - Attach [`docs/integration/stay-integration-guide.md`](stay-integration-guide.md) to PR description.
