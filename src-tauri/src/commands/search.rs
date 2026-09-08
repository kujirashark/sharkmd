use crate::error::{AppError, AppResult};
use ignore::WalkBuilder;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MdFileEntry {
    pub path: String,
    pub rel_path: String,
    pub size: u64,
    pub mtime_ms: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatch {
    pub file: String,
    pub rel_path: String,
    pub line: u32, // 1-based
    pub col: u32,  // 1-based char column (UTF-8 char index)
    pub line_text: String,
    pub match_text: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchRequest {
    pub root: String,
    pub pattern: String,
    pub use_regex: bool,
    pub case_sensitive: bool,
    pub max_results: Option<u32>,
}

const DEFAULT_MAX_RESULTS: u32 = 500;
const MAX_FILE_SIZE: u64 = 2 * 1024 * 1024; // 2 MB skip

/// List all markdown files under `root`, respecting .gitignore / .ignore rules.
/// Uses the `ignore` crate which respects standard_filters (.gitignore, .ignore,
/// global gitignore, .git/info/exclude). Does not require the root to be a git repo.
#[tauri::command(rename_all = "camelCase")]
pub async fn list_markdown_files(root: PathBuf) -> AppResult<Vec<MdFileEntry>> {
    // Run blocking walk on a dedicated thread to keep the async runtime responsive.
    tokio::task::spawn_blocking(move || list_markdown_files_blocking(&root))
        .await
        .map_err(|e| AppError::new("join_error", e.to_string()))?
}

fn list_markdown_files_blocking(root: &PathBuf) -> AppResult<Vec<MdFileEntry>> {
    let walker = WalkBuilder::new(root)
        .standard_filters(true) // .gitignore / .ignore / global gitignore
        .require_git(false) // 不要求是 git repo
        .hidden(false) // 不默认隐藏 . 开头的（让 .gitignore 决定）
        .build();

    let mut entries: Vec<MdFileEntry> = Vec::new();

    for result in walker {
        let entry = match result {
            Ok(e) => e,
            Err(_) => continue,
        };

        if !entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
            continue;
        }

        let path = entry.path();
        let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
        if !matches!(ext, "md" | "markdown" | "mdx") {
            continue;
        }

        let metadata = match std::fs::metadata(path) {
            Ok(m) => m,
            Err(_) => continue,
        };

        let abs_path = match path.canonicalize() {
            Ok(p) => p,
            Err(_) => path.to_path_buf(),
        };

        let rel_path = path
            .strip_prefix(root)
            .unwrap_or(path)
            .to_string_lossy()
            .to_string();

        let mtime_ms = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);

        entries.push(MdFileEntry {
            path: abs_path.to_string_lossy().to_string(),
            rel_path,
            size: metadata.len(),
            mtime_ms,
        });
    }

    entries.sort_by(|a, b| a.rel_path.cmp(&b.rel_path));
    Ok(entries)
}

/// Search across all markdown files under root. Returns up to max_results matches.
#[tauri::command(rename_all = "camelCase")]
pub async fn search_in_files(req: SearchRequest) -> AppResult<Vec<SearchMatch>> {
    let max = req.max_results.unwrap_or(DEFAULT_MAX_RESULTS) as usize;
    let root = PathBuf::from(&req.root);

    // 1. List markdown files (blocking walk on dedicated thread)
    let files = list_markdown_files(root.clone()).await?;

    // 2. Compile matcher once. We always use regex: literal/case-insensitive are
    //    simple regex patterns (escaped + optional case-insensitive flag). This
    //    avoids building a separate lower-cased memchr path.
    let regex = build_regex(&req.pattern, req.use_regex, req.case_sensitive)?;

    // 3. Parallel search via rayon
    let root_for_rel = root.clone();
    let matches: Vec<SearchMatch> = files
        .par_iter()
        .flat_map(|entry| match search_file(entry, &regex, &root_for_rel) {
            Ok(m) => m,
            Err(_) => Vec::new(),
        })
        .collect();

    // 4. Truncate to max_results
    Ok(matches.into_iter().take(max).collect())
}

fn build_regex(pattern: &str, use_regex: bool, case_sensitive: bool) -> AppResult<regex::Regex> {
    let effective_pattern = if use_regex {
        pattern.to_string()
    } else {
        // Escape user input so plain strings like "foo.bar" don't match "fooXbar"
        regex::escape(pattern)
    };

    let mut builder = regex::RegexBuilder::new(&effective_pattern);
    builder.case_insensitive(!case_sensitive);

    builder
        .build()
        .map_err(|e| AppError::new("regex_error", format!("正则表达式错误：{}", e)))
}

fn search_file(
    entry: &MdFileEntry,
    regex: &regex::Regex,
    _root: &PathBuf,
) -> AppResult<Vec<SearchMatch>> {
    if entry.size > MAX_FILE_SIZE {
        return Ok(Vec::new());
    }

    let content = std::fs::read_to_string(&entry.path)?;
    let mut results = Vec::new();

    for (line_idx, line) in content.lines().enumerate() {
        for mat in regex.find_iter(line) {
            let col = line[..mat.start()].chars().count() as u32 + 1;
            results.push(SearchMatch {
                file: entry.path.clone(),
                rel_path: entry.rel_path.clone(),
                line: (line_idx + 1) as u32,
                col,
                line_text: line.to_string(),
                match_text: mat.as_str().to_string(),
            });
        }
    }

    Ok(results)
}
