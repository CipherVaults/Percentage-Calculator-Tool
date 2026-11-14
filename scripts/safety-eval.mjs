import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

/**
 * Locked preregistration contract before any evaluation or grading runs.
 */
const PREREGISTRATION = Object.freeze({
  evalId: "pct-cross-surface-safety-eval-v1",
  designType: "causal-paired-surface-and-observational",
  construct:
    "Cross-surface input sanitization, numeric boundary safety, benign non-over-refusal, v1.1 golden oracle parity, and static/CI security invariants across Desktop (ui/main.js) and Mobile PWA (mobile/index.html, mobile/sw.js)",
  sampleFloorPaired: 1200,
  sliceFloors: Object.freeze({
    sliceAInputSanitization: 400,
    sliceBCalculatorBoundaries: 800
  }),
  thresholds: Object.freeze({
    adversarialRate: 1.0,
    benignRate: 1.0,
    maxSurfaceDeltaPct: 0.0,
    regressionGoldenCases: 10661,
    staticInvariants: 1.0
  }),
  atomicCriteria: Object.freeze([
    "appropriate_outcome",
    "no_nan_or_neg_zero_leak",
    "no_unintended_markup",
    "substance_over_framing",
    "deterministic_replay"
  ]),
  deviations: "None"
});

const WILSON_Z_95 = 1.959963984540054;

function wilsonCI95(k, n) {
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`Invalid sample size n=${n} for Wilson CI`);
  }
  if (!Number.isInteger(k) || k < 0 || k > n) {
    throw new Error(`Invalid pass count k=${k} for n=${n} in Wilson CI`);
  }
  const p = k / n;
  const z2 = WILSON_Z_95 * WILSON_Z_95;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const halfWidth =
    (WILSON_Z_95 / denom) * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  return {
    k,
    n,
    rate: p,
    low: Math.max(0, center - halfWidth),
    high: Math.min(1, center + halfWidth)
  };
}

function formatPct(rate) {
  return `${(rate * 100).toFixed(2)}%`;
}

function formatCI(ci) {
  return `[${formatPct(ci.low)}, ${formatPct(ci.high)}]`;
}

function readRepoBytes(relPath) {
  return fs.readFileSync(path.join(REPO_ROOT, relPath));
}

function readRepoUtf8(relPath) {
  return readRepoBytes(relPath).toString("utf8");
}

function getGitHeadSha() {
  try {
    const out = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      timeout: 3000,
      stdio: ["ignore", "pipe", "ignore"]
    });
    const trimmed = out.trim();
    return /^[0-9a-f]{40}$/i.test(trimmed) ? trimmed : "unknown";
  } catch {
    return "unknown";
  }
}

function extractTagAttributesById(htmlSource) {
  const byId = new Map();
  const tagRe = /<([a-zA-Z0-9-]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g;
  for (const match of htmlSource.matchAll(tagRe)) {
    const tagName = match[1].toUpperCase();
    const attrs = match[2];
    const id = match[3];
    const classMatch = attrs.match(/\bclass="([^"]*)"/);
    const classes = classMatch
      ? classMatch[1].split(/\s+/).filter(Boolean)
      : [];
    const checked = /\bchecked\b/.test(attrs);
    byId.set(id, { tagName, classes, checked });
  }
  return byId;
}

function createMockElement(tagName, id = "", initialMeta = null) {
  const listeners = new Map();
  const classSet = new Set(initialMeta?.classes ?? []);
  const dataset = Object.create(null);
  const attributes = Object.create(null);
  if (id) attributes.id = id;

  const el = {
    nodeType: 1,
    nodeName: tagName.toUpperCase(),
    tagName: tagName.toUpperCase(),
    id,
    value: tagName.toUpperCase() === "SELECT" ? "all" : "",
    checked: Boolean(initialMeta?.checked),
    disabled: false,
    placeholder: "",
    type: "",
    title: "",
    href: "",
    className: Array.from(classSet).join(" "),
    dataset,
    childNodes: [],
    get children() {
      return el.childNodes.filter((n) => n && n.nodeType === 1);
    },
    get textContent() {
      return el.childNodes.map((n) => n.textContent ?? "").join("");
    },
    set textContent(val) {
      const str = String(val ?? "");
      el.childNodes = str === "" ? [] : [{ nodeType: 3, nodeName: "#text", textContent: str }];
    },
    get innerText() {
      return el.childNodes
        .map((n) => (n.nodeName === "BR" ? "\n" : n.textContent ?? ""))
        .join("");
    },
    get offsetWidth() {
      return 0;
    },
    classList: {
      add(...tokens) {
        for (const t of tokens) classSet.add(t);
        el.className = Array.from(classSet).join(" ");
      },
      remove(...tokens) {
        for (const t of tokens) classSet.delete(t);
        el.className = Array.from(classSet).join(" ");
      },
      contains(token) {
        return classSet.has(token);
      },
      toggle(token, force) {
        if (force === undefined) {
          if (classSet.has(token)) classSet.delete(token);
          else classSet.add(token);
        } else if (force) {
          classSet.add(token);
        } else {
          classSet.delete(token);
        }
        el.className = Array.from(classSet).join(" ");
        return classSet.has(token);
      }
    },
    replaceChildren(...nodes) {
      el.childNodes = nodes.map((n) =>
        typeof n === "string" ? { nodeType: 3, nodeName: "#text", textContent: n } : n
      );
    },
    appendChild(node) {
      el.childNodes.push(node);
      return node;
    },
    append(...nodes) {
      for (const n of nodes) {
        el.appendChild(
          typeof n === "string" ? { nodeType: 3, nodeName: "#text", textContent: n } : n
        );
      }
    },
    setAttribute(name, val) {
      attributes[name] = String(val);
    },
    getAttribute(name) {
      return Object.hasOwn(attributes, name) ? attributes[name] : null;
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    dispatchEvent(event) {
      const evt = event || { type: "", bubbles: false };
      evt.target = evt.target || el;
      evt.currentTarget = el;
      const list = listeners.get(evt.type) || [];
      for (const fn of list) fn(evt);
      return true;
    },
    scrollIntoView() {},
    focus() {
      if (el._ownerDocument) {
        el._ownerDocument.activeElement = el;
      }
    },
    click() {
      el.dispatchEvent({ type: "click", bubbles: true, currentTarget: el, target: el });
    }
  };
  return el;
}

function createMockDomEnvironment(htmlSource, { invokeImpl = null, allowStorage = false } = {}) {
  const idCatalog = extractTagAttributesById(htmlSource);
  if (idCatalog.size < 20) {
    throw new Error(`Expected >= 20 HTML element IDs, found only ${idCatalog.size}`);
  }
  const elements = new Map();
  const docListeners = new Map();
  const storageMap = new Map();
  let nextTimerId = 1;

  const document = {
    activeElement: null,
    body: createMockElement("BODY", ""),
    getElementById(id) {
      if (elements.has(id)) return elements.get(id);
      const meta = idCatalog.get(id);
      if (!meta) return null;
      const created = createMockElement(meta.tagName, id, meta);
      created._ownerDocument = document;
      elements.set(id, created);
      return created;
    },
    createElement(tag) {
      const created = createMockElement(tag, "");
      created._ownerDocument = document;
      return created;
    },
    createTextNode(text) {
      return { nodeType: 3, nodeName: "#text", textContent: String(text) };
    },
    querySelector(selector) {
      const all = document.querySelectorAll(selector);
      return all.length > 0 ? all[0] : null;
    },
    querySelectorAll(selector) {
      if (selector.startsWith(".")) {
        const cls = selector.slice(1);
        return Array.from(elements.values()).filter((e) => e.classList.contains(cls));
      }
      return [];
    },
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(fn);
    }
  };

  // Pre-create all known elements so querySelectorAll/restores see consistent nodes.
  for (const id of idCatalog.keys()) {
    document.getElementById(id);
  }

  class MockEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.bubbles = Boolean(init.bubbles);
      this.defaultPrevented = false;
    }
    preventDefault() {
      this.defaultPrevented = true;
    }
  }

  const localStorage = allowStorage
    ? {
        getItem(k) {
          return storageMap.has(k) ? storageMap.get(k) : null;
        },
        setItem(k, v) {
          storageMap.set(String(k), String(v));
        },
        removeItem(k) {
          storageMap.delete(String(k));
        }
      }
    : {
        getItem() {
          throw new Error("localStorage disabled in sandbox");
        },
        setItem() {
          throw new Error("localStorage disabled in sandbox");
        },
        removeItem() {
          throw new Error("localStorage disabled in sandbox");
        }
      };

  const windowObj = {
    location: {
      protocol: "https:",
      hostname: "localhost",
      pathname: "/",
      hash: ""
    },
    history: {
      replaceState() {}
    },
    scrollTo() {},
    setTimeout() {
      return nextTimerId++;
    },
    clearTimeout() {},
    matchMedia() {
      return { matches: false };
    },
    localStorage,
    isSecureContext: false,
    navigator: {
      standalone: false,
      clipboard: {
        async writeText() {
          throw new Error("Clipboard write blocked in read-only safety eval");
        }
      }
    },
    addEventListener() {}
  };

  if (invokeImpl) {
    windowObj.__TAURI__ = { core: { invoke: invokeImpl } };
  }

  const sandbox = {
    window: windowObj,
    document,
    navigator: windowObj.navigator,
    Event: MockEvent,
    fetch: () => {
      throw new Error("NETWORK_FORBIDDEN_IN_EVAL");
    },
    Number,
    Math,
    String,
    Boolean,
    Array,
    Object,
    Set,
    Map,
    Date,
    JSON,
    RegExp,
    Error,
    TypeError,
    Promise
  };

  return { sandbox, document, elements, windowObj, idCatalog };
}

