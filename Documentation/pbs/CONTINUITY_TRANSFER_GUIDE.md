# Continuity Transfer Guide — Percentage Calculator Tool

**Application recovery baseline:** `f3ba3f4` (`f3ba3f487af86b1ecec6926a24386441c3abf4ca`), local tag `v2.2.0`, mobile cache `pct-tool-v2.2.0-mobile-2`. **Reconciled:** 2026-11-14, Africa/Cairo, coordinator integration on `handoff-local-dev` following `#23`–`#25` remediations (`b65739d`, `f03308a`, `ba4702e`) and `#30` `verifier-2` PASS.

Navigation: [PBS entrypoint](../../AGENTS.md) · [Current state](CURRENT_STATE.md) · [Continuation](CONTINUATION_STATE.md) · [Source ownership](SOURCE_OWNERSHIP_MAP.md) · [Session/decision archive](SESSION_AND_DECISION_ARCHIVE.md) · [Execution ledger](EXECUTION_AND_CODING_LEDGER.md) · [Security dossier](SECURITY_HARDENING_DOSSIER.md).

Legacy orientation: [README](../../README.md), [HANDOFF](../../HANDOFF.md), [Project context](../1-%20PROJECT_CONTEXT.md), [Architecture](../2-%20ARCHITECTURE.md), [Roadmap](../3-%20ROADMAP.md), [Session summary](../4-%20SESSION_SUMMARY.md). After initial drafts (`5c53eb4`, `93f6768`, `317e98f`) failed `#22`, workers remediated `#23`–`#25` (`b65739d`, `f03308a`, `ba4702e`), coordinator re-integrated all 10 files (`#29`), `verifier-2` (`#30`) returned **PASS**, and coordinator completed final reconciliation and verification (`E-08`) on `handoff-local-dev` for commit and Pull Request submission to `main`; owner PR acceptance and hosted Web UI settings verification remain pending.

**Authority boundary:** Covered by the owner's 2026-11-14 continuity authorization (`handoff-local-dev` commit + `origin/handoff-local-dev` PR -> `main`). Direct `main` pushes, release/tag edits, `--smoke-test`, product code changes, and private runtime data reads remain excluded. Backup, clone, install, fork, build, and optional smoke commands below are documented recovery procedures for future execution, not automatic side effects performed here.

## Scenario (A): AI thread lost or context compacted

### Cold-start reading sequence

1. Read [root AGENTS.md](../../AGENTS.md): effective project rules, authority routes, and file owners.
2. Read [CURRENT_STATE.md](CURRENT_STATE.md): accepted present, source revision, and evidence boundaries.
3. Read [CONTINUATION_STATE.md](CONTINUATION_STATE.md): exact unfinished/unaccepted work and first permitted action.
4. Read [SOURCE_OWNERSHIP_MAP.md](SOURCE_OWNERSHIP_MAP.md): locate the owner of the question before changing anything.
5. Read only the relevant chronology/symbol/evidence sections of the [ledger](EXECUTION_AND_CODING_LEDGER.md), the relevant [dossier](SECURITY_HARDENING_DOSSIER.md) control, and session/decision history when its rationale matters.

Source code and current effective instructions resolve behavior/authority questions. Legacy session prose preserves what its author reported at that time. For example, the old session's missing GitHub CLI is not a current host fact; HANDOFF's `settings_get`, `settings_set`, and `check_for_update` are typos relative to current `get_settings`, `set_settings`, and `check_for_updates`. Its shortcut and 0% denominator-hint claims are unsupported by current controllers. Do not implement or replay those claims simply because a lost thread mentioned them.

### Non-destructive reconciliation from repository root

```powershell
git status --short
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect working-tree status.' }
git branch --show-current
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect the current branch.' }
git rev-parse HEAD
if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve current HEAD.' }
git log -n 10 --oneline
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect recent history.' }
git tag -l
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect tags.' }
git for-each-ref --format='%(refname:short) %(objecttype) %(objectname:short) %(*objectname:short)' refs/tags
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect tag targets.' }
git diff --stat
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect the current diff.' }
```

Preserve unexpected edits and identify their owner. Do not reset, clean, checkout over, or stage another worker's output. Compare the actual branch/commit with the received records before trusting a remembered checkpoint. The baseline local tag targets are `v1.1.0` → `646fb6f`, `v1.1.0-electron` → `6afa7fb`, `v2.0.0` → `7f66f93`, `v2.1.0` → `f59035d`, `v2.1.1` → `ccd6ee8`, and `v2.2.0` → `f3ba3f4`. The first three are annotated tags: a tag object's SHA differs from its peeled commit. A newer incoming baseline must be reconciled, not silently forced back to this document.

Run the verification suite below if it is applicable to the authorized continuation. Tests/lints/format checks preserve application source but can generate ignored Cargo/schema output and temporary test files. They are not a reason to redo completed Electron migration, feature phases, merged handoff PRs, or release operations. A local remote-tracking ref is last-known Git state, not proof that GitHub currently serves it.

### Three Truths and durable state

| PBS question | Required recovery record |
| --- | --- |
| Permission: may this executor do it? | Current owner instruction, scope, amendments, assigned files, and explicit exclusions. A handoff or proposed plan does not expand authority. |
| Observation: what happened? | Actual artifact revision, command/entry route, result, environment, and limits. Separate fresh checks, historical reports, failed attempts, and unknowns. |
| Acceptance: does it meet the requirement? | Named reviewer/owner decision tied to the requirement and applicable evidence; product/integration/publication acceptance is not implied by a worker return. |

Classify surviving work as accepted, complete but unreconciled, implemented but unverified, partial, or unknown. Continue the first authorized unfinished action after reconciling the artifact. For changed inputs, reassess evidence applicability without erasing the earlier result.

