# Execution & Coding Ledger — Percentage Calculator Tool

**Application/source baseline:** `f3ba3f4` (`f3ba3f487af86b1ecec6926a24386441c3abf4ca`), `v2.2.0`. **Reconciled:** 2026-11-14, Africa/Cairo, coordinator integration on `handoff-local-dev` following `verifier-2` `#30` PASS. **Integrated worker commits:** `b65739d` (`pbs-core`, superseding `5c53eb4`), `f03308a` (`pbs-history`, superseding `93f6768`), `ba4702e` (`pbs-session`, superseding `317e98f`). **Mobile cache generation:** `pct-tool-v2.2.0-mobile-2`.

This is the engineering chronicle and evidence ledger for the Rust math crate, Tauri shell, static desktop UI, standalone mobile PWA, and automation: `crates/percent-core`, `src-tauri`, `ui`, `mobile`, and `.github/workflows`. It reconstructs earlier work from Git objects and attributed repository records; it does not turn an earlier author's report into a fresh execution receipt.

Navigation: [PBS entrypoint](../../AGENTS.md) · [Source ownership](SOURCE_OWNERSHIP_MAP.md) · [Current state](CURRENT_STATE.md) · [Continuation](CONTINUATION_STATE.md) · [Session/decision archive](SESSION_AND_DECISION_ARCHIVE.md) · [Security dossier](SECURITY_HARDENING_DOSSIER.md) · [Transfer guide](CONTINUITY_TRANSFER_GUIDE.md).

Initial share drafts (`5c53eb4`, `93f6768`, `317e98f`) assembled at `#21` failed `#22` audit on 4 blocking + 4 minor documentation findings. Swarm board records `#23`–`#30` establish parallel worker remediation (`b65739d`, `f03308a`, `ba4702e`), `#29` integration onto `handoff-local-dev`, and `#30` `verifier-2` post-remediation **PASS**, followed by coordinator final reconciliation and verification (`E-08`); application code at `f3ba3f4` remains unchanged.

Legacy records inspected: [README](../../README.md), [HANDOFF](../../HANDOFF.md), [Project context](../1-%20PROJECT_CONTEXT.md), [Architecture](../2-%20ARCHITECTURE.md), [Roadmap](../3-%20ROADMAP.md), and [Session summary](../4-%20SESSION_SUMMARY.md).

## 1. Authority, method, and evidence boundary

**Permission:** The owner's 2026-11-14 `/swarm with codex /pbs-start-resume-handoff` request ("use AI PBS and save it locally and in GitHub as well") authorizes coordinated 10-file PBS authoring/remediation (`#23`–`#25`), coordinator integration and verification on `handoff-local-dev`, pushing `origin/handoff-local-dev`, and opening a Pull Request to `main`. Authority excludes direct pushes/merges to `main`, force-pushes, product code edits, `--smoke-test`, private runtime data reads/edits, tag movement, and release/Pages publication.

**Observation:** Git history, tag targets, current source, legacy documentation, release-note files, `#21`–`#30` swarm board records, and local post-reconciliation test results (`E-08`) were inspected directly. Chronology below uses Git author dates (`git log --date=short`); PR identities come from merge messages, not a live GitHub review UI dump.

**Remediation & integration evidence basis:** Share commits `b65739d`, `f03308a`, and `ba4702e` were inspected via Git objects and checked out cleanly onto `handoff-local-dev` (`#29`), verified by `verifier-2` (`#30`), reconciled by the coordinator (`E-08`), and checked again before commit and PR creation. During `#23`–`#25` and `#30`, Codex CLI (`gpt-6.1-sol`, `xhigh`) hit OpenAI usage limits, so remaining authoring and full verification completed directly on `Gemini 4 Hydrogen (XHigh)` per the standing fallback rule.

**Acceptance:** Technical assessment here belongs to the documentation executor and is bounded by the checks below. The owner/coordinator retains integration, product, release, and publication acceptance. No owner decision is inferred from a test pass or from a tag existing locally.