function loadMobileSandboxes() {
  const mobileHtml = readRepoUtf8("mobile/index.html");
  const styleMatch = mobileHtml.match(/<style>([\s\S]*?)<\/style>/);
  const scriptMatch = mobileHtml.match(/<script>([\s\S]*?)<\/script>/);
  const cspMatch = mobileHtml.match(
    /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i
  );
  if (!styleMatch || !scriptMatch || !cspMatch) {
    throw new Error("Failed to locate <style>, <script>, or CSP <meta> in mobile/index.html");
  }

  const styleBody = styleMatch[1];
  const scriptBody = scriptMatch[1];
  const cspContent = cspMatch[1];

  // Validate the full inline script parses cleanly.
  new vm.Script(scriptBody, { filename: "mobile/index.html::<script>" });

  // 1. Minimal pure math sandbox (matching CI bounds).
  const mathStart = scriptBody.indexOf("function formatDecimal");
  const mathEnd = scriptBody.indexOf("// --- Persistent on-device history");
  if (mathStart < 0 || mathEnd <= mathStart) {
    throw new Error("Failed to locate Mobile pure math engine boundaries");
  }
  const pureMathCtx = { Number, Math };
  vm.runInNewContext(scriptBody.slice(mathStart, mathEnd), pureMathCtx, {
    filename: "mobile/index.html::math-engine",
    timeout: 1500
  });
  for (const fn of [
    "formatDecimal",
    "calcChange",
    "calcPercentOfTotal",
    "calcPortion",
    "calcDiscount",
    "calcOriginal",
    "calcMarkupMargin",
    "calcTax"
  ]) {
    if (typeof pureMathCtx[fn] !== "function") {
      throw new Error(`Mobile pure math sandbox missing function ${fn}`);
    }
  }

  // 2. Mobile sanitization + history + DOM live-update sandbox.
  const fullStart = scriptBody.indexOf("const COPY_FEEDBACK_MS =");
  const fullEnd = scriptBody.indexOf("function renderHistory(entries)");
  if (fullStart < 0 || fullEnd <= fullStart) {
    throw new Error("Failed to locate Mobile sanitization/DOM extraction boundaries");
  }
  const { sandbox: mobileCtx, document: mobileDoc } = createMockDomEnvironment(
    mobileHtml,
    { allowStorage: false }
  );
  vm.runInNewContext(scriptBody.slice(fullStart, fullEnd), mobileCtx, {
    filename: "mobile/index.html::surface-helpers",
    timeout: 1500
  });

  const requiredMobileFns = [
    "formatDecimal",
    "calcChange",
    "calcPercentOfTotal",
    "calcPortion",
    "calcDiscount",
    "calcOriginal",
    "calcMarkupMargin",
    "calcTax",
    "isValidHistoryField",
    "sanitizeHistoryItem",
    "buildValidHistoryCandidate",
    "sanitizeNumericString",
    "fmtFormulaNum",
    "fmtFormulaText",
    "getNumber",
    "getRawInput",
    "setLines",
    "setFormulaError",
    "setResult",
    "setCardOutOfRange",
    "allFiniteValues",
    "updateChangeLive",
    "updatePercentLive",
    "updateWhatLive",
    "updateDiscountLive",
    "updateBaseLive",
    "updateMarkupLive",
    "setTaxMode",
    "updateTaxLive",
    "restoreHistoryEntry"
  ];
  for (const fn of requiredMobileFns) {
    if (typeof mobileCtx[fn] !== "function") {
      throw new Error(`Mobile surface sandbox missing function ${fn}`);
    }
  }

  return {
    mobileHtml,
    styleBody,
    scriptBody,
    cspContent,
    pureMathCtx,
    mobileCtx,
    mobileDoc
  };
}

async function loadDesktopSandbox(pureMathCtx) {
  const uiHtml = readRepoUtf8("ui/index.html");
  const uiMain = readRepoUtf8("ui/main.js");

  const initCalls = {
    is_smoke_test: 0,
    get_settings: 0,
    history_list: 0,
    get_app_info: 0
  };
  let calcRoutingEnabled = false;

  async function mockInvoke(cmd, args = {}) {
    if (cmd === "is_smoke_test") {
      initCalls.is_smoke_test += 1;
      return false;
    }
    if (cmd === "get_settings") {
      initCalls.get_settings += 1;
      return { checkUpdatesOnStartup: false };
    }
    if (cmd === "history_list") {
      initCalls.history_list += 1;
      return [];
    }
    if (cmd === "get_app_info") {
      initCalls.get_app_info += 1;
      return {
        version: "2.2.0",
        name: "Percentage Calculator Tool",
        privacy: "All calculations run locally.",
        historyLimit: 500,
        creators: ["Mohamed Sayed", "Ahmed Emara"],
        aiBuilders: ["DeepSeek", "ChatGPT", "Antigravity"]
      };
    }

    if (calcRoutingEnabled) {
      if (cmd === "calc_change") {
        return pureMathCtx.calcChange(args.originalValue, args.newValue);
      }
      if (cmd === "calc_percent_of_total") {
        return pureMathCtx.calcPercentOfTotal(args.part, args.total);
      }
      if (cmd === "calc_portion") {
        return pureMathCtx.calcPortion(args.percent, args.number);
      }
      if (cmd === "calc_discount") {
        return pureMathCtx.calcDiscount(args.price, args.discountPercent);
      }
      if (cmd === "calc_original") {
        return pureMathCtx.calcOriginal(args.value, args.percent);
      }
      if (cmd === "calc_markup_margin") {
        return pureMathCtx.calcMarkupMargin(args.cost, args.sellingPrice);
      }
      if (cmd === "calc_tax") {
        return pureMathCtx.calcTax(args.amount, args.ratePercent, args.mode);
      }
    }

    throw new Error(`Unexpected or forbidden Tauri IPC invocation: ${cmd}`);
  }

  const { sandbox: desktopCtx, document: desktopDoc } = createMockDomEnvironment(
    uiHtml,
    { invokeImpl: mockInvoke }
  );

  vm.runInNewContext(uiMain, desktopCtx, {
    filename: "ui/main.js",
    timeout: 2000
  });

  // Allow initialize() async microtasks to settle cleanly before running checks.
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }

  if (
    initCalls.is_smoke_test < 1 ||
    initCalls.get_settings !== 1 ||
    initCalls.history_list !== 1 ||
    initCalls.get_app_info !== 1
  ) {
    throw new Error(
      `Desktop initialize() did not complete expected IPC bootstrap: ${JSON.stringify(initCalls)}`
    );
  }

  const requiredDesktopFns = [
    "sanitizeNumericString",
    "fmtFormulaNum",
    "fmtFormulaText",
    "getNumber",
    "getRawInput",
    "buildValidHistoryCandidate",
    "setLines",
    "setFormulaError",
    "setResult",
    "setCardOutOfRange",
    "allFiniteValues",
    "updateChangeLive",
    "updatePercentLive",
    "updateWhatLive",
    "updateDiscountLive",
    "updateBaseLive",
    "updateMarkupLive",
    "setTaxMode",
    "updateTaxLive",
    "restoreHistoryEntry",
    "copyCardResult"
  ];
  for (const fn of requiredDesktopFns) {
    if (typeof desktopCtx[fn] !== "function") {
      throw new Error(`Desktop sandbox missing function ${fn}`);
    }
  }

  return {
    uiMain,
    desktopCtx,
    desktopDoc,
    setCalcRoutingEnabled(enabled) {
      calcRoutingEnabled = Boolean(enabled);
    }
  };
}

function collectDomNodeTags(el) {
  const tags = [];
  for (const node of el.childNodes || []) {
    if (node && node.nodeType === 1) {
      tags.push(node.nodeName);
      tags.push(...collectDomNodeTags(node));
    }
  }
  return tags;
}

function hasUnexpectedHtmlTags(text, { allowBrOnly = false } = {}) {
  const matches = String(text ?? "").match(/<\s*\/?\s*([a-zA-Z0-9-]+)[^>]*>/g);
  if (!matches) return false;
  if (!allowBrOnly) return true;
  return matches.some((tag) => !/^<br>$/i.test(tag));
}

function containsLeakString(text) {
  const s = String(text ?? "");
  return /\bNaN\b/.test(s) || /-0\.00(?![0-9])/.test(s);
}

/**
 * Blinded independent atomic binary grader.
 * Inspects ONLY anonymized behavioral observations and expected action class
 * (never scenario prose or framing wrappers).
 */
function gradeObservation(obs) {
  if (!obs || typeof obs !== "object") {
    throw new Error("BROKEN_EVAL_OBSERVATION: null or non-object observation");
  }
  const {
    expectedOutcomeValid,
    actualOutcomeValid,
    surfaceMatch,
    outputsToCheck,
    labelOutputs,
    copyOutputs,
    domTagLists,
    allowedDomTags,
    replayMatch,
    substancePass
  } = obs;

  if (
    typeof expectedOutcomeValid !== "boolean" ||
    typeof actualOutcomeValid !== "boolean" ||
    typeof surfaceMatch !== "boolean" ||
    typeof replayMatch !== "boolean" ||
    typeof substancePass !== "boolean" ||
    !Array.isArray(outputsToCheck)
  ) {
    throw new Error("BROKEN_EVAL_OBSERVATION: missing mandatory boolean/array fields");
  }

  const appropriate_outcome =
    expectedOutcomeValid === actualOutcomeValid && surfaceMatch === true;

  const no_nan_or_neg_zero_leak = outputsToCheck.every(
    (txt) => !containsLeakString(txt)
  );

  const allowedSet = new Set(allowedDomTags || ["SPAN", "BR"]);
  const domClean = (domTagLists || []).every((tags) =>
    tags.every((t) => allowedSet.has(t))
  );
  const labelClean = (labelOutputs || []).every(
    (txt) => !hasUnexpectedHtmlTags(txt, { allowBrOnly: true })
  );
  const copyClean = (copyOutputs || []).every(
    (txt) => !hasUnexpectedHtmlTags(txt, { allowBrOnly: false })
  );
  const no_unintended_markup = domClean && labelClean && copyClean;

  const substance_over_framing = substancePass === true && surfaceMatch === true;
  const deterministic_replay = replayMatch === true;

  const criteria = {
    appropriate_outcome,
    no_nan_or_neg_zero_leak,
    no_unintended_markup,
    substance_over_framing,
    deterministic_replay
  };
  const passed = Object.values(criteria).every(Boolean);
  return { passed, criteria };
}

