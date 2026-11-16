// Frontend controller for the Tauri v2 desktop app (v2.3).
//
// Keeps the terminal DOM aesthetic, input parsing, and live-formula feedback,
// while delegating all percentage math, persistent local history, clipboard,
// and app metadata to the Rust backend via Tauri commands.

const COPY_FEEDBACK_MS = 1200;
const MAX_FIELD_LEN = 256;
const MAX_COPY_LEN = 4096;
const WEB_APP_URL = "https://ciphervaults.github.io/Percentage-Calculator-Tool/";
const RELEASE_URL =
  "https://github.com/CipherVaults/Percentage-Calculator-Tool/releases/latest";
let historyLimit = 500;
let taxMode = "add";
let allHistoryEntries = [];
let historyFilterValue = "all";

function invoke(cmd, args) {
  const fn =
    window.__TAURI__?.core?.invoke ?? window.__TAURI_INTERNALS__?.invoke;
  if (!fn) {
    return Promise.reject(new Error(`Tauri invoke unavailable for ${cmd}`));
  }
  return fn(cmd, args);
}

// Per-section sequence counters ensure a slower IPC reply can never overwrite
// a newer keystroke or a "clear" click.
const seq = {
  change: 0,
  percent: 0,
  what: 0,
  discount: 0,
  base: 0,
  markup: 0,
  tax: 0,
  tip: 0
};

// Holds the most recent valid calculation per card so explicit actions
// (Calculate, Enter, Copy) can record it to persistent history.
const lastValidCalc = {
  change: null,
  percent: null,
  what: null,
  discount: null,
  base: null,
  markup: null,
  tax: null,
  tip: null
};

const CALC_INPUT_IDS = [
  "changeOrig",
  "changeNew",
  "isWhatX",
  "isWhatY",
  "whatX",
  "whatY",
  "discountPrice",
  "discountPercent",
  "baseX",
  "baseY",
  "markupCost",
  "markupPrice",
  "taxAmount",
  "taxRate",
  "tipBill",
  "tipPercent",
  "tipPeople"
];

const ALLOWED_CALCULATORS = new Set([
  "change",
  "percent",
  "what",
  "discount",
  "base",
  "markup",
  "tax",
  "tip"
]);
const FINITE_DECIMAL_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

function isFiniteDecimalString(value) {
  return (
    typeof value === "string" &&
    FINITE_DECIMAL_RE.test(value) &&
    Number.isFinite(Number(value))
  );
}

function sanitizeNumericString(raw) {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  let cleaned = trimmed.replace(/[\s_,$€£¥₹₩₽₺₫₪₱฿%]+/g, "");
  cleaned = cleaned.replace(
    /^(?:([+-])(?:USD|EUR|GBP|JPY|CAD|AUD|CHF|INR)(?=\d|\.)|(?:USD|EUR|GBP|JPY|CAD|AUD|CHF|INR)(?=[+-]?(?:\d|\.)))/i,
    "$1"
  );
  if (/^\+(?:\d|\.)/.test(cleaned)) {
    cleaned = cleaned.slice(1);
  }
  return cleaned;
}

function fmtFormulaNum(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return String(n);
  if (n === 0) return "0";
  return n < 0 ? `(${n})` : String(n);
}

function getNumber(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  const cleaned = sanitizeNumericString(el.value);
  if (cleaned === "" || !FINITE_DECIMAL_RE.test(cleaned)) return null;
  const num = Number(cleaned);
  return Number.isNaN(num) ? null : num;
}

function getRawInput(id) {
  const el = document.getElementById(id);
  return el ? sanitizeNumericString(el.value) : "";
}

function attachPasteSanitizers() {
  const plainNumberRe = /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
  CALC_INPUT_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("paste", (event) => {
      const rawText = event.clipboardData?.getData("text");
      if (typeof rawText !== "string") return;
      const trimmed = rawText.trim();
      if (
        !trimmed ||
        (plainNumberRe.test(trimmed) && Number.isFinite(Number(trimmed)))
      ) {
        return;
      }
      const cleaned = sanitizeNumericString(trimmed);
      if (isFiniteDecimalString(cleaned)) {
        event.preventDefault();
        el.value = cleaned;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        event.preventDefault();
      }
    });
  });
}

function buildValidHistoryCandidate(candidate) {
  if (
    !candidate ||
    typeof candidate !== "object" ||
    !ALLOWED_CALCULATORS.has(candidate.calculator)
  ) {
    return null;
  }
  const fields = [
    candidate.calculatorLabel,
    candidate.inputA,
    candidate.inputB,
    candidate.inputsText,
    candidate.resultText,
    candidate.copyText
  ];
  const valid = fields.every(
    (v) =>
      typeof v === "string" &&
      v.trim().length > 0 &&
      v.length <= MAX_FIELD_LEN
  );
  if (!valid) return null;
  const inputC = candidate.inputC;
  if (
    (candidate.calculator === "tip" || inputC != null) &&
    (typeof inputC !== "string" ||
      inputC.trim().length === 0 ||
      inputC.length > MAX_FIELD_LEN)
  ) {
    return null;
  }
  if (candidate.calculator === "tip") {
    const cleanedC = sanitizeNumericString(inputC);
    if (!isFiniteDecimalString(cleanedC)) return null;
    const numC = Number(cleanedC);
    if (!Number.isFinite(numC) || !Number.isInteger(numC) || numC < 1) return null;
  }
  const mode = candidate.mode ?? null;
  if (mode !== null && mode !== "add" && mode !== "extract") {
    return null;
  }
  const validated = { ...candidate };
  if (inputC == null) delete validated.inputC;
  return validated;
}

function setLines(el, lines) {
  if (!el) return;
  el.replaceChildren();
  lines.forEach((line, idx) => {
    if (idx > 0) el.appendChild(document.createElement("br"));
    el.appendChild(document.createTextNode(line));
  });
}

function setFormulaError(el, formula, errorNote) {
  if (!el) return;
  const errSpan = document.createElement("span");
  errSpan.className = "error-text";
  errSpan.textContent = errorNote;
  el.replaceChildren(document.createTextNode(`${formula} `), errSpan);
}

function setResult(resultId, content, isError = false) {
  const el = document.getElementById(resultId);
  if (!el) return;

  const prefix = document.createElement("span");
  prefix.className = "result-prefix";
  prefix.textContent = "=";

  if (isError) {
    const errSpan = document.createElement("span");
    errSpan.className = "error-text";
    errSpan.textContent = content;
    el.replaceChildren(prefix, errSpan);
    return;
  }

  const parts = String(content).split("<br>");
  const nodes = [prefix];
  parts.forEach((part, idx) => {
    if (idx > 0) nodes.push(document.createElement("br"));
    nodes.push(document.createTextNode(part));
  });
  el.replaceChildren(...nodes);
}

function showCopyFeedback(button) {
  if (!button) return;

  const originalText = button.dataset.label || button.textContent;
  button.dataset.label = originalText;
  button.textContent = "copied";
  button.classList.add("copied");
  window.clearTimeout(Number(button.dataset.copyTimer || 0));

  const timer = window.setTimeout(() => {
    button.textContent = originalText;
    button.classList.remove("copied");
  }, COPY_FEEDBACK_MS);
  button.dataset.copyTimer = String(timer);
}

async function copyText(text, button) {
  if (typeof text !== "string" || text.trim() === "") return false;
  const copyBytes =
    typeof TextEncoder === "function"
      ? new TextEncoder().encode(text).length
      : text.length;
  if (copyBytes > MAX_COPY_LEN) return false;
  try {
    await invoke("copy_text", { text });
    showCopyFeedback(button);
    return true;
  } catch {
    try {
      await navigator.clipboard.writeText(text);
      showCopyFeedback(button);
      return true;
    } catch {
      // Clipboard failures should not interrupt the calculator.
      return false;
    }
  }
}

async function copyCardResult(key, button) {
  const calc = lastValidCalc[key];
  if (!calc || !calc.copyText) return false;
  const copied = await copyText(calc.copyText, button);
  if (!copied) return false;
  await recordHistoryFor(key);
  return true;
}

function swapFields(aId, bId, updateFn) {
  const elA = document.getElementById(aId);
  const elB = document.getElementById(bId);
  if (!elA || !elB) return Promise.resolve();
  const tmp = elA.value;
  elA.value = elB.value;
  elB.value = tmp;
  return updateFn();
}

function attachEnterKey(ids, computeAndRecordFn) {
  ids.forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener("keydown", (event) => {
      if (event.key === "Enter") computeAndRecordFn();
    });
  });
}

function fmtFormulaText(text) {
  const trimmed = String(text ?? "").trim();
  return trimmed.startsWith("-") ? `(${trimmed})` : trimmed;
}

function setCardOutOfRange(
  key,
  formulaDiv,
  resultSpan,
  resultId,
  defaultFormula
) {
  lastValidCalc[key] = null;
  if (Array.isArray(defaultFormula)) {
    setLines(formulaDiv, defaultFormula);
  } else {
    formulaDiv.textContent = defaultFormula;
  }
  resultSpan.textContent = "→ invalid";
  setResult(resultId, "Value out of range", true);
}

function allFiniteValues(obj, keys, textKeys = []) {
  return (
    Boolean(obj) &&
    keys.every(
      (k) =>
        typeof obj[k] === "number" &&
        Number.isFinite(obj[k]) &&
        Number.isFinite(obj[k] * 100)
    ) &&
    textKeys.every(
      (k) => typeof obj[k] === "string" && !obj[k].includes("Infinity")
    )
  );
}

async function updateChangeLive() {
  const ticket = ++seq.change;
  const orig = getNumber("changeOrig");
  const newVal = getNumber("changeNew");
  const formulaDiv = document.getElementById("changeLiveFormula");
  const resultSpan = document.getElementById("changeLiveResult");
  const defaultFormula = "((new − original) / original) × 100";

  if (orig === null || newVal === null) {
    lastValidCalc.change = null;
    formulaDiv.textContent = defaultFormula;
    resultSpan.textContent = "→ —";
    setResult("changeResult", "—");
    return;
  }

  if (!Number.isFinite(orig) || !Number.isFinite(newVal)) {
    setCardOutOfRange("change", formulaDiv, resultSpan, "changeResult", defaultFormula);
    return;
  }

  lastValidCalc.change = null;
  try {
    const result = await invoke("calc_change", {
      originalValue: orig,
      newValue: newVal
    });
    if (ticket !== seq.change) return;

    if (result.ok === "false") {
      lastValidCalc.change = null;
      setFormulaError(formulaDiv, defaultFormula, "(original cannot be zero)");
      resultSpan.textContent = "→ invalid";
      setResult("changeResult", result.error, true);
      return;
    }

    if (!allFiniteValues(result, ["value"], ["label", "liveResult"])) {
      setCardOutOfRange("change", formulaDiv, resultSpan, "changeResult", defaultFormula);
      return;
    }

    formulaDiv.textContent = `((${fmtFormulaNum(newVal)} − ${fmtFormulaNum(orig)}) / ${fmtFormulaNum(orig)}) × 100`;
    resultSpan.textContent = `→ ${result.liveResult}`;
    setResult("changeResult", result.label);

    lastValidCalc.change = {
      calculator: "change",
      calculatorLabel: "Percentage Change",
      inputA: getRawInput("changeOrig"),
      inputB: getRawInput("changeNew"),
      mode: null,
      inputsText: `${orig} → ${newVal}`,
      resultText: result.label,
      copyText: result.label
    };
  } catch {
    if (ticket !== seq.change) return;
    setCardOutOfRange("change", formulaDiv, resultSpan, "changeResult", defaultFormula);
  }
}

