use sharkmd_lib::error::AppError;

#[test]
fn app_error_io_constructs_with_code_io_error() {
    let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "no such file");
    let e: AppError = io_err.into();
    assert_eq!(e.code, "io_error");
    assert!(e.message.contains("no such file"));
    assert!(e.detail.is_none());
}

#[test]
fn app_error_serialization_contains_code_message_detail() {
    let e = AppError::new("custom_code", "user-facing message")
        .with_detail("debug detail");
    let json = serde_json::to_value(&e).unwrap();
    assert_eq!(json["code"], "custom_code");
    assert_eq!(json["message"], "user-facing message");
    assert_eq!(json["detail"], "debug detail");
}

#[test]
fn app_error_display_uses_message() {
    let e = AppError::new("c", "hello");
    assert_eq!(format!("{}", e), "hello");
}

#[test]
fn log_setup_init_does_not_panic() {
    sharkmd_lib::log_setup::init();
}
