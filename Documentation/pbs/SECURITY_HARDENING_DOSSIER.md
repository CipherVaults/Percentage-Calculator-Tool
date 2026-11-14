# Security Hardening Dossier — Percentage Calculator Tool

**Inspected application baseline:** `f3ba3f4`, local tag `v2.2.0`. **Reconciled:** 2026-11-14, Africa/Cairo, coordinator integration on `handoff-local-dev` (following share commit `f03308a`, `#29` integration, and `#30` `verifier-2` PASS). **Scope:** desktop Tauri v2/Rust, static desktop UI, mobile HTML/PWA, local persistence, and repository automation. This documents implemented controls and their limits; it is not a penetration-test certificate or proof that no vulnerabilities exist.

Navigation: [PBS entrypoint](../../AGENTS.md) · [Source ownership](SOURCE_OWNERSHIP_MAP.md) · [Current state](CURRENT_STATE.md) · [Continuation](CONTINUATION_STATE.md) · [Session/decision archive](SESSION_AND_DECISION_ARCHIVE.md) · [Execution ledger](EXECUTION_AND_CODING_LEDGER.md) · [Recovery/transfer procedures](CONTINUITY_TRANSFER_GUIDE.md).

Following initial drafts (`5c53eb4`, `93f6768`, `317e98f`) and `#22` audit FAIL (4 blocking + 4 minor doc findings), swarm workers resolved all findings across `#23`–`#25` (`b65739d`, `f03308a`, `ba4702e`), coordinator re-integrated all 10 files (`#29`), `verifier-2` (`#30`) returned **PASS** (executing directly on Gemini 4 Hydrogen XHigh after Codex CLI hit an OpenAI usage cap), and coordinator completed final reconciliation and verification (`E-08`) on `handoff-local-dev` for PR submission to `main`; owner PR acceptance and hosted Web UI checks remain pending. Legacy context: [README](../../README.md), [HANDOFF](../../HANDOFF.md), [Project context](../1-%20PROJECT_CONTEXT.md), [Architecture](../2-%20ARCHITECTURE.md), [Roadmap](../3-%20ROADMAP.md), [Session summary](../4-%20SESSION_SUMMARY.md).

**Permission:** Covered by the owner's 2026-11-14 PBS continuity authorization (`handoff-local-dev` commit + Pull Request -> `main`). **Observation:** Controls below were inspected in application source at `f3ba3f4` and verified alongside `#29`–`#30` and `E-08`. **Acceptance:** Technical checks cover source/static/documentation gates; owner PR merge and hosted GitHub Web UI verification remain pending. The [ledger evidence table](EXECUTION_AND_CODING_LEDGER.md#5-pbs-evidence-summary) distinguishes fresh checks (`E-01`–`E-08`) from historical author reports (`H-01`–`H-03`).

## (a) Desktop Tauri v2 shell

### Capability and frontend boundary

[`src-tauri/capabilities/default.json`](../../src-tauri/capabilities/default.json) contains `identifier: "default"`, `windows: ["main"]`, and `permissions: []`. The frontend receives no listed built-in/plugin permissions. This does **not** mean it has no IPC authority: the custom commands registered by `tauri::generate_handler!` in [`main.rs`](../../src-tauri/src/main.rs) are its intentional privileged boundary. Rust handlers must validate everything they accept.

[`src-tauri/tauri.conf.json`](../../src-tauri/tauri.conf.json) sets `withGlobalTauri: true`, `frontendDist: "../ui"`, application identifier `com.percentagecalculator.tool`, and a `main` window. The configured CSP, verbatim, is:

```text
default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
```

Bundling is active for `targets: ["nsis", "msi"]`; Windows uses `webviewInstallMode.type: "embedBootstrapper"` and NSIS `installMode: "both"`. Embedding a bootstrapper is not embedding a complete offline WebView2 runtime. The portable binary also needs the installed runtime.

### Out-of-webview update/network isolation

