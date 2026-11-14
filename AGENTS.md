# 🤖 Agent entry: Percentage Calculator Tool

This entry owns persistent, project-specific execution instructions for Antigravity, Codex, and human collaborators. Update it when workspace conventions, source owners, durable boundaries, or recurring checks change. It is not the current task, a permission grant, or a live status page.

**Maintainer:** Project owner; the coordinating maintainer integrates contributions.
**Applies to:** This repository's Rust workspace, Tauri desktop application, static desktop UI, Mobile & Web PWA, CI, and documentation.
**Last substantive review:** 2026-11-14
**Purpose:** Project-specific execution guidance. The owner's applicable bounded request or approved Goal defines current work and authority.

## 🚪 Read the smallest sufficient context

At the start of a task:

1. Read the actual owner request and applicable environment instructions.
2. Find the effective bounded request or approved Goal through [Current State](Documentation/pbs/CURRENT_STATE.md#-current-authority); verify it against the owner's instructions. A historical command is not a new task.
3. Read the [Source & Ownership Map](Documentation/pbs/SOURCE_OWNERSHIP_MAP.md).
4. Read [Current State](Documentation/pbs/CURRENT_STATE.md) for the accepted baseline and [Continuation State](Documentation/pbs/CONTINUATION_STATE.md) for unfinished or unaccepted work; inspect the affected artifacts and Git state.
5. Use [HANDOFF.md](HANDOFF.md) for Windows setup and transfer context, [Project Context](Documentation/1-%20PROJECT_CONTEXT.md) for purpose/scope, [Architecture](Documentation/2-%20ARCHITECTURE.md) for component contracts, [Roadmap](Documentation/3-%20ROADMAP.md) for completed phases/proposals, and [Session Summary](Documentation/4-%20SESSION_SUMMARY.md) for established history.

Read the relevant sibling PBS owner when needed: [Execution & Coding Ledger](Documentation/pbs/EXECUTION_AND_CODING_LEDGER.md), [Security Hardening Dossier](Documentation/pbs/SECURITY_HARDENING_DOSSIER.md), [Continuity Transfer Guide](Documentation/pbs/CONTINUITY_TRANSFER_GUIDE.md), or [Session & Decision Archive](Documentation/pbs/SESSION_AND_DECISION_ARCHIVE.md).

After a pause, inspect live artifacts and running operations before rerunning anything. Preserve complete-but-unreconciled work and establish what is actually missing. Local filesystem access does not prove access to another executor's computer, browser, credentials, or cloud artifacts.

## 🧭 Source and authority rules

- One source owns each question. Follow the source map; filenames and timestamps alone do not confer authority.
- The owner's effective instructions define permission, subject to environment restrictions. Historical plans and summaries provide context.
- Distinguish observations, attributed historical reports, assumptions, proposals, technical verification, and owner acceptance.
- Inspect code/configuration for implementation claims; use acceptance decisions for accepted scope and dated records for historical interpretation.
- Canonical IPC names are `get_settings`, `set_settings`, and `check_for_updates` in `src-tauri/src/commands.rs`, registration in `src-tauri/src/main.rs`, invocations in `ui/main.js`, and `Documentation/2- ARCHITECTURE.md`. Post-PBS `HANDOFF.md` lines **81, 96, 123, 125** (baseline `f3ba3f4` lines **78, 93, 120, 122**) instead use `settings_get` at L81, `settings_set` at L81/L123, and `check_for_update` at L81/L96/L125. These are documentation errors, not callable aliases. The [Execution & Coding Ledger §4](Documentation/pbs/EXECUTION_AND_CODING_LEDGER.md#4-verified-code-versus-legacy-document-discrepancies) also documents unsupported `Ctrl/Cmd+Shift+C` shortcut and `0%` zero-denominator hint claims at post-PBS **L21, L78** (baseline **L18, L75**). Recheck line locations after edits.
- Report important conflicts and route decisions to the assigned owner. Do not silently promote a worker's draft into accepted project state.

## 🧱 Workspace boundaries

**Project entry point:** This repository root and this file; the public repository is [CipherVaults/Percentage-Calculator-Tool](https://github.com/CipherVaults/Percentage-Calculator-Tool).
**Editable targets:** Only targets covered by the effective task. Preserve existing unrelated changes and other workers' targets.
**Read-only / protected targets:** `reference/Percentage Calculator Tool v1.1.html` is the historical original. `crates/percent-core/tests/fixtures/golden.json` is the preserved v1.1 oracle: do not regenerate it to make changed math pass. Preserve historical tags `v1.1.0`, `v1.1.0-electron`, `v2.0.0`, `v2.1.0`, `v2.1.1`, and the accepted `v2.2.0` identity unless the owner specifically authorizes a release/history operation.
**Generated artifacts:** `.gitignore` excludes `target/`, `src-tauri/gen/`, `node_modules/`, `dist/`, `release/`, `out/`, final-output copies, diagnostics, and installer smoke folders. Cargo/Tauri builds generate binaries/schemas; CI stages deliverables and `dist/SHA256SUMS.txt`. These outputs and user-managed backups are not canonical source.
**Sensitive material:** Never commit tokens, credentials, signing keys, `.env*`, private logs, personal filesystem paths, or runtime contents. Desktop `%APPDATA%\com.percentagecalculator.tool\{history,settings}.json`, browser `localStorage`, and installed PWA caches are private per-device state. Do not read, clear, export, migrate, or overwrite them without applicable owner authority.
**External interfaces:** `origin`, GitHub Releases, GitHub Pages, the public GitHub Releases API, the system clipboard, and browser launching each have effects beyond editing source. Historical VM credentials, caches, and chat artifacts do not transfer with Git.

Do not rebuild, rename, reorganize, or remove a working component merely for preference. A necessary broader change requires an applicable scope amendment.

## ⚙️ Project conventions

**Implementation / content conventions:**

- Keep plain HTML/CSS/JavaScript, no frontend framework, bundler, or runtime npm packages. Node is a verification tool; Rust/Tauri own the desktop runtime.
- Keep zero `.innerHTML`, `.outerHTML`, `eval`, or `new Function` runtime sinks. Use `textContent`, `createTextNode`, `createElement`, and `replaceChildren`. Preserve desktop sequence guards, validation, structured copy text, and error-state copy guards.
- Mobile inline JavaScript must contain zero runtime `style.*` mutations; use CSS classes, including `.clipboard-scratch`.
- Preserve exact v1.1 rounding/formatting behavior and the golden oracle. The 10,661-case suite covers formatting and the original five calculators; Markup & Margin and Tax/VAT also need their distinct unit/runtime checks.
- Keep Tauri custom-command boundaries, `permissions: []`, desktop `connect-src 'none'`, bounded storage/clipboard input, and commit-on-success persistence. Optional GitHub update checks are distinct from offline calculations.

**Naming and structure:**

`Cargo.toml` owns workspace membership; `crates/percent-core/` owns pure math; `src-tauri/` owns native state/commands; `ui/` owns desktop presentation; `mobile/` owns standalone web/PWA assets. Follow [Architecture](Documentation/2-%20ARCHITECTURE.md), rather than copying its full model here. Use repo-relative portable documentation links and clear sentence-style commit messages.

**Compatibility requirements:**

- Windows release work needs Rust stable/MSVC, Visual Studio C++ Build Tools plus Windows SDK, and WebView2. The inspected CI installs Tauri CLI with `cargo install tauri-cli --version "=2.12.4" --locked`; installation is a separate system-changing action, not a prerequisite to reading docs.
- Run Windows Cargo in **PowerShell / Windows Terminal using PowerShell**, with MSVC tools available. Git Bash `/usr/bin/link` can shadow MSVC `link.exe` and cause `link: extra operand`. Cross-platform contributors can test the pure crate without claiming Windows bundle coverage.
- Windows Clippy uses `-D warnings`. Put Unix-only declarations and imports under `#[cfg(unix)]`; a declaration outside that guard can become an unused-variable error on Windows.
- Preserve `.gitattributes`: `mobile/*.html`, `*.js`, `*.webmanifest` and `ui/*.html`, `*.css`, `*.js` use `eol=lf`. The intended local convention is `core.autocrlf false`. Inspect `git config --get core.autocrlf` (observed `true` during the 2026-11-14 Windows checkout inspection, while the two checked mobile files still had LF). Do not claim that configuration has been corrected or change it during a read-only task.
- Any byte change within Mobile `<style>` or `<script>` requires recomputing SHA-256 Base64 from the exact saved UTF-8 block contents, updating the corresponding CSP directive, and rerunning verification. Never hash delimiters or normalize bytes before hashing. Do not put `frame-ancestors` in a `<meta>` CSP; its desktop CSP use is separate.
- At `f3ba3f4`, Mobile hashes are `style-src 'sha256-HppoWhfVX+UyR2KqXbS6U2Q3KafIo1MVyti/h94cX9o='` and `script-src 'sha256-655QfOPjmPDnhT1lUo4K5UBkQqBy3BB3EYZt7mnAKdg='`. Treat these as baseline identities, not permanent replacements for recomputation.
- For authorized PWA changes, review cache invalidation and bump `mobile/sw.js`'s cache name when required. The baseline is `pct-tool-v2.2.0-mobile-2`; preserve network-first HTML navigation, offline fallback, guarded caching, and the coordinated automatic client reload path.

**Recurring method reference:** This file owns working rules; the [Execution & Coding Ledger](Documentation/pbs/EXECUTION_AND_CODING_LEDGER.md) owns detailed engineering evidence, the [Security Hardening Dossier](Documentation/pbs/SECURITY_HARDENING_DOSSIER.md) owns security evidence and limits, and the [Continuity Transfer Guide](Documentation/pbs/CONTINUITY_TRANSFER_GUIDE.md) owns recovery/transfer procedure.

## 🔐 Permission checks

Before consequential actions, check task authority and platform rules for dependency changes, installations, deletion, history changes, external sharing, deployment, credentials, and out-of-scope edits.

**Project-specific additional restrictions:** Preserve the historical reference/oracle and private runtime state above. `--smoke-test` writes `percentage-tool-smoke-test` to the **live Windows clipboard** and reads it back. History and settings use `in_memory_only: true`, but that does not isolate the clipboard. Establish that the task permits this side effect before invoking it. A read-only/documentation-only scope excludes it.

**Version-history workflow:** Work on `handoff-local-dev` or an assigned feature/share branch, then use the coordinator's integration and PR route to `main`. Local file edits, local commits, pushing `origin`, opening/merging a PR, and publishing a release are distinct actions. Local commits require task scope that permits them; a no-commit drafting instruction takes precedence. Do not push without applicable owner authorization, force-push, or move/delete tags on your own.

A push/merge to `main` runs build/release CI; the existing-release path can move the current version tag and overwrite release assets/checksums. Pages runs for `main` pushes affecting `mobile/**` or its workflow, or manual dispatch on `main`. A version tag push also triggers build/release CI. Treat these as publication effects, even when the initiating change is documentation.

This file grants no new task, successor feature, external communication, or sensitive operation. Do not bypass a denial through another tool or route.

## ✅ Verification workflow

Run from the repository root. The commands below are procedures, not claims that each was run in the latest session.

### Read-only repository identity

- **When required:** Start/re-entry, integration, or a claim tied to a revision.
- **Command or procedure:**
  ```powershell
  git status --short
  git branch --show-current
  git log -n 20 --oneline
  git show-ref
  git diff --check
  git diff --exit-code f3ba3f4 --
  git config --get core.autocrlf
  git check-attr text eol -- mobile/index.html mobile/sw.js
  ```
- **Expected result:** Explain the actual branch/ref/diff state; the baseline comparison is empty only before intentional tracked changes. Account for untracked files separately.
- **Evidence to retain:** Revision, branch, relevant diff/status and effective settings.
- **Known limits:** Local remote-tracking refs can be stale; no network fetch or hosted settings inspection occurs. `git diff` alone omits untracked drafts.

### Read-only Mobile parity, CSP, line endings, and source hygiene

- **When required:** Relevant web/UI edits, line-ending changes, or rechecking baseline claims.
- **Command or procedure:** In PowerShell 5.1 or 7+, pipe this in-memory program to Node; it writes no files, launches no UI, and makes no network calls:
  ```powershell
  @'
  const fs = require("fs"), vm = require("vm"), crypto = require("crypto"), assert = require("assert");
  for (const p of ["mobile/index.html", "mobile/sw.js"]) {
    const bytes = fs.readFileSync(p);
    assert(!bytes.includes(13), "CR byte found: " + p);
    console.log(p + ": LF verified; no CR bytes");
  }
  const html = fs.readFileSync("mobile/index.html", "utf8");
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  assert(styleMatch && scriptMatch, "Missing inline blocks");
  const style = styleMatch[1], script = scriptMatch[1];
  const csp = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i)[1];
  for (const [kind, body] of [["style", style], ["script", script]]) {
    const hash = crypto.createHash("sha256").update(body, "utf8").digest("base64");
    const directive = csp.split(";").map(x => x.trim()).find(x => x.startsWith(kind + "-src "));
    assert(directive && directive.includes("'sha256-" + hash + "'"), kind + " CSP mismatch");
    console.log(kind + "-src: 'sha256-" + hash + "'");
  }
  assert(!/frame-ancestors/i.test(csp), "frame-ancestors in meta CSP");
  for (const [p, src] of [
    ["ui/main.js", fs.readFileSync("ui/main.js", "utf8")],
    ["mobile inline script", script],
    ["mobile/sw.js", fs.readFileSync("mobile/sw.js", "utf8")]
  ]) {
    assert(!/\.innerHTML\b|\.outerHTML\b|\beval\s*\(|\bnew\s+Function\b/.test(src), "Forbidden DOM/eval sink: " + p);
  }
  assert(!/\.style\s*(?:\.|\[|=)/.test(script), "Mobile runtime style mutation");
  const start = script.indexOf("function formatDecimal");
  const end = script.indexOf("// --- Persistent on-device history");
  assert(start >= 0 && end > start, "Math boundaries missing");
  const ctx = { Number, Math };
  vm.runInNewContext(script.slice(start, end), ctx, { timeout: 1000 });
  const pNum = s => s === "NaN" ? NaN : s === "Infinity" ? Infinity : s === "-Infinity" ? -Infinity : Number(s);
  const cases = JSON.parse(fs.readFileSync("crates/percent-core/tests/fixtures/golden.json", "utf8"));
  for (const c of cases) {
    if (c.f === "formatDecimal") assert.strictEqual(ctx.formatDecimal(pNum(c.a[0])), c.r);
    else if (c.f === "discount") {
      const actual = ctx.calcDiscount(pNum(c.a[0]), pNum(c.a[1]));
      assert.strictEqual(actual.label, c.r.label);
      assert.strictEqual(actual.copyText, c.r.copyText);
    } else {
      const f = { percentageChange: ctx.calcChange, percentageOfTotal: ctx.calcPercentOfTotal,
        percentagePortion: ctx.calcPortion, originalValue: ctx.calcOriginal }[c.f];
      assert(f, "Unknown fixture function " + c.f);
      const actual = f(pNum(c.a[0]), pNum(c.a[1]));
      assert.strictEqual(actual.ok, String(c.r.ok));
      if (c.r.ok) assert.strictEqual(actual.label, c.r.label);
      else assert.strictEqual(actual.error, c.r.error);
    }
  }
  console.log("ALL_MOBILE_CHECKS_OK (" + cases.length + " cases); CSP, DOM/eval and mobile style checks passed");
  for (const p of [".github/workflows/build.yml", ".github/workflows/pages.yml"]) {
    const s = fs.readFileSync(p, "utf8");
    const refs = [...s.matchAll(/uses:\s+([^\s#]+)/g)].map(m => m[1]);
    assert(refs.length && refs.every(ref => /@[a-f0-9]{40}$/.test(ref)), "Action pin format: " + p);
    const checkouts = (s.match(/uses: actions\/checkout@/g) || []).length;
    assert((s.match(/persist-credentials: false/g) || []).length === checkouts, "Checkout credential setting: " + p);
    console.log(p + ": " + refs.length + " Action uses have 40-character SHA pins; checkout credentials disabled");
  }
  '@ | node
  ```
  The here-string closing `'@ | node` must start at column one when copied into PowerShell.
- **Expected result:** Exit 0, matching exact directive hashes, no CR bytes, no scanned sinks/style mutations, and `ALL_MOBILE_CHECKS_OK (10661 cases)` at the preserved baseline. All workflow Action references have 40-character SHA pins and checkout credentials are disabled.
- **Evidence to retain:** Node version, fixture count, printed digests, output, and source revision.
- **Known limits:** Executes only the extracted Mobile math engine; regex scans are bounded source checks. Does not run Rust, browser CSP enforcement, service-worker lifecycle, full DOM interaction, native IPC/storage/clipboard, installers, or hosted CI. Pin-format checks do not validate upstream Action code or GitHub UI policy.

### Rust formatting, lint, and test coverage

- **When required:** Authorized Rust/configuration or integrated code changes, on suitable platforms. Clippy/tests compile and write to `target/`; keep them unrun during strictly read-only or non-compiling documentation checks unless authorized.
- **Command or procedure:**
  ```powershell
  cargo fmt --all -- --check
  cargo clippy --workspace --all-targets --locked -- -D warnings
  cargo test --workspace --locked
  ```
  Pure-crate CI/cross-platform subset:
  ```text
  cargo clippy -p percent-core --all-targets --locked -- -D warnings
  cargo test -p percent-core --locked -- --nocapture
  ```
- **Expected result:** Exit 0, no formatting changes or warnings, passing applicable tests including Rust golden parity.
- **Evidence to retain:** Commit, platform/toolchain, exact command, result and scope.
- **Known limits:** A pure-crate pass does not cover Tauri. Platform-conditional tests and linker dependencies vary; unit tests do not establish real-window or installer behavior.

### Desktop runtime and packaging

- **When required:** Only for an authorized runtime/build task with appropriate Windows prerequisites and clipboard side-effect scope.
- **Command or procedure:**
  ```powershell
  cargo tauri dev
  cargo tauri build -- --locked
  cargo run -p percentage-calculator-tool --locked -- --smoke-test
  .\target\release\percentage-calculator-tool.exe --smoke-test
  ```
  The last two are alternative smoke routes; inspect an existing result/binary identity before choosing one.
- **Expected result:** Dev UI runs when requested; build creates NSIS/MSI and the portable executable under `target/release/`; smoke exits 0 with `SMOKE_TEST_OK: all renderer, IPC, and clipboard checks passed.`.
- **Evidence to retain:** Source/binary identity, toolchain, logs and actual artifacts.
- **Known limits:** These commands build/write outputs and may launch windows. Smoke overwrites the live clipboard, uses in-memory history/settings, mocks update results and bypasses release-page launching; it does not prove real GitHub reachability, disk persistence, installer installation, or every device/browser. Never run it for a read-only check.

### Release integrity and hosted configuration

- **When required:** Authorized download verification or owner-side deployment/policy review.
- **Command or procedure:** `Get-FileHash .\Percentage.Calculator.Tool.Portable.2.2.0.exe -Algorithm SHA256`; compare with the matching entry in the same release's `SHA256SUMS.txt`. The owner checks GitHub `Settings -> Environments -> github-pages -> Deployment branches and tags` for `main`-only protection, and `Settings -> Actions -> General` for the selected/SHA-pinned Actions policy.
- **Expected result:** Matching checksum and directly observed settings, recorded with date/scope.
- **Evidence to retain:** Release/file identity, checksum comparison, and sanitized owner/UI evidence.
- **Known limits:** A matching checksum establishes agreement with that manifest, not Authenticode signing or safety. Workflow YAML cannot prove hosted policy settings. Existing records are historical evidence until rechecked.

Report unavailable/not-run checks honestly. Recheck affected claims after material changes; do not broaden or repeat tests without a reason.

## 👥 Delegation and integration

Assign non-overlapping targets and an integration owner before concurrent edits. When delegating concurrent work across isolated share or feature branches off `handoff-local-dev`, branch existence alone is not a worker result. Workers return changed artifacts, evidence, assumptions, unresolved issues, and source/authority conflicts. They may not expand permissions.

The coordinator reviews the combined diff, verifies links and chronology, resolves conflicts, runs relevant integration checks, and reconciles owning records before requesting owner acceptance. Independent worker passes do not establish package integration or acceptance.

## 📚 Documentation changes

Use the source map to identify which owned answer changed. Read the target first, preserve sound content/history, apply the smallest coherent change, inspect the diff, and read back the destination. Link detailed owners rather than duplicating the same live checkpoint.

Keep live tasks out of Architecture and Roadmap. `Documentation/4- SESSION_SUMMARY.md` **retains its established oldest-first chronology**; append later sessions without rewriting earlier dated accounts. This owner-directed convention overrides generic PBS newest-first advice for that file. `Documentation/pbs/SESSION_AND_DECISION_ARCHIVE.md` uses the **PBS single-project session profile**, with its full required headings/hierarchy and newest-first session entries. Preserve the distinction and cross-link rather than silently reformatting either archive.

Use the [Execution & Coding Ledger](Documentation/pbs/EXECUTION_AND_CODING_LEDGER.md) for factual execution/check results, the session archive for session evolution and decisions, Current for the accepted present, and Continuation for unfinished/unaccepted work. Never turn a prepared document into a fabricated owner decision.

Distinguish prepared, write attempted, saved, destination verified, integrated, and accepted. Return prepared artifacts and precise status if publication is outside authority or fails.

## 📦 Reporting and stopping

Report changed files, scoped checks/evidence, limits, unresolved decisions, and the exact next permitted action. Use the [Execution & Coding Ledger](Documentation/pbs/EXECUTION_AND_CODING_LEDGER.md) when a durable execution report is warranted.

**Record update triggers:** Working-rule changes update this file; ownership changes update the source map; acceptance/authority changes update Current; meaningful unfinished checkpoints update Continuation; security, transfer, engineering, and session changes update their assigned sibling owners.
**Escalation / return destination:** Coordinating maintainer, then project owner for actual scope/acceptance decisions.

Pause dependent work for missing authority, material scope conflict, significant new risk, unexpected loss, or a required owner decision; continue independent authorized work where possible. Technical completion differs from owner acceptance. Stop at the bounded task endpoint.