| State | Meaning in this record |
| --- | --- |
| Readback | Inspect existing source, local refs, returned IPC state, local JSON, browser storage, or a hosted destination. Reading does not save or publish it. |
| Save | Confirm a local file/storage write. Desktop persistence commits before shared state changes; mobile storage can fall back to memory, so rendered history alone does not establish a durable save. |
| Publish | A separate external change such as GitHub Releases assets, a remote tag, or GitHub Pages deployment. Workflow YAML and local tags establish configuration/local state, not a successful publish. |

`history_list` reads the managed in-memory snapshot loaded at startup; it is not a fresh disk read. `get_settings` likewise reads managed state. Independent persistence verification requires disk readback or restart under a separately authorized test. Reading `localStorage` is on-device readback, not cloud synchronization. No runtime history/settings were opened during this documentation audit.

## 2. Chronological release and PR ledger

### 2.1 Electron baseline — 2026-05-31

| Commit / release | Directly inspected engineering change |
| --- | --- |
| `cb18ce1` | Initialized Electron layout: `electron/main.cjs`, `electron/preload.cjs`, `src/calculations.js`, `src/index.html`, `src/renderer.js`, `src/styles.css`, `tests/calculations.test.js`, `scripts/smoke-test.cjs`, package manifests, icons, and `reference/Percentage Calculator Tool v1.1.html`. |
| `9980181` | Desktop polish across Electron main/preload, package metadata, math, renderer HTML/JS/CSS: copy feedback, Clear All, About/app metadata, and version presentation. |
| `c267a4a` | Added the four numbered legacy documentation files and expanded `README.md`. |
| `b2b2af0`, `ea49d3c` | Cleaned package-lock metadata, then added GitHub handoff prose to `README.md`. |
| `646fb6f` → `v1.1.0` | Public README orientation. This annotated tag resolves to this commit. |
| `6afa7fb` → `v1.1.0-electron` | README collaboration credit; preserved final Electron checkpoint. This is a different commit from `v1.1.0`. |

The reference HTML preserves the original five calculator UI/formula semantics. The extracted `src/calculations.js` at the Electron tag is the executable oracle used by the later fixture generator: `Math.round(value * 100) / 100`, followed by `toFixed(2)`, including JavaScript tie behavior, negative zero, large numbers, non-finite inputs, formatted labels, and denominator errors. The Vitest cases and real-window Electron launcher tested the original split app. The original HTML's dynamic markup is historical source, not a claim that today's sink gate covers that file.

### 2.2 Tauri v2 + Rust rebuild — PR #1, 2026-11-09

PR #1 is recorded as `CipherVaults/tauri-rebuild`, merged at `b2d0a6f`. Release automation followed at `7f66f93`, the commit targeted by annotated tag `v2.0.0`.

| Commit | Phase / concrete change |
| --- | --- |
| `a666893` | Phase A added `crates/percent-core/src/lib.rs`, crate manifest/initial crate lock, and golden harness. Five original calculators return `CalcResult` or `DiscountResult`; `js_round`, `format_decimal`, private `js_to_fixed_2`, and private `js_exponential` reproduce the JS formatting contract. |
| `428ced4` | Phases B–D added root workspace/lock, `src-tauri/src/main.rs`, `src-tauri/src/commands.rs`, `src-tauri/tauri.conf.json`, capabilities, build script/icons, and static `ui/index.html`, `ui/styles.css`, `ui/main.js`. Added typed IPC and hidden-after-setup `--smoke-test`, with `report_smoke_result` and 20-second watchdog. Initially included clipboard and dialog plugins. |
| `fa6652e` | Phase E introduced `.github/workflows/build.yml`: Ubuntu core format/test/lint, Windows full lint, exact-shell build/smoke/bundle staging and artifact upload. Its original CLI requirement was broad; later hardening pinned it. |
| `ab640f1` | Removed `electron/`, old `src/`, root `tests/`, `scripts/`, `package.json`, and `package-lock.json` after migration. The reference HTML remains. |
| `5155f1d` | Phase F revised README and all four numbered legacy docs for Tauri/Rust. |
| `708a528` | Removed `crates/percent-core/Cargo.lock`; retained the single root `Cargo.lock`. |
| `b508cd7` | Gated smoke reporting on `SmokeState.enabled`, replaced desktop `innerHTML` sinks with DOM/text construction, set workflow default `contents: read`, and pinned CLI installation to `=2.12.4`. `is_smoke_test` exposes the mode; `report_smoke_result` enforces it. |
| `b2d0a6f` | Merge of PR #1; this merge precedes the release workflow change. |
| `7f66f93` → `v2.0.0` | Added tag-triggered GitHub Release publication of Windows NSIS/MSI installers and portable executable, plus `.github/release-notes-v2.0.0.md`. At this historical point publication lived in the Windows job with write permission. |

