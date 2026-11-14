# 🗺️ Percentage Calculator Tool — Source & Ownership Map

## 🎯 Purpose

Find the authoritative answer to each project question without confusing permission, implementation, verification, acceptance, and history. This map covers the repository, its coordinated PBS continuity package, public publication routes, and the boundaries around private runtime data and offline copies.

**Maintaining owner:** Coordinating maintainer; project owner decides adoption and acceptance.
**Ownership contract status / decision:** The integrated 10-file PBS package on `handoff-local-dev` resolved `#22` findings across `#23`–`#25` (`b65739d`, `f03308a`, `ba4702e`), passed `verifier-2` post-remediation verification (`#30`), and received coordinator final reconciliation (`E-08`). Ready for local commit on `handoff-local-dev` and Pull Request review to `main`; owner PR acceptance and hosted Web UI checks remain pending.
**Last reconciled:** 2026-11-14, coordinator integration on `handoff-local-dev`. Initial drafts (`5c53eb4`, `93f6768`, `317e98f`) and `#22` audit findings are retained as provenance behind remediated commits `b65739d`, `f03308a`, `ba4702e`, `#29` assembly, and `#30` `verifier-2` PASS.
**Project entry:** [AGENTS.md](../../AGENTS.md) at repository root.
**Other current-facing entry routes, if relevant:** [README.md](../../README.md) is the public overview; [HANDOFF.md](../../HANDOFF.md) is the established Windows transfer/setup entry; [Project Context](../1-%20PROJECT_CONTEXT.md) and the numbered documentation are established explanatory/history routes. Use this map to reach Current and Continuation; those older routes do not independently authorize work.
**Authority boundary:** The owner's 2026-11-14 `/swarm with codex /pbs-start-resume-handoff` request ("use AI PBS and save it locally and in GitHub as well") authorizes integrated 10-file package commit on `handoff-local-dev`, pushing `origin/handoff-local-dev`, and opening a Pull Request to `main`. Direct pushes/merges to `main`, release/tag edits, `--smoke-test`, and hosted Web UI modifications remain excluded.

