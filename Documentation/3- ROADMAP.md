# Roadmap

This roadmap reflects both the completed phases and the future direction of the Percentage Calculator Tool Desktop project.

It should be read as a project memory document, not only a task list.

---

## Phase 1 - Original HTML Utility
**Status: Completed**

- built a small offline single-file HTML percentage calculator with five calculation sections, live formula display, and copy buttons (`reference/Percentage Calculator Tool v1.1.html`).

---

## Phase 2 - Electron Desktop Conversion
**Status: Completed**

- split the single-file tool into a structured Electron desktop app with a preload bridge, icon assets, and Electron Builder NSIS + portable Windows builds.

---

## Phase 3 - Testing and Build Verification
**Status: Completed**

- separated calculation helpers, added Vitest unit tests, and created a real-window Electron smoke test.

---

## Phase 4 - Clean Final Output Folder
**Status: Completed**

- separated user-facing Installer and Portable deliverables from intermediate build files.

---

## Phase 5 - Desktop v1.1 Polish
**Status: Completed**

- added copy feedback, Clear All, About dialog, footer version text, and expanded smoke test coverage.

---

## Phase 6 - Documentation and Repository Foundation
**Status: Completed**

- wrote the numbered `Documentation/` set, initialized readable Git history, and published to GitHub (`v1.1.0` / `v1.1.0-electron`).

---

## Phase 7 - Tauri v2 & Rust Rebuild (v2.0.0)
**Status: Completed**

### Goals

- replace Electron and Node with **Tauri v2 and Rust**
- move all percentage calculations into a pure Rust crate (`percent-core`)
- keep the terminal-inspired HTML/CSS interface and behavior 100% identical
- guarantee zero math regressions against v1.1
- automate Windows builds and smoke testing on GitHub Actions

### What was completed

- tagged the final Electron state as `v1.1.0-electron` for instant rollback
- generated 10,661 golden test fixtures from the v1.1 JS math and verified byte-for-byte parity in `percent-core` (including JS `Math.round` and `toFixed(2)` tie-breaking rules)
- built the `src-tauri` desktop shell with typed commands, clipboard and dialog plugins, least-privilege capabilities, and a strict CSP
- adapted the static `ui/` frontend to call Tauri commands with per-section sequence guards
- ported all 30+ real-window `--smoke-test` checks to Tauri and verified them locally under Xvfb and in Windows CI
- removed the legacy Electron, Vitest, and `node_modules` toolchain
- added `.github/workflows/build.yml` to build and test the Windows NSIS installer, MSI installer, and portable executable automatically

### Outcome

The app keeps the exact look, feel, and results of v1.1 while shipping as a small, dependency-light Rust + Tauri v2 desktop binary.

---

## Phase 8 - v2.1.0 Feature Expansion & Dark Terminal About Modal
**Status: Completed**

### Goals

- add a `⇅ swap values` button between the two inputs on every calculator card
- add **Markup & Profit Margin** and **Reverse Tax / VAT** (`add tax` / `extract tax`) calculator cards
- add a **persistent local calculation history tape** (capped at 500 entries, with `copy`, `↺ restore`, and `clear history`)
- replace the white native Windows `MessageBox` About popup with an **in-app dark terminal About modal** and update credits to **Mohamed Sayed · Ahmed Emara · DeepSeek · ChatGPT · Antigravity**

### What was completed

- extended `percent-core` with `calculate_markup_margin` and `calculate_tax` (`TaxMode::Add` / `TaxMode::Extract`) plus unit tests
- added atomic local JSON history persistence (`%APPDATA%\com.percentagecalculator.tool\history.json`) in `src-tauri` with a 500-entry FIFO limit, input validation, consecutive deduplication, and isolated in-memory storage during `--smoke-test`
- built the custom dark-terminal About modal in `ui/` and removed the `tauri-plugin-dialog` dependency
- expanded the automated `--smoke-test` suite to cover swapping, Markup & Margin, Tax/VAT add & extract, history recording/restoring/clearing, and the new About modal

---

## Phase 9 - Mobile & Web Standalone HTML / PWA Edition (v2.1.0)
**Status: Completed**

- created `mobile/index.html` as a self-contained single-file HTML & offline PWA for **iPhone (Safari → Add to Home Screen)** and **Android (Chrome → Install app)** with `10,661`-case parity against `percent-core`
- added `mobile/manifest.webmanifest`, offline Service Worker (`mobile/sw.js`), `180x180` Apple Touch Icon, and `192x192` / `512x512` / `maskable` Android icons
- added mobile ergonomics: safe-area insets (`viewport-fit=cover`), `16px` touch inputs to prevent iOS focus zoom, horizontal card quick-jump bar, `localStorage` 500-entry history, and an in-app install guide modal
- added `.github/workflows/pages.yml` to deploy `mobile/` to GitHub Pages and updated `.github/workflows/build.yml` to verify 10k parity and attach the standalone mobile HTML to releases

---

## Phase 10 - Security Audit, Hardening & v2.1.1 Release
**Status: Completed**

- ran a structured full-repo source security audit (`0` confirmed vulnerabilities across desktop, mobile PWA, and CI) and integrated all defense-in-depth hardening into **v2.1.1**
- tightened Tauri capability permissions to `permissions: []` (`src-tauri/capabilities/default.json`) and expanded desktop CSP (`connect-src 'none'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`, `frame-ancestors 'none'`)
- hardened `history.json` storage in `src-tauri/src/commands.rs`: symlink checks, `1 MiB` bounded read, shared schema validation on disk load matching `history_add`, unique `history.<pid>.<seq>.json.tmp` atomic writes (`0o600` file / `0o700` dir on Unix + `sync_all()`), lock-held commit-on-success mutations, and `4096`-byte `copy_text` cap
- hardened `mobile/index.html` and `mobile/sw.js` with `<meta http-equiv="Content-Security-Policy">` pinning exact SHA-256 digests of inline `<style>` and `<script>`, `<meta name="referrer" content="no-referrer">`, schema-validated `localStorage` with `256`-char field bounds and cross-tab `storage` sync, `Object.hasOwn` guards, `.clipboard-scratch` class replacing inline styles, and scope-pathname + non-redirect SW caching checks
- hardened CI/CD (`.github/workflows/build.yml`, `.github/workflows/pages.yml`, `.gitattributes`): immutable 40-char Action SHAs, `persist-credentials: false`, `--locked` builds, `contents: read` vs `main`/tag-only `release` split, Pages `refs/heads/main` guard, `SHA256SUMS.txt` checksums, and LF line-ending preservation
- surfaced the live Web App URL (`https://ciphervaults.github.io/Percentage-Calculator-Tool/`) visibly across `README.md`, GitHub repository metadata, desktop & mobile About modals, and `file://` install notes

---

## Optional Future Work

Future improvements can include:

- custom title bar
- compact mode that hides formula panels
- paid Windows Authenticode code signing (to remove the SmartScreen "unknown publisher" prompt)
- macOS and Linux release bundles in the GitHub Actions matrix
- auto-update support
- GitHub Repository Settings hardening (enforce SHA-only Actions allowlist in `Settings -> Actions -> General` and `main`-only deployment rule on the `github-pages` environment)