**Fixture path correction:** Neither `crates/percent-core/tests/generate-golden.mjs` nor `crates/percent-core/tests/golden.json` exists at this baseline. Their actual paths, both introduced by `a666893`, are `crates/percent-core/tests/fixtures/generate-golden.mjs` and `crates/percent-core/tests/fixtures/golden.json`. The integration test is `crates/percent-core/tests/golden_parity.rs`.

The generator uses a deterministic PRNG and original JS module supplied as an argument. Its default source no longer exists after Electron removal, so regeneration needs the historical module. It writes the fixture; regeneration was not run in this audit. Direct JSON inspection counted **10,661 cases**: 1,536 `formatDecimal` cases plus 1,825 each for the five original calculators. These fixtures do not exercise Markup/Margin or Tax/VAT added later. The Rust harness compares the exact labels/errors and discount copy text; it is not an exhaustive numerical proof for every possible input or every serialized field.

### 2.3 v2.1 feature expansion and mobile delivery — PRs #2–#3

| Date / commit | Change and integration |
| --- | --- |
| 2026-11-10 · `c548f0d` | Added `calculate_markup_margin`, `MarkupMarginResult`, `calculate_tax`, `TaxMode`, `TaxResult`, and unit coverage in `percent-core`; version advanced to 2.1.0. |
| 2026-11-10 · `fc57b62` | Added calculator/history IPC, persistent 500-entry history, startup-managed history state, revised credits, and removed `tauri-plugin-dialog` plus its lockfile dependencies. |
| 2026-11-10 · `d8b34b2` | Added all-card swap pills, cards 6/7, history tape with copy/restore/clear, and dark terminal About modal in desktop HTML/CSS/JS. |
| 2026-11-10 · `b68e760` | Updated README, numbered docs, workflow checks, and `.github/release-notes-v2.1.0.md`. |
| 2026-11-10 · `0560363` | Enabled release creation/tagging on pushes to `main` as well as version-tag pushes, deriving version from Tauri configuration and skipping an existing release at that time. |
| 2026-11-10 · `f59035d` → `v2.1.0` | Merged PR #2 from `AbyssWatcher2/v2.1-features`. |
| 2026-11-13 · `fe39548` | PR #3 added self-contained `mobile/index.html`, `mobile/sw.js`, `mobile/manifest.webmanifest`, and four icon files for standalone HTML and offline PWA. |
| 2026-11-13 · `09e1ebf` | Added `.github/workflows/pages.yml`, Node golden parity against mobile HTML in build/deploy automation, standalone HTML release packaging, and legacy-document updates. |
| 2026-11-13 · `6f81290` | Merged PR #3 from `CipherVaults/mobile-pwa`. This mobile change is after the commit currently targeted by `v2.1.0`; the tag alone does not contain it. |

### 2.4 v2.1.1 hardening and quick navigation — PRs #4–#5, 2026-11-13

| Commit | Change and integration |
| --- | --- |
| `3464804` | PR #4 added `.gitattributes` LF rules, empty desktop capability permissions, expanded desktop CSP and mobile inline SHA-256 CSP, bounded and validated storage, exclusive private temp writes, persistence-before-state commit, safe frontend construction/lookup guards, pinned Actions, checksum generation, release notes, and `assets/preview-desktop.png` / `assets/preview-mobile.png`. |
| `9ebc1c7` | Scoped the `created` variable in `ensure_private_parent_dir` to `#[cfg(unix)]`, fixing an unused-variable Windows Clippy failure. |
| `6a97dea` | Merged PR #4 from `CipherVaults/security-hardening-v2.1.1`. |
| `77766cf` | PR #5 added desktop `.quick-nav` HTML, binding, CSS, docs/release-note updates; changed existing-release handling to tag-ref `PATCH`, `gh release upload --clobber`, and release-note editing. |
| `ccd6ee8` → `v2.1.1` | Merged PR #5 from `CipherVaults/desktop-quick-nav-v2.1.1`. |