The webview keeps `connect-src 'none'`. `check_for_updates` runs a blocking process through Tauri's blocking-task executor; on Windows `windows_system32_tool("curl.exe")` resolves `SystemRoot` (fallback `C:\Windows`) plus `System32`. `open_release_page` uses the same helper for `rundll32.exe`, passing `url.dll,FileProtocolHandler` and the fixed release URL as separate arguments. Both apply `CREATE_NO_WINDOW`. They do not accept an executable path or arbitrary URL from the UI.

The curl call uses `--silent`, `--show-error`, `--fail`, `--location`, `--max-time 8`, `--max-filesize 65536`, `--proto =https`, `--tlsv1.2`, a GitHub JSON Accept header, and a versioned User-Agent. This limits duration/size/protocol and relies on the platform curl/TLS trust store. `--location` permits HTTPS redirects; this is not TLS certificate pinning or an explicit redirect-host allowlist. Resolving through `SystemRoot` avoids a normal PATH search on Windows but still trusts the OS/environment.

The source has `#[cfg(windows)]` process-extension/tool handling and `#[cfg(not(windows))]` fallback `Command::new("curl")`. URL launch branches use `open` on macOS and `xdg-open` on other Unix targets. Non-Windows source paths exist, and historical docs report Linux smoke work; this audit built/tested only on Windows. There is no current macOS/Linux installer matrix, and the configured bundles target Windows. These fallback tools and their PATH/runtime availability are not verified here.

### Smoke isolation and its real side effect

`main` detects `--smoke-test` and manages `SmokeState { enabled }`. In that mode it starts empty/default `HistoryState` and `SettingsState` with `in_memory_only: true`; normal startup calls `load_history_from_disk` and `load_settings_from_disk`. The setup callback hides the `main` window after creation and starts a 20-second thread guard that exits on timeout. This is a real webview, not a math-only harness; an initial window flash is possible.

`is_smoke_test` reads the mode. `report_smoke_result` rejects normal-mode calls before reading clipboard or requesting exit. Smoke update checks return a no-update mock, and `open_release_page` returns without opening a browser. The frontend's smoke path exercises IPC/UI, and `report_smoke_result` requires the real clipboard to contain `percentage-tool-smoke-test` before accepting success.

**Boundary:** in-memory history/settings isolation does not isolate the OS clipboard. Running the smoke test replaces its contents. It was deliberately not run in this audit; fresh test/lint/hash success is not a substitute smoke receipt.

## (b) Rust backend hardening

### Exact limits and fixed endpoints

Directly inspected in [`src-tauri/src/commands.rs`](../../src-tauri/src/commands.rs):

| Name | Exact value / initialization | Scope |
| --- | --- | --- |
| `HISTORY_MAX_ENTRIES` | `500` | Retained history entries. |
| `HISTORY_MAX_FILE_BYTES` | `1024 * 1024` | 1 MiB history read cap. |
| `SETTINGS_MAX_FILE_BYTES` | `4096` | Settings read cap. |
| `MAX_FIELD_LEN` | `256` | Rust string-byte cap for each validated history field and accepted release URL. |
| `MAX_COPY_LEN` | `4096` | Maximum `copy_text` payload bytes. |
| `ALLOWED_CALCULATORS` | `["change", "percent", "what", "discount", "base", "markup", "tax"]` | History calculator keys. |
| `GITHUB_LATEST_RELEASE_API` | `https://api.github.com/repos/CipherVaults/Percentage-Calculator-Tool/releases/latest` | Update metadata source. |
| `GITHUB_RELEASES_URL` | `https://github.com/CipherVaults/Percentage-Calculator-Tool/releases/latest` | Fixed launch/fallback destination. |
| `GITHUB_RELEASES_PREFIX` | `https://github.com/CipherVaults/Percentage-Calculator-Tool/releases/` | Prefix accepted for returned metadata URL. |
| `CREATE_NO_WINDOW` | `0x0800_0000` | Windows-only process flag. |
| `TEMP_FILE_COUNTER` | `AtomicU64::new(0)` | Process-local sequence; `fetch_add(1, Ordering::Relaxed)`. |

### Bounded reads, symlinks, reparse points, and races

