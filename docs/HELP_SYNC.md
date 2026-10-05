# Help guides stay in step with the app

kamaiplus.com/help has 16 guides (website repo `D:\My Web Sites\KamaiPlus Website`, pages in
`src/pages/help/`) that describe the Desktop app button by button, with real screenshots and
numbers from the demo shop. When the app changes, a guide can become wrong. This file is how every
agent keeps them in step. Rule: **AGENTS.md Rule 7**.

## The three pieces

| Piece | What it does |
| :--- | :--- |
| `docs/help-map.json` | Which app files each guide describes (glob patterns) and which `app-tour` stages take its screenshots. A new screen or a new guide → add it here. |
| `node scripts/help_impact.mjs [ref]` | Lists the guides your change may make wrong (default: uncommitted changes; with a ref: everything since that commit). |
| The queue below | One row per app version: what the shop will see differently and which guides must follow. |

**Checks that hold it together**

- Desktop e2e Suite 9 §9j(ai): every map pattern matches a real file, every guide exists on the
  website, and **the current `APP_VERSION` has a row in the queue** — a version bump without a
  row fails the tests.
- Website `npm run check`: fails while any row says `released` (shops have the change, the guide
  does not), so the site cannot be deployed with a known-stale guide; and every help guide on the site
  must be in `help-map.json`.

## Workflow

1. **While coding (Desktop):** before the version bump run `node scripts/help_impact.mjs`. Read
   the listed guides' text for what you changed: button names, steps, numbers, screenshots.
2. **At the version bump:** add a row to the queue: the version, what the shop sees differently (shop
   words), the guides, status `pending`. Nothing visible changed → guides `—`, status `none`.
3. **When the version reaches shops** (installer published / auto-update): change its rows to
   `released`. From now on the website check fails until the guides follow.
4. **Update the website** (website repo): edit the guide text **and** its Hindi
   (`src/i18n/hi.json` — `npm run check` lists missing strings), retake screenshots
   (`node scripts/app-tour.mjs all` with a fresh `npm run build` of the Desktop app, then
   `node scripts/help-images.mjs`), check pins at real size, update "Updated <date>" and
   "KamaiPlus Desktop <version>" in the guide header, `/facts` and the llms "Does not do yet" line if
   a feature shipped. `npm run check` → deploy → `node scripts/indexnow.mjs`.
5. **Close the row:** status `on website (site v1.x.x)`.

Why not update the website at once? The live site describes the app the shops have. Desktop work is
committed locally and reaches shops only when Rahul releases it (memory: no push / no release), so a
guide changed early would be wrong for every shop until then. Prepare the website change in a local
commit if you like; deploy it with the release.

## Statuses

| Status | Meaning |
| :--- | :--- |
| `pending` | In a local / unreleased build. Website stays as it is. |
| `released` | Shops have it. The website must follow — `npm run check` there fails until it does. |
| `on website (site v…)` | Guide text, Hindi and screenshots updated and deployed. |
| `none` | No visible change for the shop (refactor, tests, docs). |

## Queue

| Version | What the shop sees differently | Guides | Status |
| :--- | :--- | :--- | :--- |
| 4.98.0 | Guides were written from this version (website v1.7.0). | — | on website (site v1.7.0) |
| 4.99.0 | Home "Cash in Hand" and Day Summary "Net Cash in Hand" include the morning float (demo: ₹2,435, was ₹435); Home card subtitle "Float + Cash Sales - Exp"; after Close Shift the Cash Register still shows the opening float. GST screen and files: CGST = SGST per row (HSN 0713 ₹16.29 / ₹16.29, was 16.31 / 16.27); a B2B invoice is one row per rate. A4 bill footer "KamaiPlus • Aapki Dukaan ka Digital Sathi" (the website's `help-images.mjs` paints over the old footer in `theme-01-designer` — remove that `cover`). Counter: items = bill lines ("Cart Items (7)" for the first bill, was 8). | getting-started (Cash in Hand line says the float is NOT included — change it, and its Hindi), cash-register, reports-gst, invoice-themes, billing-counter | pending |
