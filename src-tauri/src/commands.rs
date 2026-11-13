//! Tauri commands exposed to the calculator UI.
//!
//! Replaces Electron's `ipcMain.handle(...)` + `preload.cjs` bridge with a
//! strongly typed Rust boundary.

use std::fs::{File, OpenOptions};
use std::io::{Read, Write};
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use percent_core::{
    calculate_discount, calculate_markup_margin, calculate_original_value,
    calculate_percentage_change, calculate_percentage_of_total, calculate_percentage_portion,
    calculate_tax, CalcResult, DiscountResult, MarkupMarginResult, TaxMode, TaxResult,
};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_clipboard_manager::ClipboardExt;

use crate::{HistoryState, SettingsState, SmokeState};

pub const HISTORY_MAX_ENTRIES: usize = 500;
const HISTORY_MAX_FILE_BYTES: usize = 1024 * 1024;
const SETTINGS_MAX_FILE_BYTES: usize = 4096;
const MAX_FIELD_LEN: usize = 256;
const MAX_COPY_LEN: usize = 4096;
const ALLOWED_CALCULATORS: &[&str] = &[
    "change", "percent", "what", "discount", "base", "markup", "tax",
];
pub const GITHUB_LATEST_RELEASE_API: &str =
    "https://api.github.com/repos/CipherVaults/Percentage-Calculator-Tool/releases/latest";
pub const GITHUB_RELEASES_URL: &str =
    "https://github.com/CipherVaults/Percentage-Calculator-Tool/releases/latest";
const GITHUB_RELEASES_PREFIX: &str =
    "https://github.com/CipherVaults/Percentage-Calculator-Tool/releases/";
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

static TEMP_FILE_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default = "default_true")]
    pub check_updates_on_startup: bool,
}

fn default_true() -> bool {
    true
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            check_updates_on_startup: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    pub ok: bool,
    pub update_available: bool,
    pub current_version: String,
    pub latest_version: Option<String>,
    pub release_url: String,
    pub published_at: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: &'static str,
    pub version: String,
    pub creators: &'static [&'static str],
    pub ai_builders: &'static [&'static str],
    pub credits: &'static str,
    pub privacy: &'static str,
    pub history_limit: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: u64,
    pub timestamp_ms: u64,
    pub calculator: String,
    pub calculator_label: String,
    pub input_a: String,
    pub input_b: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>,
    pub inputs_text: String,
    pub result_text: String,
    pub copy_text: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewHistoryEntry {
    pub calculator: String,
    pub calculator_label: String,
    pub input_a: String,
    pub input_b: String,
    #[serde(default)]
    pub mode: Option<String>,
    pub inputs_text: String,
    pub result_text: String,
    pub copy_text: String,
}

pub fn build_app_info(app: &AppHandle) -> AppInfo {
    AppInfo {
        name: "Percentage Calculator Tool",
        version: app.package_info().version.to_string(),
        creators: &["Mohamed Sayed", "Ahmed Emara"],
        ai_builders: &["DeepSeek", "ChatGPT", "Antigravity"],
        credits: "Mohamed Sayed · Ahmed Emara · DeepSeek · ChatGPT · Antigravity",
        privacy: "Fully offline. No tracking, no network calls. Calculation history is stored locally on this PC only and can be cleared anytime.",
        history_limit: HISTORY_MAX_ENTRIES,
    }
}

pub fn history_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("failed to resolve app data dir: {err}"))?;
    Ok(dir.join("history.json"))
}

pub fn settings_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("failed to resolve app data dir: {err}"))?;
    Ok(dir.join("settings.json"))
}