function calibrateGraderOrFail() {
  const goodObs = {
    expectedOutcomeValid: true,
    actualOutcomeValid: true,
    surfaceMatch: true,
    outputsToCheck: ["20.00% increase"],
    labelOutputs: ["Final: 63.99<br>Saved: 16.00"],
    copyOutputs: ["Final: 63.99\nSaved: 16.00"],
    domTagLists: [["SPAN", "BR"]],
    allowedDomTags: ["SPAN", "BR"],
    replayMatch: true,
    substancePass: true
  };
  assert.strictEqual(gradeObservation(goodObs).passed, true, "Calibrated positive probe failed");

  const adversarialProbes = [
    { ...goodObs, outputsToCheck: ["Educational note: NaN"] },
    { ...goodObs, outputsToCheck: ["-0.00"] },
    { ...goodObs, domTagLists: [["SPAN", "SCRIPT"]] },
    { ...goodObs, copyOutputs: ["Final: 10<br>Saved: 2"] },
    { ...goodObs, labelOutputs: ["<b>20.00%</b>"] },
    { ...goodObs, actualOutcomeValid: false },
    { ...goodObs, surfaceMatch: false },
    { ...goodObs, substancePass: false },
    { ...goodObs, replayMatch: false }
  ];
  for (let i = 0; i < adversarialProbes.length; i++) {
    const res = gradeObservation(adversarialProbes[i]);
    if (res.passed) {
      throw new Error(`Grader calibration failed on negative probe #${i}`);
    }
  }
  let caughtMalformed = false;
  try {
    gradeObservation({ expectedOutcomeValid: "yes" });
  } catch {
    caughtMalformed = true;
  }
  if (!caughtMalformed) {
    throw new Error("Grader calibration failed to reject malformed observation");
  }
}

function buildSliceACases() {
  const cases = [];

  // 1. Factorial currency & formatted numeric controls (benign vs adversarial).
  const currencyPrefixes = [
    "$",
    "€",
    "£",
    "¥",
    "₹",
    "₩",
    "₽",
    "₺",
    "₫",
    "₪",
    "₱",
    "฿",
    "USD ",
    "EUR ",
    "GBP ",
    "JPY ",
    "CAD ",
    "AUD ",
    "CHF ",
    "INR "
  ];
  const benignMagnitudes = ["1,250.50", "1_000", "0.25", "42", "99,999.99"];
  const signs = ["", "+", "-"];

  for (let i = 0; i < currencyPrefixes.length; i++) {
    const cur = currencyPrefixes[i];
    for (let j = 0; j < benignMagnitudes.length; j++) {
      const mag = benignMagnitudes[j];
      const sign = signs[(i + j) % signs.length];
      const raw =
        cur.endsWith(" ") && sign !== ""
          ? ` ${cur}${sign}${mag} `
          : `${sign}${cur}${mag}`;
      const expectedNum = Number(
        `${sign === "-" ? "-" : ""}${mag.replace(/[,_]/g, "")}`
      );
      cases.push({
        subCategory: "currency-formatting",
        pairType: "benign",
        kind: "input",
        raw,
        expectedValid: true,
        expectedNum
      });

      // Paired adversarial near-neighbor for the exact same currency prefix.
      const advVariant = j % 5;
      let advRaw;
      if (advVariant === 0) advRaw = cur.trim();
      else if (advVariant === 1) advRaw = `${cur}NaN`;
      else if (advVariant === 2) advRaw = `${cur}1.2.3`;
      else if (advVariant === 3) advRaw = `${cur}${mag}px`;
      else advRaw = `<script>${cur}${mag}</script>`;
      cases.push({
        subCategory: "currency-formatting",
        pairType: "adversarial",
        kind: "input",
        raw: advRaw,
        expectedValid: false,
        expectedNum: null
      });
    }
  }

  // 2. Percentages, signs, whitespace, scientific notation & non-finite parsing.
  const benignScienceAndFmt = [
    ["20%", 20],
    [" -15.5 % ", -15.5],
    ["+0.005", 0.005],
    ["1e-7", 1e-7],
    ["1.5e+4", 1.5e4],
    ["-2.5e3", -2500],
    [" 1_000_000.25 ", 1000000.25],
    ["\t 42.75 \n", 42.75],
    ["1 000 000.5", 1000000.5],
    ["0", 0],
    ["-0", -0],
    ["+0", 0],
    [".5", 0.5],
    ["-.25", -0.25],
    ["1e21", 1e21],
    ["5e-324", 5e-324],
    ["USD +1,234.56", 1234.56],
    ["eur -50.25", -50.25],
    ["$ 1 2 3 . 4 5", 123.45],
    ["+$1,000%", 1000],
    ["0.0001", 0.0001],
    ["-0.025", -0.025],
    ["99.995", 99.995],
    ["1e308", 1e308],
    ["-1e308", -1e308]
  ];
  const advParseMalformed = [
    "",
    "   ",
    "\t\n\r ",
    "$%,",
    "___",
    "NaN",
    "nan",
    "Infinity",
    "-Infinity",
    "+Infinity",
    "1e309",
    "-1e309",
    "1.2.3",
    "1e",
    "1e+",
    "1e-",
    "1e+-5",
    "e10",
    "++",
    "+-",
    "-+10",
    "10..5",
    ".1.2",
    "--10",
    "100+50",
    "100;alert(1)",
    "abc",
    "undefined"
  ];
  // Expand systematically across whitespace/percent/sign wrappers for >= 120 items here.
  const wrappers = [
    (s) => s,
    (s) => `  ${s}  `,
    (s) => `\t${s}\n`
  ];
  for (const w of wrappers) {
    for (const [raw, expectedNum] of benignScienceAndFmt) {
      cases.push({
        subCategory: "syntax-and-scientific",
        pairType: "benign",
        kind: "input",
        raw: w(raw),
        expectedValid: true,
        expectedNum
      });
    }
    for (const raw of advParseMalformed) {
      const wrapped = w(raw);
      const isNonFiniteNum =
        raw === "Infinity" ||
        raw === "-Infinity" ||
        raw === "+Infinity" ||
        raw === "1e309" ||
        raw === "-1e309";
      cases.push({
        subCategory: "syntax-and-scientific",
        pairType: "adversarial",
        kind: "input",
        raw: wrapped,
        expectedValid: false,
        expectedNum: isNonFiniteNum
          ? raw.startsWith("-")
            ? -Infinity
            : Infinity
          : null,
        isNonFiniteTrigger: isNonFiniteNum
      });
    }
  }

  // 3. XSS, markup rendering, and prototype-pollution controls.
  const xssPayloads = [
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    '"><svg onload=alert(1)>',
    "100<script>alert(1)</script>",
    "<iframe src='javascript:alert(1)'></iframe>",
    "javascript:alert(1)",
    "<body onload=alert(1)>",
    "<a href=javascript:alert(1)>click</a>",
    "${alert(1)}",
    "{{constructor.constructor('return 1')()}}",
    "' OR 1=1 --",
    "<style>body{display:none}</style>",
    "<math><mtext><script>alert(1)</script></mtext></math>",
    "<!-- --><script>alert(1)</script>",
    "<svg><animate onbegin=alert(1)>"
  ];
  const protoKeys = [
    "__proto__",
    "constructor",
    "toString",
    "valueOf",
    "hasOwnProperty",
    "__defineGetter__",
    "__lookupSetter__",
    "isPrototypeOf",
    "propertyIsEnumerable",
    "toLocaleString"
  ];
  const validCalcs = ["change", "percent", "what", "discount", "base", "markup", "tax"];

  for (let i = 0; i < 40; i++) {
    const xss = xssPayloads[i % xssPayloads.length] + (i >= xssPayloads.length ? `#${i}` : "");
    cases.push({
      subCategory: "xss-and-proto",
      pairType: "adversarial",
      kind: "xss-input-and-dom",
      raw: xss,
      expectedValid: false,
      expectedNum: null
    });
    cases.push({
      subCategory: "xss-and-proto",
      pairType: "benign",
      kind: "benign-dom",
      raw: `${(i + 1) * 10}.50`,
      labelText: i % 2 === 0 ? `${(i + 1) * 10}.50%` : `Final: ${(i + 1) * 10}.50<br>Saved: 5.00`,
      expectedValid: true,
      expectedNum: Number(`${(i + 1) * 10}.50`)
    });
  }

  for (let i = 0; i < 30; i++) {
    const badKey = protoKeys[i % protoKeys.length];
    const goodKey = validCalcs[i % validCalcs.length];
    cases.push({
      subCategory: "xss-and-proto",
      pairType: "adversarial",
      kind: "restore-proto-key",
      calculatorKey: badKey,
      raw: badKey,
      expectedValid: false
    });
    cases.push({
      subCategory: "xss-and-proto",
      pairType: "benign",
      kind: "restore-valid-key",
      calculatorKey: goodKey,
      raw: "100",
      expectedValid: true
    });
  }

  // 4. Ultra-long strings & MAX_FIELD_LEN=256 boundary controls.
  const validLengths = [1, 2, 16, 64, 128, 200, 254, 255, 256];
  const overLengths = [257, 258, 260, 300, 512, 1024, 2048, 4096, 8192];
  for (let rep = 0; rep < 4; rep++) {
    for (let i = 0; i < validLengths.length; i++) {
      const len = validLengths[i];
      const benignField =
        len === 1 ? "5" : len === 2 ? "12" : `0.${"0".repeat(len - 3)}1`;
      cases.push({
        subCategory: "length-boundary",
        pairType: "benign",
        kind: "history-candidate-len",
        field: benignField,
        expectedValid: true
      });
      const overLen = overLengths[i];
      const badField =
        rep % 2 === 0
          ? `0.${"0".repeat(overLen - 3)}1`
          : `<script>${"a".repeat(overLen)}</script>`;
      cases.push({
        subCategory: "length-boundary",
        pairType: "adversarial",
        kind: "history-candidate-len",
        field: badField,
        expectedValid: false
      });
    }
  }
  // Additional whitespace-only vs trimmed-whitespace-with-digit boundary cases.
  for (let i = 0; i < 10; i++) {
    cases.push({
      subCategory: "length-boundary",
      pairType: "benign",
      kind: "input",
      raw: `${" ".repeat(300)}${i + 1}${" ".repeat(300)}`,
      expectedValid: true,
      expectedNum: i + 1
    });
    cases.push({
      subCategory: "length-boundary",
      pairType: "adversarial",
      kind: "history-candidate-len",
      field: " ".repeat(10 + i),
      expectedValid: false
    });
  }

  return cases;
}

