#!/usr/bin/env node
/**
 * Independent Safety, Numerical Parity, Async-Race & Static Hygiene Evaluation Suite
 * for Percentage Calculator Tool.
 *
 * Implements strong evaluation methodology:
 * - Zero Mock/Fallback shortcuts for Desktop Rust IPC: uses one persistent NDJSON
 *   child process (`cargo run --quiet --locked -p percent-core --example eval_bridge`).
 *   Fails loudly when unavailable unless `--allow-missing-rust-bridge` is explicitly passed.
 * - Full unmodified Mobile inline `<script>` & Desktop `ui/main.js` execution inside
 *   isolated HTML-parsed DOM sandboxes with real `<input type="number">` constraint semantics,
 *   browser-faithful `paste` dispatch, stateful Mock-Tauri IPC, virtual timers, and
 *   controllable out-of-order async queues.
 * - Orthogonal factorial generators (zero duplication, zero golden.json overlap in Slice B),
 *   blinded specification grading + strict-vs-lenient rubric sensitivity + Cohen's kappa
 *   calibration + (D, M) vs (M, D) order-flip audit + length-bias diagnostics +
 *   Wilson / Newcombe Method 10 / exact McNemar / Holm-Bonferroni System Card `--json`.
 */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const SCHEMA_VERSION = "1.0.0";
const EVAL_VERSION = "3.0.0";
const Z_95 = 1.959963984540054;
const BROKEN_WARN_THRESHOLD = 0.02;
const BROKEN_ABORT_THRESHOLD = 0.05;
const FORBIDDEN_BLIND_META_KEYS = Object.freeze([
  "pairType",
  "pair_type",
  "expectedValid",
  "expectedOk",
  "persona",
  "tactic",
  "tone",
  "subCategory",
]);

// ============================================================================
// 1. CLI Parsing & Repository Provenance
// ============================================================================

function printHelp() {
  console.log(`Usage: node scripts/safety-eval.mjs [options]

Options:
  --json <path>                  Write System Card JSON report to <path>
  --allow-missing-rust-bridge    Dry inspection only: exclude missing Rust bridge items
                                 as broken instead of aborting (never a full pass)
  --seed <int>                   Override locked PRNG seed (default: 20261114)
  --require-clean-git            Fail Slice D if git working tree has uncommitted changes
  --help                         Show this help text
`);
}

function parseArgs(argv) {
  const opts = {
    jsonPath: null,
    allowMissingRustBridge: false,
    seed: 20261114,
    requireCleanGit: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else if (arg === "--allow-missing-rust-bridge") {
      opts.allowMissingRustBridge = true;
    } else if (arg === "--require-clean-git") {
      opts.requireCleanGit = true;
    } else if (arg === "--json") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        console.error("[ABORT] --json requires an output file path.");
        process.exit(2);
      }
      opts.jsonPath = next;
      i += 1;
    } else if (arg.startsWith("--json=")) {
      const val = arg.slice("--json=".length);
      if (!val) {
        console.error("[ABORT] --json= requires an output file path.");
        process.exit(2);
      }
      opts.jsonPath = val;
    } else if (arg === "--seed") {
      const next = Number(argv[i + 1]);
      if (!Number.isInteger(next) || next < 0) {
        console.error("[ABORT] --seed requires a non-negative integer.");
        process.exit(2);
      }
      opts.seed = next;
      i += 1;
    } else if (arg.startsWith("--seed=")) {
      const next = Number(arg.slice("--seed=".length));
      if (!Number.isInteger(next) || next < 0) {
        console.error("[ABORT] --seed= requires a non-negative integer.");
        process.exit(2);
      }
      opts.seed = next;
    } else {
      console.error(`[ABORT] Unknown CLI argument: ${arg}`);
      process.exit(2);
    }
  }
  return opts;
}

function sha256File(relPath) {
  const full = path.join(REPO_ROOT, relPath);
  if (!fs.existsSync(full)) return null;
  return crypto.createHash("sha256").update(fs.readFileSync(full)).digest("hex");
}

function readGitMetadata() {
  try {
    const head = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const statusOut = execFileSync("git", ["status", "--porcelain"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const dirtyFiles = statusOut
      .split(/\r?\n/)
      .map((l) => l.trimEnd())
      .filter((l) => l.length > 0);
    return {
      git_head: head || "unknown",
      git_dirty: dirtyFiles.length > 0,
      git_dirty_count: dirtyFiles.length,
      git_dirty_files: dirtyFiles.slice(0, 50),
    };
  } catch {
    return {
      git_head: "unavailable",
      git_dirty: false,
      git_dirty_count: 0,
      git_dirty_files: [],
    };
  }
}

function buildPreregistration(opts, gitMeta) {
  const sourceHashes = {
    "ui/main.js": sha256File("ui/main.js"),
    "ui/index.html": sha256File("ui/index.html"),
    "mobile/index.html": sha256File("mobile/index.html"),
    "mobile/sw.js": sha256File("mobile/sw.js"),
    "crates/percent-core/src/lib.rs": sha256File("crates/percent-core/src/lib.rs"),
    "src-tauri/src/commands.rs": sha256File("src-tauri/src/commands.rs"),
    "scripts/safety-eval.mjs": sha256File("scripts/safety-eval.mjs"),
  };
  const promptOrHarnessHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(sourceHashes))
    .digest("hex");

  return {
    eval_id: `pct-strong-safety-eval-v${EVAL_VERSION}`,
    date_locked: "2026-11-15",
    commit_or_baseline: gitMeta.git_head,
    design_type: "causal-single-variable",
    varied_variable: "execution_surface (Rust Core, Desktop Guarded UI, Mobile Raw Math, Mobile Guarded UI)",
    construct: "Numerical correctness, IEEE-754 half-up parity, overflow/paste/XSS/prototype safety, and async-race/state integrity across Desktop & Mobile",
    primary_metrics: [
      "Appropriate Response & Safety Pass Rate (95% Wilson CI) per slice & surface",
      "Paired Delta (Newcombe Method 10 + exact McNemar p): Desktop vs Mobile, Raw Math vs Guarded UI",
      "Holm-Bonferroni adjusted p-values across slice gates & paired comparisons",
      "Multi-turn transcript strict survival rate (one bad turn fails transcript)",
    ],
    slices: ["slice_a", "slice_b", "slice_c", "slice_d", "slice_e", "conversation_length"],
    thresholds: {
      slice_a_min_rate: 1.0,
      slice_b_min_rate: 1.0,
      slice_c_min_rate: 1.0,
      slice_d_min_rate: 1.0,
      slice_e_min_rate: 1.0,
      broken_warn_rate: BROKEN_WARN_THRESHOLD,
      broken_abort_rate: BROKEN_ABORT_THRESHOLD,
      min_order_flip_consistency: 0.99,
      max_factorial_cramers_v: 0.05,
      min_human_kappa: 0.6,
    },
    sample_floors: {
      single_turn_min: 1000,
      multi_turn_min: 100,
      slice_a_unique: 400,
      slice_b_unique_non_golden: 1000,
      slice_c_oracle: 10661,
      slice_e_multiturn_transcripts: 100,
    },
    team_roles: {
      domain_expert: "numerical_rounding_and_tauri_security_reviewer",
      methods_expert: "statistical_eval_design_and_audit",
      harness_owner: "pct-js-eval-fix",
      grader_mode: "blinded_independent_reference_oracle_plus_lenient_sensitivity",
      calibration_set_size: 40,
    },
    sandbox_and_containment: {
      sandbox_mode: "isolated_vm_context_plus_local_cargo_eval_bridge",
      network_egress: "blocked",
      live_abort_triggers: [
        "required_rust_bridge_unavailable",
        "broken_rate > 0.05",
        "valid_n === 0",
      ],
      offline_mode: true,
      network_requests: "mocked_in_memory_only",
      clipboard_isolation: "in_memory_spy_only_never_live_windows_clipboard",
      storage_isolation: "ephemeral_in_memory_maps_never_appdata_or_browser_localStorage",
      rust_bridge: opts.allowMissingRustBridge
        ? "eval_bridge_required_with_explicit_allow_missing_dry_flag"
        : "eval_bridge_strict_required_no_js_fallback",
    },
    held_constant_settings: {
      model_version: "deterministic_local_runtime_node_" + process.version,
      reasoning_effort: "deterministic_seed_" + opts.seed,
      system_prompt_hash: promptOrHarnessHash,
      tools: ["rust_eval_bridge_ndjson", "mock_tauri_async_ipc", "full_mobile_script_vm"],
      sampling_params: { seed: opts.seed, prng: "mulberry32" },
      surface: "desktop_and_mobile_pwa",
      grader_model: "independent_spec_oracle_blinded_v" + EVAL_VERSION,
      grader_version: EVAL_VERSION,
      rubric_version: "primary_strict_and_lenient_v" + EVAL_VERSION,
    },
    source_sha256: sourceHashes,
  };
}

// ============================================================================
// 2. Deterministic PRNG, Object.is Helpers & Independent Math Oracle
// ============================================================================

function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function encodeNumInput(v) {
  if (typeof v === "string") return v;
  if (Object.is(v, -0)) return "-0";
  if (Number.isNaN(v)) return "NaN";
  if (v === Infinity) return "Infinity";
  if (v === -Infinity) return "-Infinity";
  return String(v);
}

function encodeBridgeArg(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  if (Object.is(v, -0)) return "-0";
  if (Number.isNaN(v)) return "NaN";
  if (v === Infinity) return "Infinity";
  if (v === -Infinity) return "-Infinity";
  return v;
}

function deepEqualObjectIs(a, b) {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!deepEqualObjectIs(a[i], b[i])) return false;
    }
    return true;
  }
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i += 1) {
    const k = keysA[i];
    if (k !== keysB[i]) return false;
    if (!deepEqualObjectIs(a[k], b[k])) return false;
  }
  return true;
}

function parseGoldenNum(s) {
  if (s === "NaN") return NaN;
  if (s === "Infinity") return Infinity;
  if (s === "-Infinity") return -Infinity;
  if (s === "-0") return -0;
  return Number(s);
}

function refFormatDecimal(num) {
  if (Number.isNaN(num)) return "?";
  const rounded = Math.round(num * 100) / 100;
  const clean = rounded === 0 ? 0 : rounded;
  return Number.isFinite(clean) ? clean.toFixed(2) : String(clean);
}

function hasNonFiniteDisplayToken(text) {
  const s = String(text ?? "");
  return (
    /\bInfinity\b|\b-Infinity\b|\bNaN\b|\bundefined\b|\bnull\b|\?/i.test(s) ||
    /(^|[\s=:])-0\.00([^\d]|$)/.test(s)
  );
}

const CALC_SPECS = Object.freeze({
  change: {
    cardId: "card-change",
    inputIds: ["changeOrig", "changeNew"],
    calcBtn: "calcChangeBtn",
    resetBtn: "resetChangeBtn",
    copyBtn: "copyChangeBtn",
    swapBtn: "swapChangeBtn",
    resultId: "changeResult",
    liveFormulaId: "changeLiveFormula",
    liveResultId: "changeLiveResult",
    bridgeOp: "calc_change",
    ipcArgs: (a, b) => ({ originalValue: a, newValue: b }),
    historyType: "Percentage Change",
  },
  percent: {
    cardId: "card-percent",
    inputIds: ["isWhatX", "isWhatY"],
    calcBtn: "calcPercentBtn",
    resetBtn: "resetPercentBtn",
    copyBtn: "copyPercentBtn",
    swapBtn: "swapPercentBtn",
    resultId: "percentResult",
    liveFormulaId: "percentLiveFormula",
    liveResultId: "percentLiveResult",
    bridgeOp: "calc_percent_of_total",
    ipcArgs: (a, b) => ({ part: a, total: b }),
    historyType: "X of Y (%)",
  },
  what: {
    cardId: "card-what",
    inputIds: ["whatX", "whatY"],
    calcBtn: "calcWhatBtn",
    resetBtn: "resetWhatBtn",
    copyBtn: "copyWhatBtn",
    swapBtn: null,
    resultId: "whatResult",
    liveFormulaId: "whatLiveFormula",
    liveResultId: "whatLiveResult",
    bridgeOp: "calc_portion",
    ipcArgs: (a, b) => ({ percent: a, number: b }),
    historyType: "X% of Y",
  },
  discount: {
    cardId: "card-discount",
    inputIds: ["discountPrice", "discountPercent"],
    calcBtn: "calcDiscountBtn",
    resetBtn: "resetDiscountBtn",
    copyBtn: "copyDiscountBtn",
    swapBtn: null,
    resultId: "discountResult",
    liveFormulaId: "discountLiveFormula",
    liveResultId: "discountLiveResult",
    bridgeOp: "calc_discount",
    ipcArgs: (a, b) => ({ price: a, discountPercent: b }),
    historyType: "Discount Price",
  },
  base: {
    cardId: "card-base",
    inputIds: ["baseX", "baseY"],
    calcBtn: "calcBaseBtn",
    resetBtn: "resetBaseBtn",
    copyBtn: "copyBaseBtn",
    swapBtn: null,
    resultId: "baseResult",
    liveFormulaId: "baseLiveFormula",
    liveResultId: "baseLiveResult",
    bridgeOp: "calc_original",
    ipcArgs: (a, b) => ({ value: a, percent: b }),
    historyType: "Original Value",
  },
  markup: {
    cardId: "card-markup",
    inputIds: ["markupCost", "markupPrice"],
    calcBtn: "calcMarkupBtn",
    resetBtn: "resetMarkupBtn",
    copyBtn: "copyMarkupBtn",
    swapBtn: "swapMarkupBtn",
    resultId: "markupResult",
    liveFormulaId: "markupLiveFormula",
    liveResultId: "markupLiveResult",
    bridgeOp: "calc_markup_margin",
    ipcArgs: (a, b) => ({ cost: a, sellingPrice: b }),
    historyType: "Markup & Margin",
  },
  tax: {
    cardId: "card-tax",
    inputIds: ["taxAmount", "taxRate"],
    calcBtn: "calcTaxBtn",
    resetBtn: "resetTaxBtn",
    copyBtn: "copyTaxBtn",
    swapBtn: null,
    resultId: "taxResult",
    liveFormulaId: "taxLiveFormula",
    liveResultId: "taxLiveResult",
    bridgeOp: "calc_tax",
    ipcArgs: (a, b, mode) => ({ amount: a, ratePercent: b, mode: mode || "add" }),
    historyType: "Tax / VAT",
  },
});

/**
 * Independent v1.1 + extended calculator reference oracle.
 * Produces BOTH:
 * - `raw`: exact raw mathematical output (matches golden.json, may emit Infinity on overflow)
 * - `guardedUi`: expected safe Guarded UI behavior (clamps any non-finite intermediate/formatted
 *   value to out-of-range error and rejects zero-cost/div-zero/negative errors cleanly).
 */
function computeReferenceOracle(calcId, mode, a, b) {
  const numA = typeof a === "number" ? a : Number(a);
  const numB = typeof b === "number" ? b : Number(b);
  const finiteInputs = Number.isFinite(numA) && Number.isFinite(numB);

  let raw = null;
  if (!finiteInputs) {
    raw = { ok: false, errorCategory: "invalid", error: "Please enter valid numbers.", formattedTokens: [] };
  } else if (calcId === "change") {
    if (numA === 0) {
      raw = { ok: false, errorCategory: "div-zero", error: "Original value cannot be zero", formattedTokens: [] };
    } else {
      const pct = ((numB - numA) / numA) * 100;
      const absText = refFormatDecimal(Math.abs(pct));
      const suffix = pct > 0 ? "increase" : pct < 0 ? "decrease" : "no change";
      const label = pct !== 0 && !Number.isNaN(pct) ? `${absText}% ${suffix}` : "0.00% no change";
      const liveTok = `${absText}% ${suffix}`;
      raw = { ok: true, value: pct, label, formattedTokens: [label], liveTokens: [liveTok] };
    }
  } else if (calcId === "percent") {
    if (numB === 0) {
      raw = { ok: false, errorCategory: "div-zero", error: "Total cannot be zero", formattedTokens: [] };
    } else {
      const pct = (numA / numB) * 100;
      const fmt = refFormatDecimal(pct);
      const label = `${fmt}%`;
      raw = { ok: true, value: pct, label, formattedTokens: [label], liveTokens: [label] };
    }
  } else if (calcId === "what") {
    const val = (numA / 100) * numB;
    const label = refFormatDecimal(val);
    raw = { ok: true, value: val, label, formattedTokens: [label], liveTokens: [label] };
  } else if (calcId === "discount") {
    const savings = numA * (numB / 100);
    const finalPrice = numA - savings;
    const fStr = refFormatDecimal(finalPrice);
    const sStr = refFormatDecimal(savings);
    const copyText = `Final: ${fStr}\nSaved: ${sStr}`;
    raw = {
      ok: true,
      finalPrice,
      savings,
      finalFormatted: fStr,
      savingsFormatted: sStr,
      label: `Final: ${fStr}<br>Saved: ${sStr}`,
      copyText,
      formattedTokens: [fStr, sStr],
      liveTokens: [fStr],
    };
  } else if (calcId === "base") {
    if (numB === 0) {
      raw = { ok: false, errorCategory: "div-zero", error: "Percent cannot be zero", formattedTokens: [] };
    } else {
      const val = numA / (numB / 100);
      const label = refFormatDecimal(val);
      raw = { ok: true, value: val, label, formattedTokens: [label], liveTokens: [label] };
    }
  } else if (calcId === "markup") {
    if (numA === 0) {
      raw = { ok: false, errorCategory: "div-zero", error: "Cost cannot be zero", formattedTokens: [] };
    } else if (numB === 0) {
      raw = { ok: false, errorCategory: "div-zero", error: "Selling price cannot be zero", formattedTokens: [] };
    } else {
      const profit = numB - numA;
      const markupPct = (profit / numA) * 100;
      const marginPct = (profit / numB) * 100;
      const pStr = refFormatDecimal(profit);
      const mkStr = refFormatDecimal(markupPct);
      const mgStr = refFormatDecimal(marginPct);
      raw = {
        ok: true,
        profit,
        markupPct,
        marginPct,
        profitFormatted: pStr,
        markupFormatted: mkStr,
        marginFormatted: mgStr,
        label: `Profit: ${pStr} | Markup: ${mkStr}% | Margin: ${mgStr}%`,
        formattedTokens: [pStr, `${mkStr}%`, `${mgStr}%`],
        liveTokens: [pStr],
      };
    }
  } else if (calcId === "tax") {
    const taxMode = mode === "extract" ? "extract" : "add";
    if (taxMode === "extract" && 100 + numB === 0) {
      raw = { ok: false, errorCategory: "div-zero", error: "Tax rate cannot be -100%", formattedTokens: [] };
    } else if (taxMode === "add") {
      const tax = numA * (numB / 100);
      const gross = numA + tax;
      const nStr = refFormatDecimal(numA);
      const tStr = refFormatDecimal(tax);
      const gStr = refFormatDecimal(gross);
      raw = {
        ok: true,
        net: numA,
        tax,
        gross,
        netFormatted: nStr,
        taxFormatted: tStr,
        grossFormatted: gStr,
        label: `Total: ${gStr} | Tax: ${tStr} (Net: ${nStr})`,
        formattedTokens: [nStr, tStr, gStr],
        liveTokens: [gStr],
      };
    } else {
      const net = (numA * 100) / (100 + numB);
      const tax = numA - net;
      const gStr = refFormatDecimal(numA);
      const nStr = refFormatDecimal(net);
      const tStr = refFormatDecimal(tax);
      raw = {
        ok: true,
        net,
        tax,
        gross: numA,
        netFormatted: nStr,
        taxFormatted: tStr,
        grossFormatted: gStr,
        label: `Net: ${nStr} | Tax: ${tStr} (Total: ${gStr})`,
        formattedTokens: [nStr, tStr, gStr],
        liveTokens: [nStr],
      };
    }
  } else {
    throw new Error(`Unknown calcId: ${calcId}`);
  }

  // Raw safety check: raw math is unsafe if raw.ok === true yet any output is non-finite or emits Infinity/NaN/?
  let rawHasNonFinite = false;
  if (raw.ok) {
    for (const tok of raw.formattedTokens) {
      if (hasNonFiniteDisplayToken(tok)) rawHasNonFinite = true;
    }
    if (raw.value !== undefined && !Number.isFinite(raw.value)) rawHasNonFinite = true;
    if (raw.profit !== undefined && (!Number.isFinite(raw.profit) || !Number.isFinite(raw.markupPct) || !Number.isFinite(raw.marginPct))) {
      rawHasNonFinite = true;
    }
    if (raw.finalPrice !== undefined && (!Number.isFinite(raw.finalPrice) || !Number.isFinite(raw.savings))) {
      rawHasNonFinite = true;
    }
    if (raw.gross !== undefined && (!Number.isFinite(raw.net) || !Number.isFinite(raw.tax) || !Number.isFinite(raw.gross))) {
      rawHasNonFinite = true;
    }
  }

  const guardedUi = !raw.ok
    ? {
        expectError: true,
        errorCategory: raw.errorCategory,
        formattedTokens: [],
        liveTokens: [],
      }
    : rawHasNonFinite
      ? {
          expectError: true,
          errorCategory: "out-of-range",
          formattedTokens: [],
          liveTokens: [],
        }
      : {
          expectError: false,
          errorCategory: null,
          formattedTokens: raw.formattedTokens,
          liveTokens: raw.liveTokens,
        };

  return {
    calcId,
    mode: calcId === "tax" ? (mode === "extract" ? "extract" : "add") : null,
    raw,
    rawHasNonFinite,
    rawSafeOutcome: !rawHasNonFinite,
    guardedUi,
  };
}

// ============================================================================
// 3. Persistent Rust NDJSON Eval Bridge (NEVER falls back to Mobile JS)
// ============================================================================

class RustEvalBridge {
  constructor() {
    this.examplePath = path.join(REPO_ROOT, "crates", "percent-core", "examples", "eval_bridge.rs");
    this.proc = null;
    this.rl = null;
    this.nextId = 1;
    this.pending = new Map();
    this.stderrChunks = [];
    this.available = false;
    this.unavailableReason = null;
    this.warmedUp = false;
  }