fn read_regular_file_limited(path: &Path, max_bytes: usize) -> Result<Vec<u8>, String> {
    let lstat = std::fs::symlink_metadata(path)
        .map_err(|err| format!("failed to stat history file: {err}"))?;
    if lstat.file_type().is_symlink() || !lstat.file_type().is_file() {
        return Err("refusing to read non-regular or symlinked history file".to_string());
    }
    if lstat.len() > max_bytes as u64 {
        return Err("history file exceeds max allowed size".to_string());
    }

    let file = File::open(path).map_err(|err| format!("failed to open history file: {err}"))?;
    let fstat = file
        .metadata()
        .map_err(|err| format!("failed to inspect opened history file: {err}"))?;
    if !fstat.is_file() || fstat.len() > max_bytes as u64 {
        return Err("history file invalid or exceeds max allowed size".to_string());
    }

    let mut bytes = Vec::with_capacity((fstat.len() as usize).min(max_bytes));
    file.take((max_bytes + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|err| format!("failed to read history file: {err}"))?;
    if bytes.len() > max_bytes {
        return Err("history file exceeded max allowed size while reading".to_string());
    }
    Ok(bytes)
}

fn ensure_private_parent_dir(parent: &Path) -> Result<(), String> {
    #[cfg(unix)]
    let created = !parent.exists();
    std::fs::create_dir_all(parent)
        .map_err(|err| format!("failed to create app data directory: {err}"))?;
    let meta = std::fs::symlink_metadata(parent)
        .map_err(|err| format!("failed to inspect app data directory: {err}"))?;
    if meta.file_type().is_symlink() || !meta.file_type().is_dir() {
        return Err("app data directory path is not a regular directory".to_string());
    }
    #[cfg(unix)]
    if created {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(parent, std::fs::Permissions::from_mode(0o700));
    }
    Ok(())
}

fn write_atomic_private(path: &Path, data: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "file path has no parent directory".to_string())?;
    ensure_private_parent_dir(parent)?;

    if let Ok(existing) = std::fs::symlink_metadata(path) {
        if existing.file_type().is_symlink() || !existing.file_type().is_file() {
            return Err("refusing to overwrite non-regular or symlinked file".to_string());
        }
    }

    let pid = std::process::id();
    let seq = TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed);
    let stem = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("data");
    let tmp_name = format!("{stem}.{pid}.{seq}.tmp");
    let tmp_path = parent.join(tmp_name);

    let mut opts = OpenOptions::new();
    opts.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        opts.mode(0o600);
    }

    let mut file = opts
        .open(&tmp_path)
        .map_err(|err| format!("failed to create temporary file: {err}"))?;

    let write_res = (|| -> Result<(), String> {
        file.write_all(data)
            .map_err(|err| format!("failed to write temporary file: {err}"))?;
        file.sync_all()
            .map_err(|err| format!("failed to flush temporary file: {err}"))?;
        Ok(())
    })();

    drop(file);
    if let Err(err) = write_res {
        let _ = std::fs::remove_file(&tmp_path);
        return Err(err);
    }

    if let Err(err) = std::fs::rename(&tmp_path, path) {
        let _ = std::fs::remove_file(&tmp_path);
        return Err(format!("failed to commit file: {err}"));
    }
    Ok(())
}

pub fn load_history_from_disk(app: &AppHandle) -> Vec<HistoryEntry> {
    let Ok(path) = history_file_path(app) else {
        return Vec::new();
    };
    let Ok(bytes) = read_regular_file_limited(&path, HISTORY_MAX_FILE_BYTES) else {
        return Vec::new();
    };
    let Ok(entries) = serde_json::from_slice::<Vec<HistoryEntry>>(&bytes) else {
        return Vec::new();
    };
    entries
        .into_iter()
        .filter(|entry| validate_history_entry(entry).is_ok())
        .take(HISTORY_MAX_ENTRIES)
        .collect()
}

fn persist_history_to_disk(app: &AppHandle, entries: &[HistoryEntry]) -> Result<(), String> {
    let path = history_file_path(app)?;
    let data = serde_json::to_vec_pretty(entries)
        .map_err(|err| format!("failed to serialize history: {err}"))?;
    write_atomic_private(&path, &data)
}

pub fn load_settings_from_disk(app: &AppHandle) -> AppSettings {
    let Ok(path) = settings_file_path(app) else {
        return AppSettings::default();
    };
    let Ok(bytes) = read_regular_file_limited(&path, SETTINGS_MAX_FILE_BYTES) else {
        return AppSettings::default();
    };
    serde_json::from_slice::<AppSettings>(&bytes).unwrap_or_default()
}

fn persist_settings_to_disk(app: &AppHandle, settings: &AppSettings) -> Result<(), String> {
    let path = settings_file_path(app)?;
    let data = serde_json::to_vec_pretty(settings)
        .map_err(|err| format!("failed to serialize settings: {err}"))?;
    write_atomic_private(&path, &data)
}

#[derive(Deserialize)]
struct GitHubReleaseResponse {
    tag_name: String,
    #[serde(default)]
    html_url: Option<String>,
    #[serde(default)]
    published_at: Option<String>,
}