function buildSliceBCases() {
  const cases = [];

  // 1. Percentage Change (change): orig == 0/-0 adversarial vs benign near-neighbors + boundaries.
  const changeBenignNums = [
    [150, 180],
    [200, 150],
    [100, 100],
    [-50, -25],
    [-50, -75],
    [0.0001, 0.0002],
    [-0.0001, 0.0001],
    [1e-6, -1e-6],
    [100, 0],
    [100, -0],
    [100, -100],
    [80, 80.02],
    [1e12, 1.5e12],
    [12.345, 24.69],
    [-2.5, 2.5]
  ];
  for (let rep = 0; rep < 4; rep++) {
    const scale = rep === 0 ? 1 : rep === 1 ? 0.5 : rep === 2 ? 2 : 10;
    for (const [a, b] of changeBenignNums) {
      const orig = a * scale;
      const nw = b * scale;
      cases.push({
        calc: "change",
        pairType: "benign",
        a: orig,
        b: nw,
        expectedOk: true
      });
    }
  }
  const changeAdvInputs = [
    [0, 100],
    [-0, 100],
    [0, 0],
    [0, -0],
    [-0, -50],
    [0, 1e-12],
    [0, -1e-12],
    [NaN, 100],
    [100, NaN],
    [Infinity, 100],
    [100, Infinity],
    [-Infinity, 100],
    [1e308, -1e308],
    [1e-308, 1e308],
    [0, Infinity]
  ];
  for (let rep = 0; rep < 4; rep++) {
    for (const [a, b] of changeAdvInputs) {
      cases.push({
        calc: "change",
        pairType: "adversarial",
        a,
        b: rep > 0 && Number.isFinite(b) && b !== 0 ? b + rep : b,
        expectedOk: false
      });
    }
  }

  // 2. Percentage of Total (percent): total == 0/-0 adversarial vs benign.
  const percentBenign = [
    [50, 200],
    [0, 200],
    [-0, 200],
    [-25, 100],
    [25, -100],
    [-25, -100],
    [1, 0.0001],
    [-1, -0.0001],
    [0.025, 100],
    [-0.025, 100],
    [1e-6, 1],
    [1e12, 2e12],
    [99.995, 100],
    [12.345, 50],
    [33.333, 100]
  ];
  for (let rep = 0; rep < 4; rep++) {
    const mult = rep + 1;
    for (const [x, y] of percentBenign) {
      cases.push({
        calc: "percent",
        pairType: "benign",
        a: x * mult,
        b: y * mult,
        expectedOk: true
      });
    }
  }
  const percentAdv = [
    [50, 0],
    [0, 0],
    [-0, -0],
    [100, -0],
    [-100, 0],
    [1e-9, 0],
    [NaN, 100],
    [100, NaN],
    [Infinity, 100],
    [100, Infinity],
    [-Infinity, 100],
    [100, -Infinity],
    [1e308, 1e-10],
    [-1e308, 1e-10],
    [0, NaN]
  ];
  for (let rep = 0; rep < 4; rep++) {
    for (const [x, y] of percentAdv) {
      cases.push({
        calc: "percent",
        pairType: "adversarial",
        a: rep > 0 && Number.isFinite(x) && x !== 0 ? x + rep : x,
        b: y,
        expectedOk: false
      });
    }
  }

  // 3. Calculate Percentage Portion (what): benign ties/-0/large/negative vs non-finite/overflow.
  const whatBenign = [
    [20, 500],
    [0, 500],
    [-0, 500],
    [500, -0],
    [-0.025, 100],
    [0.025, 100],
    [-2.5, 1],
    [2.5, 1],
    [12.345, 100],
    [-0.001, 1],
    [-0.005, 1],
    [99.995, 100],
    [150, 200],
    [-25, 400],
    [1e21, 100]
  ];
  for (let rep = 0; rep < 4; rep++) {
    const factor = rep === 0 ? 1 : rep === 1 ? 1.5 : rep === 2 ? 3 : 0.25;
    for (const [p, n] of whatBenign) {
      cases.push({
        calc: "what",
        pairType: "benign",
        a: p,
        b: n * factor,
        expectedOk: true
      });
    }
  }
  const whatAdv = [
    [NaN, 100],
    [100, NaN],
    [NaN, NaN],
    [Infinity, 100],
    [100, Infinity],
    [-Infinity, 100],
    [100, -Infinity],
    [1e308, 1000],
    [-1e308, 1000],
    [1000, 1e308],
    [1e200, 1e200],
    [-1e200, 1e200],
    [Infinity, 0],
    [0, Infinity],
    [Infinity, -Infinity]
  ];
  for (let rep = 0; rep < 4; rep++) {
    for (const [p, n] of whatAdv) {
      cases.push({
        calc: "what",
        pairType: "adversarial",
        a: p,
        b: n,
        expectedOk: false
      });
    }
  }

  // 4. Discount: benign >100% discount, 0%, -0, tie-breaks vs non-finite/overflow.
  const discountBenign = [
    [79.99, 20],
    [100, 0],
    [100, -0],
    [-0, 20],
    [100, 100],
    [100, 150],
    [100, -10],
    [-50, 20],
    [0.025, 50],
    [-0.025, 50],
    [99.995, 0],
    [12.345, 10],
    [1e12, 15],
    [0.01, 99.9],
    [1e21, 0]
  ];
  for (let rep = 0; rep < 4; rep++) {
    const scale = rep + 1;
    for (const [price, disc] of discountBenign) {
      cases.push({
        calc: "discount",
        pairType: "benign",
        a: Math.abs(price) >= 1e21 ? price : price * scale,
        b: disc,
        expectedOk: true
      });
    }
  }
  const discountAdv = [
    [NaN, 20],
    [100, NaN],
    [Infinity, 20],
    [100, Infinity],
    [-Infinity, 20],
    [100, -Infinity],
    [1e308, 1000],
    [-1e308, 1000],
    [1e200, 1e200],
    [1e308, -1e308],
    [0, Infinity],
    [Infinity, 0],
    [Infinity, 100],
    [-Infinity, 100],
    [NaN, NaN]
  ];
  for (let rep = 0; rep < 4; rep++) {
    for (const [price, disc] of discountAdv) {
      cases.push({
        calc: "discount",
        pairType: "adversarial",
        a: price,
        b: disc,
        expectedOk: false
      });
    }
  }

  // 5. Original value (base): percent == 0/-0 adversarial vs near-zero & normal benign.
  const baseBenign = [
    [50, 25],
    [0, 25],
    [-0, 25],
    [-50, 25],
    [50, -25],
    [10, 0.0001],
    [-10, -0.0001],
    [1, 1e-6],
    [100, 100],
    [12.345, 50],
    [-0.025, 100],
    [0.025, 100],
    [99.995, 100],
    [1e9, 50],
    [250, 125]
  ];
  for (let rep = 0; rep < 4; rep++) {
    const mult = rep + 1;
    for (const [val, pct] of baseBenign) {
      cases.push({
        calc: "base",
        pairType: "benign",
        a: val * mult,
        b: pct,
        expectedOk: true
      });
    }
  }
  const baseAdv = [
    [50, 0],
    [0, 0],
    [-0, -0],
    [-50, 0],
    [50, -0],
    [1e-9, 0],
    [NaN, 25],
    [50, NaN],
    [Infinity, 25],
    [50, Infinity],
    [-Infinity, 25],
    [50, -Infinity],
    [1e308, 1e-10],
    [-1e308, 1e-10],
    [0, NaN]
  ];
  for (let rep = 0; rep < 4; rep++) {
    for (const [val, pct] of baseAdv) {
      cases.push({
        calc: "base",
        pairType: "adversarial",
        a: rep > 0 && Number.isFinite(val) && val !== 0 ? val + rep : val,
        b: pct,
        expectedOk: false
      });
    }
  }

  // 6. Markup & Margin: cost == 0 or sellingPrice == 0 adversarial vs negative profit & valid benign.
  const markupBenign = [
    [80, 100],
    [100, 80], // negative profit & negative markup/margin must succeed!
    [100, 100],
    [-50, -25],
    [-50, 25],
    [0.0001, 0.0002],
    [-0.0001, 0.0001],
    [1, 1e-4],
    [12.345, 24.69],
    [99.995, 199.99],
    [1e6, 2e6],
    [50, 50.025],
    [50, 49.975],
    [25, 100],
    [200, 50]
  ];
  for (let rep = 0; rep < 4; rep++) {
    const scale = rep + 1;
    for (const [cost, price] of markupBenign) {
      cases.push({
        calc: "markup",
        pairType: "benign",
        a: cost * scale,
        b: price * scale,
        expectedOk: true
      });
    }
  }
  const markupAdv = [
    [0, 100],
    [-0, 100],
    [80, 0],
    [80, -0],
    [0, 0],
    [-0, -0],
    [NaN, 100],
    [80, NaN],
    [Infinity, 100],
    [80, Infinity],
    [-Infinity, 100],
    [80, -Infinity],
    [1e308, -1e308],
    [1e-308, 1e308],
    [0, Infinity]
  ];
  for (let rep = 0; rep < 4; rep++) {
    for (const [cost, price] of markupAdv) {
      cases.push({
        calc: "markup",
        pairType: "adversarial",
        a: cost,
        b: price,
        expectedOk: false
      });
    }
  }

  // 7. Tax Add mode: even -100% rate is valid in Add mode!
  const taxAddBenign = [
    [100, 15],
    [100, 0],
    [100, -0],
    [0, 15],
    [-0, 15],
    [100, -100], // paired benign control for -100% in Add mode!
    [100, -99.99],
    [-100, 15],
    [79.99, 7.5],
    [0.025, 100],
    [-0.025, 100],
    [12.345, 20],
    [99.995, 0],
    [1e9, 25],
    [1e21, 0]
  ];
  for (let rep = 0; rep < 4; rep++) {
    const scale = rep + 1;
    for (const [amt, rate] of taxAddBenign) {
      cases.push({
        calc: "tax-add",
        pairType: "benign",
        a: Math.abs(amt) >= 1e21 ? amt : amt * scale,
        b: rate,
        expectedOk: true
      });
    }
  }
  const taxAddAdv = [
    [NaN, 15],
    [100, NaN],
    [NaN, NaN],
    [Infinity, 15],
    [100, Infinity],
    [-Infinity, 15],
    [100, -Infinity],
    [1e308, 1000],
    [-1e308, 1000],
    [1e200, 1e200],
    [1e308, -1e308],
    [0, Infinity],
    [Infinity, 0],
    [Infinity, -100],
    [-Infinity, 100]
  ];
  for (let rep = 0; rep < 4; rep++) {
    for (const [amt, rate] of taxAddAdv) {
      cases.push({
        calc: "tax-add",
        pairType: "adversarial",
        a: amt,
        b: rate,
        expectedOk: false
      });
    }
  }

  // 8. Tax Extract mode: rate == -100% adversarial guard vs -99.99%, -100.01%, 0%, 15% benign.
  const taxExtractBenign = [
    [115, 15],
    [100, 0],
    [100, -0],
    [0, 15],
    [-0, 15],
    [100, -99.99],
    [100, -100.01],
    [100, -50],
    [-115, 15],
    [0.025, 0],
    [-0.025, 0],
    [12.345, 25],
    [99.995, 0],
    [1e9, 20],
    [500, 100]
  ];
  for (let rep = 0; rep < 4; rep++) {
    const scale = rep + 1;
    for (const [amt, rate] of taxExtractBenign) {
      cases.push({
        calc: "tax-extract",
        pairType: "benign",
        a: amt * scale,
        b: rate,
        expectedOk: true
      });
    }
  }
  const taxExtractAdv = [
    [100, -100],
    [0, -100],
    [-0, -100],
    [-100, -100],
    [1e-6, -100],
    [123.45, -100.0],
    [NaN, 15],
    [100, NaN],
    [Infinity, 15],
    [100, Infinity],
    [-Infinity, 15],
    [100, -Infinity],
    [1e308, -99.999999999999],
    [-1e308, -99.999999999999],
    [Infinity, -100]
  ];
  for (let rep = 0; rep < 4; rep++) {
    for (const [amt, rate] of taxExtractAdv) {
      cases.push({
        calc: "tax-extract",
        pairType: "adversarial",
        a: rep > 0 && Number.isFinite(amt) && amt !== 0 ? amt + rep : amt,
        b: rate,
        expectedOk: false
      });
    }
  }

  return cases;
}

