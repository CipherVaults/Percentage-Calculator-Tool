# Percentage Calculator Tool Desktop & Mobile v2.1.1

**v2.1.1** hardens both the **Tauri v2 + Rust desktop app** and the **standalone Mobile & Web PWA** based on a full source security audit, and highlights the official offline Web App across desktop, mobile, and repository documentation.

- **Official Mobile & Web PWA (iPhone Safari & Android Chrome):** https://ciphervaults.github.io/Percentage-Calculator-Tool/

## Security & Hardening Improvements in v2.1.1

- **Desktop Tauri Shell & Rust I/O (`src-tauri/`):**
  - Tightened `capabilities/default.json` to an empty permission set (`permissions: []`) since all UI calls custom Rust commands via `invoke`, removing unused default and plugin permissions.
  - Expanded desktop Content Security Policy (`img-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`).
  - Hardened `history.json` storage in `src-tauri/src/commands.rs`: enforced symlink checks, a `1 MiB` read cap, shared schema validation on disk load matching `history_add`, unique atomic temp files (`create_new`, Unix `0o600` files / `0o700` dir), lock-held commit-on-success mutations, and a `4096`-byte `copy_text` limit.
  - Hardened `ui/main.js` with `Object.hasOwn` lookup guards, `textContent` updates, bounded input checks, IPC error recovery, and the official Web App URL & copy button in About.
- **Standalone Mobile & Web PWA (`mobile/`):**
  - Added strict `<meta http-equiv="Content-Security-Policy">` with exact SHA-256 hashes for inline `<style>` and `<script>`, `default-src 'none'`, `worker-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`, plus `<meta name="referrer" content="no-referrer">` (removing inline style mutations from the clipboard fallback).
  - Hardened `localStorage` parsing (`256`-char field bounds, plain-object and `mode`/`copyText` checks, clean empty state when storage is cleared, cross-tab `storage` listener, `Object.hasOwn` lookup guard).
  - Hardened Service Worker `mobile/sw.js` (`pct-tool-v2.1.1-mobile-1`) with registration scope-prefix checks and `!response.redirected`.
  - Added the official HTTPS PWA link inside the About and `file://` install modals.
- **CI/CD Supply-Chain & Release Integrity (`.github/workflows/`):**
  - Pinned all GitHub Actions in `build.yml` and `pages.yml` to immutable 40-character commit SHAs with `persist-credentials: false`.
  - Split unprivileged Windows build (`contents: read`) from `main`/tag-only release publishing (`contents: write`), enforced `--locked` Rust/Tauri builds, verified `mobile/index.html` 10k parity & CSP SHA-256 hashes before build and Pages deploy, enforced `refs/heads/main` on Pages deploy, and attached `SHA256SUMS.txt` alongside release assets.

## Downloads & Integrity Verification

| Package | File | Description |
| --- | --- | --- |
| **NSIS Setup Installer** | `Percentage.Calculator.Tool_2.1.1_x64-setup.exe` | Recommended standard Windows installer |
| **MSI Installer** | `Percentage.Calculator.Tool_2.1.1_x64_en-US.msi` | Windows Installer package |
| **Portable Executable** | `Percentage.Calculator.Tool.Portable.2.1.1.exe` | Single-file standalone Windows executable (requires WebView2 runtime, preinstalled on Windows 10/11) |
| **Standalone Mobile HTML** | `Percentage.Calculator.Tool.Mobile.2.1.1.html` | Single-file offline HTML utility (identical math across all 10,661 golden test cases) |
| **SHA-256 Checksums** | `SHA256SUMS.txt` | Verify downloaded installers and mobile HTML locally |

> **Windows SmartScreen Note:** Free open-source Windows binaries are unsigned (paid Authenticode code signing is not used). Verify your download against `SHA256SUMS.txt` in PowerShell with `Get-FileHash <file> -Algorithm SHA256`.