pub fn parse_semver_triplet(version_or_tag: &str) -> Option<(u64, u64, u64)> {
    let trimmed = version_or_tag.trim().trim_start_matches(['v', 'V']);
    let core = trimmed.split(['-', '+']).next()?.trim();
    let mut parts = core.split('.');
    let major = parts.next()?.parse::<u64>().ok()?;
    let minor = parts.next()?.parse::<u64>().ok()?;
    let patch = parts.next()?.parse::<u64>().ok()?;
    if parts.next().is_some() {
        return None;
    }
    Some((major, minor, patch))
}

pub fn is_newer_version(current: &str, candidate_tag: &str) -> bool {
    match (
        parse_semver_triplet(current),
        parse_semver_triplet(candidate_tag),
    ) {
        (Some(cur), Some(cand)) => cand > cur,
        _ => false,
    }
}

pub fn parse_github_release_json(
    current_version: &str,
    bytes: &[u8],
) -> Result<UpdateCheckResult, String> {
    let parsed: GitHubReleaseResponse =
        serde_json::from_slice(bytes).map_err(|err| format!("invalid release JSON: {err}"))?;
    let (maj, min, patch) = parse_semver_triplet(&parsed.tag_name)
        .ok_or_else(|| "invalid release tag format".to_string())?;
    let latest_version = format!("{maj}.{min}.{patch}");
    let release_url = parsed
        .html_url
        .filter(|u| u.starts_with(GITHUB_RELEASES_PREFIX) && u.len() <= MAX_FIELD_LEN)
        .unwrap_or_else(|| GITHUB_RELEASES_URL.to_string());
    let published_at = parsed
        .published_at
        .filter(|s| !s.trim().is_empty() && s.len() <= 64);

    Ok(UpdateCheckResult {
        ok: true,
        update_available: is_newer_version(current_version, &parsed.tag_name),
        current_version: current_version.to_string(),
        latest_version: Some(latest_version),
        release_url,
        published_at,
        error: None,
    })
}

#[cfg(windows)]
fn windows_system32_tool(name: &str) -> PathBuf {
    let root = std::env::var_os("SystemRoot").unwrap_or_else(|| "C:\\Windows".into());
    PathBuf::from(root).join("System32").join(name)
}

#[allow(clippy::too_many_arguments)]
fn validate_entry_fields(
    calculator: &str,
    calculator_label: &str,
    input_a: &str,
    input_b: &str,
    mode: Option<&str>,
    inputs_text: &str,
    result_text: &str,
    copy_text: &str,
) -> Result<(), &'static str> {
    if !ALLOWED_CALCULATORS.contains(&calculator) {
        return Err("invalid calculator key");
    }
    let fields = [
        calculator_label,
        input_a,
        input_b,
        inputs_text,
        result_text,
        copy_text,
    ];
    if fields
        .iter()
        .any(|f| f.trim().is_empty() || f.len() > MAX_FIELD_LEN)
    {
        return Err("history field empty or exceeds max length");
    }
    if let Some(mode) = mode {
        if mode != "add" && mode != "extract" {
            return Err("invalid tax mode");
        }
    }
    Ok(())
}

fn validate_new_entry(entry: &NewHistoryEntry) -> Result<(), &'static str> {
    validate_entry_fields(
        &entry.calculator,
        &entry.calculator_label,
        &entry.input_a,
        &entry.input_b,
        entry.mode.as_deref(),
        &entry.inputs_text,
        &entry.result_text,
        &entry.copy_text,
    )
}

fn validate_history_entry(entry: &HistoryEntry) -> Result<(), &'static str> {
    validate_entry_fields(
        &entry.calculator,
        &entry.calculator_label,
        &entry.input_a,
        &entry.input_b,
        entry.mode.as_deref(),
        &entry.inputs_text,
        &entry.result_text,
        &entry.copy_text,
    )
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[tauri::command]
pub fn calc_change(original_value: f64, new_value: f64) -> CalcResult {
    calculate_percentage_change(original_value, new_value)
}

#[tauri::command]
pub fn calc_percent_of_total(part: f64, total: f64) -> CalcResult {
    calculate_percentage_of_total(part, total)
}

#[tauri::command]
pub fn calc_portion(percent: f64, number: f64) -> CalcResult {
    calculate_percentage_portion(percent, number)
}

#[tauri::command]
pub fn calc_discount(price: f64, discount_percent: f64) -> DiscountResult {
    calculate_discount(price, discount_percent)
}