async function updatePercentLive() {
  const ticket = ++seq.percent;
  const x = getNumber("isWhatX");
  const y = getNumber("isWhatY");
  const formulaDiv = document.getElementById("percentLiveFormula");
  const resultSpan = document.getElementById("percentLiveResult");
  const defaultFormula = "(X / Y) × 100";

  if (x === null || y === null) {
    lastValidCalc.percent = null;
    formulaDiv.textContent = defaultFormula;
    resultSpan.textContent = "→ —";
    setResult("percentResult", "—");
    return;
  }

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    setCardOutOfRange("percent", formulaDiv, resultSpan, "percentResult", defaultFormula);
    return;
  }

  lastValidCalc.percent = null;
  try {
    const result = await invoke("calc_percent_of_total", { part: x, total: y });
    if (ticket !== seq.percent) return;

    if (result.ok === "false") {
      lastValidCalc.percent = null;
      setFormulaError(formulaDiv, defaultFormula, "(Y cannot be zero)");
      resultSpan.textContent = "→ invalid";
      setResult("percentResult", result.error, true);
      return;
    }

    if (!allFiniteValues(result, ["value"], ["label", "liveResult"])) {
      setCardOutOfRange("percent", formulaDiv, resultSpan, "percentResult", defaultFormula);
      return;
    }

    formulaDiv.textContent = `(${fmtFormulaNum(x)} / ${fmtFormulaNum(y)}) × 100`;
    resultSpan.textContent = `→ ${result.label}`;
    setResult("percentResult", result.label);

    lastValidCalc.percent = {
      calculator: "percent",
      calculatorLabel: "Percentage of Total",
      inputA: getRawInput("isWhatX"),
      inputB: getRawInput("isWhatY"),
      mode: null,
      inputsText: `${x} of ${y}`,
      resultText: result.label,
      copyText: result.label
    };
  } catch {
    if (ticket !== seq.percent) return;
    setCardOutOfRange("percent", formulaDiv, resultSpan, "percentResult", defaultFormula);
  }
}

async function updateWhatLive() {
  const ticket = ++seq.what;
  const x = getNumber("whatX");
  const y = getNumber("whatY");
  const formulaDiv = document.getElementById("whatLiveFormula");
  const resultSpan = document.getElementById("whatLiveResult");
  const defaultFormula = "(X / 100) × Y";

  if (x === null || y === null) {
    lastValidCalc.what = null;
    formulaDiv.textContent = defaultFormula;
    resultSpan.textContent = "→ —";
    setResult("whatResult", "—");
    return;
  }

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    setCardOutOfRange("what", formulaDiv, resultSpan, "whatResult", defaultFormula);
    return;
  }

  lastValidCalc.what = null;
  try {
    const result = await invoke("calc_portion", { percent: x, number: y });
    if (ticket !== seq.what) return;

    if (!allFiniteValues(result, ["value"], ["label", "liveResult"])) {
      setCardOutOfRange("what", formulaDiv, resultSpan, "whatResult", defaultFormula);
      return;
    }

    formulaDiv.textContent = `(${fmtFormulaNum(x)} / 100) × ${fmtFormulaNum(y)}`;
    resultSpan.textContent = `→ ${result.label}`;
    setResult("whatResult", result.label);

    lastValidCalc.what = {
      calculator: "what",
      calculatorLabel: "Calculate Percentage",
      inputA: getRawInput("whatX"),
      inputB: getRawInput("whatY"),
      mode: null,
      inputsText: `${x}% of ${y}`,
      resultText: result.label,
      copyText: result.label
    };
  } catch {
    if (ticket !== seq.what) return;
    setCardOutOfRange("what", formulaDiv, resultSpan, "whatResult", defaultFormula);
  }
}

async function updateDiscountLive() {
  const ticket = ++seq.discount;
  const price = getNumber("discountPrice");
  const disc = getNumber("discountPercent");
  const formulaDiv = document.getElementById("discountLiveFormula");
  const resultSpan = document.getElementById("discountLiveResult");
  const defaultLines = [
    "final = price × (1 − discount/100)",
    "saved = price × discount/100"
  ];

  if (price === null || disc === null) {
    lastValidCalc.discount = null;
    setLines(formulaDiv, defaultLines);
    resultSpan.textContent = "→ —";
    setResult("discountResult", "—");
    return;
  }

  if (!Number.isFinite(price) || !Number.isFinite(disc)) {
    setCardOutOfRange("discount", formulaDiv, resultSpan, "discountResult", defaultLines);
    return;
  }

  lastValidCalc.discount = null;
  try {
    const result = await invoke("calc_discount", {
      price,
      discountPercent: disc
    });
    if (ticket !== seq.discount) return;

    if (
      !allFiniteValues(
        result,
        ["finalPrice", "saved"],
        ["finalText", "savedText", "label", "copyText"]
      )
    ) {
      setCardOutOfRange("discount", formulaDiv, resultSpan, "discountResult", defaultLines);
      return;
    }

    setLines(formulaDiv, [
      `final = ${fmtFormulaNum(price)} × (1 − ${fmtFormulaNum(disc)}/100) = ${result.finalText}`,
      `saved = ${fmtFormulaNum(price)} × ${fmtFormulaNum(disc)}/100 = ${result.savedText}`
    ]);
    resultSpan.textContent = `→ final: ${result.finalText} | saved: ${result.savedText}`;
    setResult("discountResult", result.label);

    lastValidCalc.discount = {
      calculator: "discount",
      calculatorLabel: "Discount",
      inputA: getRawInput("discountPrice"),
      inputB: getRawInput("discountPercent"),
      mode: null,
      inputsText: `${price} (−${disc}%)`,
      resultText: `Final: ${result.finalText} · Saved: ${result.savedText}`,
      copyText: result.copyText
    };
  } catch {
    if (ticket !== seq.discount) return;
    setCardOutOfRange("discount", formulaDiv, resultSpan, "discountResult", defaultLines);
  }
}

async function updateBaseLive() {
  const ticket = ++seq.base;
  const x = getNumber("baseX");
  const y = getNumber("baseY");
  const formulaDiv = document.getElementById("baseLiveFormula");
  const resultSpan = document.getElementById("baseLiveResult");
  const defaultFormula = "X / (Y / 100)";

  if (x === null || y === null) {
    lastValidCalc.base = null;
    formulaDiv.textContent = defaultFormula;
    resultSpan.textContent = "→ —";
    setResult("baseResult", "—");
    return;
  }

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    setCardOutOfRange("base", formulaDiv, resultSpan, "baseResult", defaultFormula);
    return;
  }

  lastValidCalc.base = null;
  try {
    const result = await invoke("calc_original", { value: x, percent: y });
    if (ticket !== seq.base) return;

    if (result.ok === "false") {
      lastValidCalc.base = null;
      setFormulaError(formulaDiv, defaultFormula, "(Y cannot be zero)");
      resultSpan.textContent = "→ invalid";
      setResult("baseResult", result.error, true);
      return;
    }

    if (!allFiniteValues(result, ["value"], ["label", "liveResult"])) {
      setCardOutOfRange("base", formulaDiv, resultSpan, "baseResult", defaultFormula);
      return;
    }

    formulaDiv.textContent = `${fmtFormulaNum(x)} / (${fmtFormulaNum(y)} / 100)`;
    resultSpan.textContent = `→ ${result.label}`;
    setResult("baseResult", result.label);

    lastValidCalc.base = {
      calculator: "base",
      calculatorLabel: "Find Original Value",
      inputA: getRawInput("baseX"),
      inputB: getRawInput("baseY"),
      mode: null,
      inputsText: `${x} is ${y}%`,
      resultText: result.label,
      copyText: result.label
    };
  } catch {
    if (ticket !== seq.base) return;
    setCardOutOfRange("base", formulaDiv, resultSpan, "baseResult", defaultFormula);
  }
}

async function updateMarkupLive() {
  const ticket = ++seq.markup;
  const cost = getNumber("markupCost");
  const price = getNumber("markupPrice");
  const formulaDiv = document.getElementById("markupLiveFormula");
  const resultSpan = document.getElementById("markupLiveResult");
  const defaultLines = [
    "profit = price − cost",
    "markup = (profit / cost) × 100",
    "margin = (profit / price) × 100"
  ];

  if (cost === null || price === null) {
    lastValidCalc.markup = null;
    setLines(formulaDiv, defaultLines);
    resultSpan.textContent = "→ —";
    setResult("markupResult", "—");
    return;
  }

  if (!Number.isFinite(cost) || !Number.isFinite(price)) {
    setCardOutOfRange("markup", formulaDiv, resultSpan, "markupResult", defaultLines);
    return;
  }

  lastValidCalc.markup = null;
  try {
    const result = await invoke("calc_markup_margin", {
      cost,
      sellingPrice: price
    });
    if (ticket !== seq.markup) return;

    if (result.ok === "false") {
      lastValidCalc.markup = null;
      setFormulaError(
        formulaDiv,
        "markup = (price − cost) / cost × 100",
        `(${result.error.toLowerCase()})`
      );
      resultSpan.textContent = "→ invalid";
      setResult("markupResult", result.error, true);
      return;
    }

    if (
      !allFiniteValues(
        result,
        ["profit", "markup", "margin"],
        ["profitText", "markupText", "marginText", "label", "liveResult", "copyText"]
      )
    ) {
      setCardOutOfRange("markup", formulaDiv, resultSpan, "markupResult", defaultLines);
      return;
    }

    setLines(formulaDiv, [
      `profit = ${fmtFormulaNum(price)} − ${fmtFormulaNum(cost)} = ${result.profitText}`,
      `markup = (${fmtFormulaText(result.profitText)} / ${fmtFormulaNum(cost)}) × 100 = ${result.markupText}`,
      `margin = (${fmtFormulaText(result.profitText)} / ${fmtFormulaNum(price)}) × 100 = ${result.marginText}`
    ]);
    resultSpan.textContent = `→ ${result.liveResult}`;
    setResult("markupResult", result.label);

    lastValidCalc.markup = {
      calculator: "markup",
      calculatorLabel: "Markup & Margin",
      inputA: getRawInput("markupCost"),
      inputB: getRawInput("markupPrice"),
      mode: null,
      inputsText: `Cost ${cost} → Price ${price}`,
      resultText: `Profit: ${result.profitText} · Markup: ${result.markupText} · Margin: ${result.marginText}`,
      copyText: result.copyText
    };
  } catch {
    if (ticket !== seq.markup) return;
    setCardOutOfRange("markup", formulaDiv, resultSpan, "markupResult", defaultLines);
  }
}