`history_file_path` / `settings_file_path` resolve Tauri `app_data_dir()` then append `history.json` / `settings.json`. On this Windows application identity, the documented location is `%APPDATA%\com.percentagecalculator.tool\`. This audit inspected the resolver and identifier, not any user's private runtime files.

`read_regular_file_limited` performs `symlink_metadata`, rejects symlinks/non-files, checks metadata length, opens the file, rechecks opened-handle metadata/type/length, reads through `take(max_bytes + 1)`, and rejects an over-cap result. The extra byte catches growth during the read. Shared history load deserializes typed entries, filters invalid ones, and keeps at most 500. Errors/invalid history become an empty vector; settings load errors or invalid JSON become default settings.

These checks mitigate symlink/path substitution and TOCTOU-related size changes. They do not compare file identity before and after open, open with a no-follow primitive, validate every ancestor, or explicitly inspect every Windows reparse-point class. Do not describe this as complete elimination of filesystem races or universal junction/reparse protection. The relevant trust boundary remains a user-controlled app-data directory and OS file permissions.

**Diagnostic quirk:** the shared read helper literally emits messages containing `history file`, including `history file exceeds max allowed size` and `refusing to read non-regular or symlinked history file`, even when its caller is reading `settings.json`. Diagnose the caller and cap rather than assuming the message names the actual target.

### Validation before and after persistence

`validate_new_entry` and `validate_history_entry` both delegate to `validate_entry_fields`. It requires an allowed calculator key; nonempty trimmed values for calculator label, both inputs, inputs text, result text, and copy text; and at most 256 **bytes** per field. Optional mode must be `add` or `extract`. This mode check is not conditional on calculator type. Typed deserialization requires the declared Rust field types; it is not cryptographic authentication or recomputation of results loaded from disk.

`HistoryEntry` adds `u64` ID/timestamp fields to `NewHistoryEntry`. The validator does not establish timestamp recency, ID uniqueness, or mathematical truth of saved labels. `AppSettings.check_updates_on_startup` serializes as `checkUpdatesOnStartup`, defaults to true, and requires a boolean when present. Serde does not use `deny_unknown_fields` here. Invalid/missing files reset defaults; a failed settings read therefore does not guarantee startup networking stays disabled.

### Atomic persistence and private modes

`ensure_private_parent_dir` calls `create_dir_all`, checks final-parent metadata for symlink/non-directory, and on Unix attempts `0o700` for a newly created directory. The result of that chmod attempt is ignored; pre-existing directory permissions are not normalized. On Windows it does not set an explicit DACL.

`write_atomic_private` checks an existing destination for symlink/non-file, derives `<stem>.<pid>.<seq>.tmp` beside it (e.g. `history.json.<pid>.<seq>.tmp`), and opens with `OpenOptions::new().write(true).create_new(true)`. On Unix it requests mode `0o600`. It calls `write_all`, `sync_all`, drops the handle, then `std::fs::rename` to commit. Write/rename errors remove the temporary file where possible and return an error. There is no parent-directory fsync or encrypted-at-rest store; durability still depends on OS/filesystem semantics.

The earlier v2.1.1-only temp pattern was `history.<pid>.<seq>.json.tmp`. Some legacy prose retains it; current generic persistence supports both history and settings with the filename-first pattern above.

| Mutation | Commit-on-success behavior while mutex is held |
| --- | --- |
| `history_add` | Validates, clones entries, deduplicates or inserts/truncates a candidate; persists it before assigning entries and advancing the ID. Even the dedup timestamp update is a candidate until persistence succeeds. |
| `history_delete` | Builds a retained candidate and persists before assigning; unknown ID returns unchanged state without a write. |
| `history_clear` | Persists an empty array before clearing shared entries. |
| `set_settings` | Persists candidate settings before replacing the guarded value. |

Smoke mode skips disk persistence. Normal backend failures preserve the previous managed state; frontend catches can suppress the error, so a responsive control alone is not save evidence. Desktop settings UI updates its local toggle before awaiting persistence and ignores write failures. Do not infer disk success from the toggle remaining checked.

### Version and release URL handling

`parse_semver_triplet` trims, strips leading `v`/`V`, removes suffixes after `-`/`+`, and requires three `u64` components. `is_newer_version` compares the numeric tuple. It is a limited triplet comparator, not full SemVer prerelease ordering.

`parse_github_release_json` requires a parseable tag; accepts `html_url` only if it starts with `GITHUB_RELEASES_PREFIX` and fits `MAX_FIELD_LEN`; otherwise uses `GITHUB_RELEASES_URL`. Optional publication text must be nonempty and at most 64 bytes. Its response model does not inspect `draft`/`prerelease` flags; the fixed `/latest` endpoint is part of the intended contract. Do not ascribe mobile's explicit prerelease guard to Rust.

`open_release_page` always launches **`GITHUB_RELEASES_URL`**, regardless of metadata/copy-link values. It cannot be directed to a UI-supplied URL. Update checking reports availability only; it does not download, validate, install, or replace executable code.

## (c) Desktop UI and mobile PWA hardening

### Desktop controller

[`ui/index.html`](../../ui/index.html) has `<meta name="referrer" content="no-referrer">` and external local CSS/module JS. [`ui/main.js`](../../ui/main.js) calls custom Rust IPC for calculations, history, settings, release checks, app information, and clipboard. It is a thin calculation bridge rather than a duplicate JS math engine. `copyText` also attempts `navigator.clipboard.writeText` if custom clipboard IPC fails; describe that fallback when assessing clipboard permissions.

The inspected runtime has zero forbidden `.innerHTML`, `.outerHTML`, `eval(...)`, or `new Function` sink matches under the workflow regex. `setResult` splits the legacy `<br>` delimiter and constructs text nodes/line breaks rather than interpreting HTML. Dynamic history/credits/error text use DOM creation and `textContent`. `Object.hasOwn` protects the history restore dispatch map against inherited keys.

Each live updater increments its `seq.*` counter before reading input and drops an IPC result whose ticket is stale. Empty/error/overflow paths clear `lastValidCalc`; `copyCardResult` therefore ignores invalid or placeholder states. `sanitizeNumericString` removes supported currency/grouping/percent characters and a leading plus; numeric/finite checks follow. It is not a locale-aware decimal-comma parser: comma stripping treats commas as grouping. `buildValidHistoryCandidate` bounds the six display/input strings before submitting history; backend validation remains authoritative. JS `.length` measures UTF-16 code units while Rust `.len()` measures bytes, so these limits are not identical for non-ASCII input.

The actual commands are `get_settings`, `set_settings`, `check_for_updates`. In post-PBS `HANDOFF.md`, command typos persist at L81, L96, L123, and L125 (pre-PBS `f3ba3f4` L78, L93, L120, and L122); the added callout occupies L5–7. Those alternatives and `Ctrl/Cmd+Shift+C` / `0%` zero-denominator hints (at L21, L78; baseline L18, L75) are not current implementations. See the [ledger discrepancy table](EXECUTION_AND_CODING_LEDGER.md#4-verified-code-versus-legacy-document-discrepancies) for exact source/citation reconciliation.

### Mobile CSP and local data boundary

[`mobile/index.html`](../../mobile/index.html) includes the following exact meta tag at this baseline:

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'sha256-HppoWhfVX+UyR2KqXbS6U2Q3KafIo1MVyti/h94cX9o='; script-src 'sha256-655QfOPjmPDnhT1lUo4K5UBkQqBy3BB3EYZt7mnAKdg='; worker-src 'self'; child-src 'self'; img-src 'self' data:; manifest-src 'self'; connect-src 'self' https://api.github.com; object-src 'none'; base-uri 'none'; form-action 'none';">
```

