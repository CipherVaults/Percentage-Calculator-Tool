//! Persistent stdin/stdout NDJSON evaluation bridge for `percent-core`.
//!
//! Reads one JSON request object per line from stdin, executes either the
//! Tauri-IPC-equivalent validated surface (`"ipc"`) or the raw `percent-core`
//! surface (`"core"`), and writes one compact JSON response per line to stdout,
//! flushing after every line.

use std::io::{self, BufRead, BufWriter, Write};

use percent_core::{
    calculate_discount, calculate_markup_margin, calculate_original_value,
    calculate_percentage_change, calculate_percentage_of_total, calculate_percentage_portion,
    calculate_tax, calculate_tip_split, format_decimal, TaxMode,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize)]
struct BridgeRequest {
    #[serde(default)]
    id: Value,
    surface: String,
    op: String,
    #[serde(default)]
    a: Value,
    #[serde(default)]
    b: Value,
    #[serde(default)]
    c: Value,
    #[serde(default)]
    people: Value,
    #[serde(default)]
    args: Option<Vec<Value>>,
    #[serde(default)]
    mode: Value,
}

#[derive(Debug, Serialize)]
struct BridgeResponse {
    id: Value,
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

impl BridgeResponse {
    fn ok(id: Value, result: Value) -> Self {
        Self {
            id,
            ok: true,
            result: Some(result),
            error: None,
        }
    }

