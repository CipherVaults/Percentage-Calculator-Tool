# Percentage Calculator Tool Desktop & Mobile v2.2.1

**v2.2.1** follows a full source security audit and evaluation harness review with targeted defense-in-depth hardening across the **Windows Desktop app**, **Mobile & Web PWA**, and **CI/CD release pipeline**, while preserving 100% math parity across all 10,661 golden test cases.

- **Official Mobile & Web PWA (iPhone Safari & Android Chrome):** https://ciphervaults.github.io/Percentage-Calculator-Tool/

## What's New in v2.2.1

- **Mobile & Web PWA Hardening (`mobile/sw.js`, `mobile/index.html`):**
  - **Service Worker cache integrity (`pct-tool-v2.2.1-mobile-1`):** Gated `handleNavigationFetch` caching of `./` and `./index.html` strictly on app-shell paths and `text/html` content types so in-scope non-HTML asset navigations cannot overwrite the offline fallback shell; decoupled Cache Storage writes from network fetch error handling so storage write errors never turn valid 200 asset responses into 503 Offline responses.
  - **Release URL & Update Fetch Hardening:** Added strict `https://github.com/CipherVaults/Percentage-Calculator-Tool/releases/` canonical URL validation (`<= 256` bytes, rejecting `..`, `\`, whitespace, and control chars), `response.redirected` / `api.github.com` response URL validation, `8000` ms `AbortController` timeout, `65536`-byte update payload limit, `4096`-byte `copyText` parity limit, single-line vs multi-line history control-character filtering, fail-closed settings reads, and storage-error rollback on `autoUpdateToggle`.

- **Desktop Shell & Rust Backend Hardening (`src-tauri/src/commands.rs`, `ui/main.js`):**
  - Added `#[serde(deny_unknown_fields)]` on `AppSettings`, `HistoryEntry`, and `NewHistoryEntry`.
  - Bounded serialized `history.json` writes at `HISTORY_MAX_FILE_BYTES` (1 MiB) before atomic swap, validated allowed `mode` values (`"add"`, `"extract"`, or `None`), rejected control chars across all single-line history fields while preserving `\n` in multi-line `copy_text`, and failed closed (`check_updates_on_startup: false`) on corrupt or unreadable `settings.json` while keeping missing files enabled by default.
  - Added `--proto-redir =https` to `curl.exe`, validated `SystemRoot` on Windows, normalized update error strings, enforced `MAX_COPY_LEN` (4096) in the `ui/main.js` clipboard fallback, cleared stale `lastValidCalc` entries before async `invoke()`, and guarded `lastPersistedSettings` updates with `settingsSeq`.

- **Release Pipeline Hardening (`.github/workflows/build.yml`, `.github/workflows/pages.yml`):**
  - Enforced tag-to-manifest equality (`TAG == v<tauri.conf.json version>`), cleaned `dist/` with exact versioned NSIS/MSI matching, removed tag force-moves (`force=true`) and release asset/checksum `--clobber` overwrites so published releases and `SHA256SUMS.txt` remain immutable, and upgraded CI CSP checks to inspect `style-src` and `script-src` directives individually.

## Downloads & Integrity Verification

| Package | File | Description |
| --- | --- | --- |
| **NSIS Setup Installer** | `Percentage.Calculator.Tool_2.2.1_x64-setup.exe` | Recommended standard Windows installer |
| **MSI Installer** | `Percentage.Calculator.Tool_2.2.1_x64_en-US.msi` | Windows Installer package |
| **Portable Executable** | `Percentage.Calculator.Tool.Portable.2.2.1.exe` | Single-file standalone Windows executable (requires WebView2 runtime, preinstalled on Windows 10/11) |
| **Standalone Mobile HTML** | `Percentage.Calculator.Tool.Mobile.2.2.1.html` | Single-file offline HTML utility (identical math across all 10,661 golden test cases) |
| **SHA-256 Checksums** | `SHA256SUMS.txt` | Verify downloaded installers and mobile HTML locally |

> **Windows SmartScreen Note:** Free open-source Windows binaries are unsigned (paid Authenticode code signing is not used). Verify your download against `SHA256SUMS.txt` in PowerShell with `Get-FileHash <file> -Algorithm SHA256`.