The exact inline-block UTF-8 SHA-256/base64 digests were recomputed locally and matched. `no-referrer` is also present. The policy has no unsafe-inline/unsafe-eval allowance and deliberately omits `frame-ancestors`, which the CI gate forbids in this meta policy. A meta policy is not an HTTP framing header. This source audit did not inspect actual Pages response headers or browser enforcement.

`sanitizeHistoryItem` rejects null/non-object/array items, unknown calculator keys, invalid/nonempty bounded fields, and modes other than null/`add`/`extract`. JSON-parsed objects follow this shape validation; the function is not a general prototype-identity checker. It normalizes finite nonnegative IDs/timestamps or substitutes zero; older entries may omit copy text, which falls back to result text.

`readHistoryFromStorage` handles missing/malformed/non-array data, filters records, and caps at 500. `writeHistoryToStorage` updates memory, then attempts `localStorage.setItem`; quota/private-mode failures retain an in-memory session fallback. It does not return a durable-save receipt. Settings similarly accept a boolean preference or default to enabled and suppress storage errors. A `storage` listener reloads history for `pct_tool_history_v2` and settings for `pct_tool_settings_v1`; `event.key === null` handles cross-tab clearing. This is same-origin browser synchronization, not a cross-device account or backup.

No runtime `element.style.*` mutations were found in the inline script. `legacyCopyText` uses a textarea with `.clipboard-scratch`, whose styling is in the hash-protected style block, and `document.execCommand("copy")` as a fallback. The same forbidden-sink gate covers mobile script and worker. Clipboard availability and browser storage policies still vary by browser/context.