| Operation | Readback | Save | Publish |
| --- | --- | --- | --- |
| Desktop history/settings | IPC reads managed memory; disk/restart readback is a distinct check. | Candidate JSON must persist before Rust shared state commits. UI error suppression means a visible toggle/row is insufficient proof. | Local JSON is not published or cloud-synced by this app. |
| Mobile history/settings | Inspect same-origin storage or reload under the same profile/origin. | Writes may fail and fall back to memory; confirm storage readback/reload if durability is the criterion. | `localStorage` and PWA caches are device-local, not Releases/Pages state. |
| Documentation/backup | Read destination content, Git refs, or checksum results. | File write/copy completion is local save only. | Sending/sharing/uploading is a separately authorized step; checksum match alone is not a recovery test. |
| GitHub Releases / Pages | Inspect resolved release tag/run/artifacts or deployed HTML/worker. | Local staging, a bundle, or workflow files are preparation. | Requires an actual external operation and destination receipt. No such operation was done by this audit. |

For a bounded worker, always carry: identity/revision and recipient; one outcome and definition of completion; governing approval; permitted read/write scopes; protected interfaces/other owners; source baseline and checkpoint; accepted versus unaccepted work; input/output contract; baseline/conflict response; required evidence and partial-work return; first action and stop/escalation conditions; integrating owner and acceptance destination. The populated contract at the end follows the inspected PBS `handoff-and-worker-contract.md` structure.

## Scenario (B): GitHub lost or offline backup recovery

### Prepare a portable source backup

Execute only in an authorized backup session, from the intended repository root. The following creates a new dated directory under the user's Documents folder. Change the chosen parent to an authorized external/offline medium if desired, then read it back. Names below are generated backup destinations, not claims that these files already exist.

```powershell
$workingChanges = @(git status --porcelain=v1 --untracked-files=all)
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect working-tree status; backup aborted.' }
if ($workingChanges.Count -ne 0) {
    $workingChanges | Write-Output
    throw 'Uncommitted or untracked changes would be omitted; reconcile and commit the intended source before backup.'
}
$backupHead = git rev-parse HEAD
if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve backup HEAD.' }
if ([string]::IsNullOrWhiteSpace($backupHead)) { throw 'Backup HEAD is empty.' }
Write-Output "Backing up committed HEAD: $backupHead"
$requiredPaths = @(
    'AGENTS.md'
    'Documentation/pbs/SOURCE_OWNERSHIP_MAP.md'
    'Documentation/pbs/CURRENT_STATE.md'
    'Documentation/pbs/CONTINUATION_STATE.md'
    'Documentation/pbs/EXECUTION_AND_CODING_LEDGER.md'
    'Documentation/pbs/SECURITY_HARDENING_DOSSIER.md'
    'Documentation/pbs/CONTINUITY_TRANSFER_GUIDE.md'
    'Documentation/pbs/SESSION_AND_DECISION_ARCHIVE.md'
)
foreach ($reqPath in $requiredPaths) {
    git cat-file -e "HEAD:$reqPath"
    if ($LASTEXITCODE -ne 0) { throw "Required committed PBS file missing from HEAD: $reqPath" }
}
$backupRoot = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Percentage-Calculator-Tool-Backup-2026-11-14'
if (Test-Path -LiteralPath $backupRoot) { throw 'Backup destination already exists; choose a new directory.' }
New-Item -ItemType Directory -Path $backupRoot -ErrorAction Stop | Out-Null
$bundlePath = Join-Path $backupRoot 'Percentage-Calculator-Tool-full-history.bundle'
$archivePath = Join-Path $backupRoot 'Percentage-Calculator-Tool-tracked-source.zip'
git bundle create "$bundlePath" --all
if ($LASTEXITCODE -ne 0) { throw 'Git bundle creation failed.' }
git bundle verify "$bundlePath"
if ($LASTEXITCODE -ne 0) { throw 'Git bundle verification failed.' }
git bundle list-heads "$bundlePath"
if ($LASTEXITCODE -ne 0) { throw 'Cannot list bundled refs.' }
git archive --format=zip --output="$archivePath" HEAD
if ($LASTEXITCODE -ne 0) { throw 'Tracked-source archive failed.' }
$checksumLines = foreach ($artifact in @($bundlePath, $archivePath)) {
    $digest = (Get-FileHash -LiteralPath $artifact -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant()
    '{0}  {1}' -f $digest, [IO.Path]::GetFileName($artifact)
}
$checksumPath = Join-Path $backupRoot 'SHA256SUMS.txt'
[IO.File]::WriteAllLines($checksumPath, [string[]]$checksumLines, [Text.UTF8Encoding]::new($false))
Get-Content -LiteralPath $checksumPath -ErrorAction Stop
```

`--all` packages reachable history and local refs, including tags and available remote-tracking refs. It does not recover branches never fetched, unreachable objects, GitHub issues/PR discussions/Actions logs/releases/settings, private chat history, or working-tree changes. `git archive HEAD` contains tracked committed source only, without `.git`, build caches, or ordinary untracked runtime files. **The script aborts before creating the backup directory if status fails or any staged, unstaged, or untracked change exists, and requires AGENTS plus all seven PBS Markdown files in committed HEAD.** An uncommitted PBS assembly must therefore be reconciled and committed under its own authority before backup. Unmerged share-branch commits not yet integrated into the target branch are absent from that branch's archive; a bundle includes them only if their refs are available and selected (`--all` includes available share-branch refs). A target-only clone cannot preserve worker commits whose refs it lacks. Confirm post-remediation coordinator integration and commit before backing up the combined PBS record set; preserve any missing work separately under applicable authority and record the gap.

Inspect every included ref/history for private material before sharing a full bundle: `.gitignore` does not erase historical secrets. Do not substitute a recursive copy of the entire working directory for the tracked archive. Store a second independent copy on offline media; a file saved beside the only source is not disaster recovery. Record actual source SHA, listed refs, checksum file, media location, and copy/readback result in the owner's backup record. No backup was created by this documentation task.

