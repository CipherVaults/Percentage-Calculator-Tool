//! Deterministic application of Anthropic's safety-evaluation methodology:
//! https://www.anthropic.com/research/building-strong-safety-evaluations
//! Fix the construct, paired controls, atomic rubric, slices, and thresholds
//! before execution. These synthetic regression cases are not independent
//! random samples; Wilson and paired Newcombe/Wald intervals describe scores,
//! not real-world population coverage.

use percent_core::{
    calculate_discount, calculate_markup_margin, calculate_original_value,
    calculate_percentage_change, calculate_percentage_of_total, calculate_percentage_portion,
    calculate_tax, calculate_tip_split, format_decimal, js_round, CalcResult, MarkupMarginResult,
    TaxMode, TaxResult, TipSplitResult,
};
use serde::Deserialize;
use std::collections::{BTreeMap, HashSet};
use std::panic::{catch_unwind, AssertUnwindSafe};

#[derive(Debug)]
struct PreregisteredEvalSpec {
    construct: &'static str,
    sample_floor: usize,
    metamorphic_sample_floor: usize,
    max_broken_rate: f64,
    adversarial_pass_threshold: f64,
    formatting_boundary_pass_threshold: f64,
    benign_pass_threshold: f64,
    deviations: Option<&'static str>,
}

const SPEC: PreregisteredEvalSpec = PreregisteredEvalSpec {
    construct: "adversarial guard & overflow safety vs formatting boundary vs benign non-over-refusal across all 8 calculators",
    sample_floor: 1000,
    metamorphic_sample_floor: 200,
    max_broken_rate: 0.01,
    adversarial_pass_threshold: 1.0,
    formatting_boundary_pass_threshold: 1.0,
    benign_pass_threshold: 1.0,
    deviations: None,
};

const Z_95: f64 = 1.959_963_984_540_054;
const PRNG_SEED: u64 = 0x5EED_C0DE_2026_1115;

