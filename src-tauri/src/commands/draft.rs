use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DraftEntry {
    pub file_id: String,
    pub path: String,
    pub saved_at_ms: i64,
}

pub fn draft_path(file_id: &str) -> PathBuf {
    data_dir().join("draft").join(format!("{}.json", file_id))
}

pub fn data_dir() -> PathBuf {
    dirs::data_local_dir().unwrap_or_else(|| PathBuf::from(".")).join("sharkmd")
}

#[tauri::command(rename_all = "camelCase")]
pub async fn save_draft(file_id: String, json: String, path: Option<String>) -> AppResult<()> {
    if file_id.is_empty() {
        return Err(AppError::new("invalid_arg", "file_id 不能为空"));
    }
    let p = draft_path(&file_id);
    if let Some(parent) = p.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    let meta = serde_json::json!({
        "file_id": file_id,
        "path": path.unwrap_or_default(),
        "saved_at_ms": chrono::Utc::now().timestamp_millis(),
        "json": json,
    });
    tokio::fs::write(&p, serde_json::to_vec(&meta)?).await?;
    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub async fn list_drafts() -> AppResult<Vec<DraftEntry>> {
    let dir = data_dir().join("draft");
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut out = Vec::new();
    let mut rd = tokio::fs::read_dir(&dir).await?;
    while let Some(e) = rd.next_entry().await? {
        if e.file_type().await?.is_file() {
            if let Ok(bytes) = tokio::fs::read(e.path()).await {
                if let Ok(v) = serde_json::from_slice::<serde_json::Value>(&bytes) {
                    out.push(DraftEntry {
                        file_id: v.get("file_id").and_then(|x| x.as_str()).unwrap_or("").to_string(),
                        path: v.get("path").and_then(|x| x.as_str()).unwrap_or("").to_string(),
                        saved_at_ms: v.get("saved_at_ms").and_then(|x| x.as_i64()).unwrap_or(0),
                    });
                }
            }
        }
    }
    Ok(out)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn delete_draft(file_id: String) -> AppResult<()> {
    let p = draft_path(&file_id);
    if p.exists() {
        tokio::fs::remove_file(&p).await?;
    }
    Ok(())
}