### Verify copied media and restore locally

This procedure asks for existing bundle/checksum files and a new destination. The prompts are runtime inputs, not document placeholders. Read the destination displayed before cloning; it must be absent.

```powershell
$bundlePath = (Resolve-Path -LiteralPath (Read-Host 'Full path to the received .bundle') -ErrorAction Stop).Path
$checksumPath = (Resolve-Path -LiteralPath (Read-Host 'Full path to its SHA256SUMS.txt') -ErrorAction Stop).Path
$backupDir = Split-Path -Parent $checksumPath
foreach ($line in Get-Content -LiteralPath $checksumPath -ErrorAction Stop) {
    if ($line -notmatch '^([0-9a-fA-F]{64})  ([^\\/]+)$') { throw 'Invalid checksum line.' }
    $expected = $Matches[1]
    $candidate = Join-Path $backupDir $Matches[2]
    $actual = (Get-FileHash -LiteralPath $candidate -Algorithm SHA256 -ErrorAction Stop).Hash
    if ($actual -ne $expected) { throw "Checksum mismatch: $candidate" }
}
$bundleName = [IO.Path]::GetFileName($bundlePath)
$bundleHash = (Get-FileHash -LiteralPath $bundlePath -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant()
if (-not ((Get-Content -LiteralPath $checksumPath -ErrorAction Stop) -contains "$bundleHash  $bundleName")) {
    throw 'Selected bundle does not match the checksum manifest.'
}
$restoreInput = Read-Host 'New full path for the restored working repository'
if ([string]::IsNullOrWhiteSpace($restoreInput)) { throw 'Restore destination is required.' }
$restoreDir = [IO.Path]::GetFullPath($restoreInput)
if (Test-Path -LiteralPath $restoreDir) { throw 'Restore destination already exists.' }
Write-Output $restoreDir
# bundle verify requires a repository; use a fresh empty bare repository even on a new machine.
$verificationDir = Join-Path ([IO.Path]::GetTempPath()) ('pct-bundle-check-' + [guid]::NewGuid().ToString('N'))
git init --bare "$verificationDir"
if ($LASTEXITCODE -ne 0) { throw 'Cannot create isolated bundle-verification repository.' }
Set-Location -LiteralPath $verificationDir -ErrorAction Stop
git bundle verify "$bundlePath"
if ($LASTEXITCODE -ne 0) { throw 'Received bundle verification failed.' }
$heads = @(git bundle list-heads "$bundlePath")
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect bundled refs.' }
$heads | Write-Output
$branches = @($heads | ForEach-Object {
    if ($_ -match '^[0-9a-fA-F]+ refs/heads/(.+)$') { $Matches[1] }
})
if ($branches.Count -eq 0) { throw 'Bundle contains no local branch refs to restore.' }
Write-Output 'Available backed-up branches:'
$branches | Write-Output
$targetBranch = Read-Host 'Exact backed-up branch name to restore (without refs/heads/)'
if ([string]::IsNullOrWhiteSpace($targetBranch)) { throw 'A backed-up branch must be selected.' }
$targetBranch = $targetBranch.Trim()
if ($branches -cnotcontains $targetBranch) { throw 'Selected branch is not present in the bundle.' }
$targetRef = "refs/heads/$targetBranch"
$selectedHead = @($heads | Where-Object { ($_ -split '\s+', 2)[1] -ceq $targetRef } |
    ForEach-Object { ($_ -split '\s+', 2)[0] })
if ($selectedHead.Count -ne 1) { throw 'Selected branch does not have one unambiguous bundled HEAD.' }
git clone -b "$targetBranch" "$bundlePath" "$restoreDir"
if ($LASTEXITCODE -ne 0) { throw 'Bundle clone failed.' }
Set-Location -LiteralPath $restoreDir -ErrorAction Stop
git bundle verify "$bundlePath"
if ($LASTEXITCODE -ne 0) { throw 'Restored-repository bundle verification failed.' }
$restoredChanges = @(git status --porcelain=v1 --untracked-files=all)
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect restored working-tree status.' }
if ($restoredChanges.Count -ne 0) {
    $restoredChanges | Write-Output
    throw 'Restored working tree is not clean.'
}
git branch --all
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect restored branches.' }
git tag -l
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect restored tags.' }
git log -n 10 --oneline
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect restored history.' }
$restoredHead = git rev-parse --verify 'HEAD^{commit}'
if ($LASTEXITCODE -ne 0) { throw 'Restored HEAD does not resolve to a commit.' }
if ([string]::IsNullOrWhiteSpace($restoredHead)) { throw 'Restored HEAD is empty.' }
if ($restoredHead -ne $selectedHead[0]) { throw 'Restored HEAD differs from the selected bundled branch.' }
Write-Output "Restored HEAD: $restoredHead"
git rev-parse 'v2.2.0^{commit}'
if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve the preserved v2.2.0 baseline tag.' }
$requiredPaths = @(
    'AGENTS.md'
    'Documentation/pbs/SOURCE_OWNERSHIP_MAP.md'
    'Documentation/pbs/CURRENT_STATE.md'
    'Documentation/pbs/CONTINUATION_STATE.md'
    'Documentation/pbs/EXECUTION_AND_CODING_LEDGER.md'
    'Documentation/pbs/SECURITY_HARDENING_DOSSIER.md'
    'Documentation/pbs/CONTINUITY_TRANSFER_GUIDE.md'
    'Documentation/pbs/SESSION_AND_DECISION_ARCHIVE.md'
)
foreach ($reqPath in $requiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $restoreDir $reqPath) -PathType Leaf)) {
        throw "Required restored PBS file missing: $reqPath"
    }
}
```

