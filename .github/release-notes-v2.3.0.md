# Percentage Calculator Tool Desktop & Mobile v2.3.0

**v2.3.0** adds Tip & Bill Split and a customizable card layout across the **Windows Desktop app** and **Mobile & Web PWA**, with extended **evaluation & CI coverage** while preserving 100% math parity across all 10,661 golden test cases.

- **Official Mobile & Web PWA (iPhone Safari & Android Chrome):** https://ciphervaults.github.io/Percentage-Calculator-Tool/

## What's New in v2.3.0

- **Tip & Bill Split (8th Calculator — Desktop & Mobile Parity):**
  - Calculates tip amount, total bill, and per-person split from Bill amount, Tip %, and a whole-number People split, with quick preset pills (`10%`, `15%`, `18%`, `20%`) and `swap values`.
  - Uses `calc_tip_split` in `percent-core` / `src-tauri` and `calcTipSplit` in `mobile/index.html` with 100% Desktop/Mobile parity and backward-compatible 3-field history (`inputC`, optional for existing 2-field calculators and required for `"tip"`).

- **Drag-Handle (`⠿`) Card Reordering & Card Collapsing (`[ − ]` / `[ + ]`):**
  - Pointer-based handle-only reordering persists `cardOrder` as an exact 8-card permutation, synced with `.quick-nav`; collapsible card bodies persist `collapsedCards` and auto-expand on quick-nav or History `↺ restore`.
  - Cross-tab `localStorage` sync on Mobile and fail-closed validation on `AppSettings` / `localStorage` preserve upgrades from legacy `{ checkUpdatesOnStartup }` settings.
  - Added **Reset Card Order & Expand All** in Settings (`#resetLayoutBtn`) and refreshed the Service Worker cache to `pct-tool-v2.3.0-mobile-1`.

- **Evaluation & CI Coverage:**
  - Extended `scripts/safety-eval.mjs` and CI checks for Tip & Bill Split and card layout validation while preserving all 10,661 golden test cases.

## Downloads & Integrity Verification

| Package | File | Description |
| --- | --- | --- |
| **NSIS Setup Installer** | `Percentage.Calculator.Tool_2.3.0_x64-setup.exe` | Recommended standard Windows installer |
| **MSI Installer** | `Percentage.Calculator.Tool_2.3.0_x64_en-US.msi` | Windows Installer package |
| **Portable Executable** | `Percentage.Calculator.Tool.Portable.2.3.0.exe` | Single-file standalone Windows executable (requires WebView2 runtime, preinstalled on Windows 10/11) |
| **Standalone Mobile HTML** | `Percentage.Calculator.Tool.Mobile.2.3.0.html` | Single-file offline HTML utility (identical math across all 10,661 golden test cases) |
| **SHA-256 Checksums** | `SHA256SUMS.txt` | Verify downloaded installers and mobile HTML locally |

> **Windows SmartScreen Note:** Free open-source Windows binaries are unsigned (paid Authenticode code signing is not used). Verify your download against `SHA256SUMS.txt` in PowerShell with `Get-FileHash <file> -Algorithm SHA256`.
