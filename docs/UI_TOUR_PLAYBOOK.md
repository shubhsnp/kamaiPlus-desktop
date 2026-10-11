# UI Tour Playbook — phone + Desktop, one vertical at a time

Written 2026-10-11 by Claude (who ran the clothing, restaurant and kirana passes) for the agent
taking over the remaining verticals (**pharmacy → hardware/electronics → general retail**).
The same file is in both repos: `KamaiPlus Desktop App\docs\UI_TOUR_PLAYBOOK.md` and
`KamaiPlus Android\docs\UI_TOUR_PLAYBOOK.md`.

> **Prompt for the agent (Rahul pastes this):**
> "Read `D:\My Web Sites\KamaiPlus Desktop App\docs\UI_TOUR_PLAYBOOK.md` completely, then
> `AGENTS.md` and `ENGINEERING_BIBLE.md` of the Desktop repo. Do the UI tour for the next vertical
> in §6 exactly as described: phone first, then Desktop, one batch, tests, local commit in both repos.
> Do not push, deploy or release. When one vertical is done, write its findings into the tour doc
> and tell me in simple Hinglish what changed."

---

## 1. What the tour is (Rahul's words)

- "sabhi vertical ka ui tour karke improve, remove aur check karna hai… android + desktop… dono
  platform par same chahiye… jyada clutter UI hone se hame bachna hai."
- "jo khali khali space hai wo bhi fullfill chahiye — menu main aur home pulse me."
- "sab analyse karo, last me changes karo" → **look at every screen first, write the list, then fix the whole list.**
- "mujhe puchne ki jarurat nahi… sab hone ke baad discuss karenge" → work through it without asking;
  give him the change list at the end.
- **Prefer removing over adding.** Add only what is clearly missing.
- **Phone and PC must say and show the same thing** (same words, same cards, same order).

## 2. Hard rules (breaking these caused real damage before)

1. **No `git push`, no `firebase deploy`, no `npm run release:*`, no Play Store, no publishing.**
   Desktop 4.86+ is live in a customer's shop. Commit **locally** only. Rahul pushes or releases himself, after asking.
2. Never put any password, key or credential in client code.
3. Desktop `AGENTS.md` rules all apply. In particular:
   - Rule 1: change only what the finding says.
   - Rule 5: max 400 lines per file.
   - Rule 6: `tsc` + `e2e_simulation` must be 100% green.
   - Rule 7: `docs/HELP_SYNC.md` gets a row for every version.
4. **Do not re-break what is already fixed** (§5). Read the tour doc before touching a screen.
5. **Line endings:** edit with the editor tool, or in Python use `open(p, encoding='utf-8', newline='')` for both
   read and write. CRLF slipped into LF files once and broke Suite 9 source checks.
   - Check `git diff --stat` after a batch: only real line counts should change.
6. **Locale JSON** (`src/locales/hi.json`, `mr.json`):
   - **Add** new keys. Never sort or re-format the file, or the diff explodes.
   - Every new English `tr()` text needs a Hindi **and** a Marathi entry; Suite 8x fails otherwise.
7. Restaurant words come from `src/lib/restaurant/words.ts` (`RESTAURANT_WORDS`). If you change an English key that is
   also in that map, change the map key too.
8. Another agent may work in the same repos. Before a build or a commit, run `git status` and check for running
   `next build` / `flutter` processes. Never commit someone else's half-done files.

## 3. This PC (slow: 8 GB RAM) — how to run things without hanging

| What | Command | Time |
|---|---|---|
| Desktop type check | `npx tsc --noEmit` | 5+ min |
| Desktop logic suite | `npx tsx scripts/e2e_simulation.ts` | 10+ min (must be 0 failures) |
| Desktop build (needed before Electron E2E) | `npm run build` | ~30 min |
| Desktop Electron E2E | `env -u ELECTRON_RUN_AS_NODE node scripts/electron_e2e.mjs` | ~25 min |
| Android one test file | `flutter test --concurrency=1 test/<file>.dart` | 1–3 min |
| Android full suite | `flutter test` | ~40 min |
| Android lint | `dart analyze <changed files>` | 1 min |
| Android release APK | `flutter build apk --release` | ~5 min |

- Run long jobs **one at a time**, never in parallel. Run `cd android && ./gradlew --stop` before the Electron E2E (Gradle daemons eat ~1 GB).
- `electron.launch: Timeout 60000ms` just means the PC is slow. Rerun it; it is not a code bug.
- **Android full suite: SQLite tests time out at 30 s on this PC** (`android_audit_2026_10_10_test`,
  `inventory_inward_service_test`, `partial_return_*`, `product_batches_fefo_test`, …). Rerun the failed files
  one by one with `--concurrency=1`; they pass.
- If Flutter says **"failed to delete …\build\native_assets\windows\sqlite3.dll"**, an old run's
  `flutter_tester.exe` is still alive:
  - Kill it with `taskkill /F /IM flutter_tester.exe`.
  - If it keeps coming back, kill the old `flutter test` dart.exe tree with `taskkill /F /T /PID <pid>`.
  - Leave VS Code's dart `language-server` / `tooling-daemon` alone.