Choose the actual backed-up branch from `git bundle list-heads`, then compare its SHA with the producer's record. A bundle captured after committing PBS on `handoff-local-dev` carries that branch ahead of `f3ba3f4`, while `main` / `v2.2.0` may remain at `f3ba3f4` until PR merge. Cloning `main` would then restore application source without the newer PBS package. The snippet requires a clean, resolved HEAD equal to the selected bundled branch and all eight continuity files. A pre-PBS baseline archive cannot satisfy this package-recovery check. The temporary empty bare repository allows pre-clone verification without an existing checkout and cannot supply missing prerequisite history; its path is retained in `$verificationDir`. The restored `origin` initially points to the bundle, not live GitHub. No forced branch/tag movement or mirror push is needed.

### Rebuild and run while offline

Source history is sufficient to recover **source**, not all build inputs. Before losing network access, separately provision Rust/MSVC, the CLI, Cargo registry/git caches for locked dependencies, WebView2, and Tauri NSIS/MSI/bootstrapper tooling. Preserve them privately under their tool-specific installation/cache procedures. A full offline build was not attempted here; no vendor directory is supplied by this repository.

With prerequisites and caches already available, from restored root:

```powershell
$previousCargoOffline = $env:CARGO_NET_OFFLINE
try {
    $env:CARGO_NET_OFFLINE = 'true'
    cargo test --workspace --locked
    if ($LASTEXITCODE -ne 0) { throw 'Offline workspace tests failed; inspect missing dependency/tool output.' }
    cargo tauri build -- --locked
    if ($LASTEXITCODE -ne 0) { throw 'Offline Tauri build failed; inspect bundler/runtime cache prerequisites.' }
} finally {
    if ($null -eq $previousCargoOffline) { Remove-Item Env:CARGO_NET_OFFLINE -ErrorAction SilentlyContinue }
    else { $env:CARGO_NET_OFFLINE = $previousCargoOffline }
}
```

`cargo tauri build` is the desktop packaging command; forwarding `--locked` matches CI. Cargo offline mode prevents dependency fetches, but external bundler/bootstrapper tools may separately require network resources. Missing cache/tool errors are real prerequisites, not grounds to remove `--locked`. For local desktop development use `cargo tauri dev`; after a release build run `& '.\target\release\percentage-calculator-tool.exe'` for normal UI. That normal launch can create app data and attempt the default update check, so it is not a read-only audit action.

| Offline function | Expected source behavior / limitation |
| --- | --- |
| Desktop calculations, formulas, history/settings, normal clipboard copy | Local Rust, UI, JSON, and OS clipboard; work without GitHub when runtime/build prerequisites exist. Storage permissions and clipboard availability remain local prerequisites. |
| Desktop update check | Curl/network failure becomes an `UpdateCheckResult` with `ok: false` and error text; startup UI suppresses failure, manual checks display it. No binary replacement occurs. Disable startup checking in Settings for offline launches; confirm durable save if required. |
| Mobile standalone file | Open `mobile/index.html` directly for local calculations and history/settings via `localStorage` where browser policy permits; restricted storage falls back to memory. File-origin persistence is browser-dependent. Clipboard uses a fallback where allowed. |
| PWA install/offline cache | `file://` does not register a service worker. Use HTTPS or localhost HTTP for `sw.js`/manifest and retain the whole `mobile/` asset tree. A previously cached installed PWA can run offline if its cache survives. |
| Mobile update check | Manual network failure reports offline/blocked; startup failure is silent. A service-worker cache does not cache the cross-origin GitHub API. |

For a local HTTP PWA test, run one of these from repository root, then open `http://127.0.0.1:8080/`. These are future interactive server commands, not servers started by this audit:

```powershell
# Option 1: requires Python installed and available on PATH.
python -m http.server 8080 --bind 127.0.0.1 --directory mobile

# Option 2: requires Node/npm and the serve package already available/cached when offline.
npx serve mobile --listen tcp://127.0.0.1:8080
```

Use one server at a time and stop it with Ctrl+C. Python was **not** available on this host's PATH during the audit; the Node server/package was not exercised or provisioned. A new origin/port/profile has separate `localStorage`; this is not a migration failure. Plain HTTP on a remote LAN address is not the localhost secure-context route used by this page's registration guard.

## Scenario (C): transfer to a friend for continued development

### Windows prerequisites and observed host tools

Verify these on the recipient's machine; installation is a separate authorized setup step:

- Visual Studio Build Tools with **Desktop development with C++** and a Windows 10/11 SDK, as specified by the inspected legacy local-Windows guide. Use PowerShell/Windows Terminal so a Git Bash Unix `link` executable does not shadow the MSVC linker.
- Microsoft Edge WebView2 Runtime. Do not assume every Windows image has it. NSIS embeds a bootstrapper; an offline machine without the runtime still needs a separately provisioned runtime.
- Rustup stable MSVC toolchain, Cargo, Clippy, and Rustfmt. Rust packages use edition 2021; CI selects stable rather than pinning one Rust release.
- Tauri CLI **2.12.4**, exactly the CI version: `cargo install tauri-cli --version 2.12.4 --locked` (CI spells the exact requirement `"=2.12.4"`).
- Node.js LTS for the standalone Node parity/CSP gate. No npm frontend build or runtime dependency exists in the current manifests/tree.
- Git for Windows. Inspect `git config --get core.autocrlf`; a fresh recipient checkout may set `git config core.autocrlf false` locally to avoid editor/tool CRLF surprises. Keep repository `.gitattributes` authoritative. This audit did not change Git configuration.
- GitHub CLI `gh` for fork/PR/release administration when separately authorized; it is unnecessary for core offline math.