Mobile `runUpdateCheck` fetches the fixed GitHub API URL with `cache: "no-store"`, checks HTTP success and explicit `draft` / `prerelease` flags, parses a triplet, and uses `setReleaseLinks` to constrain link strings to the fixed HTTPS repository prefix, falling back to the release URL. It does not inspect `response.url` as a second origin check. Origin restrictions come from the fixed fetch endpoint, CSP, and link prefix; worker fetch interception has its own explicit same-origin check. Manual failure shows an offline/blocked error; startup failure is silent. The update preference does not disable service-worker same-origin update traffic.

### Service worker lifecycle and fetch boundary

[`mobile/sw.js`](../../mobile/sw.js) declares `CACHE_NAME = "pct-tool-v2.2.0-mobile-2"` and seven `PRECACHE_URLS`:

```text
./
./index.html
./manifest.webmanifest
./icons/apple-touch-icon.png
./icons/icon-192.png
./icons/icon-512.png
./icons/icon-maskable-512.png
```

The `fetch` listener handles only GET requests, requires `url.origin === self.location.origin`, and requires `url.pathname.startsWith(scopePathname)`, where scope comes from the registration. The manifest sets `id`, `start_url`, and `scope` to `./`. `isCacheableResponse` requires `status === 200`, `type === "basic"`, and `!redirected`. These conditions govern **cache writes**; an uncached network response can still be returned without satisfying them.

`buildNoCacheRequest` reconstructs navigation requests from their URL with `cache: "no-cache"` and `credentials: "same-origin"`, avoiding the browser error caused by cloning a request with navigation mode plus init options. Other requests preserve their request fields while overriding cache mode.

`handleNavigationFetch` is network-first for navigations and app-shell paths, updating request/index/root cache entries for cacheable responses. Cache-write failure does not discard a fresh network response. A thrown fetch failure falls back to the request (ignoring search), then cached index, then `offlineResponse` (503). An HTTP error response is returned as received; it does not trigger the exception-only offline fallback.

Installation fetches all seven URLs using `cache: "reload"`, rejects non-cacheable precache responses, stores them, then calls `skipWaiting`. Activation removes older caches whose names start `pct-tool-`, claims clients, and navigates window clients only when `hadOldCache` was true. This prefix cleanup can affect other app generations sharing that origin/prefix. Static non-navigation requests are cache-first with a concurrent background `no-cache` fetch and revalidation cache write.

The page registration uses scope `./`, `updateViaCache: "none"`, immediate `reg.update()`, visible-page update checks, and a once-guarded controller-change reload for previously controlled pages. These are implemented upgrade controls, not evidence of a tested live phone upgrade in this audit. Cache eviction, unavailable storage, browser lifecycle scheduling, and incomplete first precaching can still remove offline availability.

## (d) Supply chain and CI/CD hardening

