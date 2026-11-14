# Project Context

## Project Name

Percentage Calculator Tool Desktop

---

## Project Purpose

The purpose of this project is to turn a finished local HTML percentage calculator into a small, polished Windows desktop application.

The desktop app should:

- remain fully offline
- preserve the original calculator behavior
- keep the terminal-inspired visual style
- support normal Windows usage through an installer
- support portable usage through a standalone executable
- be documented clearly enough for the project to be understood later

This is a personal utility tool, not a large commercial application.

---

## Final Core Idea

The app is a transparent desktop wrapper around a focused calculator workflow:

```text
User Input (HTML/JS)
-> Tauri Command IPC
-> Pure Rust Calculation Engine (percent-core)
-> Live Formula & Result Display
-> Optional Copy to System Clipboard
```

The important design decision was to avoid overbuilding on the UI side while making the desktop runtime and calculation engine as lean and reliable as possible.

In **v1.0–v1.1** the desktop shell used Electron. In **v2.0.0** the app was rebuilt on **Tauri v2 and Rust**: the UI stayed plain HTML/CSS/JS, the math moved into a pure Rust crate (`percent-core`), and the bundled Chromium/Node runtime was replaced by the system webview and a compiled Rust binary.

---

## Final Scope Definition

### Included in the Current Version (v2.2.0)

- Tauri v2 + Rust desktop app
- Windows native title bar
- offline local webview UI (`ui/`) with strict CSP (`connect-src 'none'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`, `frame-ancestors 'none'`) and zero unused Tauri capability permissions (`permissions: []`)
- seven percentage, pricing, and tax calculators implemented in Rust (`crates/percent-core`) with formatted input/paste sanitization (`$1,250.50`, `1,000`, `20%`), parenthesized negative formula previews (`(-50)`), unified range overflow guards, and error-state copy protection
- top quick-jump navigation bar (`change`, `% of total`, `portion`, `discount`, `original`, `markup & margin`, `tax / vat`, `history`) matching the Mobile & Web PWA
- `⇅ swap values` pill between the two input fields in every card
- hardened persistent local calculation history (up to 500 entries stored at `%APPDATA%\com.percentagecalculator.tool\history.json` with symlink checks, 1 MiB read cap, load-time validation, atomic unique `.json.tmp` commits, `YYYY-MM-DD HH:MM:SS` timestamps, calculator filter dropdown, `copy`, `↺ restore` with card highlight feedback, single-entry `×` delete via `history_delete`, and `clear history`)
- live formula previews
- copy-to-clipboard buttons with visible feedback (bounded 4 KiB IPC write)
- Clear All button
- redesigned in-app dark terminal About & Settings modals crediting **Mohamed Sayed · Ahmed Emara · DeepSeek · ChatGPT · Antigravity**, displaying the official Web App URL (`https://ciphervaults.github.io/Percentage-Calculator-Tool/`), and offering a persistent `checkUpdatesOnStartup` toggle (`settings.json` / `pct_tool_settings_v1`), manual update check against GitHub Releases, and top update banner with links
- Rust unit tests (including storage/validation and semver/release parsing tests) + 10,661-case golden parity suite against v1.1 JS math
- real-window Tauri smoke test (`--smoke-test`)
- Windows NSIS and MSI installer builds
- Windows standalone portable executable
- hardened standalone single-file Mobile & Web PWA HTML edition (`mobile/`) deployed at `https://ciphervaults.github.io/Percentage-Calculator-Tool/` for iPhone Safari (Add to Home Screen) and Android Chrome (Install app), protected by a SHA-256 hash CSP `<meta>` tag, scope-checked offline Service Worker (`pct-tool-v2.2.0-mobile-2`), and schema-validated `localStorage`
- SHA-pinned GitHub Actions CI/CD workflows for automated Windows builds, verification, `SHA256SUMS.txt` release checksums, and main-only GitHub Pages deployment
- project documentation modeled after the AI Ambassadors documentation structure

---

### Calculation Types

The current app supports:

- percentage change
- percentage of total
- percentage portion of a number
- discount final price and savings
- original value from a known percentage
- markup % and gross profit margin % from cost and selling price
- reverse tax / VAT (add tax to net or extract tax from gross total)

These are intentionally practical calculations rather than a full spreadsheet or financial system.

---

## What Is Not Included

The project intentionally does not include:

- user accounts
- cloud sync
- telemetry
- analytics
- external database servers (desktop stores a single local JSON history file in app data; mobile/web stores up to 500 entries locally in `localStorage`)
- runtime calculation network calls (optional update checks query only the public GitHub Releases API and can be disabled in Settings)
- silent binary auto-installation or background replacement (updates notify in-app with links to GitHub Releases)
- paid code signing
- custom Discord-style title bar
- complex theming system
- React or another frontend framework
- native iOS/Android App Store binaries (mobile support uses the self-contained HTML + offline PWA in `mobile/` rather than App Store wrappers)
- macOS or Linux release installers (the codebase is portable, but release packaging targets Windows and web/PWA)

These exclusions keep the app small, understandable, and aligned with its original utility purpose.

---

## Development Philosophy

This project follows the same general development philosophy as the referenced AI Ambassadors documentation:

- keep the system simple
- document the real work, not an idealized version
- make architecture easy to trace
- avoid fake complexity
- preserve the human-directed development story
- use Git commits as part of the project memory
- explain limitations honestly

The tool is small, but the documentation is intentionally serious because future understanding matters.

---

## Success Criteria

The project is considered successful if:

- the calculator works locally as a Tauri v2 desktop app
- the original five calculator sections preserve v1.1 behavior byte-for-byte, and the new Markup & Margin and Reverse Tax/VAT calculators use the same formatting rules
- input swapping, persistent local history, copy feedback, Clear All, and the dark About modal work reliably
- the app enforces strict defense-in-depth (least-privilege `permissions: []`, strict desktop and SHA-256 mobile CSPs, validated/atomic history persistence, and SHA-pinned CI with `SHA256SUMS.txt`)
- the Windows installer and portable builds are generated automatically in CI
- the documentation explains the project context and architecture clearly
- the Git history tells a readable project story

---

## Current Final State

At the **v2.2.0** stage, the project is:

- implemented as a Cargo workspace (`percent-core` + `src-tauri`) with a static `ui/` frontend and a hardened standalone `mobile/` PWA live at `https://ciphervaults.github.io/Percentage-Calculator-Tool/`
- tested with Rust unit tests, 10,661 golden parity cases (Rust & Mobile HTML), automated DOM/CSP verification, and an expanded live desktop smoke test
- packaged for Windows as NSIS, MSI, portable `.exe`, standalone Mobile HTML, and `SHA256SUMS.txt` via SHA-pinned GitHub Actions
- documented in a numbered `Documentation` folder
- preserved with the `v1.1.0-electron` tag pointing at the final Electron version, `v2.0.0` pointing at the initial Tauri rebuild, and `v2.1.0` marking the initial v2.1 feature and mobile PWA release