```powershell
rustup default stable
rustup component add rustfmt clippy
cargo install tauri-cli --version 2.12.4 --locked
rustc --version
cargo --version
cargo clippy --version
cargo fmt --version
cargo tauri --version
node --version
git --version
gh --version
git config --get core.autocrlf
```

Directly observed on the documentation host on 2026-11-14: `rustc 1.99.1`, `cargo 1.99.1`, `clippy 0.1.99`, `rustfmt 1.10.0-stable`, `tauri-cli 2.12.4`, Node `v24.22.1`, Git `2.55.0.windows.5`, `gh 2.103.0`, and `core.autocrlf=true`. Formatting, hashes, and tests passed with the existing LF attributes. These are observations, not a newly pinned supported-version matrix. MSVC/SDK/WebView2 installation versions were not inventoried; compilation success alone does not verify a GUI runtime launch.

### Choose a source transfer route and reconcile remotes

A working clone for development (network required) is distinct from a bare mirror for preservation:

```powershell
# Run from a parent directory where the destination does not already exist.
git clone https://github.com/CipherVaults/Percentage-Calculator-Tool.git Percentage-Calculator-Tool
if ($LASTEXITCODE -ne 0) { throw 'Source clone failed.' }
Set-Location -LiteralPath Percentage-Calculator-Tool -ErrorAction Stop
git remote -v
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect cloned remotes.' }
git status --short
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect cloned working-tree status.' }
git log -n 10 --oneline
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect cloned history.' }
```

For a GitHub fork, the friend's account should perform the following only when creation is authorized. This changes remote GitHub state. Do not run it during documentation verification:

```powershell
gh repo fork CipherVaults/Percentage-Calculator-Tool --clone
if ($LASTEXITCODE -ne 0) { throw 'GitHub fork/clone failed; inspect remote state before retrying.' }
```

Inspect `git remote -v` afterward: CLI fork behavior can configure the fork as `origin` and the original as `upstream`; do not assume the intended push target. For an already restored/cloned working repository whose owner has supplied its new destination, use an explicit runtime input:

```powershell
$repoTop = git rev-parse --show-toplevel
if ($LASTEXITCODE -ne 0) { throw 'Cannot locate a working repository; origin was not changed.' }
if ([string]::IsNullOrWhiteSpace($repoTop)) { throw 'Repository root is empty; origin was not changed.' }
Write-Output "Repository whose origin will change: $repoTop"
$newOrigin = Read-Host 'Authorized destination Git clone URL for this working repository'
if ([string]::IsNullOrWhiteSpace($newOrigin)) { throw 'An authorized origin URL is required.' }
$newOrigin = $newOrigin.Trim()
git remote set-url origin "$newOrigin"
if ($LASTEXITCODE -ne 0) { throw 'Changing origin failed.' }
git remote -v
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect remotes after changing origin.' }
```

For a separate full-ref preservation mirror, run from a suitable parent directory and choose a new destination:

```powershell
git clone --mirror https://github.com/CipherVaults/Percentage-Calculator-Tool.git Percentage-Calculator-Tool.git
if ($LASTEXITCODE -ne 0) { throw 'Preservation mirror clone failed.' }
```

A mirror has no working tree and may contain refs beyond the normal main branch. Do not use a mirror push as a routine fork/development operation; publishing/replacing remote refs is outside this guide's executed scope. Git bundles can also transfer available full history without GitHub. Neither route carries GitHub Releases assets, Pages configuration, repository rules, account credentials, or chat sessions.

**Moving under a new owner is also an application configuration change.** Audit/update `GITHUB_LATEST_RELEASE_API`, `GITHUB_RELEASES_URL`, and `GITHUB_RELEASES_PREFIX` in `src-tauri/src/commands.rs`; desktop `WEB_APP_URL` / `RELEASE_URL` in `ui/main.js`; mobile API/release/PWA constants, repository URL-prefix checks, visible links, and install text in `mobile/index.html`; and public documentation links. Do not merely change `origin` and leave update notices pointing to the old publisher. Recompute mobile hashes, bump the worker cache, re-test, and configure the new Pages base path/domain and GitHub settings before claiming transfer publication complete. The current canonical remote is `https://github.com/CipherVaults/Percentage-Calculator-Tool.git`; the current PWA URL in source is `https://ciphervaults.github.io/Percentage-Calculator-Tool/`.

### Exact verification suite

From the intended working repository root:

```powershell
cargo test --workspace --locked
if ($LASTEXITCODE -ne 0) { throw 'Workspace tests failed.' }
cargo clippy --workspace --all-targets --locked -- -D warnings
if ($LASTEXITCODE -ne 0) { throw 'Workspace Clippy failed.' }
cargo fmt --check
if ($LASTEXITCODE -ne 0) { throw 'Formatting failed.' }
```

The following PowerShell here-string runs the CI-equivalent extraction/comparisons, CSP and sink gates without writing a helper file. It additionally checks LF and runtime style mutations. The same procedure was executed on the baseline; it passed all 10,661 cases. Markup/Margin and Tax are not in that historical fixture and have separate Rust unit tests.