- Run the Electron E2E from a shell **without** `ELECTRON_RUN_AS_NODE` (VS Code sets it). Otherwise Electron runs as plain Node.
- Keep work files in `D:\My Web Sites\KamaiPlus Screens\_work\`. Windows Temp gets wiped.

## 4. How to look at the screens

### Phone (Android, test phone over USB)
- adb: `/c/Android/platform-tools/adb`. Use this one; others give a version conflict.
- **Read text first, it is cheap.** A screenshot is only for checking a layout:
  ```bash
  A=/c/Android/platform-tools/adb
  MSYS_NO_PATHCONV=1 $A shell uiautomator dump /sdcard/u.xml && $A pull /sdcard/u.xml "/d/My Web Sites/KamaiPlus Screens/_work/u.xml"
  grep -o 'text="[^"]*"\|content-desc="[^"]*"' "/d/My Web Sites/KamaiPlus Screens/_work/u.xml"
  ```
  Text ending in "…" or cut mid-word in the dump = a cut title (finding).
- Screenshot helper: `VER=4.37 bash "/d/My Web Sites/KamaiPlus Screens/_work/shot.sh" <vertical> <name>`
  saves `KamaiPlus Screens\android-<VER>\<vertical>\<name>.png` (also used later for the help guides).
- Tap: `$A shell input tap X Y` (coordinates from the `bounds="[x1,y1][x2,y2]"` in the dump). Scroll: `$A shell input swipe 540 1800 540 600`.
- **Switch the phone to the next vertical:**
  1. Test account proventurein (Rahul is signed in).
  2. **More → Backup → "Reset test shop"**. It works only for the team's test Google accounts.
  3. Sign up again and pick the business type (Pharmacy / Hardware & Electronics / General Retail).
  4. Add 5–10 dummy products, a customer, a supplier, 3–4 bills and one inward bill, so lists are not empty.
- Install a new build: `flutter build apk --release`, then `$A install -r build/app/outputs/flutter-apk/app-release.apk`.
  Build **once** after all verticals, not after every fix.

### Desktop (Electron)
- Read the page component first (`src/app/<route>/page.tsx`, `src/components/<feature>/`). Most findings show up in the code.
- For real screenshots, `scripts/electron_e2e.mjs` already has a `KAMAI_E2E_SHOTS=1` block (around line 1794) that shoots every
  restaurant screen at 1366×768 into `%TEMP%\kamaiplus-e2e-shots\`.
  - Copy that block for the vertical you tour: set `localStorage.kamai_vertical_profile = JSON.stringify({v:1, vertical:'pharmacy', gst:true})`,
    then `window.dispatchEvent(new Event('feature_switches_changed'))`, and shoot `/`, `/billing/`, `/products/`, `/inventory/`, `/purchases/`, `/customers/`, `/khata/`, `/reports/`, `/settings/` and the Add Product modal.
  - Copy the PNGs to `KamaiPlus Screens\desktop-<ver>\<vertical>\`. It needs `npm run build` first.
- The E2E uses its own temp data folder (`KAMAI_E2E_DIR`). **Never open or change `%APPDATA%\kamai-plus-desktop`.** That is a real licence on this PC.
- How a vertical changes Desktop: `src/lib/business/verticalProfile.ts` (`VERTICAL_BASE` feature table) and the Bible §9.0b.

## 5. Already fixed — do NOT redo (shared screens, fixed for every vertical)

The full list is in `KamaiPlus Android\docs\ANDROID_UI_TOUR_2026-10-11.md`: clothing T-01…T-24, restaurant R-01…R-38 / D-01…D-10, kirana K-01…K-10. In short:

- Home Pulse, More menu grid (a lone card takes the full width; a one-tile section is merged into the one before it), short menu titles
  for every vertical, Cash Register, Customers/Guests, Backup ("Clear data" is one card), Staff, Bills, Analytics,
  settle sheet / sale done, plurals ("1 Debtor", "1 product"), "Items" instead of "SKUs", GST buttons hidden without a GSTIN,
  Bill of Supply, strong validation on every field (Desktop `src/lib/validation/fieldRules.ts`, Android `lib/core/utils/app_validators.dart`).
- POS cards: aspect ratio 2.0 on the phone. Stock is shown once (the stepper only). Inventory and Purchases have no second title card,
  and the supplier dues banner shows only when something is owed.

**So for the remaining verticals, check ONLY what differs per vertical.** Find those places with
`grep -rn "pharmacy\|hardware\|retail" lib/` (Android) and `rg "pharmacy|hardware|retail" src/` (Desktop):

| Vertical | Screens to check |
|---|---|
| Pharmacy | Add Medicine form (batch, expiry, strip/pack, schedule H, doctor/patient), expiry radar, FEFO batches in Inventory, purchase inward with batch + expiry, bill print with batch/expiry, low-stock and expiry alerts on Home, "medicine" words everywhere |
| Hardware & Electronics | Add Item form (IMEI/serial, warranty, brand), warranty on the bill, serial pick at billing, Barcode Studio, "item" words |
| General Retail | Add Product (variants, size/colour if on, barcode, wholesale price), Barcode Studio, loose/weight items, purchases |

Plus, on both platforms, for each vertical: Home Pulse and the More menu (**no empty spaces, no lonely tiles, no wrong-vertical words**),
the POS search hint and product cards, the Products header text, the bottom tab label.

## 6. Order and status

| # | Vertical | Phone | Desktop | Commit |
|---|---|---|---|---|
| 1 | Clothing | ✅ T-01…T-24 | ✅ | Android 4.32 / Desktop 4.150 |
| 2 | Restaurant | ✅ R-01…R-38 | ✅ D-01…D-10 | Android 482ff24 (4.36) / Desktop b1e53b9 (4.152) |
| 3 | Kirana / Grocery | ✅ K-01…K-10 | ✅ | Android 2301f6a (4.37) / Desktop 96609ca (4.153) |
| 4 | **Pharmacy** | ⏳ next | ⏳ | — |
| 5 | Hardware & Electronics | ⏳ | ⏳ | — |
| 6 | General Retail | ⏳ | ⏳ | — |
| 7 | Final | rebuild APK once + install + quick phone check of all fixes | Desktop E2E with shots | — |

Everything above is **local** (not pushed), except Android 4.32/4.33 and the Admin Console.

## 7. One vertical, step by step

1. **Switch** phone and Desktop to the vertical (§4). Add dummy data.
2. **Analyse, don't fix yet.** Walk every vertical-specific screen and modal (§5 table) on the phone. Then read the same Desktop screens.
   Write the findings into `KamaiPlus Screens\_work\findings_<vertical>.md`, one line each:
   `- P-01 <screen> (phone/PC/both): <what is wrong> → <the fix>`. Use the prefix **P-** for pharmacy, **H-** for hardware and **G-** for general retail.
   Look for:
   - cut titles / "…" / text overflow
   - words from another vertical (e.g. "dish", "size" in a pharmacy)
   - the same information twice
   - empty space / a lonely card
   - a button that repeats another button
   - jargon (SKU, ledger, HSN without GST)
   - English that is not plain shop language
   - a missing singular/plural
   - a field without validation
   - a phone ↔ PC mismatch
3. **Fix the whole list** in both repos. Shared code fixes all verticals at once, so prefer it.
   Small, surgical changes only (Rule 1). Comment each change with its id, e.g. `// P-03 (2026-10-1x): …`.