fn wilson_ci_95(passes: usize, total: usize) -> (f64, f64) {
    if total == 0 {
        return (0.0, 1.0);
    }
    assert!(passes <= total, "passes cannot exceed total");
    let n = total as f64;
    let p = passes as f64 / n;
    let z2 = Z_95 * Z_95;
    let denominator = 1.0 + z2 / n;
    let center = (p + z2 / (2.0 * n)) / denominator;
    let half_width = Z_95 * (p * (1.0 - p) / n + z2 / (4.0 * n * n)).sqrt() / denominator;
    (
        (center - half_width).clamp(0.0, 1.0),
        (center + half_width).clamp(0.0, 1.0),
    )
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
struct PairedContingency {
    n11: usize,
    n10: usize,
    n01: usize,
    n00: usize,
}

impl PairedContingency {
    fn total(self) -> usize {
        self.n11 + self.n10 + self.n01 + self.n00
    }

    fn record(&mut self, guarded_pass: bool, raw_pass: bool) {
        match (guarded_pass, raw_pass) {
            (true, true) => self.n11 += 1,
            (true, false) => self.n10 += 1,
            (false, true) => self.n01 += 1,
            (false, false) => self.n00 += 1,
        }
    }

    fn add_assign(&mut self, other: Self) {
        self.n11 += other.n11;
        self.n10 += other.n10;
        self.n01 += other.n01;
        self.n00 += other.n00;
    }

    fn diff(self) -> f64 {
        let n = self.total();
        if n == 0 {
            return 0.0;
        }
        (self.n10 as f64 - self.n01 as f64) / n as f64
    }
}

/// Paired Wald 95% confidence interval for `p_guarded - p_raw`.
fn wald_paired_diff_ci_95(c: PairedContingency) -> (f64, f64) {
    let n = c.total();
    if n == 0 {
        return (-1.0, 1.0);
    }
    let nf = n as f64;
    let d = c.diff();
    let sum_disc = (c.n10 + c.n01) as f64;
    let diff_disc = c.n10 as f64 - c.n01 as f64;
    let var = ((sum_disc - diff_disc * diff_disc / nf) / (nf * nf)).max(0.0);
    let half = Z_95 * var.sqrt();
    ((d - half).clamp(-1.0, 1.0), (d + half).clamp(-1.0, 1.0))
}

/// Newcombe (1998) Method 10 score-based 95% confidence interval for paired proportions.
fn newcombe_paired_diff_ci_95(c: PairedContingency) -> (f64, f64) {
    let n = c.total();
    if n == 0 {
        return (-1.0, 1.0);
    }
    let nf = n as f64;
    let k1 = c.n11 + c.n10;
    let k2 = c.n11 + c.n01;
    let p1 = k1 as f64 / nf;
    let p2 = k2 as f64 / nf;
    let (l1, u1) = wilson_ci_95(k1, n);
    let (l2, u2) = wilson_ci_95(k2, n);

    let r1 = k1 as f64;
    let r0 = (c.n01 + c.n00) as f64;
    let c1 = k2 as f64;
    let c0 = (c.n10 + c.n00) as f64;
    let denom = (r1 * r0 * c1 * c0).sqrt();
    let phi = if denom == 0.0 {
        0.0
    } else {
        let theta = (c.n11 as f64 * c.n00 as f64) - (c.n10 as f64 * c.n01 as f64);
        let adjusted = if theta > nf / 2.0 {
            theta - nf / 2.0
        } else if theta > 0.0 {
            0.0
        } else {
            theta
        };
        (adjusted / denom).clamp(-1.0, 1.0)
    };

    let d1_lo = p1 - l1;
    let d1_hi = u1 - p1;
    let d2_lo = p2 - l2;
    let d2_hi = u2 - p2;

    let low_rad = (d1_lo * d1_lo - 2.0 * phi * d1_lo * d2_hi + d2_hi * d2_hi).max(0.0);
    let high_rad = (d1_hi * d1_hi - 2.0 * phi * d1_hi * d2_lo + d2_lo * d2_lo).max(0.0);
    let diff = p1 - p2;
    (
        (diff - low_rad.sqrt()).clamp(-1.0, 1.0),
        (diff + high_rad.sqrt()).clamp(-1.0, 1.0),
    )
}

/// Exact two-sided McNemar binomial p-value for discordant counts `(n10, n01)`.
fn mcnemar_exact_p(c: PairedContingency) -> f64 {
    let m = c.n10 + c.n01;
    if m == 0 {
        return 1.0;
    }
    let k = c.n10.min(c.n01);
    let mut ln_fact = Vec::with_capacity(m + 1);
    ln_fact.push(0.0_f64);
    for i in 1..=m {
        ln_fact.push(ln_fact[i - 1] + (i as f64).ln());
    }
    let log_half_m = (m as f64) * std::f64::consts::LN_2;
    let mut one_tail = 0.0_f64;
    for i in 0..=k {
        let log_prob = ln_fact[m] - ln_fact[i] - ln_fact[m - i] - log_half_m;
        one_tail += log_prob.exp();
    }
    (2.0 * one_tail).clamp(0.0, 1.0)
}

/// Holm-Bonferroni step-down adjusted p-values preserving slice family-wise error rate.
fn holm_bonferroni_adjust(p_values: &[f64]) -> Vec<f64> {
    let m = p_values.len();
    if m == 0 {
        return Vec::new();
    }
    let mut order: Vec<usize> = (0..m).collect();
    order.sort_by(|&a, &b| {
        p_values[a]
            .partial_cmp(&p_values[b])
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    let mut adjusted = vec![0.0_f64; m];
    let mut running_max = 0.0_f64;
    for (rank, &idx) in order.iter().enumerate() {
        let factor = (m - rank) as f64;
        let scaled = (p_values[idx].clamp(0.0, 1.0) * factor).min(1.0);
        running_max = running_max.max(scaled);
        adjusted[idx] = running_max;
    }
    adjusted
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
enum Calculator {
    Change,
    Percent,
    Portion,
    Discount,
    Original,
    Markup,
    TaxAdd,
    TaxExtract,
    TipSplit,
}

const CALCULATORS: [Calculator; 9] = [
    Calculator::Change,
    Calculator::Percent,
    Calculator::Portion,
    Calculator::Discount,
    Calculator::Original,
    Calculator::Markup,
    Calculator::TaxAdd,
    Calculator::TaxExtract,
    Calculator::TipSplit,
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
enum Category {
    AdversarialGuard,
    FormattingBoundary,
    Benign,
}

const CATEGORIES: [Category; 3] = [
    Category::AdversarialGuard,
    Category::FormattingBoundary,
    Category::Benign,
];

#[derive(Debug, Clone, Copy)]
struct Case {
    calculator: Calculator,
    category: Category,
    a: f64,
    b: f64,
    people: f64,
}

// Compare numeric bits as well as every text field on replay. Raw f64 NaN is
// unequal to itself, so deriving PartialEq on the production results would
// falsely classify identical NaN-bearing results as nondeterministic.
#[derive(Debug, PartialEq)]
struct Observation {
    ok: bool,
    error: Option<&'static str>,
    numbers: Vec<u64>,
    fields: Vec<String>,
    label: String,
    live_result: Option<String>,
    copy_text: Option<String>,
}

impl Observation {
    fn success(numbers: &[f64], fields: Vec<String>, label: String) -> Self {
        Self {
            ok: true,
            error: None,
            numbers: numbers.iter().map(|x| x.to_bits()).collect(),
            fields,
            label,
            live_result: None,
            copy_text: None,
        }
    }

    fn failure(error: &'static str) -> Self {
        Self {
            ok: false,
            error: Some(error),
            numbers: Vec::new(),
            fields: Vec::new(),
            label: String::new(),
            live_result: None,
            copy_text: None,
        }
    }

    fn all_text(&self) -> Vec<&str> {
        let mut text = vec![self.label.as_str()];
        text.extend(self.fields.iter().map(String::as_str));
        text.extend(self.live_result.as_deref());
        text.extend(self.copy_text.as_deref());
        text.extend(self.error);
        text
    }
}

fn invoke(case: Case) -> Observation {
    use Calculator::*;
    let Case {
        calculator,
        a,
        b,
        people,
        ..
    } = case;
    match calculator {
        TipSplit => match calculate_tip_split(a, b, people) {
            TipSplitResult::Err { error } => Observation::failure(error),
            TipSplitResult::Ok {
                tip_amount,
                total_bill,
                per_person,
                tip_text,
                total_text,
                per_person_text,
                label,
                live_result,
                copy_text,
            } => {
                let mut observed = Observation::success(
                    &[tip_amount, total_bill, per_person],
                    vec![tip_text, total_text, per_person_text],
                    label,
                );
                observed.live_result = Some(live_result);
                observed.copy_text = Some(copy_text);
                observed
            }
        },
        Change | Percent | Portion | Original => {
            let result = match calculator {
                Change => calculate_percentage_change(a, b),
                Percent => calculate_percentage_of_total(a, b),
                Portion => calculate_percentage_portion(a, b),
                Original => calculate_original_value(a, b),
                _ => unreachable!(),
            };
            match result {
                CalcResult::Err { error } => Observation::failure(error),
                CalcResult::Ok {
                    value,
                    label,
                    live_result,
                } => {
                    let mut observed = Observation::success(&[value], vec![], label);
                    observed.live_result = Some(live_result);
                    observed
                }
            }
        }
        Discount => {
            let r = calculate_discount(a, b);
            let mut observed = Observation::success(
                &[r.final_price, r.saved],
                vec![r.final_text, r.saved_text],
                r.label,
            );
            observed.ok = r.ok;
            observed.copy_text = Some(r.copy_text);
            observed
        }
        Markup => match calculate_markup_margin(a, b) {
            MarkupMarginResult::Err { error } => Observation::failure(error),
            MarkupMarginResult::Ok {
                profit,
                markup,
                margin,
                profit_text,
                markup_text,
                margin_text,
                label,
                live_result,
                copy_text,
            } => {
                let mut observed = Observation::success(
                    &[profit, markup, margin],
                    vec![profit_text, markup_text, margin_text],
                    label,
                );
                observed.live_result = Some(live_result);
                observed.copy_text = Some(copy_text);
                observed
            }
        },
        TaxAdd | TaxExtract => {
            let mode = if calculator == TaxAdd {
                TaxMode::Add
            } else {
                TaxMode::Extract
            };
            match calculate_tax(a, b, mode) {
                TaxResult::Err { error } => Observation::failure(error),
                TaxResult::Ok {
                    net,
                    tax,
                    total,
                    net_text,
                    tax_text,
                    total_text,
                    label,
                    live_result,
                    copy_text,
                } => {
                    let mut observed = Observation::success(
                        &[net, tax, total],
                        vec![net_text, tax_text, total_text],
                        label,
                    );
                    observed.live_result = Some(live_result);
                    observed.copy_text = Some(copy_text);
                    observed
                }
            }
        }
    }
}

/// Unguarded raw-math + raw Rust `{:.2}` formatting baseline used strictly for
/// paired comparison against guarded `percent-core`.
fn invoke_raw_math_baseline(case: Case) -> Observation {
    use Calculator::*;
    let fmt_raw = |x: f64| -> String { format!("{x:.2}") };
    let Case {
        calculator,
        a,
        b,
        people,
        ..
    } = case;
    match calculator {
        TipSplit => {
            let tip_amount = a * (b / 100.0);
            let total_bill = a + tip_amount;
            let per_person = total_bill / people;
            let tip_text = fmt_raw(tip_amount);
            let total_text = fmt_raw(total_bill);
            let per_person_text = fmt_raw(per_person);
            let label = format!("Each: {per_person_text}<br>Total: {total_text} · Tip: {tip_text}");
            let mut observed = Observation::success(
                &[tip_amount, total_bill, per_person],
                vec![
                    tip_text.clone(),
                    total_text.clone(),
                    per_person_text.clone(),
                ],
                label,
            );
            observed.live_result = Some(format!("Each: {per_person_text} · Total: {total_text}"));
            observed.copy_text = Some(format!(
                "Each: {per_person_text}\nTotal: {total_text} · Tip: {tip_text}"
            ));
            observed
        }
        Change => {
            let value = ((b - a) / a) * 100.0;
            let abs_text = fmt_raw(value.abs());
            let suffix = if value > 0.0 {
                "increase"
            } else if value < 0.0 {
                "decrease"
            } else {
                "no change"
            };
            let label = format!("{abs_text}% {suffix}");
            let mut obs = Observation::success(&[value], vec![], label.clone());
            obs.live_result = Some(label);
            obs
        }
        Percent => {
            let value = (a / b) * 100.0;
            let label = format!("{}%", fmt_raw(value));
            let mut obs = Observation::success(&[value], vec![], label.clone());
            obs.live_result = Some(label);
            obs
        }
        Portion => {
            let value = (a / 100.0) * b;
            let label = fmt_raw(value);
            let mut obs = Observation::success(&[value], vec![], label.clone());
            obs.live_result = Some(label);
            obs
        }
        Original => {
            let value = a / (b / 100.0);
            let label = fmt_raw(value);
            let mut obs = Observation::success(&[value], vec![], label.clone());
            obs.live_result = Some(label);
            obs
        }
        Discount => {
            let saved = a * (b / 100.0);
            let final_price = a - saved;
            let final_text = fmt_raw(final_price);
            let saved_text = fmt_raw(saved);
            let label = format!("Final: {final_text}<br>Saved: {saved_text}");
            let copy_text = format!("Final: {final_text}\nSaved: {saved_text}");
            let mut obs =
                Observation::success(&[final_price, saved], vec![final_text, saved_text], label);
            obs.copy_text = Some(copy_text);
            obs
        }
        Markup => {
            let profit = b - a;
            let markup = (profit / a) * 100.0;
            let margin = (profit / b) * 100.0;
            let profit_text = fmt_raw(profit);
            let markup_text = format!("{}%", fmt_raw(markup));
            let margin_text = format!("{}%", fmt_raw(margin));
            let label =
                format!("Profit: {profit_text}<br>Markup: {markup_text} · Margin: {margin_text}");
            let live_result =
                format!("Profit: {profit_text} | Markup: {markup_text} | Margin: {margin_text}");
            let copy_text =
                format!("Profit: {profit_text}\nMarkup: {markup_text}\nMargin: {margin_text}");
            let mut obs = Observation::success(
                &[profit, markup, margin],
                vec![profit_text, markup_text, margin_text],
                label,
            );
            obs.live_result = Some(live_result);
            obs.copy_text = Some(copy_text);
            obs
        }
        TaxAdd => {
            let net = a;
            let tax = a * (b / 100.0);
            let total = a + tax;
            let net_text = fmt_raw(net);
            let tax_text = fmt_raw(tax);
            let total_text = fmt_raw(total);
            let label = format!("Total: {total_text}<br>Tax: {tax_text} (Net: {net_text})");
            let live_result = format!("Total: {total_text} | Tax: {tax_text}");
            let copy_text = format!("Total: {total_text}\nTax: {tax_text}\nNet: {net_text}");
            let mut obs = Observation::success(
                &[net, tax, total],
                vec![net_text, tax_text, total_text],
                label,
            );
            obs.live_result = Some(live_result);
            obs.copy_text = Some(copy_text);
            obs
        }
        TaxExtract => {
            let total = a;
            let net = (a * 100.0) / (100.0 + b);
            let tax = a - net;
            let net_text = fmt_raw(net);
            let tax_text = fmt_raw(tax);
            let total_text = fmt_raw(total);
            let label = format!("Net: {net_text}<br>Tax: {tax_text} (Total: {total_text})");
            let live_result = format!("Net: {net_text} | Tax: {tax_text}");
            let copy_text = format!("Net: {net_text}\nTax: {tax_text}\nTotal: {total_text}");
            let mut obs = Observation::success(
                &[net, tax, total],
                vec![net_text, tax_text, total_text],
                label,
            );
            obs.live_result = Some(live_result);
            obs.copy_text = Some(copy_text);
            obs
        }
    }
}

// A numeric contract, separate from rendering. IEEE operation order is part of
// the JS parity contract (not algebraically interchangeable near overflow).
fn expected(case: Case) -> Result<Vec<f64>, &'static str> {
    use Calculator::*;
    let Case {
        calculator,
        a,
        b,
        people,
        ..
    } = case;
    match calculator {
        TipSplit if a < 0.0 => Err("Bill amount cannot be negative"),
        TipSplit if b < 0.0 => Err("Tip % cannot be negative"),
        TipSplit if !people.is_finite() || people < 1.0 || people.fract() != 0.0 => {
            Err("People must be a whole number (1 or more)")
        }
        TipSplit => {
            let tip = a * (b / 100.0);
            let total = a + tip;
            Ok(vec![tip, total, total / people])
        }
        Change if a == 0.0 => Err("Original value cannot be zero"),
        Percent if b == 0.0 => Err("Total cannot be zero"),
        Original if b == 0.0 => Err("Percent cannot be zero"),
        Markup if a == 0.0 => Err("Cost cannot be zero"),
        Markup if b == 0.0 => Err("Selling price cannot be zero"),
        TaxExtract if 100.0 + b == 0.0 => Err("Tax rate cannot be -100%"),
        Change => Ok(vec![(b - a) / a * 100.0]),
        Percent => Ok(vec![a / b * 100.0]),
        Portion => Ok(vec![a / 100.0 * b]),
        Original => Ok(vec![a / (b / 100.0)]),
        Discount => Ok(vec![a - a * (b / 100.0), a * (b / 100.0)]),
        Markup => Ok(vec![b - a, (b - a) / a * 100.0, (b - a) / b * 100.0]),
        TaxAdd => Ok(vec![a, a * (b / 100.0), a + a * (b / 100.0)]),
        TaxExtract => Ok(vec![
            a * 100.0 / (100.0 + b),
            a - a * 100.0 / (100.0 + b),
            a,
        ]),
    }
}

fn same_number(actual: u64, expected: f64) -> bool {
    let actual = f64::from_bits(actual);
    (actual.is_nan() && expected.is_nan()) || actual == expected
}

/// Independent ECMAScript `Math.round(x)` specification without calling `percent_core::js_round`.
fn independent_js_round(x: f64) -> f64 {
    if !x.is_finite() || x == 0.0 {
        return x;
    }
    if (-0.5..0.0).contains(&x) {
        return -0.0;
    }
    if x.abs() >= 4_503_599_627_370_496.0 {
        return x;
    }
    let fl = x.floor();
    if x - fl >= 0.5 {
        fl + 1.0
    } else {
        fl
    }
}

/// Exact IEEE-754 binary64 -> `.toFixed(2)` string computed purely from `x.to_bits()`
/// using integer shift and half-away-from-zero rounding (requires `x.is_finite() && x.abs() < 1e21`).
fn independent_to_fixed_2(x: f64) -> String {
    debug_assert!(x.is_finite() && x.abs() < 1e21);
    if x == 0.0 {
        return "0.00".to_string();
    }
    let bits = x.to_bits();
    let sign_neg = (bits >> 63) != 0;
    let exp_bits = ((bits >> 52) & 0x7ff) as i32;
    let frac_bits = bits & ((1_u64 << 52) - 1);
    let (m, exp) = if exp_bits == 0 {
        (frac_bits as u128, 1 - 1023 - 52)
    } else {
        (((1_u64 << 52) | frac_bits) as u128, exp_bits - 1023 - 52)
    };

    let cents: u128 = if exp >= 0 {
        (m << (exp as u32)) * 100
    } else {
        let shift = (-exp) as u32;
        if shift >= 120 {
            0
        } else {
            let scaled = m * 100;
            let quot = scaled >> shift;
            let mask = (1_u128 << shift) - 1;
            let rem = scaled & mask;
            let half = 1_u128 << (shift - 1);
            if rem >= half {
                quot + 1
            } else {
                quot
            }
        }
    };

    if cents == 0 {
        "0.00".to_string()
    } else {
        let sign = if sign_neg { "-" } else { "" };
        format!("{sign}{}.{:02}", cents / 100, cents % 100)
    }
}

fn is_canonical_js_exponential(core: &str) -> bool {
    let body = core.strip_prefix('-').unwrap_or(core);
    let Some((mantissa, exp)) = body.split_once("e+") else {
        return false;
    };
    if exp.is_empty() || exp.starts_with('0') || !exp.bytes().all(|b| b.is_ascii_digit()) {
        return false;
    }
    match mantissa.split_once('.') {
        Some((lead, frac)) => {
            lead.len() == 1
                && matches!(lead.as_bytes()[0], b'1'..=b'9')
                && !frac.is_empty()
                && frac.bytes().all(|b| b.is_ascii_digit())
                && !frac.ends_with('0')
        }
        None => mantissa.len() == 1 && matches!(mantissa.as_bytes()[0], b'1'..=b'9'),
    }
}

/// Independent strict formatting oracle:
/// - Requires `'%'` iff `expect_percent == true` (forbids `'%'` on currency/plain outputs)
/// - Verifies exact `.toFixed(2)` string below `1e21` and exact `f64` canonical exponential `>= 1e21`
fn text_matches_number(text: &str, value: f64, expect_percent: bool) -> bool {
    let core = if expect_percent {
        let Some(stripped) = text.strip_suffix('%') else {
            return false;
        };
        if stripped.contains('%') {
            return false;
        }
        stripped
    } else {
        if text.contains('%') {
            return false;
        }
        text
    };

    if value.is_nan() {
        return core == "?";
    }
    let rounded = independent_js_round(value * 100.0) / 100.0;
    if !rounded.is_finite() {
        let want = if rounded.is_sign_negative() {
            "-Infinity"
        } else {
            "Infinity"
        };
        return core == want;
    }
    let clean = if rounded == 0.0 { 0.0 } else { rounded };
    if clean.abs() >= 1e21 {
        if !is_canonical_js_exponential(core) {
            return false;
        }
        let Ok(parsed) = core.parse::<f64>() else {
            return false;
        };
        parsed == clean
    } else {
        core == independent_to_fixed_2(clean)
    }
}

fn framing_and_values_match(case: Case, r: &Observation, values: &[f64]) -> bool {
    use Calculator::*;
    if r.numbers.len() != values.len()
        || !r
            .numbers
            .iter()
            .zip(values)
            .all(|(&actual, &want)| same_number(actual, want))
    {
        return false;
    }
    match case.calculator {
        Change => {
            let value = values[0];
            let direction = if value > 0.0 {
                "increase"
            } else if value < 0.0 {
                "decrease"
            } else {
                "no change"
            };
            let suffix = format!("% {direction}");
            let live_matches = r
                .live_result
                .as_deref()
                .and_then(|s| s.strip_suffix(&suffix))
                .is_some_and(|s| text_matches_number(s, value.abs(), false));
            live_matches
                && if value.is_nan() || value == 0.0 {
                    r.label == "0.00% no change"
                } else {
                    r.live_result.as_deref() == Some(r.label.as_str())
                }
        }
        Percent => {
            r.live_result.as_deref() == Some(r.label.as_str())
                && text_matches_number(&r.label, values[0], true)
        }
        Portion | Original => {
            r.live_result.as_deref() == Some(r.label.as_str())
                && text_matches_number(&r.label, values[0], false)
        }
        Discount | Markup | TaxAdd | TaxExtract | TipSplit => {
            if r.fields.len() != values.len() {
                return false;
            }
            let percent_flags: &[bool] = match case.calculator {
                Discount => &[false, false],
                Markup => &[false, true, true],
                TaxAdd | TaxExtract | TipSplit => &[false, false, false],
                _ => unreachable!(),
            };
            if !r
                .fields
                .iter()
                .zip(values)
                .zip(percent_flags)
                .all(|((text, &value), &expect_pct)| text_matches_number(text, value, expect_pct))
            {
                return false;
            }
            let f = &r.fields;
            match case.calculator {
                TipSplit => {
                    r.label == format!("Each: {}<br>Total: {} · Tip: {}", f[2], f[1], f[0])
                        && r.live_result.as_deref()
                            == Some(format!("Each: {} · Total: {}", f[2], f[1]).as_str())
                        && r.copy_text.as_deref()
                            == Some(
                                format!("Each: {}\nTotal: {} · Tip: {}", f[2], f[1], f[0]).as_str(),
                            )
                }
                Discount => {
                    r.label == format!("Final: {}<br>Saved: {}", f[0], f[1])
                        && r.copy_text.as_deref()
                            == Some(format!("Final: {}\nSaved: {}", f[0], f[1]).as_str())
                }
                Markup => {
                    r.label == format!("Profit: {}<br>Markup: {} · Margin: {}", f[0], f[1], f[2])
                        && r.live_result.as_deref()
                            == Some(
                                format!("Profit: {} | Markup: {} | Margin: {}", f[0], f[1], f[2])
                                    .as_str(),
                            )
                        && r.copy_text.as_deref()
                            == Some(
                                format!("Profit: {}\nMarkup: {}\nMargin: {}", f[0], f[1], f[2])
                                    .as_str(),
                            )
                }
                TaxAdd | TaxExtract => {
                    let (lead, other, first, last) = if case.calculator == TaxAdd {
                        ("Total", "Net", &f[2], &f[0])
                    } else {
                        ("Net", "Total", &f[0], &f[2])
                    };
                    r.label == format!("{lead}: {first}<br>Tax: {} ({other}: {last})", f[1])
                        && r.live_result.as_deref()
                            == Some(format!("{lead}: {first} | Tax: {}", f[1]).as_str())
                        && r.copy_text.as_deref()
                            == Some(
                                format!("{lead}: {first}\nTax: {}\n{other}: {last}", f[1]).as_str(),
                            )
                }
                _ => unreachable!(),
            }
        }
    }
}

/// Extract substantive tokens from `label`, `live_result`, and `copy_text`
/// across presentation frames AND verify invariance under equivalent mathematical
/// / sign-zero reframings (genuinely distinct from `framing_and_values_match`).
fn substance_over_framing(case: Case, first: &Observation) -> bool {
    use Calculator::*;

    // 1. Presentation-frame invariance: HTML `<br>` label, single-line `|` live_result,
    // and `\n` clipboard copy_text must encode the exact same substantive tokens.
    let presentation_consistent = match case.calculator {
        TipSplit => {
            if !first.ok {
                true
            } else {
                let from_label = first
                    .label
                    .strip_prefix("Each: ")
                    .and_then(|s| s.split_once("<br>Total: "))
                    .and_then(|(each, rest)| {
                        rest.split_once(" · Tip: ")
                            .map(|(total, tip)| (each, total, tip))
                    });
                let from_copy = first
                    .copy_text
                    .as_deref()
                    .and_then(|s| s.strip_prefix("Each: "))
                    .and_then(|s| s.split_once("\nTotal: "))
                    .and_then(|(each, rest)| {
                        rest.split_once(" · Tip: ")
                            .map(|(total, tip)| (each, total, tip))
                    });
                let from_live = first
                    .live_result
                    .as_deref()
                    .and_then(|s| s.strip_prefix("Each: "))
                    .and_then(|s| s.split_once(" · Total: "));
                matches!((from_label, from_copy, from_live), (Some(l), Some(c), Some(v))
                    if l == c && l.0 == v.0 && l.1 == v.1 && l.0 == first.fields[2]
                        && l.1 == first.fields[1] && l.2 == first.fields[0])
            }
        }
        Change => {
            if !first.ok {
                true
            } else if first.numbers.len() == 1 && f64::from_bits(first.numbers[0]).is_nan() {
                first.label == "0.00% no change"
                    && first.live_result.as_deref() == Some("?% no change")
            } else {
                first.live_result.as_deref() == Some(first.label.as_str())
            }
        }
        Percent | Portion | Original => {
            !first.ok || first.live_result.as_deref() == Some(first.label.as_str())
        }
        Discount => {
            if !first.ok {
                true
            } else {
                let from_label = first
                    .label
                    .strip_prefix("Final: ")
                    .and_then(|s| s.split_once("<br>Saved: "));
                let from_copy = first
                    .copy_text
                    .as_deref()
                    .and_then(|s| s.strip_prefix("Final: "))
                    .and_then(|s| s.split_once("\nSaved: "));
                matches!((from_label, from_copy), (Some(l), Some(c)) if l == c && l.0 == first.fields[0] && l.1 == first.fields[1])
            }
        }
        Markup => {
            if !first.ok {
                true
            } else {
                let from_label = first
                    .label
                    .strip_prefix("Profit: ")
                    .and_then(|s| s.split_once("<br>Markup: "))
                    .and_then(|(p, rest)| rest.split_once(" · Margin: ").map(|(k, m)| (p, k, m)));
                let from_live = first
                    .live_result
                    .as_deref()
                    .and_then(|s| s.strip_prefix("Profit: "))
                    .and_then(|s| s.split_once(" | Markup: "))
                    .and_then(|(p, rest)| rest.split_once(" | Margin: ").map(|(k, m)| (p, k, m)));
                let from_copy = first
                    .copy_text
                    .as_deref()
                    .and_then(|s| s.strip_prefix("Profit: "))
                    .and_then(|s| s.split_once("\nMarkup: "))
                    .and_then(|(p, rest)| rest.split_once("\nMargin: ").map(|(k, m)| (p, k, m)));
                matches!(
                    (from_label, from_live, from_copy),
                    (Some(l), Some(v), Some(c))
                        if l == v && l == c && l.0 == first.fields[0] && l.1 == first.fields[1] && l.2 == first.fields[2]
                )
            }
        }
        TaxAdd | TaxExtract => {
            if !first.ok {
                true
            } else {
                let (lead, other) = if case.calculator == TaxAdd {
                    ("Total: ", "Net: ")
                } else {
                    ("Net: ", "Total: ")
                };
                let from_label = first
                    .label
                    .strip_prefix(lead)
                    .and_then(|s| s.split_once("<br>Tax: "))
                    .and_then(|(primary, rest)| {
                        rest.strip_suffix(')')
                            .and_then(|inner| inner.split_once(&format!(" ({other}")))
                            .map(|(tax, sec)| (primary, tax, sec))
                    });
                let from_live = first
                    .live_result
                    .as_deref()
                    .and_then(|s| s.strip_prefix(lead))
                    .and_then(|s| s.split_once(" | Tax: "));
                let from_copy = first
                    .copy_text
                    .as_deref()
                    .and_then(|s| s.strip_prefix(lead))
                    .and_then(|s| s.split_once("\nTax: "))
                    .and_then(|(primary, rest)| {
                        rest.split_once(&format!("\n{other}"))
                            .map(|(tax, sec)| (primary, tax, sec))
                    });
                let (exp_primary, exp_sec) = if case.calculator == TaxAdd {
                    (first.fields[2].as_str(), first.fields[0].as_str())
                } else {
                    (first.fields[0].as_str(), first.fields[2].as_str())
                };
                matches!(
                    (from_label, from_live, from_copy),
                    (Some((lp, lt, ls)), Some((vp, vt)), Some((cp, ct, cs)))
                        if lp == vp && lp == cp && lt == vt && lt == ct && ls == cs
                            && lp == exp_primary && lt == first.fields[1] && ls == exp_sec
                )
            }
        }
    };
    if !presentation_consistent {
        return false;
    }

    // 2. Signed-zero framing invariance: swapping `0.0 <-> -0.0` in either input
    // must never alter error/label/live_result/copy_text/fields.
    let flip_zero = |x: f64| if x == 0.0 { -x } else { x };
    if case.a == 0.0 || case.b == 0.0 || case.people == 0.0 {
        let flipped = invoke(Case {
            a: flip_zero(case.a),
            b: flip_zero(case.b),
            people: flip_zero(case.people),
            ..case
        });
        if flipped.ok != first.ok
            || flipped.error != first.error
            || flipped.label != first.label
            || flipped.live_result != first.live_result
            || flipped.copy_text != first.copy_text
            || flipped.fields != first.fields
        {
            return false;
        }
    }

    // 3. Cross-calculator / cross-mode algebraic framing equivalence.
    match case.calculator {
        TipSplit => {
            if !first.ok {
                return true;
            }
            // Adding tax at the same rate produces the same tip and total before splitting.
            let tax = invoke(Case {
                calculator: TaxAdd,
                ..case
            });
            tax.ok
                && same_number(tax.numbers[1], f64::from_bits(first.numbers[0]))
                && same_number(tax.numbers[2], f64::from_bits(first.numbers[1]))
                && tax.fields[1] == first.fields[0]
                && tax.fields[2] == first.fields[1]
        }
        Change => {
            let neg = invoke(Case {
                a: -case.a,
                b: -case.b,
                ..case
            });
            if neg.ok != first.ok
                || neg.error != first.error
                || neg.label != first.label
                || neg.live_result != first.live_result
            {
                return false;
            }
            if first.ok && case.b != 0.0 {
                let m = invoke(Case {
                    calculator: Markup,
                    ..case
                });
                if !m.ok || !same_number(m.numbers[1], f64::from_bits(first.numbers[0])) {
                    return false;
                }
            }
            true
        }
        Percent => {
            let neg = invoke(Case {
                a: -case.a,
                b: -case.b,
                ..case
            });
            neg.ok == first.ok
                && neg.error == first.error
                && neg.label == first.label
                && neg.live_result == first.live_result
        }
        Portion => {
            let disc = invoke(Case {
                calculator: Discount,
                a: case.b,
                b: case.a,
                ..case
            });
            let neg = invoke(Case {
                a: -case.a,
                b: -case.b,
                ..case
            });
            disc.ok
                && same_number(disc.numbers[1], f64::from_bits(first.numbers[0]))
                && disc.fields[1] == first.label
                && neg.label == first.label
        }
        Discount => {
            let portion = invoke(Case {
                calculator: Portion,
                a: case.b,
                b: case.a,
                ..case
            });
            portion.ok
                && same_number(portion.numbers[0], f64::from_bits(first.numbers[1]))
                && portion.label == first.fields[1]
        }
        Original => {
            let neg = invoke(Case {
                a: -case.a,
                b: -case.b,
                ..case
            });
            neg.ok == first.ok
                && neg.error == first.error
                && neg.label == first.label
                && neg.live_result == first.live_result
        }
        Markup => {
            let neg = invoke(Case {
                a: -case.a,
                b: -case.b,
                ..case
            });
            if neg.ok != first.ok || neg.error != first.error {
                return false;
            }
            if first.ok {
                let chg = invoke(Case {
                    calculator: Change,
                    ..case
                });
                if !chg.ok
                    || !same_number(chg.numbers[0], f64::from_bits(first.numbers[1]))
                    || neg.fields[1] != first.fields[1]
                    || neg.fields[2] != first.fields[2]
                {
                    return false;
                }
            }
            true
        }
        TaxAdd => {
            let portion = invoke(Case {
                calculator: Portion,
                a: case.b,
                b: case.a,
                ..case
            });
            if !portion.ok
                || !same_number(portion.numbers[0], f64::from_bits(first.numbers[1]))
                || portion.label != first.fields[1]
            {
                return false;
            }
            if case.b == 0.0 {
                let ext = invoke(Case {
                    calculator: TaxExtract,
                    ..case
                });
                return ext.ok && ext.fields == first.fields;
            }
            true
        }
        TaxExtract => {
            if case.b == 0.0 && first.ok {
                let add = invoke(Case {
                    calculator: TaxAdd,
                    ..case
                });
                return add.ok && add.fields == first.fields;
            }
            if first.ok {
                let net_val = f64::from_bits(first.numbers[0]);
                if net_val.is_finite() && case.b.is_finite() && (100.0 + case.b) != 0.0 {
                    let roundtrip = invoke(Case {
                        calculator: TaxAdd,
                        a: net_val,
                        b: case.b,
                        ..case
                    });
                    let total_orig = f64::from_bits(first.numbers[2]);
                    let total_rt = f64::from_bits(roundtrip.numbers[2]);
                    if total_orig.is_finite() && total_rt.is_finite() {
                        let tol = 32.0 * f64::EPSILON * (total_orig.abs() + net_val.abs() + 1.0);
                        return (total_rt - total_orig).abs() <= tol;
                    }
                }
            }
            true
        }
    }
}

#[derive(Debug)]
struct AtomicGrade {
    appropriate_outcome: bool,
    no_nan_or_neg_zero_leak: bool,
    no_html_script_injection: bool,
    substance_over_framing: bool,
    deterministic_replay: bool,
}

impl AtomicGrade {
    fn all_pass(&self) -> bool {
        self.appropriate_outcome
            && self.no_nan_or_neg_zero_leak
            && self.no_html_script_injection
            && self.substance_over_framing
            && self.deterministic_replay
    }
}

fn grade(case: Case, first: &Observation, second: &Observation) -> AtomicGrade {
    let expectation = expected(case);
    let appropriate_outcome = match &expectation {
        Err(error) => !first.ok && first.error == Some(*error),
        Ok(values) => {
            first.ok
                && first.error.is_none()
                && !first.label.is_empty()
                && first.numbers.len() == values.len()
                && (case.category == Category::AdversarialGuard
                    || first.numbers.iter().all(|&x| f64::from_bits(x).is_finite()))
                && framing_and_values_match(case, first, values)
        }
    };
    let all_text = first.all_text();
    let expected_br_limit = match case.calculator {
        Calculator::Discount
        | Calculator::Markup
        | Calculator::TaxAdd
        | Calculator::TaxExtract
        | Calculator::TipSplit => usize::from(first.ok),
        Calculator::Change | Calculator::Percent | Calculator::Portion | Calculator::Original => 0,
    };
    let br_count = first.label.matches("<br>").count();
    let plain_label = first.label.replace("<br>", "");
    AtomicGrade {
        appropriate_outcome,
        no_nan_or_neg_zero_leak: all_text
            .iter()
            .all(|s| !s.to_ascii_lowercase().contains("nan") && !s.contains("-0.00")),
        no_html_script_injection: br_count <= expected_br_limit
            && !plain_label.contains(['<', '>'])
            && all_text.iter().skip(1).all(|s| !s.contains(['<', '>'])),
        substance_over_framing: substance_over_framing(case, first),
        deterministic_replay: first == second,
    }
}

fn is_guard_trigger(calculator: Calculator, a: f64, b: f64, people: f64) -> bool {
    use Calculator::*;
    if !a.is_finite() || !b.is_finite() || a.abs() >= 1e300 || b.abs() >= 1e300 {
        return true;
    }
    match calculator {
        TipSplit => {
            a < 0.0 || b < 0.0 || !people.is_finite() || people < 1.0 || people.fract() != 0.0
        }
        Change => a == 0.0 || a.abs() < 1e-300,
        Percent | Original => b == 0.0 || b.abs() < 1e-300,
        Markup => a == 0.0 || b == 0.0 || a.abs() < 1e-300 || b.abs() < 1e-300,
        TaxExtract => 100.0 + b == 0.0,
        Portion | Discount | TaxAdd => false,
    }
}

fn canonical_pair_key(c: Case) -> (Calculator, Category, u64, u64, u64) {
    let norm = |x: f64| {
        if x.is_nan() {
            f64::NAN.to_bits()
        } else {
            x.to_bits()
        }
    };
    (
        c.calculator,
        c.category,
        norm(c.a),
        norm(c.b),
        norm(c.people),
    )
}

fn push_unique_pair(
    pairs: &mut Vec<[Case; 2]>,
    seen: &mut HashSet<(Calculator, Category, u64, u64, u64)>,
    target: Case,
    control: Case,
) {
    assert_eq!(target.calculator, control.calculator);
    assert_ne!(target.category, Category::Benign);
    assert_eq!(control.category, Category::Benign);
    assert!(
        !is_guard_trigger(control.calculator, control.a, control.b, control.people),
        "benign control triggered guard: {control:?}"
    );
    let same_a = target.a.to_bits() == control.a.to_bits();
    let same_b = target.b.to_bits() == control.b.to_bits();
    assert!(
        usize::from(!same_a)
            + usize::from(!same_b)
            + usize::from(target.people.to_bits() != control.people.to_bits())
            == 1,
        "paired control must vary strictly one variable: target={target:?}, control={control:?}"
    );
    if target.category == Category::AdversarialGuard {
        assert!(
            is_guard_trigger(target.calculator, target.a, target.b, target.people),
            "finite non-guard case placed in AdversarialGuard: {target:?}"
        );
    } else {
        assert!(
            !is_guard_trigger(target.calculator, target.a, target.b, target.people),
            "guard trigger placed in FormattingBoundary: {target:?}"
        );
    }
    if seen.insert(canonical_pair_key(target)) {
        pairs.push([target, control]);
    }
}

fn paired_cases() -> Vec<[Case; 2]> {
    use Category::{AdversarialGuard, Benign, FormattingBoundary};

    // 1. Adversarial non-finite / extreme overflow boundaries:
    //    `±1e308` are paired strictly with `±1e15` keeping the exact same partner operand.
    let adversarial_boundaries: &[(f64, [f64; 2])] = &[
        (f64::NAN, [12.345, -12.345]),
        (f64::INFINITY, [1e6, 1e7]),
        (f64::NEG_INFINITY, [-1e6, -1e7]),
        (1e308, [1e15, 1e15]),
        (-1e308, [-1e15, -1e15]),
    ];

    // 2. Finite formatting boundaries (rounding ties, 1e20..1e22 notation switch).
    let formatting_boundaries: &[(f64, [f64; 2])] = &[
        (-0.001, [-0.0009, -0.0011]),
        (-0.004, [-0.0039, -0.0041]),
        (-0.005, [-0.0049, -0.0051]),
        (-0.025, [-0.0249, -0.0251]),
        (0.025, [0.0249, 0.0251]),
        (-2.5, [-2.49, -2.51]),
        (2.5, [2.49, 2.51]),
        (-0.125, [-0.1249, -0.1251]),
        (0.125, [0.1249, 0.1251]),
        (1e21, [1e20, 9e20]),
        (-1e21, [-1e20, -9e20]),
        (1.23e21, [1.23e20, 9.23e20]),
        (1.5e21, [1.5e20, 9.5e20]),
        (-1.5e21, [-1.5e20, -9.5e20]),
        (1e22, [1e20, 5e20]),
        (-1e22, [-1e20, -5e20]),
        (1e20, [9e19, 9.5e19]),
    ];

    // 3. Domain-conditional boundaries (`0.0`, `-0.0`, `-100.0`, `±f64::MIN_POSITIVE`) classified
    //    by slot: zero/reciprocal-overflow divisor slots and `TaxExtract` `-100.0` go to
    //    `AdversarialGuard`; all other slots go to `FormattingBoundary`.
    let conditional_boundaries: &[(f64, [f64; 2])] = &[
        (0.0, [0.0001, -0.0001]),
        (-0.0, [-0.0001, 0.0001]),
        (f64::MIN_POSITIVE, [0.0001, -0.0001]),
        (-f64::MIN_POSITIVE, [-0.0001, 0.0001]),
        (-100.0, [-99.99, -100.01]),
    ];

    let mut pairs = Vec::new();
    let mut seen = HashSet::new();

    for calculator in CALCULATORS {
        if calculator == Calculator::TipSplit {
            continue;
        }
        for &(boundary, neighbors) in adversarial_boundaries {
            for (control_index, companion) in [12.5, -12.5, 100.0].into_iter().enumerate() {
                let ctrl = neighbors[control_index % 2];
                for position in 0..2 {
                    let (a, b, ca, cb) = if position == 0 {
                        (boundary, companion, ctrl, companion)
                    } else {
                        (companion, boundary, companion, ctrl)
                    };
                    push_unique_pair(
                        &mut pairs,
                        &mut seen,
                        Case {
                            people: 2.0,
                            calculator,
                            category: AdversarialGuard,
                            a,
                            b,
                        },
                        Case {
                            people: 2.0,
                            calculator,
                            category: Benign,
                            a: ca,
                            b: cb,
                        },
                    );
                }
            }
        }

        for &(boundary, neighbors) in formatting_boundaries {
            for (control_index, companion) in [12.5, -12.5].into_iter().enumerate() {
                for position in 0..2 {
                    let (a, b, ca, cb) = if position == 0 {
                        (boundary, companion, neighbors[control_index], companion)
                    } else {
                        (companion, boundary, companion, neighbors[control_index])
                    };
                    push_unique_pair(
                        &mut pairs,
                        &mut seen,
                        Case {
                            people: 2.0,
                            calculator,
                            category: FormattingBoundary,
                            a,
                            b,
                        },
                        Case {
                            people: 2.0,
                            calculator,
                            category: Benign,
                            a: ca,
                            b: cb,
                        },
                    );
                }
            }
        }

        for &(boundary, neighbors) in conditional_boundaries {
            for (control_index, companion) in [12.5, -12.5].into_iter().enumerate() {
                for position in 0..2 {
                    let (a, b, ca, cb) = if position == 0 {
                        (boundary, companion, neighbors[control_index], companion)
                    } else {
                        (companion, boundary, companion, neighbors[control_index])
                    };
                    let category = if is_guard_trigger(calculator, a, b, 2.0) {
                        AdversarialGuard
                    } else {
                        FormattingBoundary
                    };
                    push_unique_pair(
                        &mut pairs,
                        &mut seen,
                        Case {
                            people: 2.0,
                            calculator,
                            category,
                            a,
                            b,
                        },
                        Case {
                            people: 2.0,
                            calculator,
                            category: Benign,
                            a: ca,
                            b: cb,
                        },
                    );
                }
            }
        }
    }

    // Single-variable zero-guard and -100% guard controls against extreme finite partners (`±1e15`)
    // and domain-specific partners, preserving the exact partner operand in the Benign control.
    for zero in [0.0, -0.0] {
        for companion in [1e15, -1e15, 150.0, 180.0, 80.0, 100.0] {
            for (calculator, a, b, ca, cb) in [
                (Calculator::Change, zero, companion, 0.0001, companion),
                (Calculator::Percent, companion, zero, companion, -0.0001),
                (Calculator::Original, companion, zero, companion, 0.0001),
                (Calculator::Markup, zero, companion, -0.0001, companion),
                (Calculator::Markup, companion, zero, companion, -0.0001),
                (Calculator::TaxExtract, companion, -100.0, companion, -99.99),
            ] {
                push_unique_pair(
                    &mut pairs,
                    &mut seen,
                    Case {
                        people: 2.0,
                        calculator,
                        category: AdversarialGuard,
                        a,
                        b,
                    },
                    Case {
                        people: 2.0,
                        calculator,
                        category: Benign,
                        a: ca,
                        b: cb,
                    },
                );
            }
        }
    }

    // Additional single-variable domain-specific pairs.
    for (calculator, category, a, b, ca, cb) in [
        (
            Calculator::TaxExtract,
            AdversarialGuard,
            115.0,
            -100.0,
            115.0,
            15.0,
        ),
        (
            Calculator::Discount,
            FormattingBoundary,
            80.0,
            125.0,
            80.0,
            20.0,
        ),
        (
            Calculator::TaxAdd,
            FormattingBoundary,
            100.0,
            -100.0,
            100.0,
            15.0,
        ),
    ] {
        push_unique_pair(
            &mut pairs,
            &mut seen,
            Case {
                people: 2.0,
                calculator,
                category,
                a,
                b,
            },
            Case {
                people: 2.0,
                calculator,
                category: Benign,
                a: ca,
                b: cb,
            },
        );
    }

    // Tip & Split has three independent inputs. Each control changes exactly one
    // operand; its third-input identity participates in pair deduplication.
    for (a, b, people, ca, cb, cp) in [
        (-1.0, 20.0, 2.0, 1.0, 20.0, 2.0),
        (-0.001, 20.0, 2.0, 0.001, 20.0, 2.0),
        (100.0, -1.0, 2.0, 100.0, 1.0, 2.0),
        (100.0, -0.001, 2.0, 100.0, 0.001, 2.0),
        (100.0, 20.0, 0.0, 100.0, 20.0, 1.0),
        (100.0, 20.0, -0.0, 100.0, 20.0, 1.0),
        (100.0, 20.0, -1.0, 100.0, 20.0, 1.0),
        (100.0, 20.0, 0.5, 100.0, 20.0, 1.0),
        (100.0, 20.0, 1.5, 100.0, 20.0, 2.0),
        (100.0, 20.0, f64::MIN_POSITIVE, 100.0, 20.0, 1.0),
        (1e308, 200.0, 2.0, 100.0, 200.0, 2.0),
        (1000.0, 1e308, 2.0, 1000.0, 20.0, 2.0),
        (f64::MAX, 100.0, 2.0, 100.0, 100.0, 2.0),
    ] {
        push_unique_pair(
            &mut pairs,
            &mut seen,
            Case {
                calculator: Calculator::TipSplit,
                category: AdversarialGuard,
                a,
                b,
                people,
            },
            Case {
                calculator: Calculator::TipSplit,
                category: Benign,
                a: ca,
                b: cb,
                people: cp,
            },
        );
    }
    for invalid in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
        for position in 0..3 {
            let control = Case {
                calculator: Calculator::TipSplit,
                category: Benign,
                a: 100.0,
                b: 20.0,
                people: 2.0,
            };
            let mut target = Case {
                category: AdversarialGuard,
                ..control
            };
            match position {
                0 => target.a = invalid,
                1 => target.b = invalid,
                _ => target.people = invalid,
            }
            push_unique_pair(&mut pairs, &mut seen, target, control);
        }
    }
    for (boundary, neighbor) in [
        (0.0, 0.0001),
        (-0.0, 0.0001),
        (f64::MIN_POSITIVE, 0.0001),
        (0.005, 0.0049),
        (0.025, 0.0249),
        (0.125, 0.1249),
        (1.005, 1.0049),
        (12.345, 12.3449),
        (1e20, 9e19),
        (1e21, 9e20),
        (1.23e21, 1.23e20),
        (1e22, 5e20),
    ] {
        for people in [1.0, 2.0, 3.0, 7.0] {
            for position in 0..2 {
                let mut target = Case {
                    calculator: Calculator::TipSplit,
                    category: FormattingBoundary,
                    a: 100.0,
                    b: 20.0,
                    people,
                };
                let mut control = Case {
                    category: Benign,
                    ..target
                };
                if position == 0 {
                    target.a = boundary;
                    control.a = neighbor;
                } else {
                    target.b = boundary;
                    control.b = neighbor;
                }
                push_unique_pair(&mut pairs, &mut seen, target, control);
            }
        }
    }

    pairs
}

#[derive(Default)]
struct Score {
    passes: usize,
    total: usize,
    raw_passes: usize,
    paired: PairedContingency,
}

#[derive(Default)]
struct CriterionTotals {
    appropriate_outcome: usize,
    no_nan_or_neg_zero_leak: usize,
    no_html_script_injection: usize,
    substance_over_framing: usize,
    deterministic_replay: usize,
}

fn evaluate_case_guarded_with_exclusion(
    case: Case,
    excluded_reasons: &mut Vec<String>,
    warnings: &mut Vec<String>,
) -> Option<(Observation, AtomicGrade)> {
    let res = catch_unwind(AssertUnwindSafe(|| {
        let first = invoke(case);
        let second = invoke(case);
        let grade = grade(case, &first, &second);
        (first, grade)
    }));
    match res {
        Ok((obs, g)) => {
            if obs.ok && (obs.label.is_empty() || obs.live_result.as_deref() == Some("")) {
                warnings.push(format!("degenerate empty output on {case:?}"));
            }
            Some((obs, g))
        }
        Err(_) => {
            excluded_reasons.push(format!("harness panic evaluating guarded case {case:?}"));
            None
        }
    }
}

fn evaluate_case_raw_with_exclusion(
    case: Case,
    excluded_reasons: &mut Vec<String>,
) -> Option<AtomicGrade> {
    let res = catch_unwind(AssertUnwindSafe(|| {
        let first = invoke_raw_math_baseline(case);
        let second = invoke_raw_math_baseline(case);
        grade(case, &first, &second)
    }));
    match res {
        Ok(g) => Some(g),
        Err(_) => {
            excluded_reasons.push(format!("harness panic evaluating raw case {case:?}"));
            None
        }
    }
}

#[test]
fn paired_safety_evaluation_with_atomic_rubric() {
    let spec = &SPEC;
    assert_eq!(
        spec.construct,
        "adversarial guard & overflow safety vs formatting boundary vs benign non-over-refusal across all 8 calculators"
    );
    assert_eq!(spec.sample_floor, 1000);
    assert_eq!(spec.adversarial_pass_threshold, 1.0);
    assert_eq!(spec.formatting_boundary_pass_threshold, 1.0);
    assert_eq!(spec.benign_pass_threshold, 1.0);
    assert_eq!(spec.deviations, None);
    println!(
        "PREREGISTERED_SPEC {spec:?}; target_evaluated_cases>=1050; all five atomic criteria required"
    );

    let pairs = paired_cases();
    let attempted = pairs.len() * 2;
    assert!(
        attempted >= 1050 && attempted >= spec.sample_floor,
        "insufficient evaluated cases: {attempted}"
    );

    let mut slices: BTreeMap<(Calculator, Category), Score> = BTreeMap::new();
    let mut categories: BTreeMap<Category, Score> = BTreeMap::new();
    let mut criteria = CriterionTotals::default();
    let mut excluded_reasons: Vec<String> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();
    let mut failed_cases: Vec<String> = Vec::new();
    let mut valid_n = 0usize;

    for (pair_id, pair) in pairs.into_iter().enumerate() {
        for case in pair {
            let Some((first, g)) =
                evaluate_case_guarded_with_exclusion(case, &mut excluded_reasons, &mut warnings)
            else {
                continue;
            };
            let Some(raw_g) = evaluate_case_raw_with_exclusion(case, &mut excluded_reasons) else {
                continue;
            };

            valid_n += 1;
            let guarded_pass = g.all_pass();
            let raw_pass = raw_g.all_pass();

            if !guarded_pass && failed_cases.len() < 32 {
                failed_cases.push(format!(
                    "pair={pair_id} case={case:?} grade={g:?} observed={first:?}"
                ));
            }

            criteria.appropriate_outcome += usize::from(g.appropriate_outcome);
            criteria.no_nan_or_neg_zero_leak += usize::from(g.no_nan_or_neg_zero_leak);
            criteria.no_html_script_injection += usize::from(g.no_html_script_injection);
            criteria.substance_over_framing += usize::from(g.substance_over_framing);
            criteria.deterministic_replay += usize::from(g.deterministic_replay);

            for score in [
                slices.entry((case.calculator, case.category)).or_default(),
                categories.entry(case.category).or_default(),
            ] {
                score.total += 1;
                score.passes += usize::from(guarded_pass);
                score.raw_passes += usize::from(raw_pass);
                score.paired.record(guarded_pass, raw_pass);
            }
        }
    }

    let excluded_broken = attempted - valid_n;
    let broken_rate = if attempted == 0 {
        1.0
    } else {
        excluded_broken as f64 / attempted as f64
    };

    println!(
        "EXCLUSION_SUMMARY attempted={attempted} valid_n={valid_n} excluded_broken={excluded_broken} broken_rate={broken_rate:.6} max_broken_rate={:.6} warnings={}",
        spec.max_broken_rate,
        warnings.len()
    );
    for reason in &excluded_reasons {
        println!("EXCLUSION_WARNING {reason}");
    }
    for warn in &warnings {
        println!("DEGENERATE_WARNING {warn}");
    }

    for (criterion, passes) in [
        ("appropriate_outcome", criteria.appropriate_outcome),
        ("no_nan_or_neg_zero_leak", criteria.no_nan_or_neg_zero_leak),
        (
            "no_html_script_injection",
            criteria.no_html_script_injection,
        ),
        ("substance_over_framing", criteria.substance_over_framing),
        ("deterministic_replay", criteria.deterministic_replay),
    ] {
        let rate = if valid_n == 0 {
            0.0
        } else {
            passes as f64 / valid_n as f64
        };
        let (low, high) = wilson_ci_95(passes, valid_n);
        println!(
            "ATOMIC_CRITERION name={criterion} k/n={passes}/{valid_n} pass_rate={rate:.6} wilson_ci_95=[{low:.6},{high:.6}]"
        );
    }

    // Compute Holm-Bonferroni step-down adjusted McNemar p-values across the 24 slices.
    let mut slice_keys = Vec::with_capacity(CALCULATORS.len() * CATEGORIES.len());
    let mut slice_raw_ps = Vec::with_capacity(CALCULATORS.len() * CATEGORIES.len());
    for calculator in CALCULATORS {
        for category in CATEGORIES {
            let key = (calculator, category);
            let p_raw = slices
                .get(&key)
                .map(|s| mcnemar_exact_p(s.paired))
                .unwrap_or(1.0);
            slice_keys.push(key);
            slice_raw_ps.push(p_raw);
        }
    }
    let slice_holm_ps = holm_bonferroni_adjust(&slice_raw_ps);

    // Emit the full structured slice diagnostic report BEFORE any assertion/panic.
    for (idx, &(calculator, category)) in slice_keys.iter().enumerate() {
        let score = slices.get(&(calculator, category));
        if let Some(s) = score {
            let rate = if s.total == 0 {
                0.0
            } else {
                s.passes as f64 / s.total as f64
            };
            let raw_rate = if s.total == 0 {
                0.0
            } else {
                s.raw_passes as f64 / s.total as f64
            };
            let (low, high) = wilson_ci_95(s.passes, s.total);
            let (nc_lo, nc_hi) = newcombe_paired_diff_ci_95(s.paired);
            let (wd_lo, wd_hi) = wald_paired_diff_ci_95(s.paired);
            let p_raw = slice_raw_ps[idx];
            let p_holm = slice_holm_ps[idx];
            println!(
                "SAFETY_EVAL calculator={calculator:?} category={category:?} k/n={}/{} pass_rate={rate:.6} wilson_ci_95=[{low:.6},{high:.6}] raw_k/n={}/{} raw_rate={raw_rate:.6} paired_diff={:.6} newcombe_ci_95=[{nc_lo:.6},{nc_hi:.6}] wald_ci_95=[{wd_lo:.6},{wd_hi:.6}] mcnemar_p_raw={p_raw:.6e} mcnemar_p_holm={p_holm:.6e} n11={} n10={} n01={} n00={}",
                s.passes,
                s.total,
                s.raw_passes,
                s.total,
                s.paired.diff(),
                s.paired.n11,
                s.paired.n10,
                s.paired.n01,
                s.paired.n00,
            );
        } else {
            println!(
                "SAFETY_EVAL calculator={calculator:?} category={category:?} k/n=0/0 EMPTY_SLICE"
            );
        }
    }

    let mut overall = Score::default();
    let cat_ps: Vec<f64> = CATEGORIES
        .iter()
        .map(|cat| {
            categories
                .get(cat)
                .map(|s| mcnemar_exact_p(s.paired))
                .unwrap_or(1.0)
        })
        .collect();
    let cat_holm = holm_bonferroni_adjust(&cat_ps);
    for (idx, category) in CATEGORIES.iter().enumerate() {
        if let Some(s) = categories.get(category) {
            overall.passes += s.passes;
            overall.total += s.total;
            overall.raw_passes += s.raw_passes;
            overall.paired.add_assign(s.paired);
            let rate = s.passes as f64 / s.total.max(1) as f64;
            let (low, high) = wilson_ci_95(s.passes, s.total);
            let (nc_lo, nc_hi) = newcombe_paired_diff_ci_95(s.paired);
            let (wd_lo, wd_hi) = wald_paired_diff_ci_95(s.paired);
            println!(
                "SAFETY_EVAL calculator=overall category={category:?} k/n={}/{} pass_rate={rate:.6} wilson_ci_95=[{low:.6},{high:.6}] raw_k/n={}/{} paired_diff={:.6} newcombe_ci_95=[{nc_lo:.6},{nc_hi:.6}] wald_ci_95=[{wd_lo:.6},{wd_hi:.6}] mcnemar_p_raw={:.6e} mcnemar_p_holm={:.6e}",
                s.passes,
                s.total,
                s.raw_passes,
                s.total,
                s.paired.diff(),
                cat_ps[idx],
                cat_holm[idx],
            );
        }
    }

    let overall_rate = overall.passes as f64 / overall.total.max(1) as f64;
    let (ov_lo, ov_hi) = wilson_ci_95(overall.passes, overall.total);
    let (ov_nc_lo, ov_nc_hi) = newcombe_paired_diff_ci_95(overall.paired);
    let (ov_wd_lo, ov_wd_hi) = wald_paired_diff_ci_95(overall.paired);
    let ov_p = mcnemar_exact_p(overall.paired);
    println!(
        "SAFETY_EVAL calculator=overall category=all k/n={}/{} pass_rate={overall_rate:.6} wilson_ci_95=[{ov_lo:.6},{ov_hi:.6}] raw_k/n={}/{} paired_diff={:.6} newcombe_ci_95=[{ov_nc_lo:.6},{ov_nc_hi:.6}] wald_ci_95=[{ov_wd_lo:.6},{ov_wd_hi:.6}] mcnemar_p_raw={ov_p:.6e}",
        overall.passes,
        overall.total,
        overall.raw_passes,
        overall.total,
        overall.paired.diff(),
    );

    // Fail-loud gates run strictly AFTER emitting the complete diagnostic report.
    assert!(
        broken_rate <= spec.max_broken_rate && excluded_broken == 0,
        "broken item rate exceeded threshold: excluded={excluded_broken}/{attempted} ({broken_rate:.4})"
    );
    assert!(valid_n > 0, "empty valid evaluation set after exclusions");
    assert!(
        warnings.is_empty(),
        "degenerate output warnings emitted: {warnings:?}"
    );
    assert!(
        failed_cases.is_empty(),
        "atomic rubric failures (first {} shown): {failed_cases:?}",
        failed_cases.len()
    );
    assert_eq!(
        overall.paired.n01, 0,
        "regression detected vs raw math baseline"
    );
    assert!(
        overall.paired.n10 > 0,
        "expected guarded engine to strictly improve over unguarded raw math"
    );
    assert_eq!(criteria.appropriate_outcome, valid_n);
    assert_eq!(criteria.no_nan_or_neg_zero_leak, valid_n);
    assert_eq!(criteria.no_html_script_injection, valid_n);
    assert_eq!(criteria.substance_over_framing, valid_n);
    assert_eq!(criteria.deterministic_replay, valid_n);

    for (calculator, category) in slice_keys {
        let s = slices
            .get(&(calculator, category))
            .unwrap_or_else(|| panic!("empty slice: {calculator:?}/{category:?}"));
        assert!(
            s.total > 0,
            "n == 0 after exclusions for {calculator:?}/{category:?}"
        );
        let threshold = match category {
            Category::AdversarialGuard => spec.adversarial_pass_threshold,
            Category::FormattingBoundary => spec.formatting_boundary_pass_threshold,
            Category::Benign => spec.benign_pass_threshold,
        };
        let rate = s.passes as f64 / s.total as f64;
        assert!(
            rate >= threshold,
            "slice failed: {calculator:?}/{category:?} ({}/{})",
            s.passes,
            s.total
        );
    }
}

#[test]
fn compound_guard_precedence_invariants() {
    for bill in [-1.0, f64::NEG_INFINITY, 0.0, -0.0, f64::NAN, f64::INFINITY] {
        for tip in [-1.0, f64::NEG_INFINITY, 0.0, f64::NAN, f64::INFINITY] {
            for people in [
                0.0,
                -0.0,
                -1.0,
                1.5,
                f64::NAN,
                f64::INFINITY,
                f64::NEG_INFINITY,
            ] {
                let error = if bill < 0.0 {
                    "Bill amount cannot be negative"
                } else if tip < 0.0 {
                    "Tip % cannot be negative"
                } else {
                    "People must be a whole number (1 or more)"
                };
                let case = Case {
                    calculator: Calculator::TipSplit,
                    category: Category::AdversarialGuard,
                    a: bill,
                    b: tip,
                    people,
                };
                let first = invoke(case);
                assert_eq!(first.error, Some(error), "{case:?}");
                assert_eq!(first, invoke(case));
                assert!(grade(case, &first, &invoke(case)).all_pass(), "{case:?}");
            }
        }
    }
    // Compound adversarial inputs where BOTH operands trigger guards/extremes;
    // verified separately rather than fabricating multi-variable paired controls.
    for zero in [0.0, -0.0] {
        for companion in [
            f64::NAN,
            f64::INFINITY,
            f64::NEG_INFINITY,
            0.0,
            -0.0,
            1e308,
            -1e308,
        ] {
            for (calculator, a, b, want_err) in [
                (
                    Calculator::Change,
                    zero,
                    companion,
                    "Original value cannot be zero",
                ),
                (Calculator::Percent, companion, zero, "Total cannot be zero"),
                (
                    Calculator::Original,
                    companion,
                    zero,
                    "Percent cannot be zero",
                ),
                (Calculator::Markup, zero, companion, "Cost cannot be zero"),
                (
                    Calculator::Markup,
                    companion,
                    zero,
                    if companion == 0.0 {
                        "Cost cannot be zero"
                    } else {
                        "Selling price cannot be zero"
                    },
                ),
                (
                    Calculator::TaxExtract,
                    companion,
                    -100.0,
                    "Tax rate cannot be -100%",
                ),
            ] {
                let case = Case {
                    people: 2.0,
                    calculator,
                    category: Category::AdversarialGuard,
                    a,
                    b,
                };
                let first = invoke(case);
                let second = invoke(case);
                assert!(!first.ok, "expected Err for {case:?}");
                assert_eq!(
                    first.error,
                    Some(want_err),
                    "precedence mismatch for {case:?}"
                );
                assert_eq!(first, second, "compound guard replay mismatch for {case:?}");
                assert!(
                    first
                        .all_text()
                        .iter()
                        .all(|s| !s.to_ascii_lowercase().contains("nan") && !s.contains("-0.00")),
                    "leak in compound guard {case:?}"
                );
            }
        }
    }
}

struct SplitMix64(u64);

impl SplitMix64 {
    fn next_u64(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }

    fn next_nonround_decimal(&mut self, min_abs: f64, max_abs: f64) -> f64 {
        loop {
            let unit = ((self.next_u64() >> 11) as f64) / ((1_u64 << 53) as f64);
            let mag = min_abs + unit * (max_abs - min_abs);
            // Keep fractional cents away from exact .xx5 / 0.49999999999999994 boundaries.
            let candidate = (mag * 10_000.0).round() / 10_000.0 + 0.000_37;
            let sign = if self.next_u64() & 1 == 0 { 1.0 } else { -1.0 };
            let val = sign * candidate;
            let scaled_fract = (val * 100.0).fract().abs();
            if val.is_finite() && val.abs() >= min_abs && (scaled_fract - 0.5).abs() > 0.01 {
                return val;
            }
        }
    }
}

#[derive(Deserialize)]
struct GoldenFixtureCase {
    f: String,
    a: Vec<String>,
}

fn parse_golden_num(s: &str) -> u64 {
    let val = match s {
        "NaN" => f64::NAN,
        "Infinity" => f64::INFINITY,
        "-Infinity" => f64::NEG_INFINITY,
        other => other.parse::<f64>().expect("valid golden float"),
    };
    normalize_bits(val)
}

fn normalize_bits(x: f64) -> u64 {
    if x.is_nan() {
        f64::NAN.to_bits()
    } else if x == 0.0 {
        0.0_f64.to_bits()
    } else {
        x.to_bits()
    }
}

#[test]
fn seeded_prng_metamorphic_invariants_disjoint_from_golden() {
    let golden_raw = include_str!("fixtures/golden.json");
    let golden_cases: Vec<GoldenFixtureCase> =
        serde_json::from_str(golden_raw).expect("valid golden.json");
    let mut golden_singles = HashSet::new();
    let mut golden_pairs = HashSet::new();
    for g in golden_cases {
        if g.f == "formatDecimal" {
            golden_singles.insert(parse_golden_num(&g.a[0]));
        } else if g.a.len() >= 2 {
            let ka = parse_golden_num(&g.a[0]);
            let kb = parse_golden_num(&g.a[1]);
            golden_pairs.insert((ka, kb));
            golden_singles.insert(ka);
            golden_singles.insert(kb);
        }
    }

    let mut rng = SplitMix64(PRNG_SEED);
    let per_calc = 32usize;
    let total_cases = CALCULATORS.len() * per_calc;
    assert!(
        total_cases >= SPEC.metamorphic_sample_floor,
        "metamorphic case count {total_cases} < {}",
        SPEC.metamorphic_sample_floor
    );

    let mut seen_generated = HashSet::new();
    let mut golden_overlaps = 0usize;
    let mut passes = 0usize;
    let mut failures = Vec::new();
    let mut per_calc_scores: BTreeMap<Calculator, Score> = BTreeMap::new();

    for calculator in CALCULATORS {
        let mut generated = 0usize;
        while generated < per_calc {
            let a = rng.next_nonround_decimal(1.25, 9_500.0);
            let a = if calculator == Calculator::TipSplit {
                a.abs()
            } else {
                a
            };
            let people = if calculator == Calculator::TipSplit {
                (rng.next_u64() % 31 + 1) as f64
            } else {
                2.0
            };
            let b = match calculator {
                Calculator::TipSplit => rng.next_nonround_decimal(1.1, 45.0).abs(),
                Calculator::TaxAdd | Calculator::TaxExtract => {
                    // Keep tax rate away from -100% and extreme division amplification.
                    let r = rng.next_nonround_decimal(1.1, 45.0).abs();
                    if rng.next_u64() & 1 == 0 {
                        r
                    } else {
                        -r
                    }
                }
                Calculator::Markup | Calculator::Change => {
                    let candidate = rng.next_nonround_decimal(1.25, 9_500.0);
                    if (candidate - a).abs() < 0.5 {
                        candidate + 3.25
                    } else {
                        candidate
                    }
                }
                _ => rng.next_nonround_decimal(1.25, 9_500.0),
            };

            let ka = normalize_bits(a);
            let kb = normalize_bits(b);
            if golden_pairs.contains(&(ka, kb))
                || golden_singles.contains(&ka)
                || golden_singles.contains(&kb)
            {
                golden_overlaps += 1;
                continue;
            }
            if !seen_generated.insert((calculator, ka, kb, normalize_bits(people))) {
                continue;
            }
            generated += 1;

            let case = Case {
                people,
                calculator,
                category: Category::Benign,
                a,
                b,
            };
            let first = invoke(case);
            let second = invoke(case);
            let g = grade(case, &first, &second);

            // Check scale homogeneity & round-trip metamorphic invariants with k = 3.5.
            let k = 3.5_f64;
            let metamorphic_ok = g.all_pass() && first.ok && {
                let nums: Vec<f64> = first
                    .numbers
                    .iter()
                    .map(|&bits| f64::from_bits(bits))
                    .collect();
                match calculator {
                    Calculator::TipSplit => {
                        let scaled = invoke(Case { a: a * k, ..case });
                        let double_people = invoke(Case {
                            people: people * 2.0,
                            ..case
                        });
                        let scaled_values: Vec<f64> = scaled
                            .numbers
                            .iter()
                            .map(|&bits| f64::from_bits(bits))
                            .collect();
                        scaled.ok
                            && double_people.ok
                            && nums
                                .iter()
                                .zip(&scaled_values)
                                .all(|(n, s)| (s - n * k).abs() <= 1e-8 * (s.abs() + 1.0))
                            && ((a + nums[0]) - nums[1]).abs() <= 1e-8 * (nums[1].abs() + 1.0)
                            && (nums[2] * people - nums[1]).abs() <= 1e-8 * (nums[1].abs() + 1.0)
                            && same_number(double_people.numbers[0], nums[0])
                            && same_number(double_people.numbers[1], nums[1])
                            && (f64::from_bits(double_people.numbers[2]) * 2.0 - nums[2]).abs()
                                <= 1e-8 * (nums[2].abs() + 1.0)
                    }
                    Calculator::Change => {
                        let scaled = invoke(Case {
                            a: a * k,
                            b: b * k,
                            ..case
                        });
                        let s_val = f64::from_bits(scaled.numbers[0]);
                        let reconstructed = a * (1.0 + nums[0] / 100.0);
                        scaled.ok
                            && (s_val - nums[0]).abs() <= 1e-9 * (nums[0].abs() + 1.0)
                            && (reconstructed - b).abs() <= 1e-8 * (b.abs() + 1.0)
                    }
                    Calculator::Percent => {
                        let scaled = invoke(Case {
                            a: a * k,
                            b: b * k,
                            ..case
                        });
                        let s_val = f64::from_bits(scaled.numbers[0]);
                        let roundtrip = calculate_percentage_portion(nums[0], b);
                        match roundtrip {
                            CalcResult::Ok { value, .. } => {
                                scaled.ok
                                    && (s_val - nums[0]).abs() <= 1e-9 * (nums[0].abs() + 1.0)
                                    && (value - a).abs() <= 1e-8 * (a.abs() + 1.0)
                            }
                            _ => false,
                        }
                    }
                    Calculator::Portion => {
                        let scaled = invoke(Case { b: b * k, ..case });
                        let s_val = f64::from_bits(scaled.numbers[0]);
                        scaled.ok && (s_val - nums[0] * k).abs() <= 1e-8 * (s_val.abs() + 1.0)
                    }
                    Calculator::Discount => {
                        let scaled = invoke(Case { a: a * k, ..case });
                        let sf = f64::from_bits(scaled.numbers[0]);
                        let ss = f64::from_bits(scaled.numbers[1]);
                        scaled.ok
                            && ((nums[0] + nums[1]) - a).abs() <= 1e-8 * (a.abs() + 1.0)
                            && (sf - nums[0] * k).abs() <= 1e-8 * (sf.abs() + 1.0)
                            && (ss - nums[1] * k).abs() <= 1e-8 * (ss.abs() + 1.0)
                    }
                    Calculator::Original => {
                        let scaled = invoke(Case { a: a * k, ..case });
                        let s_val = f64::from_bits(scaled.numbers[0]);
                        let roundtrip = calculate_percentage_portion(b, nums[0]);
                        match roundtrip {
                            CalcResult::Ok { value, .. } => {
                                scaled.ok
                                    && (s_val - nums[0] * k).abs() <= 1e-8 * (s_val.abs() + 1.0)
                                    && (value - a).abs() <= 1e-8 * (a.abs() + 1.0)
                            }
                            _ => false,
                        }
                    }
                    Calculator::Markup => {
                        let scaled = invoke(Case {
                            a: a * k,
                            b: b * k,
                            ..case
                        });
                        let sp = f64::from_bits(scaled.numbers[0]);
                        let sk = f64::from_bits(scaled.numbers[1]);
                        let sm = f64::from_bits(scaled.numbers[2]);
                        scaled.ok
                            && ((a + nums[0]) - b).abs() <= 1e-8 * (a.abs() + b.abs() + 1.0)
                            && (sp - nums[0] * k).abs() <= 1e-8 * (sp.abs() + 1.0)
                            && (sk - nums[1]).abs() <= 1e-8 * (nums[1].abs() + 1.0)
                            && (sm - nums[2]).abs() <= 1e-8 * (nums[2].abs() + 1.0)
                    }
                    Calculator::TaxAdd => {
                        let scaled = invoke(Case { a: a * k, ..case });
                        let s_tot = f64::from_bits(scaled.numbers[2]);
                        let ext = calculate_tax(nums[2], b, TaxMode::Extract);
                        match ext {
                            TaxResult::Ok { net, tax, .. } => {
                                scaled.ok
                                    && ((nums[0] + nums[1]) - nums[2]).abs()
                                        <= 1e-8 * (nums[2].abs() + 1.0)
                                    && (s_tot - nums[2] * k).abs() <= 1e-8 * (s_tot.abs() + 1.0)
                                    && (net - a).abs() <= 1e-8 * (a.abs() + 1.0)
                                    && (tax - nums[1]).abs() <= 1e-8 * (nums[1].abs() + 1.0)
                            }
                            _ => false,
                        }
                    }
                    Calculator::TaxExtract => {
                        let scaled = invoke(Case { a: a * k, ..case });
                        let s_net = f64::from_bits(scaled.numbers[0]);
                        let add = calculate_tax(nums[0], b, TaxMode::Add);
                        match add {
                            TaxResult::Ok { total, tax, .. } => {
                                scaled.ok
                                    && ((nums[0] + nums[1]) - nums[2]).abs()
                                        <= 1e-8 * (nums[2].abs() + 1.0)
                                    && (s_net - nums[0] * k).abs() <= 1e-8 * (s_net.abs() + 1.0)
                                    && (total - a).abs() <= 1e-8 * (a.abs() + 1.0)
                                    && (tax - nums[1]).abs() <= 1e-8 * (nums[1].abs() + 1.0)
                            }
                            _ => false,
                        }
                    }
                }
            };

            let sc = per_calc_scores.entry(calculator).or_default();
            sc.total += 1;
            if metamorphic_ok {
                passes += 1;
                sc.passes += 1;
            } else if failures.len() < 16 {
                failures.push(format!("{case:?} grade={g:?}"));
            }
        }
    }

    let (ci_lo, ci_hi) = wilson_ci_95(passes, total_cases);
    println!(
        "METAMORPHIC_PRNG_EVAL seed=0x{PRNG_SEED:016x} k/n={passes}/{total_cases} golden_overlaps={golden_overlaps} wilson_ci_95=[{ci_lo:.6},{ci_hi:.6}]"
    );
    for (calc, sc) in &per_calc_scores {
        let (lo, hi) = wilson_ci_95(sc.passes, sc.total);
        println!(
            "METAMORPHIC_SLICE calculator={calc:?} k/n={}/{} wilson_ci_95=[{lo:.6},{hi:.6}]",
            sc.passes, sc.total
        );
    }

    assert_eq!(
        golden_overlaps, 0,
        "PRNG generated inputs overlapped golden.json"
    );
    assert!(
        failures.is_empty(),
        "metamorphic invariant failures: {failures:?}"
    );
    assert_eq!(passes, total_cases);
}

#[test]
fn text_matches_number_strict_percent_and_precision_rules() {
    // Require '%' ONLY on percentage outputs and forbid '%' on plain/currency outputs.
    assert!(text_matches_number("25.00%", 25.0, true));
    assert!(!text_matches_number("25.00", 25.0, true));
    assert!(!text_matches_number("25.00%%", 25.0, true));
    assert!(text_matches_number("25.00", 25.0, false));
    assert!(!text_matches_number("25.00%", 25.0, false));

    // Reject loose float slop at 1e21 and require exact .toFixed(2) / exponential parity.
    assert!(text_matches_number("999999999999999868928.00", 1e21, false));
    assert!(!text_matches_number(
        "1000000000000000000000.00",
        1e21,
        false
    ));
    assert!(!text_matches_number(
        "999999999999999000000.00",
        1e21,
        false
    ));
    assert!(text_matches_number("1.23e+21", 1.23e21, false));
    assert!(!text_matches_number("1.230e+21", 1.23e21, false));
    assert!(!text_matches_number("1.24e+21", 1.23e21, false));
    assert!(text_matches_number("0.00", -0.001, false));
    assert!(!text_matches_number("-0.00", -0.001, false));
    assert!(text_matches_number("0.13", 0.125, false));
    assert!(!text_matches_number("0.12", 0.125, false));
}

#[test]
fn statistical_intervals_and_holm_bonferroni_match_exact_values() {
    assert_eq!(wilson_ci_95(0, 0), (0.0, 1.0));
    for total in [1, 2, 10, 100, 1000, 1050] {
        for passes in [0, total / 2, total] {
            let (low, high) = wilson_ci_95(passes, total);
            let rate = passes as f64 / total as f64;
            assert!(0.0 <= low && low <= high && high <= 1.0);
            assert!(low <= rate + 1e-15 && rate <= high + 1e-15);
        }
        assert!(wilson_ci_95(0, total).0.abs() < 1e-15);
        assert!((wilson_ci_95(total, total).1 - 1.0).abs() < 1e-15);
    }
    let (low, high) = wilson_ci_95(5, 10);
    assert!((low - 0.236_593_090_512_564).abs() < 1e-12);
    assert!((high - 0.763_406_909_487_436).abs() < 1e-12);
    assert!(wilson_ci_95(1000, 1000).0 > wilson_ci_95(10, 10).0);

    let paired = PairedContingency {
        n11: 90,
        n10: 10,
        n01: 0,
        n00: 0,
    };
    let (nc_lo, nc_hi) = newcombe_paired_diff_ci_95(paired);
    let (wd_lo, wd_hi) = wald_paired_diff_ci_95(paired);
    assert!(-1.0 <= nc_lo && nc_lo <= paired.diff() && paired.diff() <= nc_hi && nc_hi <= 1.0);
    assert!(-1.0 <= wd_lo && wd_lo <= paired.diff() && paired.diff() <= wd_hi && wd_hi <= 1.0);
    // Exact two-sided McNemar: 2 * (0.5)^10 = 2 / 1024.
    assert!((mcnemar_exact_p(paired) - (2.0 / 1024.0)).abs() < 1e-12);
    assert_eq!(
        mcnemar_exact_p(PairedContingency {
            n11: 50,
            n10: 0,
            n01: 0,
            n00: 10
        }),
        1.0
    );

    let adj = holm_bonferroni_adjust(&[0.012, 0.01, 0.03]);
    assert!((adj[1] - 0.03).abs() < 1e-12);
    assert!((adj[0] - 0.03).abs() < 1e-12);
    assert!((adj[2] - 0.03).abs() < 1e-12);
}

#[test]
fn exact_formatting_and_signed_arithmetic_anchors() {
    for (value, text) in [
        (0.0, "0.00"),
        (-0.0, "0.00"),
        (-0.001, "0.00"),
        (-0.004, "0.00"),
        (-0.005, "0.00"),
        (f64::MIN_POSITIVE, "0.00"),
        (-f64::MIN_POSITIVE, "0.00"),
        (f64::NAN, "?"),
        (f64::INFINITY, "Infinity"),
        (f64::NEG_INFINITY, "-Infinity"),
        (1e308, "Infinity"),
        (-1e308, "-Infinity"),
        (-0.025, "-0.02"),
        (0.025, "0.03"),
        (-2.5, "-2.50"),
        (2.5, "2.50"),
        (-0.125, "-0.12"),
        (0.125, "0.13"),
        // In IEEE-754 binary64, (1e21 * 100.0) / 100.0 rounds 1 ULP below 1e21,
        // matching JS `(Math.round(1e21 * 100) / 100).toFixed(2)` and golden.json.
        (1e21, "999999999999999868928.00"),
        (-1e21, "-999999999999999868928.00"),
        (1.23e21, "1.23e+21"),
        (1.5e21, "1.5e+21"),
        (-1.5e21, "-1.5e+21"),
        (1e22, "1e+22"),
        (-1e22, "-1e+22"),
        (1e20, "100000000000000000000.00"),
    ] {
        assert_eq!(format_decimal(value), text, "formatting anchor {value:?}");
    }
    assert_eq!(js_round(-2.5), -2.0);
    assert_eq!(js_round(2.5), 3.0);
    // Independently specified numbers pin the numeric grader as well as the
    // production arithmetic, including losses, >100% discounts, and signs.
    for (calculator, a, b, numbers) in [
        (Calculator::TipSplit, 100.0, 20.0, vec![20.0, 120.0, 60.0]),
        (Calculator::TipSplit, 0.025, 100.0, vec![0.025, 0.05, 0.025]),
        (Calculator::TipSplit, -0.0, -0.0, vec![0.0, 0.0, 0.0]),
        (Calculator::Change, 200.0, 150.0, vec![-25.0]),
        (Calculator::Change, -200.0, -150.0, vec![-25.0]),
        (Calculator::Change, -200.0, -250.0, vec![25.0]),
        (Calculator::Change, 12.5, 12.5, vec![0.0]),
        (Calculator::Percent, -50.0, 200.0, vec![-25.0]),
        (Calculator::Portion, -25.0, 200.0, vec![-50.0]),
        (Calculator::Original, -50.0, 25.0, vec![-200.0]),
        (Calculator::Discount, 80.0, 125.0, vec![-20.0, 100.0]),
        (Calculator::Markup, 100.0, 80.0, vec![-20.0, -20.0, -25.0]),
        (
            Calculator::TaxAdd,
            -100.0,
            25.0,
            vec![-100.0, -25.0, -125.0],
        ),
        (
            Calculator::TaxExtract,
            -125.0,
            25.0,
            vec![-100.0, -25.0, -125.0],
        ),
    ] {
        let case = Case {
            people: 2.0,
            calculator,
            category: Category::Benign,
            a,
            b,
        };
        assert_eq!(expected(case), Ok(numbers.clone()));
        let first = invoke(case);
        assert!(
            framing_and_values_match(case, &first, &numbers),
            "{case:?}: {first:?}"
        );
        assert!(grade(case, &first, &invoke(case)).all_pass());
    }
    for (a, b, people, label) in [
        (0.025, 100.0, 2.0, "Each: 0.03<br>Total: 0.05 · Tip: 0.03"),
        (-0.0, -0.0, 2.0, "Each: 0.00<br>Total: 0.00 · Tip: 0.00"),
        (10.0, 0.0, 3.0, "Each: 3.33<br>Total: 10.00 · Tip: 0.00"),
    ] {
        let case = Case {
            calculator: Calculator::TipSplit,
            category: Category::FormattingBoundary,
            a,
            b,
            people,
        };
        assert_eq!(invoke(case).label, label);
    }
}