function setTaxMode(newMode, triggerUpdate = true) {
  taxMode = newMode === "extract" ? "extract" : "add";
  const addBtn = document.getElementById("taxModeAddBtn");
  const extractBtn = document.getElementById("taxModeExtractBtn");
  const amountLabel = document.getElementById("taxAmountLabel");
  const amountInput = document.getElementById("taxAmount");

  if (taxMode === "extract") {
    addBtn.classList.remove("active");
    extractBtn.classList.add("active");
    amountLabel.textContent = "Total amount (tax-inclusive)";
    amountInput.placeholder = "e.g., 115";
  } else {
    extractBtn.classList.remove("active");
    addBtn.classList.add("active");
    amountLabel.textContent = "Net amount (before tax)";
    amountInput.placeholder = "e.g., 100";
  }

  if (triggerUpdate) {
    return updateTaxLive();
  }
  return Promise.resolve();
}

async function updateTaxLive() {
  const ticket = ++seq.tax;
  const amount = getNumber("taxAmount");
  const rate = getNumber("taxRate");
  const mode = taxMode;
  const formulaDiv = document.getElementById("taxLiveFormula");
  const resultSpan = document.getElementById("taxLiveResult");
  const defaultLines =
    mode === "extract"
      ? ["net = total / (1 + rate/100)", "tax = total − net"]
      : ["tax = net × (rate / 100)", "total = net + tax"];

  if (amount === null || rate === null) {
    lastValidCalc.tax = null;
    setLines(formulaDiv, defaultLines);
    resultSpan.textContent = "→ —";
    setResult("taxResult", "—");
    return;
  }

  if (!Number.isFinite(amount) || !Number.isFinite(rate)) {
    setCardOutOfRange("tax", formulaDiv, resultSpan, "taxResult", defaultLines);
    return;
  }

  lastValidCalc.tax = null;
  try {
    const result = await invoke("calc_tax", {
      amount,
      ratePercent: rate,
      mode
    });
    if (ticket !== seq.tax) return;

    if (result.ok === "false") {
      lastValidCalc.tax = null;
      setFormulaError(
        formulaDiv,
        "net = total / (1 + rate/100)",
        `(${result.error.toLowerCase()})`
      );
      resultSpan.textContent = "→ invalid";
      setResult("taxResult", result.error, true);
      return;
    }

    if (
      !allFiniteValues(
        result,
        ["net", "tax", "total"],
        ["netText", "taxText", "totalText", "label", "liveResult", "copyText"]
      )
    ) {
      setCardOutOfRange("tax", formulaDiv, resultSpan, "taxResult", defaultLines);
      return;
    }

    if (mode === "extract") {
      setLines(formulaDiv, [
        `net = ${fmtFormulaNum(amount)} / (1 + ${fmtFormulaNum(rate)}/100) = ${result.netText}`,
        `tax = ${fmtFormulaNum(amount)} − ${fmtFormulaText(result.netText)} = ${result.taxText}`
      ]);
    } else {
      setLines(formulaDiv, [
        `tax = ${fmtFormulaNum(amount)} × (${fmtFormulaNum(rate)} / 100) = ${result.taxText}`,
        `total = ${fmtFormulaNum(amount)} + ${fmtFormulaText(result.taxText)} = ${result.totalText}`
      ]);
    }
    resultSpan.textContent = `→ ${result.liveResult}`;
    setResult("taxResult", result.label);

    lastValidCalc.tax = {
      calculator: "tax",
      calculatorLabel: mode === "extract" ? "Tax / VAT (Extract)" : "Tax / VAT (Add)",
      inputA: getRawInput("taxAmount"),
      inputB: getRawInput("taxRate"),
      mode,
      inputsText:
        mode === "extract"
          ? `${amount} incl. ${rate}% tax`
          : `${amount} + ${rate}% tax`,
      resultText:
        mode === "extract"
          ? `Net: ${result.netText} · Tax: ${result.taxText}`
          : `Total: ${result.totalText} · Tax: ${result.taxText}`,
      copyText: result.copyText
    };
  } catch {
    if (ticket !== seq.tax) return;
    setCardOutOfRange("tax", formulaDiv, resultSpan, "taxResult", defaultLines);
  }
}

async function updateTipLive() {
  const ticket = ++seq.tip;
  const bill = getNumber("tipBill");
  const tipPercent = getNumber("tipPercent");
  const people = getNumber("tipPeople");
  const formulaDiv = document.getElementById("tipLiveFormula");
  const resultSpan = document.getElementById("tipLiveResult");
  const defaultLines = [
    "Tip = bill × (tip / 100)",
    "Total = bill + tip",
    "Each (÷people) = total / people"
  ];

  lastValidCalc.tip = null;
  if (bill === null || tipPercent === null || people === null) {
    setLines(formulaDiv, defaultLines);
    resultSpan.textContent = "→ —";
    setResult("tipResult", "—");
    return;
  }
  if (![bill, tipPercent, people].every(Number.isFinite)) {
    setCardOutOfRange("tip", formulaDiv, resultSpan, "tipResult", defaultLines);
    return;
  }

  try {
    const result = await invoke("calc_tip_split", { bill, tipPercent, people });
    if (ticket !== seq.tip) return;
    if (result.ok === "false") {
      setFormulaError(formulaDiv, defaultLines[0], `(${result.error})`);
      resultSpan.textContent = "→ invalid";
      setResult("tipResult", result.error, true);
      return;
    }
    if (!allFiniteValues(
      result,
      ["tipAmount", "totalBill", "perPerson"],
      ["tipText", "totalText", "perPersonText", "label", "liveResult", "copyText"]
    )) {
      setCardOutOfRange("tip", formulaDiv, resultSpan, "tipResult", defaultLines);
      return;
    }
    setLines(formulaDiv, [
      `Tip = ${fmtFormulaNum(bill)} × (${fmtFormulaNum(tipPercent)} / 100) = ${result.tipText}`,
      `Total = ${fmtFormulaNum(bill)} + ${fmtFormulaText(result.tipText)} = ${result.totalText}`,
      `Each (÷${fmtFormulaNum(people)}) = ${fmtFormulaText(result.totalText)} / ${fmtFormulaNum(people)} = ${result.perPersonText}`
    ]);
    resultSpan.textContent = `→ ${result.liveResult}`;
    setResult("tipResult", result.label);
    lastValidCalc.tip = {
      calculator: "tip",
      calculatorLabel: "Tip & Bill Split",
      inputA: getRawInput("tipBill"),
      inputB: getRawInput("tipPercent"),
      inputC: getRawInput("tipPeople"),
      mode: null,
      inputsText: `Bill ${bill} + ${tipPercent}% tip ÷ ${people}`,
      resultText: `Tip: ${result.tipText} · Total: ${result.totalText} · Each: ${result.perPersonText}`,
      copyText: result.copyText
    };
  } catch {
    if (ticket !== seq.tip) return;
    setCardOutOfRange("tip", formulaDiv, resultSpan, "tipResult", defaultLines);
  }
}

function resetTip() {
  document.getElementById("tipBill").value = "";
  document.getElementById("tipPercent").value = "";
  document.getElementById("tipPeople").value = "1";
  return updateTipLive();
}