```powershell
@'
const fs = require("fs"), vm = require("vm"), crypto = require("crypto"), assert = require("assert");
const html = fs.readFileSync("mobile/index.html", "utf8");
for (const p of ["mobile/index.html", "mobile/sw.js"]) {
  assert(!fs.readFileSync(p).includes(13), "CR byte found in " + p);
}
const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
assert(styleMatch && scriptMatch, "Missing inline blocks");
const style = styleMatch[1], script = scriptMatch[1];
const cspMatch = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i);
assert(cspMatch, "Missing CSP");
const csp = cspMatch[1];
const styleHash = crypto.createHash("sha256").update(style, "utf8").digest("base64");
const scriptHash = crypto.createHash("sha256").update(script, "utf8").digest("base64");
assert(csp.includes("'sha256-" + styleHash + "'"), "Style hash mismatch");
assert(csp.includes("'sha256-" + scriptHash + "'"), "Script hash mismatch");
assert(!/frame-ancestors/i.test(csp), "frame-ancestors is invalid in meta CSP");
for (const src of [fs.readFileSync("ui/main.js", "utf8"), script, fs.readFileSync("mobile/sw.js", "utf8")]) {
  assert(!/\.innerHTML\b|\.outerHTML\b|\beval\s*\(|\bnew\s+Function\b/.test(src), "Forbidden sink");
}
assert(!/\.style\s*(?:\.|\[|=)/.test(script), "Runtime style mutation");
const fnStart = script.indexOf("function formatDecimal");
const fnEnd = script.indexOf("// --- Persistent on-device history");
assert(fnStart !== -1 && fnEnd > fnStart, "Math boundaries missing");
const ctx = { Number, Math };
vm.runInNewContext(script.slice(fnStart, fnEnd), ctx);
const pNum = s => s === "NaN" ? NaN : s === "Infinity" ? Infinity : s === "-Infinity" ? -Infinity : Number(s);
const cases = JSON.parse(fs.readFileSync("crates/percent-core/tests/fixtures/golden.json", "utf8"));
const counts = {};
for (const c of cases) {
  counts[c.f] = (counts[c.f] || 0) + 1;
  if (c.f === "formatDecimal") assert.strictEqual(ctx.formatDecimal(pNum(c.a[0])), c.r);
  else if (c.f === "discount") {
    const act = ctx.calcDiscount(pNum(c.a[0]), pNum(c.a[1]));
    assert.strictEqual(act.label, c.r.label);
    assert.strictEqual(act.copyText, c.r.copyText);
  } else {
    const a = pNum(c.a[0]), b = pNum(c.a[1]);
    const act = c.f === "percentageChange" ? ctx.calcChange(a,b)
      : c.f === "percentageOfTotal" ? ctx.calcPercentOfTotal(a,b)
      : c.f === "percentagePortion" ? ctx.calcPortion(a,b) : ctx.calcOriginal(a,b);
    if (c.r.ok) { assert.strictEqual(act.ok,"true"); assert.strictEqual(act.label,c.r.label); }
    else { assert.strictEqual(act.ok,"false"); assert.strictEqual(act.error,c.r.error); }
  }
}
console.log("ALL_MOBILE_CHECKS_OK (" + cases.length + " cases)");
console.log(JSON.stringify(counts));
console.log("style-src sha256-" + styleHash);
console.log("script-src sha256-" + scriptHash);
'@ | node
if ($LASTEXITCODE -ne 0) { throw 'Mobile parity/CSP/sink checks failed.' }
```

In a separately authorized packaging session, follow with:

```powershell
cargo tauri build -- --locked
if ($LASTEXITCODE -ne 0) { throw 'Windows packaging failed.' }
```

Expected output locations derive from config, CI, and legacy build instructions: `target/release/percentage-calculator-tool.exe`, `target/release/bundle/nsis/` setup executable(s), and `target/release/bundle/msi/` MSI file(s). They were not freshly built/read back in this audit. Validate actual output names/content before distributing, and compute hashes of the actual delivered bytes.

Optional real-window verification **overwrites the real OS clipboard** with `percentage-tool-smoke-test`. Run only when that side effect is within the active instruction; history/settings mutations remain in memory:

```powershell
$p = Start-Process -FilePath '.\target\release\percentage-calculator-tool.exe' -ArgumentList '--smoke-test' -Wait -PassThru -WindowStyle Hidden
if ($p.ExitCode -ne 0) { throw "Real-window smoke test failed with exit code $($p.ExitCode)." }
```

`src-tauri/src/main.rs:2` selects `windows_subsystem = "windows"` for release builds. PowerShell direct invocation of this GUI binary may return without waiting or setting `$LASTEXITCODE` reliably; `Start-Process -Wait -PassThru` waits and exposes the process's actual `ExitCode`. The backend success marker is `SMOKE_TEST_OK: all renderer, IPC, and clipboard checks passed.` This is the source's expected marker, not a fresh receipt from this documentation audit. A complete transfer acceptance additionally needs actual desktop launch/install, clipboard, history/settings durability, mobile browser/install/offline/upgrade checks, and owner review where those are required. Capture the run's commit, platform, actual result, and limitations.

### Critical gotchas

**Inline CSP hashes and LF bytes.** After any inline CSS/JS edit in `mobile/index.html`, recompute both base64 SHA-256 digests over the exact text between the tags. The following read-only PowerShell/.NET snippet does not normalize newlines or rewrite HTML:

```powershell
$mobilePath = (Resolve-Path -LiteralPath 'mobile/index.html').Path
$html = [IO.File]::ReadAllText($mobilePath, [Text.Encoding]::UTF8)
if ($html.Contains("`r`n")) { throw 'CRLF detected; restore LF before computing CSP hashes.' }
$sha256 = [Security.Cryptography.SHA256]::Create()
try {
    foreach ($block in @('style', 'script')) {
        $match = [regex]::Match($html, '<' + $block + '>([\s\S]*?)</' + $block + '>')
        if (-not $match.Success) { throw "Missing inline $block block." }
        $bytes = [Text.Encoding]::UTF8.GetBytes($match.Groups[1].Value)
        $digest = [Convert]::ToBase64String($sha256.ComputeHash($bytes))
        "${block}-src 'sha256-$digest'"
    }
} finally { $sha256.Dispose() }
```

At this baseline it yields `style-src 'sha256-HppoWhfVX+UyR2KqXbS6U2Q3KafIo1MVyti/h94cX9o='` and `script-src 'sha256-655QfOPjmPDnhT1lUo4K5UBkQqBy3BB3EYZt7mnAKdg='`. Replace the corresponding CSP values after an authorized edit, then rerun the full Node gate. Preserve [`.gitattributes`](../../.gitattributes): LF applies to mobile HTML/JS/webmanifest and UI HTML/CSS/JS. Formatting tools and PowerShell's default text encoding/newline behavior can change hashed bytes.

