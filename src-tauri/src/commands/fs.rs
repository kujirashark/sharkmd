use crate::error::{AppError, AppResult};
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use tauri::{AppHandle, Emitter};

pub const MAX_FILE_SIZE: u64 = 10 * 1024 * 1024;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileContent {
    pub text: String,
    pub size: u64,
    pub mtime_ms: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SaveResult {
    pub mtime_ms: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_md: bool,
}

#[tauri::command(rename_all = "camelCase")]
pub async fn open_file(path: PathBuf) -> AppResult<FileContent> {
    let meta = tokio::fs::metadata(&path).await?;
    if meta.len() > MAX_FILE_SIZE {
        return Err(AppError::new("file_too_large", format!("文件过大（{} 字节），MVP 限制 10MB", meta.len())));
    }
    let bytes = tokio::fs::read(&path).await?;
    let text = String::from_utf8_lossy(&bytes).into_owned();
    let mtime_ms = mtime_to_ms(meta.modified().unwrap_or(SystemTime::now()));
    Ok(FileContent { text, size: meta.len(), mtime_ms })
}

#[tauri::command(rename_all = "camelCase")]
pub async fn save_file(path: PathBuf, content: String) -> AppResult<SaveResult> {
    write_atomic(&path, content.as_bytes()).await?;
    let mtime = tokio::fs::metadata(&path).await?.modified().unwrap_or(SystemTime::now());
    Ok(SaveResult { mtime_ms: mtime_to_ms(mtime) })
}

#[tauri::command(rename_all = "camelCase")]
pub async fn save_as(src_path: PathBuf, dest_path: PathBuf, content: String) -> AppResult<SaveResult> {
    if let Some(parent) = dest_path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    write_atomic(&dest_path, content.as_bytes()).await?;
    let _ = src_path; // MVP 不做 mtime 校验
    let mtime = tokio::fs::metadata(&dest_path).await?.modified().unwrap_or(SystemTime::now());
    Ok(SaveResult { mtime_ms: mtime_to_ms(mtime) })
}

#[tauri::command(rename_all = "camelCase")]
pub async fn read_dir(path: PathBuf) -> AppResult<Vec<DirEntry>> {
    let mut entries = Vec::new();
    let mut rd = tokio::fs::read_dir(&path).await?;
    while let Some(e) = rd.next_entry().await? {
        let name = e.file_name().to_string_lossy().into_owned();
        let p = e.path();
        let is_dir = e.file_type().await?.is_dir();
        let is_md = !is_dir && p.extension().map(|x| x == "md").unwrap_or(false);
        entries.push(DirEntry { name, path: p.to_string_lossy().into_owned(), is_dir, is_md });
    }
    entries.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(entries)
}

async fn write_atomic(path: &Path, bytes: &[u8]) -> AppResult<()> {
    let tmp = path.with_extension(format!(
        "{}.tmp",
        path.extension().and_then(|s| s.to_str()).unwrap_or("md")
    ));
    tokio::fs::write(&tmp, bytes).await?;
    tokio::fs::rename(&tmp, path).await?;
    Ok(())
}

fn mtime_to_ms(t: SystemTime) -> i64 {
    t.duration_since(SystemTime::UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExternalChange {
    pub path: String,
    pub mtime_ms: i64,
}

#[tauri::command(rename_all = "camelCase")]
pub async fn watch(path: PathBuf, app: AppHandle) -> AppResult<()> {
    use std::sync::mpsc::channel;
    let (tx, rx) = channel::<notify::Result<Event>>();

    let mut watcher = RecommendedWatcher::new(tx, notify::Config::default())?;
    watcher.watch(&path, RecursiveMode::NonRecursive)?;

    let app_clone = app.clone();
    std::thread::spawn(move || {
        for res in rx {
            if let Ok(ev) = res {
                if matches!(ev.kind, EventKind::Modify(_) | EventKind::Create(_) | EventKind::Remove(_)) {
                    for p in ev.paths {
                        let mtime_ms = std::fs::metadata(&p)
                            .and_then(|m| m.modified())
                            .ok()
                            .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
                            .map(|d| d.as_millis() as i64)
                            .unwrap_or(0);
                        let _ = app_clone.emit(
                            "fs:external-change",
                            ExternalChange { path: p.to_string_lossy().into_owned(), mtime_ms },
                        );
                    }
                }
            }
        }
    });

    Ok(())
}