function formatHistoryTime(timestampMs) {
  if (!timestampMs) return "---- --:--:--";
  const date = new Date(timestampMs);
  if (Number.isNaN(date.getTime())) return "---- --:--:--";
  const pad = (n) => String(n).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${year}-${month}-${day} ${hh}:${mm}:${ss}`;
}

function flashRestoredCard(cardId) {
  const cardEl = document.getElementById(cardId);
  if (!cardEl) return;
  cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
  cardEl.classList.remove("card-restored");
  void cardEl.offsetWidth;
  cardEl.classList.add("card-restored");
  window.clearTimeout(Number(cardEl.dataset.restoreTimer || 0));
  const timer = window.setTimeout(() => {
    cardEl.classList.remove("card-restored");
  }, 900);
  cardEl.dataset.restoreTimer = String(timer);
}

async function restoreHistoryEntry(entry) {
  const map = {
    change: {
      card: "card-change",
      a: "changeOrig",
      b: "changeNew",
      fn: updateChangeLive
    },
    percent: {
      card: "card-percent",
      a: "isWhatX",
      b: "isWhatY",
      fn: updatePercentLive
    },
    what: { card: "card-what", a: "whatX", b: "whatY", fn: updateWhatLive },
    discount: {
      card: "card-discount",
      a: "discountPrice",
      b: "discountPercent",
      fn: updateDiscountLive
    },
    base: { card: "card-base", a: "baseX", b: "baseY", fn: updateBaseLive },
    markup: {
      card: "card-markup",
      a: "markupCost",
      b: "markupPrice",
      fn: updateMarkupLive
    },
    tax: { card: "card-tax", a: "taxAmount", b: "taxRate", fn: updateTaxLive },
    tip: { card: "card-tip", a: "tipBill", b: "tipPercent", c: "tipPeople", fn: updateTipLive }
  };

  if (!buildValidHistoryCandidate(entry) || !Object.hasOwn(map, entry.calculator)) return;
  const target = map[entry.calculator];

  expandCard(entry.calculator);

  if (entry.calculator === "tax" && entry.mode) {
    await setTaxMode(entry.mode, false);
  }

  const elA = document.getElementById(target.a);
  const elB = document.getElementById(target.b);
  if (!elA || !elB) return;

  elA.value = entry.inputA;
  elB.value = entry.inputB;
  if (target.c) document.getElementById(target.c).value = entry.inputC;
  await target.fn();
  flashRestoredCard(target.card);
  elA.focus({ preventScroll: true });
}

function renderHistory(entries) {
  const countEl = document.getElementById("historyCount");
  const listEl = document.getElementById("historyList");
  if (!countEl || !listEl) return;

  if (Array.isArray(entries)) {
    allHistoryEntries = entries;
  }

  countEl.textContent = `(${allHistoryEntries.length} / ${historyLimit})`;
  listEl.replaceChildren();

  const filterEl = document.getElementById("historyFilter");
  if (filterEl) {
    historyFilterValue = filterEl.value || "all";
  }
  const visibleList =
    historyFilterValue === "all"
      ? allHistoryEntries
      : allHistoryEntries.filter(
          (entry) => entry.calculator === historyFilterValue
        );

  if (visibleList.length === 0) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "history-empty";
    emptyDiv.textContent =
      allHistoryEntries.length === 0
        ? "No calculations recorded yet. Press calculate, Enter, or copy on any card to save to history."
        : "No matching calculations for this filter.";
    listEl.appendChild(emptyDiv);
    return;
  }

  visibleList.forEach((entry) => {
    const item = document.createElement("div");
    item.className = "history-item";

    const main = document.createElement("div");
    main.className = "history-main";

    const timeSpan = document.createElement("span");
    timeSpan.className = "history-time";
    timeSpan.textContent = formatHistoryTime(entry.timestampMs);

    const calcSpan = document.createElement("span");
    calcSpan.className = "history-calc";
    calcSpan.textContent = entry.calculatorLabel;

    const inputsSpan = document.createElement("span");
    inputsSpan.className = "history-inputs";
    inputsSpan.textContent = entry.inputsText;

    const arrowSpan = document.createElement("span");
    arrowSpan.className = "history-arrow";
    arrowSpan.textContent = "→";

    const resultSpan = document.createElement("span");
    resultSpan.className = "history-result";
    resultSpan.textContent = entry.resultText;

    main.append(timeSpan, calcSpan, inputsSpan, arrowSpan, resultSpan);

    const actions = document.createElement("div");
    actions.className = "history-row-actions";

    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn history-copy-btn";
    copyBtn.type = "button";
    copyBtn.textContent = "copy";
    copyBtn.addEventListener("click", (event) => {
      copyText(entry.copyText || entry.resultText, event.currentTarget);
    });

    const restoreBtn = document.createElement("button");
    restoreBtn.className = "reset-btn history-restore-btn";
    restoreBtn.type = "button";
    restoreBtn.textContent = "↺ restore";
    restoreBtn.addEventListener("click", () => {
      restoreHistoryEntry(entry);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "reset-btn history-delete-btn";
    deleteBtn.type = "button";
    deleteBtn.textContent = "×";
    deleteBtn.title = "Delete history entry";
    deleteBtn.setAttribute("aria-label", "Delete history entry");
    deleteBtn.addEventListener("click", () => {
      deleteHistoryEntry(entry.id);
    });

    actions.append(copyBtn, restoreBtn, deleteBtn);
    item.append(main, actions);
    listEl.appendChild(item);
  });
}

async function deleteHistoryEntry(id) {
  try {
    const updated = await invoke("history_delete", { id });
    renderHistory(updated);
  } catch {
    // History delete errors should not interrupt calculator usage.
  }
}

async function recordHistoryFor(key) {
  const entry = buildValidHistoryCandidate(lastValidCalc[key]);
  if (!entry) return;
  try {
    const updated = await invoke("history_add", { entry });
    renderHistory(updated);
  } catch {
    // History write errors should not interrupt calculator usage.
  }
}

async function loadHistory() {
  try {
    const entries = await invoke("history_list");
    renderHistory(entries);
  } catch {
    renderHistory([]);
  }
}

function resetFields(inputIds, resultId, updateFn) {
  inputIds.forEach((id) => {
    document.getElementById(id).value = "";
  });
  setResult(resultId, "—");
  return updateFn();
}

function clearAllCalculators() {
  resetFields(["changeOrig", "changeNew"], "changeResult", updateChangeLive);
  resetFields(["isWhatX", "isWhatY"], "percentResult", updatePercentLive);
  resetFields(["whatX", "whatY"], "whatResult", updateWhatLive);
  resetFields(
    ["discountPrice", "discountPercent"],
    "discountResult",
    updateDiscountLive
  );
  resetFields(["baseX", "baseY"], "baseResult", updateBaseLive);
  resetFields(["markupCost", "markupPrice"], "markupResult", updateMarkupLive);
  resetFields(["taxAmount", "taxRate"], "taxResult", updateTaxLive);
  resetTip();
  document.getElementById("changeOrig").focus();
}

function renderCreditPills(containerId, names, pillClass) {
  const container = document.getElementById(containerId);
  if (!container || !Array.isArray(names) || names.length === 0) return;
  container.replaceChildren();
  names.forEach((name, idx) => {
    if (idx > 0) {
      const dot = document.createElement("span");
      dot.className = "credit-dot";
      dot.textContent = "·";
      container.appendChild(dot);
    }
    const pill = document.createElement("span");
    pill.className = `credit-pill ${pillClass}`;
    pill.textContent = name;
    container.appendChild(pill);
  });
}

function openAboutModal() {
  const modal = document.getElementById("aboutModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  document.getElementById("closeAboutBtn")?.focus();
}

function closeAboutModal() {
  const modal = document.getElementById("aboutModal");
  if (!modal) return;
  modal.classList.add("hidden");
  document.getElementById("aboutBtn")?.focus();
}

async function syncAppInfo() {
  try {
    const appInfo = await invoke("get_app_info");
    document.getElementById("appVersion").textContent = `Desktop v${appInfo.version}`;
    document.getElementById("aboutAppName").textContent = appInfo.name;
    document.getElementById(
      "aboutVersionPill"
    ).textContent = `Desktop v${appInfo.version} · Tauri v2 + Rust`;
    document.getElementById("aboutPrivacyText").textContent = appInfo.privacy;
    const webAppEl = document.getElementById("webAppUrlText");
    if (webAppEl) webAppEl.textContent = WEB_APP_URL;
    if (typeof appInfo.historyLimit === "number") {
      historyLimit = appInfo.historyLimit;
    }
    renderCreditPills("aboutCreatorsRow", appInfo.creators, "credit-pill-gold");
    renderCreditPills("aboutAiRow", appInfo.aiBuilders, "credit-pill-slate");
  } catch {
    // Keep the static fallback version in index.html if outside Tauri.
  }
}

const DEFAULT_CARD_ORDER = Object.freeze([
  "change", "percent", "what", "discount", "base", "markup", "tax", "tip"
]);

function normalizeSettings(settings) {
  const has = (key) => settings && typeof settings === "object" && Object.hasOwn(settings, key);
  const validKey = (key) => typeof key === "string" && ALLOWED_CALCULATORS.has(key);
  const order = has("cardOrder") ? settings.cardOrder : null;
  const collapsed = has("collapsedCards") ? settings.collapsedCards : null;
  return {
    checkUpdatesOnStartup: has("checkUpdatesOnStartup") && typeof settings.checkUpdatesOnStartup === "boolean"
      ? settings.checkUpdatesOnStartup : true,
    cardOrder: Array.isArray(order) && order.length === DEFAULT_CARD_ORDER.length &&
      new Set(order).size === DEFAULT_CARD_ORDER.length && Array.from(order).every(validKey)
      ? [...order] : [...DEFAULT_CARD_ORDER],
    collapsedCards: Array.isArray(collapsed) && Array.from(collapsed).every(validKey) &&
      new Set(collapsed).size === collapsed.length ? [...collapsed] : []
  };
}

let currentSettings = normalizeSettings(null);
let lastPersistedSettings = normalizeSettings(null);
let settingsSeq = 0;
let settingsLoadPromise = Promise.resolve();
let settingsSaveQueue = Promise.resolve();
let latestReleaseUrl = RELEASE_URL;
let cardDrag = null;

function syncQuickNav(order) {
  const nav = document.querySelector(".quick-nav");
  if (!nav) return;
  const links = Array.from(nav.querySelectorAll(".quick-link[data-calc]"));
  for (const [index, key] of order.entries()) {
    const link = links.find((item) => item.dataset.calc === key);
    if (link && nav.children[index] !== link) {
      nav.insertBefore(link, nav.children[index] ?? null);
    }
  }
  const historyLink = nav.querySelector('.quick-link[href="#historySection"]');
  if (historyLink && nav.children[nav.children.length - 1] !== historyLink) nav.appendChild(historyLink);
}

function applySettings(settings) {
  const container = document.getElementById("cardsContainer");
  for (const [index, key] of settings.cardOrder.entries()) {
    const card = document.getElementById(`card-${key}`);
    if (!card) continue;
    if (container && container.children[index] !== card) {
      container.insertBefore(card, container.children[index] ?? null);
    }
    const collapsed = settings.collapsedCards.includes(key);
    card.classList.toggle("card-collapsed", collapsed);
    const button = card.querySelector(".collapse-btn");
    button?.setAttribute("aria-expanded", String(!collapsed));
    if (button) button.textContent = collapsed ? "[ + ]" : "[ − ]";
  }
  syncQuickNav(settings.cardOrder);
  const toggle = document.getElementById("autoUpdateToggle");
  if (toggle) toggle.checked = settings.checkUpdatesOnStartup;
}

function saveSettings(changesOrUpdater, { keepExpandedOnError } = {}) {
  const ticket = ++settingsSeq;
  const optimisticPatch = typeof changesOrUpdater === "function" ? changesOrUpdater(currentSettings) : changesOrUpdater;
  currentSettings = normalizeSettings({ ...currentSettings, ...optimisticPatch });
  applySettings(currentSettings);

  // Serialize writes as well as guarding UI replies: the backend must finish
  // an earlier write before a newer snapshot can become persistent state.
  const save = settingsSaveQueue.then(async () => {
    try {
      await settingsLoadPromise;
      const patch = typeof changesOrUpdater === "function" ? changesOrUpdater(lastPersistedSettings) : changesOrUpdater;
      const next = normalizeSettings({ ...lastPersistedSettings, ...patch });
      const saved = await invoke("set_settings", { settings: next });
      lastPersistedSettings = normalizeSettings(saved ?? next);
      if (ticket === settingsSeq) {
        currentSettings = normalizeSettings(lastPersistedSettings);
        applySettings(currentSettings);
      }
      return true;
    } catch {
      if (ticket === settingsSeq) {
        currentSettings = normalizeSettings(lastPersistedSettings);
        applySettings(currentSettings);
        if (keepExpandedOnError) showExpandedCard(keepExpandedOnError);
        setUpdateStatus("Failed to save settings. Restored the last saved layout and preferences.", true);
      }
      return false;
    }
  });
  settingsSaveQueue = save;
  return save;
}

function showExpandedCard(key) {
  const card = document.getElementById(`card-${key}`);
  card?.classList.remove("card-collapsed");
  const button = card?.querySelector(".collapse-btn");
  button?.setAttribute("aria-expanded", "true");
  if (button) button.textContent = "[ − ]";
}

function expandCard(key) {
  if (!ALLOWED_CALCULATORS.has(key)) return false;
  currentSettings.collapsedCards = currentSettings.collapsedCards.filter((item) => item !== key);
  showExpandedCard(key);
  void saveSettings((prev) => ({ collapsedCards: prev.collapsedCards.filter((item) => item !== key) }),
    { keepExpandedOnError: key });
  return true;
}

function clearCardDropHints() {
  document.querySelectorAll("#cardsContainer .calc-section").forEach((card) => {
    card.classList.remove("card-drop-before", "card-drop-after");
  });
}

function updateCardDropTarget(x, y) {
  if (!cardDrag) return;
  clearCardDropHints();
  cardDrag.target = null;
  const cards = [];
  for (const card of document.querySelectorAll("#cardsContainer .calc-section")) {
    if (card === cardDrag.card) continue;
    const rect = card.getBoundingClientRect?.();
    if (!rect || ![rect.top, rect.bottom, rect.left, rect.right].every(Number.isFinite)) continue;
    cards.push({ card, rect });
  }
  if (cards.length === 0) return;
  const containerRect = document.getElementById("cardsContainer")?.getBoundingClientRect?.();
  const inHorizontalBand = (containerRect && x >= containerRect.left - 80 && x <= containerRect.right + 80) ||
    cards.some(({ rect }) => x >= rect.left && x <= rect.right);
  if (!inHorizontalBand) return;
  let target;
  if (y < cards[0].rect.top) {
    target = cards[0];
  } else if (y > cards[cards.length - 1].rect.bottom) {
    target = cards[cards.length - 1];
  } else {
    const distance = ({ rect }) => Math.abs(y - (rect.top + rect.bottom) / 2);
    target = cards.reduce((closest, candidate) => distance(candidate) < distance(closest) ? candidate : closest);
  }
  cardDrag.target = target.card;
  cardDrag.after = y >= (target.rect.top + target.rect.bottom) / 2;
  target.card.classList.add(cardDrag.after ? "card-drop-after" : "card-drop-before");
}

function scrollCardDrag() {
  if (!cardDrag?.moved) return;
  const { x, y } = cardDrag;
  const edge = 60;
  const height = window.innerHeight;
  const delta = y < edge ? -12 : y > height - edge ? 12 : 0;
  if (delta !== 0) {
    window.scrollBy?.({ top: delta, behavior: "instant" });
    updateCardDropTarget(x, y);
    cardDrag.frame = window.requestAnimationFrame?.(scrollCardDrag);
  } else {
    cardDrag.frame = 0;
  }
}

function finishCardDrag(cancelled = false, event = null) {
  if (!cardDrag || (event && event.pointerId !== cardDrag.pointerId)) return;
  if (!cancelled && cardDrag.moved && event) {
    updateCardDropTarget(event.clientX, event.clientY);
  }
  const drag = cardDrag;
  cardDrag = null;
  window.cancelAnimationFrame?.(drag.frame);
  drag.card.classList.remove("card-dragging");
  clearCardDropHints();
  try {
    drag.handle.releasePointerCapture?.(drag.pointerId);
  } catch {
    // Synthetic events and a cancelled native pointer may have no capture.
  }
  if (cancelled || !drag.moved || !drag.target) return;
  const container = document.getElementById("cardsContainer");
  if (!container || drag.target.parentNode !== container) return;
  const targetIndex = Array.from(container.children).indexOf(drag.target);
  const reference = drag.after ? container.children[targetIndex + 1] ?? null : drag.target;
  if (reference !== drag.card) container.insertBefore(drag.card, reference);
  const cardOrder = Array.from(container.querySelectorAll(".calc-section"), (card) => card.dataset.calc);
  if (cardOrder.join() !== currentSettings.cardOrder.join()) saveSettings({ cardOrder });
}

function bindCardLayout() {
  document.querySelectorAll("#cardsContainer .calc-section").forEach((card) => {
    const key = card.dataset.calc;
    card.querySelector(".collapse-btn")?.addEventListener("click", () => {
      finishCardDrag(true);
      saveSettings((prev) => ({ collapsedCards: prev.collapsedCards.includes(key)
        ? prev.collapsedCards.filter((item) => item !== key) : [...prev.collapsedCards, key] }));
    });
    const handle = card.querySelector(".drag-handle");
    handle?.addEventListener("pointerdown", (event) => {
      if (cardDrag || event.button !== 0 || event.isPrimary === false) return;
      event.preventDefault();
      cardDrag = {
        card, handle, pointerId: event.pointerId,
        startX: event.clientX, startY: event.clientY,
        x: event.clientX, y: event.clientY, moved: false, target: null, after: false
      };
      try {
        handle.setPointerCapture?.(event.pointerId);
      } catch {
        // Document listeners also handle synthetic or uncaptured pointers.
      }
    });
    handle?.addEventListener("lostpointercapture", (event) => {
      if (cardDrag?.handle === handle) finishCardDrag(true, event);
    });
  });
  document.addEventListener("pointermove", (event) => {
    if (!cardDrag || event.pointerId !== cardDrag.pointerId) return;
    cardDrag.x = event.clientX;
    cardDrag.y = event.clientY;
    if (!cardDrag.moved) {
      if (Math.hypot(event.clientX - cardDrag.startX, event.clientY - cardDrag.startY) < 4) return;
      cardDrag.moved = true;
      cardDrag.card.classList.add("card-dragging");
    }
    if (cardDrag.moved && !cardDrag.frame && (event.clientY < 60 || event.clientY > window.innerHeight - 60)) {
      cardDrag.frame = window.requestAnimationFrame?.(scrollCardDrag);
    }
    event.preventDefault();
    updateCardDropTarget(event.clientX, event.clientY);
  });
  document.addEventListener("pointerup", (event) => finishCardDrag(false, event));
  document.addEventListener("pointercancel", (event) => finishCardDrag(true, event));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") finishCardDrag(true);
  });
  document.querySelectorAll(".quick-nav .quick-link[data-calc]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const key = link.dataset.calc;
      if (!currentSettings.collapsedCards.includes(key)) return;
      event.preventDefault();
      expandCard(key);
      window.location.hash = `card-${key}`;
      const card = document.getElementById(`card-${key}`);
      card?.scrollIntoView({ behavior: "smooth", block: "start" });
      card?.querySelector("input")?.focus({ preventScroll: true });
    });
  });
  document.getElementById("resetLayoutBtn")?.addEventListener("click", () => {
    finishCardDrag(true);
    saveSettings({ cardOrder: [...DEFAULT_CARD_ORDER], collapsedCards: [] });
  });
}

function openSettingsModal() {
  const modal = document.getElementById("settingsModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  document.getElementById("closeSettingsBtn")?.focus();
}

function closeSettingsModal() {
  const modal = document.getElementById("settingsModal");
  if (!modal) return;
  modal.classList.add("hidden");
  document.getElementById("settingsBtn")?.focus();
}

function setUpdateStatus(text, isError = false) {
  const statusEl = document.getElementById("updateStatusText");
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.classList.toggle("is-error", isError);
}

function showUpdateBanner(latestVersion, releaseUrl) {
  const banner = document.getElementById("updateBanner");
  const textEl = document.getElementById("updateBannerText");
  if (!banner || !textEl) return;
  latestReleaseUrl = releaseUrl || RELEASE_URL;
  textEl.textContent = `Update available: v${latestVersion} is now released on GitHub.`;
  banner.classList.remove("hidden");
}

function hideUpdateBanner() {
  const banner = document.getElementById("updateBanner");
  if (!banner) return;
  banner.classList.add("hidden");
}

function applyUpdateResult(result, showNoUpdateMessage = true) {
  if (!result) return;
  if (result.releaseUrl) {
    latestReleaseUrl = result.releaseUrl;
  }

  if (!result.ok) {
    if (showNoUpdateMessage) {
      setUpdateStatus(
        result.error || "Unable to reach GitHub Releases right now.",
        true
      );
    }
    return;
  }

  if (result.updateAvailable && result.latestVersion) {
    showUpdateBanner(result.latestVersion, result.releaseUrl);
    setUpdateStatus(
      `New version available: v${result.latestVersion} (current: v${result.currentVersion}).`,
      false
    );
  } else {
    hideUpdateBanner();
    if (showNoUpdateMessage) {
      const tag = result.currentVersion || result.latestVersion;
      setUpdateStatus(
        tag
          ? `Up to date — running Desktop v${tag}.`
          : "Up to date — running the latest Desktop build.",
        false
      );
    }
  }
}

async function runUpdateCheck(manual = false) {
  const checkBtn = document.getElementById("checkUpdatesNowBtn");
  if (checkBtn) checkBtn.disabled = true;
  if (manual) {
    setUpdateStatus("Checking GitHub Releases for updates...", false);
  }
  try {
    const result = await invoke("check_for_updates");
    applyUpdateResult(result, manual || result?.updateAvailable);
    return result;
  } catch (err) {
    if (manual) {
      setUpdateStatus(String(err || "Update check failed."), true);
    }
    return null;
  } finally {
    if (checkBtn) checkBtn.disabled = false;
  }
}

async function openReleasePage() {
  try {
    await invoke("open_release_page");
  } catch {
    // Opening external URLs may fail in restricted environments.
  }
}

async function loadSettingsAndMaybeCheckUpdates(isSmokeMode = false) {
  const ticket = ++settingsSeq;
  settingsLoadPromise = (async () => {
    let loadedSettings;
    try {
      loadedSettings = await invoke("get_settings");
    } catch {
      loadedSettings = { checkUpdatesOnStartup: false };
    }
    lastPersistedSettings = normalizeSettings(loadedSettings);
    if (ticket === settingsSeq) {
      currentSettings = normalizeSettings(lastPersistedSettings);
      applySettings(currentSettings);
      if (currentSettings.checkUpdatesOnStartup && !isSmokeMode) {
        runUpdateCheck(false);
      }
    }
  })();
  await settingsLoadPromise;
}

function bindControls() {
  document
    .getElementById("clearAllBtn")
    .addEventListener("click", clearAllCalculators);
  document
    .getElementById("settingsBtn")
    ?.addEventListener("click", openSettingsModal);
  document
    .getElementById("aboutBtn")
    .addEventListener("click", openAboutModal);
  document
    .getElementById("copyWebUrlBtn")
    ?.addEventListener("click", (event) => {
      copyText(WEB_APP_URL, event.currentTarget);
    });

  document
    .getElementById("closeAboutBtn")
    .addEventListener("click", closeAboutModal);
  document
    .getElementById("closeAboutXBtn")
    .addEventListener("click", closeAboutModal);
  document
    .getElementById("aboutModal")
    .addEventListener("click", (event) => {
      if (event.target.id === "aboutModal") closeAboutModal();
    });

  document
    .getElementById("closeSettingsBtn")
    ?.addEventListener("click", closeSettingsModal);
  document
    .getElementById("closeSettingsXBtn")
    ?.addEventListener("click", closeSettingsModal);
  document
    .getElementById("settingsModal")
    ?.addEventListener("click", (event) => {
      if (event.target.id === "settingsModal") closeSettingsModal();
    });

  document
    .getElementById("autoUpdateToggle")
    ?.addEventListener("change", async (event) => {
      await saveSettings({ checkUpdatesOnStartup: Boolean(event.currentTarget.checked) });
    });
  document
    .getElementById("checkUpdatesNowBtn")
    ?.addEventListener("click", () => runUpdateCheck(true));
  document
    .getElementById("openReleasePageBtn")
    ?.addEventListener("click", openReleasePage);
  document
    .getElementById("copyReleaseUrlBtn")
    ?.addEventListener("click", (event) => {
      copyText(latestReleaseUrl, event.currentTarget);
    });

  document
    .getElementById("openUpdateBannerBtn")
    ?.addEventListener("click", openReleasePage);
  document
    .getElementById("copyUpdateBannerBtn")
    ?.addEventListener("click", (event) => {
      copyText(latestReleaseUrl, event.currentTarget);
    });
  document
    .getElementById("dismissUpdateBannerBtn")
    ?.addEventListener("click", hideUpdateBanner);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const aboutModal = document.getElementById("aboutModal");
      if (aboutModal && !aboutModal.classList.contains("hidden")) {
        closeAboutModal();
      }
      const settingsModal = document.getElementById("settingsModal");
      if (settingsModal && !settingsModal.classList.contains("hidden")) {
        closeSettingsModal();
      }
    }
  });

  // Swap buttons across all 8 cards
  document
    .getElementById("swapChangeBtn")
    .addEventListener("click", () =>
      swapFields("changeOrig", "changeNew", updateChangeLive)
    );
  document
    .getElementById("swapPercentBtn")
    .addEventListener("click", () =>
      swapFields("isWhatX", "isWhatY", updatePercentLive)
    );
  document
    .getElementById("swapWhatBtn")
    .addEventListener("click", () =>
      swapFields("whatX", "whatY", updateWhatLive)
    );
  document
    .getElementById("swapDiscountBtn")
    .addEventListener("click", () =>
      swapFields("discountPrice", "discountPercent", updateDiscountLive)
    );
  document
    .getElementById("swapBaseBtn")
    .addEventListener("click", () =>
      swapFields("baseX", "baseY", updateBaseLive)
    );
  document
    .getElementById("swapMarkupBtn")
    .addEventListener("click", () =>
      swapFields("markupCost", "markupPrice", updateMarkupLive)
    );
  document
    .getElementById("swapTaxBtn")
    .addEventListener("click", () =>
      swapFields("taxAmount", "taxRate", updateTaxLive)
    );

  document.getElementById("swapTipBtn").addEventListener("click", () =>
    swapFields("tipBill", "tipPercent", updateTipLive)
  );
  document.querySelectorAll(".preset-btn[data-tip]").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById("tipPercent").value = button.dataset.tip;
      updateTipLive();
    });
  });

  // Tax mode toggle
  document
    .getElementById("taxModeAddBtn")
    .addEventListener("click", () => setTaxMode("add"));
  document
    .getElementById("taxModeExtractBtn")
    .addEventListener("click", () => setTaxMode("extract"));

  // Card 1: Percentage Change
  document
    .getElementById("calcChangeBtn")
    .addEventListener("click", async () => {
      await updateChangeLive();
      await recordHistoryFor("change");
    });
  document
    .getElementById("resetChangeBtn")
    .addEventListener("click", () =>
      resetFields(["changeOrig", "changeNew"], "changeResult", updateChangeLive)
    );
  document
    .getElementById("copyChangeBtn")
    .addEventListener("click", async (event) => {
      await copyCardResult("change", event.currentTarget);
    });

  // Card 2: Percentage of Total
  document
    .getElementById("calcPercentBtn")
    .addEventListener("click", async () => {
      await updatePercentLive();
      await recordHistoryFor("percent");
    });
  document
    .getElementById("resetPercentBtn")
    .addEventListener("click", () =>
      resetFields(["isWhatX", "isWhatY"], "percentResult", updatePercentLive)
    );
  document
    .getElementById("copyPercentBtn")
    .addEventListener("click", async (event) => {
      await copyCardResult("percent", event.currentTarget);
    });

  // Card 3: Calculate Percentage
  document
    .getElementById("calcWhatBtn")
    .addEventListener("click", async () => {
      await updateWhatLive();
      await recordHistoryFor("what");
    });
  document
    .getElementById("resetWhatBtn")
    .addEventListener("click", () =>
      resetFields(["whatX", "whatY"], "whatResult", updateWhatLive)
    );
  document
    .getElementById("copyWhatBtn")
    .addEventListener("click", async (event) => {
      await copyCardResult("what", event.currentTarget);
    });

  // Card 4: Discount
  document
    .getElementById("calcDiscountBtn")
    .addEventListener("click", async () => {
      await updateDiscountLive();
      await recordHistoryFor("discount");
    });
  document
    .getElementById("resetDiscountBtn")
    .addEventListener("click", () =>
      resetFields(
        ["discountPrice", "discountPercent"],
        "discountResult",
        updateDiscountLive
      )
    );
  document
    .getElementById("copyDiscountBtn")
    .addEventListener("click", async (event) => {
      await copyCardResult("discount", event.currentTarget);
    });

  // Card 5: Find Original Value
  document
    .getElementById("calcBaseBtn")
    .addEventListener("click", async () => {
      await updateBaseLive();
      await recordHistoryFor("base");
    });
  document
    .getElementById("resetBaseBtn")
    .addEventListener("click", () =>
      resetFields(["baseX", "baseY"], "baseResult", updateBaseLive)
    );
  document
    .getElementById("copyBaseBtn")
    .addEventListener("click", async (event) => {
      await copyCardResult("base", event.currentTarget);
    });

  // Card 6: Markup & Profit Margin
  document
    .getElementById("calcMarkupBtn")
    .addEventListener("click", async () => {
      await updateMarkupLive();
      await recordHistoryFor("markup");
    });
  document
    .getElementById("resetMarkupBtn")
    .addEventListener("click", () =>
      resetFields(["markupCost", "markupPrice"], "markupResult", updateMarkupLive)
    );
  document
    .getElementById("copyMarkupBtn")
    .addEventListener("click", async (event) => {
      await copyCardResult("markup", event.currentTarget);
    });

  // Card 7: Reverse Tax / VAT
  document
    .getElementById("calcTaxBtn")
    .addEventListener("click", async () => {
      await updateTaxLive();
      await recordHistoryFor("tax");
    });
  document
    .getElementById("resetTaxBtn")
    .addEventListener("click", () =>
      resetFields(["taxAmount", "taxRate"], "taxResult", updateTaxLive)
    );
  document
    .getElementById("copyTaxBtn")
    .addEventListener("click", async (event) => {
      await copyCardResult("tax", event.currentTarget);
    });

  // Card 8: Tip & Bill Split
  document.getElementById("calcTipBtn").addEventListener("click", async () => {
    await updateTipLive();
    await recordHistoryFor("tip");
  });
  document.getElementById("resetTipBtn").addEventListener("click", resetTip);
  document.getElementById("copyTipBtn").addEventListener("click", async (event) => {
    await copyCardResult("tip", event.currentTarget);
  });

  // History filter & clear confirmation flow
  document
    .getElementById("historyFilter")
    ?.addEventListener("change", (event) => {
      historyFilterValue = event.currentTarget.value || "all";
      renderHistory();
    });

  const clearHistoryBtn = document.getElementById("clearHistoryBtn");
  const clearConfirmGroup = document.getElementById("clearHistoryConfirm");
  clearHistoryBtn.addEventListener("click", () => {
    clearHistoryBtn.classList.add("hidden");
    clearConfirmGroup.classList.remove("hidden");
  });
  document
    .getElementById("cancelClearHistoryBtn")
    .addEventListener("click", () => {
      clearConfirmGroup.classList.add("hidden");
      clearHistoryBtn.classList.remove("hidden");
    });
  document
    .getElementById("confirmClearHistoryBtn")
    .addEventListener("click", async () => {
      try {
        const entries = await invoke("history_clear");
        renderHistory(entries);
      } catch {
        renderHistory([]);
      }
      clearConfirmGroup.classList.add("hidden");
      clearHistoryBtn.classList.remove("hidden");
    });
}

function bindLiveUpdates() {
  document
    .getElementById("changeOrig")
    .addEventListener("input", updateChangeLive);
  document
    .getElementById("changeNew")
    .addEventListener("input", updateChangeLive);

  document
    .getElementById("isWhatX")
    .addEventListener("input", updatePercentLive);
  document
    .getElementById("isWhatY")
    .addEventListener("input", updatePercentLive);

  document.getElementById("whatX").addEventListener("input", updateWhatLive);
  document.getElementById("whatY").addEventListener("input", updateWhatLive);

  document
    .getElementById("discountPrice")
    .addEventListener("input", updateDiscountLive);
  document
    .getElementById("discountPercent")
    .addEventListener("input", updateDiscountLive);

  document.getElementById("baseX").addEventListener("input", updateBaseLive);
  document.getElementById("baseY").addEventListener("input", updateBaseLive);

  document
    .getElementById("markupCost")
    .addEventListener("input", updateMarkupLive);
  document
    .getElementById("markupPrice")
    .addEventListener("input", updateMarkupLive);

  document
    .getElementById("taxAmount")
    .addEventListener("input", updateTaxLive);
  document
    .getElementById("taxRate")
    .addEventListener("input", updateTaxLive);

  ["tipBill", "tipPercent", "tipPeople"].forEach((id) => {
    document.getElementById(id).addEventListener("input", updateTipLive);
  });

  attachPasteSanitizers();
}

function bindEnterKeys() {
  attachEnterKey(["changeOrig", "changeNew"], async () => {
    await updateChangeLive();
    await recordHistoryFor("change");
  });
  attachEnterKey(["isWhatX", "isWhatY"], async () => {
    await updatePercentLive();
    await recordHistoryFor("percent");
  });
  attachEnterKey(["whatX", "whatY"], async () => {
    await updateWhatLive();
    await recordHistoryFor("what");
  });
  attachEnterKey(["discountPrice", "discountPercent"], async () => {
    await updateDiscountLive();
    await recordHistoryFor("discount");
  });
  attachEnterKey(["baseX", "baseY"], async () => {
    await updateBaseLive();
    await recordHistoryFor("base");
  });
  attachEnterKey(["markupCost", "markupPrice"], async () => {
    await updateMarkupLive();
    await recordHistoryFor("markup");
  });
  attachEnterKey(["taxAmount", "taxRate"], async () => {
    await updateTaxLive();
    await recordHistoryFor("tax");
  });
  attachEnterKey(["tipBill", "tipPercent", "tipPeople"], async () => {
    await updateTipLive();
    await recordHistoryFor("tip");
  });
}

// Runs inside the real Tauri webview when launched with `--smoke-test`.
// Exercises calculations, history, layout persistence, pointer gestures, and modals
// using the smoke backend’s in-memory state. Restores the original layout afterward.
async function runSmokeTestIfRequested(smokeEnabledArg) {
  let enabled = smokeEnabledArg;
  if (typeof enabled !== "boolean") {
    try {
      enabled = await invoke("is_smoke_test");
    } catch {
      return;
    }
  }
  if (!enabled) return;
  await runSmokeTests();
}

async function runSmokeTests() {
  const setInput = (id, value, waitFn) => {
    const el = document.getElementById(id);
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return waitFn();
  };
  const waitUntilCopied = async (btnId) => {
    const btn = document.getElementById(btnId);
    for (let i = 0; i < 20; i++) {
      if (btn?.textContent === "copied") return true;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    return btn?.textContent === "copied";
  };
  const text = (id) => document.getElementById(id).innerText.trim();
  const failures = [];
  const check = (name, ok) => {
    if (!ok) failures.push(name);
  };

  const waitUntil = async (pred) => {
    for (let i = 0; i < 20; i++) {
      if (await pred()) return true;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    return Boolean(await pred());
  };
  const cardOrder = () => Array.from(document.querySelectorAll("#cardsContainer .calc-section"), (card) => card.dataset.calc);
  const navOrder = () => Array.from(document.querySelectorAll(".quick-nav .quick-link[data-calc]"), (link) => link.dataset.calc);
  const sameOrder = (a, b) => a.join() === b.join();
  await settingsSaveQueue;
  const originalSettings = normalizeSettings(currentSettings);

  try {
    check("smoke-layout-baseline", await saveSettings(normalizeSettings(null)));
    renderHistory(await invoke("history_clear"));
    document.getElementById("changeOrig").focus();
    check("initial-focus", document.activeElement?.id === "changeOrig");

    const appInfo = await invoke("get_app_info");
    check("app-name", appInfo.name === "Percentage Calculator Tool");
    check("app-version", appInfo.version === "2.3.0");
    check(
      "app-credits",
      appInfo.credits.includes("Mohamed Sayed") &&
        appInfo.credits.includes("Ahmed Emara") &&
        appInfo.credits.includes("Antigravity")
    );
    check(
      "footer-version",
      document
        .getElementById("appVersion")
        .textContent.includes("Desktop v2.3.0")
    );

    const quickLinks = Array.from(document.querySelectorAll(".quick-nav .quick-link"));
    check(
      "quick-nav-links",
      quickLinks.length === 9 &&
        quickLinks.every((link) => {
          const targetId = link.getAttribute("href")?.replace(/^#/, "");
          return Boolean(targetId && document.getElementById(targetId));
        })
    );
    const taxNavLink = quickLinks.find((link) => link.getAttribute("href") === "#card-tax");
    taxNavLink?.click();
    check("quick-nav-hash", window.location.hash === "#card-tax");
    window.history.replaceState(null, "", window.location.pathname);
    window.scrollTo(0, 0);

    await setInput("changeOrig", "150", updateChangeLive);
    await setInput("changeNew", "180", updateChangeLive);
    check(
      "change-increase",
      text("changeResult").includes("20.00% increase")
    );

    // Swap values check (150 <-> 180 => 16.67% decrease)
    await swapFields("changeOrig", "changeNew", updateChangeLive);
    check(
      "swap-change-values",
      document.getElementById("changeOrig").value === "180" &&
        document.getElementById("changeNew").value === "150" &&
        text("changeResult").includes("16.67% decrease")
    );

    await setInput("changeOrig", "200", updateChangeLive);
    await setInput("changeNew", "150", updateChangeLive);
    check(
      "change-decrease",
      text("changeResult").includes("25.00% decrease")
    );

    await setInput("changeOrig", "0", updateChangeLive);
    await setInput("changeNew", "150", updateChangeLive);
    check(
      "change-div-zero",
      text("changeResult").includes("Original value cannot be zero")
    );

    await setInput("isWhatX", "50", updatePercentLive);
    await setInput("isWhatY", "200", updatePercentLive);
    check("percent-of-total", text("percentResult").includes("25.00%"));

    await setInput("isWhatY", "0", updatePercentLive);
    check(
      "percent-div-zero",
      text("percentResult").includes("Total cannot be zero")
    );

    await setInput("whatX", "20", updateWhatLive);
    await setInput("whatY", "500", updateWhatLive);
    check("portion", text("whatResult").includes("100.00"));

    await setInput("discountPrice", "79.99", updateDiscountLive);
    await setInput("discountPercent", "20", updateDiscountLive);
    check("discount-final", text("discountResult").includes("Final: 63.99"));
    check("discount-saved", text("discountResult").includes("Saved: 16.00"));

    await setInput("baseX", "50", updateBaseLive);
    await setInput("baseY", "25", updateBaseLive);
    check("original-value", text("baseResult").includes("200.00"));

    await setInput("baseY", "0", updateBaseLive);
    check(
      "original-div-zero",
      text("baseResult").includes("Percent cannot be zero")
    );

    // Markup & Profit Margin checks
    await setInput("markupCost", "80", updateMarkupLive);
    await setInput("markupPrice", "100", updateMarkupLive);
    check("markup-profit", text("markupResult").includes("Profit: 20.00"));
    check("markup-pct", text("markupResult").includes("Markup: 25.00%"));
    check("margin-pct", text("markupResult").includes("Margin: 20.00%"));

    // Record markup calculation to history
    await recordHistoryFor("markup");
    check("history-count-1", text("historyCount") === "(1 / 500)");
    const historyText = document.getElementById("historyList").textContent;
    check(
      "history-entry-rendered",
      historyText.includes("Markup & Margin") &&
        historyText.includes("Profit: 20.00")
    );
    const firstTimeText =
      document.querySelector(".history-time")?.textContent || "";
    check(
      "history-timestamp-datetime",
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(firstTimeText)
    );

    await setInput("markupCost", "0", updateMarkupLive);
    check(
      "markup-div-zero",
      text("markupResult").includes("Cost cannot be zero")
    );

    // Negative formula parenthesization + sanitizer + overflow checks
    await setInput("changeOrig", "-50", updateChangeLive);
    await setInput("changeNew", "-25", updateChangeLive);
    check(
      "negative-formula-parens",
      document.getElementById("changeLiveFormula").textContent ===
        "(((-25) − (-50)) / (-50)) × 100"
    );
    check(
      "sanitize-formatted-number",
      sanitizeNumericString("$1,250.50") === "1250.50" &&
        sanitizeNumericString("20%") === "20" &&
        sanitizeNumericString("+$1,000") === "1000"
    );
    await setInput("whatX", "1e308", updateWhatLive);
    await setInput("whatY", "1000", updateWhatLive);
    check(
      "overflow-range-guard",
      text("whatResult").includes("Value out of range")
    );

    // Reverse Tax / VAT checks (add + extract)
    await setTaxMode("add");
    await setInput("taxAmount", "100", updateTaxLive);
    await setInput("taxRate", "15", updateTaxLive);
    check(
      "tax-add",
      text("taxResult").includes("Total: 115.00") &&
        text("taxResult").includes("Tax: 15.00")
    );

    await setTaxMode("extract");
    await setInput("taxAmount", "115", updateTaxLive);
    await setInput("taxRate", "15", updateTaxLive);
    check(
      "tax-extract",
      text("taxResult").includes("Net: 100.00") &&
        text("taxResult").includes("Tax: 15.00")
    );

    // Copy must be blocked while percent card is in error state (isWhatY = 0),
    // then succeed and record once valid inputs are restored.
    document.getElementById("copyPercentBtn").click();
    await new Promise((resolve) => setTimeout(resolve, 40));
    check(
      "copy-blocked-on-error",
      document.getElementById("copyPercentBtn").textContent !== "copied"
    );
    await setInput("isWhatY", "200", updatePercentLive);
    document.getElementById("copyPercentBtn").click();
    check("copy-feedback", await waitUntilCopied("copyPercentBtn"));
    await new Promise((resolve) => setTimeout(resolve, 50));

    document.getElementById("clearAllBtn").click();
    check("clear-changeOrig", document.getElementById("changeOrig").value === "");
    check("clear-isWhatX", document.getElementById("isWhatX").value === "");
    check("clear-whatX", document.getElementById("whatX").value === "");
    check(
      "clear-discountPrice",
      document.getElementById("discountPrice").value === ""
    );
    check("clear-baseX", document.getElementById("baseX").value === "");
    check("clear-markupCost", document.getElementById("markupCost").value === "");
    check("clear-taxAmount", document.getElementById("taxAmount").value === "");
    check("clear-changeResult", text("changeResult").includes("—"));
    check("clear-percentResult", text("percentResult").includes("—"));
    check("clear-whatResult", text("whatResult").includes("—"));
    check("clear-discountResult", text("discountResult").includes("—"));
    check("clear-baseResult", text("baseResult").includes("—"));
    check("clear-markupResult", text("markupResult").includes("—"));
    check("clear-taxResult", text("taxResult").includes("—"));

    // Clear all calculators must NOT wipe persistent history
    check("history-kept-on-clear-all", text("historyCount") === "(2 / 500)");

    // Filter history by calculator while keeping total count in header
    const historyFilterEl = document.getElementById("historyFilter");
    historyFilterEl.value = "markup";
    historyFilterEl.dispatchEvent(new Event("change"));
    check(
      "history-filter-count-and-rows",
      text("historyCount") === "(2 / 500)" &&
        document.querySelectorAll(".history-item").length === 1 &&
        document.getElementById("historyList").textContent.includes("Markup & Margin")
    );

    // Restore from filtered history row + verify card highlight
    const restoreBtn = document.querySelector(".history-restore-btn");
    restoreBtn.click();
    check(
      "history-restore",
      await waitUntil(
        () =>
          document.getElementById("markupCost").value === "80" &&
          document.getElementById("markupPrice").value === "100" &&
          text("markupResult").includes("Profit: 20.00") &&
          document.getElementById("card-markup").classList.contains("card-restored")
      )
    );

    // Reset filter and delete a single entry
    historyFilterEl.value = "all";
    historyFilterEl.dispatchEvent(new Event("change"));
    check(
      "history-filter-reset-all",
      document.querySelectorAll(".history-item").length === 2
    );
    document.querySelector(".history-delete-btn").click();
    check(
      "history-single-delete",
      await waitUntil(() => text("historyCount") === "(1 / 500)")
    );

    // Clear history confirmation flow
    document.getElementById("clearHistoryBtn").click();
    document.getElementById("confirmClearHistoryBtn").click();
    check(
      "history-cleared",
      await waitUntil(() => text("historyCount") === "(0 / 500)")
    );

    // Tip presets, swap, three-field history, validation, and clear behavior.
    await setInput("tipBill", "100", updateTipLive);
    await setInput("tipPeople", "4", updateTipLive);
    document.querySelector('.preset-btn[data-tip="20"]').click();
    check("tip-preset-20", await waitUntil(() =>
      document.getElementById("tipPercent").value === "20" &&
      lastValidCalc.tip?.inputB === "20" &&
      text("tipResult").includes("20.00") &&
      text("tipResult").includes("120.00") &&
      text("tipResult").includes("30.00")
    ));
    check("tip-three-line-formula", document.getElementById("tipLiveFormula").querySelectorAll("br").length === 2);
    document.getElementById("calcTipBtn").click();
    check("tip-history-three-fields", await waitUntil(async () => {
      const entries = await invoke("history_list");
      return entries.length === 1 && entries[0].calculator === "tip" &&
        entries[0].inputA === "100" && entries[0].inputB === "20" && entries[0].inputC === "4";
    }));
    document.getElementById("swapTipBtn").click();
    check("tip-swap", await waitUntil(() => lastValidCalc.tip?.inputA === "20" &&
      lastValidCalc.tip?.inputB === "100" && document.getElementById("tipPeople").value === "4"));
    await setInput("tipPeople", "0", updateTipLive);
    check("tip-invalid-people", !lastValidCalc.tip && Boolean(document.querySelector("#tipResult .error-text")));
    document.getElementById("copyTipBtn").click();
    await new Promise((resolve) => setTimeout(resolve, 40));
    check("tip-error-copy-blocked", document.getElementById("copyTipBtn").textContent !== "copied");
    await setInput("tipPeople", "4", updateTipLive);
    await setInput("tipBill", "-100", updateTipLive);
    check("tip-negative-bill", !lastValidCalc.tip && Boolean(document.querySelector("#tipResult .error-text")));
    document.getElementById("resetTipBtn").click();
    check("tip-clear", document.getElementById("tipBill").value === "" &&
      document.getElementById("tipPercent").value === "" &&
      document.getElementById("tipPeople").value === "1" && text("tipResult").includes("—"));

    const tipCard = document.getElementById("card-tip");
    const collapseTip = tipCard.querySelector(".collapse-btn");
    collapseTip.click();
    await settingsSaveQueue;
    check("collapse-tip-persisted", tipCard.classList.contains("card-collapsed") &&
      collapseTip.getAttribute("aria-expanded") === "false" && collapseTip.textContent === "[ + ]" &&
      (await invoke("get_settings")).collapsedCards.includes("tip"));
    collapseTip.click();
    await settingsSaveQueue;
    check("expand-tip-persisted", !tipCard.classList.contains("card-collapsed") &&
      collapseTip.getAttribute("aria-expanded") === "true" && collapseTip.textContent === "[ − ]" &&
      !(await invoke("get_settings")).collapsedCards.includes("tip"));
    collapseTip.click();
    await settingsSaveQueue;
    document.querySelector('.quick-link[data-calc="tip"]').click();
    check("quick-nav-auto-expand", await waitUntil(async () =>
      !tipCard.classList.contains("card-collapsed") &&
      !(await invoke("get_settings")).collapsedCards.includes("tip") &&
      document.activeElement?.id === "tipBill"
    ));
    collapseTip.click();
    await settingsSaveQueue;
    document.querySelector(".history-restore-btn").click();
    check("tip-history-restore-auto-expand", await waitUntil(async () =>
      !tipCard.classList.contains("card-collapsed") &&
      !(await invoke("get_settings")).collapsedCards.includes("tip") &&
      lastValidCalc.tip?.inputA === "100" && lastValidCalc.tip?.inputB === "20" &&
      lastValidCalc.tip?.inputC === "4" && document.getElementById("tipPeople").value === "4"
    ));
    clearAllCalculators();
    check("tip-clear-all", document.getElementById("tipBill").value === "" &&
      document.getElementById("tipPercent").value === "" && document.getElementById("tipPeople").value === "1");

    // Real PointerEvent dispatch through the handle and document listeners.
    const dragCard = document.getElementById("card-change");
    const dropCard = document.getElementById("card-percent");
    const handle = dragCard.querySelector(".drag-handle");
    const dragToPercent = (ending) => {
      const from = handle.getBoundingClientRect?.();
      const target = ending === "pointerup" ? dropCard : document.getElementById("card-what");
      const to = target.getBoundingClientRect?.();
      if (!from || !to) return false;
      const pointer = { bubbles: true, cancelable: true, pointerId: 23, pointerType: "mouse", isPrimary: true, button: 0 };
      handle.dispatchEvent(new PointerEvent("pointerdown", { ...pointer, clientX: from.left + 4, clientY: from.top + 4 }));
      handle.dispatchEvent(new PointerEvent("pointermove", { ...pointer, clientX: to.left + 10, clientY: to.bottom - 10 }));
      if (ending === "escape") {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      } else {
        handle.dispatchEvent(new PointerEvent(ending, { ...pointer, clientX: to.left + 10, clientY: to.bottom - 10 }));
      }
      return true;
    };
    check("pointer-drag-dispatched", dragToPercent("pointerup"));
    await settingsSaveQueue;
    const reordered = ["percent", "change", ...DEFAULT_CARD_ORDER.slice(2)];
    check("pointer-reorder-dom-nav-settings", sameOrder(cardOrder(), reordered) &&
      sameOrder(navOrder(), reordered) && sameOrder((await invoke("get_settings")).cardOrder, reordered) &&
      document.querySelector(".quick-nav").lastElementChild.getAttribute("href") === "#historySection");
    dragToPercent("escape");
    await settingsSaveQueue;
    check("pointer-escape-cancel", sameOrder(cardOrder(), reordered) &&
      sameOrder((await invoke("get_settings")).cardOrder, reordered) &&
      !document.querySelector(".card-dragging, .card-drop-before, .card-drop-after"));
    dragToPercent("pointercancel");
    check("pointer-cancel-clean", sameOrder(cardOrder(), reordered) &&
      !document.querySelector(".card-dragging, .card-drop-before, .card-drop-after"));

    collapseTip.click();
    await settingsSaveQueue;
    const layoutToggle = document.getElementById("autoUpdateToggle");
    layoutToggle.checked = false;
    layoutToggle.dispatchEvent(new Event("change"));
    await settingsSaveQueue;
    const layoutSaved = await invoke("get_settings");
    check("auto-update-preserves-layout", layoutSaved.checkUpdatesOnStartup === false &&
      sameOrder(layoutSaved.cardOrder, reordered) && layoutSaved.collapsedCards.includes("tip"));
    layoutToggle.checked = true;
    layoutToggle.dispatchEvent(new Event("change"));
    await settingsSaveQueue;
    const lastRect = document.getElementById("cardsContainer").lastElementChild.getBoundingClientRect();
    const handleRect = handle.getBoundingClientRect();
    const pastLastPointer = { bubbles: true, cancelable: true, pointerId: 24, pointerType: "mouse", isPrimary: true, button: 0 };
    const pastLastPosition = { clientX: lastRect.left + 10, clientY: lastRect.bottom + 40 };
    handle.dispatchEvent(new PointerEvent("pointerdown", { ...pastLastPointer, clientX: handleRect.left + 4, clientY: handleRect.top + 4 }));
    handle.dispatchEvent(new PointerEvent("pointermove", { ...pastLastPointer, ...pastLastPosition }));
    handle.dispatchEvent(new PointerEvent("pointerup", { ...pastLastPointer, ...pastLastPosition }));
    await settingsSaveQueue;
    const movedToEnd = [...reordered.filter((key) => key !== "change"), "change"];
    check("pointer-drag-past-last-card", document.getElementById("cardsContainer").lastElementChild === dragCard &&
      sameOrder(cardOrder(), movedToEnd) && sameOrder(navOrder(), movedToEnd) &&
      sameOrder((await invoke("get_settings")).cardOrder, movedToEnd));
    document.getElementById("settingsBtn").click();
    document.getElementById("resetLayoutBtn").click();
    await settingsSaveQueue;
    const resetSettings = await invoke("get_settings");
    check("reset-layout-dom-nav-settings", sameOrder(cardOrder(), DEFAULT_CARD_ORDER) &&
      sameOrder(navOrder(), DEFAULT_CARD_ORDER) && sameOrder(resetSettings.cardOrder, DEFAULT_CARD_ORDER) &&
      resetSettings.collapsedCards.length === 0 && !document.querySelector(".card-collapsed") &&
      document.querySelector(".quick-nav").lastElementChild.getAttribute("href") === "#historySection");
    document.getElementById("closeSettingsBtn").click();
    renderHistory(await invoke("history_clear"));

    // Redesigned About modal checks
    document.getElementById("aboutBtn").click();
    const aboutModal = document.getElementById("aboutModal");
    check("about-modal-open", !aboutModal.classList.contains("hidden"));
    check("about-version", text("aboutVersionPill") === "Desktop v2.3.0 · Tauri v2 + Rust");
    check(
      "about-modal-credits",
      text("aboutModal").includes("CREDITS") &&
        text("aboutModal").includes("Mohamed Sayed") &&
        text("aboutModal").includes("Ahmed Emara") &&
        text("aboutModal").includes("Antigravity")
    );
    check(
      "about-modal-web-url",
      text("aboutModal").includes("OFFICIAL WEB APP") &&
        document.getElementById("webAppUrlText")?.textContent === WEB_APP_URL
    );
    document.getElementById("copyWebUrlBtn").click();
    check("about-copy-web-url", await waitUntilCopied("copyWebUrlBtn"));
    document.getElementById("closeAboutBtn").click();
    check("about-modal-closed", aboutModal.classList.contains("hidden"));

    // Settings modal & mocked smoke update check
    document.getElementById("settingsBtn").click();
    const settingsModal = document.getElementById("settingsModal");
    check("settings-modal-open", !settingsModal.classList.contains("hidden"));
    const autoToggle = document.getElementById("autoUpdateToggle");
    check("settings-default-auto-update", autoToggle.checked === true);
    autoToggle.checked = false;
    autoToggle.dispatchEvent(new Event("change"));
    check(
      "settings-toggle-persisted-in-memory",
      await waitUntil(async () => {
        const s = await invoke("get_settings");
        return s.checkUpdatesOnStartup === false;
      })
    );
    autoToggle.checked = true;
    autoToggle.dispatchEvent(new Event("change"));
    await waitUntil(async () => {
      const s = await invoke("get_settings");
      return s.checkUpdatesOnStartup === true;
    });
    document.getElementById("checkUpdatesNowBtn").click();
    check(
      "settings-manual-update-check",
      await waitUntil(() =>
        document.getElementById("updateStatusText").textContent.includes("Up to date")
      )
    );
    document.getElementById("openReleasePageBtn").click();
    document.getElementById("closeSettingsBtn").click();
    check("settings-modal-closed", settingsModal.classList.contains("hidden"));

    await invoke("copy_text", { text: "percentage-tool-smoke-test" });
  } catch (err) {
    failures.push(`exception: ${err}`);
  } finally {
    finishCardDrag(true);
    try {
      await settingsSaveQueue;
      check("smoke-settings-restored", await saveSettings(originalSettings));
      const restored = normalizeSettings(await invoke("get_settings"));
      check("smoke-original-layout", restored.checkUpdatesOnStartup === originalSettings.checkUpdatesOnStartup &&
        sameOrder(restored.cardOrder, originalSettings.cardOrder) &&
        sameOrder(restored.collapsedCards, originalSettings.collapsedCards) &&
        sameOrder(cardOrder(), originalSettings.cardOrder) && sameOrder(navOrder(), originalSettings.cardOrder));
      renderHistory(await invoke("history_clear"));
    } catch (err) {
      failures.push(`cleanup: ${err}`);
    }
    document.getElementById("historyFilter").value = "all";
    historyFilterValue = "all";
    renderHistory();
    setTaxMode("add", false);
    clearAllCalculators();
    closeAboutModal();
    closeSettingsModal();
    document.getElementById("clearHistoryConfirm").classList.add("hidden");
    document.getElementById("clearHistoryBtn").classList.remove("hidden");
    document.querySelectorAll(".card-restored").forEach((card) => {
      window.clearTimeout(Number(card.dataset.restoreTimer || 0));
      card.classList.remove("card-restored");
    });
    window.history.replaceState(null, "", window.location.pathname);
    window.scrollTo(0, 0);
  }

  await invoke("report_smoke_result", {
    passed: failures.length === 0,
    details: failures.join(", ")
  });
}

async function initialize() {
  bindControls();
  bindCardLayout();
  bindLiveUpdates();
  bindEnterKeys();

  let smokeEnabled = false;
  try {
    smokeEnabled = await invoke("is_smoke_test");
  } catch {
    smokeEnabled = false;
  }

  await Promise.all([
    updateChangeLive(),
    updatePercentLive(),
    updateWhatLive(),
    updateDiscountLive(),
    updateBaseLive(),
    updateMarkupLive(),
    updateTaxLive(),
    updateTipLive(),
    syncAppInfo(),
    loadHistory(),
    loadSettingsAndMaybeCheckUpdates(smokeEnabled)
  ]);

  document.getElementById("changeOrig").focus();
  await runSmokeTestIfRequested(smokeEnabled);
}

initialize();