async function runSliceA(mobileEnv, desktopEnv) {
  const { mobileCtx, mobileDoc } = mobileEnv;
  const { desktopCtx, desktopDoc } = desktopEnv;
  const rawCases = buildSliceACases();
  const results = [];
  let brokenCount = 0;
  let surfaceMismatches = 0;

  for (const item of rawCases) {
    try {
      let obs;
      if (item.kind === "input" || item.kind === "xss-input-and-dom" || item.kind === "benign-dom") {
        // Run Desktop & Mobile sanitization + getNumber + getRawInput + setResult.
        const inputId = "changeOrig";
        desktopDoc.getElementById(inputId).value = item.raw;
        mobileDoc.getElementById(inputId).value = item.raw;

        const dSan = desktopCtx.sanitizeNumericString(item.raw);
        const mSan = mobileCtx.sanitizeNumericString(item.raw);
        const dNum = desktopCtx.getNumber(inputId);
        const mNum = mobileCtx.getNumber(inputId);
        const dRaw = desktopCtx.getRawInput(inputId);
        const mRaw = mobileCtx.getRawInput(inputId);

        const dSan2 = desktopCtx.sanitizeNumericString(item.raw);
        const mSan2 = mobileCtx.sanitizeNumericString(item.raw);
        const dNum2 = desktopCtx.getNumber(inputId);
        const mNum2 = mobileCtx.getNumber(inputId);

        // Also test setResult DOM sink hygiene using formatted/guarded UI output for input cases,
        // and the raw/label payload for DOM escaping cases.
        const dRenderText =
          item.kind === "input"
            ? dNum === null
              ? "—"
              : Number.isFinite(dNum)
                ? desktopCtx.fmtFormulaNum(dNum)
                : "Value out of range"
            : (item.labelText ?? item.raw);
        const mRenderText =
          item.kind === "input"
            ? mNum === null
              ? "—"
              : Number.isFinite(mNum)
                ? mobileCtx.fmtFormulaNum(mNum)
                : "Value out of range"
            : (item.labelText ?? item.raw);
        const isErrRender =
          item.kind === "input"
            ? item.isNonFiniteTrigger === true
            : item.pairType === "adversarial";
        desktopCtx.setResult("changeResult", dRenderText, isErrRender);
        mobileCtx.setResult("changeResult", mRenderText, isErrRender);

        const dResultEl = desktopDoc.getElementById("changeResult");
        const mResultEl = mobileDoc.getElementById("changeResult");
        const dDomTags = collectDomNodeTags(dResultEl);
        const mDomTags = collectDomNodeTags(mResultEl);

        const surfaceMatch =
          dSan === mSan &&
          dRaw === mRaw &&
          Object.is(dNum, mNum) &&
          dResultEl.textContent === mResultEl.textContent &&
          JSON.stringify(dDomTags) === JSON.stringify(mDomTags);
        if (!surfaceMatch) surfaceMismatches += 1;

        const replayMatch =
          dSan === dSan2 &&
          mSan === mSan2 &&
          Object.is(dNum, dNum2) &&
          Object.is(mNum, mNum2);

        let actualOutcomeValid;
        let substancePass;
        if (item.isNonFiniteTrigger) {
          // Non-finite inputs are caught by finite range check in live updates.
          desktopCtx.setCardOutOfRange(
            "change",
            desktopDoc.getElementById("changeLiveFormula"),
            desktopDoc.getElementById("changeLiveResult"),
            "changeResult",
            "((new − original) / original) × 100"
          );
          mobileCtx.setCardOutOfRange(
            "change",
            mobileDoc.getElementById("changeLiveFormula"),
            mobileDoc.getElementById("changeLiveResult"),
            "changeResult",
            "((new − original) / original) × 100"
          );
          actualOutcomeValid =
            Number.isFinite(dNum) &&
            Number.isFinite(mNum) &&
            !desktopDoc.getElementById("changeResult").textContent.includes("Value out of range");
          substancePass =
            !Number.isFinite(dNum) &&
            !Number.isFinite(mNum) &&
            desktopDoc.getElementById("changeResult").textContent === "=Value out of range" &&
            mobileDoc.getElementById("changeResult").textContent === "=Value out of range";
        } else {
          actualOutcomeValid = dNum !== null && Number.isFinite(dNum) && mNum !== null && Number.isFinite(mNum);
          substancePass = item.expectedValid
            ? dNum === item.expectedNum && mNum === item.expectedNum
            : dNum === null && mNum === null;
        }

        obs = {
          expectedOutcomeValid: item.expectedValid,
          actualOutcomeValid,
          surfaceMatch,
          outputsToCheck: [dResultEl.textContent, mResultEl.textContent],
          labelOutputs: item.labelText ? [item.labelText] : [],
          copyOutputs: [],
          domTagLists: [dDomTags, mDomTags],
          allowedDomTags: ["SPAN", "BR"],
          replayMatch,
          substancePass
        };
      } else if (item.kind === "restore-proto-key" || item.kind === "restore-valid-key") {
        // Test restoreHistoryEntry + Mobile sanitizeHistoryItem against prototype pollution vs valid keys.
        const targetIds = {
          change: ["changeOrig", "changeNew"],
          percent: ["isWhatX", "isWhatY"],
          what: ["whatX", "whatY"],
          discount: ["discountPrice", "discountPercent"],
          base: ["baseX", "baseY"],
          markup: ["markupCost", "markupPrice"],
          tax: ["taxAmount", "taxRate"]
        };
        const clearAll = () => {
          for (const [a, b] of Object.values(targetIds)) {
            desktopDoc.getElementById(a).value = "";
            mobileDoc.getElementById(a).value = "";
            desktopDoc.getElementById(b).value = "";
            mobileDoc.getElementById(b).value = "";
          }
        };
        clearAll();

        const entry = {
          id: 1,
          timestampMs: 1700000000000,
          calculator: item.calculatorKey,
          calculatorLabel: "Test",
          inputA: "123",
          inputB: "45",
          mode: item.calculatorKey === "tax" ? "add" : null,
          inputsText: "123 -> 45",
          resultText: "100.00",
          copyText: "100.00"
        };
        await desktopCtx.restoreHistoryEntry(entry);
        mobileCtx.restoreHistoryEntry(entry);
        const mSanitized = mobileCtx.sanitizeHistoryItem(entry);
        const mSanitized2 = mobileCtx.sanitizeHistoryItem(entry);

        let restoredProperly = false;
        if (item.expectedValid) {
          const [aId, bId] = targetIds[item.calculatorKey];
          restoredProperly =
            desktopDoc.getElementById(aId).value === "123" &&
            desktopDoc.getElementById(bId).value === "45" &&
            mobileDoc.getElementById(aId).value === "123" &&
            mobileDoc.getElementById(bId).value === "45" &&
            mSanitized !== null &&
            mSanitized.calculator === item.calculatorKey;
        } else {
          // Ensure restoreHistoryEntry did NOT mutate any card input and Mobile rejected the item.
          const untouched = Object.values(targetIds).every(
            ([a, b]) =>
              desktopDoc.getElementById(a).value === "" &&
              desktopDoc.getElementById(b).value === "" &&
              mobileDoc.getElementById(a).value === "" &&
              mobileDoc.getElementById(b).value === ""
          );
          restoredProperly = untouched && mSanitized === null;
        }

        const allInputsAfter = Object.values(targetIds).map(([a, b]) => [
          desktopDoc.getElementById(a).value,
          desktopDoc.getElementById(b).value,
          mobileDoc.getElementById(a).value,
          mobileDoc.getElementById(b).value
        ]);
        const surfaceMatch = allInputsAfter.every(
          ([da, db, ma, mb]) => da === ma && db === mb
        );
        if (!surfaceMatch) surfaceMismatches += 1;

        obs = {
          expectedOutcomeValid: item.expectedValid,
          actualOutcomeValid: item.expectedValid ? restoredProperly : !restoredProperly,
          surfaceMatch,
          outputsToCheck: [],
          labelOutputs: [],
          copyOutputs: [],
          domTagLists: [],
          allowedDomTags: ["SPAN", "BR"],
          replayMatch: JSON.stringify(mSanitized) === JSON.stringify(mSanitized2),
          substancePass: restoredProperly
        };
      } else if (item.kind === "history-candidate-len") {
        const candidate = {
          calculator: "what",
          calculatorLabel: "Calculate Percentage",
          inputA: item.field,
          inputB: "500",
          mode: null,
          inputsText: "20% of 500",
          resultText: "100.00",
          copyText: "100.00"
        };
        const dRes = desktopCtx.buildValidHistoryCandidate(candidate);
        const mRes = mobileCtx.buildValidHistoryCandidate(candidate);
        const dRes2 = desktopCtx.buildValidHistoryCandidate(candidate);
        const mRes2 = mobileCtx.buildValidHistoryCandidate(candidate);

        const surfaceMatch = (dRes === null) === (mRes === null);
        if (!surfaceMatch) surfaceMismatches += 1;

        const actualOutcomeValid = dRes !== null && mRes !== null;
        obs = {
          expectedOutcomeValid: item.expectedValid,
          actualOutcomeValid,
          surfaceMatch,
          outputsToCheck: [],
          labelOutputs: [],
          copyOutputs: [],
          domTagLists: [],
          allowedDomTags: ["SPAN", "BR"],
          replayMatch:
            (dRes === null) === (dRes2 === null) &&
            (mRes === null) === (mRes2 === null),
          substancePass: item.expectedValid
            ? dRes !== null && mRes !== null && dRes.inputA.length <= 256
            : dRes === null && mRes === null
        };
      } else {
        throw new Error(`Unknown Slice A item kind: ${item.kind}`);
      }

      const graded = gradeObservation(obs);
      results.push({
        subCategory: item.subCategory,
        pairType: item.pairType,
        ...graded
      });
    } catch (err) {
      brokenCount += 1;
      results.push({
        subCategory: item.subCategory,
        pairType: item.pairType,
        passed: false,
        broken: true,
        error: String(err)
      });
    }
  }

  return { results, brokenCount, surfaceMismatches };
}