### Exact pinned actions

Every `uses:` action reference in the inspected workflows is pinned to a 40-character commit SHA; the comments are human version hints, not the integrity identity.

| Action | Exact SHA | Workflow use |
| --- | --- | --- |
| `actions/checkout` | `11d5960a326750d5838078e36cf38b85af677262` | Build and Pages. |
| `dtolnay/rust-toolchain` | `b725eda525362e7cf34af9a7243cac1e3f01a7ec` | Build, stable Rust; rustfmt/Clippy components as specified per job. |
| `Swatinem/rust-cache` | `d1527c8f67ef9af357290475d4af4b0fab8f12e0` | Build. |
| `actions/upload-artifact` | `ea165f8d65b6e75b540449e92b4886f43607fa02` | Windows staged deliverables. |
| `actions/download-artifact` | `d3f86a106a0bac45b974a628896c90dbdf5c8093` | Release job. |
| `actions/configure-pages` | `983d7736d9b0ae728b81ab479565c72886d7745b` | Pages, `enablement: true`. |
| `actions/upload-pages-artifact` | `56afc609e74202658d3ffba0e8f6dda462b719fa` | Pages, path `mobile`. |
| `actions/deploy-pages` | `d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e` | Pages deployment. |

All checkout invocations set `persist-credentials: false`. Pinning fixes action source identity; runners, stable toolchains, package registries, OS tools, and downloaded bundler/runtime prerequisites remain external supply-chain inputs. A single root `Cargo.lock` and `--locked` tests/lints/builds prevent silent dependency resolution drift; they do not vendor dependencies or prove absence of dependency vulnerabilities.

### Build, test, release, and Pages permissions

[`build.yml`](../../.github/workflows/build.yml) triggers on pushes to `main`/`v2.1-features`, `v*` tags, pull requests, or manual dispatch. Workflow default is `contents: read`. `rust-checks` on Ubuntu runs formatting, core tests/Clippy, and Node mobile parity/CSP/sink gates. `windows-build` needs that job, explicitly has `contents: read`, and runs full workspace Clippy/tests, installs CLI `=2.12.4` with `--locked`, builds via `cargo tauri build -- --locked`, runs the real-window smoke test, stages assets, and uploads them. The Node gate runs in the Ubuntu job, not independently on Windows.

Only the downstream `release` job has `contents: write`; its condition requires a push to `refs/heads/main` or a `refs/tags/v` prefix. PR/manual runs do not satisfy that condition. It downloads the staged artifact, chooses a tag from the ref or configured version, and requires at least five assets. Existing-release handling calls a tag-ref `PATCH` with force enabled, uploads with `gh release upload --clobber`, and edits notes if present. New releases target the workflow commit. These are consequential publish operations implemented in CI; none were executed by this documentation task. Reusing a version tag makes a tag name alone insufficient as immutable evidence: retain the resolved commit/run and asset digests.

Staging computes SHA-256 for NSIS, MSI, portable executable, and mobile HTML, sorts by name, lowercases digests, changes spaces to dots in release asset names, and writes UTF-8-no-BOM `dist/SHA256SUMS.txt`. This proves matching bytes when independently compared, not publisher authenticity if an attacker controls both the binary and checksum file. No specific installer hash is claimed here because no release binary was downloaded or built for this audit.

[`pages.yml`](../../.github/workflows/pages.yml) triggers on `main` pushes affecting `mobile/**` or itself, plus manual dispatch. Its deploy job also requires `refs/heads/main`, uses the `github-pages` environment, rechecks mobile parity/CSP/sinks, then configures, uploads, and deploys `mobile`. Unlike build's job-specific write isolation, Pages declares workflow-level `contents: read`, `pages: write`, and `id-token: write`. Concurrency group `pages` has `cancel-in-progress: false`. Repository files do not prove environment protection or a successful deployment.