#[tauri::command]
pub fn calc_original(value: f64, percent: f64) -> CalcResult {
    calculate_original_value(value, percent)
}

#[tauri::command]
pub fn calc_markup_margin(cost: f64, selling_price: f64) -> MarkupMarginResult {
    calculate_markup_margin(cost, selling_price)
}

#[tauri::command]
pub fn calc_tax(amount: f64, rate_percent: f64, mode: TaxMode) -> TaxResult {
    calculate_tax(amount, rate_percent, mode)
}

#[tauri::command]
pub fn history_list(state: State<'_, HistoryState>) -> Result<Vec<HistoryEntry>, String> {
    let entries = state
        .entries
        .lock()
        .map_err(|_| "history lock poisoned".to_string())?;
    Ok(entries.clone())
}

#[tauri::command]
pub fn history_add(
    app: AppHandle,
    state: State<'_, HistoryState>,
    entry: NewHistoryEntry,
) -> Result<Vec<HistoryEntry>, String> {
    validate_new_entry(&entry).map_err(|e| e.to_string())?;

    let mut entries = state
        .entries
        .lock()
        .map_err(|_| "history lock poisoned".to_string())?;

    let timestamp_ms = now_millis();

    // Deduplicate consecutive identical calculations.
    if let Some(first) = entries.first() {
        if first.calculator == entry.calculator
            && first.input_a == entry.input_a
            && first.input_b == entry.input_b
            && first.mode == entry.mode
            && first.result_text == entry.result_text
        {
            let mut next_entries = entries.clone();
            next_entries[0].timestamp_ms = timestamp_ms;
            if !state.in_memory_only {
                persist_history_to_disk(&app, &next_entries)?;
            }
            *entries = next_entries.clone();
            return Ok(next_entries);
        }
    }

    let mut next_id = state
        .next_id
        .lock()
        .map_err(|_| "history id lock poisoned".to_string())?;
    let id = *next_id;
    let bumped_id = next_id.saturating_add(1);

    let mut next_entries = entries.clone();
    next_entries.insert(
        0,
        HistoryEntry {
            id,
            timestamp_ms,
            calculator: entry.calculator,
            calculator_label: entry.calculator_label,
            input_a: entry.input_a,
            input_b: entry.input_b,
            mode: entry.mode,
            inputs_text: entry.inputs_text,
            result_text: entry.result_text,
            copy_text: entry.copy_text,
        },
    );
    next_entries.truncate(HISTORY_MAX_ENTRIES);

    if !state.in_memory_only {
        persist_history_to_disk(&app, &next_entries)?;
    }

    *next_id = bumped_id;
    *entries = next_entries.clone();

    Ok(next_entries)
}

#[tauri::command]
pub fn history_delete(
    app: AppHandle,
    state: State<'_, HistoryState>,
    id: u64,
) -> Result<Vec<HistoryEntry>, String> {
    let mut entries = state
        .entries
        .lock()
        .map_err(|_| "history lock poisoned".to_string())?;

    let mut next_entries = entries.clone();
    let prev_len = next_entries.len();
    next_entries.retain(|entry| entry.id != id);
    if next_entries.len() == prev_len {
        return Ok(entries.clone());
    }

    if !state.in_memory_only {
        persist_history_to_disk(&app, &next_entries)?;
    }
    *entries = next_entries.clone();

    Ok(next_entries)
}

#[tauri::command]
pub fn history_clear(
    app: AppHandle,
    state: State<'_, HistoryState>,
) -> Result<Vec<HistoryEntry>, String> {
    let mut entries = state
        .entries
        .lock()
        .map_err(|_| "history lock poisoned".to_string())?;

    if !state.in_memory_only {
        persist_history_to_disk(&app, &[])?;
    }
    entries.clear();

    Ok(Vec::new())
}

#[tauri::command]
pub fn get_settings(state: State<'_, SettingsState>) -> Result<AppSettings, String> {
    let settings = state
        .settings
        .lock()
        .map_err(|_| "settings lock poisoned".to_string())?;
    Ok(settings.clone())
}

#[tauri::command]
pub fn set_settings(
    app: AppHandle,
    state: State<'_, SettingsState>,
    settings: AppSettings,
) -> Result<AppSettings, String> {
    let mut guard = state
        .settings
        .lock()
        .map_err(|_| "settings lock poisoned".to_string())?;

    if !state.in_memory_only {
        persist_settings_to_disk(&app, &settings)?;
    }
    *guard = settings.clone();

    Ok(settings)
}

