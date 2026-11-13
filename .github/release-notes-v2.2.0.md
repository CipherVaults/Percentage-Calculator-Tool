# Percentage Calculator Tool Desktop & Mobile v2.2.0

**v2.2.0** adds workflow polish across all 7 calculators, upgrades the persistent history tape with filtering and single-entry removal, and introduces an optional Settings-controlled GitHub Releases update checker for both the **Windows Desktop app** and **Mobile & Web PWA**.

- **Official Mobile & Web PWA (iPhone Safari & Android Chrome):** https://ciphervaults.github.io/Percentage-Calculator-Tool/

## What's New in v2.2.0

- **Calculator & Copy Polish (`ui/`, `mobile/`):**
  - **Formatted numeric paste & input:** Automatically strips spaces, commas, currency symbols (`$`, `€`, `£`, `¥`, etc.), and `%` when pasting or reading formatted numbers like `$1,250.50`, `1,000`, `20%`, or `+$1,000`.
  - **Parenthesized negative formulas:** Negative inputs display cleanly as `(-50)` inside live formula previews across all 7 calculators (including negative outputs in Tax and Markup sub-lines).
  - **Copy protection:** Card `copy` buttons now copy structured `copyText` across all 7 calculators and ignore placeholder (`"—"`) or error states instead of copying error messages into the clipboard/history.
  - **Unified range checks:** Consistent `"Value out of range"` handling on `Infinity` / overflow results across both Desktop (`percent-core` / IPC) and Mobile HTML without changing the 10,661 golden parity engine.

- **History Tape Upgrades (`src-tauri/`, `ui/`, `mobile/`):**
  - **Full timestamps:** Upgraded history timestamps from `HH:MM:SS` to local `YYYY-MM-DD HH:MM:SS`.
  - **Calculator filter:** Added a `#historyFilter` dropdown (`all calculators`, `percentage change`, `% of total`, `calculate %`, `discount`, `find original`, `markup & margin`, `tax / vat`) while keeping the header counter anchored to total saved entries `(N / 500)`.
  - **Single-entry delete (`×`):** Delete individual history rows via `history_delete` (Rust atomic `history.json` rewrite) and `deleteHistoryEntry` (Mobile `localStorage`).
  - **Restore highlight:** Clicking `↺ restore` smoothly scrolls to the target card and flashes a gold `.card-restored` highlight border.

- **Settings & Startup Update Checker (`src-tauri/`, `ui/`, `mobile/`):**
  - Added a `settings` button and dark-terminal **Settings** modal (`autoUpdateToggle` persisted locally in `%APPDATA%\com.percentagecalculator.tool\settings.json` on Desktop and `pct_tool_settings_v1` in `localStorage` on Mobile).
  - Automatic startup check against GitHub Releases is enabled by default and can be toggled off anytime for 100% offline launches; manual checks are available via `check for updates now`.
  - Desktop queries `api.github.com` safely from Rust via Windows `System32\curl.exe` and opens releases with `System32\rundll32.exe`, keeping the WebView CSP at `connect-src 'none'`. Mobile/PWA permits only `connect-src 'self' https://api.github.com;` while keeping strict SHA-256 CSP hashes and bumping Service Worker cache to `pct-tool-v2.2.0-mobile-1`.
  - When a newer release tag is published, an in-app update banner provides one-click **open release page**, **copy link**, and **dismiss** controls.

## Downloads & Integrity Verification

| Package | File | Description |
| --- | --- | --- |
| **NSIS Setup Installer** | `Percentage.Calculator.Tool_2.2.0_x64-setup.exe` | Recommended standard Windows installer |
| **MSI Installer** | `Percentage.Calculator.Tool_2.2.0_x64_en-US.msi` | Windows Installer package |
| **Portable Executable** | `Percentage.Calculator.Tool.Portable.2.2.0.exe` | Single-file standalone Windows executable (requires WebView2 runtime, preinstalled on Windows 10/11) |
| **Standalone Mobile HTML** | `Percentage.Calculator.Tool.Mobile.2.2.0.html` | Single-file offline HTML utility (identical math across all 10,661 golden test cases) |
| **SHA-256 Checksums** | `SHA256SUMS.txt` | Verify downloaded installers and mobile HTML locally |

> **Windows SmartScreen Note:** Free open-source Windows binaries are unsigned (paid Authenticode code signing is not used). Verify your download against `SHA256SUMS.txt` in PowerShell with `Get-FileHash <file> -Algorithm SHA256`.
