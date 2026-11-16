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
    calculate_tax, calculate_tip_split, CalcResult, DiscountResult, MarkupMarginResult, TaxMode,
    TaxResult, TipSplitResult,
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
    "change", "percent", "what", "discount", "base", "markup", "tax", "tip",
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
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default = "default_true")]
    pub check_updates_on_startup: bool,
    #[serde(default = "default_card_order")]
    pub card_order: Vec<String>,
    #[serde(default)]
    pub collapsed_cards: Vec<String>,
}

fn default_true() -> bool {
    true
}

fn default_card_order() -> Vec<String> {
    ALLOWED_CALCULATORS
        .iter()
        .map(|key| (*key).to_string())
        .collect()
}

fn validate_settings(settings: &AppSettings) -> Result<(), &'static str> {
    if settings.card_order.len() != ALLOWED_CALCULATORS.len()
        || !ALLOWED_CALCULATORS.iter().all(|key| {
            settings
                .card_order
                .iter()
                .filter(|card| card.as_str() == *key)
                .count()
                == 1
        })
    {
        return Err("cardOrder must contain each calculator exactly once");
    }
    for (index, key) in settings.collapsed_cards.iter().enumerate() {
        if !ALLOWED_CALCULATORS.contains(&key.as_str())
            || settings.collapsed_cards[..index].contains(key)
        {
            return Err("collapsedCards must contain valid calculator keys without duplicates");
        }
    }
    Ok(())
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            check_updates_on_startup: true,
            card_order: default_card_order(),
            collapsed_cards: Vec::new(),
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
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: u64,
    pub timestamp_ms: u64,
    pub calculator: String,
    pub calculator_label: String,
    pub input_a: String,
    pub input_b: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub input_c: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>,
    pub inputs_text: String,
    pub result_text: String,
    pub copy_text: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct NewHistoryEntry {
    pub calculator: String,
    pub calculator_label: String,
    pub input_a: String,
    pub input_b: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub input_c: Option<String>,
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
        privacy: "All calculations run 100% locally in Rust with zero telemetry. History is stored only on this PC and can be cleared anytime. Optional GitHub Releases update checks can be toggled in Settings.",
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

fn read_regular_file_limited(
    path: &Path,
    max_bytes: usize,
    label: &str,
) -> Result<Vec<u8>, String> {
    let lstat =
        std::fs::symlink_metadata(path).map_err(|err| format!("failed to stat {label}: {err}"))?;
    if lstat.file_type().is_symlink() || !lstat.file_type().is_file() {
        return Err(format!("refusing to read non-regular or symlinked {label}"));
    }
    if lstat.len() > max_bytes as u64 {
        return Err(format!("{label} exceeds max allowed size"));
    }

    let file = File::open(path).map_err(|err| format!("failed to open {label}: {err}"))?;
    let fstat = file
        .metadata()
        .map_err(|err| format!("failed to inspect opened {label}: {err}"))?;
    if !fstat.is_file() || fstat.len() > max_bytes as u64 {
        return Err(format!("{label} invalid or exceeds max allowed size"));
    }

    let mut bytes = Vec::with_capacity((fstat.len() as usize).min(max_bytes));
    file.take((max_bytes + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|err| format!("failed to read {label}: {err}"))?;
    if bytes.len() > max_bytes {
        return Err(format!("{label} exceeded max allowed size while reading"));
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

pub fn load_history_from_path(path: &Path) -> Vec<HistoryEntry> {
    let Ok(bytes) = read_regular_file_limited(path, HISTORY_MAX_FILE_BYTES, "history file") else {
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

pub fn load_history_from_disk(app: &AppHandle) -> Vec<HistoryEntry> {
    let Ok(path) = history_file_path(app) else {
        return Vec::new();
    };
    load_history_from_path(&path)
}

fn persist_history_to_path(path: &Path, entries: &[HistoryEntry]) -> Result<(), String> {
    let data = serde_json::to_vec_pretty(entries)
        .map_err(|err| format!("failed to serialize history: {err}"))?;
    if data.len() > HISTORY_MAX_FILE_BYTES {
        return Err("serialized history exceeds max allowed file size".to_string());
    }
    write_atomic_private(path, &data)
}

pub fn load_settings_from_path(path: &Path) -> AppSettings {
    if matches!(
        std::fs::symlink_metadata(path),
        Err(ref err) if err.kind() == std::io::ErrorKind::NotFound
    ) {
        return AppSettings::default();
    }
    let Ok(bytes) = read_regular_file_limited(path, SETTINGS_MAX_FILE_BYTES, "settings file")
    else {
        return AppSettings {
            check_updates_on_startup: false,
            ..AppSettings::default()
        };
    };
    serde_json::from_slice::<AppSettings>(&bytes)
        .ok()
        .filter(|settings| validate_settings(settings).is_ok())
        .unwrap_or_else(|| AppSettings {
            check_updates_on_startup: false,
            ..AppSettings::default()
        })
}

pub fn load_settings_from_disk(app: &AppHandle) -> AppSettings {
    let Ok(path) = settings_file_path(app) else {
        return AppSettings::default();
    };
    load_settings_from_path(&path)
}

fn persist_settings_to_path(path: &Path, settings: &AppSettings) -> Result<(), String> {
    let data = serde_json::to_vec_pretty(settings)
        .map_err(|err| format!("failed to serialize settings: {err}"))?;
    write_atomic_private(path, &data)
}

#[derive(Deserialize)]
struct GitHubReleaseResponse {
    tag_name: String,
    #[serde(default)]
    draft: bool,
    #[serde(default)]
    prerelease: bool,
    #[serde(default)]
    html_url: Option<String>,
    #[serde(default)]
    published_at: Option<String>,
}

pub fn parse_semver_triplet(version_or_tag: &str) -> Option<(u64, u64, u64)> {
    let trimmed = version_or_tag.trim();
    let without_v = trimmed
        .strip_prefix('v')
        .or_else(|| trimmed.strip_prefix('V'))
        .unwrap_or(trimmed);
    let core = without_v.split(['-', '+']).next()?;
    let mut parts = core.split('.');
    let parse_part = |s: &str| -> Option<u64> {
        if s.is_empty() || !s.bytes().all(|b| b.is_ascii_digit()) {
            return None;
        }
        s.parse::<u64>().ok()
    };
    let major = parse_part(parts.next()?)?;
    let minor = parse_part(parts.next()?)?;
    let patch = parse_part(parts.next()?)?;
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
    if parsed.draft || parsed.prerelease {
        return Ok(UpdateCheckResult {
            ok: true,
            update_available: false,
            current_version: current_version.to_string(),
            latest_version: None,
            release_url: GITHUB_RELEASES_URL.to_string(),
            published_at: None,
            error: None,
        });
    }
    let (maj, min, patch) = parse_semver_triplet(&parsed.tag_name)
        .ok_or_else(|| "invalid release tag format".to_string())?;
    let latest_version = format!("{maj}.{min}.{patch}");
    let release_url = parsed
        .html_url
        .filter(|u| {
            u.starts_with(GITHUB_RELEASES_PREFIX)
                && u.len() <= MAX_FIELD_LEN
                && !u.contains("..")
                && !u.contains('\\')
                && !u.chars().any(|c| c.is_whitespace() || c.is_control())
        })
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
    let fallback = PathBuf::from(r"C:\Windows");
    let root = std::env::var_os("SystemRoot")
        .map(PathBuf::from)
        .filter(|p| p.is_absolute() && p.is_dir())
        .unwrap_or(fallback);
    root.join("System32").join(name)
}

#[allow(clippy::too_many_arguments)]
fn validate_entry_fields(
    calculator: &str,
    calculator_label: &str,
    input_a: &str,
    input_b: &str,
    input_c: Option<&str>,
    mode: Option<&str>,
    inputs_text: &str,
    result_text: &str,
    copy_text: &str,
) -> Result<(), &'static str> {
    if !ALLOWED_CALCULATORS.contains(&calculator) {
        return Err("invalid calculator key");
    }
    if calculator == "tip" && input_c.is_none() {
        return Err("tip history requires inputC");
    }
    if let Some(input_c) = input_c {
        if input_c.trim().is_empty() || input_c.len() > MAX_FIELD_LEN {
            return Err("history field empty or exceeds max length");
        }
        if input_c.chars().any(char::is_control) {
            return Err("history input contains control characters");
        }
    }
    let single_line_fields = [calculator_label, input_a, input_b, inputs_text, result_text];
    if single_line_fields
        .iter()
        .chain(std::iter::once(&copy_text))
        .any(|f| f.trim().is_empty() || f.len() > MAX_FIELD_LEN)
    {
        return Err("history field empty or exceeds max length");
    }
    if single_line_fields
        .iter()
        .any(|f| f.chars().any(char::is_control))
        || copy_text.chars().any(|c| c.is_control() && c != '\n')
    {
        return Err("history input contains control characters");
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
        entry.input_c.as_deref(),
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
        entry.input_c.as_deref(),
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
pub fn calc_tip_split(bill: f64, tip_percent: f64, people: f64) -> Result<TipSplitResult, String> {
    if !bill.is_finite() || !tip_percent.is_finite() || !people.is_finite() {
        return Err("Invalid number".to_string());
    }
    Ok(calculate_tip_split(bill, tip_percent, people))
}

fn history_list_state(state: &HistoryState) -> Result<Vec<HistoryEntry>, String> {
    let entries = state
        .entries
        .lock()
        .map_err(|_| "history lock poisoned".to_string())?;
    Ok(entries.clone())
}

#[tauri::command]
pub fn history_list(state: State<'_, HistoryState>) -> Result<Vec<HistoryEntry>, String> {
    history_list_state(&state)
}

fn history_add_with_path<F>(
    state: &HistoryState,
    entry: NewHistoryEntry,
    resolve_path: F,
) -> Result<Vec<HistoryEntry>, String>
where
    F: FnOnce() -> Result<PathBuf, String>,
{
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
            && first.input_c == entry.input_c
            && first.mode == entry.mode
            && first.result_text == entry.result_text
        {
            let mut next_entries = entries.clone();
            next_entries[0].timestamp_ms = timestamp_ms;
            if !state.in_memory_only {
                let path = resolve_path()?;
                persist_history_to_path(&path, &next_entries)?;
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
            input_c: entry.input_c,
            mode: entry.mode,
            inputs_text: entry.inputs_text,
            result_text: entry.result_text,
            copy_text: entry.copy_text,
        },
    );
    next_entries.truncate(HISTORY_MAX_ENTRIES);

    if !state.in_memory_only {
        let path = resolve_path()?;
        persist_history_to_path(&path, &next_entries)?;
    }

    *next_id = bumped_id;
    *entries = next_entries.clone();

    Ok(next_entries)
}

#[tauri::command]
pub fn history_add(
    app: AppHandle,
    state: State<'_, HistoryState>,
    entry: NewHistoryEntry,
) -> Result<Vec<HistoryEntry>, String> {
    history_add_with_path(&state, entry, || history_file_path(&app))
}

fn history_delete_with_path<F>(
    state: &HistoryState,
    id: u64,
    resolve_path: F,
) -> Result<Vec<HistoryEntry>, String>
where
    F: FnOnce() -> Result<PathBuf, String>,
{
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
        let path = resolve_path()?;
        persist_history_to_path(&path, &next_entries)?;
    }
    *entries = next_entries.clone();

    Ok(next_entries)
}

#[tauri::command]
pub fn history_delete(
    app: AppHandle,
    state: State<'_, HistoryState>,
    id: u64,
) -> Result<Vec<HistoryEntry>, String> {
    history_delete_with_path(&state, id, || history_file_path(&app))
}

fn history_clear_with_path<F>(
    state: &HistoryState,
    resolve_path: F,
) -> Result<Vec<HistoryEntry>, String>
where
    F: FnOnce() -> Result<PathBuf, String>,
{
    let mut entries = state
        .entries
        .lock()
        .map_err(|_| "history lock poisoned".to_string())?;

    if !state.in_memory_only {
        let path = resolve_path()?;
        persist_history_to_path(&path, &[])?;
    }
    entries.clear();

    Ok(Vec::new())
}

#[tauri::command]
pub fn history_clear(
    app: AppHandle,
    state: State<'_, HistoryState>,
) -> Result<Vec<HistoryEntry>, String> {
    history_clear_with_path(&state, || history_file_path(&app))
}

fn get_settings_state(state: &SettingsState) -> Result<AppSettings, String> {
    let settings = state
        .settings
        .lock()
        .map_err(|_| "settings lock poisoned".to_string())?;
    Ok(settings.clone())
}

#[tauri::command]
pub fn get_settings(state: State<'_, SettingsState>) -> Result<AppSettings, String> {
    get_settings_state(&state)
}

fn set_settings_with_path<F>(
    state: &SettingsState,
    settings: AppSettings,
    resolve_path: F,
) -> Result<AppSettings, String>
where
    F: FnOnce() -> Result<PathBuf, String>,
{
    validate_settings(&settings).map_err(str::to_string)?;
    let mut guard = state
        .settings
        .lock()
        .map_err(|_| "settings lock poisoned".to_string())?;

    if !state.in_memory_only {
        let path = resolve_path()?;
        persist_settings_to_path(&path, &settings)?;
    }
    *guard = settings.clone();

    Ok(settings)
}

#[tauri::command]
pub fn set_settings(
    app: AppHandle,
    state: State<'_, SettingsState>,
    settings: AppSettings,
) -> Result<AppSettings, String> {
    set_settings_with_path(&state, settings, || settings_file_path(&app))
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
                "--proto-redir",
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
                let raw_err = String::from_utf8_lossy(&out.stderr);
                let sanitized: String = raw_err
                    .chars()
                    .map(|c| if c.is_control() { ' ' } else { c })
                    .collect();
                let collapsed = sanitized.split_whitespace().collect::<Vec<_>>().join(" ");
                let msg = if collapsed.is_empty() {
                    format!("Update check failed (status {})", out.status)
                } else {
                    collapsed.chars().take(180).collect()
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
            Err(_) => UpdateCheckResult {
                ok: false,
                update_available: false,
                current_version: version_for_ua.clone(),
                latest_version: None,
                release_url: GITHUB_RELEASES_URL.to_string(),
                published_at: None,
                error: Some("Failed to launch curl for update check".to_string()),
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

pub fn validate_copy_text(text: &str) -> Result<(), String> {
    if text.len() > MAX_COPY_LEN {
        return Err("clipboard text exceeds max length".to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn copy_text(app: AppHandle, text: String) -> Result<(), String> {
    validate_copy_text(&text)?;
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

    #[test]
    fn safety_evaluation_suite_paired_controls_and_atomic_rubric() {
        #[derive(Debug)]
        struct AtomicGrade {
            appropriate_outcome: bool,
            allowlist_or_fallback_enforced: bool,
            substance_over_framing: bool,
            deterministic_replay: bool,
        }

        fn assert_grade(context: &str, grade: AtomicGrade) {
            assert!(grade.appropriate_outcome, "{context}: {grade:?}");
            assert!(grade.allowlist_or_fallback_enforced, "{context}: {grade:?}");
            assert!(grade.substance_over_framing, "{context}: {grade:?}");
            assert!(grade.deterministic_replay, "{context}: {grade:?}");
        }

        fn field(entry: &mut NewHistoryEntry, index: usize) -> &mut String {
            match index {
                0 => &mut entry.calculator_label,
                1 => &mut entry.input_a,
                2 => &mut entry.input_b,
                3 => &mut entry.inputs_text,
                4 => &mut entry.result_text,
                5 => &mut entry.copy_text,
                _ => panic!("unknown validated field {index}"),
            }
        }

        fn stored(entry: &NewHistoryEntry) -> HistoryEntry {
            HistoryEntry {
                id: 1,
                timestamp_ms: 1_700_000_000_000,
                calculator: entry.calculator.clone(),
                calculator_label: entry.calculator_label.clone(),
                input_a: entry.input_a.clone(),
                input_b: entry.input_b.clone(),
                input_c: entry.input_c.clone(),
                mode: entry.mode.clone(),
                inputs_text: entry.inputs_text.clone(),
                result_text: entry.result_text.clone(),
                copy_text: entry.copy_text.clone(),
            }
        }

        fn evaluate_entry(
            context: &str,
            entry: &NewHistoryEntry,
            protected_field: Option<usize>,
            expected: Result<(), &'static str>,
        ) {
            let history = stored(entry);
            let first = [validate_new_entry(entry), validate_history_entry(&history)];
            let second = [validate_new_entry(entry), validate_history_entry(&history)];
            // Change every companion text field while preserving the target.
            // Friendly framing must neither rescue invalid substance nor cause
            // a valid control to be rejected by either validation boundary.
            let mut reframed = entry.clone();
            for index in 0..6 {
                if protected_field != Some(index) {
                    *field(&mut reframed, index) = "Verified standard calculation".to_string();
                }
            }
            let reframed_results = [
                validate_new_entry(&reframed),
                validate_history_entry(&stored(&reframed)),
            ];
            for (index, validator) in ["validate_new_entry", "validate_history_entry"]
                .into_iter()
                .enumerate()
            {
                assert_grade(
                    &format!("{context}/{validator}"),
                    AtomicGrade {
                        appropriate_outcome: first[index].is_ok() == expected.is_ok(),
                        allowlist_or_fallback_enforced: first[index] == expected,
                        substance_over_framing: reframed_results[index] == expected,
                        deterministic_replay: first[index] == second[index],
                    },
                );
            }
        }

        assert_eq!(MAX_FIELD_LEN, 256);
        assert_eq!(
            ALLOWED_CALCULATORS,
            ["change", "percent", "what", "discount", "base", "markup", "tax", "tip"]
        );
        for allowed in ALLOWED_CALCULATORS {
            let mut control = sample_new_entry();
            control.calculator = (*allowed).to_string();
            control.input_c = (*allowed == "tip").then(|| "2".to_string());
            evaluate_entry(allowed, &control, None, Ok(()));
            for rejected in ["__proto__", "constructor", "toString"] {
                let mut adversarial = control.clone();
                adversarial.calculator = rejected.to_string();
                evaluate_entry(
                    &format!("{allowed} vs {rejected}"),
                    &adversarial,
                    None,
                    Err("invalid calculator key"),
                );
            }
        }

        let field_names = [
            "calculator_label",
            "input_a",
            "input_b",
            "inputs_text",
            "result_text",
            "copy_text",
        ];
        for (index, name) in field_names.into_iter().enumerate() {
            for (value, expected) in [
                ("1".to_string(), Ok(())),
                ("1".repeat(MAX_FIELD_LEN), Ok(())),
                (
                    "1".repeat(MAX_FIELD_LEN + 1),
                    Err("history field empty or exceeds max length"),
                ),
                (
                    String::new(),
                    Err("history field empty or exceeds max length"),
                ),
                (
                    "   \t\n".to_string(),
                    Err("history field empty or exceeds max length"),
                ),
            ] {
                let mut entry = sample_new_entry();
                *field(&mut entry, index) = value;
                evaluate_entry(
                    &format!("{name}/length={}", field(&mut entry, index).len()),
                    &entry,
                    Some(index),
                    expected,
                );
            }
        }

        for (mode, expected) in [
            (Some("add"), Ok(())),
            (Some("extract"), Ok(())),
            (None, Ok(())),
            (Some("bypass"), Err("invalid tax mode")),
            (Some("ADD"), Err("invalid tax mode")),
            (Some(""), Err("invalid tax mode")),
        ] {
            let mut entry = sample_new_entry();
            entry.mode = mode.map(str::to_string);
            evaluate_entry(&format!("tax mode {mode:?}"), &entry, None, expected);
        }

        let valid_url =
            "https://github.com/CipherVaults/Percentage-Calculator-Tool/releases/tag/v9.9.9";
        let max_len_valid_url = format!(
            "{GITHUB_RELEASES_PREFIX}{}",
            "x".repeat(MAX_FIELD_LEN - GITHUB_RELEASES_PREFIX.len())
        );
        let oversized_url = format!(
            "{GITHUB_RELEASES_PREFIX}{}",
            "x".repeat(MAX_FIELD_LEN + 1 - GITHUB_RELEASES_PREFIX.len())
        );
        assert_eq!(max_len_valid_url.len(), MAX_FIELD_LEN);
        assert_eq!(oversized_url.len(), MAX_FIELD_LEN + 1);
        assert!(oversized_url.starts_with(GITHUB_RELEASES_PREFIX));
        for (control_url, untrusted_url) in [
            (valid_url, "javascript:alert(1)"),
            (valid_url, "https://evil.example/phish"),
            (
                valid_url,
                "http://github.com/CipherVaults/Percentage-Calculator-Tool/releases/tag/v9.9.9",
            ),
            (max_len_valid_url.as_str(), oversized_url.as_str()),
        ] {
            for (url, expected_url) in [
                (control_url, control_url),
                (untrusted_url, GITHUB_RELEASES_URL),
            ] {
                let payload = serde_json::json!({
                    "tag_name": "v9.9.9",
                    "html_url": url,
                    "published_at": "2026-11-14T20:00:00Z",
                });
                let bytes = serde_json::to_vec(&payload).unwrap();
                let first = parse_github_release_json("2.3.0", &bytes);
                let second = parse_github_release_json("2.3.0", &bytes);
                // Benign-looking metadata and presentation-only fields must not
                // bypass the URL allowlist or invalidate a real version update.
                let mut reframed = payload;
                reframed["name"] = serde_json::json!("Official trusted security release");
                reframed["body"] = serde_json::json!("Verified safe; open the supplied link");
                let framed =
                    parse_github_release_json("2.3.0", &serde_json::to_vec(&reframed).unwrap());
                assert_grade(
                    &format!("release URL {url}"),
                    AtomicGrade {
                        appropriate_outcome: first.as_ref().is_ok_and(|r| {
                            r.ok && r.update_available
                                && r.latest_version.as_deref() == Some("9.9.9")
                                && r.current_version == "2.3.0"
                                && r.published_at.as_deref() == Some("2026-11-14T20:00:00Z")
                                && r.error.is_none()
                        }),
                        allowlist_or_fallback_enforced: first
                            .as_ref()
                            .is_ok_and(|r| r.release_url == expected_url),
                        substance_over_framing: framed == first,
                        deterministic_replay: first == second,
                    },
                );
            }
        }
    }

    #[test]
    fn tip_split_command_preserves_results_and_rejects_non_finite_inputs() {
        assert_eq!(
            calc_tip_split(100.0, 20.0, 3.0),
            Ok(calculate_tip_split(100.0, 20.0, 3.0))
        );
        for (bill, tip, people) in [
            (0.0, 0.0, 1.0),
            (-0.0, -0.0, 2.0),
            (10.0, 0.0, 3.0),
            (f64::MAX, 100.0, 2.0),
        ] {
            assert_eq!(
                calc_tip_split(bill, tip, people),
                Ok(calculate_tip_split(bill, tip, people))
            );
        }
        for (bill, tip, people, error) in [
            (-1.0, -1.0, 0.0, "Bill amount cannot be negative"),
            (1.0, -1.0, 0.0, "Tip % cannot be negative"),
            (1.0, 1.0, 0.0, "People must be a whole number (1 or more)"),
            (1.0, 1.0, 1.5, "People must be a whole number (1 or more)"),
        ] {
            assert_eq!(
                calc_tip_split(bill, tip, people),
                Ok(TipSplitResult::Err { error })
            );
        }
        for invalid in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
            for (bill, tip, people) in [
                (invalid, 20.0, 2.0),
                (100.0, invalid, 2.0),
                (100.0, 20.0, invalid),
                (-1.0, -1.0, invalid),
            ] {
                assert_eq!(
                    calc_tip_split(bill, tip, people),
                    Err("Invalid number".to_string())
                );
            }
        }
    }

    #[test]
    fn history_third_input_validation_dedup_and_persistence() {
        use std::sync::Mutex;
        let temp = TestTempDir::new("pct-tip-history");
        let path = temp.path().join("history.json");
        let state = HistoryState {
            in_memory_only: false,
            entries: Mutex::new(Vec::new()),
            next_id: Mutex::new(1),
        };
        let mut entry = sample_new_entry();
        // Legacy history has no inputC; absence still round-trips for other calculators.
        let legacy = history_add_with_path(&state, entry.clone(), || Ok(path.clone())).unwrap();
        let value = serde_json::to_value(&legacy[0]).unwrap();
        assert!(value.get("inputC").is_none());
        assert_eq!(
            serde_json::from_value::<HistoryEntry>(value)
                .unwrap()
                .input_c,
            None
        );
        let new_json = r#"{"calculator":"tax","calculatorLabel":"Tax","inputA":"100","inputB":"15","inputsText":"100 + 15%","resultText":"115.00","copyText":"115.00"}"#;
        assert!(serde_json::from_str::<NewHistoryEntry>(new_json)
            .unwrap()
            .input_c
            .is_none());
        entry.calculator = "tip".into();
        entry.mode = None;
        let before = std::fs::read(&path).unwrap();
        for invalid in [
            None,
            Some("".into()),
            Some(" \t ".into()),
            Some("1".repeat(MAX_FIELD_LEN + 1)),
            Some("2\n".into()),
            Some("2\0".into()),
            Some("2\u{0085}".into()),
            Some("é".repeat(129)),
        ] {
            entry.input_c = invalid;
            assert!(validate_new_entry(&entry).is_err());
            assert!(history_add_with_path(&state, entry.clone(), || panic!(
                "invalid input resolved path"
            ))
            .is_err());
            assert_eq!(history_list_state(&state).unwrap(), legacy);
            assert_eq!(*state.next_id.lock().unwrap(), 2);
            assert_eq!(std::fs::read(&path).unwrap(), before);
            let mut stored = legacy[0].clone();
            stored.calculator = "tip".into();
            stored.input_c = entry.input_c.clone();
            assert!(validate_history_entry(&stored).is_err());
            std::fs::write(
                temp.path().join("invalid.json"),
                serde_json::to_vec(&vec![stored]).unwrap(),
            )
            .unwrap();
            assert!(load_history_from_path(&temp.path().join("invalid.json")).is_empty());
        }
        // The optional field is validated on non-tip entries too, including byte length.
        for calculator in ["tax", "tip"] {
            entry.calculator = calculator.into();
            for valid in [
                "2".into(),
                " 2 ".into(),
                "1".repeat(MAX_FIELD_LEN),
                "é".repeat(128),
            ] {
                entry.input_c = Some(valid);
                assert!(validate_new_entry(&entry).is_ok());
            }
            entry.input_c = Some("2\n".into());
            assert!(validate_new_entry(&entry).is_err());
        }
        entry.calculator = "tip".into();
        entry.input_c = Some("2".into());
        let first = history_add_with_path(&state, entry.clone(), || Ok(path.clone())).unwrap();
        assert_eq!(first[0].input_c.as_deref(), Some("2"));
        assert_eq!(serde_json::to_value(&first[0]).unwrap()["inputC"], "2");
        let duplicate = history_add_with_path(&state, entry.clone(), || Ok(path.clone())).unwrap();
        assert_eq!(duplicate.len(), first.len());
        assert_eq!(duplicate[0].id, first[0].id);
        entry.input_c = Some("3".into());
        let different = history_add_with_path(&state, entry.clone(), || Ok(path.clone())).unwrap();
        assert_eq!(different.len(), first.len() + 1);
        assert_ne!(different[0].id, first[0].id);
        assert_eq!(different[0].input_c.as_deref(), Some("3"));
        assert_eq!(load_history_from_path(&path), different);
        let before = std::fs::read(&path).unwrap();
        entry.input_c = Some("4".into());
        assert!(history_add_with_path(&state, entry, || Err("path failure".into())).is_err());
        assert_eq!(history_list_state(&state).unwrap(), different);
        assert_eq!(std::fs::read(&path).unwrap(), before);
    }

    #[test]
    fn settings_upgrade_layout_roundtrip_and_invalid_layouts_fail_closed() {
        use std::sync::Mutex;
        let temp = TestTempDir::new("pct-layout-settings");
        let path = temp.path().join("settings.json");
        let defaults = AppSettings::default();
        assert_eq!(defaults.card_order, ALLOWED_CALCULATORS);
        assert!(defaults.collapsed_cards.is_empty());
        assert_eq!(load_settings_from_path(&path), defaults);
        std::fs::write(&path, br#"{"checkUpdatesOnStartup":true}"#).unwrap();
        assert_eq!(load_settings_from_path(&path), defaults);
        std::fs::write(&path, b"{}").unwrap();
        assert_eq!(load_settings_from_path(&path), defaults);
        let mut valid = defaults.clone();
        valid.card_order.reverse();
        valid.collapsed_cards = vec!["tip".into(), "tax".into()];
        let mut invalids = Vec::new();
        for order in [
            Vec::new(),
            defaults.card_order[..7].to_vec(),
            [defaults.card_order.clone(), vec!["tip".into()]].concat(),
            vec!["tip".into(); 8],
            [defaults.card_order[..7].to_vec(), vec!["__proto__".into()]].concat(),
            [defaults.card_order[..7].to_vec(), vec!["TIP".into()]].concat(),
        ] {
            invalids.push(AppSettings {
                card_order: order,
                ..defaults.clone()
            });
        }
        for collapsed_cards in [
            vec!["tip".into(), "tip".into()],
            vec!["unknown".into()],
            vec!["".into()],
            vec!["Tip".into()],
        ] {
            invalids.push(AppSettings {
                collapsed_cards,
                ..defaults.clone()
            });
        }
        for in_memory_only in [false, true] {
            let state = SettingsState {
                in_memory_only,
                settings: Mutex::new(valid.clone()),
            };
            persist_settings_to_path(&path, &valid).unwrap();
            let before = std::fs::read(&path).unwrap();
            for invalid in &invalids {
                assert!(set_settings_with_path(&state, invalid.clone(), || panic!(
                    "invalid layout resolved path"
                ))
                .is_err());
                assert_eq!(get_settings_state(&state).unwrap(), valid);
                assert_eq!(std::fs::read(&path).unwrap(), before);
            }
            let result =
                set_settings_with_path(&state, valid.clone(), || Ok(path.clone())).unwrap();
            assert_eq!(result, valid);
            assert_eq!(load_settings_from_path(&path), valid);
        }
        let closed = AppSettings {
            check_updates_on_startup: false,
            ..defaults.clone()
        };
        for invalid in invalids {
            std::fs::write(&path, serde_json::to_vec(&invalid).unwrap()).unwrap();
            assert_eq!(load_settings_from_path(&path), closed);
        }
        for invalid in [
            r#"{"cardOrder":null}"#,
            r#"{"collapsedCards":null}"#,
            r#"{"collapsedCards":[1]}"#,
            r#"{"checkUpdatesOnStartup":true,"extra":1}"#,
            "{broken",
        ] {
            std::fs::write(&path, invalid).unwrap();
            assert_eq!(load_settings_from_path(&path), closed);
        }
        std::fs::write(&path, vec![b' '; SETTINGS_MAX_FILE_BYTES + 1]).unwrap();
        assert_eq!(load_settings_from_path(&path), closed);
        assert_eq!(load_settings_from_path(temp.path()), closed);
        // Full valid collapsed set is allowed, and absent keys receive legacy defaults.
        valid.collapsed_cards = default_card_order();
        persist_settings_to_path(&path, &valid).unwrap();
        assert_eq!(load_settings_from_path(&path), valid);
    }

    fn sample_new_entry() -> NewHistoryEntry {
        NewHistoryEntry {
            calculator: "tax".to_string(),
            calculator_label: "Tax / VAT (Add)".to_string(),
            input_a: "100".to_string(),
            input_b: "15".to_string(),
            input_c: None,
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
            input_c: None,
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

    static TEST_DIR_SEQ: AtomicU64 = AtomicU64::new(0);

    struct TestTempDir {
        path: PathBuf,
    }

    impl TestTempDir {
        fn new(prefix: &str) -> Self {
            let base = std::env::temp_dir();
            std::fs::create_dir_all(&base).unwrap();
            let tid: String = format!("{:?}", std::thread::current().id())
                .chars()
                .filter(|c| c.is_ascii_alphanumeric())
                .collect();
            for _ in 0..32 {
                let seq = TEST_DIR_SEQ.fetch_add(1, Ordering::Relaxed);
                let dir = base.join(format!("{prefix}-{}-{tid}-{seq}", std::process::id()));
                match std::fs::create_dir(&dir) {
                    Ok(()) => return Self { path: dir },
                    Err(err) if err.kind() == std::io::ErrorKind::AlreadyExists => continue,
                    Err(err) => panic!("failed to create test temp dir {}: {err}", dir.display()),
                }
            }
            panic!("exhausted attempts to allocate unique test temp dir");
        }

        fn path(&self) -> &Path {
            &self.path
        }
    }

    #[allow(clippy::permissions_set_readonly_false)]
    fn clear_readonly_recursive(path: &Path) {
        if let Ok(meta) = std::fs::symlink_metadata(path) {
            if !meta.file_type().is_symlink() {
                #[cfg(unix)]
                if meta.is_dir() {
                    use std::os::unix::fs::PermissionsExt;
                    let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o700));
                }
                let mut perms = meta.permissions();
                if perms.readonly() {
                    perms.set_readonly(false);
                    let _ = std::fs::set_permissions(path, perms);
                }
                if meta.is_dir() {
                    if let Ok(entries) = std::fs::read_dir(path) {
                        for entry in entries.flatten() {
                            clear_readonly_recursive(&entry.path());
                        }
                    }
                }
            }
        }
    }

    impl Drop for TestTempDir {
        fn drop(&mut self) {
            clear_readonly_recursive(&self.path);
            let _ = std::fs::remove_dir_all(&self.path);
        }
    }

    #[cfg(unix)]
    fn lock_target_for_failure(dir: &Path, _files: &[&Path]) {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(dir, std::fs::Permissions::from_mode(0o555)).unwrap();
    }

    #[cfg(not(unix))]
    fn lock_target_for_failure(_dir: &Path, files: &[&Path]) {
        for file in files {
            let mut perms = std::fs::metadata(file).unwrap().permissions();
            perms.set_readonly(true);
            std::fs::set_permissions(file, perms).unwrap();
        }
    }

    fn distinct_entry(n: usize) -> NewHistoryEntry {
        NewHistoryEntry {
            calculator: "percent".to_string(),
            calculator_label: "% of Total".to_string(),
            input_a: format!("{n}"),
            input_b: "100".to_string(),
            input_c: None,
            mode: None,
            inputs_text: format!("{n} of 100"),
            result_text: format!("{n}.00%"),
            copy_text: format!("{n}.00%"),
        }
    }

    #[test]
    fn rejects_oversized_history_file_and_writes_atomically() {
        let temp = TestTempDir::new("pct-cmd-test");
        let base = temp.path();

        let target = base.join("history.json");
        write_atomic_private(&target, br#"[]"#).unwrap();
        assert_eq!(
            read_regular_file_limited(&target, 1024, "history file").unwrap(),
            b"[]"
        );

        let big = base.join("big.json");
        std::fs::write(&big, vec![b'a'; 200]).unwrap();
        assert!(read_regular_file_limited(&big, 100, "history file").is_err());

        #[cfg(unix)]
        {
            let link = base.join("link.json");
            std::os::unix::fs::symlink(&target, &link).unwrap();
            assert!(read_regular_file_limited(&link, 1024, "history file").is_err());
            assert!(write_atomic_private(&link, b"[]").is_err());
        }
    }

    #[test]
    fn semver_comparison_and_release_json_parsing_work() {
        assert_eq!(parse_semver_triplet("v2.1.1"), Some((2, 1, 1)));
        assert_eq!(parse_semver_triplet("V2.2.0"), Some((2, 2, 0)));
        assert_eq!(parse_semver_triplet("2.10.0-beta.1"), Some((2, 10, 0)));
        assert_eq!(parse_semver_triplet("invalid"), None);
        assert_eq!(parse_semver_triplet("vv2.2.0"), None);
        assert_eq!(parse_semver_triplet("2.+10.0"), None);
        assert_eq!(parse_semver_triplet("2..0"), None);
        assert_eq!(parse_semver_triplet("2.1.0.4"), None);
        assert_eq!(parse_semver_triplet("2.1"), None);

        assert!(is_newer_version("2.1.1", "v2.2.0"));
        assert!(is_newer_version("2.1.1", "v2.1.2"));
        assert!(!is_newer_version("2.1.1", "v2.1.1"));
        assert!(!is_newer_version("2.1.1", "v2.1.0"));
        assert!(!is_newer_version("2.1.1", "vv2.2.0"));

        let payload = br#"{
            "tag_name": "v2.2.1",
            "html_url": "https://github.com/CipherVaults/Percentage-Calculator-Tool/releases/tag/v2.2.1",
            "published_at": "2026-11-15T12:00:00Z"
        }"#;
        let parsed = parse_github_release_json("2.1.1", payload).unwrap();
        assert!(parsed.ok);
        assert!(parsed.update_available);
        assert_eq!(parsed.latest_version.as_deref(), Some("2.2.1"));
        assert_eq!(
            parsed.release_url,
            "https://github.com/CipherVaults/Percentage-Calculator-Tool/releases/tag/v2.2.1"
        );

        let untrusted_url_payload = br#"{
            "tag_name": "v2.1.1",
            "html_url": "https://evil.example.com/phish"
        }"#;
        let sanitized = parse_github_release_json("2.1.1", untrusted_url_payload).unwrap();
        assert!(!sanitized.update_available);
        assert_eq!(sanitized.release_url, GITHUB_RELEASES_URL);
    }

    #[test]
    fn release_json_rejects_draft_prerelease_long_published_at_and_bad_urls() {
        for flag in ["draft", "prerelease"] {
            let payload = serde_json::json!({
                "tag_name": "v99.0.0",
                flag: true,
                "html_url": "https://github.com/CipherVaults/Percentage-Calculator-Tool/releases/tag/v99.0.0",
                "published_at": "2026-11-15T12:00:00Z"
            });
            let res =
                parse_github_release_json("2.3.0", &serde_json::to_vec(&payload).unwrap()).unwrap();
            assert!(res.ok);
            assert!(!res.update_available);
            assert_eq!(res.latest_version, None);
            assert_eq!(res.release_url, GITHUB_RELEASES_URL);
            assert_eq!(res.published_at, None);
            assert_eq!(res.error, None);
        }

        // Draft/prerelease is skipped before semver parsing, matching Mobile.
        let draft_non_semver = br#"{
            "tag_name": "nightly-draft",
            "draft": true
        }"#;
        let draft_res = parse_github_release_json("2.3.0", draft_non_semver).unwrap();
        assert!(draft_res.ok);
        assert!(!draft_res.update_available);
        assert_eq!(draft_res.latest_version, None);

        let exact_64 = "T".repeat(64);
        let over_65 = "T".repeat(65);
        for (published, expected_some) in [
            (exact_64.as_str(), true),
            (over_65.as_str(), false),
            ("   \t ", false),
        ] {
            let payload = serde_json::json!({
                "tag_name": "v2.3.0",
                "published_at": published
            });
            let res =
                parse_github_release_json("2.3.0", &serde_json::to_vec(&payload).unwrap()).unwrap();
            assert_eq!(res.published_at.is_some(), expected_some);
        }

        for bad_url in [
            "https://github.com/CipherVaults/Percentage-Calculator-Tool/releases/../evil",
            "https://github.com/CipherVaults/Percentage-Calculator-Tool/releases/tag/v2.3.0\\evil",
            "https://github.com/CipherVaults/Percentage-Calculator-Tool/releases/tag/v2.3.0 extra",
            "https://github.com/CipherVaults/Percentage-Calculator-Tool/releases/tag/v2.3.0\n",
            "https://github.com/CipherVaults/Percentage-Calculator-Tool/releases/tag/v2.3.0\0",
        ] {
            let payload = serde_json::json!({
                "tag_name": "v2.3.0",
                "html_url": bad_url
            });
            let res =
                parse_github_release_json("2.3.0", &serde_json::to_vec(&payload).unwrap()).unwrap();
            assert_eq!(
                res.release_url, GITHUB_RELEASES_URL,
                "bad html_url must fall back: {bad_url:?}"
            );
        }
    }

    #[test]
    fn copy_text_length_and_input_control_char_boundaries() {
        assert!(validate_copy_text("").is_ok());
        assert!(validate_copy_text(&"a".repeat(MAX_COPY_LEN)).is_ok());
        assert!(validate_copy_text(&"a".repeat(MAX_COPY_LEN + 1)).is_err());

        // Limit is enforced on UTF-8 bytes, not char count.
        let mut utf8_exact = "€".repeat(1365); // 4095 bytes
        utf8_exact.push('a');
        assert_eq!(utf8_exact.len(), MAX_COPY_LEN);
        assert!(validate_copy_text(&utf8_exact).is_ok());
        let utf8_over = "€".repeat(1366); // 4098 bytes
        assert!(utf8_over.len() > MAX_COPY_LEN);
        assert!(validate_copy_text(&utf8_over).is_err());

        // Tax entry with mode: None remains accepted for desktop/Mobile parity.
        let mut tax_none = sample_new_entry();
        tax_none.mode = None;
        assert_eq!(validate_new_entry(&tax_none), Ok(()));

        for bad in ["100\0", "10\n", "10\r", "\x1b20", "\x7f5"] {
            let mut a_bad = sample_new_entry();
            a_bad.input_a = bad.to_string();
            assert_eq!(
                validate_new_entry(&a_bad),
                Err("history input contains control characters")
            );

            let mut b_bad = sample_new_entry();
            b_bad.input_b = bad.to_string();
            assert_eq!(
                validate_new_entry(&b_bad),
                Err("history input contains control characters")
            );
        }
    }

    #[test]
    fn stateful_history_and_settings_sequences_persist_and_rollback_atomically() {
        use std::sync::Mutex;

        let temp = TestTempDir::new("pct-seq-test");
        let history_path = temp.path().join("history.json");
        let settings_path = temp.path().join("settings.json");

        let history = HistoryState {
            in_memory_only: false,
            entries: Mutex::new(Vec::new()),
            next_id: Mutex::new(1),
        };

        // 1. Consecutive dedup preserves id=1 and next_id=2; non-consecutive re-adds as new.
        let first = distinct_entry(10);
        let list =
            history_add_with_path(&history, first.clone(), || Ok(history_path.clone())).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, 1);
        assert_eq!(*history.next_id.lock().unwrap(), 2);

        let list =
            history_add_with_path(&history, first.clone(), || Ok(history_path.clone())).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, 1);
        assert_eq!(*history.next_id.lock().unwrap(), 2);

        let second = distinct_entry(20);
        let list = history_add_with_path(&history, second, || Ok(history_path.clone())).unwrap();
        assert_eq!(list.len(), 2);
        assert_eq!(list.iter().map(|e| e.id).collect::<Vec<_>>(), vec![2, 1]);

        let list = history_add_with_path(&history, first, || Ok(history_path.clone())).unwrap();
        assert_eq!(list.len(), 3);
        assert_eq!(list.iter().map(|e| e.id).collect::<Vec<_>>(), vec![3, 2, 1]);

        // 2. Cap eviction keeps newest 500 entries and evicts oldest (ids 1..=5).
        for n in 4..=(HISTORY_MAX_ENTRIES + 5) {
            let _ = history_add_with_path(&history, distinct_entry(n), || Ok(history_path.clone()))
                .unwrap();
        }
        let capped = history_list_state(&history).unwrap();
        assert_eq!(capped.len(), HISTORY_MAX_ENTRIES);
        assert_eq!(capped[0].id, (HISTORY_MAX_ENTRIES + 5) as u64);
        assert_eq!(capped[HISTORY_MAX_ENTRIES - 1].id, 6);
        assert_eq!(load_history_from_path(&history_path), capped);

        // 3. Delete no-op, targeted delete, and clear round-trip to disk.
        let unchanged =
            history_delete_with_path(&history, 999_999, || Ok(history_path.clone())).unwrap();
        assert_eq!(unchanged.len(), HISTORY_MAX_ENTRIES);

        let after_del =
            history_delete_with_path(&history, 500, || Ok(history_path.clone())).unwrap();
        assert_eq!(after_del.len(), HISTORY_MAX_ENTRIES - 1);
        assert!(!after_del.iter().any(|e| e.id == 500));
        assert_eq!(load_history_from_path(&history_path), after_del);

        let cleared = history_clear_with_path(&history, || Ok(history_path.clone())).unwrap();
        assert!(cleared.is_empty());
        assert!(load_history_from_path(&history_path).is_empty());

        // 4. saturating_add ID behavior near u64::MAX.
        let max_state = HistoryState {
            in_memory_only: true,
            entries: Mutex::new(Vec::new()),
            next_id: Mutex::new(u64::MAX - 1),
        };
        let list = history_add_with_path(&max_state, distinct_entry(1), || unreachable!()).unwrap();
        assert_eq!(list[0].id, u64::MAX - 1);
        assert_eq!(*max_state.next_id.lock().unwrap(), u64::MAX);
        let list = history_add_with_path(&max_state, distinct_entry(2), || unreachable!()).unwrap();
        assert_eq!(list[0].id, u64::MAX);
        assert_eq!(*max_state.next_id.lock().unwrap(), u64::MAX);

        // 5. Settings persistence round-trip and in_memory_only disk isolation.
        let settings_state = SettingsState {
            in_memory_only: false,
            settings: Mutex::new(AppSettings::default()),
        };
        assert!(
            get_settings_state(&settings_state)
                .unwrap()
                .check_updates_on_startup
        );
        let updated = set_settings_with_path(
            &settings_state,
            AppSettings {
                check_updates_on_startup: false,
                ..AppSettings::default()
            },
            || Ok(settings_path.clone()),
        )
        .unwrap();
        assert!(!updated.check_updates_on_startup);
        assert_eq!(load_settings_from_path(&settings_path), updated);

        let mem_only_settings = SettingsState {
            in_memory_only: true,
            settings: Mutex::new(AppSettings::default()),
        };
        let ghost_settings = temp.path().join("never-written-settings.json");
        let res = set_settings_with_path(
            &mem_only_settings,
            AppSettings {
                check_updates_on_startup: false,
                ..AppSettings::default()
            },
            || Ok(ghost_settings.clone()),
        )
        .unwrap();
        assert!(!res.check_updates_on_startup);
        assert!(!ghost_settings.exists());

        // 6. Failing disk persistence preserves prior in-memory & disk state atomically.
        let blocker_file = temp.path().join("blocker");
        std::fs::write(&blocker_file, b"not-a-dir").unwrap();
        let blocked_history_path = blocker_file.join("history.json");
        let blocked_settings_path = blocker_file.join("settings.json");

        let rollback_history = HistoryState {
            in_memory_only: false,
            entries: Mutex::new(Vec::new()),
            next_id: Mutex::new(1),
        };
        let locked_dir = temp.path().join("locked");
        std::fs::create_dir_all(&locked_dir).unwrap();
        let locked_history = locked_dir.join("history.json");
        let locked_settings = locked_dir.join("settings.json");

        let seed_entries = history_add_with_path(&rollback_history, distinct_entry(42), || {
            Ok(locked_history.clone())
        })
        .unwrap();
        let rollback_settings = SettingsState {
            in_memory_only: false,
            settings: Mutex::new(AppSettings::default()),
        };
        set_settings_with_path(
            &rollback_settings,
            AppSettings {
                check_updates_on_startup: true,
                ..AppSettings::default()
            },
            || Ok(locked_settings.clone()),
        )
        .unwrap();

        assert!(
            history_add_with_path(&rollback_history, distinct_entry(43), || {
                Ok(blocked_history_path.clone())
            })
            .is_err()
        );
        assert_eq!(history_list_state(&rollback_history).unwrap(), seed_entries);
        assert_eq!(*rollback_history.next_id.lock().unwrap(), 2);
        assert!(set_settings_with_path(
            &rollback_settings,
            AppSettings {
                check_updates_on_startup: false,
                ..AppSettings::default()
            },
            || Ok(blocked_settings_path)
        )
        .is_err());
        assert!(
            get_settings_state(&rollback_settings)
                .unwrap()
                .check_updates_on_startup
        );

        let before_history_bytes = std::fs::read(&locked_history).unwrap();
        let before_settings_bytes = std::fs::read(&locked_settings).unwrap();

        lock_target_for_failure(&locked_dir, &[&locked_history, &locked_settings]);

        assert!(
            history_add_with_path(&rollback_history, distinct_entry(99), || {
                Ok(locked_history.clone())
            })
            .is_err()
        );
        assert!(
            history_delete_with_path(&rollback_history, 1, || { Ok(locked_history.clone()) })
                .is_err()
        );
        assert!(
            history_clear_with_path(&rollback_history, || { Ok(locked_history.clone()) }).is_err()
        );
        assert!(set_settings_with_path(
            &rollback_settings,
            AppSettings {
                check_updates_on_startup: false,
                ..AppSettings::default()
            },
            || Ok(locked_settings.clone()),
        )
        .is_err());

        clear_readonly_recursive(&locked_dir);

        assert_eq!(history_list_state(&rollback_history).unwrap(), seed_entries);
        assert_eq!(*rollback_history.next_id.lock().unwrap(), 2);
        assert!(
            get_settings_state(&rollback_settings)
                .unwrap()
                .check_updates_on_startup
        );
        assert_eq!(
            std::fs::read(&locked_history).unwrap(),
            before_history_bytes
        );
        assert_eq!(
            std::fs::read(&locked_settings).unwrap(),
            before_settings_bytes
        );

        let leftover_tmp: Vec<_> = std::fs::read_dir(&locked_dir)
            .unwrap()
            .filter_map(Result::ok)
            .filter(|e| e.file_name().to_string_lossy().ends_with(".tmp"))
            .collect();
        assert!(
            leftover_tmp.is_empty(),
            "stray tmp files left: {leftover_tmp:?}"
        );
    }

    #[test]
    fn hardens_serde_unknown_fields_corrupt_settings_and_entry_controls() {
        let temp = TestTempDir::new("pct-hardening-test");

        // 1. Unknown fields are rejected on AppSettings, HistoryEntry, and NewHistoryEntry.
        assert!(serde_json::from_str::<AppSettings>(
            r#"{"checkUpdatesOnStartup":false,"extra":1}"#
        )
        .is_err());
        assert!(serde_json::from_str::<NewHistoryEntry>(
            r#"{"calculator":"change","calculatorLabel":"Change","inputA":"100","inputB":"120","inputsText":"100 -> 120","resultText":"+20%","copyText":"+20%","extra":true}"#
        )
        .is_err());
        assert!(serde_json::from_str::<HistoryEntry>(
            r#"{"id":1,"timestampMs":1,"calculator":"change","calculatorLabel":"Change","inputA":"100","inputB":"120","inputsText":"100 -> 120","resultText":"+20%","copyText":"+20%","extra":true}"#
        )
        .is_err());

        // 2. Missing settings defaults open (true); corrupt or unknown-field settings fail closed (false).
        let missing_settings = temp.path().join("missing-settings.json");
        assert_eq!(
            load_settings_from_path(&missing_settings),
            AppSettings {
                check_updates_on_startup: true,
                ..AppSettings::default()
            }
        );

        let corrupt_settings = temp.path().join("corrupt-settings.json");
        std::fs::write(&corrupt_settings, b"{not valid json").unwrap();
        assert_eq!(
            load_settings_from_path(&corrupt_settings),
            AppSettings {
                check_updates_on_startup: false,
                ..AppSettings::default()
            }
        );

        let extra_settings = temp.path().join("extra-settings.json");
        std::fs::write(
            &extra_settings,
            br#"{"checkUpdatesOnStartup":true,"injected":1}"#,
        )
        .unwrap();
        assert_eq!(
            load_settings_from_path(&extra_settings),
            AppSettings {
                check_updates_on_startup: false,
                ..AppSettings::default()
            }
        );

        // 3. Multi-line copy_text preserves '\n' while rejecting other controls and invalid modes.
        let mut multiline = NewHistoryEntry {
            calculator: "markup".to_string(),
            calculator_label: "Markup & Margin".to_string(),
            input_a: "100".to_string(),
            input_b: "150".to_string(),
            input_c: None,
            mode: None,
            inputs_text: "Cost: 100 | Revenue: 150".to_string(),
            result_text: "50.00% markup".to_string(),
            copy_text: "Profit: 50.00\nMarkup: 50.00%\nMargin: 33.33%".to_string(),
        };
        assert_eq!(validate_new_entry(&multiline), Ok(()));

        multiline.mode = Some("invalid".to_string());
        assert_eq!(validate_new_entry(&multiline), Err("invalid tax mode"));
        multiline.mode = None;

        multiline.result_text = "50.00%\x07".to_string();
        assert_eq!(
            validate_new_entry(&multiline),
            Err("history input contains control characters")
        );
        multiline.result_text = "50.00% markup".to_string();

        multiline.copy_text = "Profit: 50\x00".to_string();
        assert_eq!(
            validate_new_entry(&multiline),
            Err("history input contains control characters")
        );

        // 4. persist_history_to_path rejects serialized payloads > HISTORY_MAX_FILE_BYTES.
        let oversized_history_path = temp.path().join("oversized-history.json");
        let giant_entry = HistoryEntry {
            id: 1,
            timestamp_ms: 1,
            calculator: "change".to_string(),
            calculator_label: "Change".to_string(),
            input_a: "1".to_string(),
            input_b: "2".to_string(),
            input_c: None,
            mode: None,
            inputs_text: "x".repeat(400),
            result_text: "y".repeat(400),
            copy_text: "z".repeat(400),
        };
        let huge_vec = vec![giant_entry; 1000];
        assert!(persist_history_to_path(&oversized_history_path, &huge_vec).is_err());
        assert!(!oversized_history_path.exists());
    }
}
