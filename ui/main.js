// Frontend controller for the Tauri v2 desktop app (v2.1).
//
// Keeps the terminal DOM aesthetic, input parsing, and live-formula feedback,
// while delegating all percentage math, persistent local history, clipboard,
// and app metadata to the Rust backend via Tauri commands.

const COPY_FEEDBACK_MS = 1200;
const MAX_FIELD_LEN = 256;
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
  tax: 0
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
  tax: null
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
  "taxRate"
];

function sanitizeNumericString(raw) {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  let cleaned = trimmed.replace(/[\s_,$€£¥₹₩₽₺₫₪₱฿%]+/g, "");
  cleaned = cleaned.replace(
    /^(?:USD|EUR|GBP|JPY|CAD|AUD|CHF|INR)(?=[-+]?\d|\.)/i,
    ""
  );
  if (cleaned.startsWith("+")) {
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
  if (cleaned === "") return null;
  const num = Number(cleaned);
  return Number.isNaN(num) ? null : num;
}

function getRawInput(id) {
  const el = document.getElementById(id);
  return el ? sanitizeNumericString(el.value) : "";
}

function attachPasteSanitizers() {
  const plainNumberRe = /^-?\d*\.?\d+(?:[eE][-+]?\d+)?$/;
  CALC_INPUT_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("paste", (event) => {
      const rawText = event.clipboardData?.getData("text");
      if (typeof rawText !== "string") return;
      const trimmed = rawText.trim();
      if (!trimmed || plainNumberRe.test(trimmed)) return;
      const cleaned = sanitizeNumericString(trimmed);
      if (cleaned !== "" && !Number.isNaN(Number(cleaned))) {
        event.preventDefault();
        el.value = cleaned;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  });
}

function buildValidHistoryCandidate(candidate) {
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
  return valid ? candidate : null;
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

function allFiniteValues(obj, keys) {
  return (
    Boolean(obj) &&
    keys.every((k) => typeof obj[k] === "number" && Number.isFinite(obj[k]))
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

    if (!allFiniteValues(result, ["value"])) {
      setCardOutOfRange("change", formulaDiv, resultSpan, "changeResult", defaultFormula);
      return;
    }

    formulaDiv.textContent = `((${fmtFormulaNum(newVal)} − ${fmtFormulaNum(orig)}) / ${fmtFormulaNum(orig)}) × 100`;
    resultSpan.textContent = `→ ${result.liveResult}`;
    setResult("changeResult", result.label);

    lastValidCalc.change = buildValidHistoryCandidate({
      calculator: "change",
      calculatorLabel: "Percentage Change",
      inputA: getRawInput("changeOrig"),
      inputB: getRawInput("changeNew"),
      mode: null,
      inputsText: `${orig} → ${newVal}`,
      resultText: result.label,
      copyText: result.label
    });
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

    if (!allFiniteValues(result, ["value"])) {
      setCardOutOfRange("percent", formulaDiv, resultSpan, "percentResult", defaultFormula);
      return;
    }

    formulaDiv.textContent = `(${fmtFormulaNum(x)} / ${fmtFormulaNum(y)}) × 100`;
    resultSpan.textContent = `→ ${result.label}`;
    setResult("percentResult", result.label);

    lastValidCalc.percent = buildValidHistoryCandidate({
      calculator: "percent",
      calculatorLabel: "Percentage of Total",
      inputA: getRawInput("isWhatX"),
      inputB: getRawInput("isWhatY"),
      mode: null,
      inputsText: `${x} of ${y}`,
      resultText: result.label,
      copyText: result.label
    });
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

  try {
    const result = await invoke("calc_portion", { percent: x, number: y });
    if (ticket !== seq.what) return;

    if (!allFiniteValues(result, ["value"])) {
      setCardOutOfRange("what", formulaDiv, resultSpan, "whatResult", defaultFormula);
      return;
    }

    formulaDiv.textContent = `(${fmtFormulaNum(x)} / 100) × ${fmtFormulaNum(y)}`;
    resultSpan.textContent = `→ ${result.label}`;
    setResult("whatResult", result.label);

    lastValidCalc.what = buildValidHistoryCandidate({
      calculator: "what",
      calculatorLabel: "Calculate Percentage",
      inputA: getRawInput("whatX"),
      inputB: getRawInput("whatY"),
      mode: null,
      inputsText: `${x}% of ${y}`,
      resultText: result.label,
      copyText: result.label
    });
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

  try {
    const result = await invoke("calc_discount", {
      price,
      discountPercent: disc
    });
    if (ticket !== seq.discount) return;

    if (!allFiniteValues(result, ["finalPrice", "saved"])) {
      setCardOutOfRange("discount", formulaDiv, resultSpan, "discountResult", defaultLines);
      return;
    }

    setLines(formulaDiv, [
      `final = ${fmtFormulaNum(price)} × (1 − ${fmtFormulaNum(disc)}/100) = ${result.finalText}`,
      `saved = ${fmtFormulaNum(price)} × ${fmtFormulaNum(disc)}/100 = ${result.savedText}`
    ]);
    resultSpan.textContent = `→ final: ${result.finalText} | saved: ${result.savedText}`;
    setResult("discountResult", result.label);

    lastValidCalc.discount = buildValidHistoryCandidate({
      calculator: "discount",
      calculatorLabel: "Discount",
      inputA: getRawInput("discountPrice"),
      inputB: getRawInput("discountPercent"),
      mode: null,
      inputsText: `${price} (−${disc}%)`,
      resultText: `Final: ${result.finalText} · Saved: ${result.savedText}`,
      copyText: result.copyText
    });
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

    if (!allFiniteValues(result, ["value"])) {
      setCardOutOfRange("base", formulaDiv, resultSpan, "baseResult", defaultFormula);
      return;
    }

    formulaDiv.textContent = `${fmtFormulaNum(x)} / (${fmtFormulaNum(y)} / 100)`;
    resultSpan.textContent = `→ ${result.label}`;
    setResult("baseResult", result.label);

    lastValidCalc.base = buildValidHistoryCandidate({
      calculator: "base",
      calculatorLabel: "Find Original Value",
      inputA: getRawInput("baseX"),
      inputB: getRawInput("baseY"),
      mode: null,
      inputsText: `${x} is ${y}%`,
      resultText: result.label,
      copyText: result.label
    });
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

    if (!allFiniteValues(result, ["profit", "markup", "margin"])) {
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

    lastValidCalc.markup = buildValidHistoryCandidate({
      calculator: "markup",
      calculatorLabel: "Markup & Margin",
      inputA: getRawInput("markupCost"),
      inputB: getRawInput("markupPrice"),
      mode: null,
      inputsText: `Cost ${cost} → Price ${price}`,
      resultText: `Profit: ${result.profitText} · Markup: ${result.markupText} · Margin: ${result.marginText}`,
      copyText: result.copyText
    });
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

    if (!allFiniteValues(result, ["net", "tax", "total"])) {
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

    lastValidCalc.tax = buildValidHistoryCandidate({
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
    });
  } catch {
    if (ticket !== seq.tax) return;
    setCardOutOfRange("tax", formulaDiv, resultSpan, "taxResult", defaultLines);
  }
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
    tax: { card: "card-tax", a: "taxAmount", b: "taxRate", fn: updateTaxLive }
  };

  if (!entry || !Object.hasOwn(map, entry.calculator)) return;
  const target = map[entry.calculator];

  if (entry.calculator === "tax" && entry.mode) {
    await setTaxMode(entry.mode, false);
  }

  const elA = document.getElementById(target.a);
  const elB = document.getElementById(target.b);
  if (!elA || !elB) return;

  elA.value = entry.inputA;
  elB.value = entry.inputB;
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
  const entry = lastValidCalc[key];
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

let currentSettings = { checkUpdatesOnStartup: true };
let latestReleaseUrl = RELEASE_URL;

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
      const tag = result.latestVersion || result.currentVersion;
      setUpdateStatus(`Up to date — running Desktop v${tag}.`, false);
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
  try {
    const loaded = await invoke("get_settings");
    if (loaded && typeof loaded.checkUpdatesOnStartup === "boolean") {
      currentSettings = loaded;
    }
  } catch {
    currentSettings = { checkUpdatesOnStartup: true };
  }

  const toggle = document.getElementById("autoUpdateToggle");
  if (toggle) {
    toggle.checked = Boolean(currentSettings.checkUpdatesOnStartup);
  }

  if (currentSettings.checkUpdatesOnStartup && !isSmokeMode) {
    runUpdateCheck(false);
  }
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
      const checked = Boolean(event.currentTarget.checked);
      currentSettings = { checkUpdatesOnStartup: checked };
      try {
        currentSettings = await invoke("set_settings", {
          settings: currentSettings
        });
      } catch {
        // Ignore persistence failures so toggle stays responsive.
      }
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

  // Swap buttons (Option B) across all 7 cards
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
}

// Runs inside the real Tauri webview when launched with `--smoke-test`.
// Verifies the original 30+ checks plus all v2.1 features (swap values,
// Markup & Margin, Reverse Tax/VAT add & extract, persistent history
// add/restore/clear, and the redesigned dark-terminal About modal).
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

  try {
    check("initial-focus", document.activeElement?.id === "changeOrig");

    const appInfo = await invoke("get_app_info");
    check("app-name", appInfo.name === "Percentage Calculator Tool");
    check("app-version", appInfo.version === "2.1.1");
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
        .textContent.includes("Desktop v2.1.1")
    );

    const quickLinks = Array.from(document.querySelectorAll(".quick-nav .quick-link"));
    check(
      "quick-nav-links",
      quickLinks.length === 8 &&
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

    const waitUntil = async (pred) => {
      for (let i = 0; i < 20; i++) {
        if (await pred()) return true;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      return Boolean(await pred());
    };

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

    // Redesigned About modal checks
    document.getElementById("aboutBtn").click();
    const aboutModal = document.getElementById("aboutModal");
    check("about-modal-open", !aboutModal.classList.contains("hidden"));
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
  }

  await invoke("report_smoke_result", {
    passed: failures.length === 0,
    details: failures.join(", ")
  });
}

async function initialize() {
  bindControls();
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
    syncAppInfo(),
    loadHistory(),
    loadSettingsAndMaybeCheckUpdates(smokeEnabled)
  ]);

  document.getElementById("changeOrig").focus();
  await runSmokeTestIfRequested(smokeEnabled);
}

initialize();