**One lockfile.** The tracked lockfile is root `Cargo.lock`. Do not reintroduce `crates/percent-core/Cargo.lock` or edit locks merely to make CI green; `--locked` is intentional. Dependency updates need a scoped implementation/review and resulting lock change, not an exception hidden in a recovery attempt.

**Cache generation.** Change `CACHE_NAME` in `mobile/sw.js` to a new `pct-tool-...` generation whenever changing precached mobile assets; current value is `pct-tool-v2.2.0-mobile-2`. Preserve all seven precache URLs or deliberately update the list, and test upgrade/offline paths. `APP_VERSION` alone does not invalidate an existing worker cache. A mobile script edit also requires a CSP hash change; a worker-only edit does not change the inline script digest unless page code changes too.

**Signing.** This repository has no inspected Windows signing configuration; legacy release notes describe unsigned installers. Expect possible SmartScreen warnings for a new publisher. Checksums verify byte identity against the manifest; they do not create an Authenticode signature or guarantee publisher trust. Signing credentials must remain outside source/transfer bundles.

### Privacy and pre-transfer checklist

- Keep `%APPDATA%\com.percentagecalculator.tool\history.json` and `%APPDATA%\com.percentagecalculator.tool\settings.json` on the maintainer's machine unless the user explicitly authorizes private data transfer. They are not source artifacts.
- Do not export browser `localStorage` keys `pct_tool_history_v2` / `pct_tool_settings_v1`, profile directories, or installed PWA caches as project source. A friend's browser begins with independent local state.
- Exclude `gh` authentication, PAT/OAuth tokens, credential-helper stores, signing keys, and environment secrets. The friend signs in to their own account; do not pass maintainer tokens.
- Exclude `target/`, generated `src-tauri/gen/`, local scratch files, logs, and ordinary build-output folders from the source archive. Preserve required offline tool caches privately as a separate provision, not as public repository content.
- Review tracked content and **all reachable bundle history** for accidental private material. The current ignore file covers build/schema/legacy Node outputs, logs, `.env*`, `*.pem`, and `*.key`; ignores are not historical redaction.
- Verify checksums after copying; restore into a new directory and run applicable checks before calling the backup recoverable. Record “prepared,” “saved,” “delivered,” “recipient acknowledged/access checked,” and “accepted” independently.
- Agree who owns the fork/remote, update endpoints, Pages URL, GitHub rules, and final acceptance. Do not label the transfer published simply because a local archive exists.

## Populated PBS Handoff & Worker Contract — PCT-TRANSFER-2026-11-14

### 🪪 Assignment identity

- Record type: successor-executor handoff of execution context.
- Assignment ID / revision: PCT-TRANSFER-2026-11-14 / 2, post-audit reconciliation checkpoint dated 2026-11-14.
- Assignment kind: integrated continuity & recovery manual, ready for coordinator PR delivery on `handoff-local-dev`.
- Project / active Goal: Percentage Calculator Tool / owner's 2026-11-14 `/swarm with codex /pbs-start-resume-handoff` continuity package request ("use AI PBS and save it locally and in GitHub as well").
- Assigning / integrating owner: repository owner or their coordinating maintainer (`Gemini 4 Hydrogen (XHigh)`).
- Receiving worker or executor: next authorized maintainer or AI executor; no future recipient acknowledgment recorded.
- Issued at: 2026-11-14, Africa/Cairo; coordinated from `f3ba3f4` through `#21`–`#30`.
- Status: Initial worker drafts (`5c53eb4`, `93f6768`, `317e98f`) failed `#22`; workers completed `#23`–`#25` (`b65739d`, `f03308a`, `ba4702e`), coordinator re-integrated all 10 files (`#29`), `verifier-2` returned **PASS (`#30`)**, and coordinator reconciled final status/checks (`E-08`) on `handoff-local-dev` for commit and PR creation targeting `main`. Owner PR merge/acceptance and any future offline backup or recipient acknowledgment remain pending.

### 🎯 Bounded question and required result

- Question/outcome: reconcile received PBS records and actual repository baseline, identify the first genuinely unfinished authorized action, and return evidence without replaying completed phases.
- Why it matters: preserves source history, local privacy, ownership, and evidence applicability across context or machine loss.
- Deliverable: concise reconciliation/worker return in the integrating owner's chosen existing record; until that destination is assigned, return findings in conversation without repository writes.
- Definition of assignment completion: report actual revision/status, inspected records, accepted/unaccepted/unknown work, check results/limits, and one next permitted action.
- Out of scope: new features, unrelated cleanup, application source/workflow/lockfile edits, unauthorized backup execution, personal-data migration, direct `main` pushes/merges, or tag/release/Pages/GitHub settings changes without owner authority.

### 🔐 Authority and ownership

- Governing approval: the owner's 2026-11-14 `/swarm with codex /pbs-start-resume-handoff` request authorizes integrated 10-file PBS continuity delivery on `handoff-local-dev`, pushing `origin/handoff-local-dev`, and opening a Pull Request to `main`. It does not authorize direct `main` pushes/merges, tag/release/Pages publication, `--smoke-test`, product code changes, or GitHub settings changes.
- Permitted actions: inspect received source/records and run non-destructive checks when within the carried-forward instruction; reconcile rather than invent authority.
- Read scope: root entrypoint, current/continuation/map owners, targeted ledger/dossier, legacy source references, Git objects, and required source files.
- Write scope: none for a cold-start recipient until its assignment identifies an authorized owner/destination; this integrated package rests on `handoff-local-dev` PR delivery.
- Shared interfaces / protected owners: root AGENTS and sibling Current/Continuation/map/ledger/dossier/archive files, all application source/workflows, root lockfile, and protected historical lines in `4- SESSION_SUMMARY.md` / `HANDOFF.md`.
- Other active owners: none outstanding (`#23`–`#25` worker slices landed cleanly at `#29`, verified at `#30` and `E-08`); temporary swarm workers retire once PR delivery completes.
- Limits / separate gates: no clipboard smoke, account/remote mutation beyond authorized `origin/handoff-local-dev` PR delivery, personal runtime data read/export, install, or `main` publication without owner PR merge.
- Stop/escalation conditions: conflicting instructions/baselines, missing critical records/access, unexpected edits, unclear owner, or a task requiring expanded write/publication authority. Continue independent authorized readback where useful.