#[tauri::command]
pub async fn check_for_updates(
    app: AppHandle,
    smoke: State<'_, SmokeState>,
) -> Result<UpdateCheckResult, String> {
    let current_version = app.package_info().version.to_string();
    if smoke.enabled {
        return Ok(UpdateCheckResult {
            ok: true,
            update_available: false,
            current_version: current_version.clone(),
            latest_version: Some(current_version),
            release_url: GITHUB_RELEASES_URL.to_string(),
            published_at: None,
            error: None,
        });
    }

    let version_for_ua = current_version.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        let mut cmd = {
            let mut c = Command::new(windows_system32_tool("curl.exe"));
            c.creation_flags(CREATE_NO_WINDOW);
            c
        };
        #[cfg(not(windows))]
        let mut cmd = Command::new("curl");

        let user_agent = format!("User-Agent: Percentage-Calculator-Tool/{version_for_ua}");
        let output = cmd
            .args([
                "--silent",
                "--show-error",
                "--fail",
                "--location",
                "--max-time",
                "8",
                "--max-filesize",
                "65536",
                "--proto",
                "=https",
                "--tlsv1.2",
                "-H",
                "Accept: application/vnd.github+json",
                "-H",
                &user_agent,
                GITHUB_LATEST_RELEASE_API,
            ])
            .output();

        match output {
            Ok(out) if out.status.success() => {
                match parse_github_release_json(&version_for_ua, &out.stdout) {
                    Ok(res) => res,
                    Err(err) => UpdateCheckResult {
                        ok: false,
                        update_available: false,
                        current_version: version_for_ua.clone(),
                        latest_version: None,
                        release_url: GITHUB_RELEASES_URL.to_string(),
                        published_at: None,
                        error: Some(err),
                    },
                }
            }
            Ok(out) => {
                let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
                let msg = if stderr.is_empty() {
                    format!("Update check failed (status {})", out.status)
                } else {
                    stderr
                };
                UpdateCheckResult {
                    ok: false,
                    update_available: false,
                    current_version: version_for_ua.clone(),
                    latest_version: None,
                    release_url: GITHUB_RELEASES_URL.to_string(),
                    published_at: None,
                    error: Some(msg),
                }
            }
            Err(err) => UpdateCheckResult {
                ok: false,
                update_available: false,
                current_version: version_for_ua.clone(),
                latest_version: None,
                release_url: GITHUB_RELEASES_URL.to_string(),
                published_at: None,
                error: Some(format!("Failed to run update check: {err}")),
            },
        }
    })
    .await
    .map_err(|err| format!("update task failed: {err}"))?;

    Ok(result)
}

#[tauri::command]
pub fn open_release_page(smoke: State<'_, SmokeState>) -> Result<(), String> {
    if smoke.enabled {
        return Ok(());
    }

    #[cfg(windows)]
    {
        Command::new(windows_system32_tool("rundll32.exe"))
            .args(["url.dll,FileProtocolHandler", GITHUB_RELEASES_URL])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|err| format!("failed to open browser: {err}"))?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(GITHUB_RELEASES_URL)
            .spawn()
            .map_err(|err| format!("failed to open browser: {err}"))?;
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(GITHUB_RELEASES_URL)
            .spawn()
            .map_err(|err| format!("failed to open browser: {err}"))?;
    }

    Ok(())
}