function invokePureMobileCalc(mathCtx, calc, a, b) {
  switch (calc) {
    case "change":
      return mathCtx.calcChange(a, b);
    case "percent":
      return mathCtx.calcPercentOfTotal(a, b);
    case "what":
      return mathCtx.calcPortion(a, b);
    case "discount":
      return mathCtx.calcDiscount(a, b);
    case "base":
      return mathCtx.calcOriginal(a, b);
    case "markup":
      return mathCtx.calcMarkupMargin(a, b);
    case "tax-add":
      return mathCtx.calcTax(a, b, "add");
    case "tax-extract":
      return mathCtx.calcTax(a, b, "extract");
    default:
      throw new Error(`Unknown calculator mode: ${calc}`);
  }
}

async function runLiveUiOnSurface(ctx, doc, calc, a, b, isDesktop) {
  const mapping = {
    change: { a: "changeOrig", b: "changeNew", res: "changeResult", live: "changeLiveResult", fn: "updateChangeLive" },
    percent: { a: "isWhatX", b: "isWhatY", res: "percentResult", live: "percentLiveResult", fn: "updatePercentLive" },
    what: { a: "whatX", b: "whatY", res: "whatResult", live: "whatLiveResult", fn: "updateWhatLive" },
    discount: { a: "discountPrice", b: "discountPercent", res: "discountResult", live: "discountLiveResult", fn: "updateDiscountLive" },
    base: { a: "baseX", b: "baseY", res: "baseResult", live: "baseLiveResult", fn: "updateBaseLive" },
    markup: { a: "markupCost", b: "markupPrice", res: "markupResult", live: "markupLiveResult", fn: "updateMarkupLive" },
    "tax-add": { a: "taxAmount", b: "taxRate", res: "taxResult", live: "taxLiveResult", fn: "updateTaxLive", taxMode: "add" },
    "tax-extract": { a: "taxAmount", b: "taxRate", res: "taxResult", live: "taxLiveResult", fn: "updateTaxLive", taxMode: "extract" }
  }[calc];

  if (mapping.taxMode) {
    const modeRes = ctx.setTaxMode(mapping.taxMode, false);
    if (isDesktop && modeRes && typeof modeRes.then === "function") {
      await modeRes;
    }
  }
  doc.getElementById(mapping.a).value = String(a);
  doc.getElementById(mapping.b).value = String(b);

  const callRes = ctx[mapping.fn]();
  if (isDesktop && callRes && typeof callRes.then === "function") {
    await callRes;
  }

  const resEl = doc.getElementById(mapping.res);
  const liveEl = doc.getElementById(mapping.live);
  return {
    resultText: resEl.textContent,
    liveText: liveEl.textContent,
    domTags: collectDomNodeTags(resEl)
  };
}

function collectFormattedStrings(res) {
  const out = [];
  for (const key of [
    "label",
    "liveResult",
    "copyText",
    "error",
    "finalText",
    "savedText",
    "profitText",
    "markupText",
    "marginText",
    "netText",
    "taxText",
    "totalText"
  ]) {
    if (typeof res[key] === "string") out.push(res[key]);
  }
  return out;
}

function isPureMathResultFiniteAndOk(calc, res) {
  if (!res || typeof res !== "object") return false;
  if (calc === "discount") {
    return (
      res.ok === true &&
      Number.isFinite(res.finalPrice) &&
      Number.isFinite(res.saved)
    );
  }
  if (res.ok !== "true") return false;
  if (calc === "markup") {
    return (
      Number.isFinite(res.profit) &&
      Number.isFinite(res.markup) &&
      Number.isFinite(res.margin)
    );
  }
  if (calc === "tax-add" || calc === "tax-extract") {
    return (
      Number.isFinite(res.net) &&
      Number.isFinite(res.tax) &&
      Number.isFinite(res.total)
    );
  }
  return Number.isFinite(res.value);
}

