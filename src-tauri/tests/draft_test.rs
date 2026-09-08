use sharkmd_lib::commands::{draft, settings, settings::Settings};

#[tokio::test]
async fn draft_round_trip() {
    let fid = format!("test_{}", std::process::id());
    let path = std::env::temp_dir().join("sharkmd_test_draft.md");
    let _ = std::fs::remove_file(draft::draft_path(&fid));

    draft::save_draft(fid.clone(), r#"{"v":1}"#.into(), Some(path.to_string_lossy().into_owned()))
        .await
        .unwrap();
    let list = draft::list_drafts().await.unwrap();
    assert!(
        list.iter().any(|d| d.file_id == fid && d.path == path.to_string_lossy()),
        "draft should be saved with file_id and path"
    );

    draft::delete_draft(fid.clone()).await.unwrap();
    let list2 = draft::list_drafts().await.unwrap();
    assert!(!list2.iter().any(|d| d.file_id == fid));
}

#[tokio::test]
async fn settings_default_and_persist() {
    let _ = std::fs::remove_file(settings::settings_path());
    let s1 = settings::get_settings().await.unwrap();
    assert_eq!(s1.theme, "light");
    assert_eq!(s1.font_size, 16);

    let s2 = Settings {
        theme: "dark".into(),
        font_size: 18,
        custom_css_path: None,
        last_root_path: None,
        language: "en-US".into(),
    };
    settings::set_settings(s2.clone()).await.unwrap();
    let s3 = settings::get_settings().await.unwrap();
    assert_eq!(s3.theme, "dark");
    assert_eq!(s3.font_size, 18);
    assert_eq!(s3.language, "en-US");
}