### 🔎 Source baseline and current checkpoint

- Required application baseline: `f3ba3f4`, local `v2.2.0`, `pct-tool-v2.2.0-mobile-2`; remediated PBS commits `b65739d`, `f03308a`, `ba4702e` integrated on `handoff-local-dev` with coordinator final reconciliation (`E-08`). Verify actual received state before dependent work.
- Inspected / last reconciled at: 2026-11-14, Windows workspace, reconciled by Coordinator (`Gemini 4 Hydrogen (XHigh)`) following `#30` `verifier-2` PASS and `E-08` re-verification.
- Accepted state: **v2.2.0 (`f3ba3f4`)** production application baseline; `#30` `verifier-2` and `E-08` technical gates passed for the 10-file documentation package. Owner PR merge/acceptance of the PBS package remains pending.
- Unaccepted or partial work: PR merge into `main`, owner acceptance, optional offline `git bundle` backup creation (Scenario B), and owner inspection of hosted GitHub Web UI settings (`github-pages` deployment rule & `Actions -> General`). GUI/install/PWA upgrade and live-hosted checks were not run in this audit.
- Sources to inspect first: cold-start sequence above, then actual status/HEAD, source owner, and relevant evidence row.
- Known uncertainty / contradictions: legacy command names/shortcuts (`HANDOFF.md:21,78,81,96,123,125`), fixture path, original-five versus seven-calculator coverage, mutable release tags, `core.autocrlf true` divergence, and unverified external GitHub settings.
- Work not to repeat: merged Electron/Tauri/features/hardening/handoff/PR #8 phases, completed `#23`–`#25` remediation slices, existing release operations, or unrequested `--smoke-test` runs.

### 🧩 Interface and coordination contract

- Inputs: application baseline `f3ba3f4`, remediated share commits `b65739d`, `f03308a`, `ba4702e`, swarm board records `#21`–`#30`, and ledger evidence `E-01`–`E-08` / `H-01`–`H-03` / `U-01`–`U-02`.
- Output format / destination: findings with permission/observation/acceptance and readback/save/publish separated; return in conversation until an owning durable record is assigned.
- Shared assumptions: one root lockfile; exact source names override legacy typos; hash bytes and worker cache generation matter; local runtime data remains private.
- Baseline-change response: report actual delta and reassess affected evidence; preserve earlier results as historical instead of silently overwriting their identity.
- Overlap/conflict response: preserve files, identify the responsible owner, and coordinate resolution in [SOURCE_OWNERSHIP_MAP.md](SOURCE_OWNERSHIP_MAP.md).
- Useful progress signals: material finding, exact blocker, changed baseline, or integration decision needed.

### 🧾 Required return and evidence

- Result and actual work: source/record reconciliation, exact actions taken, changed artifacts if authorized, and remaining unaccepted work.
- Evidence expected: Git identity/status, applicable tests/parity/hash checks with outcomes, environment and exclusions; separate any historical report from freshly executed results.
- Preservation requirements: save only to assigned destinations, read them back, retain useful partial work, and keep secrets/runtime data out of shared returns.
- Partial-work return: inspected baseline, surviving artifacts, last actual check, missing step/blocker, and exact restart action.
- Return record: recipient's conversation return, then integrating owner's assigned Current/Continuation/session owner after review.

### 🧭 Recipient entry and stopping point

- First permitted action: read root AGENTS and actual `git status --short` / `git rev-parse HEAD`, then follow the cold-start sequence.
- Assignment endpoint: a baseline-reconciled return with no unassigned mutations.
- Review/approval still needed: **owner PR review and merge into `main`** (`handoff-local-dev` -> `main`), hosted GitHub Web UI verification, optional offline `git bundle` backup, and any new source/install/clipboard action.
- On blocked work: identify affected target, exact missing capability/authority/record, preserved work, and the decision or access needed.
- No successor work: this handoff implies no new implementation, release, or external-action assignment.

### ✅ Parent integration gate

- Integrating owner: repository owner or designated PBS coordinator.
- Reconciliation required: actual branch/commit/status (`handoff-local-dev` commit + open PR -> `main`), historical lineage (`5c53eb4`/`93f6768`/`317e98f` -> `#22` FAIL -> `b65739d`/`f03308a`/`ba4702e` -> `#29` integration -> `#30` `verifier-2` PASS -> `E-08` final check), current versus historical evidence, and code/legacy discrepancies.
- Combined-result check: read saved files; resolve all relative links against the delivered record set; check scope, baseline, commands, symbol/hash identities, evidence applicability, and acceptance wording together.
- Acceptance destination: coordinator's Current/Continuation and session/decision owners under [SOURCE_OWNERSHIP_MAP.md](SOURCE_OWNERSHIP_MAP.md).
- Handoff received / access checked: pending for future off-machine recipients; local & GitHub PR delivery completed on `handoff-local-dev`.
- Integration result: coordinated 10-file integration completed (`#29`), passed `verifier-2` post-remediation audit (`#30`) and coordinator `E-08` checks on `handoff-local-dev`, ready for GitHub PR review and owner acceptance into `main`.