#[tauri::command]
pub fn copy_text(app: AppHandle, text: String) -> Result<(), String> {
    if text.len() > MAX_COPY_LEN {
        return Err("clipboard text exceeds max length".to_string());
    }
    app.clipboard()
        .write_text(text)
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn get_app_info(app: AppHandle) -> AppInfo {
    build_app_info(&app)
}

#[tauri::command]
pub fn is_smoke_test(state: State<'_, SmokeState>) -> bool {
    state.enabled
}

#[tauri::command]
pub fn report_smoke_result(
    app: AppHandle,
    state: State<'_, SmokeState>,
    passed: bool,
    details: String,
) -> Result<(), &'static str> {
    if !state.enabled {
        return Err("smoke test mode is not enabled");
    }

    let clipboard_ok = app
        .clipboard()
        .read_text()
        .map(|text| text == "percentage-tool-smoke-test")
        .unwrap_or(false);

    if passed && clipboard_ok {
        println!("SMOKE_TEST_OK: all renderer, IPC, and clipboard checks passed.");
        app.exit(0);
    } else {
        eprintln!(
            "SMOKE_TEST_FAILED: passed={passed} clipboard_ok={clipboard_ok} details=[{details}]"
        );
        app.exit(1);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_new_entry() -> NewHistoryEntry {
        NewHistoryEntry {
            calculator: "tax".to_string(),
            calculator_label: "Tax / VAT (Add)".to_string(),
            input_a: "100".to_string(),
            input_b: "15".to_string(),
            mode: Some("add".to_string()),
            inputs_text: "100 + 15% tax".to_string(),
            result_text: "Total: 115.00 · Tax: 15.00".to_string(),
            copy_text: "Total: 115.00\nTax: 15.00\nNet: 100.00".to_string(),
        }
    }

    #[test]
    fn validates_new_and_stored_entries_identically() {
        let mut new_entry = sample_new_entry();
        assert!(validate_new_entry(&new_entry).is_ok());

        new_entry.calculator = "__proto__".to_string();
        assert!(validate_new_entry(&new_entry).is_err());

        let mut stored = HistoryEntry {
            id: 1,
            timestamp_ms: 1700000000000,
            calculator: "markup".to_string(),
            calculator_label: "Markup & Margin".to_string(),
            input_a: "80".to_string(),
            input_b: "100".to_string(),
            mode: Some("invalid".to_string()),
            inputs_text: "Cost 80 -> Price 100".to_string(),
            result_text: "Profit: 20.00".to_string(),
            copy_text: "Profit: 20.00".to_string(),
        };
        assert!(validate_history_entry(&stored).is_err());

        stored.mode = None;
        assert!(validate_history_entry(&stored).is_ok());

        stored.input_a = "9".repeat(MAX_FIELD_LEN + 1);
        assert!(validate_history_entry(&stored).is_err());
    }

    #[test]
    fn rejects_oversized_history_file_and_writes_atomically() {
        let base = std::env::temp_dir().join(format!("pct-cmd-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&base);
        std::fs::create_dir_all(&base).unwrap();

        let target = base.join("history.json");
        write_atomic_private(&target, br#"[]"#).unwrap();
        assert_eq!(read_regular_file_limited(&target, 1024).unwrap(), b"[]");

        let big = base.join("big.json");
        std::fs::write(&big, vec![b'a'; 200]).unwrap();
        assert!(read_regular_file_limited(&big, 100).is_err());

        #[cfg(unix)]
        {
            let link = base.join("link.json");
            std::os::unix::fs::symlink(&target, &link).unwrap();
            assert!(read_regular_file_limited(&link, 1024).is_err());
            assert!(write_atomic_private(&link, b"[]").is_err());
        }

        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn semver_comparison_and_release_json_parsing_work() {
        assert_eq!(parse_semver_triplet("v2.1.1"), Some((2, 1, 1)));
        assert_eq!(parse_semver_triplet("2.10.0-beta.1"), Some((2, 10, 0)));
        assert_eq!(parse_semver_triplet("invalid"), None);

        assert!(is_newer_version("2.1.1", "v2.2.0"));
        assert!(is_newer_version("2.1.1", "v2.1.2"));
        assert!(!is_newer_version("2.1.1", "v2.1.1"));
        assert!(!is_newer_version("2.1.1", "v2.1.0"));

        let payload = br#"{
            "tag_name": "v2.2.0",
            "html_url": "https://github.com/CipherVaults/Percentage-Calculator-Tool/releases/tag/v2.2.0",
            "published_at": "2026-11-15T12:00:00Z"
        }"#;
        let parsed = parse_github_release_json("2.1.1", payload).unwrap();
        assert!(parsed.ok);
        assert!(parsed.update_available);
        assert_eq!(parsed.latest_version.as_deref(), Some("2.2.0"));
        assert_eq!(
            parsed.release_url,
            "https://github.com/CipherVaults/Percentage-Calculator-Tool/releases/tag/v2.2.0"
        );

        let untrusted_url_payload = br#"{
            "tag_name": "v2.1.1",
            "html_url": "https://evil.example.com/phish"
        }"#;
        let sanitized = parse_github_release_json("2.1.1", untrusted_url_payload).unwrap();
        assert!(!sanitized.update_available);
        assert_eq!(sanitized.release_url, GITHUB_RELEASES_URL);
    }
}