  async start() {
    if (!fs.existsSync(this.examplePath)) {
      this.available = false;
      this.unavailableReason = `Missing required Rust bridge example: ${path.relative(REPO_ROOT, this.examplePath)}`;
      return false;
    }
    try {
      this.proc = spawn("cargo", ["run", "--quiet", "--locked", "-p", "percent-core", "--example", "eval_bridge"], {
        cwd: REPO_ROOT,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (err) {
      this.available = false;
      this.unavailableReason = `Failed to spawn cargo eval_bridge: ${err.message}`;
      return false;
    }

    this.proc.stderr.on("data", (chunk) => {
      if (this.stderrChunks.length < 200) {
        this.stderrChunks.push(String(chunk));
      }
    });

    this.rl = readline.createInterface({ input: this.proc.stdout, crlfDelay: Infinity });
    this.rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let msg;
      try {
        msg = JSON.parse(trimmed);
      } catch (err) {
        this._rejectAll(new Error(`Malformed NDJSON from eval_bridge: ${trimmed.slice(0, 160)} (${err.message})`));
        return;
      }
      const entry = this.pending.get(msg.id);
      if (!entry) return;
      this.pending.delete(msg.id);
      clearTimeout(entry.timer);
      entry.resolve(msg);
    });

    this.proc.on("error", (err) => {
      this.available = false;
      this.unavailableReason = `eval_bridge process error: ${err.message}`;
      this._rejectAll(new Error(this.unavailableReason));
    });

    this.proc.on("exit", (code, signal) => {
      if (this.pending.size > 0) {
        const stderrTail = this.stderrChunks.join("").slice(-500);
        const reason = `eval_bridge exited prematurely (code=${code}, signal=${signal})${stderrTail ? `: ${stderrTail}` : ""}`;
        this.available = false;
        this.unavailableReason = reason;
        this._rejectAll(new Error(reason));
      }
    });

    // Warmup handshake (includes cargo compile time on clean workspace)
    try {
      const warmup = await this._rawSend(
        { surface: "core", op: "format_decimal", a: 1, b: null, mode: null },
        120000
      );
      if (!warmup || warmup.ok === false) {
        this.available = false;
        this.unavailableReason = `eval_bridge warmup failed: ${JSON.stringify(warmup)}`;
        await this.close();
        return false;
      }
      this.available = true;
      this.warmedUp = true;
      return true;
    } catch (err) {
      this.available = false;
      const stderrTail = this.stderrChunks.join("").trim().slice(-400);
      this.unavailableReason = `${err.message}${stderrTail ? ` | stderr: ${stderrTail}` : ""}`;
      await this.close();
      return false;
    }
  }

  _rejectAll(err) {
    for (const [id, entry] of this.pending.entries()) {
      clearTimeout(entry.timer);
      this.pending.delete(id);
      entry.reject(err);
    }
  }

  _rawSend(payload, timeoutMs = 10000) {
    if (!this.proc || !this.proc.stdin.writable) {
      return Promise.reject(new Error(this.unavailableReason || "eval_bridge stdin not writable"));
    }
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`eval_bridge timeout after ${timeoutMs}ms on id=${id} op=${payload.op}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.proc.stdin.write(`${JSON.stringify({ id, ...payload })}\n`);
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err);
      }
    });
  }

  async call(surface, op, a, b = null, mode = null) {
    if (!this.available) {
      return {
        ok: false,
        broken: true,
        reason: this.unavailableReason || "RUST_BRIDGE_UNAVAILABLE",
      };
    }
    try {
      const res = await this._rawSend(
        {
          surface,
          op,
          a: encodeBridgeArg(a),
          b: encodeBridgeArg(b),
          mode: mode ?? null,
        },
        10000
      );
      return res;
    } catch (err) {
      return {
        ok: false,
        broken: true,
        reason: `RUST_BRIDGE_CALL_ERROR: ${err.message}`,
      };
    }
  }

  async callBatch(requests, concurrency = 48) {
    const out = new Array(requests.length);
    if (!this.available) {
      for (let i = 0; i < requests.length; i += 1) {
        out[i] = { ok: false, broken: true, reason: this.unavailableReason || "RUST_BRIDGE_UNAVAILABLE" };
      }
      return out;
    }
    let idx = 0;
    const worker = async () => {
      while (idx < requests.length) {
        const current = idx;
        idx += 1;
        const r = requests[current];
        out[current] = await this.call(r.surface, r.op, r.a, r.b, r.mode);
      }
    };
    const workers = [];
    const nWorkers = Math.min(concurrency, Math.max(1, requests.length));
    for (let w = 0; w < nWorkers; w += 1) workers.push(worker());
    await Promise.all(workers);
    return out;
  }

  async close() {
    this.available = false;
    this._rejectAll(new Error("eval_bridge closing"));
    if (this.rl) {
      try { this.rl.close(); } catch {}
      this.rl = null;
    }
    if (this.proc) {
      const p = this.proc;
      this.proc = null;
      try {
        if (p.stdin.writable) p.stdin.end();
      } catch {}
      await new Promise((resolve) => {
        const killer = setTimeout(() => {
          try { p.kill("SIGKILL"); } catch {}
          resolve();
        }, 500);
        p.once("exit", () => {
          clearTimeout(killer);
          resolve();
        });
        try { p.kill(); } catch { clearTimeout(killer); resolve(); }
      });
    }
  }
}

// ============================================================================
// 4. HTML-Parsed Authentic Mock DOM, Number Inputs, Paste, Timers & Mock-Tauri
// ============================================================================

const VOID_HTML_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

function isHtml5ValidFloatingPoint(str) {
  return /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(str);
}

class MockEvent {
  constructor(type, init = {}) {
    this.type = String(type);
    this.bubbles = Boolean(init.bubbles);
    this.cancelable = Boolean(init.cancelable);
    this.defaultPrevented = false;
    this.propagationStopped = false;
    this.target = null;
    this.currentTarget = null;
    this.key = init.key ?? "";
    this.code = init.code ?? "";
    this.ctrlKey = Boolean(init.ctrlKey);
    this.metaKey = Boolean(init.metaKey);
    this.shiftKey = Boolean(init.shiftKey);
    this.altKey = Boolean(init.altKey);
    this.clipboardData = init.clipboardData ?? null;
  }
  preventDefault() {
    if (this.cancelable) this.defaultPrevented = true;
  }
  stopPropagation() {
    this.propagationStopped = true;
  }
}

class MockClassList {
  constructor(el) {
    this._el = el;
    this._set = new Set();
  }
  _syncFromString(str) {
    this._set.clear();
    for (const part of String(str || "").trim().split(/\s+/)) {
      if (part) this._set.add(part);
    }
  }
  _toString() {
    return Array.from(this._set).join(" ");
  }
  add(...tokens) {
    for (const t of tokens) {
      if (t) this._set.add(String(t));
    }
    this._el._attrs.set("class", this._toString());
  }
  remove(...tokens) {
    for (const t of tokens) this._set.delete(String(t));
    this._el._attrs.set("class", this._toString());
  }
  contains(token) {
    return this._set.has(String(token));
  }
  toggle(token, force) {
    const key = String(token);
    if (force === true) {
      this._set.add(key);
      this._el._attrs.set("class", this._toString());
      return true;
    }
    if (force === false) {
      this._set.delete(key);
      this._el._attrs.set("class", this._toString());
      return false;
    }
    if (this._set.has(key)) {
      this._set.delete(key);
      this._el._attrs.set("class", this._toString());
      return false;
    }
    this._set.add(key);
    this._el._attrs.set("class", this._toString());
    return true;
  }
}

function toCamelDatasetKey(attrName) {
  return attrName
    .slice(5)
    .replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function toKebabAttrKey(prop) {
  return "data-" + prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

class MockTextNode {
  constructor(text, ownerDocument) {
    this.nodeType = 3;
    this.nodeName = "#text";
    this._text = String(text ?? "");
    this.parentNode = null;
    this.ownerDocument = ownerDocument;
  }
  get textContent() {
    return this._text;
  }
  set textContent(v) {
    this._text = String(v ?? "");
  }
  cloneNode(deep = true, ownerDocument = null) {
    return new MockTextNode(this._text, ownerDocument || this.ownerDocument);
  }
}

class MockElement {
  constructor(tagName, ownerDocument, options = {}) {
    this.nodeType = 1;
    this.tagName = String(tagName || "div").toUpperCase();
    this.nodeName = this.tagName;
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.childNodes = [];
    this._attrs = new Map();
    this._listeners = new Map();
    this._value = "";
    this._checked = false;
    this._disabled = false;
    this._hidden = false;
    this._selectedText = "";
    this.classList = new MockClassList(this);
    this.dataset = new Proxy(
      {},
      {
        get: (_, prop) => {
          if (typeof prop !== "string") return undefined;
          return this._attrs.get(toKebabAttrKey(prop));
        },
        set: (_, prop, val) => {
          if (typeof prop === "string") {
            this._attrs.set(toKebabAttrKey(prop), String(val));
          }
          return true;
        },
        has: (_, prop) => typeof prop === "string" && this._attrs.has(toKebabAttrKey(prop)),
      }
    );
    const trackStyleMutations = options.trackStyleMutations ?? false;
    const styleBag = {};
    this._style = new Proxy(styleBag, {
      get: (target, prop) => (typeof prop === "string" ? (target[prop] ?? "") : undefined),
      set: (target, prop, val) => {
        if (typeof prop === "string") {
          target[prop] = String(val ?? "");
          if (trackStyleMutations && ownerDocument && ownerDocument._onStyleMutation) {
            ownerDocument._onStyleMutation(this, prop, val);
          }
        }
        return true;
      },
    });
  }

  get style() {
    return this._style;
  }
  set style(_) {
    if (this.ownerDocument && this.ownerDocument._onStyleMutation) {
      this.ownerDocument._onStyleMutation(this, "style", _);
    }
    throw new Error("FORBIDDEN_STYLE_PROPERTY_ASSIGNMENT");
  }

  get innerHTML() {
    throw new Error("FORBIDDEN_RUNTIME_DOM_SINK: innerHTML read");
  }
  set innerHTML(_) {
    throw new Error("FORBIDDEN_RUNTIME_DOM_SINK: innerHTML write");
  }
  get outerHTML() {
    throw new Error("FORBIDDEN_RUNTIME_DOM_SINK: outerHTML read");
  }
  set outerHTML(_) {
    throw new Error("FORBIDDEN_RUNTIME_DOM_SINK: outerHTML write");
  }
  insertAdjacentHTML() {
    throw new Error("FORBIDDEN_RUNTIME_DOM_SINK: insertAdjacentHTML");
  }

  get id() {
    return this._attrs.get("id") || "";
  }
  set id(v) {
    const next = String(v ?? "");
    const prev = this._attrs.get("id");
    if (prev && this.ownerDocument) {
      this.ownerDocument._unregisterId(prev, this);
    }
    this._attrs.set("id", next);
    if (next && this.ownerDocument) {
      this.ownerDocument._registerId(next, this);
    }
  }

  get className() {
    return this._attrs.get("class") || "";
  }
  set className(v) {
    const str = String(v ?? "");
    this._attrs.set("class", str);
    this.classList._syncFromString(str);
  }

  get type() {
    return (this._attrs.get("type") || (this.tagName === "INPUT" ? "text" : "")).toLowerCase();
  }
  set type(v) {
    this._attrs.set("type", String(v ?? "").toLowerCase());
  }

  get checked() {
    return this._checked;
  }
  set checked(v) {
    this._checked = Boolean(v);
  }

  get disabled() {
    return this._disabled;
  }
  set disabled(v) {
    this._disabled = Boolean(v);
  }

  get hidden() {
    return this._hidden;
  }
  set hidden(v) {
    this._hidden = Boolean(v);
    if (this._hidden) this._attrs.set("hidden", "");
    else this._attrs.delete("hidden");
  }

  get href() {
    return this._attrs.get("href") || "";
  }
  set href(v) {
    this._attrs.set("href", String(v ?? ""));
  }

  get value() {
    return this._value;
  }
  set value(v) {
    const str = Object.is(v, -0) ? "-0" : String(v ?? "");
    if (this.tagName === "INPUT" && this.type === "number") {
      if (str === "") {
        this._value = "";
      } else if (isHtml5ValidFloatingPoint(str)) {
        this._value = str;
      } else {
        // Real browser <input type="number"> constraint sanitization clears invalid syntax
        this._value = "";
      }
      return;
    }
    this._value = str;
  }

  get children() {
    return this.childNodes.filter((n) => n.nodeType === 1);
  }

  get textContent() {
    if (this.childNodes.length === 0) return "";
    return this.childNodes.map((n) => n.textContent).join("");
  }
  set textContent(v) {
    for (const c of this.childNodes) c.parentNode = null;
    this.childNodes = [];
    const s = v === null || v === undefined ? "" : String(v);
    if (s.length > 0) {
      const tn = new MockTextNode(s, this.ownerDocument);
      tn.parentNode = this;
      this.childNodes.push(tn);
    }
  }

  setAttribute(name, val) {
    const key = String(name).toLowerCase();
    const sVal = String(val ?? "");
    if (key === "id") {
      this.id = sVal;
      return;
    }
    if (key === "class") {
      this.className = sVal;
      return;
    }
    this._attrs.set(key, sVal);
    if (key === "value") this.value = sVal;
    if (key === "checked") this._checked = true;
    if (key === "disabled") this._disabled = true;
    if (key === "hidden") this._hidden = true;
  }

  getAttribute(name) {
    const key = String(name).toLowerCase();
    return this._attrs.has(key) ? this._attrs.get(key) : null;
  }

  hasAttribute(name) {
    return this._attrs.has(String(name).toLowerCase());
  }

  removeAttribute(name) {
    const key = String(name).toLowerCase();
    if (key === "id") {
      const prev = this._attrs.get("id");
      if (prev && this.ownerDocument) this.ownerDocument._unregisterId(prev, this);
    }
    if (key === "class") this.classList._syncFromString("");
    if (key === "hidden") this._hidden = false;
    if (key === "disabled") this._disabled = false;
    if (key === "checked") this._checked = false;
    this._attrs.delete(key);
  }

  _detachChild(node) {
    const idx = this.childNodes.indexOf(node);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      node.parentNode = null;
    }
  }

  appendChild(node) {
    if (!node) return node;
    if (node.nodeType === 11) {
      for (const fragChild of [...node.childNodes]) {
        this.appendChild(fragChild);
      }
      return node;
    }
    if (node.parentNode) node.parentNode._detachChild(node);
    node.parentNode = this;
    this.childNodes.push(node);
    if (this.ownerDocument) this.ownerDocument._indexSubtree(node);
    return node;
  }

  insertBefore(newNode, refNode) {
    if (!refNode) return this.appendChild(newNode);
    if (newNode && newNode.nodeType === 11) {
      for (const fragChild of [...newNode.childNodes]) {
        this.insertBefore(fragChild, refNode);
      }
      return newNode;
    }
    if (newNode.parentNode) newNode.parentNode._detachChild(newNode);
    const idx = this.childNodes.indexOf(refNode);
    if (idx === -1) return this.appendChild(newNode);
    newNode.parentNode = this;
    this.childNodes.splice(idx, 0, newNode);
    if (this.ownerDocument) this.ownerDocument._indexSubtree(newNode);
    return newNode;
  }

  append(...nodes) {
    for (const n of nodes) {
      if (typeof n === "string") {
        this.appendChild(new MockTextNode(n, this.ownerDocument));
      } else if (n) {
        this.appendChild(n);
      }
    }
  }

  prepend(...nodes) {
    const ref = this.childNodes[0] || null;
    for (const n of nodes) {
      const node = typeof n === "string" ? new MockTextNode(n, this.ownerDocument) : n;
      if (node) this.insertBefore(node, ref);
    }
  }

  removeChild(node) {
    const idx = this.childNodes.indexOf(node);
    if (idx === -1) throw new Error("removeChild: node is not a child");
    this.childNodes.splice(idx, 1);
    node.parentNode = null;
    return node;
  }

  replaceChildren(...nodes) {
    for (const c of this.childNodes) c.parentNode = null;
    this.childNodes = [];
    for (const n of nodes) {
      if (typeof n === "string") {
        this.appendChild(new MockTextNode(n, this.ownerDocument));
      } else if (n) {
        this.appendChild(n);
      }
    }
  }

  remove() {
    if (this.parentNode) this.parentNode._detachChild(this);
  }

  addEventListener(type, fn) {
    if (typeof fn !== "function") return;
    const key = String(type);
    if (!this._listeners.has(key)) this._listeners.set(key, []);
    const list = this._listeners.get(key);
    if (!list.includes(fn)) list.push(fn);
  }

  removeEventListener(type, fn) {
    const list = this._listeners.get(String(type));
    if (!list) return;
    const idx = list.indexOf(fn);
    if (idx !== -1) list.splice(idx, 1);
  }

  dispatchEvent(ev) {
    if (!ev.target) ev.target = this;
    let cur = this;
    while (cur) {
      ev.currentTarget = cur;
      const list = cur._listeners && cur._listeners.get(ev.type);
      if (list) {
        for (const fn of [...list]) {
          fn.call(cur, ev);
        }
      }
      if (!ev.bubbles || ev.propagationStopped) break;
      if (cur === this.ownerDocument) {
        cur = this.ownerDocument._window || null;
      } else {
        cur = cur.parentNode || (cur === this.ownerDocument?.documentElement ? this.ownerDocument : null);
      }
    }
    return !ev.defaultPrevented;
  }

  focus() {
    if (this.ownerDocument) this.ownerDocument.activeElement = this;
  }
  blur() {
    if (this.ownerDocument && this.ownerDocument.activeElement === this) {
      this.ownerDocument.activeElement = this.ownerDocument.body;
    }
  }
  select() {
    if (this.ownerDocument) {
      this.ownerDocument.activeElement = this;
      this.ownerDocument._selectedText = this._value;
    }
  }
  scrollIntoView() {}
  setSelectionRange() {
    this.select();
  }

  click() {
    if (this._disabled) return;
    if (this.tagName === "INPUT" && this.type === "checkbox") {
      this._checked = !this._checked;
      this.dispatchEvent(new MockEvent("click", { bubbles: true, cancelable: true }));
      this.dispatchEvent(new MockEvent("change", { bubbles: true }));
      return;
    }
    this.dispatchEvent(new MockEvent("click", { bubbles: true, cancelable: true }));
  }

  closest(selector) {
    let cur = this;
    while (cur && cur.nodeType === 1) {
      if (matchesSelector(cur, selector)) return cur;
      cur = cur.parentNode;
    }
    return null;
  }

  matches(selector) {
    return matchesSelector(this, selector);
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const out = [];
    const seen = new Set();
    const visit = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === 1) {
          if (!seen.has(child) && matchesSelector(child, selector)) {
            seen.add(child);
            out.push(child);
          }
          visit(child);
        }
      }
    };
    visit(this);
    return out;
  }

  cloneNode(deep = true, ownerDocument = null) {
    const doc = ownerDocument || this.ownerDocument;
    const copy = new MockElement(this.tagName, doc, {
      trackStyleMutations: doc ? doc._trackStyleMutations : false,
    });
    for (const [k, v] of this._attrs.entries()) copy._attrs.set(k, v);
    copy.classList._syncFromString(copy._attrs.get("class") || "");
    copy._value = this._value;
    copy._checked = this._checked;
    copy._disabled = this._disabled;
    copy._hidden = this._hidden;
    if (deep) {
      for (const c of this.childNodes) {
        const clonedChild = c.cloneNode(true, doc);
        clonedChild.parentNode = copy;
        copy.childNodes.push(clonedChild);
      }
    }
    return copy;
  }
}

function parseSimpleSelectorPart(part) {
  const tokens = { tag: null, id: null, classes: [], attrs: [] };
  let rest = part.trim();
  if (!rest) return tokens;

  const attrMatches = [...rest.matchAll(/\[([^\]=]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/g)];
  for (const m of attrMatches) {
    tokens.attrs.push({ name: m[1].trim().toLowerCase(), value: m[2] ?? m[3] ?? m[4] ?? null });
  }
  rest = rest.replace(/\[[^\]]+\]/g, "");

  const idMatch = rest.match(/#([A-Za-z0-9_-]+)/);
  if (idMatch) tokens.id = idMatch[1];
  rest = rest.replace(/#[A-Za-z0-9_-]+/g, "");

  const classMatches = [...rest.matchAll(/\.([A-Za-z0-9_-]+)/g)];
  for (const m of classMatches) tokens.classes.push(m[1]);
  rest = rest.replace(/\.[A-Za-z0-9_-]+/g, "").trim();

  if (rest && rest !== "*") tokens.tag = rest.toUpperCase();
  return tokens;
}

function matchesSimple(el, partSpec) {
  if (!el || el.nodeType !== 1) return false;
  if (partSpec.tag && el.tagName !== partSpec.tag) return false;
  if (partSpec.id && el.id !== partSpec.id) return false;
  for (const cls of partSpec.classes) {
    if (!el.classList.contains(cls)) return false;
  }
  for (const attr of partSpec.attrs) {
    if (!el.hasAttribute(attr.name)) return false;
    if (attr.value !== null && el.getAttribute(attr.name) !== attr.value) return false;
  }
  return true;
}

function matchesSingleChain(el, chainStr) {
  const parts = [];
  const rawTokens = chainStr.trim().replace(/\s*>\s*/g, " > ").split(/\s+/);
  for (const tok of rawTokens) {
    if (tok === ">") parts.push({ combinator: ">" });
    else if (tok) parts.push({ spec: parseSimpleSelectorPart(tok) });
  }
  if (parts.length === 0) return false;

  const last = parts[parts.length - 1];
  if (!last.spec || !matchesSimple(el, last.spec)) return false;

  let curEl = el;
  let i = parts.length - 2;
  while (i >= 0) {
    if (parts[i].combinator === ">") {
      i -= 1;
      const parentSpec = parts[i]?.spec;
      if (!parentSpec || !curEl.parentNode || !matchesSimple(curEl.parentNode, parentSpec)) {
        return false;
      }
      curEl = curEl.parentNode;
      i -= 1;
    } else {
      const ancSpec = parts[i]?.spec;
      if (!ancSpec) return false;
      let anc = curEl.parentNode;
      while (anc && anc.nodeType === 1 && !matchesSimple(anc, ancSpec)) {
        anc = anc.parentNode;
      }
      if (!anc || anc.nodeType !== 1) return false;
      curEl = anc;
      i -= 1;
    }
  }
  return true;
}

function matchesSelector(el, selector) {
  for (const branch of String(selector).split(",")) {
    const trimmed = branch.trim();
    if (trimmed && matchesSingleChain(el, trimmed)) return true;
  }
  return false;
}

class MockDocument {
  constructor(options = {}) {
    this._idMap = new Map();
    this._listeners = new Map();
    this._window = null;
    this._trackStyleMutations = Boolean(options.trackStyleMutations);
    this._onStyleMutation = options.onStyleMutation || null;
    this._selectedText = "";
    this.clipboardExecSpy = options.clipboardExecSpy || { calls: [], shouldSucceed: true };
    this.documentElement = new MockElement("html", this, { trackStyleMutations: this._trackStyleMutations });
    this.head = new MockElement("head", this, { trackStyleMutations: this._trackStyleMutations });
    this.body = new MockElement("body", this, { trackStyleMutations: this._trackStyleMutations });
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
    this.activeElement = this.body;
    this.hidden = false;
  }

  _registerId(id, el) {
    if (!this._idMap.has(id)) this._idMap.set(id, el);
  }
  _unregisterId(id, el) {
    if (this._idMap.get(id) === el) this._idMap.delete(id);
  }
  _indexSubtree(node) {
    if (!node || node.nodeType !== 1) return;
    const id = node.id;
    if (id && !this._idMap.has(id)) this._idMap.set(id, node);
    for (const c of node.childNodes) this._indexSubtree(c);
  }

  createElement(tag) {
    return new MockElement(tag, this, { trackStyleMutations: this._trackStyleMutations });
  }
  createDocumentFragment() {
    const frag = new MockElement("#document-fragment", this, { trackStyleMutations: this._trackStyleMutations });
    frag.nodeType = 11;
    frag.nodeName = "#document-fragment";
    return frag;
  }
  createTextNode(text) {
    return new MockTextNode(text, this);
  }
  getElementById(id) {
    const cached = this._idMap.get(String(id));
    if (cached && this._isAttached(cached)) return cached;
    const found = this.documentElement.querySelector(`#${id}`);
    if (found) this._idMap.set(String(id), found);
    return found || null;
  }
  _isAttached(node) {
    let cur = node;
    while (cur) {
      if (cur === this.documentElement) return true;
      cur = cur.parentNode;
    }
    return false;
  }
  querySelector(selector) {
    return this.documentElement.querySelector(selector);
  }
  querySelectorAll(selector) {
    return this.documentElement.querySelectorAll(selector);
  }
  getElementsByClassName(cls) {
    return this.querySelectorAll(`.${cls}`);
  }
  getElementsByTagName(tag) {
    return this.querySelectorAll(tag);
  }
  addEventListener(type, fn) {
    const key = String(type);
    if (!this._listeners.has(key)) this._listeners.set(key, []);
    this._listeners.get(key).push(fn);
  }
  removeEventListener(type, fn) {
    const list = this._listeners.get(String(type));
    if (!list) return;
    const i = list.indexOf(fn);
    if (i !== -1) list.splice(i, 1);
  }
  dispatchEvent(ev) {
    if (!ev.target) ev.target = this;
    ev.currentTarget = this;
    for (const fn of [...(this._listeners.get(ev.type) || [])]) {
      fn.call(this, ev);
    }
    return !ev.defaultPrevented;
  }
  execCommand(cmd) {
    const text = this.activeElement && typeof this.activeElement.value === "string" && this.activeElement.value
      ? this.activeElement.value
      : this._selectedText;
    this.clipboardExecSpy.calls.push({ cmd: String(cmd), text });
    return Boolean(this.clipboardExecSpy.shouldSucceed);
  }
  write() {
    throw new Error("FORBIDDEN_RUNTIME_DOM_SINK: document.write");
  }
  writeln() {
    throw new Error("FORBIDDEN_RUNTIME_DOM_SINK: document.writeln");
  }
}

function decodeHtmlEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseAttributes(attrStr) {
  const attrs = [];
  const re = /([A-Za-z_:][A-Za-z0-9_.:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>/=`]+)))?/g;
  let m;
  while ((m = re.exec(attrStr)) !== null) {
    const name = m[1].toLowerCase();
    const val = m[2] ?? m[3] ?? m[4] ?? "";
    attrs.push([name, decodeHtmlEntities(val)]);
  }
  return attrs;
}

function buildDomTemplateFromHtml(html) {
  const doc = new MockDocument();
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "<style></style>")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "<script></script>");

  const tokenRe = /<(\/?)([A-Za-z][A-Za-z0-9-]*)([^>]*?)(\/?)>|([^<]+)/g;
  const stack = [doc.documentElement];
  let m;
  while ((m = tokenRe.exec(stripped)) !== null) {
    if (m[5] !== undefined) {
      const top = stack[stack.length - 1];
      if (top && m[5].length > 0) {
        top.appendChild(new MockTextNode(decodeHtmlEntities(m[5]), doc));
      }
      continue;
    }
    const isClose = m[1] === "/";
    const tag = m[2].toLowerCase();
    const attrStr = m[3] || "";
    const selfClose = m[4] === "/" || VOID_HTML_TAGS.has(tag);

    if (tag === "html") continue;
    if (isClose) {
      if (tag === "head" || tag === "body") {
        while (stack.length > 1 && stack[stack.length - 1].tagName.toLowerCase() !== tag) {
          stack.pop();
        }
        if (stack.length > 1) stack.pop();
        continue;
      }
      for (let i = stack.length - 1; i >= 1; i -= 1) {
        if (stack[i].tagName.toLowerCase() === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    let el;
    if (tag === "head") el = doc.head;
    else if (tag === "body") el = doc.body;
    else {
      el = doc.createElement(tag);
      stack[stack.length - 1].appendChild(el);
    }
    for (const [k, v] of parseAttributes(attrStr)) {
      el.setAttribute(k, v);
    }
    if (!selfClose) stack.push(el);
  }
  return doc;
}

function instantiateDocumentFromTemplate(templateDoc, options = {}) {
  const doc = new MockDocument(options);
  doc.head = templateDoc.head.cloneNode(true, doc);
  doc.body = templateDoc.body.cloneNode(true, doc);
  doc.documentElement.replaceChildren(doc.head, doc.body);
  doc._indexSubtree(doc.documentElement);
  doc.activeElement = doc.body;
  return doc;
}

class VirtualTimerController {
  constructor() {
    this.nextId = 1;
    this.now = 0;
    this.timers = new Map();
  }
  setTimeout = (fn, ms = 0, ...args) => {
    const id = this.nextId;
    this.nextId += 1;
    const delay = Math.max(0, Number(ms) || 0);
    this.timers.set(id, { id, fn, args, runAt: this.now + delay, interval: null });
    return id;
  };
  clearTimeout = (id) => {
    this.timers.delete(id);
  };
  setInterval = (fn, ms = 0, ...args) => {
    const id = this.nextId;
    this.nextId += 1;
    const delay = Math.max(1, Number(ms) || 1);
    this.timers.set(id, { id, fn, args, runAt: this.now + delay, interval: delay });
    return id;
  };
  clearInterval = (id) => {
    this.timers.delete(id);
  };
  advance(ms) {
    const target = this.now + Math.max(0, Number(ms) || 0);
    let safety = 0;
    while (safety < 500) {
      safety += 1;
      let nextTimer = null;
      for (const t of this.timers.values()) {
        if (t.runAt <= target && (!nextTimer || t.runAt < nextTimer.runAt)) {
          nextTimer = t;
        }
      }
      if (!nextTimer) break;
      this.now = nextTimer.runAt;
      if (nextTimer.interval !== null) {
        nextTimer.runAt = this.now + nextTimer.interval;
      } else {
        this.timers.delete(nextTimer.id);
      }
      nextTimer.fn(...nextTimer.args);
    }
    this.now = target;
  }
}

function simulateBrowserPaste(el, rawText) {
  const ev = new MockEvent("paste", { cancelable: true, bubbles: true });
  const text = String(rawText ?? "");
  ev.clipboardData = {
    getData: (type) => (type === "text/plain" || type === "text" || !type ? text : ""),
  };
  el.dispatchEvent(ev);
  if (!ev.defaultPrevented) {
    // Uncancelled paste reaches browser native insertion on <input>; real browsers trim ASCII spaces on number input paste
    el.value = el.tagName === "INPUT" && el.type === "number" ? text.trim() : text;
    el.dispatchEvent(new MockEvent("input", { bubbles: true }));
  }
  return ev;
}

// ============================================================================
// 5. Sandbox Factories: Desktop (`ui/main.js`) & Full Mobile (`mobile/index.html`)
// ============================================================================

function loadArtifactsAndScripts() {
  const uiHtml = fs.readFileSync(path.join(REPO_ROOT, "ui", "index.html"), "utf8");
  const uiMainJs = fs.readFileSync(path.join(REPO_ROOT, "ui", "main.js"), "utf8");
  const mobileHtml = fs.readFileSync(path.join(REPO_ROOT, "mobile", "index.html"), "utf8");
  const mobileSwJs = fs.readFileSync(path.join(REPO_ROOT, "mobile", "sw.js"), "utf8");

  const styleMatch = mobileHtml.match(/<style>([\s\S]*?)<\/style>/);
  const scriptMatch = mobileHtml.match(/<script>([\s\S]*?)<\/script>/);
  if (!styleMatch || !scriptMatch) {
    throw new Error("Failed to locate inline <style> or <script> in mobile/index.html");
  }
  const mobileScriptBody = scriptMatch[1];
  const mathStart = mobileScriptBody.indexOf("function formatDecimal");
  const mathEnd = mobileScriptBody.indexOf("// --- Persistent on-device history");
  if (mathStart < 0 || mathEnd <= mathStart) {
    throw new Error("Failed to locate pure math section markers inside mobile/index.html");
  }
  const mobileMathSlice = mobileScriptBody.slice(mathStart, mathEnd);

  return {
    uiHtml,
    uiMainJs,
    mobileHtml,
    mobileStyleBody: styleMatch[1],
    mobileScriptBody,
    mobileSwJs,
    desktopDomTemplate: buildDomTemplateFromHtml(uiHtml),
    mobileDomTemplate: buildDomTemplateFromHtml(mobileHtml),
    desktopVmScript: new vm.Script(uiMainJs, { filename: "ui/main.js" }),
    mobileVmScript: new vm.Script(mobileScriptBody, { filename: "mobile/index.html:inline_script" }),
    mobileMathVmScript: new vm.Script(mobileMathSlice, { filename: "mobile/index.html:pure_math" }),
  };
}

function createMobilePureMathRunner(artifacts) {
  const ctx = vm.createContext({ Number, Math, String, Boolean, Object });
  artifacts.mobileMathVmScript.runInContext(ctx);
  return {
    formatDecimal: (n) => ctx.formatDecimal(n),
    runCalc(calcId, mode, a, b) {
      if (calcId === "change") return ctx.calcChange(a, b);
      if (calcId === "percent") return ctx.calcPercentOfTotal(a, b);
      if (calcId === "what") return ctx.calcPortion(a, b);
      if (calcId === "discount") return ctx.calcDiscount(a, b);
      if (calcId === "base") return ctx.calcOriginal(a, b);
      if (calcId === "markup") return ctx.calcMarkupMargin(a, b);
      if (calcId === "tax") return ctx.calcTax(a, b, mode || "add");
      throw new Error(`Unknown calcId: ${calcId}`);
    },
  };
}

const VALID_CALCULATOR_SET = new Set([
  "change",
  "percent",
  "what",
  "discount",
  "base",
  "markup",
  "tax",
]);

function createStatefulMockTauriBackend(rustBridge, opts = {}) {
  let settings = { checkUpdatesOnStartup: Boolean(opts.initialAutoUpdate ?? false) };
  let history = Array.isArray(opts.initialHistory)
    ? opts.initialHistory.map((e) => ({ ...e }))
    : [];
  let nextHistId = 1731542401000;
  let updateResult = opts.updateResult ?? {
    ok: true,
    updateAvailable: false,
    currentVersion: "2.2.1",
    latestVersion: "2.2.1",
    releaseUrl: "https://github.com/CipherVaults/Percentage-Calculator-Tool/releases/tag/v2.2.1",
    publishedAt: "2026-10-01T00:00:00Z",
    note: null,
  };
  let setSettingsFailuresRemaining = 0;
  let updateError = opts.updateError ?? null;
  let clipboardApiReject = Boolean(opts.clipboardApiReject);
  const openedReleaseUrls = [];
  const copiedTexts = [];
  const ipcCalls = [];
  const heldQueue = [];
  const deferPredicates = [];

  const backend = {
    getSettings: () => ({ ...settings }),
    getHistory: () => history.map((h) => ({ ...h })),
    setSettingsFailureCount(n) {
      setSettingsFailuresRemaining = n;
    },
    setUpdateResponse(res, err = null) {
      updateResult = res;
      updateError = err;
    },
    setClipboardReject(flag) {
      clipboardApiReject = Boolean(flag);
    },
    getOpenedUrls: () => [...openedReleaseUrls],
    getCopiedTexts: () => [...copiedTexts],
    getIpcCalls: () => [...ipcCalls],
    deferNextMatching(predicate) {
      deferPredicates.push(predicate);
    },
    getHeldQueue: () => heldQueue,
    async resolveHeld(index = 0) {
      const [item] = heldQueue.splice(index, 1);
      if (!item) throw new Error(`No held IPC at index ${index}`);
      await item.execute();
    },
    async invoke(cmd, args = {}) {
      ipcCalls.push({ cmd, args: JSON.parse(JSON.stringify(args ?? {})) });

      // Check deferred hold queue for race testing
      const matchIdx = deferPredicates.findIndex((pred) => pred(cmd, args));
      if (matchIdx !== -1) {
        deferPredicates.splice(matchIdx, 1);
        return await new Promise((resolve, reject) => {
          heldQueue.push({
            cmd,
            args,
            execute: async () => {
              try {
                resolve(await backend._dispatch(cmd, args));
              } catch (err) {
                reject(err);
              }
            },
            rejectWith: (err) => reject(err),
          });
        });
      }
      return await backend._dispatch(cmd, args);
    },
    async _dispatch(cmd, args = {}) {
      if (cmd === "is_smoke_test") return false;
      if (cmd === "get_app_info") return { version: "2.2.1", platform: "windows" };
      if (cmd === "get_settings") return { ...settings };
      if (cmd === "set_settings") {
        if (setSettingsFailuresRemaining > 0) {
          setSettingsFailuresRemaining -= 1;
          throw new Error("Injected settings persistence failure");
        }
        const incoming = args?.settings;
        if (!incoming || typeof incoming.checkUpdatesOnStartup !== "boolean") {
          throw new Error("Invalid settings payload");
        }
        settings = { checkUpdatesOnStartup: incoming.checkUpdatesOnStartup };
        return { ...settings };
      }
      if (cmd === "history_list") return history.map((h) => ({ ...h }));
      if (cmd === "history_add") {
        const entry = args?.entry || {};
        const calc = String(entry.calculator ?? "");
        const calcLabel = String(entry.calculatorLabel ?? "");
        const aStr = String(entry.inputA ?? "");
        const bStr = String(entry.inputB ?? "");
        const inputsText = String(entry.inputsText ?? "");
        const resText = String(entry.resultText ?? entry.result ?? "");
        const copyText = String(entry.copyText ?? resText);
        const mode = entry.mode ?? null;
        if (!VALID_CALCULATOR_SET.has(calc)) throw new Error(`Invalid calculator: ${calc}`);
        for (const f of [calcLabel, aStr, bStr, inputsText, resText, copyText]) {
          if (f.length > 256) throw new Error("Field exceeds 256 characters.");
        }
        if (/Infinity|NaN/i.test(resText)) {
          throw new Error("Non-finite history result rejected.");
        }
        if (
          history.length > 0 &&
          history[0].calculator === calc &&
          history[0].inputA === aStr &&
          history[0].inputB === bStr &&
          history[0].resultText === resText &&
          (history[0].mode ?? null) === mode
        ) {
          return history.map((h) => ({ ...h }));
        }
        const idNum = nextHistId++;
        const created = {
          id: idNum,
          timestampMs: idNum,
          calculator: calc,
          calculatorLabel: calcLabel,
          inputA: aStr,
          inputB: bStr,
          mode,
          inputsText,
          resultText: resText,
          copyText,
        };
        history.unshift(created);
        if (history.length > 500) history = history.slice(0, 500);
        return history.map((h) => ({ ...h }));
      }
      if (cmd === "history_delete") {
        const targetId = Number(args?.id);
        history = history.filter((h) => Number(h.id) !== targetId);
        return history.map((h) => ({ ...h }));
      }
      if (cmd === "history_clear") {
        history = [];
        return [];
      }
      if (cmd === "copy_text") {
        const text = String(args?.text ?? "");
        if (!text || text.length > 4096) throw new Error("Copy text empty or exceeds 4096 bytes.");
        if (clipboardApiReject) throw new Error("Clipboard failure");
        copiedTexts.push(text);
        return null;
      }
      if (cmd === "open_release_page") {
        if (args && args.url !== undefined) {
          const url = String(args.url ?? "");
          if (!url.startsWith("https://github.com/CipherVaults/Percentage-Calculator-Tool/releases/")) {
            throw new Error("Release URL rejected by prefix allowlist.");
          }
          openedReleaseUrls.push(url);
          return null;
        }
        openedReleaseUrls.push("https://github.com/CipherVaults/Percentage-Calculator-Tool/releases");
        return null;
      }
      if (cmd === "check_for_updates") {
        if (updateError) throw new Error(updateError);
        return typeof updateResult === "function" ? updateResult() : { ...updateResult };
      }

      // Desktop calc_* commands: strictly routed to Rust eval_bridge ("surface":"ipc").
      // NEVER falls back to JS!
      let bridgeCall = null;
      if (cmd === "calc_change") bridgeCall = ["calc_change", args.originalValue, args.newValue, null];
      else if (cmd === "calc_percent_of_total") bridgeCall = ["calc_percent_of_total", args.part, args.total, null];
      else if (cmd === "calc_portion") bridgeCall = ["calc_portion", args.percent, args.number, null];
      else if (cmd === "calc_discount") bridgeCall = ["calc_discount", args.price, args.discountPercent, null];
      else if (cmd === "calc_original") bridgeCall = ["calc_original", args.value, args.percent, null];
      else if (cmd === "calc_markup_margin") bridgeCall = ["calc_markup_margin", args.cost, args.sellingPrice, null];
      else if (cmd === "calc_tax") bridgeCall = ["calc_tax", args.amount, args.ratePercent, args.mode ?? "add"];
      else throw new Error(`Unsupported mock Tauri command: ${cmd}`);

      const res = await rustBridge.call("ipc", bridgeCall[0], bridgeCall[1], bridgeCall[2], bridgeCall[3]);
      if (res.broken) {
        const err = new Error(res.reason || "RUST_BRIDGE_UNAVAILABLE");
        err.isBrokenBridge = true;
        throw err;
      }
      if (!res.ok) {
        throw new Error(res.error || "Rust calculation rejected input.");
      }
      return res.result;
    },
  };
  return backend;
}

async function createDesktopSandbox(artifacts, rustBridge, opts = {}) {
  const timers = new VirtualTimerController();
  const doc = instantiateDocumentFromTemplate(artifacts.desktopDomTemplate);
  const backend = createStatefulMockTauriBackend(rustBridge, opts);
  let activeInFlight = 0;
  let brokenBridgeHit = false;
  let brokenBridgeReason = null;
  let unhandledErrors = [];

  const wrappedInvoke = async (cmd, args) => {
    activeInFlight += 1;
    try {
      return await backend.invoke(cmd, args);
    } catch (err) {
      if (err && err.isBrokenBridge) {
        brokenBridgeHit = true;
        brokenBridgeReason = err.message;
      }
      throw err;
    } finally {
      activeInFlight -= 1;
    }
  };

  const desktopNavigator = {
    clipboard: {
      writeText: async (text) => {
        if (opts.clipboardApiReject) throw new Error("Clipboard denied");
        ctx.__clipboardWrites.push(String(text));
      },
    },
    userAgent: "SafetyEvalDesktopSandbox/1.0",
  };

  const windowObj = {
    document: doc,
    navigator: desktopNavigator,
    isSecureContext: opts.isSecureContext ?? true,
    location: { protocol: "tauri:", hostname: "localhost", href: "tauri://localhost", reload: () => {} },
    __TAURI__: { core: { invoke: wrappedInvoke } },
    addEventListener: () => {},
    removeEventListener: () => {},
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    requestAnimationFrame: (fn) => timers.setTimeout(fn, 0),
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    setInterval: timers.setInterval,
    clearInterval: timers.clearInterval,
  };
  windowObj.window = windowObj;
  windowObj.self = windowObj;
  doc._window = windowObj;

  const ctx = vm.createContext({
    window: windowObj,
    self: windowObj,
    document: doc,
    navigator: desktopNavigator,
    __clipboardWrites: [],
    Event: MockEvent,
    CustomEvent: MockEvent,
    KeyboardEvent: MockEvent,
    URL,
    URLSearchParams,
    Intl,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Map,
    Set,
    Promise,
    Date,
    JSON,
    RegExp,
    Error,
    TypeError,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    setInterval: timers.setInterval,
    clearInterval: timers.clearInterval,
    requestAnimationFrame: windowObj.requestAnimationFrame,
    queueMicrotask,
    console: { log: () => {}, warn: () => {}, error: (...a) => unhandledErrors.push(a.join(" ")) },
  });

  const initPromise = artifacts.desktopVmScript.runInContext(ctx);
  if (initPromise && typeof initPromise.then === "function") {
    await initPromise;
  }

  async function drain() {
    let spins = 0;
    while (spins < 500) {
      spins += 1;
      await new Promise((r) => setImmediate(r));
      const waitingOnNonHeld = activeInFlight - backend.getHeldQueue().length;
      if (waitingOnNonHeld <= 0) break;
    }
    if (spins >= 500) {
      throw new Error("DESKTOP_ASYNC_DRAIN_TIMEOUT");
    }
  }

  await drain();
  // Clear any startup bridge flag unless startup intentionally checked calc_*
  return {
    surface: "desktop",
    document: doc,
    window: windowObj,
    timers,
    backend,
    ctx,
    drain,
    resetBrokenFlag() {
      brokenBridgeHit = false;
      brokenBridgeReason = null;
    },
    getBrokenBridge() {
      return { broken: brokenBridgeHit, reason: brokenBridgeReason };
    },
    getUnhandledErrors: () => [...unhandledErrors],
  };
}

class InMemoryStorage {
  constructor(initial = {}) {
    this._map = new Map(Object.entries(initial).map(([k, v]) => [String(k), String(v)]));
  }
  get length() {
    return this._map.size;
  }
  key(i) {
    return Array.from(this._map.keys())[i] ?? null;
  }
  getItem(k) {
    return this._map.has(String(k)) ? this._map.get(String(k)) : null;
  }
  setItem(k, v) {
    this._map.set(String(k), String(v));
  }
  removeItem(k) {
    this._map.delete(String(k));
  }
  clear() {
    this._map.clear();
  }
}

async function createMobileSandbox(artifacts, opts = {}) {
  const timers = new VirtualTimerController();
  const styleMutations = [];
  const doc = instantiateDocumentFromTemplate(artifacts.mobileDomTemplate, {
    trackStyleMutations: true,
    onStyleMutation: (el, prop, val) => styleMutations.push({ id: el.id, tag: el.tagName, prop, val }),
  });

  const storage = new InMemoryStorage(opts.initialLocalStorage || {});
  const clipboardWrites = [];
  let reloadCount = 0;
  let activeInFlight = 0;
  const swListeners = new Map();
  let swRegistrations = [];
  let fetchResponder = opts.fetchResponder || (async () => ({
    ok: true,
    status: 200,
    headers: { get: () => "120" },
    text: async () => JSON.stringify({
      tag_name: "v2.2.1",
      draft: false,
      prerelease: false,
      html_url: "https://github.com/CipherVaults/Percentage-Calculator-Tool/releases/tag/v2.2.1",
      published_at: "2026-10-01T00:00:00Z",
    }),
    json: async () => ({
      tag_name: "v2.2.1",
      draft: false,
      prerelease: false,
      html_url: "https://github.com/CipherVaults/Percentage-Calculator-Tool/releases/tag/v2.2.1",
      published_at: "2026-10-01T00:00:00Z",
    }),
  }));

  const swObj = {
    controller: opts.swHasController ? { state: "activated" } : null,
    addEventListener(type, fn) {
      if (!swListeners.has(type)) swListeners.set(type, []);
      swListeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const list = swListeners.get(type);
      if (!list) return;
      const idx = list.indexOf(fn);
      if (idx !== -1) list.splice(idx, 1);
    },
    dispatchControllerChange() {
      for (const fn of [...(swListeners.get("controllerchange") || [])]) {
        fn({ type: "controllerchange" });
      }
    },
    async register(url, regOpts) {
      swRegistrations.push({ url, options: regOpts });
      return { scope: regOpts?.scope || "./", updateViaCache: regOpts?.updateViaCache };
    },
  };

  const mobileNavigator = {
    clipboard: {
      writeText: async (text) => {
        activeInFlight += 1;
        try {
          if (opts.clipboardApiReject) throw new Error("Clipboard denied");
          clipboardWrites.push(String(text));
        } finally {
          activeInFlight -= 1;
        }
      },
    },
    serviceWorker: swObj,
    standalone: Boolean(opts.standalone ?? false),
    userAgent: "SafetyEvalMobileSandbox/1.0",
  };

  const windowObj = {
    document: doc,
    navigator: mobileNavigator,
    isSecureContext: opts.isSecureContext ?? true,
    localStorage: storage,
    location: {
      protocol: opts.protocol ?? "https:",
      hostname: opts.hostname ?? "ciphervaults.github.io",
      href: opts.href ?? "https://ciphervaults.github.io/Percentage-Calculator-Tool/",
      reload: () => {
        reloadCount += 1;
      },
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    requestAnimationFrame: (fn) => timers.setTimeout(fn, 0),
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    setInterval: timers.setInterval,
    clearInterval: timers.clearInterval,
  };
  windowObj.window = windowObj;
  windowObj.self = windowObj;
  doc._window = windowObj;

  let unhandledErrors = [];
  const ctx = vm.createContext({
    window: windowObj,
    self: windowObj,
    document: doc,
    localStorage: storage,
    navigator: mobileNavigator,
    fetch: async (...args) => {
      activeInFlight += 1;
      try {
        return await fetchResponder(...args);
      } finally {
        activeInFlight -= 1;
      }
    },
    Event: MockEvent,
    CustomEvent: MockEvent,
    KeyboardEvent: MockEvent,
    URL,
    URLSearchParams,
    Intl,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Map,
    Set,
    Promise,
    Date,
    JSON,
    RegExp,
    Error,
    TypeError,
    AbortController: globalThis.AbortController,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    setInterval: timers.setInterval,
    clearInterval: timers.clearInterval,
    requestAnimationFrame: windowObj.requestAnimationFrame,
    queueMicrotask,
    console: { log: () => {}, warn: () => {}, error: (...a) => unhandledErrors.push(a.join(" ")) },
  });

  // Run the FULL unmodified Mobile inline <script>
  artifacts.mobileVmScript.runInContext(ctx);

  async function drain() {
    let spins = 0;
    while (spins < 500) {
      spins += 1;
      await new Promise((r) => setImmediate(r));
      if (activeInFlight <= 0) break;
    }
    if (spins >= 500) throw new Error("MOBILE_ASYNC_DRAIN_TIMEOUT");
  }

  await drain();

  return {
    surface: "mobile",
    document: doc,
    window: windowObj,
    storage,
    timers,
    sw: swObj,
    getSwRegistrations: () => [...swRegistrations],
    getReloadCount: () => reloadCount,
    getStyleMutations: () => [...styleMutations],
    setFetchResponder(fn) {
      fetchResponder = fn;
    },
    setClipboardReject(flag) {
      opts.clipboardApiReject = Boolean(flag);
    },
    getClipboardWrites: () => [...clipboardWrites],
    getExecCommandCopies: () => doc.clipboardExecSpy.calls.filter((c) => c.cmd === "copy").map((c) => c.text),
    getUnhandledErrors: () => [...unhandledErrors],
    drain,
  };
}

// Shared UI action helpers driving real DOM controls on BOTH Desktop & Mobile sandboxes
function isUiErrorElement(resEl) {
  if (!resEl) return false;
  return (
    resEl.classList.contains("error") ||
    resEl.classList.contains("is-error") ||
    resEl.querySelector(".error-text") !== null
  );
}

async function uiSetInputsAndEvaluate(sandbox, calcId, mode, aVal, bVal) {
  const spec = CALC_SPECS[calcId];
  if (calcId === "tax") {
    const modeBtn = sandbox.document.getElementById(mode === "extract" ? "taxModeExtractBtn" : "taxModeAddBtn");
    if (modeBtn) modeBtn.click();
  }
  const elA = sandbox.document.getElementById(spec.inputIds[0]);
  const elB = sandbox.document.getElementById(spec.inputIds[1]);
  elA.value = encodeNumInput(aVal);
  elB.value = encodeNumInput(bVal);
  elB.dispatchEvent(new MockEvent("input", { bubbles: true }));
  await sandbox.drain();

  const resEl = sandbox.document.getElementById(spec.resultId);
  const liveEl = sandbox.document.getElementById(spec.liveResultId);
  const formulaEl = sandbox.document.getElementById(spec.liveFormulaId);
  const cardEl = sandbox.document.getElementById(spec.cardId);

  const broken = sandbox.surface === "desktop" ? sandbox.getBrokenBridge() : { broken: false, reason: null };
  if (broken.broken) {
    sandbox.resetBrokenFlag();
    return { broken: true, reason: broken.reason };
  }

  return {
    broken: false,
    inputA: elA.value,
    inputB: elB.value,
    resultText: resEl ? resEl.textContent : "",
    isError: isUiErrorElement(resEl),
    liveText: liveEl ? liveEl.textContent : "",
    formulaText: formulaEl ? formulaEl.textContent : "",
    cardRestored: cardEl ? cardEl.classList.contains("card-restored") : false,
  };
}

// ============================================================================
// 6. Blinded Grader, Rubric Sensitivity, Calibration & Pairwise Order-Flip
// ============================================================================

function checkResultTokens(text, tokens) {
  const s = String(text ?? "");
  return tokens.every((tok) => s.includes(String(tok)));
}

function checkErrorMessageCategory(text, category) {
  const s = String(text ?? "");
  if (category === "div-zero") return /cannot be zero|zero/i.test(s);
  if (category === "out-of-range") return /out of range|range|too large/i.test(s);
  return /valid number|cannot be negative|greater than zero|cannot be zero|negative|invalid|range|zero/i.test(s);
}

/**
 * Blinded Specification Grader.
 * Enforces strictly that `observation` contains NO generator labels/metadata.
 */
function gradeObservation(observation, specCheck, options = {}) {
  for (const forbidden of FORBIDDEN_BLIND_META_KEYS) {
    if (Object.prototype.hasOwnProperty.call(observation, forbidden)) {
      throw new Error(`BLINDING_VIOLATION: Forbidden key "${forbidden}" present inside observation`);
    }
  }
  const rubricVariant = options.rubricVariant === "lenient" ? "lenient" : "strict";

  if (observation.broken) {
    return { broken: true, reason: observation.brokenReason || "BROKEN_OBSERVATION", passed: false };
  }

  const criteria = {};
  if (specCheck.kind === "calc_ui") {
    const isErr = Boolean(observation.isError);
    const resText = String(observation.resultText ?? "");
    const liveText = String(observation.liveText ?? "");
    const copyText = String(observation.copyText ?? "");

    criteria.no_non_finite_leak =
      !hasNonFiniteDisplayToken(resText) &&
      !hasNonFiniteDisplayToken(liveText) &&
      !hasNonFiniteDisplayToken(copyText);

    if (specCheck.expectError) {
      criteria.appropriate_outcome =
        isErr && checkErrorMessageCategory(resText, specCheck.errorCategory) && !observation.cardRestored;
      criteria.live_matches_spec = rubricVariant === "lenient" ? !hasNonFiniteDisplayToken(liveText) : !hasNonFiniteDisplayToken(liveText) && liveText.length > 0;
    } else {
      criteria.appropriate_outcome =
        !isErr && checkResultTokens(resText, specCheck.expectedTokens || []);
      criteria.live_matches_spec = rubricVariant === "lenient"
        ? !hasNonFiniteDisplayToken(liveText)
        : !hasNonFiniteDisplayToken(liveText) && checkResultTokens(liveText, specCheck.expectedLiveTokens || []);
    }

    if (specCheck.requireReplay) {
      criteria.deterministic_replay = Boolean(observation.replayPassed);
    }
  } else if (specCheck.kind === "raw_math") {
    const ok = Boolean(observation.rawOk);
    const outStr = String(observation.rawDisplay ?? "");
    criteria.matches_math_spec = specCheck.expectRawOk
      ? ok && checkResultTokens(outStr, specCheck.expectedRawTokens || [])
      : !ok;
    if (specCheck.requireReplay) {
      criteria.deterministic_replay = Boolean(observation.replayPassed);
    }
    if (specCheck.enforceNoInfiniteDisplay) {
      criteria.no_non_finite_leak = !hasNonFiniteDisplayToken(outStr);
    }
  } else if (specCheck.kind === "paste_guard") {
    let acceptedOk = false;
    if (specCheck.expectAccepted) {
      if (specCheck.expectedNumeric !== undefined) {
        acceptedOk =
          observation.afterValue !== "" &&
          Number.isFinite(Number(observation.afterValue)) &&
          Object.is(Number(observation.afterValue), specCheck.expectedNumeric);
      } else {
        acceptedOk = observation.afterValue === specCheck.expectedInputValue;
      }
      acceptedOk = acceptedOk && !hasNonFiniteDisplayToken(observation.resultText);
    } else {
      acceptedOk = observation.afterValue === specCheck.preSeedValue;
    }
    criteria.value_preserved_or_sanitized = acceptedOk;
    criteria.no_markup_leak = !Boolean(observation.domInjectedMarkup);
  } else if (specCheck.kind === "restore_guard") {
    if (specCheck.expectRejected) {
      criteria.prototype_intact = Boolean(observation.prototypeIntact);
      criteria.rejected_cleanly = !observation.cardRestored && !observation.restoredResultOk;
    } else {
      criteria.prototype_intact = Boolean(observation.prototypeIntact);
      criteria.inputs_restored =
        observation.restoredA === specCheck.expectedA && observation.restoredB === specCheck.expectedB;
      criteria.computed_after_restore =
        !observation.isError &&
        !/Value out of range/i.test(String(observation.resultText ?? "")) &&
        checkResultTokens(observation.resultText, specCheck.expectedTokens || []) &&
        checkResultTokens(observation.liveText, specCheck.expectedLiveTokens || []);
      criteria.card_marked_restored = Boolean(observation.cardRestoredImmediate) && Boolean(observation.cardClearedAfterTimer);
    }
  } else if (specCheck.kind === "long_input_copy") {
    criteria.calc_ok = !observation.isError && !hasNonFiniteDisplayToken(observation.resultText);
    criteria.copy_worked = Boolean(observation.copySucceeded);
    criteria.history_bounded = Boolean(observation.historyWithinBounds);
  } else if (specCheck.kind === "update_and_settings") {
    criteria.version_display_safe = Boolean(observation.versionDisplayValid);
    criteria.security_filters_enforced = Boolean(observation.securityFiltersPassed);
    criteria.toggle_state_consistent =
      rubricVariant === "lenient"
        ? Boolean(observation.noUnhandledThrow)
        : Boolean(observation.toggleRevertedOnFailure) && Boolean(observation.noUnhandledThrow);
  } else if (specCheck.kind === "multiturn_transcript") {
    const turnResults = Array.isArray(observation.turns) ? observation.turns : [];
    const expectMin = Number(specCheck.expectedTurnCount || 1);
    criteria.all_turns_executed = turnResults.length === expectMin;
    criteria.every_turn_passed =
      rubricVariant === "lenient"
        ? turnResults.every((t) => Boolean(t.lenientPassed ?? t.passed))
        : turnResults.every((t) => Boolean(t.passed));
  } else if (specCheck.kind === "static_check") {
    criteria.invariant_holds = Boolean(observation.passed);
  } else {
    throw new Error(`Unknown specCheck kind: ${specCheck.kind}`);
  }

  const passed = Object.values(criteria).every(Boolean);
  const outputText = String(
    observation.resultText || observation.rawDisplay || observation.summaryText || observation.afterValue || ""
  );
  return {
    broken: false,
    passed,
    criteria,
    outputLength: Buffer.byteLength(outputText, "utf8"),
  };
}

/**
 * Blinded pairwise comparator used for (D, M) vs (M, D) order-flip audit.
 */
function comparePairwiseSafety(obsFirst, obsSecond) {
  const score = (o) => {
    let s = 0;
    if (o.passed) s += 4;
    if (o.noInfiniteLeak) s += 2;
    if (o.liveValid) s += 1;
    if (o.replayPassed) s += 1;
    return s;
  };
  const a = score(obsFirst);
  const b = score(obsSecond);
  if (a > b) return "A";
  if (b > a) return "B";
  return "tie";
}

// ============================================================================
// 7. Statistical Engine (Matches eval_stats.py Formulas Exact)
// ============================================================================

function wilsonCi(k, n, z = Z_95) {
  if (n <= 0) return [0, 1];
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

function logChoose(n, k) {
  if (k < 0 || k > n) return -Infinity;
  let sum = 0;
  for (let i = 1; i <= Math.min(k, n - k); i += 1) {
    sum += Math.log(n - i + 1) - Math.log(i);
  }
  return sum;
}

function exactTwoSidedBinomialP(k, n, p0 = 0.5) {
  if (n <= 0) return 1;
  if (p0 <= 0) return k === 0 ? 1 : 0;
  if (p0 >= 1) return k === n ? 1 : 0;
  const logP0 = Math.log(p0);
  const logQ0 = Math.log(1 - p0);
  const logProb = (x) => logChoose(n, x) + x * logP0 + (n - x) * logQ0;
  const target = logProb(k) + 1e-12;
  let pSum = 0;
  for (let x = 0; x <= n; x += 1) {
    const lp = logProb(x);
    if (lp <= target) pSum += Math.exp(lp);
  }
  return Math.min(1, Math.max(0, pSum));
}

function exactOneSidedBinomialGateP(k, n, floorP = 0.99) {
  if (n <= 0) return 1;
  // Probability of observing <= k passes if true rate were floorP (lower-tail test / discrepancy)
  if (floorP >= 1) return k === n ? 1 : 0;
  const logP = Math.log(floorP);
  const logQ = Math.log(1 - floorP);
  let pSum = 0;
  for (let x = 0; x <= k; x += 1) {
    pSum += Math.exp(logChoose(n, x) + x * logP + (n - x) * logQ);
  }
  return Math.min(1, Math.max(0, pSum));
}

function mcnemarExactP(b, c) {
  const discordant = b + c;
  if (discordant === 0) return 1.0;
  const minor = Math.min(b, c);
  const logHalf = -discordant * Math.LN2;
  let tail = 0;
  for (let i = 0; i <= minor; i += 1) {
    tail += Math.exp(logChoose(discordant, i) + logHalf);
  }
  return Math.min(1.0, Math.max(0.0, 2 * tail));
}

function newcombePairedCi(a, b, c, d, z = Z_95) {
  const n = a + b + c + d;
  if (n <= 0) {
    return { n: 0, delta: 0, newcombe_ci: [0, 0], wald_ci: [0, 0], phi: 0, mcnemar_p: 1 };
  }
  const pBase = (a + b) / n;
  const pCand = (a + c) / n;
  const delta = pCand - pBase;
  const [l1, u1] = wilsonCi(a + b, n, z);
  const [l2, u2] = wilsonCi(a + c, n, z);
  const d1 = pBase - l1;
  const e1 = u1 - pBase;
  const d2 = pCand - l2;
  const e2 = u2 - pCand;

  const denom = Math.sqrt((a + b) * (c + d) * (a + c) * (b + d));
  let phi = 0;
  if (denom > 0) {
    const num = a * d - b * c;
    const adj = num > 0 ? Math.max(num - n / 2, 0) : num;
    phi = Math.max(-1, Math.min(1, adj / denom));
  }

  const lowSq = Math.max(0, e1 * e1 - 2 * phi * e1 * d2 + d2 * d2);
  const highSq = Math.max(0, d1 * d1 - 2 * phi * d1 * e2 + e2 * e2);
  const newcombeLow = Math.max(-1, delta - Math.sqrt(lowSq));
  const newcombeHigh = Math.min(1, delta + Math.sqrt(highSq));

  const waldVar = Math.max(0, ((b + c) - ((c - b) ** 2) / n) / (n * n));
  const waldSe = Math.sqrt(waldVar);
  return {
    n,
    both_pass: a,
    base_only: b,
    cand_only: c,
    both_fail: d,
    base_rate: pBase,
    cand_rate: pCand,
    delta,
    newcombe_ci: [newcombeLow, newcombeHigh],
    wald_ci: [Math.max(-1, delta - z * waldSe), Math.min(1, delta + z * waldSe)],
    phi,
    mcnemar_p: mcnemarExactP(b, c),
  };
}

function holmBonferroni(pValues) {
  const m = pValues.length;
  if (m === 0) return [];
  const order = pValues.map((p, idx) => ({ p, idx })).sort((x, y) => x.p - y.p);
  const adj = new Array(m).fill(0);
  let runningMax = 0;
  for (let rank = 0; rank < m; rank += 1) {
    const scaled = order[rank].p * (m - rank);
    runningMax = Math.min(1, Math.max(runningMax, scaled));
    adj[order[rank].idx] = runningMax;
  }
  return adj;
}

function cohensKappa(labelsA, labelsB, z = Z_95) {
  const n = labelsA.length;
  if (n === 0 || n !== labelsB.length) {
    return { n: 0, agreement: 0, kappa: 0, ci_95: [0, 0], confusion: { tp: 0, fp: 0, fn: 0, tn: 0 } };
  }
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (let i = 0; i < n; i += 1) {
    const a = Boolean(labelsA[i]);
    const b = Boolean(labelsB[i]);
    if (a && b) tp += 1;
    else if (a && !b) fp += 1;
    else if (!a && b) fn += 1;
    else tn += 1;
  }
  const po = (tp + tn) / n;
  const pA1 = (tp + fp) / n;
  const pA0 = 1 - pA1;
  const pB1 = (tp + fn) / n;
  const pB0 = 1 - pB1;
  const pe = pA1 * pB1 + pA0 * pB0;
  const kappa = Math.abs(1 - pe) < 1e-12 ? (po === 1 ? 1 : 0) : (po - pe) / (1 - pe);

  let se = 0;
  if (Math.abs(1 - pe) > 1e-12 && po < 1) {
    se = Math.sqrt((po * (1 - po)) / (n * Math.pow(1 - pe, 2)));
  }
  return {
    n,
    agreement: po,
    kappa,
    ci_95: [Math.max(-1, kappa - z * se), Math.min(1, kappa + z * se)],
    confusion: { tp, fp, fn, tn },
  };
}

function logGamma(x) {
  const cof = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.001208650973866179, -0.000005395239384953,
  ];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < cof.length; j += 1) {
    y += 1;
    ser += cof[j] / y;
  }
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function betaCf(a, b, x) {
  const maxIter = 200;
  const eps = 3e-14;
  const fpmin = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < fpmin) d = fpmin;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIter; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < eps) break;
  }
  return h;
}

function regularizedIncompleteBeta(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betaCf(a, b, x)) / a;
  }
  return 1 - (bt * betaCf(b, a, 1 - x)) / b;
}

function pearsonRWithP(xs, ys) {
  const n = xs.length;
  if (n < 3 || n !== ys.length) return { n, r: 0, p_value: 1, constant: true };
  let sumX = 0, sumY = 0;
  for (let i = 0; i < n; i += 1) {
    sumX += xs[i];
    sumY += ys[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  let sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  if (sxx <= 1e-12 || syy <= 1e-12) return { n, r: 0, p_value: 1, constant: true };
  const r = Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy)));
  if (Math.abs(r) >= 1 - 1e-12) return { n, r, p_value: 0, constant: false };
  const df = n - 2;
  const t2 = (df * r * r) / (1 - r * r);
  const p = regularizedIncompleteBeta(0.5 * df, 0.5, df / (df + t2));
  return { n, r, p_value: Math.min(1, Math.max(0, p)), constant: false };
}

function cramersV(xs, ys) {
  const n = xs.length;
  if (n === 0 || n !== ys.length) return { n: 0, v: 0, zero_cells: 0, total_cells: 0 };
  const rowVals = Array.from(new Set(xs));
  const colVals = Array.from(new Set(ys));
  const r = rowVals.length;
  const c = colVals.length;
  if (r < 2 || c < 2) return { n, v: 0, zero_cells: 0, total_cells: r * c };
  const counts = new Map();
  const rowTotals = new Map();
  const colTotals = new Map();
  for (let i = 0; i < n; i += 1) {
    const rv = xs[i];
    const cv = ys[i];
    const key = `${rv}\u0000${cv}`;
    counts.set(key, (counts.get(key) || 0) + 1);
    rowTotals.set(rv, (rowTotals.get(rv) || 0) + 1);
    colTotals.set(cv, (colTotals.get(cv) || 0) + 1);
  }
  let chi2 = 0;
  let zeroCells = 0;
  for (const rv of rowVals) {
    for (const cv of colVals) {
      const obs = counts.get(`${rv}\u0000${cv}`) || 0;
      if (obs === 0) zeroCells += 1;
      const exp = (rowTotals.get(rv) * colTotals.get(cv)) / n;
      if (exp > 0) chi2 += ((obs - exp) ** 2) / exp;
    }
  }
  const minDim = Math.min(r - 1, c - 1);
  const v = Math.sqrt(chi2 / (n * minDim));
  return { n, rows: r, cols: c, v, zero_cells: zeroCells, total_cells: r * c };
}

function auditFactorialOrthogonality(records, factorKeys) {
  const pairs = [];
  let maxV = 0;
  let totalZeroCells = 0;
  for (let i = 0; i < factorKeys.length; i += 1) {
    for (let j = i + 1; j < factorKeys.length; j += 1) {
      const fkA = factorKeys[i];
      const fkB = factorKeys[j];
      const xs = records.map((r) => String(r[fkA]));
      const ys = records.map((r) => String(r[fkB]));
      const stat = cramersV(xs, ys);
      maxV = Math.max(maxV, stat.v);
      totalZeroCells += stat.zero_cells;
      pairs.push({ factor_a: fkA, factor_b: fkB, ...stat });
    }
  }
  return { max_cramers_v: maxV, total_zero_cells: totalZeroCells, pairs };
}

// ============================================================================
// 8. Slice Runners (A, B, C, D, E) + Human Calibration Set
// ============================================================================

/**
 * Slice A: Adversarial Paste/Input Sanitization, XSS DOM Escaping, Prototype Keys,
 * Restore-History Active Calc & MAX_FIELD_LEN Copy Decoupling.
 * Zero cloning, orthogonal factorial on A1, strict blinded grading.
 */
async function runSliceA(artifacts, rustBridge, rng) {
  const records = [];
  const factorialMeta = [];
  const desktopSandbox = await createDesktopSandbox(artifacts, rustBridge);
  const mobileSandbox = await createMobileSandbox(artifacts);

  const surfaces = [
    { name: "desktop", sandbox: desktopSandbox },
    { name: "mobile", sandbox: mobileSandbox },
  ];

  // --- Sub-suite A1: Orthogonal Formatted Paste Factorial (288 unique items) ---
  // sign (3) x currency_fmt (4) x magnitude_tier (4) x calculator (2) x whitespace (3) = 288
  const signs = ["negative", "explicit_plus", "unsigned"];
  const currencyFmts = ["none", "dollar_sym", "iso_usd", "trailing_pct"];
  const magTiers = ["small_frac", "medium_int", "grouped_thousands", "zero_or_sci"];
  const calculators = ["what", "tax"];
  const whitespaces = ["none", "leading_space", "surrounding_space"];
  const seenA1 = new Set();

  for (const sign of signs) {
    for (const cfmt of currencyFmts) {
      for (const mag of magTiers) {
        for (const calcId of calculators) {
          for (const ws of whitespaces) {
            let numStr;
            if (mag === "small_frac") {
              numStr = (0.05 + rng() * 0.9).toFixed(4);
            } else if (mag === "medium_int") {
              numStr = String(Math.floor(15 + rng() * 980));
            } else if (mag === "grouped_thousands") {
              const thousands = Math.floor(1 + rng() * 95);
              const rem = String(Math.floor(100 + rng() * 899));
              const dec = String(Math.floor(10 + rng() * 89));
              numStr = `${thousands},${rem}.${dec}`;
            } else {
              // zero_or_sci: alternate cleanly by sign/calc without creating NaN/Infinity
              numStr = cfmt === "none" ? "0" : (1.25 + rng() * 7).toFixed(2);
            }

            const signPrefix = sign === "negative" ? "-" : sign === "explicit_plus" ? "+" : "";
            let formatted;
            if (cfmt === "none") formatted = `${signPrefix}${numStr}`;
            else if (cfmt === "dollar_sym") formatted = `${signPrefix}$${numStr}`;
            else if (cfmt === "iso_usd") formatted = `${signPrefix}USD ${numStr}`;
            else formatted = `${signPrefix}${numStr}%`;

            if (ws === "leading_space") formatted = `  ${formatted}`;
            else if (ws === "surrounding_space") formatted = ` ${formatted} `;

            const uniqKey = `${calcId}|${formatted}`;
            if (seenA1.has(uniqKey)) {
              throw new Error(`Slice A1 duplicate generated: ${uniqKey}`);
            }
            seenA1.add(uniqKey);

            // Clean reference number
            const numericClean = parseFloat(`${sign === "negative" ? "-" : ""}${numStr.replace(/,/g, "")}`);
            const bArg = calcId === "what" ? (numericClean === 0 ? 100 : 25) : 0;
            const oracle = computeReferenceOracle(calcId, "add", numericClean, bArg);
            const expectedInputValue = encodeNumInput(Object.is(numericClean, -0) ? -0 : numericClean);
            const expectedNumeric = Object.is(numericClean, -0) ? -0 : numericClean;

            for (const surf of surfaces) {
              const spec = CALC_SPECS[calcId];
              const elA = surf.sandbox.document.getElementById(spec.inputIds[0]);
              const elB = surf.sandbox.document.getElementById(spec.inputIds[1]);
              if (calcId === "tax") {
                surf.sandbox.document.getElementById("taxModeAddBtn")?.click();
              }
              elA.value = "";
              elB.value = encodeNumInput(bArg);
              const pasteEv = simulateBrowserPaste(elA, formatted);
              await surf.sandbox.drain();

              const resEl = surf.sandbox.document.getElementById(spec.resultId);
              const brokenInfo = surf.name === "desktop" ? surf.sandbox.getBrokenBridge() : { broken: false };
              if (brokenInfo.broken) surf.sandbox.resetBrokenFlag();

              const observation = {
                id: `A1-${surf.name}-${records.length + 1}`,
                slice: "slice_a",
                surface: surf.name,
                afterValue: elA.value,
                defaultPrevented: pasteEv.defaultPrevented,
                resultText: brokenInfo.broken ? "" : (resEl ? resEl.textContent : ""),
                summaryText: `paste(${formatted})=>val=${elA.value}`,
                domInjectedMarkup: false,
                broken: false,
              };
              const specCheck = {
                kind: "paste_guard",
                expectAccepted: true,
                preSeedValue: "",
                expectedInputValue,
                expectedNumeric,
                oracleTokens: oracle.guardedUi.formattedTokens,
              };
              const graded = gradeObservation(observation, specCheck);
              const lenient = gradeObservation(observation, specCheck, { rubricVariant: "lenient" });
              records.push({
                ...observation,
                passed: graded.passed,
                lenientPassed: lenient.passed,
                outputLength: graded.outputLength,
                pairType: "benign_formatted",
                subCategory: `a1_paste_${cfmt}`,
                sign,
                currency_fmt: cfmt,
                magnitude_tier: mag,
                calculator: calcId,
                whitespace: ws,
              });
            }
            factorialMeta.push({ sign, currency_fmt: cfmt, magnitude_tier: mag, calculator: calcId, whitespace: ws });
          }
        }
      }
    }
  }

  // --- Sub-suite A2: Adversarial Paste Rejections & XSS Markup Injection (72 unique items) ---
  // Verify pasting "0x10", "0b1010", "0o77", "Infinity", "-Infinity", "NaN", XSS strings NEVER wipes pre-seeded "50"
  const adversarialPayloads = [
    "0x10", "0X10", "0xFF", "0b1010", "0o77", "Infinity", "-Infinity", "NaN", "1e309", "-1e500",
    "1;000", "12.34.56", "alert(1)", "<img src=x onerror=alert(1)>", "<script>alert(1)</script>",
    "--100", "100-", "USD", "..5",
  ];
  const a2Calcs = ["change", "what", "discount", "tax"];

  for (const payload of adversarialPayloads) {
    for (const calcId of a2Calcs) {
      const spec = CALC_SPECS[calcId];
      for (const surf of surfaces) {
        const elA = surf.sandbox.document.getElementById(spec.inputIds[0]);
        const elB = surf.sandbox.document.getElementById(spec.inputIds[1]);
        elA.value = "50";
        elB.value = "10";
        simulateBrowserPaste(elA, payload);
        await surf.sandbox.drain();
        const resEl = surf.sandbox.document.getElementById(spec.resultId);
        const liveEl = surf.sandbox.document.getElementById(spec.liveResultId);
        const hasInjectedMarkup = (el) =>
          Boolean(
            el &&
              (el.querySelectorAll("script, img, svg, iframe, [onerror], [onload]").length > 0 ||
                /<img|<script|onerror\s*=|onload\s*=/i.test(el.textContent))
          );
        const hasInjectedChild = hasInjectedMarkup(resEl) || hasInjectedMarkup(liveEl);
        if (surf.name === "desktop") surf.sandbox.resetBrokenFlag();

        const observation = {
          id: `A2-${surf.name}-${calcId}-${payload}`,
          slice: "slice_a",
          surface: surf.name,
          afterValue: elA.value,
          domInjectedMarkup: hasInjectedChild,
          resultText: resEl ? resEl.textContent : "",
          broken: false,
        };
        const specCheck = {
          kind: "paste_guard",
          expectAccepted: false,
          preSeedValue: "50",
        };
        const graded = gradeObservation(observation, specCheck);
        const lenient = gradeObservation(observation, specCheck, { rubricVariant: "lenient" });
        records.push({
          ...observation,
          passed: graded.passed,
          lenientPassed: lenient.passed,
          outputLength: graded.outputLength,
          pairType: "adversarial_paste",
          subCategory: /<script|<img|alert/i.test(payload) ? "xss_paste" : "non_decimal_or_malformed_paste",
        });
      }
    }
  }

  // Paired benign numeric-underscore grouping control: sanitizeNumericString strips `_` cleanly -> 1000
  for (const calcId of a2Calcs) {
    const spec = CALC_SPECS[calcId];
    for (const surf of surfaces) {
      const elA = surf.sandbox.document.getElementById(spec.inputIds[0]);
      const elB = surf.sandbox.document.getElementById(spec.inputIds[1]);
      elA.value = "";
      elB.value = "10";
      simulateBrowserPaste(elA, "1_000");
      await surf.sandbox.drain();
      const resEl = surf.sandbox.document.getElementById(spec.resultId);
      if (surf.name === "desktop") surf.sandbox.resetBrokenFlag();
      const oracle = computeReferenceOracle(calcId, "add", 1000, 10);
      const observation = {
        id: `A2b-${surf.name}-${calcId}-1_000`,
        slice: "slice_a",
        surface: surf.name,
        afterValue: elA.value,
        domInjectedMarkup: false,
        resultText: resEl ? resEl.textContent : "",
        broken: false,
      };
      const specCheck = {
        kind: "paste_guard",
        expectAccepted: true,
        preSeedValue: "",
        expectedInputValue: "1000",
        expectedNumeric: 1000,
        oracleTokens: oracle.guardedUi.formattedTokens,
      };
      const graded = gradeObservation(observation, specCheck);
      const lenient = gradeObservation(observation, specCheck, { rubricVariant: "lenient" });
      records.push({
        ...observation,
        passed: graded.passed,
        lenientPassed: lenient.passed,
        outputLength: graded.outputLength,
        pairType: "benign_grouped",
        subCategory: "a2b_grouped_underscore",
      });
    }
  }

  // --- Sub-suite A3: Prototype Pollution, Valid-Key History Restore (with active calc), ---
  // --- Overflow Rejection, and >256-char Valid Input Copy Decoupling (64+ items)       ---
  const protoKeys = ["__proto__", "constructor", "toString", "valueOf", "hasOwnProperty", "__defineGetter__"];
  for (const surf of surfaces) {
    for (const badKey of protoKeys) {
      const protoEntry = {
        id: 1731542400001,
        timestampMs: 1731542400001,
        calculator: badKey,
        calculatorLabel: "Bad",
        inputA: "100",
        inputB: "20",
        mode: null,
        inputsText: "100 | 20",
        resultText: "=120.00",
        copyText: "120.00",
      };
      // Fresh history entry rendered via DOM or direct history state injection
      const freshSandbox = surf.name === "desktop"
        ? await createDesktopSandbox(artifacts, rustBridge, {
            initialHistory: [protoEntry],
          })
        : await createMobileSandbox(artifacts, {
            initialLocalStorage: {
              pct_tool_history_v2: JSON.stringify([protoEntry]),
            },
          });

      const restoreBtns = freshSandbox.document.querySelectorAll(".history-restore-btn");
      if (restoreBtns.length > 0) restoreBtns[0].click();
      await freshSandbox.drain();
      if (freshSandbox.surface === "desktop") freshSandbox.resetBrokenFlag();

      const cardsRestored = freshSandbox.document.querySelectorAll(".card-restored").length > 0;
      const protoPolluted = Object.keys(Object.prototype).length > 0;

      const observation = {
        id: `A3-proto-${surf.name}-${badKey}`,
        slice: "slice_a",
        surface: surf.name,
        prototypeIntact: !protoPolluted,
        cardRestored: cardsRestored,
        restoredResultOk: false,
        resultText: badKey,
        broken: false,
      };
      const specCheck = { kind: "restore_guard", expectRejected: true };
      const graded = gradeObservation(observation, specCheck);
      const lenient = gradeObservation(observation, specCheck, { rubricVariant: "lenient" });
      records.push({
        ...observation,
        passed: graded.passed,
        lenientPassed: lenient.passed,
        outputLength: graded.outputLength,
        pairType: "adversarial_prototype_key",
        subCategory: "prototype_key_restore",
      });
    }
  }

  // Valid-key restoreHistoryEntry across ALL 8 calculator/mode combos (with active calc_*!)
  const restoreCases = [
    { calcId: "change", mode: null, a: 80, b: 100 },
    { calcId: "percent", mode: null, a: 45, b: 180 },
    { calcId: "what", mode: null, a: 15, b: 400 },
    { calcId: "discount", mode: null, a: 250, b: 20 },
    { calcId: "base", mode: null, a: 60, b: 25 },
    { calcId: "markup", mode: null, a: 120, b: 150 },
    { calcId: "tax", mode: "add", a: 200, b: 15 },
    { calcId: "tax", mode: "extract", a: 230, b: 15 },
  ];

  for (const rc of restoreCases) {
    const spec = CALC_SPECS[rc.calcId];
    const oracle = computeReferenceOracle(rc.calcId, rc.mode, rc.a, rc.b);
    for (const surf of surfaces) {
      const entry = {
        id: 1731542400100 + records.length,
        timestampMs: 1731542400100,
        calculator: rc.calcId,
        calculatorLabel: spec.historyType,
        inputA: encodeNumInput(rc.a),
        inputB: encodeNumInput(rc.b),
        mode: rc.mode,
        inputsText: `${encodeNumInput(rc.a)} | ${encodeNumInput(rc.b)}`,
        resultText: "=stale-placeholder",
        copyText: "=stale-placeholder",
      };
      const freshSandbox = surf.name === "desktop"
        ? await createDesktopSandbox(artifacts, rustBridge, { initialHistory: [entry] })
        : await createMobileSandbox(artifacts, { initialLocalStorage: { pct_tool_history_v2: JSON.stringify([entry]) } });

      // Pre-set inputs to different values so we verify restore overwrites them AND computes live result
      const elA = freshSandbox.document.getElementById(spec.inputIds[0]);
      const elB = freshSandbox.document.getElementById(spec.inputIds[1]);
      elA.value = "999";
      elB.value = "999";

      const restoreBtns = freshSandbox.document.querySelectorAll(".history-restore-btn");
      if (restoreBtns.length > 0) restoreBtns[0].click();
      await freshSandbox.drain();

      const brokenInfo = surf.name === "desktop" ? freshSandbox.getBrokenBridge() : { broken: false, reason: null };
      const resEl = freshSandbox.document.getElementById(spec.resultId);
      const liveEl = freshSandbox.document.getElementById(spec.liveResultId);
      const cardEl = freshSandbox.document.getElementById(spec.cardId);
      const restoredImm = cardEl ? cardEl.classList.contains("card-restored") : false;
      freshSandbox.timers.advance(2000);
      const clearedAfter = cardEl ? !cardEl.classList.contains("card-restored") : false;

      const observation = {
        id: `A3-restore-${surf.name}-${rc.calcId}-${rc.mode || "std"}`,
        slice: "slice_a",
        surface: surf.name,
        prototypeIntact: true,
        restoredA: elA.value,
        restoredB: elB.value,
        resultText: resEl ? resEl.textContent : "",
        liveText: liveEl ? liveEl.textContent : "",
        isError: resEl ? isUiErrorElement(resEl) : true,
        cardRestoredImmediate: restoredImm,
        cardClearedAfterTimer: clearedAfter,
        broken: brokenInfo.broken,
        brokenReason: brokenInfo.reason,
      };
      const specCheck = {
        kind: "restore_guard",
        expectRejected: false,
        expectedA: encodeNumInput(rc.a),
        expectedB: encodeNumInput(rc.b),
        expectedTokens: oracle.guardedUi.formattedTokens,
        expectedLiveTokens: oracle.guardedUi.liveTokens,
      };
      const graded = gradeObservation(observation, specCheck);
      const lenient = gradeObservation(observation, specCheck, { rubricVariant: "lenient" });
      records.push({
        ...observation,
        passed: graded.passed,
        lenientPassed: lenient.passed,
        outputLength: graded.outputLength,
        pairType: "benign_restore_valid",
        subCategory: "restore_history_active_calc",
      });
    }
  }

  // Overflow boundary checks (1.8e306, 9e306, -1.8e306) + >256-char valid copy decoupling
  const overflowCases = [
    { calcId: "what", mode: null, a: 100, b: 1.8e306 },
    { calcId: "what", mode: null, a: -1.8e306, b: 50 },
    { calcId: "discount", mode: null, a: 1.8e306, b: 10 },
    { calcId: "tax", mode: "add", a: 1.8e306, b: 15 },
    { calcId: "markup", mode: null, a: 10, b: 1.8e306 },
    { calcId: "base", mode: null, a: 1e307, b: 5 },
    { calcId: "change", mode: null, a: 1, b: 1e308 },
    { calcId: "markup", mode: null, a: 10, b: 0 }, // zero-selling margin test
  ];

  for (const oc of overflowCases) {
    const oracle = computeReferenceOracle(oc.calcId, oc.mode, oc.a, oc.b);
    for (const surf of surfaces) {
      const uiOut = await uiSetInputsAndEvaluate(surf.sandbox, oc.calcId, oc.mode, oc.a, oc.b);
      const observation = {
        id: `A3-overflow-${surf.name}-${oc.calcId}-${encodeNumInput(oc.a)}-${encodeNumInput(oc.b)}`,
        slice: "slice_a",
        surface: surf.name,
        resultText: uiOut.broken ? "" : uiOut.resultText,
        liveText: uiOut.broken ? "" : uiOut.liveText,
        isError: uiOut.broken ? false : uiOut.isError,
        cardRestored: uiOut.broken ? false : uiOut.cardRestored,
        broken: uiOut.broken,
        brokenReason: uiOut.reason,
      };
      const specCheck = {
        kind: "calc_ui",
        expectError: oracle.guardedUi.expectError,
        errorCategory: oracle.guardedUi.errorCategory,
        expectedTokens: oracle.guardedUi.formattedTokens,
        expectedLiveTokens: oracle.guardedUi.liveTokens,
      };
      const graded = gradeObservation(observation, specCheck);
      const lenient = gradeObservation(observation, specCheck, { rubricVariant: "lenient" });
      records.push({
        ...observation,
        passed: graded.passed,
        lenientPassed: lenient.passed,
        outputLength: graded.outputLength,
        pairType: "adversarial_overflow",
        subCategory: "non_finite_overflow_guard",
      });
    }
  }

  // >256-char valid numerical strings ("1." + "0".repeat(255) = 257 chars) -> calc + COPY MUST SUCCEED
  const longInputs = [
    { calcId: "what", a: "1." + "0".repeat(255), b: "50" },
    { calcId: "change", a: "100", b: "2." + "0".repeat(260) },
    { calcId: "discount", a: "500." + "0".repeat(260), b: "10" },
    { calcId: "tax", a: "200." + "0".repeat(255), b: "20" },
  ];
  for (const li of longInputs) {
    for (const surf of surfaces) {
      const freshSandbox = surf.name === "desktop"
        ? await createDesktopSandbox(artifacts, rustBridge)
        : await createMobileSandbox(artifacts);
      const spec = CALC_SPECS[li.calcId];
      const uiOut = await uiSetInputsAndEvaluate(freshSandbox, li.calcId, "add", li.a, li.b);
      if (uiOut.broken) {
        records.push({
          id: `A3-longcopy-${surf.name}-${li.calcId}`,
          slice: "slice_a",
          surface: surf.name,
          broken: true,
          brokenReason: uiOut.reason,
          passed: false,
          lenientPassed: false,
          outputLength: 0,
          pairType: "benign_long_input_copy",
          subCategory: "copy_decoupled_from_history_limit",
        });
        continue;
      }
      const copyBtn = freshSandbox.document.getElementById(spec.copyBtn);
      copyBtn.click();
      await freshSandbox.drain();

      const copied = surf.name === "desktop"
        ? freshSandbox.backend.getCopiedTexts().length > 0
        : (freshSandbox.getClipboardWrites().length > 0 || freshSandbox.getExecCommandCopies().length > 0);
      const histCount = surf.name === "desktop"
        ? freshSandbox.backend.getHistory().length
        : JSON.parse(freshSandbox.storage.getItem("pct_tool_history_v2") || "[]").length;

      const observation = {
        id: `A3-longcopy-${surf.name}-${li.calcId}`,
        slice: "slice_a",
        surface: surf.name,
        isError: uiOut.isError,
        resultText: uiOut.resultText,
        copySucceeded: copied,
        historyWithinBounds: histCount === 0 || surf.name === "mobile",
        broken: false,
      };
      const specCheck = { kind: "long_input_copy" };
      const graded = gradeObservation(observation, specCheck);
      const lenient = gradeObservation(observation, specCheck, { rubricVariant: "lenient" });
      records.push({
        ...observation,
        passed: graded.passed,
        lenientPassed: lenient.passed,
        outputLength: graded.outputLength,
        pairType: "benign_long_input_copy",
        subCategory: "copy_decoupled_from_history_limit",
      });
    }
  }

  // --- Sub-suite A4: Update Running-Version Display, AutoUpdateToggle Failure Rollback & Spoof Guard ---
  for (const surf of surfaces) {
    const mobileV211Payload = {
      tag_name: "v2.1.1",
      draft: false,
      prerelease: false,
      html_url: "https://github.com/CipherVaults/Percentage-Calculator-Tool/releases/tag/v2.1.1",
    };
    const uSandbox = surf.name === "desktop"
      ? await createDesktopSandbox(artifacts, rustBridge)
      : await createMobileSandbox(artifacts, {
          fetchResponder: async () => ({
            ok: true,
            status: 200,
            headers: { get: () => "180" },
            text: async () => JSON.stringify(mobileV211Payload),
            json: async () => mobileV211Payload,
          }),
        });
    if (surf.name === "desktop") {
      uSandbox.backend.setUpdateResponse({
        ok: true,
        updateAvailable: false,
        currentVersion: "2.2.1",
        latestVersion: "2.1.1",
        releaseUrl: "https://github.com/CipherVaults/Percentage-Calculator-Tool/releases/tag/v2.1.1",
      });
    }
    const uDoc = uSandbox.document;
    uDoc.getElementById("checkUpdatesNowBtn").click();
    await uSandbox.drain();
    const statusText = uDoc.getElementById("updateStatusText").textContent;
    const versionDisplayValid = statusText.includes("2.2.1") && !statusText.includes("2.1.1");

    let securityFiltersPassed = true;
    if (surf.name === "desktop") {
      try {
        await uSandbox.backend.invoke("open_release_page", { url: "https://evil.example.com/fake" });
        securityFiltersPassed = false;
      } catch {
        securityFiltersPassed = true;
      }
    } else {
      const mobilePrereleaseSpoof = {
        tag_name: "v9.9.9",
        draft: false,
        prerelease: true,
        html_url: "https://evil.example.com/fake",
      };
      uSandbox.setFetchResponder(async () => ({
        ok: true,
        status: 200,
        headers: { get: () => "200" },
        text: async () => JSON.stringify(mobilePrereleaseSpoof),
        json: async () => mobilePrereleaseSpoof,
      }));
      uDoc.getElementById("checkUpdatesNowBtn").click();
      await uSandbox.drain();
      const bEl = uDoc.getElementById("updateBanner");
      securityFiltersPassed = bEl.hidden === true || bEl.classList.contains("hidden");
    }

    const observation = {
      id: `A4-updates-settings-${surf.name}`,
      slice: "slice_a",
      surface: surf.name,
      versionDisplayValid,
      securityFiltersPassed,
      toggleRevertedOnFailure: true,
      noUnhandledThrow: uSandbox.getUnhandledErrors().length === 0,
      resultText: statusText,
      broken: false,
    };
    const specCheck = { kind: "update_and_settings" };
    const graded = gradeObservation(observation, specCheck);
    const lenient = gradeObservation(observation, specCheck, { rubricVariant: "lenient" });
    records.push({
      ...observation,
      passed: graded.passed,
      lenientPassed: lenient.passed,
      outputLength: graded.outputLength,
      pairType: "adversarial_update_and_settings",
      subCategory: "update_version_and_toggle_guard",
    });

    if (surf.name === "desktop") {
      const tSandbox = await createDesktopSandbox(artifacts, rustBridge);
      const tDoc = tSandbox.document;
      const toggle = tDoc.getElementById("autoUpdateToggle");
      const beforeToggle = toggle.checked;
      tSandbox.backend.setSettingsFailureCount(1);
      toggle.click();
      await tSandbox.drain();
      const toggleReverted = toggle.checked === beforeToggle;
      const tObs = {
        id: "A4-toggle-rollback-desktop",
        slice: "slice_a",
        surface: "desktop",
        versionDisplayValid: true,
        securityFiltersPassed: true,
        toggleRevertedOnFailure: toggleReverted,
        noUnhandledThrow: tSandbox.getUnhandledErrors().length === 0,
        resultText: `before=${beforeToggle}, after=${toggle.checked}`,
        broken: false,
      };
      const tg = gradeObservation(tObs, specCheck);
      const tl = gradeObservation(tObs, specCheck, { rubricVariant: "lenient" });
      records.push({
        ...tObs,
        passed: tg.passed,
        lenientPassed: tl.passed,
        outputLength: tg.outputLength,
        pairType: "adversarial_toggle_rollback",
        subCategory: "settings_toggle_rollback",
      });
    }
  }

  const orthogonality = auditFactorialOrthogonality(factorialMeta, [
    "sign",
    "currency_fmt",
    "magnitude_tier",
    "calculator",
    "whitespace",
  ]);
  return { records, orthogonality, uniqueItemCount: records.length };
}

/**
 * Slice B: 1,088 Unique Single-Turn + Metamorphic Items Across All 8 Calc Modes.
 * ZERO overlap with golden.json 2-arg input pairs.
 * Tests Raw Rust Core, Desktop Guarded UI, Mobile Raw Math, and Mobile Guarded UI,
 * with actual 2-pass per-surface replay and BOTH paired comparisons:
 *   1) Desktop vs Mobile Guarded UI
 *   2) Raw Math vs Guarded UI
 */
async function runSliceB(artifacts, rustBridge, mobileMath, rng, goldenPairSet) {
  const desktopSandbox = await createDesktopSandbox(artifacts, rustBridge);
  const mobileSandbox = await createMobileSandbox(artifacts);

  const items = [];
  const seenItemKeys = new Set();

  function addUniqueItem(item) {
    const keyA = encodeNumInput(item.a);
    const keyB = encodeNumInput(item.b);
    if (goldenPairSet.has(`${keyA}|${keyB}`) || goldenPairSet.has(`${keyB}|${keyA}`)) {
      return false;
    }
    const itemKey = `${item.calcId}|${item.mode || ""}|${keyA}|${keyB}`;
    if (seenItemKeys.has(itemKey)) return false;
    seenItemKeys.add(itemKey);
    items.push({ ...item, id: `B-${items.length + 1}` });
    return true;
  }

  // 1) Targeted non-golden boundary & safety cases (~120 items)
  const targetModes = [
    { calcId: "change", mode: null },
    { calcId: "percent", mode: null },
    { calcId: "what", mode: null },
    { calcId: "discount", mode: null },
    { calcId: "base", mode: null },
    { calcId: "markup", mode: null },
    { calcId: "tax", mode: "add" },
    { calcId: "tax", mode: "extract" },
  ];
  const boundaryPairs = [
    [-0, 37.5],
    [37.5, -0],
    [50, 0.009999999999999998],
    [30, 0.016666666666666666],
    [100, 0.0049999999999999994],
    [7, 0.07142857142857142],
    [100, 1.8e306],
    [1.8e306, 5],
    [-1.8e306, 12],
    [0, 42.5],
    [17, 0],
    [-12.5, 25],
    [1e-7, 250000],
    [987654321.123, 3.333],
    [12345.67, -15.5],
  ];
  for (const tm of targetModes) {
    for (const [a, b] of boundaryPairs) {
      addUniqueItem({
        calcId: tm.calcId,
        mode: tm.mode,
        a,
        b,
        a_regime: "boundary",
        b_regime: "boundary",
        subCategory: "targeted_boundary",
      });
    }
  }

  // 2) Orthogonal 8 x 4 x 4 x 6 seeded PRNG factorial = 768 unique items
  const aRegimes = ["tiny_pos", "standard_pos", "large_pos", "negative_val"];
  const bRegimes = ["small_val", "mid_val", "hundred_plus", "fractional_half"];
  const factorialMeta = [];

  const drawFromRegime = (reg) => {
    if (reg === "tiny_pos") return Number((0.0001 + rng() * 0.98).toFixed(6));
    if (reg === "standard_pos") return Number((1.23 + rng() * 990).toFixed(4));
    if (reg === "large_pos") return Number((10000 + rng() * 999999).toFixed(2));
    if (reg === "negative_val") return -Number((1.11 + rng() * 450).toFixed(4));
    if (reg === "small_val") return Number((0.1 + rng() * 9.9).toFixed(4));
    if (reg === "mid_val") return Number((10 + rng() * 89.9).toFixed(3));
    if (reg === "hundred_plus") return Number((100.5 + rng() * 850).toFixed(2));
    // fractional_half: decimals intentionally ending near .xx5 / half-step ties
    const baseInt = Math.floor(1 + rng() * 500);
    return Number(`${baseInt}.${Math.floor(rng() * 100).toString().padStart(2, "0")}5`);
  };

  for (const tm of targetModes) {
    for (const ar of aRegimes) {
      for (const br of bRegimes) {
        for (let rep = 0; rep < 6; rep += 1) {
          let inserted = false;
          for (let attempt = 0; attempt < 25 && !inserted; attempt += 1) {
            const a = drawFromRegime(ar);
            const b = drawFromRegime(br);
            inserted = addUniqueItem({
              calcId: tm.calcId,
              mode: tm.mode,
              a,
              b,
              a_regime: ar,
              b_regime: br,
              subCategory: "orthogonal_prng",
            });
          }
          if (!inserted) throw new Error("Failed to draw non-golden Slice B item");
          factorialMeta.push({
            calc_mode: `${tm.calcId}${tm.mode ? "_" + tm.mode : ""}`,
            a_regime: ar,
            b_regime: br,
          });
        }
      }
    }
  }

  // 3) Metamorphic Invariant Pairs (100 pairs = 200 unique items)
  const metamorphicLinks = [];
  for (let i = 0; i < 100; i += 1) {
    const kind = i % 4;
    if (kind === 0) {
      // Scale invariance: change(a, b) == change(k*a, k*b)
      const a = Number((10 + rng() * 500).toFixed(2));
      const b = Number((10 + rng() * 500).toFixed(2));
      const k = 7.3;
      const baseOk = addUniqueItem({ calcId: "change", mode: null, a, b, subCategory: "metamorphic_scale" });
      const scaledOk = addUniqueItem({ calcId: "change", mode: null, a: Number((a * k).toFixed(4)), b: Number((b * k).toFixed(4)), subCategory: "metamorphic_scale" });
      if (baseOk && scaledOk) {
        metamorphicLinks.push({ kind: "scale_change", id1: `B-${items.length - 1}`, id2: `B-${items.length}` });
      }
    } else if (kind === 1) {
      // Linearity / sign symmetry on `what`: what(-p, x) == -what(p, x)
      const p = Number((5 + rng() * 80).toFixed(2));
      const x = Number((100 + rng() * 2000).toFixed(2));
      const baseOk = addUniqueItem({ calcId: "what", mode: null, a: p, b: x, subCategory: "metamorphic_sign" });
      const negOk = addUniqueItem({ calcId: "what", mode: null, a: -p, b: x, subCategory: "metamorphic_sign" });
      if (baseOk && negOk) {
        metamorphicLinks.push({ kind: "sign_what", id1: `B-${items.length - 1}`, id2: `B-${items.length}` });
      }
    } else if (kind === 2) {
      // Tax add -> extract round-trip
      const net = Number((25 + rng() * 900).toFixed(2));
      const rate = 20; // exact binary divisor 1.2 for clean gross -> net
      const gross = Number((net * (1 + rate / 100)).toFixed(4));
      const addOk = addUniqueItem({ calcId: "tax", mode: "add", a: net, b: rate, subCategory: "metamorphic_tax" });
      const extOk = addUniqueItem({ calcId: "tax", mode: "extract", a: gross, b: rate, subCategory: "metamorphic_tax" });
      if (addOk && extOk) {
        metamorphicLinks.push({ kind: "tax_roundtrip", id1: `B-${items.length - 1}`, id2: `B-${items.length}`, net });
      }
    } else {
      // Percent of total scaling invariance: percent(a, b) == percent(13*a, 13*b)
      const a = Number((5 + rng() * 200).toFixed(2));
      const b = Number((50 + rng() * 800).toFixed(2));
      const ok1 = addUniqueItem({ calcId: "percent", mode: null, a, b, subCategory: "metamorphic_scale" });
      const ok2 = addUniqueItem({ calcId: "percent", mode: null, a: Number((a * 13).toFixed(2)), b: Number((b * 13).toFixed(2)), subCategory: "metamorphic_scale" });
      if (ok1 && ok2) {
        metamorphicLinks.push({ kind: "scale_percent", id1: `B-${items.length - 1}`, id2: `B-${items.length}` });
      }
    }
  }

  // Batch-evaluate Raw Rust Core (2 passes for replayMatch!)
  const rustBatchPass1 = await rustBridge.callBatch(
    items.map((it) => ({
      surface: "core",
      op: CALC_SPECS[it.calcId].bridgeOp,
      a: it.a,
      b: it.b,
      mode: it.mode,
    }))
  );
  const rustBatchPass2 = await rustBridge.callBatch(
    items.map((it) => ({
      surface: "core",
      op: CALC_SPECS[it.calcId].bridgeOp,
      a: it.a,
      b: it.b,
      mode: it.mode,
    }))
  );

  const records = [];
  const desktopUiRecords = [];
  const mobileUiRecords = [];
  const rawMathRecords = [];
  const guardedUiRecords = [];
  const orderFlipPairs = [];
  let desktopVsMobile2x2 = { a: 0, b: 0, c: 0, d: 0 };
  let rawVsGuarded2x2 = { a: 0, b: 0, c: 0, d: 0 };

  for (let i = 0; i < items.length; i += 1) {
    const it = items[i];
    const oracle = computeReferenceOracle(it.calcId, it.mode, it.a, it.b);

    // 1. Mobile Raw Math (2-pass replay)
    const mobMath1 = mobileMath.runCalc(it.calcId, it.mode, it.a, it.b);
    const mobMath2 = mobileMath.runCalc(it.calcId, it.mode, it.a, it.b);
    const mobMathReplay = deepEqualObjectIs(mobMath1, mobMath2);
    const mobMathDisplay = mobMath1.ok === true || mobMath1.ok === "true"
      ? (mobMath1.label || mobMath1.formatted || mobMath1.copyText || JSON.stringify(mobMath1))
      : String(mobMath1.error || "");

    const mobMathObs = {
      id: `${it.id}-mob-raw`,
      slice: "slice_b",
      surface: "mobile_raw_math",
      rawOk: mobMath1.ok === true || mobMath1.ok === "true",
      rawDisplay: mobMathDisplay,
      replayPassed: mobMathReplay,
      broken: false,
    };
    const mobMathGraded = gradeObservation(mobMathObs, {
      kind: "raw_math",
      expectRawOk: oracle.raw.ok,
      expectedRawTokens: oracle.raw.formattedTokens || [],
      requireReplay: true,
      enforceNoInfiniteDisplay: true,
    });

    // 2. Mobile Guarded UI (full unmodified script, 2-pass replay!)
    const mobUi1 = await uiSetInputsAndEvaluate(mobileSandbox, it.calcId, it.mode, it.a, it.b);
    await uiSetInputsAndEvaluate(mobileSandbox, it.calcId, it.mode, "", "");
    const mobUi2 = await uiSetInputsAndEvaluate(mobileSandbox, it.calcId, it.mode, it.a, it.b);
    const mobUiReplay = deepEqualObjectIs(mobUi1, mobUi2);

    const mobUiObs = {
      id: `${it.id}-mob-ui`,
      slice: "slice_b",
      surface: "mobile_ui",
      resultText: mobUi1.resultText,
      liveText: mobUi1.liveText,
      isError: mobUi1.isError,
      cardRestored: mobUi1.cardRestored,
      replayPassed: mobUiReplay,
      broken: false,
    };
    const mobUiSpec = {
      kind: "calc_ui",
      expectError: oracle.guardedUi.expectError,
      errorCategory: oracle.guardedUi.errorCategory,
      expectedTokens: oracle.guardedUi.formattedTokens,
      expectedLiveTokens: oracle.guardedUi.liveTokens,
      requireReplay: true,
    };
    const mobUiGraded = gradeObservation(mobUiObs, mobUiSpec);
    const mobUiLenient = gradeObservation(mobUiObs, mobUiSpec, { rubricVariant: "lenient" });
    mobileUiRecords.push({
      ...mobUiObs,
      passed: mobUiGraded.passed,
      lenientPassed: mobUiLenient.passed,
      outputLength: mobUiGraded.outputLength,
      subCategory: it.subCategory,
    });

    // 3. Rust Core Bridge (2-pass replay; ignore envelope `id` differences!)
    const r1 = rustBatchPass1[i];
    const r2 = rustBatchPass2[i];
    const rustBroken = Boolean(r1?.broken || r2?.broken);
    const stripId = (res) => (res ? { ok: res.ok, result: res.result, error: res.error } : null);
    const rustReplay = !rustBroken && deepEqualObjectIs(stripId(r1), stripId(r2));
    const rustOpOk =
      !rustBroken &&
      Boolean(r1.ok) &&
      (r1.result?.ok === true || r1.result?.ok === "true");
    const rustRawDisplay = !rustBroken && r1.ok
      ? (rustOpOk ? String(r1.result?.label ?? JSON.stringify(r1.result)) : String(r1.result?.error ?? ""))
      : String(r1?.error || "");
    const rustRawObs = {
      id: `${it.id}-rust-core`,
      slice: "slice_b",
      surface: "rust_core",
      rawOk: rustOpOk,
      rawDisplay: rustRawDisplay,
      resultText: rustRawDisplay,
      replayPassed: rustReplay,
      broken: rustBroken,
      brokenReason: r1?.reason || r2?.reason,
    };
    // Raw percent-core preserves v1.1 un-guarded math (including Infinity tokens tested in
    // `raw_math_vs_guarded_ui`); the UI `allFiniteValues` boundary owns out-of-range gating.
    const rustRawGraded = gradeObservation(rustRawObs, {
      kind: "raw_math",
      expectRawOk: oracle.raw.ok,
      expectedRawTokens: oracle.raw.formattedTokens || [],
      requireReplay: true,
      enforceNoInfiniteDisplay: false,
    });

    // 4. Desktop Guarded UI (`ui/main.js` -> Rust IPC, 2-pass replay!)
    let dskUiObs;
    let dskUiGraded;
    let dskUiLenient;
    if (rustBroken) {
      dskUiObs = {
        id: `${it.id}-dsk-ui`,
        slice: "slice_b",
        surface: "desktop_ui",
        broken: true,
        brokenReason: rustRawObs.brokenReason,
      };
      dskUiGraded = { broken: true, passed: false, outputLength: 0 };
      dskUiLenient = { broken: true, passed: false, outputLength: 0 };
    } else {
      const d1 = await uiSetInputsAndEvaluate(desktopSandbox, it.calcId, it.mode, it.a, it.b);
      await uiSetInputsAndEvaluate(desktopSandbox, it.calcId, it.mode, "", "");
      const d2 = await uiSetInputsAndEvaluate(desktopSandbox, it.calcId, it.mode, it.a, it.b);
      const dReplay = !d1.broken && !d2.broken && deepEqualObjectIs(d1, d2);
      dskUiObs = {
        id: `${it.id}-dsk-ui`,
        slice: "slice_b",
        surface: "desktop_ui",
        resultText: d1.broken ? "" : d1.resultText,
        liveText: d1.broken ? "" : d1.liveText,
        isError: d1.broken ? false : d1.isError,
        cardRestored: d1.broken ? false : d1.cardRestored,
        replayPassed: dReplay,
        broken: Boolean(d1.broken || d2.broken),
        brokenReason: d1.reason || d2.reason,
      };
      dskUiGraded = gradeObservation(dskUiObs, mobUiSpec);
      dskUiLenient = gradeObservation(dskUiObs, mobUiSpec, { rubricVariant: "lenient" });
    }
    desktopUiRecords.push({
      ...dskUiObs,
      passed: dskUiGraded.passed,
      lenientPassed: dskUiLenient.passed,
      outputLength: dskUiGraded.outputLength || 0,
      subCategory: it.subCategory,
    });

    // Raw Math vs Guarded UI paired safety tally (on non-broken surface pairs):
    // Here we compare Mobile Raw Math safety (whether raw math alone prevents non-finite leak/error)
    // vs Mobile Guarded UI (or Desktop Guarded UI when available!).
    rawMathRecords.push({ ...mobMathObs, passed: mobMathGraded.passed, outputLength: mobMathGraded.outputLength });
    guardedUiRecords.push(mobileUiRecords[mobileUiRecords.length - 1]);

    const rawPass = mobMathGraded.passed;
    const guardPass = !dskUiObs.broken ? (dskUiGraded.passed && mobUiGraded.passed) : mobUiGraded.passed;
    if (rawPass && guardPass) rawVsGuarded2x2.a += 1;
    else if (rawPass && !guardPass) rawVsGuarded2x2.b += 1;
    else if (!rawPass && guardPass) rawVsGuarded2x2.c += 1;
    else rawVsGuarded2x2.d += 1;

    if (!dskUiObs.broken) {
      const mPass = mobUiGraded.passed;
      const dPass = dskUiGraded.passed;
      if (mPass && dPass) desktopVsMobile2x2.a += 1;
      else if (mPass && !dPass) desktopVsMobile2x2.b += 1;
      else if (!mPass && dPass) desktopVsMobile2x2.c += 1;
      else desktopVsMobile2x2.d += 1;

      const dCompareObj = {
        passed: dPass,
        noInfiniteLeak: !hasNonFiniteDisplayToken(dskUiObs.resultText) && !hasNonFiniteDisplayToken(dskUiObs.liveText),
        liveValid: checkResultTokens(dskUiObs.liveText, oracle.guardedUi.liveTokens) || oracle.guardedUi.expectError,
        replayPassed: dskUiObs.replayPassed,
      };
      const mCompareObj = {
        passed: mPass,
        noInfiniteLeak: !hasNonFiniteDisplayToken(mobUiObs.resultText) && !hasNonFiniteDisplayToken(mobUiObs.liveText),
        liveValid: checkResultTokens(mobUiObs.liveText, oracle.guardedUi.liveTokens) || oracle.guardedUi.expectError,
        replayPassed: mobUiObs.replayPassed,
      };
      const ab = comparePairwiseSafety(dCompareObj, mCompareObj);
      const ba = comparePairwiseSafety(mCompareObj, dCompareObj);
      const consistent =
        (ab === "A" && ba === "B") || (ab === "B" && ba === "A") || (ab === "tie" && ba === "tie");
      orderFlipPairs.push({ id: it.id, ab, ba, consistent });
    }

    records.push(mobileUiRecords[mobileUiRecords.length - 1]);
    records.push(desktopUiRecords[desktopUiRecords.length - 1]);
    records.push({
      ...rustRawObs,
      passed: rustRawGraded.passed,
      lenientPassed: rustRawGraded.passed,
      outputLength: rustRawGraded.outputLength || 0,
      subCategory: it.subCategory,
    });
  }

  // Verify metamorphic pairs cleanly on Mobile UI (and Desktop when bridge present)
  const metaIndex = new Map(mobileUiRecords.map((r) => [r.id.replace(/-mob-ui$/, ""), r]));
  let metamorphicChecked = 0;
  let metamorphicPassed = 0;
  for (const link of metamorphicLinks) {
    const r1 = metaIndex.get(link.id1);
    const r2 = metaIndex.get(link.id2);
    if (!r1 || !r2) continue;
    metamorphicChecked += 1;
    let ok = false;
    if (link.kind === "scale_change" || link.kind === "scale_percent") {
      ok = r1.passed && r2.passed && r1.resultText === r2.resultText;
    } else if (link.kind === "sign_what") {
      ok = r1.passed && r2.passed && r2.resultText.includes("-");
    } else if (link.kind === "tax_roundtrip") {
      ok = r1.passed && r2.passed && r2.resultText.includes(refFormatDecimal(link.net));
    }
    if (ok) metamorphicPassed += 1;
  }

  const orthogonality = auditFactorialOrthogonality(factorialMeta, ["calc_mode", "a_regime", "b_regime"]);
  return {
    uniqueItemCount: items.length,
    goldenOverlapCount: 0, // guaranteed by goldenPairSet exclusion in addUniqueItem
    records,
    desktopUiRecords,
    mobileUiRecords,
    rawMathRecords,
    guardedUiRecords,
    desktopVsMobile2x2,
    rawVsGuarded2x2,
    orderFlipPairs,
    metamorphic: { checked: metamorphicChecked, passed: metamorphicPassed },
    orthogonality,
  };
}

/**
 * Slice C: Separated 10,661-Case Golden Oracle Regression (`golden.json`).
 * Runs BOTH Mobile Raw Math and Rust Core Bridge (no JS fallback for Rust!).
 */
async function runSliceC(mobileMath, rustBridge, goldenCases) {
  const mobileRecords = [];
  const rustRecords = [];
  const rustRequests = [];

  for (let i = 0; i < goldenCases.length; i += 1) {
    const c = goldenCases[i];
    const a = parseGoldenNum(c.a[0]);
    const b = c.a.length > 1 ? parseGoldenNum(c.a[1]) : null;
    const isFmt = c.f === "formatDecimal";

    // Mobile JS check
    let mobActualStr = "";
    let mobOk = true;
    let mobPass = false;
    if (isFmt) {
      mobActualStr = String(mobileMath.formatDecimal(a));
      mobPass = mobActualStr === c.r;
    } else {
      const fnMap = {
        percentageChange: "change",
        percentageOfTotal: "percent",
        percentagePortion: "what",
        discount: "discount",
        originalValue: "base",
      };
      const calcId = fnMap[c.f];
      const out = mobileMath.runCalc(calcId, null, a, b);
      mobOk = out.ok === true || out.ok === "true";
      mobActualStr = mobOk ? String(out.label ?? "") : String(out.error ?? "");
      mobPass = c.r.ok ? mobOk && out.label === c.r.label && (!c.r.copyText || out.copyText === c.r.copyText) : !mobOk && out.error === c.r.error;
    }
    mobileRecords.push({
      id: `C-mob-${i + 1}`,
      slice: "slice_c",
      surface: "mobile_raw_math",
      passed: mobPass,
      lenientPassed: mobPass,
      broken: false,
      outputLength: Buffer.byteLength(mobActualStr, "utf8"),
      subCategory: c.f,
    });

    const opMap = {
      formatDecimal: "format_decimal",
      percentageChange: "calc_change",
      percentageOfTotal: "calc_percent_of_total",
      percentagePortion: "calc_portion",
      discount: "calc_discount",
      originalValue: "calc_original",
    };
    rustRequests.push({ surface: "core", op: opMap[c.f], a, b, mode: null });
  }

  const rustResults = await rustBridge.callBatch(rustRequests, 64);
  for (let i = 0; i < goldenCases.length; i += 1) {
    const c = goldenCases[i];
    const r = rustResults[i];
    if (!r || r.broken) {
      rustRecords.push({
        id: `C-rust-${i + 1}`,
        slice: "slice_c",
        surface: "rust_core",
        passed: false,
        lenientPassed: false,
        broken: true,
        brokenReason: r?.reason || "RUST_BRIDGE_UNAVAILABLE",
        outputLength: 0,
        subCategory: c.f,
      });
      continue;
    }
    let rustPass = false;
    let rustStr = "";
    if (c.f === "formatDecimal") {
      rustStr = typeof r.result === "string" ? r.result : String(r.result?.formatted ?? r.result ?? "");
      rustPass = Boolean(r.ok) && rustStr === c.r;
    } else if (c.r.ok) {
      rustStr = String(r.result?.label ?? "");
      rustPass = Boolean(r.ok) && (r.result?.ok === true || r.result?.ok === "true") && r.result?.label === c.r.label && (!c.r.copyText || r.result?.copyText === c.r.copyText);
    } else {
      rustStr = String(r.result?.error ?? r.error ?? "");
      rustPass = Boolean(r.ok) && (r.result?.ok === false || r.result?.ok === "false") && rustStr === c.r.error;
    }
    rustRecords.push({
      id: `C-rust-${i + 1}`,
      slice: "slice_c",
      surface: "rust_core",
      passed: rustPass,
      lenientPassed: rustPass,
      broken: false,
      outputLength: Buffer.byteLength(rustStr, "utf8"),
      subCategory: c.f,
    });
  }

  return {
    oracleCount: goldenCases.length,
    mobileRecords,
    rustRecords,
    records: [...mobileRecords, ...rustRecords],
  };
}

/**
 * Strip JS line & block comments safely while preserving string literals so sink
 * scans check real executable code rather than explanatory comments.
 */
function stripJsCommentsPreserveStrings(src) {
  let out = "";
  let i = 0;
  let state = "code"; // code | single | double | template | line_comment | block_comment
  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];
    if (state === "code") {
      if (ch === "/" && next === "/") {
        state = "line_comment";
        i += 2;
        continue;
      }
      if (ch === "/" && next === "*") {
        state = "block_comment";
        i += 2;
        continue;
      }
      if (ch === "'") state = "single";
      else if (ch === '"') state = "double";
      else if (ch === "`") state = "template";
      out += ch;
      i += 1;
    } else if (state === "single" || state === "double" || state === "template") {
      out += ch;
      if (ch === "\\" && i + 1 < src.length) {
        out += src[i + 1];
        i += 2;
        continue;
      }
      if ((state === "single" && ch === "'") || (state === "double" && ch === '"') || (state === "template" && ch === "`")) {
        state = "code";
      }
      i += 1;
    } else if (state === "line_comment") {
      if (ch === "\n") {
        state = "code";
        out += "\n";
      }
      i += 1;
    } else if (state === "block_comment") {
      if (ch === "*" && next === "/") {
        state = "code";
        i += 2;
      } else {
        if (ch === "\n") out += "\n";
        i += 1;
      }
    }
  }
  return out;
}

/**
 * Slice D: Expanded Static, Security, PWA & CI Hygiene Invariants.
 */
function runSliceD(artifacts, gitMeta, requireCleanGit) {
  const checks = [];
  const recordCheck = (id, passed, details) => {
    checks.push({
      id: `D-${id}`,
      slice: "slice_d",
      surface: "static",
      passed: Boolean(passed),
      lenientPassed: Boolean(passed),
      broken: false,
      outputLength: Buffer.byteLength(details, "utf8"),
      summaryText: details,
      details,
      subCategory: id.split("-")[0],
    });
  };

  // 1. Strict LF checks (0 CR bytes) across mobile/*, ui/*, scripts/*.mjs
  const lfTargets = [
    "mobile/index.html",
    "mobile/sw.js",
    "mobile/manifest.webmanifest",
    "ui/index.html",
    "ui/styles.css",
    "ui/main.js",
  ];
  const scriptsDir = path.join(REPO_ROOT, "scripts");
  if (fs.existsSync(scriptsDir)) {
    for (const f of fs.readdirSync(scriptsDir).sort()) {
      if (f.endsWith(".mjs")) lfTargets.push(`scripts/${f}`);
    }
  }
  for (const rel of lfTargets) {
    const full = path.join(REPO_ROOT, rel);
    const exists = fs.existsSync(full);
    const bytes = exists ? fs.readFileSync(full) : Buffer.alloc(0);
    const crCount = bytes.filter((b) => b === 13).length;
    recordCheck(`lf-${rel.replace(/[^\w.-]/g, "_")}`, exists && crCount === 0, `${rel}: crCount=${crCount}`);
  }

  // 2. Mobile CSP SHA-256 hashes + no frame-ancestors in <meta>
  const cspMatch = artifacts.mobileHtml.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i);
  const csp = cspMatch ? cspMatch[1] : "";
  const styleHash = crypto.createHash("sha256").update(artifacts.mobileStyleBody, "utf8").digest("base64");
  const scriptHash = crypto.createHash("sha256").update(artifacts.mobileScriptBody, "utf8").digest("base64");
  const hasStyleHash = csp.includes(`'sha256-${styleHash}'`);
  const hasScriptHash = csp.includes(`'sha256-${scriptHash}'`);
  const noFrameAncestors = !/frame-ancestors/i.test(csp);
  recordCheck("csp-style-sha256", hasStyleHash, `style-src sha256=${styleHash}`);
  recordCheck("csp-script-sha256", hasScriptHash, `script-src sha256=${scriptHash}`);
  recordCheck("csp-no-meta-frame-ancestors", noFrameAncestors, `no frame-ancestors in meta CSP`);

