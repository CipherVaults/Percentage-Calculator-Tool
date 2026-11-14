# 📘 Session: 2026-11-14 — Percentage Calculator Tool — AI PBS Continuity Adoption, Security Dossier & Handoff Package

> **Navigation:** [Historical Decision Records](#historical-decision-records) · [Root entry](../../AGENTS.md) · [Current State](CURRENT_STATE.md) · [Continuation State](CONTINUATION_STATE.md).
> **Related owners:** [Source Ownership Map](SOURCE_OWNERSHIP_MAP.md) · [Execution and Coding Ledger](EXECUTION_AND_CODING_LEDGER.md) · [Security Hardening Dossier](SECURITY_HARDENING_DOSSIER.md) · [Continuity Transfer Guide](CONTINUITY_TRANSFER_GUIDE.md). The 10-file package progressed from initial drafts (`5c53eb4`, `93f6768`, `317e98f`) and `#22` FAIL to `#23`–`#25` remediations (`b65739d`, `f03308a`, `ba4702e`), `#29` assembly, `#30` `verifier-2` PASS, and coordinator final reconciliation (`E-08`) on `handoff-local-dev`.

## 🤖 Models, Effort, Roles and Provenance

| Role / work block | Model or tool identity | Effort setting | Evidence basis and verification limit |
|---|---|---|---|
| Project Owner | Human owner | Not applicable | Current task brief (`/swarm with codex`, `/pbs-start-resume-handoff`, plus standing global workflow rules) authorizes AI PBS adoption, local commit on `handoff-local-dev`, and GitHub PR delivery to `main`; owner acceptance of the merged PR remains separate. |
| Swarm Coordinator | Main thread (`Gemini 4 Hydrogen (XHigh)` / `gemini-4-hydrogen-xhigh`) | `xhigh` | Orchestrated PR #8 and this PBS swarm (`#21`–`#30`). After an intermediate compaction resumed briefly on `gemini-flash-worker-agy`, aligned back to `gemini-4-hydrogen-xhigh` via `swarm` (`action: "model"`), reconciled final package state/errata (`E-08`), and completed commit/PR delivery. |
| `pbs-session` (Session & Decision Archive worker) | `Gemini 4 Hydrogen (XHigh)` + Codex CLI `codex-cli 0.169.0` (`-m gpt-6.1-sol`) | `xhigh` | Initial checkpoint `317e98f` off `f3ba3f4`; during `#25`, Codex CLI drafted/saved remediations before hitting an OpenAI usage limit, after which `pbs-session` finalized checks and committed `ba4702e` on `swarm-pbs-session-ca109c6a`. |
| `pbs-core` & `pbs-history` (Parallel PBS workers) | `Gemini 4 Hydrogen (XHigh)` + Codex CLI `codex-cli 0.169.0` (`-m gpt-6.1-sol`) | `xhigh` | Initial commits `5c53eb4` / `93f6768` failed `#22`; workers completed `#23` / `#24` remediations into `b65739d` (`pbs-core`) and `f03308a` (`pbs-history`), finishing remaining checks directly on `gemini-4-hydrogen-xhigh` after Codex CLI hit the OpenAI quota cap. |
| `verifier-2` (Post-merge verifier) | `Gemini 4 Hydrogen (XHigh)` (`codex exec` attempted) | `xhigh` | Pre-remediation `#22` audit used read-only Codex CLI `gpt-6.1-sol` / `xhigh` and reported technical passes alongside 4 blocking + 4 minor doc findings. Post-remediation `#30` audit attempted `codex exec`, hit OpenAI's usage cap (`try again at 6:32 PM`), and executed full **PASS** verification directly on `Gemini 4 Hydrogen (XHigh)` per the standing global fallback rule. |

**Record basis:** Part 1 records the complete `2026-11-14` PBS adoption cycle on `handoff-local-dev`: initial worker share commits (`5c53eb4`, `93f6768`, `317e98f`), `#21` assembly and `#22` FAIL, `#23`–`#25` remediations (`b65739d`, `f03308a`, `ba4702e`), `#29` integration, `#30` `verifier-2` PASS, and coordinator final reconciliation + `E-08` verification for PR submission to `main`. Also records the global workflow plugin (`swarm-codex-workflow`) and AI PBS skill (`pbs-start-resume-handoff`) setup from this conversation. Part 2 remains a post-hoc reconstruction of earlier architectural/security decisions through `f3ba3f4`, not a transcript of those sessions.

Provenance is role-specific and follows `swarm` member status and observed CLI outputs; configured labels do not independently attest billing internals, and the archive editor's identity is not attributed to historical implementation work.

## 🕒 Time

- Date / date range: `2026-11-14 (+02:00)`.
- Start: `~17:11+02:00` (contextual start of PBS adoption swarm following earlier PR #8 merge `f3ba3f4` at `15:30:03 +0200` and AI PBS v1.1 SkillSpector check/install).
- Continuation: Extended through initial assembly (`#21`), `#22` FAIL, `#23`–`#25` remediation (`b65739d`, `f03308a`, `ba4702e`), `#29` re-assembly, `#30` `verifier-2` PASS (`18:17+02:00`), standing global quota/fallback rule updates, and coordinator integration (`handoff-local-dev` commit + GitHub PR -> `main`). Earlier PR #8 remains distinct.
- End / stopping point: Integrated 10-file package committed cleanly on `handoff-local-dev`, pushed to `origin/handoff-local-dev`, with Pull Request open toward `main` (owner merge/acceptance and hosted GitHub Web UI checks remain pending).
- Session type: Documentation, continuity adoption, security/coding ledgering, historical decision reconstruction, and coordinated audit remediation.
- Project stage: Production `v2.2.0` baseline (`f3ba3f4`) — adopting AI PBS continuity layer on `handoff-local-dev`.
- Main focus: Deliver a source-owned, technically verified continuity/recovery/hardening layer locally and to GitHub via PR while preserving application code and historical documentation.
- Contributors: Project Owner, Swarm Coordinator (`Gemini 4 Hydrogen (XHigh)`), `pbs-core`, `pbs-history`, `pbs-session`, `verifier-2`, `monitor-2`, and Codex CLI (`gpt-6.1-sol`, until OpenAI usage limit).
- Model / effort: See role-specific provenance table above.
- Active working time: Continuous `2026-11-14` swarm session through coordinator integration.
- Reason for summary: Preserve complete adoption/audit/remediation lineage, honest Codex CLI quota fallback telemetry, verified technical scope, historical decision rationale, and exact owner PR review handoff.

## 🎯 Session Goal

The owner initiated AI PBS method v1.1 adoption alongside global skill/workflow configuration to remove thread-loss cold-start friction, support offline or GitHub-loss disaster recovery, capture coding and security hardening evidence, and enable clean transfer to another AI thread or human collaborator — saved both locally and in GitHub.

Initial share commits `5c53eb4`, `93f6768`, and `317e98f` failed `#22` on 4 blocking + 4 minor doc findings. Workers completed `#23`–`#25` remediations (`b65739d`, `f03308a`, `ba4702e`), coordinator re-integrated all 10 files (`#29`), `verifier-2` returned **PASS (`#30`)**, and coordinator reconciled live status/errata pointers and reran final checks (`E-08`) ahead of committing on `handoff-local-dev`, pushing `origin/handoff-local-dev`, and opening a Pull Request targeting `main`.

Explicit non-goals are application code changes, new product features, rerunning or reopening the already-merged PR #8 fix, force-pushing, bypassing `main` PR review, or claiming owner-side GitHub Web UI settings without inspection.

## 🧭 Starting State

The supplied `handoff-local-dev` / `main` baseline is `f3ba3f4`, also the locally resolved production tag `v2.2.0`. Git records PR #8 merging `dd9777e` at `2026-11-14 15:30:03 +0200`; that earlier fix already changed Mobile PWA caching to `pct-tool-v2.2.0-mobile-2`, network-first HTML navigation, and automatic refresh.

[Project Context](../1-%20PROJECT_CONTEXT.md), [Architecture](../2-%20ARCHITECTURE.md), [Roadmap](../3-%20ROADMAP.md), [Session Summary](../4-%20SESSION_SUMMARY.md), and [HANDOFF.md](../../HANDOFF.md) were intact. They contained substantial product history but no unified PBS source ownership map, continuation anchor, security hardening dossier, disaster-recovery transfer manual, or structured Decision Records. The cumulative Session Summary ended at line 435 and used oldest-first chronology; its earlier bodies remain historical evidence rather than live instructions.

## 🛠️ Actions Taken

### 1. Workflow and skill alignment; adoption scope

The supplied owner/coordinator brief established adoption of AI PBS method v1.1 and the separate documentation slices. The worker read the accessible PBS skill, portable single-project Session Summary and Decision Record templates, session-writing guide, profile guide, and relevant lifecycle prompt. This was alignment with existing local guidance; no skill installation or modification is claimed.

The earlier same-day PR #8 (`dd9777e` / `f3ba3f4`) remained the already-merged starting baseline. Its runtime validation is distinct from the completed initial `#22` documentation-package audit and the pending post-remediation re-verification.

### 2. Parallel ownership partition

The coordinator assigned `pbs-core` and `pbs-history` the root entry and sibling PBS records, `pbs-session` this archive plus the append-only legacy entry and top handoff callout, and `verifier-2` read-only merged-output verification. Initial worker commits (`5c53eb4`, `93f6768`, `317e98f`) failed `#22`, triggering `#23`–`#25` remediations (`b65739d`, `f03308a`, `ba4702e`), `#29` integration onto `handoff-local-dev`, `#30` `verifier-2` **PASS**, and coordinator final reconciliation + verification (`E-08`).

Final repo-relative destinations are the live tree checked on `handoff-local-dev`.

### 3. Direct evidence inspection

The worker and coordinator inspected Git history from `cb18ce1` through `f3ba3f4`, PR #1–#8 merge messages, resolved tags, Cargo manifests, and the actual owning sources: [percent-core](../../crates/percent-core/src/lib.rs), [golden parity](../../crates/percent-core/tests/golden_parity.rs), [Tauri main](../../src-tauri/src/main.rs), [commands](../../src-tauri/src/commands.rs), [Tauri configuration](../../src-tauri/tauri.conf.json), [capability](../../src-tauri/capabilities/default.json), [desktop HTML](../../ui/index.html), [desktop controller](../../ui/main.js), [mobile HTML](../../mobile/index.html), and [service worker](../../mobile/sw.js).

Inspection also covered [build CI](../../.github/workflows/build.yml), [Pages CI](../../.github/workflows/pages.yml), [.gitattributes](../../.gitattributes), [Cargo.toml](../../Cargo.toml), [README](../../README.md), `HANDOFF.md`, and `Documentation/1..4`. Both `verifier-2` (`#30`) and coordinator final checks (`E-08`) executed Cargo `fmt`/`clippy`/`test`, Node 10,661-case parity/CSP/sink/LF/workflow pins, local links/anchors, PowerShell AST, and protected byte preservation directly.

### 4. Drafting and local readback

At the initial `317e98f` checkpoint and `#25` (`ba4702e`), this LF/UTF-8 archive was authored, one adoption entry was appended after line 435 of [Session Summary](../4-%20SESSION_SUMMARY.md), and the three-line continuity callout was placed at [HANDOFF.md:5-7](../../HANDOFF.md) without modifying any historical body line. The legacy errata remain preserved at `HANDOFF.md` lines `21, 78, 81, 96, 123, 125` (baseline `18, 75, 78, 93, 120, 122`), with [EXECUTION_AND_CODING_LEDGER.md §4](EXECUTION_AND_CODING_LEDGER.md#4-verified-code-versus-legacy-document-discrepancies) supplying the canonical reconciliation.

### 5. Assembly, audit, remediation, and integration

The coordinator assembled initial drafts (`5c53eb4`, `93f6768`, `317e98f`) for `verifier-2` `#22`, which passed technical checks while raising 4 blocking + 4 minor findings. Workers completed `#23`–`#25` fixes (`b65739d`, `f03308a`, `ba4702e`), coordinator re-integrated all 10 files (`#29`), and `verifier-2` (`#30`) returned **PASS** (`328` local links/`0` broken, `50/50` SHA checks, exact protected line preservation, PowerShell AST, Cargo, and Node 10,661-case checks). During `#23`–`#25` and `#30`, Codex CLI hit OpenAI usage caps (`try again at 6:32 PM`), so workers, `verifier-2`, and coordinator completed remaining edits and verification on `Gemini 4 Hydrogen (XHigh)` per the standing fallback rule. Coordinator then applied final status/errata reconciliations, ran `E-08`, committed on `handoff-local-dev`, pushed `origin/handoff-local-dev`, and opened the Pull Request to `main`.

## 🧠 Key Insights

### Live entry and cumulative history answer different questions

The existing numbered documents preserve product context, architecture, direction, and oldest-first history. A live Current/Continuation entry guides the next action without rewriting those historical records. This archive holds the portable full Session Summary and reconstructed decisions, while the concise legacy append points readers here.

### Isolation prevents edit collisions and requires final integration reconciliation

Separate share worktrees protected parallel authoring; collecting all remediated commits onto `handoff-local-dev` (`#29`), running `#30` `verifier-2` across the full tree, and running post-reconciliation checks (`E-08`) prevented stale cross-file status drift before commit and PR creation.

### Implementation evidence is stronger than reconstructed intent

Git and code establish concrete changes, constants, and merge dates. They do not recover every option discussed or prove the identity of every earlier model. Part 2 labels inferred alternatives and separates source-backed behavior from explanatory reconstruction.

## 📌 Decisions Made

- **Confirmed by Project Owner — scope:** Adopt AI PBS v1.1 globally (`pbs-start-resume-handoff` skill alongside `swarm-codex-workflow` plugin rules for `Gemini 4 Hydrogen (XHigh)` coordinator, `codex exec` fallback to `Gemini 4 Hydrogen (XHigh)` on quota caps, and 95% coordinator quota safe-stop checkpointing) and across this repository (`AGENTS.md`, `Documentation/pbs/`, `HANDOFF.md:5-7`, `4- SESSION_SUMMARY.md`), saved locally on `handoff-local-dev` and in GitHub via Pull Request to `main`.
- **Confirmed for documentation architecture — owner-authorized worker implementation:** Preserve oldest-first chronology in `4- SESSION_SUMMARY.md`; place the portable thirteen-section Session Summary, provenance extension, and seven historical Decision Records here.
- **Completed verification; owner merge/acceptance pending:** `#23`–`#25` remediations (`b65739d`, `f03308a`, `ba4702e`), `#29` integration, `#30` `verifier-2` **PASS**, and coordinator `E-08` checks establish technical readiness on `handoff-local-dev` (`origin/handoff-local-dev` PR -> `main`). Owner PR merge, acceptance, and hosted GitHub Web UI settings checks remain pending.
- **Preservation and scope:** `HANDOFF.md:5-7` keeps the exact three-line callout layout, reconciling legacy errata at lines `21, 78, 81, 96, 123, 125` (baseline `18, 75, 78, 93, 120, 122`) to canonical `get_settings`, `set_settings`, and `check_for_updates` without altering protected historical bytes. Pre-existing `D:\Codex Projects\...` (`Documentation/4- SESSION_SUMMARY.md:79,123`) and `/home/antigravity/...` (`HANDOFF.md:306,308-309`) paths remain untouched in protected historical text.
- **Rejected within scope:** Rewriting protected session bodies, editing `golden.json` or `reference/`, pushing directly to `main`, force-pushing, running `--smoke-test` against the live clipboard, or guessing uninspected GitHub Web UI toggles are excluded.

## ⚠️ Difficulties / Friction

The isolated worktrees lacked checked-out sibling records during authoring, Windows legacy docs use CRLF while `Documentation/pbs/` uses LF, and Codex CLI hit its OpenAI usage cap mid-swarm (`try again at 6:32 PM`). Switching immediately to `Gemini 4 Hydrogen (XHigh)` per the standing fallback rule kept verification unblocked, while coordinator post-remediation reconciliation + `E-08` checks ensured no stale `"in progress"` wording remained before commit and PR creation.

## 🔧 Adjustments Made

- **Shifted from:** A single product handoff as the practical entry. **To:** A short PBS entry callout with links to distinct live and historical owners. **Because:** Thread recovery needs the next unfinished action as well as product facts. **Consequence:** Existing handoff sections stay intact and new records carry owned questions.
- **Shifted from:** Relying exclusively on Codex CLI until quota reset. **To:** Explicit fallback to `Gemini 4 Hydrogen (XHigh)` upon OpenAI usage limit + adding standing global rules for both Codex quota fallback and 95% coordinator quota safe-stop checkpointing (`swarm-codex-workflow`). **Because:** Preserves continuity without stalling or invoking prohibited models. **Consequence:** Audit provenance records both Codex CLI drafting and Gemini 4 Hydrogen (XHigh) completion honestly.
- **Shifted from:** Isolated share-branch pre-merge checkpoints. **To:** Full integrated `#29` assembly, `#30` `verifier-2` PASS, coordinator status reconciliation, `E-08` checks, and `origin/handoff-local-dev` PR -> `main`. **Because:** Only the integrated, reverified tree guarantees coherent cross-file state for collaboration and disaster recovery.

## ❌ Mistakes / Risks Noted

### Initial audit `#22` findings resolved through `#23`–`#25` and verified in `#30`

- **What happened:** `verifier-2` `#22` identified 4 blocking + 4 minor issues in initial assembly (stale worker rules in `AGENTS.md`, missing clean-tree gate in backup script, implicit clone branch in restore, blocking PowerShell GUI exit wait on `--smoke-test`, stale pre-merge text, shifted `HANDOFF` lines).
- **Actual impact:** Required coordinated remediation across `b65739d`, `f03308a`, `ba4702e`.
- **Correction / current status:** Resolved in `#23`–`#25`, integrated at `#29`, passed in `#30` `verifier-2`, reconciled in coordinator `E-08`, and committed on `handoff-local-dev` for PR review.

### Handoff-only updates or direct `main` pushes remain workflow risks

- **What happened or could happen:** Future updates to `HANDOFF.md` alone could cause drift, and direct pushes/merges to `main` trigger build/release/Pages workflows.
- **Correction / current status:** `AGENTS.md` and `SOURCE_OWNERSHIP_MAP.md` enforce single-source ownership and the `handoff-local-dev` -> PR -> `main` route.

## 📍 Current Position

**As of:** Final coordinator integration on `2026-11-14` on branch `handoff-local-dev`.

**Before this session:** Production `v2.2.0` at `f3ba3f4` included PR #8 (`dd9777e`, `pct-tool-v2.2.0-mobile-2`); product documents lacked a unified AI PBS continuity/security/recovery layer.

**This session accomplished:** Installed `pbs-start-resume-handoff` after SkillSpector check; saved standing global `swarm-codex-workflow` plugin rules (including `Gemini 4 Hydrogen (XHigh)` coordinator, Codex fallback, and 95% usage safe-stop); produced and remediated all 10 PBS files across `#21`–`#30`; verified (`#30` & `E-08`), committed on `handoff-local-dev`, pushed `origin/handoff-local-dev`, and opened the PR toward `main`.

**Current standing:** Package technically verified (`#30`, `E-08`) and delivered locally and on GitHub (`origin/handoff-local-dev` -> `main` PR). **Pending:** Owner PR review/merge into `main`, owner hosted GitHub Web UI verification (`github-pages` & `Actions -> General`), and optional offline `git bundle` backup creation.

## 🔜 Next Steps

1. **Project Owner — review and merge PR (`handoff-local-dev` -> `main`):** Inspect the combined diff and Ledger `E-08` results; merge when satisfied.
2. **Project Owner — verify hosted GitHub Web UI settings:** Confirm `Settings -> Environments -> github-pages` (`main`-only protection) and `Settings -> Actions -> General` (selected/SHA-pinned Actions allowlist).
3. **Maintainer / Owner — offline backup (recommended):** Optionally generate and test an offline `git bundle` using [CONTINUITY_TRANSFER_GUIDE.md](CONTINUITY_TRANSFER_GUIDE.md#scenario-b-github-lost-or-offline-backup-recovery).

**Do not reopen / repeat:** Accepted v1.1–v2.2.0 product work, PR #8 cache fix, or completed `#23`–`#25` authoring slices.

## ❓ Open Questions

- Will the Project Owner merge the `handoff-local-dev` -> `main` PR after review? **Needed from:** Owner PR review. **Blocks:** Promoting this continuity layer onto `main`.
- Are GitHub Actions restrictions and the `github-pages` environment deployment rule configured as intended? **Needed from:** Owner-visible GitHub Web UI. **Blocks:** Hosted-settings assurance; repository YAML alone cannot prove them.

## 🧾 Session Outcome

Delivered the integrated, technically verified (`#30` & `E-08`) 10-file AI PBS continuity, security hardening dossier, coding ledger, disaster recovery/transfer guide, and historical decision archive locally on `handoff-local-dev` and remotely via `origin/handoff-local-dev` PR -> `main`. Application code and protected historical bytes (`4- SESSION_SUMMARY.md` L1–435, `HANDOFF.md` body/errata/path lines) remain untouched. Owner PR merge/acceptance and hosted GitHub UI inspection remain pending.

## 🔍 Confidence Level

**Historical repository/code citations & baseline parity:** High. **Why:** Commit history, symbols, 10,661 fixtures, CSP hashes, Cargo suite, and workflow pins were directly verified in `#30` and `E-08`. **Not higher because:** Hosted UI settings, real-window desktop smoke/installer install, and live PWA device refresh were not executed in this documentation session.

**Integrated 10-file continuity package:** High (technical) / pending owner acceptance. **Why:** `#30` (`verifier-2`) and `E-08` passed Cargo, Node, `328` links, PowerShell AST, privacy/placeholder, and protected byte-preservation checks across the integrated tree.

## 📚 Artifacts / Documents Created or Updated

| Artifact | Purpose / owner | State at integration |
|---|---|---|
| [AGENTS.md](../../AGENTS.md) | Root AI entry / coordinating maintainer | Remediated in `b65739d`, verified `#30`/`E-08`, reconciled on `handoff-local-dev` |
| [SOURCE_OWNERSHIP_MAP.md](SOURCE_OWNERSHIP_MAP.md) | Primary owner per question / coordinating maintainer | Remediated in `b65739d`, verified `#30`/`E-08`, reconciled on `handoff-local-dev` |
| [CURRENT_STATE.md](CURRENT_STATE.md) | Live orientation / coordinating maintainer | Remediated in `b65739d`, verified `#30`/`E-08`, reconciled on `handoff-local-dev` |
| [CONTINUATION_STATE.md](CONTINUATION_STATE.md) | Immediate next actions / active executor | Remediated in `b65739d`, verified `#30`/`E-08`, reconciled on `handoff-local-dev` |
| [EXECUTION_AND_CODING_LEDGER.md](EXECUTION_AND_CODING_LEDGER.md) | Execution/check evidence (`E-01`–`E-08`) / engineering recorder | Remediated in `f03308a`, verified `#30`/`E-08`, reconciled on `handoff-local-dev` |
| [SECURITY_HARDENING_DOSSIER.md](SECURITY_HARDENING_DOSSIER.md) | Security scope and hosted-check gaps / security maintainer | Remediated in `f03308a`, verified `#30`/`E-08`, reconciled on `handoff-local-dev` |
| [CONTINUITY_TRANSFER_GUIDE.md](CONTINUITY_TRANSFER_GUIDE.md) | Offline recovery and collaborator transfer / transfer maintainer | Remediated in `f03308a`, verified `#30`/`E-08`, reconciled on `handoff-local-dev` |
| [SESSION_AND_DECISION_ARCHIVE.md](SESSION_AND_DECISION_ARCHIVE.md) | Full dated session and historical decisions (`DR-001`–`DR-007`) / session recorder | Remediated in `ba4702e`, verified `#30`/`E-08`, reconciled on `handoff-local-dev` |
| [4- SESSION_SUMMARY.md](../4-%20SESSION_SUMMARY.md) | Concise oldest-first adoption append / session recorder | Remediated in `ba4702e`, original L1–435 CRLF preserved, verified `#30`/`E-08` |
| [HANDOFF.md](../../HANDOFF.md) | Quick continuity callout (`L5-7`) / transfer maintainer | Remediated in `ba4702e`, L1–4 & L8–311 CRLF byte-preserved, verified `#30`/`E-08` |

## 🤝 Collaborator Contribution

Owner supplied requirements and global workflow rules; Coordinator integrated slices and completed `E-08` / PR delivery on `Gemini 4 Hydrogen (XHigh)`; `pbs-core` (`b65739d`), `pbs-history` (`f03308a`), and `pbs-session` (`ba4702e`) authored and remediated slices (with Codex CLI `gpt-6.1-sol` until OpenAI quota limit); `verifier-2` delivered `#22` review and `#30` post-remediation **PASS** directly on `Gemini 4 Hydrogen (XHigh)`.

## 🧪 Validation / Testing

- **Initial `#22` pre-remediation audit:** Passed technical checks (`cargo`, Node `10,661`, `315` links) with 4 blocking + 4 minor documentation findings.
- **Post-remediation `#30` `verifier-2` audit:** All `#22` findings resolved; `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets --locked -- -D warnings`, `cargo test --workspace --locked` (9+1+3 passed), Node (`ALL_MOBILE_CHECKS_OK (10661 cases)`, exact SHA-256 CSP, zero DOM/eval/style sinks, LF verified, 9+4 pinned workflow Actions with `persist-credentials: false`), `TOTAL_LOCAL_LINKS=328 BROKEN=0`, `SHA_CHECK total=50 bad=0`, `HANDOFF_PRESERVATION_DIFFS=0`, `SUMMARY_435_DIFFS=0`, and PowerShell AST (`4/4 AGENTS.md`, `15/15 CONTINUITY_TRANSFER_GUIDE.md`, `10/11 HANDOFF.md`) all passed.
- **Coordinator post-reconciliation `E-08` checks:** Rerun on the final integrated `handoff-local-dev` working tree prior to commit and push (see [EXECUTION_AND_CODING_LEDGER.md §5](EXECUTION_AND_CODING_LEDGER.md#5-pbs-evidence-summary)).

## 🗂️ Documentation Updates Needed

Owner merges PR to `main` (triggering standard repo checks) and updates [CURRENT_STATE.md](CURRENT_STATE.md) / [CONTINUATION_STATE.md](CONTINUATION_STATE.md) upon acceptance or after inspecting GitHub Web UI settings (`github-pages` and `Actions -> General`). Preserve `4- SESSION_SUMMARY.md` oldest-first order, `HANDOFF.md:5-7` callout bounds, and historical paths/errata references.

## 🚫 Deferred Work

Direct PR merge into `main`, hosted GitHub Web UI verification (`github-pages` & `Actions -> General`), optional offline `git bundle` archive creation (Scenario B), `--smoke-test` / NSIS / MSI / portable desktop installer rebuilds, and optional roadmap features (`3- ROADMAP.md`) remain deferred to owner action.

---

<a id="historical-decision-records"></a>

# ⚖️ Historical Architectural & Security Decision Records (v2.0.0–v2.2.0)

These seven records are **historical reconstructions from git commits, PR merges (#1–#8), Documentation/1..4, HANDOFF.md, and source files**, with evidence cutoff `f3ba3f4`. They were recorded on `2026-11-14`; they are **not contemporaneous decision transcripts**. Commit dates establish implementation/merge checkpoints, not the unrecorded moment of human deliberation. “Confirmed” below means the choice is demonstrably implemented/merged; it does not invent a separate approval transcript, fresh security certification, or current hosted-service verification.

The surviving merge chain is PR #1 `b2d0a6f`, #2 `f59035d`, #3 `6f81290`, #4 `6a97dea`, #5 `ccd6ee8`, #6 `6371ddc`, #7 `ccc3899`, and #8 `f3ba3f4`. PR #7 carries the updated handoff (`ec8ad5c`); it is documentation evidence rather than a separate application architecture change. Alternatives are reconstructed comparisons unless a source explicitly records an actual predecessor. Source paths below resolve from this archive and refer to the inspected cutoff; use Git history when later files change.

## ⚖️ Decision Record: DR-001 — Replace Electron/Node Desktop Shell with Tauri v2 + Pure Rust (percent-core)

**Project:** Percentage Calculator Tool.

**Status:** Confirmed in implementation and merged history; reconstructed rationale.

**Decision date:** Original deliberation not recorded; implementation and PR #1 merge on `2026-11-09`.

**Recorded by:** pbs-session, historical archive editor on `2026-11-14`.

**Decision owner:** Project Owner / maintainers, as evidenced by accepted PR history; no separate deliberation transcript recovered.

**Scope / authority:** Desktop runtime, calculation ownership, static UI boundary, and rollback baseline for `v2.0.0`; historical record only, no new migration authority.

**Reconstruction basis & confidence boundary:** High for changed artifacts and tag targets; Medium for summarized motivations and inferred alternatives.

### Context and Question

The existing Electron v1.1 desktop app wrapped the local calculator with Node, a preload bridge, and bundled Chromium. [Project Context](../1-%20PROJECT_CONTEXT.md) and [Roadmap](../3-%20ROADMAP.md) describe the intended leaner runtime while preserving appearance and math: could the shell become Tauri/Rust without changing calculator results?

### Options Considered

- **Retain Electron/Node:** Actual predecessor, preserving familiar packaging and JavaScript runtime; retains its bundled runtime and toolchain. This is a verified prior architecture, not evidence of a recorded vote to reject it.
- **Tauri v2 with pure Rust math and static frontend:** Implemented option; removes the bundled Node/Chromium shell and isolates math from UI/OS dependencies, at the cost of Rust/Tauri tooling and system-webview dependence.
- **Framework/UI rewrite:** A possible comparison, not a recovered proposal. It would enlarge migration scope without serving the recorded behavior-preservation goal.

### Decision

Use a Cargo workspace with `crates/percent-core` for pure formulas and `src-tauri` for the desktop shell; keep `ui/` static. Preserve rollback tag `v1.1.0-electron`, resolving to `6afa7fb`, before deleting legacy Electron files.

**Decision evidence:** `a666893` adds percent-core/golden tests; `428ced4` adds Tauri/static UI/smoke test; `ab640f1` removes Electron/Node/Vitest; PR #1 merges at `b2d0a6f`. Subsequent `7f66f93` adds tag-triggered release publishing and is the resolved `v2.0.0` tag target. The PR merge and release tag are distinct commits.

### Rationale and Tradeoffs

The numbered documents explicitly favor a small, local, understandable utility. The pure Rust boundary supports testing without Tauri, while the system webview reduces bundled runtime responsibilities. Costs include native build prerequisites and implementing JavaScript-compatible rounding rather than simply using Rust's default formatting. Claims about exact binary-size or performance gains are outside the inspected evidence.

### Consequences

**What changes:** Desktop requests flow from static JS through typed Rust IPC to percent-core; Electron-era runtime/package files are removed from the active tree.

**What remains outside scope:** Product redesign, new cloud services, and native mobile store applications.

**Risks / mitigation:** Math drift is controlled by DR-003's fixtures; rollback is available through the preserved Electron tag. Native toolchain and WebView2 requirements remain real.

**Affected owner records:** [Architecture](../2-%20ARCHITECTURE.md), [Roadmap](../3-%20ROADMAP.md), [HANDOFF.md](../../HANDOFF.md), and [Source Ownership Map](SOURCE_OWNERSHIP_MAP.md) (integrated via `b65739d`, verified `#30`/`E-08`).

### Implementation and Verification

**Next action / owner:** No migration execution authorized by this record; future maintainers should preserve the math boundary and rollback history.

**Applied state:** Implemented at the cited commits and present in [Cargo.toml](../../Cargo.toml), [percent-core](../../crates/percent-core/src/lib.rs), and [Tauri main](../../src-tauri/src/main.rs). Numbered session history reports golden and real-window migration checks; no fresh build was run for this archive.

**Acceptance:** PR #1 demonstrates repository integration; `v2.0.0` identifies the subsequent release checkpoint. No separate owner-acceptance transcript is claimed.

### Revisit / Supersession

**Revisit when:** A supported-platform or runtime requirement changes, or parity/security evidence justifies reopening the boundary.

**Supersedes:** Electron/Node shell at rollback baseline `6afa7fb`.

**Superseded by:** None through `f3ba3f4`; later features extend this structure.

**Dated update:** `2026-11-14` reconstruction; `v2.2.0` still uses Tauri v2 and percent-core.

**Historical source citations & confidence boundary:** `git show a666893`, `428ced4`, `ab640f1`, `b2d0a6f`, `7f66f93`; resolved `v1.1.0-electron` tag; [Project Context](../1-%20PROJECT_CONTEXT.md), [Architecture](../2-%20ARCHITECTURE.md), [Session Summary](../4-%20SESSION_SUMMARY.md). High implementation confidence; historical intent is a bounded synthesis of those records.

## ⚖️ Decision Record: DR-002 — Keep Plain HTML/CSS/JS with Zero Frameworks, Zero Bundler, and Zero Unsafe DOM Sinks

**Project:** Percentage Calculator Tool.

**Status:** Confirmed in source and CI; reconstructed comparison of alternatives.

**Decision date:** Static UI established `2026-11-09`; Mobile edition and expanded hardening `2026-11-13`. Exact original discussion time not recorded.

**Recorded by:** pbs-session, historical archive editor on `2026-11-14`.

**Decision owner:** Project Owner / maintainers through merged PRs #1, #3, and #4.

**Scope / authority:** `ui/`, `mobile/`, and their DOM-hygiene CI checks; no authority to add a frontend build pipeline.

**Reconstruction basis & confidence boundary:** High for implementation and configured checks; no claim that every possible injection mechanism is excluded by a regex.

### Context and Question

The small terminal-style utility needed to retain understandable local assets across desktop and standalone mobile HTML. The question was how to extend the interface without adding framework/build complexity or treating calculated/history text as executable markup.

### Options Considered

- **Plain HTML/CSS/JS:** Adopted in [ui/index.html](../../ui/index.html), [ui/main.js](../../ui/main.js), and [mobile/index.html](../../mobile/index.html); direct source editing and no runtime npm dependency.
- **Framework plus bundler:** Inferred alternative; not a documented evaluated proposal. It offers component tooling but introduces a build/dependency layer the project explicitly excludes.
- **String-to-HTML rendering:** Verified earlier desktop implementation removed in `b508cd7`; compact templates accept unnecessary markup interpretation compared with DOM node construction.

### Decision

Keep zero frontend frameworks, zero bundler, and zero unsafe DOM/eval sinks in the checked runtime sources. Render with `textContent`, `createTextNode`, `createElement`, and `replaceChildren`; label strings containing `<br>` are split into text and explicit line-break nodes rather than injected as HTML.

**Decision evidence:** `b508cd7` replaces desktop `innerHTML` sinks and gates smoke-result IPC; `fe39548` introduces the standalone Mobile HTML; `3464804` expands validation, safe lookups, CSP, and CI checks. [build.yml](../../.github/workflows/build.yml) rejects `.innerHTML`, `.outerHTML`, `eval(...)`, and `new Function` in desktop JS, mobile inline JS, and service worker; [pages.yml](../../.github/workflows/pages.yml) repeats the mobile/SW check before deployment.

### Rationale and Tradeoffs

Source simplicity matches the recorded project philosophy and allows the Mobile edition to remain one standalone HTML file. Safe node construction avoids interpreting persisted or calculated strings as markup. The tradeoff is maintaining some parallel desktop/mobile presentation logic and explicit event wiring. A sink scan is a useful regression barrier, not a full security proof or an exhaustive JavaScript analyzer.

### Consequences

**What changes:** UI behavior is maintained directly in static assets; Node is a verification tool, not the application's frontend runtime dependency.

**What remains outside scope:** A component framework migration, bundling system, or claim of universal XSS immunity.

**Risks / mitigation:** Desktop/mobile drift is checked through shared fixtures and explicit UI/sink checks; mobile inline changes also require CSP digest updates (DR-005).

**Affected owner records:** [Architecture](../2-%20ARCHITECTURE.md), [README](../../README.md), [Security Hardening Dossier](SECURITY_HARDENING_DOSSIER.md) and [Execution and Coding Ledger](EXECUTION_AND_CODING_LEDGER.md) (integrated via `f03308a`, verified `#30`/`E-08`).

### Implementation and Verification

**Next action / owner:** Future UI maintainers preserve safe DOM construction and run the relevant workflow checks after source changes; no frontend rewrite is authorized here.

**Applied state:** Present at `f3ba3f4`; source and CI inspected directly. Sink and parity checks passed across `#22`, `#30`, and `E-08`; this archive claims no new live UI runtime test.

**Acceptance:** Merged implementation through PRs #1/#3/#4; the 10-file PBS continuity package passed `#30` and `E-08` on `handoff-local-dev`, with owner PR merge and acceptance pending.

### Revisit / Supersession

**Revisit when:** UI complexity creates a demonstrated maintenance need warranting owner-approved tooling changes.

**Supersedes:** Earlier desktop string-to-HTML rendering, as shown by `b508cd7`.

**Superseded by:** None through `f3ba3f4`.

**Dated update:** `2026-11-14` reconstruction confirms the plain frontend and configured sink checks remain in the production baseline.

**Historical source citations & confidence boundary:** `b508cd7`, `fe39548`, `3464804`; [desktop JS](../../ui/main.js), [mobile HTML](../../mobile/index.html), [build CI](../../.github/workflows/build.yml), [Pages CI](../../.github/workflows/pages.yml), [HANDOFF.md](../../HANDOFF.md). High for scoped source facts; inferred alternatives are not recovered deliberation.

## ⚖️ Decision Record: DR-003 — Preserve Byte-for-Byte v1.1 JavaScript Math and Rounding Across 10,661 Golden Cases

**Project:** Percentage Calculator Tool.

**Status:** Confirmed compatibility contract and implemented tests; reconstructed rationale.

**Decision date:** Golden/Rust implementation `2026-11-09`; Mobile parity `2026-11-13`; v2.2.0 UI range guards `2026-11-13`.

**Recorded by:** pbs-session, historical archive editor on `2026-11-14`.

**Decision owner:** Project Owner / maintainers through PR #1 and subsequent feature merges.

**Scope / authority:** Original five calculators and decimal formatting fixtures, with shared formatting for Markup/Margin and Tax/VAT; no universal numerical-equivalence claim.

**Reconstruction basis & confidence boundary:** High for fixture count, implementation, and assertions; finite fixtures do not establish equality for every possible floating-point input.

### Context and Question

Moving math from JavaScript to Rust risks visible rounding/format changes even when formulas look identical. Rust's rounding and default decimal tie handling differ from the original utility. The project required the original labels, errors, and copy formatting to remain stable.

### Options Considered

- **Use Rust default rounding/formatting:** Inferred shortcut; source comments explicitly identify incompatible tie behavior.
- **Reproduce the original JavaScript formatting sequence:** Implemented option, supported by generated fixtures and focused unit tests.
- **Change rounding as product policy:** An inferred alternative outside the stated no-regression migration goal; no approval to redefine calculator results was found.

### Decision

Implement [percent-core](../../crates/percent-core/src/lib.rs) helpers `js_round`, `js_to_fixed_2`, `js_exponential`, and `format_decimal`. `js_round` follows half-toward-positive-infinity behavior, including `-2.5 -> -2.0`, negative zero handling, and the integer boundary at `2^52`; `js_to_fixed_2` handles exact eighth-value ties away from zero rather than Rust's ties-to-even formatting. `format_decimal` applies the original round-to-cents sequence, normalizes zero, handles non-finite results, and switches to JavaScript-style exponent text at magnitude `1e21`.

**Decision evidence:** `a666893` introduces Rust/golden fixtures and [golden_parity.rs](../../crates/percent-core/tests/golden_parity.rs). The actual [fixture file](../../crates/percent-core/tests/fixtures/golden.json) contains 10,661 cases. Both CI workflows extract the Mobile math block into a Node `vm` context and compare it with those same fixtures. `085dad6` adds unified `"Value out of range"` guards in the Desktop/Mobile UI without rewriting the core compatibility contract.

### Rationale and Tradeoffs

Preserving established output avoids a migration changing user-visible results. The fixtures exercise the original five calculators and formatter; newer Markup/Margin and Tax/VAT share formatting and have Rust unit/smoke coverage, but are not seven calculators exhaustively covered by the original golden corpus. The extra helpers require care, yet make compatibility intent explicit.

The v2.2.0 range guard is a presentation boundary: `ui/main.js` and Mobile live-update functions reject non-finite input/results and invalidate copy candidates. The Rust core can still return compatibility values such as formatted infinity for direct calls; the guard must not be misdescribed as a new universal Rust-core rejection.

### Consequences

**What changes:** Numerical implementation language changes while tested original output strings remain stable.

**What remains outside scope:** Arbitrary-precision decimal finance, exhaustive proof over all `f64` values, or silent fixture regeneration to bless changed behavior.

**Risks / mitigation:** Edge-case drift is limited by golden checks and targeted unit tests; retain both the corpus and its historical generation basis.

**Affected owner records:** [Architecture](../2-%20ARCHITECTURE.md), [Session Summary](../4-%20SESSION_SUMMARY.md), and [Execution and Coding Ledger](EXECUTION_AND_CODING_LEDGER.md) (integrated via `f03308a`, verified `#30`/`E-08`).

### Implementation and Verification

**Next action / owner:** Formula/format maintainers run Rust golden tests and Mobile Node parity after relevant code changes; intentional behavior changes need an explicit owner decision.

**Applied state:** Helpers, Rust assertions, and Node `vm` CI checks exist at `f3ba3f4`; fixture count was read directly. Earlier sessions report passing parity, and Cargo plus all 10,661 Mobile parity cases passed across `#22`, `#30`, and `E-08`.

**Acceptance:** PR #1 accepted the migration implementation; later PR #3/#6 preserve and extend it. Fixture success alone is not owner acceptance of a future behavior change.

### Revisit / Supersession

**Revisit when:** A reproducible discrepancy is found or an explicit product decision changes rounding/range policy.

**Supersedes:** JavaScript as the desktop execution language for the original formulas, not its output contract.

**Superseded by:** None through `f3ba3f4`.

**Dated update:** `2026-11-14` reconstruction separates preserved core math from v2.2.0 UI overflow/copy safety.

**Historical source citations & confidence boundary:** `a666893`, `fe39548`, `09e1ebf`, `085dad6`; [core helpers](../../crates/percent-core/src/lib.rs), [golden test](../../crates/percent-core/tests/golden_parity.rs), [Mobile math](../../mobile/index.html), and both CI workflows. High for scoped contract and code; historical test passes are attributed reports, not rerun evidence.

## ⚖️ Decision Record: DR-004 — Enforce Least-Privilege Tauri Capability and Harden Rust IPC and Local Persistence

**Project:** Percentage Calculator Tool.

**Status:** Confirmed implementation; historical security rationale reconstructed.

**Decision date:** Initial capability `2026-11-09`; empty permission list and storage hardening `2026-11-13`; settings added later that day.

**Recorded by:** pbs-session, historical archive editor on `2026-11-14`.

**Decision owner:** Project Owner / maintainers through PR #4 and PR #6.

**Scope / authority:** Tauri frontend grants, CSP, custom IPC validation, local history/settings persistence, and smoke-test isolation; no blanket filesystem or OS-security guarantee.

**Reconstruction basis & confidence boundary:** High for code/configuration; historical audit outcome is attributed to repository documentation, not a fresh audit.

### Context and Question

Persistent history and clipboard commands expanded the native boundary. The initial capability included `core:default` and `clipboard-manager:allow-write-text`, though the UI used custom Rust commands. Stored JSON and IPC inputs also needed consistent validation, bounded I/O, and failure behavior.

### Options Considered

- **Retain broad built-in/plugin frontend permissions:** Verified initial state in `428ced4`; simpler defaults but unnecessary for the actual custom-command interface.
- **Empty capability permissions plus validated custom handlers:** Implemented in `3464804`; narrows frontend grants while retaining native functionality behind Rust checks.
- **Direct overwrites and mutate-before-save storage:** A reconstructed comparison to the hardened design, not a recovered formal proposal; it risks partial files or memory/disk divergence on failure.

### Decision

Set [capabilities/default.json](../../src-tauri/capabilities/default.json) to `permissions: []`; custom commands remain exposed through the handler list in [main.rs](../../src-tauri/src/main.rs). Empty built-in/plugin grants do not mean there is no native command surface. Keep [desktop CSP](../../src-tauri/tauri.conf.json): `default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`.

In [commands.rs](../../src-tauri/src/commands.rs), use `read_regular_file_limited` with `HISTORY_MAX_FILE_BYTES = 1024 * 1024` and `SETTINGS_MAX_FILE_BYTES = 4096`; reject symlink/non-file targets and cap actual reads. Share `validate_entry_fields` between new and stored history. `ALLOWED_CALCULATORS` is `change`, `percent`, `what`, `discount`, `base`, `markup`, `tax`; `MAX_FIELD_LEN = 256` bounds nonempty string fields in Rust bytes, optional mode permits only `add`/`extract`, `HISTORY_MAX_ENTRIES = 500`, and `MAX_COPY_LEN = 4096` caps clipboard writes in bytes.

`write_atomic_private` checks parent/target type, creates unique `history.json.<pid>.<seq>.tmp` or `settings.json.<pid>.<seq>.tmp` files exclusively with `create_new(true)`, writes and `sync_all()`s before rename, and cleans up failed temporary commits. Unix temporary files use `0o600`; newly created parent directories receive a best-effort `0o700` permission change. `history_add`, `history_delete`, `history_clear`, and `set_settings` hold their state lock across persistence and commit memory only after success. `--smoke-test` makes both stores `in_memory_only` and avoids loading user disk data.

**Decision evidence:** Initial grants in `428ced4`; hardening `3464804` and Windows conditional-variable fix `9ebc1c7`, merged via PR #4 `6a97dea`; settings/history extensions `085dad6`, merged via PR #6 `6371ddc`. Actual IPC symbols are `get_settings`, `set_settings`, and `check_for_updates`; older handoff aliases are not authoritative symbols.

### Rationale and Tradeoffs

The narrowed grants and strict CSP reduce unnecessary frontend authority. Shared load/add validation treats disk JSON as untrusted input. Atomic write and commit-on-success ordering reduce accidental corruption and state divergence, at the cost of longer-held locks and explicit error paths. Symlink checks are defense in depth; inspected code does not establish immunity to all filesystem races, ancestor links, hostile local processes, or Windows ACL threats.

### Consequences

**What changes:** Native capabilities remain available only through the explicit command interface, with bounded history/settings/clipboard handling.

**What remains outside scope:** Encryption, synchronization, backups of per-device history, full crash durability proof, or a fresh security certification.

**Risks / mitigation:** Smoke mode protects disk stores but still writes the real system clipboard. Platform-conditional Unix checks do not establish Windows-specific protection equivalence; Windows Clippy catches conditional compilation regressions.

**Affected owner records:** [Architecture](../2-%20ARCHITECTURE.md), [HANDOFF.md](../../HANDOFF.md), [Security Hardening Dossier](SECURITY_HARDENING_DOSSIER.md) and [Continuity Transfer Guide](CONTINUITY_TRANSFER_GUIDE.md) (integrated via `f03308a`, verified `#30`/`E-08`).

### Implementation and Verification

**Next action / owner:** Storage/IPC maintainers preserve validation and persistence ordering; Workspace checks verified across `#22`, `#30`, and `E-08`.

**Applied state:** Present at `f3ba3f4`; command unit tests cover shared validation, bounded reads/atomic writes, and Unix symlink rejection. This worker inspected those tests; the later initial `#22` audit reported passing Cargo tests. No fresh persistence/runtime test is claimed for `#25`.

**Acceptance:** PR #4 and #6 record integration. Repository prose reports zero confirmed findings in the earlier source audit; that scoped historical result is not proof of no vulnerabilities.

### Revisit / Supersession

**Revisit when:** Adding an IPC command, persistence schema, platform target, or a reproducible local-storage/security defect.

**Supersedes:** Initial built-in/plugin grants from `428ced4` and earlier less-hardened persistence.

**Superseded by:** None through `f3ba3f4`; settings reuse the hardened storage helper.

**Dated update:** `2026-11-14` reconstruction records exact current limits and narrows older prose about private/atomic storage to what code establishes.

**Historical source citations & confidence boundary:** `428ced4`, `3464804`, `9ebc1c7`, `085dad6`, PR #4 `6a97dea`, PR #6 `6371ddc`; [commands](../../src-tauri/src/commands.rs), [main](../../src-tauri/src/main.rs), [capability](../../src-tauri/capabilities/default.json), [config](../../src-tauri/tauri.conf.json). High implementation confidence; OS-level security and prior audit execution are not independently revalidated.

## ⚖️ Decision Record: DR-005 — Pin Mobile Inline CSP Hashes and Harden the Scoped Network-First Service Worker

**Project:** Percentage Calculator Tool.

**Status:** Confirmed implementation, including the earlier same-day PR #8 fix.

**Decision date:** Mobile introduction/hardening `2026-11-13`; stale-cache correction `2026-11-14`, merged at `15:30:03 +0200`.

**Recorded by:** pbs-session, historical archive editor on `2026-11-14`.

**Decision owner:** Project Owner / maintainers through PR #3, #4, #6, and #8.

**Scope / authority:** Mobile HTML execution policy, on-device storage, offline cache scoping, and update refresh; no new PWA code change authorized here.

**Reconstruction basis & confidence boundary:** High for exact cutoff bytes/code and merge sequence; fresh browser/device behavior is untested by this worker.

### Context and Question

A self-contained Mobile HTML/PWA needs inline CSS/JS and offline caching. Those features should not require unrestricted inline execution or keep serving obsolete HTML after deployment. Earlier cache-first navigation caused a stale-cache bug; PR #8 corrected the live-update path before this PBS session.

### Options Considered

- **Unrestricted inline execution:** Inferred alternative to hash pinning; convenient editing but weaker script/style policy.
- **Exact SHA-256 meta CSP:** Implemented hardening in `3464804`; standalone operation remains possible, with a digest-maintenance cost for every inline byte change.
- **Cache-first HTML navigation:** Verified predecessor; fast offline reuse but can retain old application HTML. PR #8 replaces this path while retaining cache-first/background-revalidated static assets.
- **Network-first navigation with offline fallback and refresh coordination:** Implemented `dd9777e` / PR #8; accepts online network dependence for freshness and automatic reload when an old controlled app upgrades.

### Decision

Keep [mobile/index.html](../../mobile/index.html) protected by meta CSP with `default-src 'none'`, hash-only style/script sources, `worker-src 'self'`, `child-src 'self'`, `img-src 'self' data:`, `manifest-src 'self'`, `connect-src 'self' https://api.github.com`, `object-src 'none'`, `base-uri 'none'`, and `form-action 'none'`, plus `no-referrer`. At `f3ba3f4`, the exact digests are:

| Inline block | Verified CSP digest |
|---|---|
| `<style>` | `sha256-HppoWhfVX+UyR2KqXbS6U2Q3KafIo1MVyti/h94cX9o=` |
| `<script>` | `sha256-655QfOPjmPDnhT1lUo4K5UBkQqBy3BB3EYZt7mnAKdg=` |

These are hashes of the exact current inline block bytes, not timeless identifiers. [.gitattributes](../../.gitattributes) pins LF for Mobile HTML/JS/manifest and desktop HTML/CSS/JS. Retain schema-validated local storage under `pct_tool_history_v2` and `pct_tool_settings_v1`, 500-entry history/256-character field limits in JS, calculator/mode allowlists, cross-tab storage synchronization, and `Object.hasOwn` lookup guards.

In [mobile/sw.js](../../mobile/sw.js), use `CACHE_NAME = "pct-tool-v2.2.0-mobile-2"`; intercept same-origin GET requests only within the registration scope pathname. `isCacheableResponse` permits status 200, basic, non-redirected responses. `handleNavigationFetch` fetches HTML first with offline cache fallback; `buildNoCacheRequest` creates a URL-based request for navigation to avoid the browser's navigate-mode cloning error. Install uses reload precaching then `skipWaiting`; activate deletes older `pct-tool-` caches, calls `clients.claim`, and, when old caches existed, requests `client.navigate(client.url)`. HTML registration uses `updateViaCache: "none"`, immediate/`visibilitychange` update checks, and guarded `controllerchange` reload for pages that already had a controller.

**Decision evidence:** `fe39548` introduces Mobile/PWA; `3464804` hardens CSP/storage/scoping; `085dad6` adds update settings/API access; `dd9777e` updates caching/refresh and the script digest, merged by PR #8 `f3ba3f4`. These are successive changes, not one original decision taken on a single date.

### Rationale and Tradeoffs

Hash pinning keeps a standalone file compatible with a strict execution policy. Scope/non-redirect guards limit cache acceptance. Network-first navigation addresses stale HTML while keeping an offline fallback; fresh responses still return when cache writes fail. Automatic refresh improves upgrade delivery but can interrupt a currently open page. GitHub Pages cannot supply custom framing response headers through this repository's static HTML, and `frame-ancestors` is not effective in a meta CSP.

### Consequences

**What changes:** Inline edits require recomputed CSP digests; HTML prefers fresh network data while static assets retain cached-first delivery with background refresh.

**What remains outside scope:** Native app-store binaries, cross-device storage sync, guaranteed behavior across every installed PWA/browser, or hosted HTTP-header administration.

**Risks / mitigation:** CRLF conversion breaks hash equality; LF pinning and CI digest checks guard it. Offline fallback still depends on a prior usable cache; update/device behavior needs actual browser verification when changed.

**Affected owner records:** [Architecture](../2-%20ARCHITECTURE.md), [HANDOFF.md](../../HANDOFF.md), [Security Hardening Dossier](SECURITY_HARDENING_DOSSIER.md), and [Execution and Coding Ledger](EXECUTION_AND_CODING_LEDGER.md) (integrated via `f03308a`, verified `#30`/`E-08`).

### Implementation and Verification

**Next action / owner:** PWA maintainers recompute digests after inline changes and check online-upgrade/offline behavior; this PBS worker does not reopen PR #8.

**Applied state:** Code present at `f3ba3f4`; the current hashes were directly recomputed and match the meta policy. Earlier PR #8 validation is historical coordination evidence; no fresh installed-PWA test is claimed here.

**Acceptance:** PR #8 merged `2026-11-14 15:30:03 +0200`; the 10-file PBS continuity package passed `#30` and `E-08` on `handoff-local-dev`, with owner PR merge and acceptance pending.

### Revisit / Supersession

**Revisit when:** Inline bytes, cache schema, service-worker scope/lifecycle, API endpoint, or observed browser update behavior changes.

**Supersedes:** Earlier cache-first HTML navigation and prior mobile CSP digests/cache versions.

**Superseded by:** None through `f3ba3f4`.

**Dated update:** `2026-11-14` PR #8 is part of the starting production baseline; this record documents it without creating another fix.

**Historical source citations & confidence boundary:** `fe39548`, `3464804`, `085dad6`, `dd9777e`, PR #8 `f3ba3f4`; [Mobile HTML](../../mobile/index.html), [SW](../../mobile/sw.js), [.gitattributes](../../.gitattributes), [Session Summary](../4-%20SESSION_SUMMARY.md). High source-byte confidence; browser/runtime and hosted deployment results remain attributed historical evidence.

## ⚖️ Decision Record: DR-006 — Pin Actions to Commit SHAs, Split Permissions, Enforce Locked Builds, and Publish SHA256SUMS.txt

**Project:** Percentage Calculator Tool.

**Status:** Confirmed workflow configuration; hosted settings and runner observations are separately bounded.

**Decision date:** CI introduced `2026-11-09`; Pages and hardening/re-release behavior `2026-11-13`. Original discussion times not recorded.

**Recorded by:** pbs-session, historical archive editor on `2026-11-14`.

**Decision owner:** Project Owner / maintainers through PR #1, #3, #4, and #5; GitHub UI settings remain owner-administered.

**Scope / authority:** Repository workflow source, build reproducibility, release assets, and Pages source-branch gate; no workflow change or hosted-setting mutation authorized here.

**Reconstruction basis & confidence boundary:** High for exact pins, permissions, and shell commands; YAML cannot prove live account settings or current runner outcomes.

### Context and Question

Windows packaging, release publishing, and Pages deployment require different authorities. Mutable action tags and an overprivileged build job unnecessarily enlarge the supply-chain boundary; release users also need a way to compare downloaded bytes with published checksums.

### Options Considered

- **Mutable major-version action tags:** Verified initial CI state (`fa6652e`, Pages in `09e1ebf`); easy updates but refs can move.
- **Immutable 40-character pins with explicit refresh:** Adopted `3464804`; stable selected action source, with maintenance responsibility and no guarantee that the pinned source itself is defect-free.
- **Publishing permission in the build job:** Verified pre-hardening state; replaced with a dedicated downstream release job.
- **Separate verification/build/release plus checksum publication:** Adopted option; more workflow structure but narrower token exposure and traceable download integrity.

### Decision

Use the following exact 40-character action pins, directly read from [build.yml](../../.github/workflows/build.yml) and [pages.yml](../../.github/workflows/pages.yml) at `f3ba3f4`:

| Action | Pinned commit | Workflow |
|---|---|---|
| `actions/checkout` | `11d5960a326750d5838078e36cf38b85af677262` | Build and Pages |
| `dtolnay/rust-toolchain` | `b725eda525362e7cf34af9a7243cac1e3f01a7ec` | Build |
| `Swatinem/rust-cache` | `d1527c8f67ef9af357290475d4af4b0fab8f12e0` | Build |
| `actions/upload-artifact` | `ea165f8d65b6e75b540449e92b4886f43607fa02` | Build |
| `actions/download-artifact` | `d3f86a106a0bac45b974a628896c90dbdf5c8093` | Build |
| `actions/configure-pages` | `983d7736d9b0ae728b81ab479565c72886d7745b` | Pages |
| `actions/upload-pages-artifact` | `56afc609e74202658d3ffba0e8f6dda462b719fa` | Pages |
| `actions/deploy-pages` | `d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e` | Pages |

Every checkout has `persist-credentials: false`. Build workflow default permissions are `contents: read`; `rust-checks` inherits them, `windows-build` explicitly has `contents: read`, and only downstream `release` has `contents: write`, gated to a push on `refs/heads/main` or `refs/tags/v*`. Pages has workflow-level `contents: read`, `pages: write`, and `id-token: write`; its single `deploy` job inherits them, is gated to `refs/heads/main`, and uses environment `github-pages`. Do not describe the Pages workflow as read-only or as having separately split build/deploy jobs.

Rust test/Clippy/build and Tauri CLI installation use `--locked` where applicable; the CLI is pinned to `=2.12.4`, and production uses `cargo tauri build -- --locked`. Windows staging computes SHA-256 for NSIS/MSI, portable EXE, and standalone Mobile HTML, mapping spaces in asset names to dots in `SHA256SUMS.txt`. The release job publishes that manifest with the assets. Existing releases use `--clobber`, tag-ref movement, and refreshed notes as implemented by `77766cf`; release tags are therefore not immutable provenance anchors.

**Decision evidence:** `fa6652e` creates CI; `b508cd7` sets default read permissions and fixes the Tauri CLI version; `09e1ebf` adds Pages/parity/mobile release asset; `3464804` pins Actions, separates publisher authority, adds locked checks/checksums and main-only Pages gate; `77766cf` adds clean existing-tag re-release behavior (PR #5 `ccd6ee8`).

### Rationale and Tradeoffs

Pins stabilize selected action source while lockfile enforcement reduces accidental dependency-resolution drift. Job separation restricts publishing authority to the job that needs it. Checksums detect download differences relative to the published manifest; they are not an Authenticode signature or independent protection if an attacker controls both files and manifest. Re-release tag movement is a deliberate workflow feature, so record commit identities as well as version tags.

### Consequences

**What changes:** Verification precedes Windows build; publishing consumes staged artifacts with narrower permissions; releases include a checksum manifest.

**What remains outside scope:** Paid code signing, proving pinned upstream actions safe, live GitHub settings assurance, or dependency/action upgrades during PBS adoption.

**Risks / mitigation:** `HANDOFF.md` records a non-blocking Node.js 20 deprecation runner notice for the current action generation. That is historical documentation, not a freshly read runner log or a claim about current upstream releases. A future reviewed pin refresh belongs to maintainers. Owner must inspect Settings → Actions → General and the `github-pages` environment deployment rule in GitHub Web UI; YAML gates alone do not verify those settings.

**Affected owner records:** [HANDOFF.md](../../HANDOFF.md), [Roadmap](../3-%20ROADMAP.md), [Security Hardening Dossier](SECURITY_HARDENING_DOSSIER.md) and [Execution and Coding Ledger](EXECUTION_AND_CODING_LEDGER.md) (integrated via `f03308a`, verified `#30`/`E-08`).

### Implementation and Verification

**Next action / owner:** Owner checks hosted settings; maintainers retain exact pins and evaluate upgrades separately. Workflow pin, credential, and documentation consistency checks passed across `#30` and `E-08`.

**Applied state:** Exact pins, grants, gates, and checksum commands inspected at `f3ba3f4`. Historical handoff reports successful CI; no current CI run or admin UI was inspected here.

**Acceptance:** Relevant PR merges establish repository integration. Hosted settings and future pin upgrades require their own evidence/decision.

### Revisit / Supersession

**Revisit when:** A pinned action needs security/runtime refresh, runner notices become blocking, publishing policy changes, or hosted settings drift.

**Supersedes:** Mutable action refs and the earlier build-job publishing arrangement.

**Superseded by:** None through `f3ba3f4`.

**Dated update:** `2026-11-14` reconstruction records the current pins and explicitly preserves the Node 20/UI-verification evidence limits.

**Historical source citations & confidence boundary:** `fa6652e`, `b508cd7`, `09e1ebf`, `3464804`, `77766cf`; [build workflow](../../.github/workflows/build.yml), [Pages workflow](../../.github/workflows/pages.yml), [HANDOFF.md](../../HANDOFF.md), [README](../../README.md). High source confidence; hosted enforcement, upstream runtime status, and historical CI execution are not independently reverified.

## ⚖️ Decision Record: DR-007 — Use Windows System32 Tools for Desktop Update Checks While Keeping WebView connect-src 'none'

**Project:** Percentage Calculator Tool.

**Status:** Confirmed v2.2.0 implementation; reconstructed comparison of update approaches.

**Decision date:** Update code `2026-11-13`, merged through PR #6 `6371ddc` that day; dark About modal predecessor change `2026-11-10`.

**Recorded by:** pbs-session, historical archive editor on `2026-11-14`.

**Decision owner:** Project Owner / maintainers through PR #2 and PR #6; no independent discussion transcript recovered.

**Scope / authority:** Optional release notification, settings persistence, trusted release navigation, and matching in-app modal presentation; no binary download/installation authority.

**Reconstruction basis & confidence boundary:** High for command names, flags, constants, and parsing code; live network availability and Windows subprocess execution not retested here.

### Context and Question

The v2.2.0 release needed optional startup/manual GitHub release checks without relaxing desktop webview network policy. Settings had to persist locally, and status/About UI should fit the existing dark terminal interface instead of native white dialog styling.

### Options Considered

- **Webview fetch with broader `connect-src`:** Inferred alternative; simple frontend networking but would change desktop CSP. Mobile separately permits GitHub API fetch because it has no Rust host.
- **Rust IPC invoking system tools:** Implemented desktop option, preserving `connect-src 'none'` while accepting OS-tool/process dependencies.
- **Silent binary auto-updater:** Product-excluded alternative in the numbered context; the implemented feature only notifies and opens release pages.
- **Native dialog plugin:** Verified earlier About implementation; `fc57b62` removes `tauri-plugin-dialog`, while `d8b34b2` supplies the dark in-app About modal, merged via PR #2 `f59035d`. The later Settings modal follows the same presentation direction.

### Decision

In [commands.rs](../../src-tauri/src/commands.rs), expose `check_for_updates`, `open_release_page`, `get_settings`, and `set_settings`; register those exact names in [main.rs](../../src-tauri/src/main.rs). `windows_system32_tool` resolves the executable below `SystemRoot` (with a generic Windows fallback), then `System32`; Windows uses `System32\curl.exe` for release JSON and `System32\rundll32.exe` with `url.dll,FileProtocolHandler` for the fixed release page. `CREATE_NO_WINDOW = 0x0800_0000` suppresses subprocess console windows. Non-Windows branches use `curl`, `open`, or `xdg-open` as applicable; release packaging remains Windows-focused.

The request uses `--silent`, `--show-error`, `--fail`, `--location`, `--max-time 8`, `--max-filesize 65536`, `--proto =https`, `--tlsv1.2`, an explicit GitHub JSON Accept header, and a versioned User-Agent. `parse_github_release_json`, `parse_semver_triplet`, and `is_newer_version` validate/interpret the response, compare numeric version triplets, and fall back to the official release page for unacceptable response URLs. The parser strips leading `v`/`V` and pre-release/build suffixes; it is a numeric-triplet comparison, not full SemVer pre-release precedence.

| Constant | Exact value at cutoff |
|---|---|
| `GITHUB_LATEST_RELEASE_API` | `https://api.github.com/repos/CipherVaults/Percentage-Calculator-Tool/releases/latest` |
| `GITHUB_RELEASES_PREFIX` | `https://github.com/CipherVaults/Percentage-Calculator-Tool/releases/` |
| `GITHUB_RELEASES_URL` | `https://github.com/CipherVaults/Percentage-Calculator-Tool/releases/latest` |

Response `html_url` must start with `GITHUB_RELEASES_PREFIX` and fit `MAX_FIELD_LEN`; `open_release_page` accepts no arbitrary frontend URL and opens `GITHUB_RELEASES_URL`. Persist the default-enabled `checkUpdatesOnStartup` setting through the hardened settings store (DR-004); the user can disable startup checks or request a manual check. Desktop [CSP](../../src-tauri/tauri.conf.json) keeps `connect-src 'none'`. Smoke mode returns a synthetic no-update result and skips external release navigation.

**Decision evidence:** `085dad6` implements updater/settings/UI; PR #6 `6371ddc` integrates the v2.2.0 work. `fc57b62` / `d8b34b2` establish removal of `tauri-plugin-dialog` and the in-app dark About modal; [desktop controller](../../ui/main.js) invokes the actual registered names. Historical handoff aliases `check_for_update` or `settings_get/settings_set` do not rename those symbols.

### Rationale and Tradeoffs

Keeping network access in the Rust host preserves the strict webview boundary while enabling optional update discovery. Explicit System32 paths avoid selecting these Windows tools through an ordinary PATH lookup, but still depend on the OS environment and installed tools. Time/size/protocol flags bound the request intent; this is not a guarantee against every redirect or hostile-network scenario. Opening a fixed GitHub release URL avoids an arbitrary URL-launch API. Styled in-app modals provide visual continuity, with accessibility/focus behavior maintained in frontend code.

### Consequences

**What changes:** Desktop gains release notifications and persisted update preference without a webview fetch grant; the app can remain offline on startup when the preference is disabled.

**What remains outside scope:** Silent updates, download/install/replace operations, telemetry, full SemVer ordering, or promises of network availability.

**Risks / mitigation:** Curl failure, API limits, or offline state can prevent checks; errors are returned/displayed without changing calculator behavior. Smoke tests intentionally mock the update path, so they do not prove live GitHub connectivity or actual System32 launch behavior.

**Affected owner records:** [Architecture](../2-%20ARCHITECTURE.md), [Project Context](../1-%20PROJECT_CONTEXT.md), [HANDOFF.md](../../HANDOFF.md), and [Security Hardening Dossier](SECURITY_HARDENING_DOSSIER.md) (integrated via `f03308a`, verified `#30`/`E-08`).

### Implementation and Verification

**Next action / owner:** Updater maintainers preserve fixed endpoints, bounded process flags, settings semantics, and CSP; verify live Windows behavior separately when changing this boundary.

**Applied state:** Present at `f3ba3f4`; Rust unit tests exercise triplet parsing/comparison, release JSON, and untrusted URL fallback. Existing desktop smoke code checks mocked update UI; source inspected, no fresh runtime/network test performed here.

**Acceptance:** PR #6 records integration; PR #7 `ccc3899` adds the updated handoff evidence. No new owner approval or application change is created by this historical record.

### Revisit / Supersession

**Revisit when:** Supported platforms/tools, GitHub endpoint/schema, version policy, or update-install scope changes, or live validation reveals a defect.

**Supersedes:** No prior automatic update checker; About presentation supersedes the native dialog plugin implementation.

**Superseded by:** None through `f3ba3f4`.

**Dated update:** `2026-11-14` reconstruction records exact current IPC names and distinguishes real network execution from mocked smoke coverage.

**Historical source citations & confidence boundary:** `fc57b62`, `d8b34b2`, `085dad6`, PR #2 `f59035d`, PR #6 `6371ddc`, handoff update `ec8ad5c` / PR #7 `ccc3899`; [commands](../../src-tauri/src/commands.rs), [main](../../src-tauri/src/main.rs), [desktop JS](../../ui/main.js), [Tauri config](../../src-tauri/tauri.conf.json), and [Session Summary](../4-%20SESSION_SUMMARY.md). High for source details; reconstructed options and historical runtime results retain the stated limits.