4. **Tests**:
   - **Android:**
     - Update the tests whose expected text changed (grep the old string in `test/`).
     - Add one test per real behaviour change (see `test/vertical_ui_adaptive_test.dart`, `test/desktop_menu_home_parity_test.dart`).
     - Run `dart analyze` on the changed files, the changed test files, then the full `flutter test` once (§3 for timeouts).
   - **Desktop:**
     - Add one Suite 9 `assert(...)` per fix at the end of `scripts/e2e_simulation.ts`, before the line
       `// Checks that need a real round trip (a local HTTP server) finish here, before the summary.`
       (see the v4.153.0 block just above it as the example).
     - Then run `npx tsc --noEmit` and `npx tsx scripts/e2e_simulation.ts`. Both must be 0 failures.
5. **Version bump**:
   - **Android:** `pubspec.yaml` `version: 4.NN.0+4NN00` **and** `lib/core/constants/app_version.dart` `kAppVersion`.
     They must match (`test/app_version_test.dart`).
   - **Desktop:** `npx tsx scripts/bump_version.ts` (package.json + `src/lib/constants/version.ts`, +0.1). Then:
     - add a What's new entry at the top of `src/lib/whatsNew/changelog.ts` (with hi + mr translations of its text);
     - add a `docs/HELP_SYNC.md` row `| 4.NNN.0 | <what the shop sees, in shop words> | <guide ids from docs/help-map.json> | pending |`;
     - run `node scripts/help_impact.mjs` to find the guide ids;
     - if a fact in it changed, update `ENGINEERING_BIBLE.md`.
6. **Log** the findings with status (✅ fixed · ➖ decided not to change, with the reason) as a new section in
   `KamaiPlus Android\docs\ANDROID_UI_TOUR_2026-10-11.md` (same format as the "Kirana / Grocery" section).
7. **Commit locally** in both repos:
   - Android: `git add lib test docs pubspec.yaml`. **Never** add the `website/` deletions that show in `git status`.
   - Message: `feat(<version>): <vertical> UI tour P-01…P-NN — <short list>`.
   - **No push.**
8. Tell Rahul in simple Hinglish: what changed (screen by screen), both commit hashes, and anything decided "not to change" and why.

## 8. After the last vertical

1. `flutter build apk --release`, install it on the test phone, and spot-check every fix id from all verticals.
2. Desktop: `npm run build`, then the Electron E2E with `KAMAI_E2E_SHOTS=1` (all checks must pass) for the Desktop screenshots.
3. Help screenshots per vertical are in `KamaiPlus Screens\android-<ver>\<vertical>\` and `desktop-<ver>\<vertical>\`.
   The website guides are updated **later**, only when Rahul releases (Rule 7.4).
4. Give Rahul the full change list of all verticals in one message. He wants to discuss it before any release.
   **Do not release.**