The hardening sequence separated release publication into a downstream job, with build jobs read-only. Storage checks mitigate path substitution and oversized inputs but are not proof against all filesystem races or all Windows reparse points; see the [backend analysis](SECURITY_HARDENING_DOSSIER.md#b-rust-backend-hardening).

### 2.5 v2.2.0 calculator/history/settings work — PRs #6–#7, 2026-11-13

| Commit | Change and integration |
| --- | --- |
| `380d1f1` | Added `HANDOFF.md` for local Windows development continuity. |
| `085dad6` | Changed desktop/mobile controllers and presentation plus Rust commands/state: `sanitizeNumericString`, parenthesized negative operands, copy guards, unified `Value out of range`, full local `YYYY-MM-DD HH:MM:SS` history timestamps, `#historyFilter`, `history_delete` / `deleteHistoryEntry`, `.card-restored`, `settingsModal`, and `#updateBanner`. Added `settings.json`, `get_settings`, `set_settings`, `check_for_updates`, and `open_release_page`. Windows update calls use System32 tools; mobile uses `pct_tool_settings_v1` and GitHub API fetch. |
| `a6f5ded` | Set Rust/Tauri/UI/mobile versions to 2.2.0, updated root lock package versions, README, numbered docs, and `.github/release-notes-v2.2.0.md`; the mobile cache at this stage was the first 2.2.0 generation. |
| `6371ddc` | Merged PR #6 from `CipherVaults/handoff-local-dev`. |
| `ec8ad5c` | Updated only `HANDOFF.md` for v2.2.0 architecture/features/release. It retained command-name typos and unsupported shortcut/hint claims listed below. |
| `ccc3899` | Merged PR #7 from `CipherVaults/handoff-local-dev`. |

The math crate's formulas were not changed by the polish commit: overflow/error treatment is enforced at the UI/IPC boundary while retaining the original golden compatibility. New settings default to startup checks enabled. This introduces optional external network activity; old absolute “zero network” prose is historical, not the current privacy boundary.

### 2.6 PWA live-update fix — PR #8, 2026-11-14

`dd9777e` changed `mobile/sw.js`, `mobile/index.html`, release notes, README, HANDOFF, and all four numbered docs. PR #8 from `CipherVaults/handoff-local-dev` merged at **`f3ba3f4`**. The merge message names the stale-cache fix. The local `v2.2.0` ref now targets this merge; the existing-release workflow can move a release tag. Git objects do not supply a remote tag-movement receipt or prove the currently served Pages bytes.

The new `CACHE_NAME` is `pct-tool-v2.2.0-mobile-2`. Installation fetches each precache item with `cache: "reload"`; activation deletes older `pct-tool-` caches, calls `clients.claim()` unconditionally, and uses `hadOldCache` to decide whether to call `client.navigate(client.url)`. HTML navigation is network-first via `handleNavigationFetch` and `buildNoCacheRequest`, with cached app-shell fallback on a thrown network failure. Non-navigation static resources remain cache-first with background revalidation.

The page registers with `updateViaCache: "none"`, immediately calls `reg.update()`, checks again on visible `visibilitychange`, and reloads on `controllerchange` when a controller existed at registration time. The script CSP digest was recomputed. Source inspection supports this implementation; this audit did not run an installed-browser upgrade/offline scenario.

### 2.7 PBS assembly, failed audit, remediation, and integration — 2026-11-14

| Stage / identity | Recorded result and remaining boundary |
| --- | --- |
| Initial worker drafts | `@pbs-core` `5c53eb4`, `@pbs-history` `93f6768`, and `@pbs-session` `317e98f` on isolated share branches off `handoff-local-dev` (`f3ba3f4`). |
| `@coordinator` #21 & `verifier-2` #22 | Assembled the 10-file PBS package on `handoff-local-dev`; `verifier-2` #22 returned **FAIL** with **4 blocking and 4 minor findings** despite passing pre-remediation technical checks. |
| Remediations #23–#25 | Workers resolved all `#22` findings across `b65739d` (`pbs-core`), `f03308a` (`pbs-history`), and `ba4702e` (`pbs-session`); Codex CLI (`gpt-6.1-sol`, `xhigh`) drafted/edited until hitting an OpenAI quota cap, and Gemini 4 Hydrogen (XHigh) completed remaining edits and local checks per the fallback rule. |
| `#29` integration & `#30` `verifier-2` PASS | Coordinator integrated all 10 remediated files cleanly onto `handoff-local-dev` (`#29`). `verifier-2` (`#30`) ran read-only Codex CLI, hit the OpenAI usage limit, and executed full verification directly on Gemini 4 Hydrogen (XHigh): **PASS** across Cargo (`fmt`, `clippy`, `test`), Node (`10,661` cases, CSP, sinks, LF, workflow pins), `328` local links (`0` broken), `50/50` SHA checks, protected byte preservation, privacy/placeholder scans, and PowerShell AST parsing. |
| Final coordinator integration (`E-08`) | Coordinator reconciled final package status and `HANDOFF.md:21,78,81,96,123,125` citations, reran verification checks (`E-08`), committed on `handoff-local-dev`, pushed `origin/handoff-local-dev`, and opened a Pull Request to `main`; owner PR merge/acceptance and hosted Web UI checks remain pending. |

## 3. Verified symbol inventory at the baseline

These are directly inspected current names, grouped by responsibility rather than an API inferred from legacy prose.

| Source | Symbols / contract |
| --- | --- |
| `crates/percent-core/src/lib.rs` | Results: `CalcResult`, `DiscountResult`, `MarkupMarginResult`, `TaxMode` (`Add`, `Extract`), `TaxResult`. Formatting: `js_round`, `format_decimal`, private `js_to_fixed_2`, private `js_exponential`. |
| Same math source | `calculate_percentage_change`, `calculate_percentage_of_total`, `calculate_percentage_portion`, `calculate_discount`, `calculate_original_value`, `calculate_markup_margin`, `calculate_tax`. |
| `src-tauri/src/main.rs` | `SmokeState`, `HistoryState`, `SettingsState`, `main`; the invocation handler registers the 19 commands enumerated below. |
| `src-tauri/src/commands.rs` — calculation commands | `calc_change`, `calc_percent_of_total`, `calc_portion`, `calc_discount`, `calc_original`, `calc_markup_margin`, `calc_tax`. |
| Same backend — storage/settings commands | `history_list`, `history_add`, `history_delete`, `history_clear`, `get_settings`, `set_settings`. |
| Same backend — platform/metadata/smoke commands | `check_for_updates`, `open_release_page`, `copy_text`, `get_app_info`, `is_smoke_test`, `report_smoke_result`. |
| Same backend — models and helpers | `AppSettings`, `UpdateCheckResult`, `AppInfo`, `HistoryEntry`, `NewHistoryEntry`, `build_app_info`, `history_file_path`, `settings_file_path`, `read_regular_file_limited`, `ensure_private_parent_dir`, `write_atomic_private`, `load_history_from_disk`, `persist_history_to_disk`, `load_settings_from_disk`, `persist_settings_to_disk`, `validate_entry_fields`, `validate_new_entry`, `validate_history_entry`, `parse_semver_triplet`, `is_newer_version`, `parse_github_release_json`, `windows_system32_tool`. |
| `ui/main.js` — input/calculation | `invoke`, `seq`, `lastValidCalc`, `sanitizeNumericString`, `attachPasteSanitizers`, `fmtFormulaNum`, `fmtFormulaText`, `buildValidHistoryCandidate`, `allFiniteValues`, `setCardOutOfRange`, `setResult`, `copyText`, `copyCardResult`; live updaters `updateChangeLive`, `updatePercentLive`, `updateWhatLive`, `updateDiscountLive`, `updateBaseLive`, `updateMarkupLive`, `updateTaxLive`, plus `setTaxMode`. |
| Same desktop controller — continuity/UI | `formatHistoryTime`, `flashRestoredCard`, `restoreHistoryEntry`, `renderHistory`, `deleteHistoryEntry`, `recordHistoryFor`, `loadHistory`, `clearAllCalculators`, `syncAppInfo`, `openSettingsModal`, `closeSettingsModal`, `runUpdateCheck`, `openReleasePage`, `loadSettingsAndMaybeCheckUpdates`, `runSmokeTestIfRequested`, `initialize`. |
| `mobile/index.html` — inline math | `formatDecimal`, `calcChange`, `calcPercentOfTotal`, `calcPortion`, `calcDiscount`, `calcOriginal`, `calcMarkupMargin`, `calcTax`. |
| Same mobile script — local state and updates | `sanitizeHistoryItem`, `readHistoryFromStorage`, `writeHistoryToStorage`, `addHistoryEntry`, `deleteHistoryEntry`, `clearHistoryStorage`, `readSettingsFromStorage`, `writeSettingsToStorage`, `sanitizeNumericString`, `buildValidHistoryCandidate`, `legacyCopyText`, `parseSemverTriplet`, `isNewerVersion`, `setReleaseLinks`, `runUpdateCheck`, `registerServiceWorkerIfSupported`, `initialize`. |
| `mobile/sw.js` | `CACHE_NAME`, `PRECACHE_URLS`, `isCacheableResponse`, `buildNoCacheRequest`, `offlineResponse`, `handleNavigationFetch`; `install`, `activate`, and `fetch` listeners. |

## 4. Verified code-versus-legacy-document discrepancies

| Legacy statement | Current source finding and consequence |
| --- | --- |
| `317e98f:HANDOFF.md` **L81** (`f3ba3f4:HANDOFF.md` **L78**): `settings_get`, `settings_set`, `check_for_update` | Actual definitions, registration, and UI calls are `get_settings`, `set_settings`, `check_for_updates`. The three-line PBS callout insertion at **L5–7** shifts the preserved body; it does not introduce aliases. |
| `317e98f:HANDOFF.md` **L96, L125** (baseline **L93, L122**): `check_for_update` | Source and Architecture use `check_for_updates`. These are the command-table and security-list repeats of the typo. |
| `317e98f:HANDOFF.md` **L123** (baseline **L120**): `settings_set` | The lock-held persistence command is `set_settings`. This fourth affected line is distinct from the updater typo. |
| Post-PBS `HANDOFF.md` **L21, L78** (baseline **L18, L75**): `Ctrl/Cmd+Shift+C` and `0%` zero-denominator hints | Neither claimed behavior is implemented in the inspected desktop/mobile controllers. Enter and Escape handlers exist. Zero denominators produce explicit errors and invalid-result state; they are not converted to 0%. |
| README/roadmap hardening prose: `history.<pid>.<seq>.json.tmp` | This accurately describes the earlier hardening implementation, but current generic persistence uses `<stem>.<pid>.<seq>.tmp`, e.g. `history.json.<pid>.<seq>.tmp`, also supporting settings. |
| README/context/HANDOFF broad seven-calculator golden-parity wording | The 10,661-case fixture covers decimal formatting and five original calculators. Markup/Margin and Tax have Rust unit coverage, not cases in this fixture. |
| Legacy v2.1.0 summaries include mobile PWA | Current `v2.1.0` points to `f59035d`; mobile PR #3 merged later at `6f81290`. Distinguish feature family/release marketing from tag contents. |
| Old session: GitHub CLI missing; older “zero network” and “offline-first” descriptions | Current host has `gh`; optional update checks contact GitHub. Current HTML navigation is network-first with offline fallback. Earlier session facts remain attributed to their original date. |
| `HANDOFF.md` suggests merging its development handoff later | Its addition and later revision already appear in merged PRs #6/#7; do not replay that work. |

These legacy files were inspected and remain unchanged except for the targeted `HANDOFF.md:5-7` callout and `4- SESSION_SUMMARY.md` adoption append. Legacy audit finding counts and “no known bugs” remain attributed claims, not a new security certification.

## 5. PBS evidence summary

**Observers:** `@pbs-history` (`f03308a`), `verifier-2` (`#22` pre-remediation FAIL & `#30` post-remediation PASS), and Coordinator post-reconciliation verification (`E-08`). **Observation date:** 2026-11-14. **Target:** application source at `f3ba3f4` plus integrated 10-file PBS package on `handoff-local-dev` (Windows PowerShell). Codex CLI (`gpt-6.1-sol`, `xhigh`) drafted/edited across `#23`–`#25` until hitting OpenAI usage limits, and hit the same quota cap at `#30`, so Gemini 4 Hydrogen (XHigh) completed remaining checks and `verifier-2` / coordinator verification directly per global rule.

| Evidence ID | Method / expected condition | Observed result / outcome | Applicability and limits |
| --- | --- | --- | --- |
| E-01 | Status, HEAD/branch/history and targeted Git-object inspection | Inspected application baseline `f3ba3f4`, initial worker drafts (`5c53eb4`/`93f6768`/`317e98f`), and remediated share commits (`b65739d`/`f03308a`/`ba4702e`) integrated cleanly onto `handoff-local-dev`. | Local refs/objects only; remote UI settings require separate owner verification. |
| E-02 | `cargo test --workspace --locked` | Exit 0: 9 core unit tests, 1 golden integration test, 3 backend unit tests; 0 doc tests. Passed in `f03308a`, `#30`, and `E-08`. | Windows compilation/unit/integration scope (`golden_parity` executes 10,661 cases). Unix-only symlink assertions excluded on Windows; no GUI/clipboard run. |
| E-03 | `cargo clippy --workspace --all-targets --locked -- -D warnings` | Exit 0 across full workspace in `f03308a`, `#30`, and `E-08`. | Windows lint/compile scope; not a non-Windows build result. |
| E-04 | `cargo fmt --all -- --check` (and `--check`) | Exit 0 across workspace. | Current workspace formatting check. |
| E-05 | Node verification matching build CI's math extraction, fixture comparisons, CSP digest, forbidden-sink, LF, and workflow SHA-pin gates | `ALL_MOBILE_CHECKS_OK (10661 cases)`; both inline digests match; zero forbidden DOM/eval/style sinks; LF verified on Mobile HTML/SW; `9` build + `4` Pages workflow Action pins SHA-40 with `persist-credentials: false`. Verified in `f03308a`, `#30`, and `E-08`. | Current file bytes and extracted math; not live browser CSP/SW upgrade or live Pages bytes. |
| E-06 | Direct SHA-256/base64 over exact inline block contents | Style `HppoWhfVX+UyR2KqXbS6U2Q3KafIo1MVyti/h94cX9o=`; script `655QfOPjmPDnhT1lUo4K5UBkQqBy3BB3EYZt7mnAKdg=`. | Exact UTF-8 block contents at `f3ba3f4`. |
| E-07 | `verifier-2` `#30` full post-remediation check on `#29` integrated 10-file tree | All `#22` findings (#1–#8) verified fixed; `TOTAL_LOCAL_LINKS=328 BROKEN=0`; `SHA_CHECK total=50 bad=0`; zero placeholders or leaked secrets/paths; `HANDOFF_PRESERVATION_DIFFS=0` (`L1-4` & `L8-311`), `SUMMARY_435_DIFFS=0` (`L1-435`); PowerShell AST `4/4 AGENTS.md`, `15/15 CONTINUITY_TRANSFER_GUIDE.md`, `10/11 HANDOFF.md` (`block 11` preserves legacy `<file>` placeholder); `git diff --check` & `--cached --check` exit 0. | Ran on pre-reconciliation `#29` tree prior to final `E-08` status/errata updates; `codex exec` hit quota cap (`try again at 6:32 PM`), so `verifier-2` ran full verification directly on `Gemini 4 Hydrogen (XHigh)`. |
| E-08 | Coordinator post-reconciliation verification on final `handoff-local-dev` 10-file tree | Rerun after coordinator status/`L21,L78` reconciliation edits ahead of local commit and PR push: Cargo (`fmt --all -- --check`, `clippy --locked -- -D warnings`, `test --workspace --locked`), Node Mobile parity/CSP/sink/LF/workflow-pin suite, local link/anchor audit, PowerShell AST check, protected historical byte checks (`4- SESSION_SUMMARY.md` `L1-435` & `HANDOFF.md` `L1-4`/`L8-311`), and `git diff --cached --check`. | Verifies the committed `handoff-local-dev` documentation tree pushed to `origin/handoff-local-dev` for PR review; excludes `--smoke-test`, installer builds, offline restore test, and hosted GitHub UI settings. |
| H-01 | Numbered session summary, 2026-11-09 rebuild entry; v2.0.0 release notes | Authors report original parity verification and Linux/Xvfb real-window smoke work; release notes describe automated checks. Recorded prior result. | Historical documentary evidence. No retained Actions run ID/log inspected here. |
| H-02 | v2.1.0/v2.1.1 legacy roadmap, session entries, release notes, historical workflow changes | Feature delivery and hardening checks described; CI/Pages checks configured. | Historical reports/configuration, not fresh hosted run observations. In particular Pages workflow did not exist at initial `v2.1.0` tag. |
| H-03 | 2026-11-13 v2.2.0 session entry; HANDOFF CI-success paragraph | Prior author reports Rust/mobile/smoke success and local NSIS/MSI/portable verification; HANDOFF reports successful main CI/release/Pages. | Historical, self-reported; no exact run IDs, downloaded artifact hashes, or current install receipts inspected. Does not establish a fresh `f3ba3f4` installer test. |
| U-01 | Fresh `f3ba3f4` installer build and `--smoke-test` | Not run in this documentation task. | Excluded by scope; `--smoke-test` would overwrite the live Windows clipboard. |
| U-02 | GitHub Releases / Pages destination and GitHub UI controls | Not checked live. | External owner verification required (`Settings -> Environments -> github-pages` and `Settings -> Actions -> General`). |

## 6. PBS acceptance summary and execution return

This assessment applies to the documentation's engineering claims and repository checks on `handoff-local-dev`. Decision-maker: Coordinator integration after `#30` & `E-08`, 2026-11-14; Project Owner decides final PR merge into `main`.

| Requirement / target | Evidence / outcome | Decision | Acceptance boundary / next owner |
| --- | --- | --- | --- |
| Local math/backend compilation, tests, lint, and format at baseline | E-02–E-04, `#30`, `E-08` pass | Accepted — technical scope | No GUI or installer acceptance inferred. |
| Current mobile golden engine, inline hashes, and sink/LF hygiene | E-05–E-06, `#30`, `E-08` pass | Accepted — technical scope | Seven-calculator DOM behavior and PWA lifecycle remain outside these checks. |
| Historical engineering chronology | E-01 plus inspected historical files/diffs | Accepted — source provenance | Live PR approvals and earlier hosted run outcomes are not certified. |
| Integrated 10-file PBS continuity package on `handoff-local-dev` | `#23`–`#25` remediations (`b65739d`/`f03308a`/`ba4702e`), `#29` integration, `#30` `verifier-2` PASS, coordinator `E-08` pass | Ready for PR acceptance | Local commit on `handoff-local-dev` + Pull Request on `origin/handoff-local-dev` -> `main`; **owner PR merge and acceptance pending**. |
| Current desktop end-to-end install, clipboard, and installed PWA refresh | U-01; E-05 coverage limits | Deferred | No mandatory product criterion is waived; obtain a scoped runtime receipt if product acceptance requires it. |
| Remote release, Pages deployment, backups, and GitHub settings | H-03 / U-02 | Deferred / External Owner-Verified | Owner verifies hosted GitHub settings and optionally cuts offline `git bundle` backup per Scenario B. |

**Work performed:** Collected and integrated all three remediated worker slices (`b65739d`, `f03308a`, `ba4702e`) onto `handoff-local-dev` (`#29`), obtained `verifier-2` post-remediation **PASS (`#30`)**, recorded honest Codex CLI quota fallback telemetry, reconciled final status and `HANDOFF.md:21,78,81,96,123,125` references across the integrated package, ran `E-08` checks, committed on `handoff-local-dev`, pushed `origin/handoff-local-dev`, and opened a Pull Request targeting `main`. **Files modified:** Only the ten integrated documentation/continuity files; application source/workflows/lockfile/tags unchanged. **External state changes:** Remote push of `origin/handoff-local-dev` and Pull Request creation toward `main` (no direct `main` push/merge).

**Stopping point:** Verified 10-file AI PBS continuity package is saved locally on `handoff-local-dev` and submitted via GitHub Pull Request to `main`. Next owner actions: review and merge the PR into `main`, verify hosted GitHub Web UI settings (`U-02`), and optionally create an offline `git bundle` backup per [Continuity Transfer Guide](CONTINUITY_TRANSFER_GUIDE.md).