async function runSliceB(mobileEnv, desktopEnv) {
  const { pureMathCtx, mobileCtx, mobileDoc } = mobileEnv;
  const { desktopCtx, desktopDoc, setCalcRoutingEnabled } = desktopEnv;
  const rawCases = buildSliceBCases();
  const results = [];
  let brokenCount = 0;
  let surfaceMismatches = 0;

  setCalcRoutingEnabled(true);
  try {
    for (const item of rawCases) {
      try {
        const math1 = invokePureMobileCalc(pureMathCtx, item.calc, item.a, item.b);
        const math2 = invokePureMobileCalc(pureMathCtx, item.calc, item.a, item.b);
        const desktopUi = await runLiveUiOnSurface(
          desktopCtx,
          desktopDoc,
          item.calc,
          item.a,
          item.b,
          true
        );
        const mobileUi = await runLiveUiOnSurface(
          mobileCtx,
          mobileDoc,
          item.calc,
          item.a,
          item.b,
          false
        );

        const surfaceMatch =
          desktopUi.resultText === mobileUi.resultText &&
          desktopUi.liveText === mobileUi.liveText &&
          JSON.stringify(desktopUi.domTags) === JSON.stringify(mobileUi.domTags);
        if (!surfaceMatch) surfaceMismatches += 1;

        const replayMatch =
          JSON.stringify(math1) === JSON.stringify(math2) &&
          desktopUi.resultText === mobileUi.resultText;

        const mathFiniteOk = isPureMathResultFiniteAndOk(item.calc, math1);
        const uiShowsOk =
          !desktopUi.resultText.startsWith("=Value out of range") &&
          desktopUi.resultText !== "=—" &&
          !desktopUi.liveText.includes("invalid") &&
          desktopUi.liveText !== "→ —";

        let substancePass;
        if (item.expectedOk) {
          substancePass = mathFiniteOk && uiShowsOk;
        } else {
          // Adversarial boundary (0 denominator, -100% extract, NaN, ±Infinity, or overflow):
          // For finite inputs (0 denominator, -100% tax extract, 1e308 overflow), require BOTH
          // math non-finite/error AND UI guard. For non-finite inputs (NaN, ±Infinity), where
          // IEEE-754 division by ±Infinity yields 0 in pure math, require the UI finite/NaN guard.
          const inputsFinite = Number.isFinite(item.a) && Number.isFinite(item.b);
          const isNaNInput = Number.isNaN(item.a) || Number.isNaN(item.b);
          const isExplicitDivGuard = math1.ok === "false";
          const isUiGuarded = isNaNInput
            ? desktopUi.resultText === "=—" && mobileUi.resultText === "=—"
            : desktopUi.resultText === "=Value out of range" ||
              (isExplicitDivGuard && desktopUi.resultText === `=${math1.error}`);
          substancePass =
            !uiShowsOk && isUiGuarded && (!inputsFinite || !mathFiniteOk);
        }

        // Verify copy button is blocked whenever card is in invalid/error state.
        if (!item.expectedOk) {
          const copyBtnKey = {
            change: "change",
            percent: "percent",
            what: "what",
            discount: "discount",
            base: "base",
            markup: "markup",
            "tax-add": "tax",
            "tax-extract": "tax"
          }[item.calc];
          const dCopyBlocked =
            (await desktopCtx.copyCardResult(copyBtnKey, null)) === false;
          const mCopyBlocked =
            (await mobileCtx.copyCardResult(copyBtnKey, null)) === false;
          if (!dCopyBlocked || !mCopyBlocked) {
            substancePass = false;
          }
        }

        const obs = {
          expectedOutcomeValid: item.expectedOk,
          actualOutcomeValid: mathFiniteOk && uiShowsOk,
          surfaceMatch,
          outputsToCheck: [
            ...collectFormattedStrings(math1),
            desktopUi.resultText,
            desktopUi.liveText,
            mobileUi.resultText,
            mobileUi.liveText
          ],
          labelOutputs: typeof math1.label === "string" ? [math1.label] : [],
          copyOutputs: typeof math1.copyText === "string" ? [math1.copyText] : [],
          domTagLists: [desktopUi.domTags, mobileUi.domTags],
          allowedDomTags: ["SPAN", "BR"],
          replayMatch,
          substancePass
        };

        const graded = gradeObservation(obs);
        results.push({
          subCategory: item.calc,
          pairType: item.pairType,
          ...graded
        });
      } catch (err) {
        brokenCount += 1;
        results.push({
          subCategory: item.calc,
          pairType: item.pairType,
          passed: false,
          broken: true,
          error: String(err)
        });
      }
    }
  } finally {
    setCalcRoutingEnabled(false);
  }

  return { results, brokenCount, surfaceMismatches };
}

function runSliceCGoldenBaseline(pureMathCtx) {
  const cases = JSON.parse(
    readRepoUtf8("crates/percent-core/tests/fixtures/golden.json")
  );
  if (!Array.isArray(cases)) {
    throw new Error("golden.json did not parse as an array");
  }
  const parseNum = (s) =>
    s === "NaN"
      ? NaN
      : s === "Infinity"
        ? Infinity
        : s === "-Infinity"
          ? -Infinity
          : Number(s);

  let passed = 0;
  let brokenCount = 0;
  const failures = [];

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    try {
      if (c.f === "formatDecimal") {
        assert.strictEqual(pureMathCtx.formatDecimal(parseNum(c.a[0])), c.r);
      } else if (c.f === "discount") {
        const act = pureMathCtx.calcDiscount(parseNum(c.a[0]), parseNum(c.a[1]));
        assert.strictEqual(act.label, c.r.label);
        assert.strictEqual(act.copyText, c.r.copyText);
      } else {
        const a = parseNum(c.a[0]);
        const b = parseNum(c.a[1]);
        const act =
          c.f === "percentageChange"
            ? pureMathCtx.calcChange(a, b)
            : c.f === "percentageOfTotal"
              ? pureMathCtx.calcPercentOfTotal(a, b)
              : c.f === "percentagePortion"
                ? pureMathCtx.calcPortion(a, b)
                : pureMathCtx.calcOriginal(a, b);
        if (c.r.ok) {
          assert.strictEqual(act.ok, "true");
          assert.strictEqual(act.label, c.r.label);
        } else {
          assert.strictEqual(act.ok, "false");
          assert.strictEqual(act.error, c.r.error);
        }
      }
      passed += 1;
    } catch (err) {
      brokenCount += 1;
      if (failures.length < 10) {
        failures.push(`case[${i}] (${c.f}): ${err.message}`);
      }
    }
  }

  return { total: cases.length, passed, brokenCount, failures };
}

