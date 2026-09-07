use easymd_lib::commands::fs as fs_cmd;
use std::fs;
use tempfile::tempdir;

#[tokio::test]
async fn open_file_reads_utf8_text_and_meta() {
    let dir = tempdir().unwrap();
    let p = dir.path().join("a.md");
    fs::write(&p, "# hello\n").unwrap();
    let fc = fs_cmd::open_file(p.clone()).await.unwrap();
    assert_eq!(fc.text, "# hello\n");
    assert!(fc.size > 0);
    assert!(fc.mtime_ms > 0);
}

#[tokio::test]
async fn open_file_rejects_oversized_file() {
    let dir = tempdir().unwrap();
    let p = dir.path().join("big.md");
    let big = vec![b'x'; 11 * 1024 * 1024];
    fs::write(&p, &big).unwrap();
    let err = fs_cmd::open_file(p).await.unwrap_err();
    assert_eq!(err.code_str(), "file_too_large");
}

#[tokio::test]
async fn save_file_writes_atomically_and_updates_mtime() {
    let dir = tempdir().unwrap();
    let p = dir.path().join("o.md");
    fs::write(&p, "old").unwrap();
    let res = fs_cmd::save_file(p.clone(), "new".into()).await.unwrap();
    assert_eq!(fs::read_to_string(&p).unwrap(), "new");
    assert!(res.mtime_ms > 0);
    assert!(!p.with_extension("md.tmp").exists(), "tmp file should be renamed");
}

#[tokio::test]
async fn read_dir_returns_md_files_and_dirs_sorted() {
    let dir = tempdir().unwrap();
    fs::create_dir(dir.path().join("sub")).unwrap();
    fs::write(dir.path().join("b.md"), "").unwrap();
    fs::write(dir.path().join("a.md"), "").unwrap();
    fs::write(dir.path().join("c.txt"), "").unwrap();
    let entries = fs_cmd::read_dir(dir.path().to_path_buf()).await.unwrap();
    let names: Vec<_> = entries.iter().map(|e| e.name.as_str()).collect();
    assert_eq!(names, vec!["a.md", "b.md", "sub"]);
    assert!(entries[0].is_md);
    assert!(!entries[2].is_md);
    // sub is dir
    let sub = entries.iter().find(|e| e.name == "sub").unwrap();
    assert!(sub.is_dir);
}