    fn err(id: Value, error: impl Into<String>) -> Self {
        Self {
            id,
            ok: false,
            result: None,
            error: Some(error.into()),
        }
    }
}

fn parse_bridge_f64(value: &Value, field: &str) -> Result<f64, String> {
    match value {
        Value::Number(n) => n
            .as_f64()
            .ok_or_else(|| format!("argument '{field}' is out of f64 range")),
        Value::String(s) => {
            let trimmed = s.trim();
            match trimmed {
                "NaN" | "nan" => Ok(f64::NAN),
                "Infinity" | "+Infinity" => Ok(f64::INFINITY),
                "-Infinity" => Ok(f64::NEG_INFINITY),
                _ if !trimmed.is_empty() => trimmed
                    .parse::<f64>()
                    .map_err(|_| format!("invalid numeric string for '{field}': {trimmed}")),
                _ => Err(format!("empty numeric string for '{field}'")),
            }
        }
        Value::Null => Err(format!("missing or null numeric argument '{field}'")),
        _ => Err(format!("invalid type for numeric argument '{field}'")),
    }
}

fn parse_ipc_f64(value: &Value, field: &str) -> Result<f64, String> {
    let parsed = parse_bridge_f64(value, field)
        .map_err(|_| "Input values must be finite numbers.".to_string())?;
    if !parsed.is_finite() {
        return Err("Input values must be finite numbers.".to_string());
    }
    Ok(parsed)
}

fn parse_tax_mode(value: &Value) -> Result<TaxMode, String> {
    serde_json::from_value::<TaxMode>(value.clone())
        .map_err(|_| "invalid tax mode: expected \"add\" or \"extract\"".to_string())
}

fn execute_op(req: &BridgeRequest) -> Result<Value, String> {
    let is_ipc = match req.surface.as_str() {
        "ipc" => true,
        "core" => false,
        other => {
            return Err(format!(
                "invalid surface '{other}': expected 'ipc' or 'core'"
            ))
        }
    };

    let parse_arg = if is_ipc {
        parse_ipc_f64
    } else {
        parse_bridge_f64
    };

    if matches!(req.op.as_str(), "tip_split" | "calc_tip_split") {
        let (a, b, c) = match req.args.as_deref() {
            Some([a, b, c]) => (a, b, c),
            _ => (
                &req.a,
                &req.b,
                if !req.c.is_null() {
                    &req.c
                } else {
                    &req.people
                },
            ),
        };
        return serde_json::to_value(calculate_tip_split(
            parse_arg(a, "a")?,
            parse_arg(b, "b")?,
            parse_arg(c, "people")?,
        ))
        .map_err(|err| format!("serialization error: {err}"));
    }

    let a = parse_arg(&req.a, "a")?;
    if req.op == "format_decimal" {
        return serde_json::to_value(format_decimal(a))
            .map_err(|err| format!("serialization error: {err}"));
    }

    let b = parse_arg(&req.b, "b")?;
    let serialized = match req.op.as_str() {
        "calc_change" => serde_json::to_value(calculate_percentage_change(a, b)),
        "calc_percent_of_total" => serde_json::to_value(calculate_percentage_of_total(a, b)),
        "calc_portion" => serde_json::to_value(calculate_percentage_portion(a, b)),
        "calc_original" => serde_json::to_value(calculate_original_value(a, b)),
        "calc_discount" => serde_json::to_value(calculate_discount(a, b)),
        "calc_markup_margin" => serde_json::to_value(calculate_markup_margin(a, b)),
        "calc_tax" => {
            let mode = parse_tax_mode(&req.mode)?;
            serde_json::to_value(calculate_tax(a, b, mode))
        }
        other => return Err(format!("unknown op '{other}'")),
    };

    serialized.map_err(|err| format!("serialization error: {err}"))
}

fn process_line(line: &str) -> BridgeResponse {
    let req: BridgeRequest = match serde_json::from_str(line) {
        Ok(parsed) => parsed,
        Err(err) => {
            return BridgeResponse::err(Value::Null, format!("invalid JSON request: {err}"))
        }
    };
    let id = req.id.clone();
    match execute_op(&req) {
        Ok(result) => BridgeResponse::ok(id, result),
        Err(err) => BridgeResponse::err(id, err),
    }
}

const MAX_BRIDGE_LINE_BYTES: usize = 65_536;

fn read_bounded_line<R: BufRead>(
    reader: &mut R,
    max_bytes: usize,
    out: &mut Vec<u8>,
) -> io::Result<Option<bool>> {
    out.clear();
    loop {
        let buf = reader.fill_buf()?;
        if buf.is_empty() {
            return Ok(if out.is_empty() { None } else { Some(true) });
        }
        if let Some(pos) = buf.iter().position(|&b| b == b'\n') {
            let chunk = &buf[..=pos];
            if out.len().saturating_add(chunk.len()) > max_bytes {
                reader.consume(pos + 1);
                out.clear();
                return Ok(Some(false));
            }
            out.extend_from_slice(chunk);
            reader.consume(pos + 1);
            return Ok(Some(true));
        }
        let len = buf.len();
        if out.len().saturating_add(len) > max_bytes {
            reader.consume(len);
            loop {
                let rest = reader.fill_buf()?;
                if rest.is_empty() {
                    break;
                }
                if let Some(pos) = rest.iter().position(|&b| b == b'\n') {
                    reader.consume(pos + 1);
                    break;
                }
                let rlen = rest.len();
                reader.consume(rlen);
            }
            out.clear();
            return Ok(Some(false));
        }
        out.extend_from_slice(buf);
        reader.consume(len);
    }
}

fn main() -> io::Result<()> {
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut reader = io::BufReader::new(stdin.lock());
    let mut writer = BufWriter::new(stdout.lock());
    let mut raw_line = Vec::new();

    while let Some(fits) = read_bounded_line(&mut reader, MAX_BRIDGE_LINE_BYTES, &mut raw_line)? {
        let resp = if !fits {
            BridgeResponse::err(Value::Null, "request line exceeds max allowed size")
        } else {
            let line = match std::str::from_utf8(&raw_line) {
                Ok(s) => s,
                Err(err) => {
                    let resp = BridgeResponse::err(Value::Null, format!("invalid UTF-8: {err}"));
                    serde_json::to_writer(&mut writer, &resp).map_err(io::Error::other)?;
                    writer.write_all(b"\n")?;
                    writer.flush()?;
                    continue;
                }
            };
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            process_line(trimmed)
        };
        serde_json::to_writer(&mut writer, &resp).map_err(io::Error::other)?;
        writer.write_all(b"\n")?;
        writer.flush()?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tip_split_bridge_argument_forms_and_surfaces() {
        for surface in ["core", "ipc"] {
            for op in ["tip_split", "calc_tip_split"] {
                for fields in [
                    r#""args":[100,20,3],"a":-1,"b":-1,"c":0"#,
                    r#""a":100,"b":20,"c":3,"people":0"#,
                    r#""a":100,"b":20,"c":null,"people":3"#,
                    r#""a":100,"b":20,"people":3,"args":[1,2]"#,
                ] {
                    let response = process_line(&format!(
                        r#"{{"id":"tip","surface":"{surface}","op":"{op}",{fields}}}"#
                    ));
                    assert!(response.ok, "{response:?}");
                    assert_eq!(response.id, "tip");
                    let result = response.result.unwrap();
                    assert_eq!(result["ok"], "true");
                    assert_eq!(result["tipAmount"], 20.0);
                    assert_eq!(result["totalBill"], 120.0);
                    assert_eq!(result["perPerson"], 40.0);
                    assert_eq!(
                        result["copyText"],
                        "Each: 40.00\nTotal: 120.00 · Tip: 20.00"
                    );
                }
                let missing = process_line(&format!(
                    r#"{{"surface":"{surface}","op":"{op}","a":100,"b":20}}"#
                ));
                assert!(!missing.ok);
                for people in ["0", "-1", "1.5"] {
                    let response = process_line(&format!(
                        r#"{{"surface":"{surface}","op":"{op}","args":[100,20,{people}]}}"#
                    ));
                    assert!(response.ok);
                    assert_eq!(
                        response.result.unwrap()["error"],
                        "People must be a whole number (1 or more)"
                    );
                }
            }
        }
    }

    #[test]
    fn tip_split_bridge_non_finite_core_and_ipc_boundaries() {
        for invalid in ["NaN", "Infinity", "-Infinity"] {
            for position in 0..3 {
                let mut args = serde_json::json!([100, 20, 2]);
                args[position] = Value::String(invalid.into());
                for surface in ["core", "ipc"] {
                    let response = process_line(
                        &serde_json::json!({
                            "surface": surface, "op": "tip_split", "args": args,
                        })
                        .to_string(),
                    );
                    if surface == "ipc" {
                        assert!(!response.ok);
                        assert!(response.error.unwrap().contains("finite"));
                    } else {
                        assert!(response.ok);
                        let result = response.result.unwrap();
                        assert_eq!(
                            result["ok"],
                            if position == 2 || invalid == "-Infinity" {
                                "false"
                            } else {
                                "true"
                            }
                        );
                    }
                }
            }
        }
        let response = process_line(r#"{"surface":"core","op":"tip_split","args":["-0","-0",1]}"#);
        assert_eq!(response.result.unwrap()["perPersonText"], "0.00");
    }

    #[test]
    fn bridge_preserves_negative_zero_and_non_finite_core() {
        let r_neg_zero =
            process_line(r#"{"id":1,"surface":"core","op":"calc_portion","a":"-0","b":100}"#);
        assert!(r_neg_zero.ok);
        let res = r_neg_zero.result.unwrap();
        assert_eq!(res["label"], "0.00");
        assert_eq!(
            res["value"].as_f64().unwrap().to_bits(),
            (-0.0_f64).to_bits()
        );

        let r_nan = process_line(r#"{"id":"n1","surface":"core","op":"format_decimal","a":"NaN"}"#);
        assert!(r_nan.ok);
        assert_eq!(r_nan.result.unwrap(), "?");

        let r_ipc_nan =
            process_line(r#"{"id":"n2","surface":"ipc","op":"calc_change","a":"NaN","b":100}"#);
        assert!(!r_ipc_nan.ok);
        assert!(r_ipc_nan.error.unwrap().contains("finite"));

        let r_ipc_zero_div =
            process_line(r#"{"id":"z1","surface":"ipc","op":"calc_change","a":0,"b":100}"#);
        assert!(r_ipc_zero_div.ok);
        assert_eq!(r_ipc_zero_div.result.unwrap()["ok"], "false");

        let mut oversized = "a".repeat(80);
        oversized.push('\n');
        oversized.push_str("ok\n");
        let mut cursor = io::Cursor::new(oversized.into_bytes());
        let mut buf = Vec::new();
        assert_eq!(
            read_bounded_line(&mut cursor, 32, &mut buf).unwrap(),
            Some(false)
        );
        assert_eq!(
            read_bounded_line(&mut cursor, 32, &mut buf).unwrap(),
            Some(true)
        );
        assert_eq!(buf, b"ok\n");
        assert_eq!(read_bounded_line(&mut cursor, 32, &mut buf).unwrap(), None);
    }
}
