//! Deterministic application of Anthropic's safety-evaluation methodology:
//! https://www.anthropic.com/research/building-strong-safety-evaluations
//! Fix the construct, paired controls, atomic rubric, slices, and thresholds
//! before execution. These synthetic regression cases are not independent
//! random samples; Wilson intervals describe scores, not real-world coverage.

use percent_core::{
    calculate_discount, calculate_markup_margin, calculate_original_value,
    calculate_percentage_change, calculate_percentage_of_total, calculate_percentage_portion,
    calculate_tax, format_decimal, js_round, CalcResult, MarkupMarginResult, TaxMode, TaxResult,
};
use std::collections::BTreeMap;

#[derive(Debug)]
struct PreregisteredEvalSpec {
    construct: &'static str,
    sample_floor: usize,
    adversarial_pass_threshold: f64,
    benign_pass_threshold: f64,
    deviations: Option<&'static str>,
}

const SPEC: PreregisteredEvalSpec = PreregisteredEvalSpec {
    construct:
        "adversarial boundary & numeric safety vs benign non-over-refusal across all 7 calculators",
    sample_floor: 1000,
    adversarial_pass_threshold: 1.0,
    benign_pass_threshold: 1.0,
    deviations: None,
};

fn wilson_ci_95(passes: usize, total: usize) -> (f64, f64) {
    if total == 0 {
        return (0.0, 1.0);
    }
    assert!(passes <= total, "passes cannot exceed total");
    let z = 1.959963984540054_f64;
    let n = total as f64;
    let p = passes as f64 / n;
    let denominator = 1.0 + z * z / n;
    let center = (p + z * z / (2.0 * n)) / denominator;
    let half_width = z * (p * (1.0 - p) / n + z * z / (4.0 * n * n)).sqrt() / denominator;
    (
        (center - half_width).clamp(0.0, 1.0),
        (center + half_width).clamp(0.0, 1.0),
    )
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
enum Calculator {
    Change,
    Percent,
    Portion,
    Discount,
    Original,
    Markup,
    TaxAdd,
    TaxExtract,
}

const CALCULATORS: [Calculator; 8] = [
    Calculator::Change,
    Calculator::Percent,
    Calculator::Portion,
    Calculator::Discount,
    Calculator::Original,
    Calculator::Markup,
    Calculator::TaxAdd,
    Calculator::TaxExtract,
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
enum Category {
    Adversarial,
    Benign,
}

#[derive(Debug, Clone, Copy)]
struct Case {
    calculator: Calculator,
    category: Category,
    a: f64,
    b: f64,
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
        calculator, a, b, ..
    } = case;
    match calculator {
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

// A numeric contract, separate from rendering. IEEE operation order is part of
// the JS parity contract (not algebraically interchangeable near overflow).
fn expected(case: Case) -> Result<Vec<f64>, &'static str> {
    use Calculator::*;
    let Case {
        calculator, a, b, ..
    } = case;
    match calculator {
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

// This grader does not call the production formatter. Check non-finite tokens,
// arithmetic signs, and decimal precision independently; exact JS rounding
// anchors below prevent a permissive tolerance from hiding tie regressions.
fn text_matches_number(text: &str, value: f64) -> bool {
    let text = text.strip_suffix('%').unwrap_or(text);
    if value.is_nan() {
        return text == "?";
    }
    if !(value * 100.0).is_finite() {
        return text
            == if value.is_sign_negative() {
                "-Infinity"
            } else {
                "Infinity"
            };
    }
    let Ok(parsed) = text.parse::<f64>() else {
        return false;
    };
    parsed.is_finite()
        && (parsed == 0.0 || parsed.is_sign_negative() == value.is_sign_negative())
        && (parsed - value).abs() <= 0.0050000001 + value.abs() * 4.0 * f64::EPSILON
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
                .is_some_and(|s| text_matches_number(s, value.abs()));
            live_matches
                && if value.is_nan() || value == 0.0 {
                    r.label == "0.00% no change"
                } else {
                    r.live_result.as_deref() == Some(r.label.as_str())
                }
        }
        Percent | Portion | Original => {
            r.live_result.as_deref() == Some(r.label.as_str())
                && (case.calculator != Percent || r.label.ends_with('%'))
                && text_matches_number(&r.label, values[0])
        }
        Discount | Markup | TaxAdd | TaxExtract => {
            if r.fields.len() != values.len()
                || !r
                    .fields
                    .iter()
                    .zip(values)
                    .all(|(text, &value)| text_matches_number(text, value))
            {
                return false;
            }
            let f = &r.fields;
            match case.calculator {
                Discount => {
                    r.label == format!("Final: {}<br>Saved: {}", f[0], f[1])
                        && r.copy_text.as_deref()
                            == Some(format!("Final: {}\nSaved: {}", f[0], f[1]).as_str())
                }
                Markup => {
                    f[1].ends_with('%')
                        && f[2].ends_with('%')
                        && r.label
                            == format!("Profit: {}<br>Markup: {} · Margin: {}", f[0], f[1], f[2])
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
                && (case.category != Category::Benign
                    || first.numbers.iter().all(|&x| f64::from_bits(x).is_finite()))
                && framing_and_values_match(case, first, values)
        }
    };
    let all_text = first.all_text();
    let expected_br_limit = match case.calculator {
        Calculator::Discount | Calculator::Markup | Calculator::TaxAdd | Calculator::TaxExtract => {
            usize::from(first.ok)
        }
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
        substance_over_framing: match expectation {
            Err(error) => first.error == Some(error) && !first.ok,
            Ok(values) => framing_and_values_match(case, first, &values),
        },
        deterministic_replay: first == second,
    }
}

fn paired_cases() -> Vec<[Case; 2]> {
    use Category::{Adversarial, Benign};
    // The two controls replace only the boundary operand. Non-finite values
    // have finite substitution controls; zeros and ties have near-neighbors.
    let boundaries = [
        (0.0, [0.0001, -0.0001]),
        (-0.0, [-0.0001, 0.0001]),
        (f64::NAN, [12.345, -12.345]),
        (f64::INFINITY, [1e6, 1e7]),
        (f64::NEG_INFINITY, [-1e6, -1e7]),
        (-0.001, [-0.0009, -0.0011]),
        (-0.004, [-0.0039, -0.0041]),
        (-0.005, [-0.0049, -0.0051]),
        (f64::MIN_POSITIVE, [0.0001, 0.0002]),
        (-f64::MIN_POSITIVE, [-0.0001, -0.0002]),
        (1e308, [1e6, 1e7]),
        (-1e308, [-1e6, -1e7]),
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
        (-100.0, [-99.99, -100.01]),
    ];
    let mut pairs = Vec::new();
    for calculator in CALCULATORS {
        for (boundary, neighbors) in boundaries {
            for (control_index, companion) in [12.5, -12.5].into_iter().enumerate() {
                for position in 0..2 {
                    let (a, b, ca, cb) = if position == 0 {
                        (boundary, companion, neighbors[control_index], companion)
                    } else {
                        (companion, boundary, companion, neighbors[control_index])
                    };
                    pairs.push([
                        Case {
                            calculator,
                            category: Adversarial,
                            a,
                            b,
                        },
                        Case {
                            calculator,
                            category: Benign,
                            a: ca,
                            b: cb,
                        },
                    ]);
                }
            }
        }
    }
    // Guard precedence must survive benign-looking AND non-finite companion
    // operands. Paired controls make every denominator genuinely nonzero.
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
            for (calculator, a, b, ca, cb) in [
                (Calculator::Change, zero, companion, 0.0001, 12.5),
                (Calculator::Percent, companion, zero, 12.5, -0.0001),
                (Calculator::Original, companion, zero, 12.5, 0.0001),
                (Calculator::Markup, zero, companion, -0.0001, 12.5),
                (Calculator::Markup, companion, zero, 12.5, -0.0001),
                (Calculator::TaxExtract, companion, -100.0, 12.5, -99.99),
            ] {
                pairs.push([
                    Case {
                        calculator,
                        category: Adversarial,
                        a,
                        b,
                    },
                    Case {
                        calculator,
                        category: Benign,
                        a: ca,
                        b: cb,
                    },
                ]);
            }
        }
    }
    // Domain-specific paired controls for negative profit, >100% discount,
    // negative changes, -99.99 tax extract near-neighbor, and standard decimals.
    for (calculator, a, b, ca, cb) in [
        (Calculator::Change, 0.0, 150.0, 200.0, 150.0),
        (Calculator::Change, -0.0, 180.0, 150.0, 180.0),
        (Calculator::Percent, 50.0, 0.0, 50.0, 200.0),
        (Calculator::Portion, f64::NAN, 500.0, 20.0, 500.0),
        (Calculator::Discount, 80.0, f64::INFINITY, 80.0, 125.0),
        (Calculator::Discount, 79.99, f64::NAN, 79.99, 20.0),
        (Calculator::Original, 50.0, 0.0, 50.0, 25.0),
        (Calculator::Markup, 0.0, 80.0, 100.0, 80.0),
        (Calculator::Markup, 100.0, 0.0, 80.0, 100.0),
        (Calculator::TaxAdd, 100.0, f64::INFINITY, 100.0, 15.0),
        (Calculator::TaxExtract, 100.0, -100.0, 100.0, -99.99),
        (Calculator::TaxExtract, 115.0, -100.0, 115.0, 15.0),
    ] {
        pairs.push([
            Case {
                calculator,
                category: Adversarial,
                a,
                b,
            },
            Case {
                calculator,
                category: Benign,
                a: ca,
                b: cb,
            },
        ]);
    }
    pairs
}

#[derive(Default)]
struct Score {
    passes: usize,
    total: usize,
}

#[derive(Default)]
struct CriterionTotals {
    appropriate_outcome: usize,
    no_nan_or_neg_zero_leak: usize,
    no_html_script_injection: usize,
    substance_over_framing: usize,
    deterministic_replay: usize,
}

fn report(calculator: &str, category: &str, score: &Score, threshold: f64) {
    assert!(
        score.total > 0,
        "empty preregistered slice: {calculator}/{category}"
    );
    let rate = score.passes as f64 / score.total as f64;
    let (low, high) = wilson_ci_95(score.passes, score.total);
    println!("SAFETY_EVAL calculator={calculator} category={category} k/n={}/{} pass_rate={rate:.6} wilson_ci_95=[{low:.6},{high:.6}]", score.passes, score.total);
    assert!(rate >= threshold, "slice failed: {calculator}/{category}");
}

#[test]
fn paired_safety_evaluation_with_atomic_rubric() {
    let spec = &SPEC;
    assert_eq!(
        spec.construct,
        "adversarial boundary & numeric safety vs benign non-over-refusal across all 7 calculators"
    );
    assert_eq!(spec.sample_floor, 1000);
    assert_eq!(spec.adversarial_pass_threshold, 1.0);
    assert_eq!(spec.benign_pass_threshold, 1.0);
    assert_eq!(spec.deviations, None);
    println!("PREREGISTERED_SPEC {spec:?}; target_evaluated_cases>=1050; all five atomic criteria required");
    let pairs = paired_cases();
    let total = pairs.len() * 2;
    assert!(
        total >= 1050 && total >= spec.sample_floor,
        "insufficient evaluated cases: {total}"
    );
    let mut slices: BTreeMap<(Calculator, Category), Score> = BTreeMap::new();
    let mut categories: BTreeMap<Category, Score> = BTreeMap::new();
    let mut criteria = CriterionTotals::default();
    for (pair_id, pair) in pairs.into_iter().enumerate() {
        assert_eq!(pair[0].calculator, pair[1].calculator);
        assert_eq!(pair[0].category, Category::Adversarial);
        assert_eq!(pair[1].category, Category::Benign);
        for case in pair {
            let first = invoke(case);
            let second = invoke(case);
            let grade = grade(case, &first, &second);
            assert!(
                grade.all_pass(),
                "pair={pair_id} case={case:?} grade={grade:?} observed={first:?}"
            );
            criteria.appropriate_outcome += usize::from(grade.appropriate_outcome);
            criteria.no_nan_or_neg_zero_leak += usize::from(grade.no_nan_or_neg_zero_leak);
            criteria.no_html_script_injection += usize::from(grade.no_html_script_injection);
            criteria.substance_over_framing += usize::from(grade.substance_over_framing);
            criteria.deterministic_replay += usize::from(grade.deterministic_replay);
            for score in [
                slices.entry((case.calculator, case.category)).or_default(),
                categories.entry(case.category).or_default(),
            ] {
                score.total += 1;
                score.passes += usize::from(grade.all_pass());
            }
        }
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
        assert_eq!(passes, total, "atomic criterion failed: {criterion}");
        let (low, high) = wilson_ci_95(passes, total);
        println!(
            "ATOMIC_CRITERION name={criterion} k/n={passes}/{total} pass_rate=1.000000 wilson_ci_95=[{low:.6},{high:.6}]"
        );
    }
    for calculator in CALCULATORS {
        for category in [Category::Adversarial, Category::Benign] {
            let threshold = if category == Category::Adversarial {
                spec.adversarial_pass_threshold
            } else {
                spec.benign_pass_threshold
            };
            report(
                &format!("{calculator:?}"),
                &format!("{category:?}"),
                &slices[&(calculator, category)],
                threshold,
            );
        }
    }
    for (category, score) in &categories {
        report("overall", &format!("{category:?}"), score, 1.0);
    }
    let overall = Score {
        passes: categories.values().map(|s| s.passes).sum(),
        total: categories.values().map(|s| s.total).sum(),
    };
    assert_eq!(overall.total, total);
    report("overall", "all", &overall, 1.0);
}

#[test]
fn wilson_interval_bounds_and_known_midpoint() {
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
    assert!((low - 0.236593090512564).abs() < 1e-12);
    assert!((high - 0.763406909487436).abs() < 1e-12);
    assert!(wilson_ci_95(1000, 1000).0 > wilson_ci_95(10, 10).0);
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
}
