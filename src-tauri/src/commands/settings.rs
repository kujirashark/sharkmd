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