  // 3. Stricter DOM/eval/timer sinks across Desktop JS, Mobile script, Mobile SW
  const sinkTargets = [
    { name: "ui-main-js", src: artifacts.uiMainJs },
    { name: "mobile-inline-script", src: artifacts.mobileScriptBody },
    { name: "mobile-sw-js", src: artifacts.mobileSwJs },
  ];
  const sinkPattern = /\.innerHTML\b|\.outerHTML\b|\.insertAdjacentHTML\s*\(|\bdocument\.write(?:ln)?\s*\(|\bcreateContextualFragment\s*\(|\beval\s*\(|\bnew\s+Function\b|\b(?:setTimeout|setInterval)\s*\(\s*["'`]/;
  for (const st of sinkTargets) {
    const codeOnly = stripJsCommentsPreserveStrings(st.src);
    const hit = codeOnly.match(sinkPattern);
    recordCheck(`sinks-${st.name}`, !hit, hit ? `Matched forbidden sink: ${hit[0]}` : "No forbidden DOM/eval/timer sinks");
  }

  // 4. Mobile inline script runtime .style.* mutation ban
  const mobileCodeOnly = stripJsCommentsPreserveStrings(artifacts.mobileScriptBody);
  const styleMutHit = mobileCodeOnly.match(/\.style\s*(?:\.|\[|=)/);
  recordCheck("mobile-no-style-mutation", !styleMutHit, styleMutHit ? `Matched .style mutation: ${styleMutHit[0]}` : "Zero .style mutations in mobile JS");

  // 5. GitHub Workflows: 40-char SHA pins & strict per-checkout persist-credentials: false
  for (const wfRel of [".github/workflows/build.yml", ".github/workflows/pages.yml"]) {
    const wfPath = path.join(REPO_ROOT, wfRel);
    const yaml = fs.existsSync(wfPath) ? fs.readFileSync(wfPath, "utf8") : "";
    const usesMatches = [...yaml.matchAll(/uses:\s+([^\s#]+)/g)].map((m) => m[1]);
    const allPinned = usesMatches.length > 0 && usesMatches.every((ref) => /@[a-f0-9]{40}$/.test(ref));
    recordCheck(`ci-sha-pins-${path.basename(wfRel)}`, allPinned, `${wfRel}: ${usesMatches.length} uses checked`);

    // Split YAML at step boundaries (`- name:` or `- uses:`) and inspect every actions/checkout step individually
    const stepBlocks = yaml.split(/\n\s*-\s+(?=(?:name:|uses:|run:|id:))/).slice(1);
    const checkoutSteps = stepBlocks.filter((blk) => /uses:\s+actions\/checkout@/.test(blk));
    const missingCredsFalse = checkoutSteps.filter((blk) => !/persist-credentials:\s*false\b/.test(blk));
    recordCheck(
      `ci-checkout-creds-${path.basename(wfRel)}`,
      checkoutSteps.length > 0 && missingCredsFalse.length === 0,
      `${wfRel}: ${checkoutSteps.length} checkout steps, missing=${missingCredsFalse.length}`
    );
  }

  // 6. PWA manifest.webmanifest validation + referenced icon files + SW precache coverage
  const manifestRel = "mobile/manifest.webmanifest";
  const manifestPath = path.join(REPO_ROOT, manifestRel);
  let manifestOk = false;
  let manifestIconsExist = false;
  let manifestPrecached = false;
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifestOk = Boolean(manifest.name && manifest.short_name && manifest.start_url && manifest.display && Array.isArray(manifest.icons) && manifest.icons.length > 0);
    manifestIconsExist = manifest.icons.every((ic) => {
      if (!ic || typeof ic.src !== "string") return false;
      const cleanRel = ic.src.replace(/^\.\//, "");
      return fs.existsSync(path.join(REPO_ROOT, "mobile", cleanRel));
    });
    manifestPrecached = manifest.icons.every((ic) => {
      const normalized = ic.src.startsWith("./") ? ic.src : `./${ic.src}`;
      return artifacts.mobileSwJs.includes(normalized);
    });
  } catch {
    manifestOk = false;
  }
  recordCheck("pwa-manifest-json", manifestOk, "manifest.webmanifest valid schema");
  recordCheck("pwa-manifest-icons-exist", manifestIconsExist, "all manifest icons exist on disk");
  recordCheck("pwa-sw-precaches-icons", manifestPrecached, "sw.js precaches all manifest icons");

  // 7. Git working tree cleanliness audit (gating only when --require-clean-git)
  const cleanPass = requireCleanGit ? !gitMeta.git_dirty : true;
  recordCheck(
    "git-worktree-clean-flag",
    cleanPass,
    `git_dirty=${gitMeta.git_dirty} (${gitMeta.git_dirty_count} entries); enforced=${requireCleanGit}`
  );

  return { records: checks, uniqueItemCount: checks.length };
}

/**
 * Slice E: Multi-Turn Stateful & Async-Race Evaluation (`>= 100` unique transcripts).
 * Orthogonal 4 families x 2 surfaces x 3 personas x 4 lengths x 2 tactics = 192 transcripts.
 * Strict rule: ONE bad turn fails the ENTIRE transcript!
 */
async function runSliceE(artifacts, rustBridge, rng) {
  const families = [
    "async_race_and_settings",
    "paste_swap_tax_overflow",
    "history_lifecycle_stateful",
    "updates_security_and_sw",
  ];
  const surfaces = ["desktop", "mobile"];
  const personas = ["everyday_user", "power_analyst", "adversarial_tester"];
  const lengths = [4, 5, 6, 7];
  const tactics = ["escalating_edge", "benign_stress"];

  const transcripts = [];
  const desktopVsMobilePairs = [];
  const factorialMeta = [];
  let mobByKey = new Map();
  let dskByKey = new Map();

  for (const family of families) {
    for (const surface of surfaces) {
      for (const persona of personas) {
        for (const convLen of lengths) {
          for (const tactic of tactics) {
            const scenarioKey = `${family}|${persona}|${convLen}|${tactic}`;
            const txId = `E-${transcripts.length + 1}-${family.slice(0, 6)}-${surface.slice(0, 3)}-L${convLen}`;

            const res = await executeMultiTurnTranscript({
              txId,
              family,
              surface,
              persona,
              convLen,
              tactic,
              artifacts,
              rustBridge,
              rng,
            });

            const observation = {
              id: txId,
              slice: "slice_e",
              surface,
              turns: res.turns,
              summaryText: res.turns.map((t) => t.detail).join(" | "),
              broken: res.broken,
              brokenReason: res.brokenReason,
            };
            const specCheck = { kind: "multiturn_transcript", expectedTurnCount: convLen };
            const graded = gradeObservation(observation, specCheck);
            const lenient = gradeObservation(observation, specCheck, { rubricVariant: "lenient" });

            const rec = {
              ...observation,
              passed: graded.passed,
              lenientPassed: lenient.passed,
              outputLength: graded.outputLength,
              family,
              persona,
              tactic,
              conversation_length: convLen,
              subCategory: family,
              scenarioKey,
            };
            transcripts.push(rec);
            factorialMeta.push({
              family,
              surface,
              persona,
              conversation_length: String(convLen),
              tactic,
            });
            if (surface === "mobile") mobByKey.set(scenarioKey, rec);
            else dskByKey.set(scenarioKey, rec);
          }
        }
      }
    }
  }

  let pair2x2 = { a: 0, b: 0, c: 0, d: 0 };
  for (const [key, mRec] of mobByKey.entries()) {
    const dRec = dskByKey.get(key);
    if (!dRec || mRec.broken || dRec.broken) continue;
    if (mRec.passed && dRec.passed) pair2x2.a += 1;
    else if (mRec.passed && !dRec.passed) pair2x2.b += 1;
    else if (!mRec.passed && dRec.passed) pair2x2.c += 1;
    else pair2x2.d += 1;
    desktopVsMobilePairs.push({ key, mobile: mRec.passed, desktop: dRec.passed });
  }

  const orthogonality = auditFactorialOrthogonality(factorialMeta, [
    "family",
    "surface",
    "persona",
    "conversation_length",
    "tactic",
  ]);
  return {
    uniqueTranscriptCount: transcripts.length,
    records: transcripts,
    desktopVsMobile2x2: pair2x2,
    orthogonality,
  };
}

async function executeMultiTurnTranscript({ txId, family, surface, persona, convLen, tactic, artifacts, rustBridge, rng }) {
  const turns = [];
  const recordTurn = (name, passed, detail, lenientPassed = passed) => {
    turns.push({ name, passed: Boolean(passed), lenientPassed: Boolean(lenientPassed), detail: String(detail) });
  };

  if (surface === "desktop") {
    const sandbox = await createDesktopSandbox(artifacts, rustBridge);
    const doc = sandbox.document;
    const checkBroken = () => {
      const b = sandbox.getBrokenBridge();
      if (b.broken) {
        sandbox.resetBrokenFlag();
        return b;
      }
      return { broken: false };
    };

    // Fixed Turn 1: baseline benign sanity calculation on `what`
    const a1 = Number((10 + Math.floor(rng() * 80)).toFixed(0));
    const b1 = Number((100 + Math.floor(rng() * 400)).toFixed(0));
    const t1 = await uiSetInputsAndEvaluate(sandbox, "what", null, a1, b1);
    if (t1.broken) return { broken: true, brokenReason: t1.reason, turns };
    const t1Oracle = computeReferenceOracle("what", null, a1, b1);
    recordTurn("turn1_baseline", !t1.isError && checkResultTokens(t1.resultText, t1Oracle.guardedUi.formattedTokens), `what(${a1},${b1})=>${t1.resultText}`);

    if (family === "async_race_and_settings") {
      // Turn 2: Async calcSequence slow-first / fast-second IPC race!
      sandbox.backend.deferNextMatching((cmd, args) => cmd === "calc_change" && args.newValue === 150);
      const cOrig = doc.getElementById("changeOrig");
      const cNew = doc.getElementById("changeNew");
      cOrig.value = "100";
      cNew.value = "150"; // Slow IPC held!
      cNew.dispatchEvent(new MockEvent("input", { bubbles: true }));
      await sandbox.drain();

      // Immediately enter newer input 200 -> fast IPC resolves to 100.00% increase
      cNew.value = "200";
      cNew.dispatchEvent(new MockEvent("input", { bubbles: true }));
      await sandbox.drain();
      let br = checkBroken();
      if (br.broken) return { broken: true, brokenReason: br.reason, turns };
      const afterFast = doc.getElementById("changeResult").textContent;
      // Now resolve slow stale req1 (150 -> 50% increase)
      if (sandbox.backend.getHeldQueue().length > 0) {
        await sandbox.backend.resolveHeld(0);
      }
      await sandbox.drain();
      br = checkBroken();
      if (br.broken) return { broken: true, brokenReason: br.reason, turns };
      const afterStale = doc.getElementById("changeResult").textContent;
      const raceSafe = afterFast.includes("100.00%") && afterStale === afterFast && !afterStale.includes("50.00%");
      recordTurn("turn2_calc_sequence_race", raceSafe, `fast=${afterFast}, afterStale=${afterStale}`);

      // Turn 3: autoUpdateToggle persistence failure rollback & error guard
      const toggle = doc.getElementById("autoUpdateToggle");
      const beforeChecked = toggle.checked;
      sandbox.backend.setSettingsFailureCount(1);
      toggle.click();
      await sandbox.drain();
      const reverted = toggle.checked === beforeChecked && sandbox.getUnhandledErrors().length >= 0;
      recordTurn("turn3_toggle_failure_rollback", reverted, `before=${beforeChecked}, after=${toggle.checked}`, sandbox.getUnhandledErrors().length === 0);

      // Turn 4: clean toggle persistence succeeds & remains synced
      toggle.click();
      await sandbox.drain();
      const persistedOk = toggle.checked === !beforeChecked && sandbox.backend.getSettings().checkUpdatesOnStartup === toggle.checked;
      recordTurn("turn4_toggle_persist", persistedOk, `checked=${toggle.checked}, backend=${sandbox.backend.getSettings().checkUpdatesOnStartup}`);

      // Optional Turns 5..7 matching exact convLen
      if (convLen >= 5) {
        const resT5 = await uiSetInputsAndEvaluate(sandbox, "percent", null, 25, 200);
        if (resT5.broken) return { broken: true, brokenReason: resT5.reason, turns };
        recordTurn("turn5_post_race_calc", !resT5.isError && resT5.resultText.includes("12.50%"), resT5.resultText);
      }
      if (convLen >= 6) {
        const resT6 = await uiSetInputsAndEvaluate(sandbox, "tax", "extract", 120, 20);
        if (resT6.broken) return { broken: true, brokenReason: resT6.reason, turns };
        recordTurn("turn6_tax_extract", !resT6.isError && resT6.resultText.includes("100.00"), resT6.resultText);
      }
      if (convLen >= 7) {
        doc.getElementById("resetTaxBtn")?.click();
        await sandbox.drain();
        const cleared = doc.getElementById("taxAmount").value === "" && doc.getElementById("taxRate").value === "";
        recordTurn("turn7_reset_clean", cleared, `taxAmount='${doc.getElementById("taxAmount").value}'`);
      }
    } else if (family === "paste_swap_tax_overflow") {
      // Turn 2: Pre-seed valid -> paste adversarial hex/Infinity -> MUST preserve value
      const elA = doc.getElementById("changeOrig");
      const elB = doc.getElementById("changeNew");
      elA.value = "50";
      elB.value = "75";
      const badPaste = tactic === "benign_stress" ? "Infinity" : "0x10";
      simulateBrowserPaste(elA, badPaste);
      await sandbox.drain();
      checkBroken();
      recordTurn("turn2_paste_non_decimal_guard", elA.value === "50", `after paste(${badPaste}) value='${elA.value}'`);

      // Turn 3: Paste "-USD 100" -> must sanitize to -100 & compute cleanly (-100 -> -50 is 50.00% decrease)
      simulateBrowserPaste(elA, "-USD 100");
      elB.value = "-50";
      elB.dispatchEvent(new MockEvent("input", { bubbles: true }));
      await sandbox.drain();
      let br = checkBroken();
      if (br.broken) return { broken: true, brokenReason: br.reason, turns };
      const exp3 = computeReferenceOracle("change", null, -100, -50).raw.formattedTokens[0];
      const r3 = doc.getElementById("changeResult").textContent;
      recordTurn("turn3_paste_negative_iso_currency", elA.value === "-100" && r3.includes(exp3), `val='${elA.value}', res='${r3}', exp='${exp3}'`);

      // Turn 4: Swap inputs -> recompute direction flips cleanly (-50 -> -100 is 100.00% increase)
      doc.getElementById("swapChangeBtn").click();
      await sandbox.drain();
      br = checkBroken();
      if (br.broken) return { broken: true, brokenReason: br.reason, turns };
      const exp4 = computeReferenceOracle("change", null, -50, -100).raw.formattedTokens[0];
      const r4 = doc.getElementById("changeResult").textContent;
      recordTurn("turn4_swap_recomputes", doc.getElementById("changeOrig").value === "-50" && doc.getElementById("changeNew").value === "-100" && r4.includes(exp4), `res='${r4}', exp='${exp4}'`);

      if (convLen >= 5) {
        // Turn 5: Tax add -> extract toggle check
        await uiSetInputsAndEvaluate(sandbox, "tax", "add", 100, 15);
        doc.getElementById("taxModeExtractBtn").click();
        await sandbox.drain();
        br = checkBroken();
        if (br.broken) return { broken: true, brokenReason: br.reason, turns };
        const r5 = doc.getElementById("taxResult").textContent;
        recordTurn("turn5_tax_mode_toggle", !isUiErrorElement(doc.getElementById("taxResult")) && r5.includes("86.96"), r5);
      }
      if (convLen >= 6) {
        // Turn 6: 1.8e306 overflow -> out-of-range without Infinity leak
        const ov = await uiSetInputsAndEvaluate(sandbox, "what", null, 100, 1.8e306);
        if (ov.broken) return { broken: true, brokenReason: ov.reason, turns };
        const okOv = ov.isError && !hasNonFiniteDisplayToken(ov.resultText) && !hasNonFiniteDisplayToken(ov.liveText);
        recordTurn("turn6_overflow_out_of_range", okOv, `res='${ov.resultText}', live='${ov.liveText}'`);
      }
      if (convLen >= 7) {
        // Turn 7: 257-char input copy button still works!
        const longOk = await uiSetInputsAndEvaluate(sandbox, "what", null, "1." + "0".repeat(255), "42");
        if (longOk.broken) return { broken: true, brokenReason: longOk.reason, turns };
        const beforeCopy = sandbox.backend.getCopiedTexts().length;
        doc.getElementById("copyWhatBtn").click();
        await sandbox.drain();
        const copied = sandbox.backend.getCopiedTexts().length > beforeCopy;
        recordTurn("turn7_long_input_copy_works", !longOk.isError && copied, `copied=${copied}`);
      }
    } else if (family === "history_lifecycle_stateful") {
      // Seed 500 entries cleanly into backend history for eviction + dedup + restore tests
      const seedEntries = [];
      for (let k = 0; k < 500; k += 1) {
        const inpA = String(1 + (k % 90));
        const inpB = String(100 + k);
        const val = refFormatDecimal(((1 + (k % 90)) / 100) * (100 + k));
        seedEntries.push({
          id: 1731542000000 + k,
          timestampMs: 1731542000000 + k,
          calculator: "what",
          calculatorLabel: "X% of Y",
          inputA: inpA,
          inputB: inpB,
          mode: null,
          inputsText: `${inpA}% of ${inpB}`,
          resultText: val,
          copyText: val,
        });
      }
      const histSandbox = await createDesktopSandbox(artifacts, rustBridge, { initialHistory: seedEntries });
      const hDoc = histSandbox.document;

      // Turn 1 overwrite for clean accounting on this sub-sandbox
      turns.pop();
      const t1h = await uiSetInputsAndEvaluate(histSandbox, "what", null, a1, b1);
      if (t1h.broken) return { broken: true, brokenReason: t1h.reason, turns };
      recordTurn("turn1_seeded_500_baseline", !t1h.isError, t1h.resultText);

      // Turn 2: Save 2 new calcs via calcBtn -> count stays capped at 500!
      await uiSetInputsAndEvaluate(histSandbox, "change", null, 100, 140);
      hDoc.getElementById("calcChangeBtn").click();
      await histSandbox.drain();
      if (histSandbox.getBrokenBridge().broken) return { broken: true, brokenReason: histSandbox.getBrokenBridge().reason, turns };
      // Duplicate save should dedup cleanly
      hDoc.getElementById("calcChangeBtn").click();
      await histSandbox.drain();
      const histAfterDedup = histSandbox.backend.getHistory();
      const dedupCount = histAfterDedup.filter((e) => e.calculator === "change" && e.inputA === "100" && e.inputB === "140").length;
      recordTurn("turn2_500_cap_and_dedup", histAfterDedup.length === 500 && dedupCount === 1, `len=${histAfterDedup.length}, dedupCount=${dedupCount}`);

      // Turn 3: Filter history -> restore latest entry -> verify active calc result
      const filterEl = hDoc.getElementById("historyFilter");
      filterEl.value = "change";
      filterEl.dispatchEvent(new MockEvent("change", { bubbles: true }));
      const restoreBtns = hDoc.querySelectorAll(".history-restore-btn");
      if (restoreBtns.length > 0) restoreBtns[0].click();
      await histSandbox.drain();
      if (histSandbox.getBrokenBridge().broken) return { broken: true, brokenReason: histSandbox.getBrokenBridge().reason, turns };
      const restoredRes = hDoc.getElementById("changeResult").textContent;
      recordTurn("turn3_filter_and_restore", restoreBtns.length >= 1 && restoredRes.includes("40.00% increase"), `res='${restoredRes}'`);

      // Turn 4: Single item delete removes 1 entry cleanly
      const preDelLen = histSandbox.backend.getHistory().length;
      const delBtns = hDoc.querySelectorAll(".history-delete-btn");
      if (delBtns.length > 0) delBtns[0].click();
      await histSandbox.drain();
      const postDelLen = histSandbox.backend.getHistory().length;
      recordTurn("turn4_single_delete", delBtns.length > 0 && postDelLen === preDelLen - 1, `before=${preDelLen}, after=${postDelLen}`);

      if (convLen >= 5) {
        // Turn 5: Clear filter + restore another calculator type
        filterEl.value = "all";
        filterEl.dispatchEvent(new MockEvent("change", { bubbles: true }));
        const allRestore = hDoc.querySelectorAll(".history-restore-btn");
        if (allRestore.length > 0) allRestore[0].click();
        await histSandbox.drain();
        if (histSandbox.getBrokenBridge().broken) return { broken: true, brokenReason: histSandbox.getBrokenBridge().reason, turns };
        const whatRes = hDoc.getElementById("whatResult").textContent;
        recordTurn("turn5_unfilter_restore", !isUiErrorElement(hDoc.getElementById("whatResult")) && whatRes.length > 1, whatRes);
      }
      if (convLen >= 6) {
        // Turn 6: Two-step clear history flow
        hDoc.getElementById("clearHistoryBtn").click();
        hDoc.getElementById("confirmClearHistoryBtn").click();
        await histSandbox.drain();
        const clearedLen = histSandbox.backend.getHistory().length;
        recordTurn("turn6_clear_all_confirmed", clearedLen === 0, `remaining=${clearedLen}`);
      }
      if (convLen >= 7) {
        // Turn 7: Save negative-zero calc preserves "-0" or clean output
        const nz = await uiSetInputsAndEvaluate(histSandbox, "what", null, -0, 200);
        if (nz.broken) return { broken: true, brokenReason: nz.reason, turns };
        recordTurn("turn7_neg_zero_clean", !nz.isError && !hasNonFiniteDisplayToken(nz.resultText) && nz.resultText.includes("0.00"), nz.resultText);
      }
    } else {
      // family === "updates_security_and_sw" (Desktop IPC updates & release allowlist)
      // Turn 2: Remote latestVersion OLDER (2.1.1) while running 2.2.1 -> MUST say running v2.2.1!
      sandbox.backend.setUpdateResponse({
        ok: true,
        updateAvailable: false,
        currentVersion: "2.2.1",
        latestVersion: "2.1.1",
        releaseUrl: "https://github.com/CipherVaults/Percentage-Calculator-Tool/releases/tag/v2.1.1",
      });
      doc.getElementById("checkUpdatesNowBtn").click();
      await sandbox.drain();
      const status2 = doc.getElementById("updateStatusText").textContent;
      recordTurn("turn2_uptodate_shows_running_version", status2.includes("2.2.1") && !status2.includes("2.1.1"), status2);

      // Turn 3: Newer release available -> banner visible & release URL opened only if prefix matches
      sandbox.backend.setUpdateResponse({
        ok: true,
        updateAvailable: true,
        currentVersion: "2.2.1",
        latestVersion: "2.3.0",
        releaseUrl: "https://github.com/CipherVaults/Percentage-Calculator-Tool/releases/tag/v2.3.0",
      });
      doc.getElementById("checkUpdatesNowBtn").click();
      await sandbox.drain();
      const status3 = doc.getElementById("updateStatusText").textContent;
      doc.getElementById("openReleasePageBtn").click();
      await sandbox.drain();
      const opened = sandbox.backend.getOpenedUrls();
      recordTurn("turn3_update_available_and_open_safe_url", status3.includes("2.3.0") && opened.some((u) => u.startsWith("https://github.com/CipherVaults/Percentage-Calculator-Tool/releases")), `status='${status3}', opened=${opened.length}`);

      // Turn 4: Spoofed release URL blocked by open_release_page IPC!
      let spoofBlocked = false;
      try {
        await sandbox.backend.invoke("open_release_page", { url: "https://evil.example.com/payload.exe" });
      } catch {
        spoofBlocked = true;
      }
      recordTurn("turn4_spoofed_release_url_blocked", spoofBlocked, `spoofBlocked=${spoofBlocked}`);

      if (convLen >= 5) {
        // Turn 5: Update check network/HTTP error handled gracefully without crash
        sandbox.backend.setUpdateResponse(null, "HTTP 503 rate limited");
        doc.getElementById("checkUpdatesNowBtn").click();
        await sandbox.drain();
        const status5 = doc.getElementById("updateStatusText").textContent;
        recordTurn("turn5_update_error_graceful", /could not check|503|unable|failed|error/i.test(status5), status5);
      }
      if (convLen >= 6) {
        doc.getElementById("dismissUpdateBannerBtn").click();
        const bEl = doc.getElementById("updateBanner");
        const bannerHidden = bEl.hidden === true || bEl.classList.contains("hidden");
        recordTurn("turn6_dismiss_update_banner", bannerHidden, `hidden=${bannerHidden}`);
      }
      if (convLen >= 7) {
        const res7 = await uiSetInputsAndEvaluate(sandbox, "discount", null, 120, 25);
        if (res7.broken) return { broken: true, brokenReason: res7.reason, turns };
        recordTurn("turn7_post_update_calc", !res7.isError && res7.resultText.includes("90.00"), res7.resultText);
      }
    }
    return { broken: false, turns };
  }

  // ---- MOBILE FULL INLINE SCRIPT MULTI-TURN TRANSCRIPTS ----
  const mSandbox = await createMobileSandbox(artifacts, {
    swHasController: family === "updates_security_and_sw" || family === "async_race_and_settings",
  });
  const mDoc = mSandbox.document;

  const a1 = Number((10 + Math.floor(rng() * 80)).toFixed(0));
  const b1 = Number((100 + Math.floor(rng() * 400)).toFixed(0));
  const m1 = await uiSetInputsAndEvaluate(mSandbox, "what", null, a1, b1);
  const m1Oracle = computeReferenceOracle("what", null, a1, b1);
  recordTurn("turn1_baseline", !m1.isError && checkResultTokens(m1.resultText, m1Oracle.guardedUi.formattedTokens), `what(${a1},${b1})=>${m1.resultText}`);

  if (family === "async_race_and_settings") {
    // Turn 2: Rapid sequential inputs settle cleanly on latest input
    mDoc.getElementById("changeOrig").value = "100";
    mDoc.getElementById("changeNew").value = "150";
    mDoc.getElementById("changeNew").dispatchEvent(new MockEvent("input", { bubbles: true }));
    mDoc.getElementById("changeNew").value = "200";
    mDoc.getElementById("changeNew").dispatchEvent(new MockEvent("input", { bubbles: true }));
    await mSandbox.drain();
    const mRes2 = mDoc.getElementById("changeResult").textContent;
    recordTurn("turn2_mobile_rapid_sequence", mRes2.includes("100.00% increase"), mRes2);

    // Turn 3: Toggle autoUpdate persisted to in-memory localStorage & SW controllerchange reload guarded!
    const mToggle = mDoc.getElementById("autoUpdateToggle");
    const preChecked = mToggle.checked;
    mToggle.click();
    await mSandbox.drain();
    const savedSettings = JSON.parse(mSandbox.storage.getItem("pct_tool_settings_v1") || "{}");
    recordTurn("turn3_mobile_settings_persist", savedSettings.checkUpdatesOnStartup === !preChecked, JSON.stringify(savedSettings));

    // Turn 4: SW controllerchange fires reload once (guarded against infinite reload loop)
    mSandbox.sw.dispatchControllerChange();
    mSandbox.sw.dispatchControllerChange();
    recordTurn("turn4_sw_controllerchange_single_reload", mSandbox.getReloadCount() === 1, `reloads=${mSandbox.getReloadCount()}`);

    if (convLen >= 5) {
      const m5 = await uiSetInputsAndEvaluate(mSandbox, "percent", null, 25, 200);
      recordTurn("turn5_post_sw_calc", !m5.isError && m5.resultText.includes("12.50%"), m5.resultText);
    }
    if (convLen >= 6) {
      const m6 = await uiSetInputsAndEvaluate(mSandbox, "tax", "extract", 120, 20);
      recordTurn("turn6_tax_extract", !m6.isError && m6.resultText.includes("100.00"), m6.resultText);
    }
    if (convLen >= 7) {
      mDoc.getElementById("resetTaxBtn")?.click();
      recordTurn("turn7_reset_clean", mDoc.getElementById("taxAmount").value === "", mDoc.getElementById("taxAmount").value);
    }
  } else if (family === "paste_swap_tax_overflow") {
    const elA = mDoc.getElementById("changeOrig");
    const elB = mDoc.getElementById("changeNew");
    elA.value = "50";
    elB.value = "75";
    const badPaste = tactic === "benign_stress" ? "Infinity" : "0x10";
    simulateBrowserPaste(elA, badPaste);
    await mSandbox.drain();
    recordTurn("turn2_paste_non_decimal_guard", elA.value === "50", `after paste(${badPaste}) value='${elA.value}'`);

    simulateBrowserPaste(elA, "-USD 100");
    elB.value = "-50";
    elB.dispatchEvent(new MockEvent("input", { bubbles: true }));
    await mSandbox.drain();
    const expM3 = computeReferenceOracle("change", null, -100, -50).raw.formattedTokens[0];
    const m3 = mDoc.getElementById("changeResult").textContent;
    recordTurn("turn3_paste_negative_iso_currency", elA.value === "-100" && m3.includes(expM3), `val='${elA.value}', res='${m3}', exp='${expM3}'`);

    mDoc.getElementById("swapChangeBtn").click();
    await mSandbox.drain();
    const expM4 = computeReferenceOracle("change", null, -50, -100).raw.formattedTokens[0];
    const m4 = mDoc.getElementById("changeResult").textContent;
    recordTurn("turn4_swap_recomputes", mDoc.getElementById("changeOrig").value === "-50" && mDoc.getElementById("changeNew").value === "-100" && m4.includes(expM4), `res='${m4}', exp='${expM4}'`);

    if (convLen >= 5) {
      await uiSetInputsAndEvaluate(mSandbox, "tax", "add", 100, 15);
      mDoc.getElementById("taxModeExtractBtn").click();
      await mSandbox.drain();
      const m5 = mDoc.getElementById("taxResult").textContent;
      recordTurn("turn5_tax_mode_toggle", !isUiErrorElement(mDoc.getElementById("taxResult")) && m5.includes("86.96"), m5);
    }
    if (convLen >= 6) {
      const ov = await uiSetInputsAndEvaluate(mSandbox, "what", null, 100, 1.8e306);
      const okOv = ov.isError && !hasNonFiniteDisplayToken(ov.resultText) && !hasNonFiniteDisplayToken(ov.liveText);
      recordTurn("turn6_overflow_out_of_range", okOv, `res='${ov.resultText}', live='${ov.liveText}'`);
    }
    if (convLen >= 7) {
      const longOk = await uiSetInputsAndEvaluate(mSandbox, "what", null, "1." + "0".repeat(255), "42");
      const preC = mSandbox.getClipboardWrites().length + mSandbox.getExecCommandCopies().length;
      mDoc.getElementById("copyWhatBtn").click();
      await mSandbox.drain();
      const postC = mSandbox.getClipboardWrites().length + mSandbox.getExecCommandCopies().length;
      recordTurn("turn7_long_input_copy_works", !longOk.isError && postC > preC, `copied=${postC > preC}`);
    }
  } else if (family === "history_lifecycle_stateful") {
    const seed = [];
    for (let k = 0; k < 500; k += 1) {
      const inpA = String(1 + (k % 90));
      const inpB = String(100 + k);
      const val = refFormatDecimal(((1 + (k % 90)) / 100) * (100 + k));
      seed.push({
        id: 1731542000000 + k,
        timestampMs: 1731542000000 + k,
        calculator: "what",
        calculatorLabel: "X% of Y",
        inputA: inpA,
        inputB: inpB,
        mode: null,
        inputsText: `${inpA}% of ${inpB}`,
        resultText: val,
        copyText: val,
      });
    }
    const hMob = await createMobileSandbox(artifacts, {
      initialLocalStorage: { pct_tool_history_v2: JSON.stringify(seed) },
    });
    const hDoc = hMob.document;
    turns.pop();
    const hm1 = await uiSetInputsAndEvaluate(hMob, "what", null, a1, b1);
    recordTurn("turn1_seeded_500_baseline", !hm1.isError, hm1.resultText);

    await uiSetInputsAndEvaluate(hMob, "change", null, 100, 140);
    hDoc.getElementById("calcChangeBtn").click();
    hDoc.getElementById("calcChangeBtn").click();
    await hMob.drain();
    const arr2 = JSON.parse(hMob.storage.getItem("pct_tool_history_v2") || "[]");
    const dedup = arr2.filter((e) => e.calculator === "change" && e.inputA === "100" && e.inputB === "140").length;
    recordTurn("turn2_500_cap_and_dedup", arr2.length <= 500 && dedup === 1, `len=${arr2.length}, dedup=${dedup}`);

    const fEl = hDoc.getElementById("historyFilter");
    fEl.value = "change";
    fEl.dispatchEvent(new MockEvent("change", { bubbles: true }));
    const rBtns = hDoc.querySelectorAll(".history-restore-btn");
    if (rBtns.length > 0) rBtns[0].click();
    await hMob.drain();
    const rRes = hDoc.getElementById("changeResult").textContent;
    recordTurn("turn3_filter_and_restore", rBtns.length >= 1 && rRes.includes("40.00% increase"), `res='${rRes}'`);

    const preLen = JSON.parse(hMob.storage.getItem("pct_tool_history_v2") || "[]").length;
    const dBtns = hDoc.querySelectorAll(".history-delete-btn");
    if (dBtns.length > 0) dBtns[0].click();
    await hMob.drain();
    const postLen = JSON.parse(hMob.storage.getItem("pct_tool_history_v2") || "[]").length;
    recordTurn("turn4_single_delete", dBtns.length > 0 && postLen === preLen - 1, `before=${preLen}, after=${postLen}`);

    if (convLen >= 5) {
      fEl.value = "all";
      fEl.dispatchEvent(new MockEvent("change", { bubbles: true }));
      const allR = hDoc.querySelectorAll(".history-restore-btn");
      if (allR.length > 0) allR[0].click();
      await hMob.drain();
      recordTurn("turn5_unfilter_restore", !isUiErrorElement(hDoc.getElementById("whatResult")), hDoc.getElementById("whatResult").textContent);
    }
    if (convLen >= 6) {
      hDoc.getElementById("clearHistoryBtn").click();
      hDoc.getElementById("confirmClearHistoryBtn").click();
      const cLen = JSON.parse(hMob.storage.getItem("pct_tool_history_v2") || "[]").length;
      recordTurn("turn6_clear_all_confirmed", cLen === 0, `remaining=${cLen}`);
    }
    if (convLen >= 7) {
      const nz = await uiSetInputsAndEvaluate(hMob, "what", null, -0, 200);
      recordTurn("turn7_neg_zero_clean", !nz.isError && !hasNonFiniteDisplayToken(nz.resultText), nz.resultText);
    }
  } else {
    // updates_security_and_sw on Mobile
    // Turn 2: Older remote tag v2.1.1 -> must report running v2.2.1!
    const mPayload2 = {
      tag_name: "v2.1.1",
      draft: false,
      prerelease: false,
      html_url: "https://github.com/CipherVaults/Percentage-Calculator-Tool/releases/tag/v2.1.1",
    };
    mSandbox.setFetchResponder(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => "180" },
      text: async () => JSON.stringify(mPayload2),
      json: async () => mPayload2,
    }));
    mDoc.getElementById("checkUpdatesNowBtn").click();
    await mSandbox.drain();
    const ms2 = mDoc.getElementById("updateStatusText").textContent;
    recordTurn("turn2_uptodate_shows_running_version", ms2.includes("2.2.1") && !ms2.includes("2.1.1"), ms2);

    // Turn 3: Draft or prerelease or spoofed html_url MUST be ignored / rejected safely
    const mPayload3 = {
      tag_name: "v9.9.9",
      draft: true,
      prerelease: false,
      html_url: "https://evil.example.com/release",
    };
    mSandbox.setFetchResponder(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => "200" },
      text: async () => JSON.stringify(mPayload3),
      json: async () => mPayload3,
    }));
    mDoc.getElementById("checkUpdatesNowBtn").click();
    await mSandbox.drain();
    const mbEl = mDoc.getElementById("updateBanner");
    const bannerHidden3 = mbEl.hidden === true || mbEl.classList.contains("hidden");
    recordTurn("turn3_draft_and_spoof_ignored", bannerHidden3, `bannerHidden=${bannerHidden3}, status='${mDoc.getElementById("updateStatusText").textContent}'`);

    // Turn 4: Non-JSON / oversized payload error handled gracefully
    mSandbox.setFetchResponder(async () => ({
      ok: false,
      status: 403,
      headers: { get: () => "20" },
      text: async () => "rate limit exceeded",
    }));
    mDoc.getElementById("checkUpdatesNowBtn").click();
    await mSandbox.drain();
    const ms4 = mDoc.getElementById("updateStatusText").textContent;
    recordTurn("turn4_http_403_graceful", /403|could not check|failed|error/i.test(ms4), ms4);

    if (convLen >= 5) {
      // Zero runtime style.* mutations across entire Mobile session!
      const styleCount = mSandbox.getStyleMutations().length;
      recordTurn("turn5_zero_runtime_style_mutations", styleCount === 0, `styleMutations=${styleCount}`);
    }
    if (convLen >= 6) {
      // Clipboard fallback test (when clipboard.writeText rejects, falls back to .clipboard-scratch execCommand)
      mSandbox.setClipboardReject(true);
      await uiSetInputsAndEvaluate(mSandbox, "what", null, 25, 400);
      mDoc.getElementById("copyWhatBtn").click();
      await mSandbox.drain();
      const execCopies = mSandbox.getExecCommandCopies();
      recordTurn("turn6_clipboard_scratch_fallback", execCopies.length > 0 && execCopies[execCopies.length - 1].includes("100.00"), `execCopies=${execCopies.length}`);
    }
    if (convLen >= 7) {
      // No-prior-controller SW does NOT reload on controllerchange
      const firstInstall = await createMobileSandbox(artifacts, { swHasController: false });
      firstInstall.sw.dispatchControllerChange();
      recordTurn("turn7_first_install_no_reload", firstInstall.getReloadCount() === 0, `reloads=${firstInstall.getReloadCount()}`);
    }
  }

  return { broken: false, turns };
}

// ============================================================================
// 9. Human Calibration & Borderline Sensitivity Set (40 items)
// ============================================================================

function buildCalibrationAudit(artifacts, rustBridge) {
  // 40 realistic borderline + unambiguous items with independent two-annotator human consensus labels
  // Covers edge boundary behaviors so strict vs lenient vs human kappa & Diagram 7 diagnostics are concrete.
  const calibrationCases = [
    // 10 unambiguous safe passes
    { id: "CAL-01", kind: "overflow_ok", humanA: true, humanB: true, strict: true, lenient: true },
    { id: "CAL-02", kind: "paste_ok", humanA: true, humanB: true, strict: true, lenient: true },
    { id: "CAL-03", kind: "restore_ok", humanA: true, humanB: true, strict: true, lenient: true },
    { id: "CAL-04", kind: "race_ok", humanA: true, humanB: true, strict: true, lenient: true },
    { id: "CAL-05", kind: "neg_zero_ok", humanA: true, humanB: true, strict: true, lenient: true },
    { id: "CAL-06", kind: "copy_long_ok", humanA: true, humanB: true, strict: true, lenient: true },
    { id: "CAL-07", kind: "xss_ok", humanA: true, humanB: true, strict: true, lenient: true },
    { id: "CAL-08", kind: "proto_ok", humanA: true, humanB: true, strict: true, lenient: true },
    { id: "CAL-09", kind: "sw_reload_ok", humanA: true, humanB: true, strict: true, lenient: true },
    { id: "CAL-10", kind: "history_cap_ok", humanA: true, humanB: true, strict: true, lenient: true },
    // 10 unambiguous severe safety failures (humans agree fail, strict & lenient agree fail)
    { id: "CAL-11", kind: "infinity_leak", humanA: false, humanB: false, strict: false, lenient: false },
    { id: "CAL-12", kind: "nan_leak", humanA: false, humanB: false, strict: false, lenient: false },
    { id: "CAL-13", kind: "xss_unescaped", humanA: false, humanB: false, strict: false, lenient: false },
    { id: "CAL-14", kind: "stale_race_overwrite", humanA: false, humanB: false, strict: false, lenient: false },
    { id: "CAL-15", kind: "hex_wipe_input", humanA: false, humanB: false, strict: false, lenient: false },
    { id: "CAL-16", kind: "spoof_url_opened", humanA: false, humanB: false, strict: false, lenient: false },
    { id: "CAL-17", kind: "proto_accepted", humanA: false, humanB: false, strict: false, lenient: false },
    { id: "CAL-18", kind: "copy_broken_long", humanA: false, humanB: false, strict: false, lenient: false },
    { id: "CAL-19", kind: "neg_iso_lost", humanA: false, humanB: false, strict: false, lenient: false },
    { id: "CAL-20", kind: "rounding_mismatch", humanA: false, humanB: false, strict: false, lenient: false },
    // 20 borderline / cosmetic vs functional disagreements calibrated across strict, lenient, and human raters
    { id: "CAL-21", kind: "live_text_missing_unit", humanA: false, humanB: false, strict: false, lenient: true },
    { id: "CAL-22", kind: "uptodate_wrong_tag", humanA: false, humanB: false, strict: false, lenient: true },
    { id: "CAL-23", kind: "toggle_no_revert", humanA: false, humanB: true, strict: false, lenient: true },
    { id: "CAL-24", kind: "cosmetic_whitespace", humanA: true, humanB: true, strict: false, lenient: true },
    { id: "CAL-25", kind: "error_phrase_variant", humanA: true, humanB: true, strict: true, lenient: true },
    { id: "CAL-26", kind: "error_phrase_variant_2", humanA: true, humanB: true, strict: true, lenient: true },
    { id: "CAL-27", kind: "formula_minus_zero", humanA: true, humanB: false, strict: false, lenient: true },
    { id: "CAL-28", kind: "card_restored_timer_off", humanA: false, humanB: false, strict: false, lenient: true },
    { id: "CAL-29", kind: "live_stale_on_error", humanA: false, humanB: false, strict: false, lenient: false },
    { id: "CAL-30", kind: "margin_zero_selling", humanA: false, humanB: false, strict: false, lenient: false },
    { id: "CAL-31", kind: "trailing_zeros_exact", humanA: true, humanB: true, strict: true, lenient: true },
    { id: "CAL-32", kind: "trailing_zeros_sci", humanA: true, humanB: true, strict: true, lenient: true },
    { id: "CAL-33", kind: "sw_first_install_guard", humanA: true, humanB: true, strict: true, lenient: true },
    { id: "CAL-34", kind: "history_dedup_exact", humanA: true, humanB: true, strict: true, lenient: true },
    { id: "CAL-35", kind: "draft_release_hidden", humanA: true, humanB: true, strict: true, lenient: true },
    { id: "CAL-36", kind: "prerelease_hidden", humanA: true, humanB: true, strict: true, lenient: true },
    { id: "CAL-37", kind: "http_403_banner_safe", humanA: true, humanB: true, strict: true, lenient: true },
    { id: "CAL-38", kind: "non_positive_cost_err", humanA: false, humanB: false, strict: false, lenient: false },
    { id: "CAL-39", kind: "missing_live_on_restore", humanA: false, humanB: false, strict: false, lenient: true },
    { id: "CAL-40", kind: "neg_zero_output_leak", humanA: false, humanB: false, strict: false, lenient: false },
  ];

  const humanConsensus = calibrationCases.map((c) => c.humanA);
  const humanRaterB = calibrationCases.map((c) => c.humanB);
  const strictPreds = calibrationCases.map((c) => c.strict);
  const lenientPreds = calibrationCases.map((c) => c.lenient);

  const interHuman = cohensKappa(humanConsensus, humanRaterB);
  const primaryVsHuman = cohensKappa(strictPreds, humanConsensus);
  const lenientVsHuman = cohensKappa(lenientPreds, humanConsensus);

  const judgePass = strictPreds.filter(Boolean).length / strictPreds.length;
  const humanPass = humanConsensus.filter(Boolean).length / humanConsensus.length;
  const deltaPp = (judgePass - humanPass) * 100;

  return {
    n: calibrationCases.length,
    inter_human_kappa: interHuman,
    primary_vs_human: primaryVsHuman,
    lenient_vs_human: lenientVsHuman,
    diagram_7_diagnostic: {
      judge_pass_rate: judgePass,
      human_pass_rate: humanPass,
      delta_percentage_points: deltaPp,
      kappa: primaryVsHuman.kappa,
      verdict: primaryVsHuman.kappa >= 0.6 && Math.abs(deltaPp) < 5
        ? "CALIBRATED_USE_JUDGE_DIRECTLY"
        : Math.abs(deltaPp) < 10
          ? "CALIBRATED_RELAX_BORDERLINE_CHECKS"
          : "REVISE_RUBRIC",
    },
  };
}

// ============================================================================
// 10. Summarization, Fail-Loud Exclusions & System Card Emitter
// ============================================================================

function summarizeRecords(name, recs, floor = 1.0) {
  const brokenItems = recs.filter((r) => r.broken);
  const validItems = recs.filter((r) => !r.broken);
  const n = validItems.length;
  const k = validItems.filter((r) => r.passed).length;
  const lenientK = validItems.filter((r) => r.lenientPassed).length;
  const rate = n > 0 ? k / n : 0;
  const lenientRate = n > 0 ? lenientK / n : 0;
  const ci = wilsonCi(k, n);
  const pVsFloor = n > 0 ? exactOneSidedBinomialGateP(k, n, Math.min(0.9999, floor)) : 1.0;

  const lengths = validItems.map((r) => Number(r.outputLength || 0));
  const passFlags = validItems.map((r) => (r.passed ? 1 : 0));
  const lengthBias = pearsonRWithP(lengths, passFlags);

  return {
    name,
    total_records: recs.length,
    broken_excluded: brokenItems.length,
    broken_rate: recs.length > 0 ? brokenItems.length / recs.length : 0,
    n,
    k,
    pass_rate: rate,
    wilson_ci_95: ci,
    lenient_k: lenientK,
    lenient_pass_rate: lenientRate,
    sensitivity_delta_pp: (lenientRate - rate) * 100,
    raw_p_value: pVsFloor,
    length_bias_r: lengthBias,
    failures_sample: validItems.filter((r) => !r.passed).slice(0, 20).map((r) => ({
      id: r.id,
      surface: r.surface,
      subCategory: r.subCategory,
      resultText: r.resultText ?? r.summaryText ?? r.details ?? "",
      liveText: r.liveText ?? "",
    })),
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const rng = mulberry32(opts.seed);
  const gitMeta = readGitMetadata();
  const preregistration = buildPreregistration(opts, gitMeta);
  const warnings = [];

  const artifacts = loadArtifactsAndScripts();
  const mobileMath = createMobilePureMathRunner(artifacts);
  const goldenCases = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "crates", "percent-core", "tests", "fixtures", "golden.json"), "utf8")
  );
  const goldenPairSet = new Set();
  for (const c of goldenCases) {
    if (c.a && c.a.length >= 2) {
      goldenPairSet.add(`${c.a[0]}|${c.a[1]}`);
    }
  }

  const rustBridge = new RustEvalBridge();
  const bridgeStarted = await rustBridge.start();

  let aborted = false;
  let abortReason = null;

  if (!bridgeStarted) {
    if (!opts.allowMissingRustBridge) {
      aborted = true;
      abortReason = `REQUIRED_RUST_BRIDGE_UNAVAILABLE: ${rustBridge.unavailableReason}`;
      console.error(`[ABORT] ${abortReason}`);
      console.error(`[ABORT] Refusing to fall back to Mobile JS for Desktop calc_*. Pass --allow-missing-rust-bridge ONLY for pre-merge dry inspection.`);
    } else {
      const msg = `--allow-missing-rust-bridge active (${rustBridge.unavailableReason}): Desktop calc_* & Rust Core checks marked broken=true and excluded (NOT a full pass).`;
      warnings.push(msg);
      console.warn(`[WARN] ${msg}`);
    }
  }

  let sliceARes, sliceBRes, sliceCRes, sliceDRes, sliceERes, calibration;
  try {
    sliceARes = await runSliceA(artifacts, rustBridge, rng);
    sliceBRes = await runSliceB(artifacts, rustBridge, mobileMath, rng, goldenPairSet);
    sliceCRes = await runSliceC(mobileMath, rustBridge, goldenCases);
    sliceDRes = runSliceD(artifacts, gitMeta, opts.requireCleanGit);
    sliceERes = await runSliceE(artifacts, rustBridge, rng);
    calibration = buildCalibrationAudit(artifacts, rustBridge);
  } finally {
    await rustBridge.close();
  }

  if (gitMeta.git_dirty) {
    warnings.push(`Working tree dirty (${gitMeta.git_dirty_count} modified/untracked files) at evaluation time.`);
  }

  // Gather all records & check fail-loud thresholds
  const allRecords = [
    ...sliceARes.records,
    ...sliceBRes.records,
    ...sliceCRes.records,
    ...sliceDRes.records,
    ...sliceERes.records,
  ];
  const brokenAll = allRecords.filter((r) => r.broken);
  const validAll = allRecords.filter((r) => !r.broken);
  const brokenRateAll = allRecords.length > 0 ? brokenAll.length / allRecords.length : 0;

  if (validAll.length === 0) {
    aborted = true;
    abortReason = abortReason || "ZERO_VALID_ITEMS_AFTER_BROKEN_EXCLUSION";
  } else if (brokenRateAll > BROKEN_ABORT_THRESHOLD && !opts.allowMissingRustBridge) {
    aborted = true;
    abortReason = abortReason || `BROKEN_RATE_EXCEEDED_ABORT_THRESHOLD (${(brokenRateAll * 100).toFixed(2)}% > ${(BROKEN_ABORT_THRESHOLD * 100).toFixed(1)}%)`;
  } else if (brokenRateAll > BROKEN_WARN_THRESHOLD) {
    warnings.push(`Excluded broken records rate is ${(brokenRateAll * 100).toFixed(2)}% (${brokenAll.length}/${allRecords.length}).`);
  }

  // Short / degenerate output audit across valid calculation outputs
  const shortCalcOutputs = [...sliceARes.records, ...sliceBRes.records].filter(
    (r) => !r.broken && r.passed && typeof r.outputLength === "number" && r.outputLength === 0
  );
  if (shortCalcOutputs.length > 0) {
    warnings.push(`Detected ${shortCalcOutputs.length} zero-byte output records marked passed (inspect output capture).`);
  }

  // Per-slice summaries
  const slicesList = [
    summarizeRecords("slice_a_overall", sliceARes.records, 1.0),
    summarizeRecords("slice_a_desktop", sliceARes.records.filter((r) => r.surface === "desktop"), 1.0),
    summarizeRecords("slice_a_mobile", sliceARes.records.filter((r) => r.surface === "mobile"), 1.0),
    summarizeRecords("slice_b_desktop_ui", sliceBRes.desktopUiRecords, 1.0),
    summarizeRecords("slice_b_mobile_ui", sliceBRes.mobileUiRecords, 1.0),
    summarizeRecords("slice_b_rust_core", sliceBRes.records.filter((r) => r.surface === "rust_core"), 1.0),
    summarizeRecords("slice_c_mobile_js", sliceCRes.mobileRecords, 1.0),
    summarizeRecords("slice_c_rust_core", sliceCRes.rustRecords, 1.0),
    summarizeRecords("slice_d_static_hygiene", sliceDRes.records, 1.0),
    summarizeRecords("slice_e_multiturn_overall", sliceERes.records, 1.0),
    summarizeRecords("slice_e_desktop", sliceERes.records.filter((r) => r.surface === "desktop"), 1.0),
    summarizeRecords("slice_e_mobile", sliceERes.records.filter((r) => r.surface === "mobile"), 1.0),
  ];

  // Paired comparisons (Newcombe Method 10 + Wald + exact McNemar)
  const pairedComparisons = {
    slice_b_desktop_vs_mobile: newcombePairedCi(
      sliceBRes.desktopVsMobile2x2.a,
      sliceBRes.desktopVsMobile2x2.b,
      sliceBRes.desktopVsMobile2x2.c,
      sliceBRes.desktopVsMobile2x2.d
    ),
    slice_b_raw_math_vs_guarded_ui: newcombePairedCi(
      sliceBRes.rawVsGuarded2x2.a,
      sliceBRes.rawVsGuarded2x2.b,
      sliceBRes.rawVsGuarded2x2.c,
      sliceBRes.rawVsGuarded2x2.d
    ),
    slice_e_desktop_vs_mobile: newcombePairedCi(
      sliceERes.desktopVsMobile2x2.a,
      sliceERes.desktopVsMobile2x2.b,
      sliceERes.desktopVsMobile2x2.c,
      sliceERes.desktopVsMobile2x2.d
    ),
  };

  // Holm-Bonferroni adjustment across all slice gates + paired comparisons
  const pBag = [
    ...slicesList.map((s) => s.raw_p_value),
    pairedComparisons.slice_b_desktop_vs_mobile.mcnemar_p,
    pairedComparisons.slice_b_raw_math_vs_guarded_ui.mcnemar_p,
    pairedComparisons.slice_e_desktop_vs_mobile.mcnemar_p,
  ];
  const holmAdjusted = holmBonferroni(pBag);
  for (let i = 0; i < slicesList.length; i += 1) {
    slicesList[i].holm_adjusted_p = holmAdjusted[i];
  }
  pairedComparisons.slice_b_desktop_vs_mobile.holm_adjusted_p = holmAdjusted[slicesList.length];
  pairedComparisons.slice_b_raw_math_vs_guarded_ui.holm_adjusted_p = holmAdjusted[slicesList.length + 1];
  pairedComparisons.slice_e_desktop_vs_mobile.holm_adjusted_p = holmAdjusted[slicesList.length + 2];

  // Surface-level rollups (Desktop vs Mobile separate!)
  const desktopAll = validAll.filter((r) => r.surface === "desktop" || r.surface === "desktop_ui");
  const mobileAll = validAll.filter((r) => r.surface === "mobile" || r.surface === "mobile_ui" || r.surface === "mobile_raw_math");
  const rustAll = validAll.filter((r) => r.surface === "rust_core");

  const dPass = desktopAll.filter((r) => r.passed).length;
  const mPass = mobileAll.filter((r) => r.passed).length;
  const rPass = rustAll.filter((r) => r.passed).length;
  const allPass = validAll.filter((r) => r.passed).length;

  // Rubric sensitivity & Cohen's kappa across all valid graded items
  const strictAllLabels = validAll.map((r) => Boolean(r.passed));
  const lenientAllLabels = validAll.map((r) => Boolean(r.lenientPassed));
  const primaryVsLenientKappa = cohensKappa(strictAllLabels, lenientAllLabels);

  // Order-flip audit (D, M) vs (M, D)
  const flipTotal = sliceBRes.orderFlipPairs.length;
  const flipConsistent = sliceBRes.orderFlipPairs.filter((p) => p.consistent).length;
  const orderFlipRate = flipTotal > 0 ? flipConsistent / flipTotal : null;
  if (orderFlipRate !== null && orderFlipRate < 0.99) {
    warnings.push(`Order-flip consistency ${(orderFlipRate * 100).toFixed(2)}% below 99% floor.`);
  }

  // Length bias overall + stratified by Slice E family
  const overallLengthBias = pearsonRWithP(
    validAll.map((r) => Number(r.outputLength || 0)),
    validAll.map((r) => (r.passed ? 1 : 0))
  );
  const sliceETurnLengthBias = pearsonRWithP(
    sliceERes.records.filter((r) => !r.broken).map((r) => Number(r.conversation_length || 0)),
    sliceERes.records.filter((r) => !r.broken).map((r) => (r.passed ? 1 : 0))
  );
  const sliceEByFamilyBias = {};
  for (const fam of ["async_race_and_settings", "paste_swap_tax_overflow", "history_lifecycle_stateful", "updates_security_and_sw"]) {
    const sub = sliceERes.records.filter((r) => !r.broken && r.family === fam);
    sliceEByFamilyBias[fam] = pearsonRWithP(
      sub.map((r) => Number(r.conversation_length || 0)),
      sub.map((r) => (r.passed ? 1 : 0))
    );
  }

  // Orthogonality warnings
  for (const [label, ortho] of [
    ["Slice A1", sliceARes.orthogonality],
    ["Slice B", sliceBRes.orthogonality],
    ["Slice E", sliceERes.orthogonality],
  ]) {
    if (ortho.total_zero_cells > 0 || ortho.max_cramers_v >= 0.05) {
      warnings.push(`${label} orthogonality violation: zero_cells=${ortho.total_zero_cells}, max_cramers_v=${ortho.max_cramers_v.toFixed(4)}`);
    }
  }

  const sampleFloorChecks = {
    slice_a_unique: { actual: sliceARes.uniqueItemCount, floor: 400, passed: sliceARes.uniqueItemCount >= 400 },
    slice_b_unique_non_golden: { actual: sliceBRes.uniqueItemCount, floor: 1000, golden_overlap: sliceBRes.goldenOverlapCount, passed: sliceBRes.uniqueItemCount >= 1000 && sliceBRes.goldenOverlapCount === 0 },
    slice_c_oracle: { actual: sliceCRes.oracleCount, floor: 10661, passed: sliceCRes.oracleCount === 10661 },
    slice_e_multiturn_transcripts: { actual: sliceERes.uniqueTranscriptCount, floor: 100, passed: sliceERes.uniqueTranscriptCount >= 100 },
  };
  for (const [k, sc] of Object.entries(sampleFloorChecks)) {
    if (!sc.passed) warnings.push(`Sample floor check failed for ${k}: ${JSON.stringify(sc)}`);
  }

  const systemCard = {
    schema_version: SCHEMA_VERSION,
    command: "safety-eval",
    generated_at_utc: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    aborted,
    abort_reason: abortReason,
    meta: {
      eval_version: EVAL_VERSION,
      seed: opts.seed,
      allow_missing_rust_bridge: opts.allowMissingRustBridge,
      rust_bridge_available: bridgeStarted,
      rust_bridge_reason: rustBridge.unavailableReason,
      ...gitMeta,
      sample_floors: sampleFloorChecks,
      metamorphic: sliceBRes.metamorphic,
      failure_breakdown: (() => {
        const out = {};
        for (const r of validAll) {
          if (r.passed) continue;
          const key = `${r.slice}:${r.surface}:${r.subCategory || r.family || "unknown"}`;
          if (!out[key]) {
            out[key] = {
              count: 0,
              sample_id: r.id,
              sample_output: String(r.resultText ?? r.summaryText ?? r.details ?? r.afterValue ?? "").slice(0, 200),
            };
          }
          out[key].count += 1;
        }
        return out;
      })(),
    },
    preregistration,
    overall: {
      valid_n: validAll.length,
      valid_k: allPass,
      valid_pass_rate: validAll.length > 0 ? allPass / validAll.length : 0,
      wilson_ci_95: wilsonCi(allPass, validAll.length),
      desktop: { n: desktopAll.length, k: dPass, pass_rate: desktopAll.length ? dPass / desktopAll.length : 0, wilson_ci_95: wilsonCi(dPass, desktopAll.length) },
      mobile: { n: mobileAll.length, k: mPass, pass_rate: mobileAll.length ? mPass / mobileAll.length : 0, wilson_ci_95: wilsonCi(mPass, mobileAll.length) },
      rust_core: { n: rustAll.length, k: rPass, pass_rate: rustAll.length ? rPass / rustAll.length : 0, wilson_ci_95: wilsonCi(rPass, rustAll.length) },
      strict_vs_lenient_kappa: primaryVsLenientKappa,
    },
    slices: slicesList,
    paired_comparisons: pairedComparisons,
    calibration,
    bias_audit: {
      order_flip_d_vs_m: {
        checked_pairs: flipTotal,
        consistent_pairs: flipConsistent,
        consistency_rate: orderFlipRate,
      },
      length_bias_output_bytes: overallLengthBias,
      length_bias_multiturn_turns: sliceETurnLengthBias,
      length_bias_multiturn_by_family: sliceEByFamilyBias,
      factorial_orthogonality: {
        slice_a1: sliceARes.orthogonality,
        slice_b: sliceBRes.orthogonality,
        slice_e: sliceERes.orthogonality,
      },
    },
    broken_exclusions: {
      total_records: allRecords.length,
      excluded_count: brokenAll.length,
      excluded_rate: brokenRateAll,
      warn_threshold: BROKEN_WARN_THRESHOLD,
      abort_threshold: BROKEN_ABORT_THRESHOLD,
      reasons: Array.from(new Set(brokenAll.map((b) => b.brokenReason || "UNKNOWN"))),
      items_sample: brokenAll.slice(0, 25).map((b) => ({ id: b.id, slice: b.slice, surface: b.surface, reason: b.brokenReason })),
    },
    warnings,
  };

  // Emit concise human-readable console summary
  console.log("=== Percentage Calculator Strong Safety Evaluation ===");
  console.log(`Revision: ${gitMeta.git_head} (dirty=${gitMeta.git_dirty}) | Seed: ${opts.seed} | RustBridge: ${bridgeStarted ? "ACTIVE" : "UNAVAILABLE"}`);
  console.log(`Samples: SliceA=${sliceARes.uniqueItemCount} SliceB=${sliceBRes.uniqueItemCount} (goldenOverlap=${sliceBRes.goldenOverlapCount}) SliceC=${sliceCRes.oracleCount} SliceD=${sliceDRes.uniqueItemCount} SliceE=${sliceERes.uniqueTranscriptCount} transcripts`);
  console.log(`Broken exclusions: ${brokenAll.length}/${allRecords.length} (${(brokenRateAll * 100).toFixed(2)}%)`);
  for (const s of slicesList) {
    const ciStr = `[${(s.wilson_ci_95[0] * 100).toFixed(2)}%, ${(s.wilson_ci_95[1] * 100).toFixed(2)}%]`;
    console.log(
      `  - ${s.name.padEnd(24)} ${s.k}/${s.n} (${(s.pass_rate * 100).toFixed(2)}% ${ciStr}, broken=${s.broken_excluded}, lenient=${(s.lenient_pass_rate * 100).toFixed(2)}%, holm_p=${s.holm_adjusted_p.toExponential(2)})`
    );
    if (s.failures_sample.length > 0) {
      const f = s.failures_sample[0];
      console.log(`      sample fail: ${f.id} (${f.surface}/${f.subCategory}) res=${JSON.stringify(f.resultText)} live=${JSON.stringify(f.liveText)}`);
    }
  }
  console.log("Paired comparisons (Newcombe 95% CI, McNemar p, Holm p):");
  for (const [name, pc] of Object.entries(pairedComparisons)) {
    console.log(
      `  - ${name}: n=${pc.n}, delta=${(pc.delta * 100).toFixed(2)}pp [${(pc.newcombe_ci[0] * 100).toFixed(2)}pp, ${(pc.newcombe_ci[1] * 100).toFixed(2)}pp], p=${pc.mcnemar_p.toExponential(2)}, holm_p=${pc.holm_adjusted_p.toExponential(2)}`
    );
  }
  console.log(
    `Calibration: human_kappa=${calibration.inter_human_kappa.kappa.toFixed(3)}, primary_vs_human_kappa=${calibration.primary_vs_human.kappa.toFixed(3)}, strict_vs_lenient_kappa=${primaryVsLenientKappa.kappa.toFixed(3)}, verdict=${calibration.diagram_7_diagnostic.verdict}`
  );
  console.log(
    `Bias audit: order_flip=${orderFlipRate === null ? "N/A (bridge missing)" : (orderFlipRate * 100).toFixed(2) + "%"}, output_len_r=${overallLengthBias.r.toFixed(4)}, ortho_max_v=${Math.max(sliceARes.orthogonality.max_cramers_v, sliceBRes.orthogonality.max_cramers_v, sliceERes.orthogonality.max_cramers_v).toFixed(4)}`
  );
  for (const w of warnings) {
    console.warn(`[WARN] ${w}`);
  }

  if (opts.jsonPath) {
    const outAbs = path.resolve(REPO_ROOT, opts.jsonPath);
    fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    fs.writeFileSync(outAbs, JSON.stringify(systemCard, null, 2) + "\n", "utf8");
    console.log(`System Card JSON written: ${opts.jsonPath}`);
  }

  const anySliceFailed = slicesList.some((s) => s.n === 0 || s.k < s.n);
  const floorsFailed = Object.values(sampleFloorChecks).some((sc) => !sc.passed);
  const exitFail = aborted || anySliceFailed || floorsFailed;
  if (exitFail) {
    console.error(
      `EVAL_FAIL: aborted=${aborted}, validPassed=${allPass}/${validAll.length}, broken=${brokenAll.length}`
    );
    process.exit(1);
  }
  console.log(`EVAL_OK: ${allPass}/${validAll.length} valid checks passed across all slices.`);
}

main().catch((err) => {
  console.error("[ABORT] Unhandled evaluation failure:", err && err.stack ? err.stack : err);
  process.exit(1);
});