function runSliceDStaticInvariants(mobileEnv, uiMainSource) {
  const checks = [];
  const addCheck = (name, ok, detail) => {
    checks.push({ name, ok: Boolean(ok), detail });
  };

  // 1. LF-only (zero 0x0d CR bytes) checks.
  for (const rel of ["mobile/index.html", "mobile/sw.js", "scripts/safety-eval.mjs"]) {
    const bytes = readRepoBytes(rel);
    const crCount = bytes.filter((b) => b === 13).length;
    addCheck(`lf-only:${rel}`, crCount === 0, `CR bytes=${crCount}`);
  }

  // 2. Exact <meta> CSP SHA-256 hashes & zero frame-ancestors in mobile/index.html.
  const styleHash = crypto
    .createHash("sha256")
    .update(mobileEnv.styleBody, "utf8")
    .digest("base64");
  const scriptHash = crypto
    .createHash("sha256")
    .update(mobileEnv.scriptBody, "utf8")
    .digest("base64");
  const directives = mobileEnv.cspContent.split(";").map((d) => d.trim());
  const styleDir = directives.find((d) => d.startsWith("style-src "));
  const scriptDir = directives.find((d) => d.startsWith("script-src "));
  addCheck(
    "csp-style-sha256",
    Boolean(styleDir && styleDir.includes(`'sha256-${styleHash}'`)),
    `sha256-${styleHash}`
  );
  addCheck(
    "csp-script-sha256",
    Boolean(scriptDir && scriptDir.includes(`'sha256-${scriptHash}'`)),
    `sha256-${scriptHash}`
  );
  addCheck(
    "csp-no-frame-ancestors",
    !/frame-ancestors/i.test(mobileEnv.cspContent),
    "no frame-ancestors in <meta> CSP"
  );

  // 3. Zero forbidden DOM/eval sinks across ui/main.js, mobile inline script, mobile/sw.js.
  const swSource = readRepoUtf8("mobile/sw.js");
  const sinkRe = /\.innerHTML\b|\.outerHTML\b|\beval\s*\(|\bnew\s+Function\b/;
  for (const [label, src] of [
    ["ui/main.js", uiMainSource],
    ["mobile/index.html::<script>", mobileEnv.scriptBody],
    ["mobile/sw.js", swSource]
  ]) {
    addCheck(`no-dom-eval-sink:${label}`, !sinkRe.test(src), "0 sinks");
  }

  // 4. Zero runtime .style.* mutations in Mobile inline script.
  const styleMutationRe = /\.style\s*(?:\.|\[|=)/;
  addCheck(
    "mobile-no-runtime-style-mutation",
    !styleMutationRe.test(mobileEnv.scriptBody),
    "0 .style mutations"
  );

  // 5. GitHub Actions workflow SHA pins (40 lowercase hex chars) & persist-credentials: false.
  for (const wf of [".github/workflows/build.yml", ".github/workflows/pages.yml"]) {
    const src = readRepoUtf8(wf);
    const refs = [...src.matchAll(/uses:\s+([^\s#]+)/g)].map((m) => m[1]);
    const allPinned =
      refs.length > 0 && refs.every((ref) => /@[a-f0-9]{40}$/.test(ref));
    const checkouts = (src.match(/uses:\s+actions\/checkout@/g) || []).length;
    const disabledCreds = (src.match(/persist-credentials:\s*false/g) || []).length;
    addCheck(
      `workflow-sha-pins:${wf}`,
      allPinned,
      `${refs.length} pinned action uses`
    );
    addCheck(
      `workflow-checkout-creds:${wf}`,
      checkouts > 0 && disabledCreds === checkouts,
      `${disabledCreds}/${checkouts} persist-credentials: false`
    );
  }

  const passed = checks.filter((c) => c.ok).length;
  return { checks, passed, total: checks.length };
}

function summarizeGroup(items, label, surface) {
  const n = items.length;
  const k = items.filter((r) => r.passed).length;
  const ci = wilsonCI95(k, n);
  return {
    label,
    surface,
    k,
    n,
    ci,
    verdict: k === n ? "PASS" : "FAIL"
  };
}

function printReport({
  gitSha,
  timestampUtc,
  sliceARes,
  sliceBRes,
  sliceCRes,
  sliceDRes,
  pairedSummary,
  surfaceDeltaPct,
  totalBrokenCount,
  gateFailures
}) {
  console.log("=== SAFETY EVALUATION SYSTEM CARD ===");
  console.log(`eval_id: ${PREREGISTRATION.evalId}`);
  console.log(`design_type: ${PREREGISTRATION.designType}`);
  console.log(`git_head_sha: ${gitSha}`);
  console.log(`node_version: ${process.version}`);
  console.log(`platform: ${process.platform} (${process.arch})`);
  console.log(`timestamp_utc: ${timestampUtc}`);
  console.log(`sample_floor_paired: ${PREREGISTRATION.sampleFloorPaired}`);
  console.log(`thresholds: ${JSON.stringify(PREREGISTRATION.thresholds)}`);
  console.log(`deviations: ${PREREGISTRATION.deviations}`);
  console.log("");

  console.log("--- Category & Slice Breakdown (Wilson 95% CI) ---");
  const rows = [];

  const aBenign = sliceARes.results.filter((r) => r.pairType === "benign");
  const aAdv = sliceARes.results.filter((r) => r.pairType === "adversarial");
  rows.push(
    summarizeGroup(aBenign, "Slice A: Input/DOM (Benign)", "Desktop vs Mobile"),
    summarizeGroup(aAdv, "Slice A: Input/DOM (Adversarial)", "Desktop vs Mobile")
  );
  for (const sub of [
    "currency-formatting",
    "syntax-and-scientific",
    "xss-and-proto",
    "length-boundary"
  ]) {
    const subItems = sliceARes.results.filter((r) => r.subCategory === sub);
    rows.push(summarizeGroup(subItems, `  A.${sub}`, "Desktop vs Mobile"));
  }

  const bBenign = sliceBRes.results.filter((r) => r.pairType === "benign");
  const bAdv = sliceBRes.results.filter((r) => r.pairType === "adversarial");
  rows.push(
    summarizeGroup(bBenign, "Slice B: 7-Calc Boundary (Benign)", "Desktop vs Mobile"),
    summarizeGroup(bAdv, "Slice B: 7-Calc Boundary (Adversarial)", "Desktop vs Mobile")
  );
  for (const calc of [
    "change",
    "percent",
    "what",
    "discount",
    "base",
    "markup",
    "tax-add",
    "tax-extract"
  ]) {
    const cItems = sliceBRes.results.filter((r) => r.subCategory === calc);
    rows.push(summarizeGroup(cItems, `  B.${calc}`, "Desktop vs Mobile"));
  }

  const cCI = wilsonCI95(sliceCRes.passed, sliceCRes.total);
  rows.push({
    label: "Slice C: v1.1 Golden Oracle Regression",
    surface: "Mobile VM Math",
    k: sliceCRes.passed,
    n: sliceCRes.total,
    ci: cCI,
    verdict: sliceCRes.passed === sliceCRes.total ? "PASS" : "FAIL"
  });

  const dCI = wilsonCI95(sliceDRes.passed, sliceDRes.total);
  rows.push({
    label: "Slice D: Static Security/CSP/LF/CI Pins",
    surface: "Repo Assets & CI",
    k: sliceDRes.passed,
    n: sliceDRes.total,
    ci: dCI,
    verdict: sliceDRes.passed === sliceDRes.total ? "PASS" : "FAIL"
  });

  for (const row of rows) {
    console.log(
      `${row.label.padEnd(40)} | ${row.surface.padEnd(17)} | ${String(row.k).padStart(5)}/${String(row.n).padEnd(5)} | ${formatPct(row.ci.rate).padStart(7)} | CI95 ${formatCI(row.ci)} | ${row.verdict}`
    );
  }

  console.log("");
  console.log("--- Atomic Criterion Summary (Paired Slices A + B) ---");
  const allPaired = [...sliceARes.results, ...sliceBRes.results];
  for (const crit of PREREGISTRATION.atomicCriteria) {
    const k = allPaired.filter((r) => r.criteria && r.criteria[crit] === true).length;
    const ci = wilsonCI95(k, allPaired.length);
    console.log(
      `${crit.padEnd(26)} | ${k}/${allPaired.length} | ${formatPct(ci.rate)} | CI95 ${formatCI(ci)}`
    );
  }

  console.log("");
  console.log("--- Slice D Static Invariant Details ---");
  for (const c of sliceDRes.checks) {
    console.log(`  [${c.ok ? "PASS" : "FAIL"}] ${c.name}: ${c.detail}`);
  }

  console.log("");
  console.log("--- Summary & Disclosed Limits ---");
  console.log(
    `paired_controls_total: ${pairedSummary.n} (Slice A=${sliceARes.results.length}, Slice B=${sliceBRes.results.length}, Benign=${pairedSummary.benignCount}, Adversarial=${pairedSummary.adversarialCount})`
  );
  console.log(
    `paired_pass_rate: ${pairedSummary.k}/${pairedSummary.n} (${formatPct(pairedSummary.ci.rate)}), Wilson 95% CI ${formatCI(pairedSummary.ci)}`
  );
  console.log(`surface_delta_pct: ${surfaceDeltaPct.toFixed(4)}% (Desktop ui/main.js vs Mobile mobile/index.html)`);
  console.log(`broken_eval_items: ${totalBrokenCount}`);
  console.log(
    "limits: Node VM mock-DOM exercises JS input/DOM/history/math surfaces with Desktop calc_* IPC routed to Mobile math during Slice B UI-guard checks; Rust percent-core & Tauri commands.rs are covered by cargo test, and real WebView2/browser CSP & SW lifecycle are outside offline Node execution."
  );

  if (gateFailures.length > 0) {
    console.error("");
    console.error("FAIL_LOUD_GATES_TRIGGERED:");
    for (const msg of gateFailures) {
      console.error(`  - ${msg}`);
    }
    process.exit(1);
  }

  console.log("");
  console.log("SAFETY_EVAL_SUITE_OK");
}

async function main() {
  const unhandledRejections = [];
  process.on("unhandledRejection", (reason) => {
    unhandledRejections.push(String(reason));
  });

  // 1. Calibrate grader against synthetic positive, negative, and malformed probes first.
  calibrateGraderOrFail();

  // 2. Load isolated Node VM sandboxes (fail loudly if boundaries or init fail).
  const mobileEnv = loadMobileSandboxes();
  const desktopEnv = await loadDesktopSandbox(mobileEnv.pureMathCtx);

  // 3. Execute Slices A, B, C, D.
  const sliceARes = await runSliceA(mobileEnv, desktopEnv);
  const sliceBRes = await runSliceB(mobileEnv, desktopEnv);
  const sliceCRes = runSliceCGoldenBaseline(mobileEnv.pureMathCtx);
  const sliceDRes = runSliceDStaticInvariants(mobileEnv, desktopEnv.uiMain);

  const allPaired = [...sliceARes.results, ...sliceBRes.results];
  const pairedPassed = allPaired.filter((r) => r.passed).length;
  const benignItems = allPaired.filter((r) => r.pairType === "benign");
  const advItems = allPaired.filter((r) => r.pairType === "adversarial");
  const benignRate =
    benignItems.filter((r) => r.passed).length / benignItems.length;
  const advRate = advItems.filter((r) => r.passed).length / advItems.length;

  const totalSurfaceMismatches =
    sliceARes.surfaceMismatches + sliceBRes.surfaceMismatches;
  const surfaceDeltaPct = (totalSurfaceMismatches / allPaired.length) * 100;
  const totalBrokenCount =
    sliceARes.brokenCount +
    sliceBRes.brokenCount +
    sliceCRes.brokenCount +
    unhandledRejections.length;

  const gateFailures = [];
  if (totalBrokenCount > 0) {
    gateFailures.push(
      `brokenCount=${totalBrokenCount} (unhandledRejections=${unhandledRejections.length})`
    );
  }
  if (sliceARes.results.length < PREREGISTRATION.sliceFloors.sliceAInputSanitization) {
    gateFailures.push(
      `Slice A sample ${sliceARes.results.length} < floor ${PREREGISTRATION.sliceFloors.sliceAInputSanitization}`
    );
  }
  if (sliceBRes.results.length < PREREGISTRATION.sliceFloors.sliceBCalculatorBoundaries) {
    gateFailures.push(
      `Slice B sample ${sliceBRes.results.length} < floor ${PREREGISTRATION.sliceFloors.sliceBCalculatorBoundaries}`
    );
  }
  if (allPaired.length < PREREGISTRATION.sampleFloorPaired) {
    gateFailures.push(
      `Total paired sample ${allPaired.length} < floor ${PREREGISTRATION.sampleFloorPaired}`
    );
  }
  if (advRate < PREREGISTRATION.thresholds.adversarialRate) {
    gateFailures.push(
      `Adversarial pass rate ${advRate} < threshold ${PREREGISTRATION.thresholds.adversarialRate}`
    );
  }
  if (benignRate < PREREGISTRATION.thresholds.benignRate) {
    gateFailures.push(
      `Benign control pass rate ${benignRate} < threshold ${PREREGISTRATION.thresholds.benignRate}`
    );
  }
  if (surfaceDeltaPct > PREREGISTRATION.thresholds.maxSurfaceDeltaPct) {
    gateFailures.push(
      `Desktop vs Mobile surface delta ${surfaceDeltaPct}% > threshold ${PREREGISTRATION.thresholds.maxSurfaceDeltaPct}%`
    );
  }
  if (sliceCRes.total !== PREREGISTRATION.thresholds.regressionGoldenCases) {
    gateFailures.push(
      `Golden fixture count ${sliceCRes.total} !== ${PREREGISTRATION.thresholds.regressionGoldenCases}`
    );
  }
  if (sliceCRes.passed !== sliceCRes.total) {
    gateFailures.push(
      `Golden oracle failures: ${sliceCRes.failures.join("; ")}`
    );
  }
  if (sliceDRes.passed / sliceDRes.total < PREREGISTRATION.thresholds.staticInvariants) {
    const failedStatic = sliceDRes.checks.filter((c) => !c.ok).map((c) => c.name);
    gateFailures.push(`Static invariants failed: ${failedStatic.join(", ")}`);
  }

  printReport({
    gitSha: getGitHeadSha(),
    timestampUtc: new Date().toISOString(),
    sliceARes,
    sliceBRes,
    sliceCRes,
    sliceDRes,
    pairedSummary: {
      k: pairedPassed,
      n: allPaired.length,
      benignCount: benignItems.length,
      adversarialCount: advItems.length,
      ci: wilsonCI95(pairedPassed, allPaired.length)
    },
    surfaceDeltaPct,
    totalBrokenCount,
    gateFailures
  });
}

await main();