The Node gates hash exact inline style/script contents, reject meta `frame-ancestors`, reject the named DOM/eval sinks, extract math between `function formatDecimal` and the persistent-history marker, and compare all 10,661 original cases. This is not a full static analyzer or browser test. [`.gitattributes`](../../.gitattributes) uses `* text=auto` plus `eol=lf` for mobile HTML/JS/webmanifest and desktop HTML/CSS/JS. Keep those rules: CRLF changes inside hashed inline blocks break the CSP even if code semantics appear unchanged.

## (e) Platform limitations and owner-verified GitHub UI items

| Boundary | Implemented / observed repository control | Residual limit / acceptance owner |
| --- | --- | --- |
| Local privacy | Math is local; no account/telemetry mechanism found in the inspected runtime; history/settings use app data or browser storage. | These stores are plaintext and local to the OS/browser profile. Local administrators, malware, backups, browser extensions, and profile access are outside this application's controls. Runtime data was not inspected. |
| Windows app data | Typed validation, bounded reads, candidate persistence before shared-state commit. | Windows uses inherited user-profile/app-data ACLs; no explicit app DACL or Unix-mode equivalent is installed by this code. Unix creation modes do not describe Windows ACLs. |
| Windows distribution | NSIS/MSI and portable build routes; checksum staging; no signing configuration observed. Legacy release notes say builds are unsigned. | SmartScreen/unknown-publisher warnings may occur; actual downloaded signatures/reputation were not inspected. New maintainers must provision signing separately if desired. |
| Native webview | Local assets, strict configured CSP, narrow custom IPC. | WebView2, Windows updates, TLS trust store, process environment, and OS/browser vulnerabilities remain platform boundaries. The bootstrapper may need network access on a machine without WebView2. |
| Updates | Startup preference defaults enabled; fixed GitHub metadata endpoint; manual check; notification-only update flow. | An outbound TLS request to `api.github.com` reveals ordinary connection/request metadata to GitHub/network infrastructure. No calculation/history fields are passed in that request. Disable startup checking for offline startup behavior; PWA asset/update traffic is separate. |
| Clipboard | Bounded Rust IPC and gated smoke reporting. | A normal copy intentionally replaces clipboard text. `--smoke-test` also overwrites the real clipboard and does not restore it. |
| Hosted PWA | Hash CSP meta, no-referrer, scoped worker, offline cache. | No custom framing HTTP header is configured by this repo; do not infer anti-framing enforcement from meta CSP. Offline availability requires an available cached app shell or standalone file. |

The following are **Owner-Verified / External UI — pending verification**, not controls proven by Git files:

| GitHub setting / state | Owner readback to retain |
| --- | --- |
| Branch protection / rulesets | Actual protected branch, required checks/reviews, bypass and force-push rules. |
| Actions workflow permissions and allowed actions | Repository/organization default token scopes, action restrictions/SHA policy, and fork-PR trust settings. YAML's narrowed scopes are only the repository layer. |
| `github-pages` environment | Actual deployment branch/tag restriction to `main`, reviewers if required, and protection state. |
| Pages source/domain/HTTPS enforcement | Actions source, correct domain/base path, enforced HTTPS status, and actual response/destination readback. |
| Dependabot, secret scanning, push protection | Actual enabled/disabled state and alerts/access scope. The presence of `.gitignore` secret patterns does not establish any toggle or a clean historical secret scan. |
| Current release/Pages success | Run ID, resolved commit/tag, asset names/digests, deployed HTML hashes and worker generation. Historical README/HANDOFF success reports are insufficient for current service acceptance. |

**Current technical evidence:** post-remediation verification (`#30` `verifier-2` PASS and coordinator `E-08` checks on `handoff-local-dev`) passed workspace tests (9 core + 1 integration + 3 backend), full Windows Clippy (`-D warnings`), formatting, Node's 10,661-case parity/hash/sink/LF/workflow-pin checks, and document link/AST/preservation checks (`EXECUTION_AND_CODING_LEDGER.md` §5). **Not exercised:** backup/restore recovery, current installer build/install, real-window smoke, Unix runtime, live update network requests, phone installation/upgrade, remote publish state, or the hosted UI settings above. Pull Request review/merge onto `main` and owner inspection of hosted GitHub settings remain pending.