**Integrated package identity:** Ten files integrated on `handoff-local-dev` off accepted baseline `f3ba3f4` (`v2.2.0`): root `AGENTS.md`; `Documentation/pbs/{SOURCE_OWNERSHIP_MAP,CURRENT_STATE,CONTINUATION_STATE,EXECUTION_AND_CODING_LEDGER,SECURITY_HARDENING_DOSSIER,CONTINUITY_TRANSFER_GUIDE,SESSION_AND_DECISION_ARCHIVE}.md`; `Documentation/4- SESSION_SUMMARY.md`; and `HANDOFF.md`. Remediated share commits `b65739d`, `f03308a`, and `ba4702e` landed at `#29`, passed `verifier-2` (`#30`), and were reconciled by the coordinator (`E-08`) ahead of PR submission; see [Continuation](CONTINUATION_STATE.md#-exact-next-permitted-action) for owner review/merge.

## 🧭 Canonical owners

The table assigns an information owner, not blanket permission to edit it. PBS additions remain proposed until adopted.

| Question / information | Canonical source and exact location | Responsible owner | Update trigger | Supporting / historical sources |
|---|---|---|---|---|
| Persistent execution rules and onboarding | [AGENTS.md](../../AGENTS.md) | Coordinating maintainer | Durable convention, boundary, check, or reading-route change | HANDOFF; Architecture; this map |
| Project identity, purpose, included/excluded scope | [Documentation/1- PROJECT_CONTEXT.md](../1-%20PROJECT_CONTEXT.md) | Project owner / maintainer | Accepted scope or product-purpose change | README; dated session records |
| Enduring component model, contracts, IPC explanation | [Documentation/2- ARCHITECTURE.md](../2-%20ARCHITECTURE.md) | Engineering maintainer | Accepted architecture/interface change | Actual Rust/Tauri/UI/Mobile sources |
| Phase definitions, completed milestones, proposed improvements | [Documentation/3- ROADMAP.md](../3-%20ROADMAP.md) | Project owner | Phase decision or explicitly proposed backlog change | Session/history evidence; Current for accepted present |
| Established development chronology | [Documentation/4- SESSION_SUMMARY.md](../4-%20SESSION_SUMMARY.md) | Session recorder / maintainer | Substantive project session | Git history; PBS session archive; preserve oldest-first chronology |
| Windows setup and established cloud-to-local handoff | [HANDOFF.md](../../HANDOFF.md) | Transfer maintainer | Setup/transfer boundary or practical handoff change | Actual source/config; Continuity Transfer Guide; correct known IPC typos when within scope |
| Public product overview, usage, downloads | [README.md](../../README.md) | Public documentation maintainer | Accepted user-facing feature/release/instruction change | Project Context; Architecture; release notes |
| Source ownership, conflict rules, lineage and portability | [Documentation/pbs/SOURCE_OWNERSHIP_MAP.md](SOURCE_OWNERSHIP_MAP.md) | Coordinating maintainer | Owner/location/access or route change | Existing owner documents and inspected artifacts |
| Current authorization | Owner's latest effective bounded request or approved Goal, indexed by [CURRENT_STATE.md — Current authority](CURRENT_STATE.md#-current-authority) | Project owner | New instruction, pause, replacement, or amendment | Continuation and dated decision archive preserve context; neither invents approval |
| Accepted project position | [Documentation/pbs/CURRENT_STATE.md](CURRENT_STATE.md) | Coordinating maintainer, based on owner decisions | Accepted milestone, authority transition, material applicability change | Baseline identity; acceptance source; scoped evidence |
| Unfinished/unaccepted work and exact recovery action | [Documentation/pbs/CONTINUATION_STATE.md](CONTINUATION_STATE.md) | Active executor / integrating coordinator | Meaningful checkpoint, interruption, worker return, integration change | Surviving diffs, results, worker contracts |
| Engineering execution, coding lessons and verification evidence | [Documentation/pbs/EXECUTION_AND_CODING_LEDGER.md](EXECUTION_AND_CODING_LEDGER.md) | Engineering recorder / coordinator | Meaningful execution/check or recurring coding lesson | Commands/results and source identities; pre-remediation `93f6768` inspected |
| Security evidence, mitigations, caveats and hosted-check gaps | [Documentation/pbs/SECURITY_HARDENING_DOSSIER.md](SECURITY_HARDENING_DOSSIER.md) | Security maintainer / project owner for policy changes | Security finding, mitigation, verification or policy observation | Actual security/config sources; dated audits; pre-remediation `93f6768` inspected |
| Local/remote transfer procedure, backup and recovery boundaries | [Documentation/pbs/CONTINUITY_TRANSFER_GUIDE.md](CONTINUITY_TRANSFER_GUIDE.md) | Transfer maintainer / coordinator | Executor/access/backup/transfer change | HANDOFF; Continuation; pre-remediation `93f6768` inspected |
| PBS session evolution, decisions, reasons and reconstruction limits | [Documentation/pbs/SESSION_AND_DECISION_ARCHIVE.md](SESSION_AND_DECISION_ARCHIVE.md) | PBS session recorder | Substantive session or decision | Numbered Session Summary; worker returns; PBS single-project profile, newest-first |
| Live operational facts | Actual working tree/diffs, local Git refs, tool outputs; hosted job/deployment state only when directly inspected | Active executor / coordinator | Edit, check, job or deployment event | Ledger preserves dated evidence; Current does not mirror every transient field |
| Workspace membership and dependency/version declarations | `Cargo.toml`, `Cargo.lock`, `crates/percent-core/Cargo.toml`, `src-tauri/Cargo.toml` | Rust maintainer | Authorized workspace/dependency/version change | Architecture and release notes explain accepted changes |
| Calculation implementation and preserved parity contract | `crates/percent-core/src/lib.rs`, `crates/percent-core/tests/golden_parity.rs`, `crates/percent-core/tests/fixtures/golden.json` | Math maintainer; owner controls oracle changes | Authorized math/test change; protect existing oracle | Original v1.1 reference and recorded fixture provenance |
| Desktop native behavior, settings/history storage, command names | `src-tauri/src/commands.rs`, registration/state in `src-tauri/src/main.rs` | Tauri maintainer | Authorized native/API/storage change | Architecture; frontend call sites; source wins over descriptive IPC typos |
| Desktop window, bundle targets, version, CSP and capabilities | `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json` | Tauri/security maintainer | Authorized configuration/security/release change | Cargo manifests; workflow; security dossier |
| Desktop presentation, interaction and smoke driver | `ui/index.html`, `ui/styles.css`, `ui/main.js` | UI maintainer | Authorized UI/runtime check change | Architecture; Rust IPC; unit/smoke evidence |
| Mobile math/UI, inline CSP and per-device persistence | `mobile/index.html` | Mobile maintainer | Authorized inline asset/feature change; recompute exact CSP hashes | Golden fixtures; Node verification; security dossier |
| PWA caching, update/reload and installation metadata | `mobile/sw.js`, `mobile/manifest.webmanifest`, `mobile/icons/` | Mobile maintainer | Authorized PWA/cache/manifest change | Index registration; Pages workflow; browser evidence when available |
| CI triggers, Action pins, permissions, packaging/publication mechanism | `.github/workflows/build.yml`, `.github/workflows/pages.yml` | CI maintainer; owner authorizes publication/settings changes | Authorized workflow or release-process change | Hosted runs/settings only when inspected; release notes |
| Release narrative for v2.2.0 | `.github/release-notes-v2.2.0.md` | Release maintainer | Authorized release-note change | Actual release asset/ref evidence, version declarations |
| Checkout line endings and ignored-output/secret exclusions | `.gitattributes`, `.gitignore`; effective local Git configuration is separately observed | Repository maintainer / local executor | Authorized checkout/ignore policy change; local config drift | AGENTS; Node byte checks; never infer effective config from a recommendation |
| Historical original and rollback identities | `reference/Percentage Calculator Tool v1.1.html`; historical Git tags | Project owner | Explicit historical/oracle/release authority only | Git history and dated session provenance; read-only by default |
| Offline backup existence and recoverability | Owner-managed `git bundle` / source archive and its validation record, outside canonical source | Backup owner | Explicit backup/restore operation | Transfer Guide; no backup file or restore was verified in this core slice |
| Per-device operational history/settings/cache contents | Desktop `%APPDATA%\com.percentagecalculator.tool\{history,settings}.json`; browser `localStorage` and installed PWA caches | Device owner | User application use or explicitly authorized transfer/reset | Source owns schema/behavior; Git does not own or synchronize private contents |

## ⚖️ Conflict resolution

**Permission:** The owner's effective instructions and amendments, within platform/environment restrictions, decide what may be done. The owner's 2026-11-14 `/swarm with codex /pbs-start-resume-handoff` authorization ("save it locally and in GitHub as well") governs this package (`handoff-local-dev` -> PR -> `main`). An implementation, Plan, branch name, or worker return grants no permission.

**Observation:** Inspect actual artifacts and their identity. All ten PBS files are integrated on `handoff-local-dev` (off accepted baseline `f3ba3f487af86b1ecec6926a24386441c3abf4ca`, where `main` and `v2.2.0` resolve), integrating remediated worker commits `b65739d` (`pbs-core`), `f03308a` (`pbs-history`), and `ba4702e` (`pbs-session`), `#29` integration, `#30` `verifier-2` post-remediation `PASS`, and coordinator final verification (`E-08`). Local `origin/*` refs reflect cached observations until fetch/push.

**Acceptance:** The owner identifies `v2.2.0` at `f3ba3f4` as the accepted production baseline in this request. Existing release/session/handoff records support its historical scope. Passing verification checks (`#30`, `E-08`) and opening a PR from `handoff-local-dev` to `main` are separate from owner PR merge/acceptance of the PBS package.

**Historical interpretation:** Read dated context and the version it describes. Electron-era setup, initial PWA caching descriptions, older cache names, and old claims of zero network activity must not overwrite current source: calculations are local, while optional update checks can query GitHub. The oldest-first numbered Session Summary is a historical archive, not today's executable task list.

Observed reconciliations:

1. Post-PBS `HANDOFF.md` lines **81, 96, 123, 125** correspond to baseline `f3ba3f4` lines **78, 93, 120, 122**: `settings_get` occurs at L81, `settings_set` at L81/L123, and `check_for_update` at L81/L96/L125. Direct comparison confirms the three-line callout shift. Definitions in `src-tauri/src/commands.rs`, registration in `src-tauri/src/main.rs`, invocations in `ui/main.js`, and `Documentation/2- ARCHITECTURE.md` establish **`get_settings`, `set_settings`, `check_for_updates`**; the legacy names are not registered aliases. [Execution & Coding Ledger §4](EXECUTION_AND_CODING_LEDGER.md#4-verified-code-versus-legacy-document-discrepancies) also records unsupported `Ctrl/Cmd+Shift+C` and `0%` zero-denominator hint claims at post-PBS **L21, L78** (baseline **L18, L75**). Personal/cloud paths preserved in the historical `Documentation/4- SESSION_SUMMARY.md` and `HANDOFF.md` are historical context, not portable setup instructions; legacy protected text remains intact.
2. The intended `core.autocrlf false` convention conflicts with the inspected effective value `true`. Attributes still report `eol=lf`, and Node verified no CR bytes in the two checked mobile files. Configuration was not changed; do not convert byte success into a false configuration claim.
3. HANDOFF's old suggestion to merge its initial handoff later is historical: the inspected `main` already contains HANDOFF and is at the same baseline. Inspect current refs/diffs instead of replaying that old instruction.

If sources disagree, first classify the question, locate its owner and source identity, preserve the competing claim, and correct only the relevant record within authority. Newness or a familiar filename does not settle a conflict.

## 🧾 Source and transformation register

| Source / claim reference | Status and question it informs | Actually inspected / unavailable | Source date / observed date | Transformation and retained basis | Limits |
|---|---|---|---|---|---|
| Owner's 2026-11-14 `/swarm with codex /pbs-start-resume-handoff` authorization | Current permission; accepted baseline; 10-file package + PR delivery | Authorization and board records (`#20`–`#30`) observed in session | 2026-11-14 | Scopes 10-file PBS continuity adoption on `handoff-local-dev` -> PR -> `main` (local commit + `origin/handoff-local-dev` push/PR) | Direct `main` push/merge, compilation/smoke changes to app behavior, or hosted UI setting edits require owner action |
| PBS method 1.1; `agent-entry.md`, `source-ownership-map.md`, `current-state.md`, `continuation-state.md`; relevant lifecycle/governance/maintenance guides | External method/template references | Required skill and four templates read from owner's supplied skill installation (`pbs-start-resume-handoff`); relevant guides consulted | Method identifies approval 2026-10-26; consulted for 2026-11-14 drafting | Adapted core structure with project facts; no personal installation path copied into repository | Skill installation is external to Git; method approval is not project adoption |
| `Cargo.toml`; both crate manifests; `crates/percent-core/src/lib.rs`; `tests/golden_parity.rs`; `src-tauri/src/main.rs`, `commands.rs`; Tauri config/capability files | Canonical implementation/configuration at `f3ba3f4` | Contents inspected and compiled/tested via workspace checks (`E-02`–`E-04`, `#30`, `E-08`) | `f3ba3f4`; verified 2026-11-14 | Summarized observed implementation, retaining exact paths/symbols and revision | No `--smoke-test` clipboard execution, installer install, or real-window run |
| `ui/index.html`, `ui/main.js`; `mobile/index.html`, `mobile/sw.js`, `mobile/manifest.webmanifest`; `.gitattributes`, `.gitignore` | Canonical frontend/PWA/checkout policy at `f3ba3f4` | Structure and relevant implementation sections inspected; Node read full checked asset bytes and extracted math (`E-05`–`E-06`, `#30`, `E-08`) | Same baseline/checkpoint | Exact inline UTF-8 SHA-256 digests, LF and bounded sink/style scans; no source rewritten | Source inspection and VM math are not browser, CSP-runtime, SW, cross-device or complete UI acceptance tests |
| `crates/percent-core/tests/fixtures/golden.json` | Protected oracle, historically generated from v1.1 JS | Read/parsed by Rust golden test and Node: exactly **10,661** cases matched extracted mobile engine | Same baseline/checkpoint | Existing data retained unchanged; comparison followed CI's result contract | Original five calculators/formatting only; Markup/Margin and Tax/VAT covered by Rust unit tests |
| `.github/workflows/build.yml`, `pages.yml`, `.github/release-notes-v2.2.0.md` | Canonical CI/publication mechanism and release narrative | Files read; Node verified all 9 build and 4 Pages Action uses have 40-character SHA pins and checkout credential persistence is disabled | Same baseline/checkpoint | Trigger/permission/`--locked`/checksums/release behavior summarized from YAML | No upstream Action review, fresh run result, release-download verification or hosted policy observation |
| `HANDOFF.md`, `README.md`, `Documentation/1- PROJECT_CONTEXT.md`, `2- ARCHITECTURE.md`, `3- ROADMAP.md`, `4- SESSION_SUMMARY.md` | Established explanation and historical execution/publication evidence | Read at `f3ba3f4`; chronology and contradictions reconciled | Dated entries through 2026-11-13; reconciled 2026-11-14 | Attributed historical Rust/build/smoke/CI/publishing reports; preserved original files | Reports are not new test receipts; old wording can be stale; not all external evidence survives in Git |
| Git status/branch/log/refs/diffs, attributes/config, Cargo/Node verification runs | Direct local identity and scoped tool evidence (`E-01`–`E-08`, `#30`) | Verified on `handoff-local-dev` across remediated commits `b65739d`, `f03308a`, `ba4702e`, baseline target refs, and `core.autocrlf true` observation | 2026-11-14 | Establishes technical readiness on `handoff-local-dev` before PR submission | Hosted GitHub Web UI settings and offline restore tests remain unexercised |
| All 10 integrated PBS files (`AGENTS.md`, seven `Documentation/pbs/*.md`, `4- SESSION_SUMMARY.md`, `HANDOFF.md`) | Integrated continuity package delivered on `handoff-local-dev` | Share commits `b65739d`, `f03308a`, `ba4702e` integrated (`#29`), passed `verifier-2` (`#30`), reconciled and re-verified (`E-08`) | 2026-11-14 | Ready for owner PR review and acceptance on `main` | Owner PR merge and hosted GitHub Web UI settings checks remain pending |
| `verifier-2` `#22` (FAIL) and `#30` (**PASS**) audits | Pre- and post-remediation verification records | `#22` identified 4 blocking + 4 minor doc issues; `#30` verified all resolved (`328` local links, `50/50` SHA checks, Cargo/Node/AST/bytes) directly on `Gemini 4 Hydrogen (XHigh)` after Codex CLI hit quota | 2026-11-14 | Complete audit trail separating pre-remediation fail from post-remediation pass | Owner acceptance and hosted Web UI checks remain outside automated repository checks |
| Original HTML, offline bundles/archives, private app data, historical cloud/VM artifacts, live hosted settings/assets | Protected reference or external/private evidence boundaries | Reference role documented; original HTML body, offline backups, private runtime data, cloud artifacts, hosted settings/assets not read or mutated | Historical reports and explicit access limits | Boundary-only summary; no export or synchronization claimed | Existence, recoverability, external state and access remain unverified where not directly inspected |

A digest identifies bytes; it does not establish accuracy, permission, security, or acceptance. Detailed engineering/security/transfer/session evidence belongs in its assigned sibling owner (`EXECUTION_AND_CODING_LEDGER.md`, `SECURITY_HARDENING_DOSSIER.md`, `CONTINUITY_TRANSFER_GUIDE.md`, `SESSION_AND_DECISION_ARCHIVE.md`).

## 📚 Reading paths

**Quick orientation:** [AGENTS](../../AGENTS.md) → this map → [Current](CURRENT_STATE.md); README for product usage.

**Resume work:** Effective owner request → [Current authority](CURRENT_STATE.md#-current-authority) → [Continuation's exact next action](CONTINUATION_STATE.md#-exact-next-permitted-action) → actual branch/status/diffs → relevant ledger/transfer/security owner.

**Understand the system:** [Project Context](../1-%20PROJECT_CONTEXT.md) → [Architecture](../2-%20ARCHITECTURE.md) → actual `crates/`, `src-tauri/`, `ui/`, `mobile/`, and workflow source. Use [HANDOFF](../../HANDOFF.md) for Windows setup with the IPC correction above.

**Investigate a claim:** Identify acceptance/requirement source → [Execution Ledger](EXECUTION_AND_CODING_LEDGER.md) or [Security Dossier](SECURITY_HARDENING_DOSSIER.md) → exact artifact/revision, command/result and limits → owner decision if required.

**Reconstruct history:** [Numbered Session Summary](../4-%20SESSION_SUMMARY.md) (oldest-first) → [PBS Session & Decision Archive](SESSION_AND_DECISION_ARCHIVE.md) (PBS profile, newest-first) → relevant Git history/dated execution record. Consult [Transfer Guide](CONTINUITY_TRANSFER_GUIDE.md) for surviving versus non-transferable context.

## 🔄 Copies, mirrors and exports

| Copy / mirror | Original owner | Intended role | Last content comparison | Known lag / limitation |
|---|---|---|---|---|
| `origin`: [GitHub repository](https://github.com/CipherVaults/Percentage-Calculator-Tool) | Accepted/integrated repository history plus authorized owner publication | Shared remote source | `origin/handoff-local-dev` carries the verified 10-file PBS PR targeting `main` (`f3ba3f4` until owner merges) | Uncommitted drafts and offline worktrees do not automatically transfer |
| [GitHub Pages PWA](https://ciphervaults.github.io/Percentage-Calculator-Tool/) | Integrated `mobile/` plus `pages.yml` | Public deployed export | Deployment mechanism inspected; baseline publishing is historical HANDOFF evidence | No live byte/runtime comparison; clients retain device caches; workflow is main-only with path filters/manual dispatch |
| [GitHub Release v2.2.0](https://github.com/CipherVaults/Percentage-Calculator-Tool/releases/tag/v2.2.0) | Authorized tagged source/build and release pipeline | Installers, portable binary, standalone HTML, `SHA256SUMS.txt` | Local tag equals `f3ba3f4`; historical records report publication | Assets not downloaded/rehashed; existing-release CI can move the tag and clobber assets; a release is not a source backup |
| Owner-managed offline `git bundle` / source archive | Chosen repository snapshot and explicit backup procedure | Offline backup/transfer | Not created or inspected here | Follow Scenario B in [CONTINUITY_TRANSFER_GUIDE.md](CONTINUITY_TRANSFER_GUIDE.md); bundles omit uncommitted/untracked files and private app data |
| Local build/staged/final-output copies | Source revision, locked build and staging procedure | Generated deliverables | No build/output comparison in this documentation task | Gitignored, potentially stale or machine-specific; do not substitute for canonical source |
| Desktop app data and browser `localStorage` / PWA caches | Device owner and local application state | Per-device runtime storage, not a synchronized project mirror | Private contents not inspected | No automatic Git/device sync; explicit sanitized transfer required; storage schema comes from source |
| Historical Antigravity cloud/VM chats, uploads, audit scratch files, credentials and toolchain caches | Original session/environment and its access owner | Historical evidence only when separately recovered | Not available/compared in this task; HANDOFF describes non-transferability | Not delivered by a clone, PBS links or offline source bundle; credentials must not be exported into docs |

Refresh copies only through an authorized push/deployment/backup/export procedure. Record the source revision, output identity and comparison date; equal filenames or matching local refs do not prove synchronization.

## 🔐 Access and portability

Repository-relative documents and Git-tracked source travel cleanly with `git clone`, `git bundle`, or an offline source archive. Validate links against the integrated tree rather than unmerged drafts. A local file in an isolated worktree or a cloud conversation does not automatically travel with Git.

Remote publishing requires the executor's own valid authenticated access and action permission. Do not transfer ephemeral cloud credentials or assume historical `gh` authentication exists on another machine. Browser/desktop access, filesystem read/write access, network access, and GitHub repository permissions are separate capabilities.

Keep personal home/worktree paths, tokens, private screenshots/logs, history/settings contents, browser storage, signing material and backup secrets out of shared documents. Standard public environment paths such as `%APPDATA%\com.percentagecalculator.tool\` describe location only. An offline backup or device-state migration needs a separate owner-defined destination, scope and verification.

## ❓ Gaps and unresolved ownership

- **Question:** Does hosted `github-pages` environment protection restrict deployment branches/tags to `main`?
  - **Why it matters:** YAML's `refs/heads/main` guard does not prove the environment's independent hosted policy.
  - **Resolution source/owner:** Repository owner directly inspects GitHub `Settings -> Environments -> github-pages -> Deployment branches and tags`.
  - **Blocks:** A claim that hosted protection is verified; does not block PR review of local PBS documentation work.
- **Question:** Is the intended selected/SHA-pinned Actions allowlist enforced in GitHub `Settings -> Actions -> General`?
  - **Why it matters:** SHA-pinned workflow references do not establish account/repository policy.
  - **Resolution source/owner:** Repository owner provides direct sanitized UI evidence; settings changes need applicable authority.
  - **Blocks:** Hosted-policy completion claims; not PBS continuity maintenance.
- **Question:** Has the `handoff-local-dev` -> `main` Pull Request for the integrated 10-file PBS package been accepted and merged by the Project Owner?
  - **Why it matters:** Technical verification (`#30`, `E-08`) establishes package correctness, not owner adoption onto `main`.
  - **Resolution source/owner:** Project Owner reviews and merges the PR from `origin/handoff-local-dev` into `main` on GitHub.
  - **Blocks:** Promoting the package from verified PR state to merged `main` baseline.
- **Question:** Has the local `core.autocrlf true` divergence been deliberately resolved?
  - **Why it matters:** Byte-sensitive mobile assets must remain LF across tool edits/checkouts.
  - **Resolution source/owner:** Local executor checks effective config and actual bytes; any config change requires task scope permitting it.
  - **Blocks:** Claims of `core.autocrlf false` compliance; no config mutation is performed here.

## 📝 Change rule

Update this map when source ownership, canonical locations, access boundaries or reading routes change. Preserve superseded routes needed for recovery. Link the detailed owner rather than copying its complete contents. Record coordinator integration and owner adoption explicitly before calling this proposed contract accepted.
