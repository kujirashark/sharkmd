use crate::commands::draft::data_dir;
use crate::error::AppResult;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub theme: String,
    pub font_size: u32,
    pub custom_css_path: Option<String>,
    #[serde(default)]
    pub last_root_path: Option<String>,
    /// UI language code (BCP-47). Defaults to "zh-CN" for backward compatibility
    /// with pre-v0.3 settings.json files. Validated on the frontend; the
    /// backend treats this as opaque storage.
    #[serde(default = "default_language")]
    pub language: String,
    /// Spell-check toggle (v0.4). Defaults to `false` so first-run users
    /// aren't greeted with red underlines before they confirm the
    /// dictionary matches their content.
    #[serde(default)]
    pub spellcheck_enabled: bool,
    /// Spell-check dictionary language code (v0.4). Defaults to "en-US"
    /// since `dictionary-en` is bundled; "zh-CN" is a placeholder until
    /// a real zh-CN Hunspell dictionary is wired in.
    #[serde(default = "default_spellcheck_lang")]
    pub spellcheck_lang: String,
}

/// Default language used when the field is missing from settings.json.
/// Returning a function (vs a literal default) preserves backward
/// compatibility: existing settings.json files without `language` deserialize
/// cleanly to "zh-CN" instead of erroring.
fn default_language() -> String {
    "zh-CN".into()
}

fn default_spellcheck_lang() -> String {
    "en-US".into()
}

pub fn settings_path() -> PathBuf {
    data_dir().join("settings.json")
}

#[tauri::command(rename_all = "camelCase")]
pub async fn get_settings() -> AppResult<Settings> {
    let p = settings_path();
    if !p.exists() {
        return Ok(Settings {
            theme: "light".into(),
            font_size: 16,
            custom_css_path: None,
            last_root_path: None,
            language: default_language(),
            spellcheck_enabled: false,
            spellcheck_lang: default_spellcheck_lang(),
        });
    }
    let bytes = tokio::fs::read(&p).await?;
    let s: Settings = serde_json::from_slice(&bytes)?;
    Ok(s)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn set_settings(s: Settings) -> AppResult<()> {
    if let Some(parent) = settings_path().parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    let bytes = serde_json::to_vec(&s)?;
    tokio::fs::write(settings_path(), bytes).await?;
    Ok(())
}
