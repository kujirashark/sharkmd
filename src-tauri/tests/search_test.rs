use sharkmd_lib::commands::search::{
    list_markdown_files, search_in_files, SearchRequest,
};
use std::fs;
use std::path::PathBuf;
use tempfile::TempDir;

fn make_file(dir: &TempDir, name: &str, content: &str) -> PathBuf {
    let p = dir.path().join(name);
    fs::create_dir_all(p.parent().unwrap()).unwrap();
    fs::write(&p, content).unwrap();
    p
}

#[tokio::test]
async fn list_markdown_files_basic() {
    let tmp = TempDir::new().unwrap();
    make_file(&tmp, "a.md", "# A");
    make_file(&tmp, "sub/b.md", "# B");
    make_file(&tmp, "ignore.c", "// skip");
    make_file(&tmp, "node_modules/c.md", "# skip");

    let entries = list_markdown_files(tmp.path().to_path_buf()).await.unwrap();
    let names: Vec<_> = entries.iter().map(|e| e.rel_path.clone()).collect();

    // .md files included
    assert!(names.iter().any(|n| n.ends_with("a.md")));
    assert!(names.iter().any(|n| n.ends_with("b.md")));
    // non-.md excluded
    assert!(!names.iter().any(|n| n.ends_with("ignore.c")));
}

#[tokio::test]
async fn list_markdown_files_respects_gitignore() {
    let tmp = TempDir::new().unwrap();
    make_file(&tmp, ".gitignore", "private/\n");
    make_file(&tmp, "public.md", "# public");
    make_file(&tmp, "private/secret.md", "# secret");

    let entries = list_markdown_files(tmp.path().to_path_buf()).await.unwrap();
    let names: Vec<_> = entries.iter().map(|e| e.rel_path.clone()).collect();

    assert!(names.iter().any(|n| n.ends_with("public.md")));
    assert!(
        !names.iter().any(|n| n.contains("private")),
        "private/ should be gitignored"
    );
}

#[tokio::test]
async fn search_in_files_finds_matches() {
    let tmp = TempDir::new().unwrap();
    make_file(&tmp, "a.md", "# Heading\nHello world\nAnother line");
    make_file(&tmp, "b.md", "World peace");

    let req = SearchRequest {
        root: tmp.path().to_string_lossy().to_string(),
        pattern: "world".to_string(),
        use_regex: false,
        case_sensitive: false,
        max_results: None,
    };
    let results = search_in_files(req).await.unwrap();

    // Should find 2 matches (one in each file, case insensitive)
    assert_eq!(results.len(), 2);
    assert!(results.iter().all(|m| m.match_text.to_lowercase() == "world"));
}

#[tokio::test]
async fn search_in_files_case_sensitive() {
    let tmp = TempDir::new().unwrap();
    make_file(&tmp, "a.md", "Hello World");

    let req_cs = SearchRequest {
        root: tmp.path().to_string_lossy().to_string(),
        pattern: "World".to_string(),
        use_regex: false,
        case_sensitive: true,
        max_results: None,
    };
    let results_cs = search_in_files(req_cs).await.unwrap();
    assert_eq!(results_cs.len(), 1);

    let req_ci = SearchRequest {
        root: tmp.path().to_string_lossy().to_string(),
        pattern: "world".to_string(),
        use_regex: false,
        case_sensitive: false,
        max_results: None,
    };
    let results_ci = search_in_files(req_ci).await.unwrap();
    assert_eq!(results_ci.len(), 1);
    assert_eq!(results_ci[0].match_text, "World");
}

#[tokio::test]
async fn search_in_files_regex() {
    let tmp = TempDir::new().unwrap();
    make_file(&tmp, "a.md", "TODO: fix this\nLater\nBUG: bug here");

    let req = SearchRequest {
        root: tmp.path().to_string_lossy().to_string(),
        pattern: r"^(TODO|BUG):".to_string(),
        use_regex: true,
        case_sensitive: true,
        max_results: None,
    };
    let results = search_in_files(req).await.unwrap();
    assert_eq!(results.len(), 2);
    assert_eq!(results[0].line, 1);
    assert_eq!(results[0].col, 1);
    assert_eq!(results[1].line, 3);
}

#[tokio::test]
async fn search_in_files_line_col_correct() {
    let tmp = TempDir::new().unwrap();
    make_file(&tmp, "a.md", "first\nsecond has foo\nthird");

    let req = SearchRequest {
        root: tmp.path().to_string_lossy().to_string(),
        pattern: "foo".to_string(),
        use_regex: false,
        case_sensitive: true,
        max_results: None,
    };
    let results = search_in_files(req).await.unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].line, 2);
    // "second has foo"：'f' 在 1-based col 12 (前面 11 个 char)
    assert_eq!(results[0].col, 12);
}

#[tokio::test]
async fn search_in_files_max_results_truncates() {
    let tmp = TempDir::new().unwrap();
    // 10 个文件，每个 1 个匹配
    for i in 0..10 {
        make_file(&tmp, &format!("f{}.md", i), "match here");
    }

    let req = SearchRequest {
        root: tmp.path().to_string_lossy().to_string(),
        pattern: "match".to_string(),
        use_regex: false,
        case_sensitive: true,
        max_results: Some(3),
    };
    let results = search_in_files(req).await.unwrap();
    assert_eq!(results.len(), 3);
}

#[tokio::test]
async fn search_in_files_skips_large_files() {
    let tmp = TempDir::new().unwrap();
    let big = "x".repeat(3 * 1024 * 1024); // 3 MB
    make_file(&tmp, "big.md", &big);
    make_file(&tmp, "small.md", "tiny content with match");

    let req = SearchRequest {
        root: tmp.path().to_string_lossy().to_string(),
        pattern: "match".to_string(),
        use_regex: false,
        case_sensitive: true,
        max_results: None,
    };
    let results = search_in_files(req).await.unwrap();
    // Only small.md should match (big.md skipped)
    assert_eq!(results.len(), 1);
    assert!(results[0].file.ends_with("small.md"));
}
