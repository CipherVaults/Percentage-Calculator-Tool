# Development Handoff — Percentage Calculator Tool (`v2.2.0`)

This document captures everything required to transition development cleanly from **Antigravity Remote Agents** to a **local Antigravity Desktop installation on Windows** with local Git, GitHub CLI (`gh`), Rust/Tauri builds, and automated verification.

---

## 1. Repository & Version Identity

- **Repository:** [`CipherVaults/Percentage-Calculator-Tool`](https://github.com/CipherVaults/Percentage-Calculator-Tool) (`https://github.com/CipherVaults/Percentage-Calculator-Tool.git`)
- **Live Mobile & Web PWA (GitHub Pages):** `https://ciphervaults.github.io/Percentage-Calculator-Tool/`
- **Latest Production Release on `main`:** `v2.2.0` (tag `v2.2.0`)
- **Handoff Development Branch:** `handoff-local-dev` (created cleanly off `main`; **do not force-push** — merge or continue feature branches via normal PR workflow)
- **Historical Version Tags:**
  - `v1.1.0` / `v1.1.0-electron` — final Electron desktop release
  - `v2.0.0` — initial Tauri v2 + Rust rewrite
  - `v2.1.0` — v2.1 features (swap pills, Markup & Margin, Reverse Tax/VAT, history tape, dark About modal, initial Mobile PWA)
  - `v2.1.1` — security hardening across desktop, mobile, and CI + desktop quick-jump pills + README/assets overhaul
  - `v2.2.0` — calculator & copy polish (formatted number paste, `Enter` quick-save, `Ctrl/Cmd+Shift+C`, `0%` zero-denominator hints), history tape timestamps/filtering/single-entry delete & restore pulse, and optional GitHub Releases update checker with persistent desktop `settings.json`

---

## 2. Architecture Overview

The repository contains two offline, zero-telemetry calculator applications backed by identical 10,661-case-verified math:

```text
+-------------------------------------------------------------------------+
| 1. Windows Desktop App (Tauri v2 + Rust)                                |
|                                                                         |
|  Static Webview UI (ui/index.html, ui/styles.css, ui/main.js)           |
|    - Plain HTML/CSS/JS (no bundler, no npm runtime, zero innerHTML)     |
|    - Calls Rust commands via window.__TAURI__.core.invoke(...)          |
|                             |                                           |
|                             v                                           |
|  Tauri Shell (src-tauri/src/main.rs & commands.rs)                      |
|    - Permissions locked to [] (capabilities/default.json)               |
|    - Strict CSP + no-referrer (tauri.conf.json & ui/index.html)         |
|    - 7 calc IPC + history_delete + settings/update + bounded copy_text  |
|    - --smoke-test mode (50+ webview & real clipboard checks + 20s timeout)|
|    - Atomic private stores (%APPDATA%\com.percentagecalculator.tool\{history,settings}.json)
|                             |                                           |
|                             v                                           |
|  Pure Rust Math Engine (crates/percent-core/src/lib.rs)                 |
|    - Zero UI/OS dependencies (serde only)                               |
|    - Matches v1.1 JS Math.round & Number.toFixed(2) rounding rules      |
+-------------------------------------------------------------------------+

+-------------------------------------------------------------------------+
| 2. Standalone Mobile & Web PWA (mobile/)                                |
|                                                                         |
|  mobile/index.html + mobile/manifest.webmanifest + mobile/sw.js         |
|    - Single self-contained HTML file with inline CSS, JS & fallback PNG |
|    - Exact SHA-256 CSP <meta> digests + <meta name="referrer" content="no-referrer">
|    - 500-entry schema-validated localStorage history + storage event sync
|    - Offline-first Service Worker (pct-tool-v2.2.0-mobile-1, scope &    |
|      !response.redirected guarded) deployed via GitHub Pages on main    |
+-------------------------------------------------------------------------+
```

---

## 3. Existing Features (`v2.2.0`)

- **Seven Calculators** (shared across Desktop Rust engine & Mobile JS engine):
  1. **Percentage Change** (`calc_change`)
  2. **Percentage of Total** (`calc_percent_of_total`)
  3. **Calculate Percentage / Portion** (`calc_portion`)
  4. **Discount** (`calc_discount`)
  5. **Find Original Value** (`calc_original`)
  6. **Markup & Profit Margin** (`calc_markup_margin` — net profit, markup % on cost, gross margin % on selling price)
  7. **Reverse Tax / VAT** (`calc_tax` — `TaxMode::Add` / `TaxMode::Extract`)
- **UI & Ergonomics:**
  - **Quick-Jump 8-Pill Navigation Bar** (`change`, `% of total`, `portion`, `discount`, `original`, `markup & margin`, `tax / vat`, `history`) directly below `.header` on both Desktop and Mobile (`#card-change` .. `#historySection`).
  - **`⇅ swap values` pill** between the two inputs on every calculator card.
  - **Live Formula & Live Result panel** updating while typing (guarded by per-section sequence counters `seq.*` on desktop so out-of-order async replies cannot overwrite newer input), plus formatted number paste support (`$1,250.50`, `15%`), `Enter` quick-save to history, `Ctrl/Cmd+Shift+C` shortcut with **Copy** button feedback, and `0%` zero-denominator hints.
  - **Persistent 500-Entry History Tape** (`history_list`, `history_add`, `history_delete`, `history_clear`) with `YYYY-MM-DD HH:MM:SS` timestamps, real-time filtering (`#historyFilter`), consecutive deduplication, `copy`, `↺ restore` back into the source calculator with a `.card-restored` highlight pulse, single-item `×` deletion, and confirmation-guarded clear (`clear history`).
  - **Clear All** resets all calculator inputs without erasing saved history.
  - **Dark Terminal About Modal & Settings** (`Esc` / backdrop / `[ × ]`) with credits (**Mohamed Sayed · Ahmed Emara · DeepSeek · ChatGPT · Antigravity**), runtime version (`get_app_info`), **Official Web App (PWA)** link/copy button (`https://ciphervaults.github.io/Percentage-Calculator-Tool/`), persistent Desktop **Check for updates on startup** toggle (`settings.json` via `settings_get` / `settings_set`), and manual **Check Now** (`check_for_update` / `open_release_page` on Desktop; GitHub Releases API check on Mobile & Web).
  - **Mobile PWA Features:** notch safe-area padding (`viewport-fit=cover`), `16px` input font sizes to prevent iOS Safari zoom, Home Screen install helper modal, and offline Service Worker caching.

---

## 4. Important Files & Directories

| Path | Role |
| --- | --- |
| `Cargo.toml` / `Cargo.lock` | Cargo workspace (`crates/percent-core`, `src-tauri`) & locked dependencies |
| `.gitattributes` | Enforces **LF** line endings on `mobile/*.{html,js,webmanifest}` and `ui/*.{html,css,js}` so Windows/Linux SHA-256 CSP hashes match identically |
| `.gitignore` | Ignores `target/`, `src-tauri/gen/`, legacy Node artifacts, `dist/`, logs, `.env*`, `*.pem`, `*.key` |
| `crates/percent-core/src/lib.rs` | Pure Rust math formulas (`js_round`, `format_decimal`, all 7 calculators) + 9 unit tests |
| `crates/percent-core/tests/golden_parity.rs` | Verifies 10,661 golden fixtures in `tests/fixtures/golden.json` (generated by `tests/fixtures/generate-golden.mjs`) |
| `src-tauri/src/main.rs` | Tauri window setup, state (`SmokeState`, `HistoryState`, `SettingsState`), `--smoke-test` in-memory isolation & 20s watchdog |
| `src-tauri/src/commands.rs` | All Tauri `#[tauri::command]` handlers, hardened `history.json` & `settings.json` I/O, input/entry validation, `check_for_update`, `open_release_page`, `copy_text`, and 3 unit tests |
| `src-tauri/tauri.conf.json` | Window geometry (`1120x860`, min `760x620`), strict desktop CSP, NSIS/MSI bundler configuration (`version: "2.2.0"`) |
| `src-tauri/capabilities/default.json` | Least-privilege capability list (`permissions: []`) |
| `ui/index.html`, `ui/styles.css`, `ui/main.js` | Desktop Tauri webview HTML, terminal theme + `.quick-nav` CSS, IPC controller + live `--smoke-test` suite |
| `mobile/index.html` | Standalone single-file Mobile & Web PWA with inline `<style>`/`<script>` pinned via SHA-256 CSP `<meta>` |
| `mobile/sw.js` | Offline Service Worker (`pct-tool-v2.2.0-mobile-1`) with scope-prefix & `!response.redirected` guards |
| `mobile/manifest.webmanifest` & `mobile/icons/` | Web app manifest + Apple Touch (`180x180`) and Android (`192x192`, `512x512`, `maskable`) icons |
| `.github/workflows/build.yml` | SHA-pinned CI: Ubuntu verification → Windows Clippy/Tests/Tauri Build/Smoke Test/SHA256SUMS → `main`/tag GitHub Release publisher |
| `.github/workflows/pages.yml` | SHA-pinned GitHub Pages workflow: re-verifies 10k parity + CSP SHA-256 hashes → deploys `mobile/` from `refs/heads/main` only |
| `.github/release-notes-v2.2.0.md` | Release notes template for tag `v2.2.0` (with `.github/release-notes-v2.1.1.md` retained for history) |
| `README.md` & `assets/` | Public overview, desktop/mobile previews (`assets/preview-desktop.png`, `assets/preview-mobile.png`), security notes & checksums guide |
| `Documentation/` | `1- PROJECT_CONTEXT.md`, `2- ARCHITECTURE.md`, `3- ROADMAP.md`, `4- SESSION_SUMMARY.md` |
| `reference/Percentage Calculator Tool v1.1.html` | Original single-file HTML utility kept read-only for historical reference |

---

## 5. Key Architectural & Security Decisions

1. **Tauri v2 + Rust Replacing Electron (Rollback Tag Preserved):** Replaced Electron/Node with Tauri v2 + pure Rust `percent-core` (`v2.0.0`), retaining tag `v1.1.0-electron` for instant rollback and consolidating ongoing PRs directly against `CipherVaults/Percentage-Calculator-Tool` (superseding the earlier `AbyssWatcher2` fork).
2. **Zero Frontend Tooling / Framework:** Intentionally plain HTML/CSS/JS with zero `node_modules`, zero bundler, and zero `.innerHTML`/`.outerHTML`/`eval`/`new Function` sinks (`ui/main.js` and `mobile/index.html` use `textContent`, `createTextNode`, and `replaceChildren` exclusively).
3. **Exact v1.1 Math Compatibility:** `percent-core` deliberately reproduces JavaScript `Math.round` (half toward `+∞`) and `Number.prototype.toFixed(2)` (third-decimal half away from zero) so `percent-core` and `mobile/index.html` produce identical formatting across all 10,661 golden test cases.
4. **In-App Dark Terminal About Modal:** Dropped `tauri-plugin-dialog` (which rendered a jarring white Windows `MessageBox`) in favor of an in-app accessible dark terminal About modal displaying runtime `get_app_info` version, credits, and the live Web App URL.
5. **Zero Unused Tauri Permissions (`permissions: []`):** Because `ui/main.js` uses custom Rust `#[tauri::command]` handlers (`copy_text`, `history_*`, `calc_*`, `get_app_info`), `src-tauri/capabilities/default.json` grants zero built-in/plugin permissions to the frontend.
6. **Hardened Local Persistence (`src-tauri/src/commands.rs`):**
   - `read_regular_file_limited` rejects symlinks/non-files and caps reads at `1 MiB` (`HISTORY_MAX_FILE_BYTES`).
   - `load_history_from_disk` applies shared `validate_entry_fields` checks (`ALLOWED_CALCULATORS`, `MAX_FIELD_LEN = 256`, `mode` allowlist) identical to `history_add`.
   - `write_atomic_private` checks parent & target symlinks, writes exclusively via `OpenOptions::create_new(true)` (`<stem>.<pid>.<seq>.tmp`, Unix `0o600` file / `0o700` dir) for both `history.json` and `settings.json`, calls `sync_all()`, and atomically renames.
   - `history_add`, `history_delete`, `history_clear`, and `settings_set` hold their mutex across persistence and only commit in-memory state after disk persistence succeeds.
   - `copy_text` enforces `MAX_COPY_LEN = 4096`.
   - `check_for_update` and `open_release_page` enforce strict HTTPS URL validation (`https://github.com/CipherVaults/Percentage-Calculator-Tool/releases...`).
7. **Hardened Mobile PWA (`mobile/`):**
   - Strict `<meta http-equiv="Content-Security-Policy">` pinning Base64 SHA-256 digests of the exact `<style>` and `<script>` blocks alongside `default-src 'none'`, `worker-src 'self'`, `img-src 'self' data:`, `manifest-src 'self'`, `connect-src 'self' https://api.github.com`, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`, plus `<meta name="referrer" content="no-referrer">` and zero runtime `element.style.*` writes.
   - `localStorage` parsing validates plain objects, string fields (`<= 256` chars), allowlisted calculator keys via `Object.hasOwn`, and syncs cross-tab clears cleanly via `window.addEventListener("storage", ...)`.
8. **Hardened CI/CD & Clean Tag Re-Releases (`.github/workflows/`):**
   - All workflow Actions are pinned to immutable 40-char commit SHAs with `persist-credentials: false`.
   - `windows-build` runs with `contents: read`; only the downstream `release` job (gated to `main` or `refs/tags/v*`) holds `contents: write`, builds cleanly with `--locked`, attaches `SHA256SUMS.txt`, and supports idempotent tag-ref movement + `--clobber` asset updates when re-releasing an existing `v*` tag (used to include the desktop quick-jump pills cleanly under `v2.1.1`).

---

## 6. Development Progress

- **Phases 1–11 Completed:** Electron baseline preserved (`v1.1.0-electron`), Tauri v2 + Rust rebuild shipped (`v2.0.0`), Swap/Markup/Reverse Tax/History/Dark About + Mobile PWA shipped (`v2.1.0`), full source security audit (`0` confirmed findings) + defense-in-depth hardening + desktop quick-jump bar parity shipped (`v2.1.1`), and calculator/copy polish, history filtering/single-item delete & optional GitHub Releases update checker shipped (`v2.2.0`).
- **CI Verification on `main` (`v2.2.0`):** `Rust Core Tests & Web Asset Checks`, `Windows Build, Smoke Test & Bundles`, `Deploy Mobile & Web PWA (GitHub Pages)`, and `Publish GitHub Release` (`v2.2.0`) have all succeeded on `main`.

---

## 7. Outstanding Tasks & Owner-Side Follow-ups

1. **GitHub Repository Settings (manual one-time verification in GitHub Web UI):**
   - **Settings → Environments → `github-pages` → Deployment branches and tags:** confirm deployments are restricted strictly to **`main`**.
   - **Settings → Actions → General → Actions permissions:** optionally restrict to SHA-pinned / explicitly selected actions (`actions/*`, `dtolnay/rust-toolchain`, `Swatinem/rust-cache`).
2. **Merge or Delete `handoff-local-dev` Later (optional):** Once you review `HANDOFF.md` locally on Windows, open a PR to merge `HANDOFF.md` into `main` or fold it into your next feature branch.
3. **Optional Future Enhancements (unscheduled backlog in `Documentation/3- ROADMAP.md`):**
   - Paid Authenticode code signing certificate (would remove Windows SmartScreen warnings on first download).
   - Updating SHA-pinned workflow Actions (`actions/checkout`, `upload-artifact`, `download-artifact`, `configure-pages`, `deploy-pages`) to Node 24-native major releases when ready (currently triggers a harmless `Node.js 20 is deprecated` annotation in GitHub runner logs).
   - Optional UI modes (compact mode hiding formula panels, custom frameless title bar, macOS/Linux bundles, auto-updater).

---

## 8. Known Bugs, Caveats & Gotchas

- **No known functional bugs** in calculations, UI, clipboard, history persistence, or PWA offline mode.
- **CRITICAL — Editing `<style>` or `<script>` in `mobile/index.html` breaks CSP if hashes are not updated:**
  Any single-byte edit inside `<style>...</style>` or `<script>...</script>` in `mobile/index.html` changes the SHA-256 digest checked both by browsers at runtime and by `.github/workflows/build.yml` + `pages.yml`. Recompute both digests whenever changing `mobile/index.html` (command in Section 9).
- **Line Endings (CRLF vs LF):** Keep `.gitattributes` intact (`mobile/` and `ui/` pinned to `eol=lf`). On Windows, configure `git config core.autocrlf false` if tools rewrite files outside Git, or a stray `\r\n` inside `mobile/index.html` will invalidate the SHA-256 CSP digest.
- **Smoke Test Modifies System Clipboard:** Running `cargo run -p percentage-calculator-tool -- --smoke-test` briefly opens and hides the desktop window, writes `"percentage-tool-smoke-test"` to your real Windows clipboard, and verifies clipboard readback. History mutations during `--smoke-test` stay strictly in memory (`in_memory_only: true`) and never overwrite `%APPDATA%\com.percentagecalculator.tool\history.json`.
- **Platform-Conditional Rust Code (`#[cfg(unix)]` vs Windows):** Unix `PermissionsExt` / symlink protections live under `#[cfg(unix)]` in `src-tauri/src/commands.rs`. Because CI enforces `cargo clippy --workspace --all-targets --locked -- -D warnings` on **Windows**, never declare variables before `#[cfg(unix)]` unless they are also used on Windows.
- **Unsigned Windows Binaries & GitHub Pages Headers:** Free builds remain unsigned (verify release downloads with `Get-FileHash <file> -Algorithm SHA256` against `SHA256SUMS.txt`), and GitHub Pages static hosting cannot send HTTP `X-Frame-Options` or `frame-ancestors` headers.
- **Git Bash `link.exe` Shadowing & Benign CI Node 20 Notice:** On Windows, Git Bash includes `/usr/bin/link` which can shadow MSVC `link.exe` (`link: extra operand`) during Cargo builds; always run Cargo from **PowerShell / Windows Terminal**. Separately, SHA-pinned CI actions (`v4`) emit a non-blocking `Node.js 20 is deprecated` runner annotation until bumped to Node 24-native tags.

---

## 9. Dependencies, Environment Requirements & Local Windows Setup

### A. Dependencies & Windows Prerequisites

- **Rust Workspace (`Cargo.lock` locked, Edition `2021`):**
  - `crates/percent-core`: `serde` `1.x` (`dev-dependencies`: `serde_json` `1.x`)
  - `src-tauri`: `tauri` `2.x`, `tauri-build` `2.x`, `tauri-plugin-clipboard-manager` `2.x`, `serde` `1.x`, `serde_json` `1.x`
  - **Zero runtime npm / Node packages** (Node.js LTS is used strictly for local/CI parity and CSP hash verification).

1. **Microsoft Visual Studio Build Tools** (required by MSVC Rust linker):
   Install Visual Studio Build Tools with **"Desktop development with C++"** and the **Windows 10/11 SDK**.
2. **WebView2 Runtime:** Preinstalled on Windows 10/11; if missing, install the Microsoft Edge WebView2 Evergreen Bootstrapper.
3. **Git, GitHub CLI (`gh`), Rustup, and Node.js LTS** (PowerShell):
   ```powershell
   winget install Git.Git
   winget install GitHub.cli
   winget install Rustlang.Rustup
   winget install OpenJS.NodeJS.LTS
   ```
   Restart PowerShell after installing so `PATH` refreshes, then install Clippy, Rustfmt, and the exact Tauri CLI version used in CI:
   ```powershell
   rustup default stable
   rustup component add rustfmt clippy
   cargo install tauri-cli --version "=2.12.4" --locked
   ```
   > **Tip:** Run Cargo and Tauri builds from **PowerShell / Windows Terminal** (not Git Bash) so `/usr/bin/link` does not shadow MSVC's `link.exe`.

### B. Connect Git, GitHub & Local Antigravity on Windows

1. Authenticate GitHub CLI & Git credential helper on your PC:
   ```powershell
   gh auth login
   gh auth setup-git
   git config --global user.name "Your Name"
   git config --global user.email "your-email@example.com"
   ```
2. Clone the repository and check out the handoff branch (or `main`):
   ```powershell
   git clone https://github.com/CipherVaults/Percentage-Calculator-Tool.git
   cd Percentage-Calculator-Tool
   git checkout handoff-local-dev
   ```
3. **Open in Local Antigravity Desktop:** Launch Antigravity on Windows → **Open Folder** → select your cloned `Percentage-Calculator-Tool` folder → start a new local conversation referencing `HANDOFF.md` (`@HANDOFF.md`). Local Antigravity tools (`run_command`, file edits, `gh`) will run directly on your Windows workspace with your Windows Git/GitHub login.

### C. Build, Run & Test Commands on Windows (PowerShell)

1. **Formatting & Strict Lints (Zero Warnings):**
   ```powershell
   cargo fmt --all -- --check
   cargo clippy --workspace --all-targets --locked -- -D warnings
   ```
2. **Rust Unit Tests + 10,661-Case Golden Math Parity:**
   ```powershell
   cargo test --workspace --locked
   ```
3. **Run Desktop App Live in Dev Mode:**
   ```powershell
   cargo tauri dev
   ```
4. **Build Production Windows Bundles (`NSIS`, `MSI`, and Portable `.exe`):**
   ```powershell
   cargo tauri build -- --locked
   ```
   Outputs appear under `target\release\`:
   - `target\release\bundle\nsis\Percentage Calculator Tool_2.2.0_x64-setup.exe`
   - `target\release\bundle\msi\Percentage Calculator Tool_2.2.0_x64_en-US.msi`
   - `target\release\percentage-calculator-tool.exe` (standalone portable)
5. **Run Real-Window End-to-End Smoke Test:**
   ```powershell
   cargo run -p percentage-calculator-tool --locked -- --smoke-test
   # or against the release binary:
   .\target\release\percentage-calculator-tool.exe --smoke-test
   ```
   Expected output: `SMOKE_TEST_OK: all renderer, IPC, and clipboard checks passed.`
6. **Verify Mobile PWA 10k Parity, Forbidden DOM Sinks & SHA-256 CSP Hashes** (works cleanly in Windows PowerShell 5.1 and PowerShell 7+):

```powershell
@'
const fs = require("fs"), vm = require("vm"), crypto = require("crypto"), assert = require("assert");
const html = fs.readFileSync("mobile/index.html", "utf8");
assert(!html.includes("\r\n"), "CRLF line ending found in mobile/index.html");
const style = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const styleHash = crypto.createHash("sha256").update(style, "utf8").digest("base64");
const scriptHash = crypto.createHash("sha256").update(script, "utf8").digest("base64");
console.log("Expected style hash: sha256-" + styleHash);
console.log("Expected script hash: sha256-" + scriptHash);
const csp = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i)[1];
assert(csp.includes("'sha256-" + styleHash + "'"), "Style hash mismatch");
assert(csp.includes("'sha256-" + scriptHash + "'"), "Script hash mismatch");
for (const p of ["ui/main.js", "mobile/sw.js"]) {
  assert(!/\.innerHTML\b|\.outerHTML\b|\beval\s*\(|\bnew\s+Function\b/.test(fs.readFileSync(p, "utf8")));
}
assert(!/\.innerHTML\b|\.outerHTML\b|\beval\s*\(|\bnew\s+Function\b/.test(script));
const fnStart = script.indexOf("function formatDecimal");
const fnEnd = script.indexOf("// --- Persistent on-device history");
const ctx = { Number, Math };
vm.runInNewContext(script.slice(fnStart, fnEnd), ctx);
const pNum = (s) => (s === "NaN" ? NaN : s === "Infinity" ? Infinity : s === "-Infinity" ? -Infinity : Number(s));
const cases = JSON.parse(fs.readFileSync("crates/percent-core/tests/fixtures/golden.json", "utf8"));
for (const c of cases) {
  if (c.f === "formatDecimal") assert.strictEqual(ctx.formatDecimal(pNum(c.a[0])), c.r);
  else if (c.f === "discount") {
    const act = ctx.calcDiscount(pNum(c.a[0]), pNum(c.a[1]));
    assert.strictEqual(act.label, c.r.label);
    assert.strictEqual(act.copyText, c.r.copyText);
  } else {
    const a = pNum(c.a[0]), b = pNum(c.a[1]);
    const act = c.f === "percentageChange" ? ctx.calcChange(a, b)
      : c.f === "percentageOfTotal" ? ctx.calcPercentOfTotal(a, b)
      : c.f === "percentagePortion" ? ctx.calcPortion(a, b)
      : ctx.calcOriginal(a, b);
    if (c.r.ok) { assert.strictEqual(act.ok, "true"); assert.strictEqual(act.label, c.r.label); }
    else { assert.strictEqual(act.ok, "false"); assert.strictEqual(act.error, c.r.error); }
  }
}
console.log("ALL_MOBILE_CHECKS_OK (" + cases.length + " cases)");
'@ | node
```

7. **Standard Local Branch & PR Workflow:**
   ```powershell
   git checkout main
   git pull origin main
   git checkout -b my-feature-branch
   # ... make edits, test locally ...
   git add <files>
   git commit -m "Describe change clearly"
   git push -u origin my-feature-branch
   gh pr create --base main --head my-feature-branch --title "..." --body "..."
   ```

---

## 10. Items That Cannot Be Transferred Automatically

The following items reside inside the Antigravity Remote VM / cloud session and do **not** transfer automatically to a local Windows PC:

1. **Remote Chat Thread History & Artifacts:** Previous conversation transcripts, preview mockups/bookmarks in the remote agent artifact directory, and uploaded session screenshots (`/home/antigravity/upload/image.png`, `pasted.png`) remain in the remote session history (all permanent design/status context is summarized in this `HANDOFF.md` and `Documentation/`).
2. **Pre-Configured Cloud Auth & Proxy:** The remote `agy-plugin-proxy` OAuth credentials (`GH_TOKEN`, injected git identity) are ephemeral to the remote VM. You must run `gh auth login`, `gh auth setup-git`, and set `git config user.name` / `user.email` locally on Windows.
3. **Ephemeral Linux VM Toolchains & Build Cache:** `/home/antigravity/.local/tauri-env.sh`, Debian `WebKitGTK` headers, `/home/antigravity/build/tauri-cli-install.log`, and Linux `target/` Cargo artifacts stay on the remote Linux VM and must be installed natively on Windows (`rustup`, MSVC Build Tools, WebView2).
4. **Non-Repo Security Audit Artifacts & Historical Fork Clone:** Intermediate security audit run files (`/home/antigravity/security-audit-skill/...`) and the superseded v2.0.0-era fork clone (`/home/antigravity/AbyssWatcher2/Percentage-Calculator-Tool`, clean at `7f66f93`) live outside the canonical repository; all actionable findings and source changes are committed in `CipherVaults/Percentage-Calculator-Tool`.
5. **Per-Device App Runtime Data:** Existing saved desktop history/settings (`%APPDATA%\com.percentagecalculator.tool\{history,settings}.json`) and browser `localStorage` / installed PWA caches live per device and are not synced.
6. **GitHub Web UI Settings Verification:** Confirm `Settings → Environments → github-pages` (`main`-only deployment rule) and `Settings → Actions → General` directly in your browser on GitHub.
