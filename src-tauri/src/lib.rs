mod error;
mod log_setup;
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![])
        .setup(|_app| {
            log_setup::init();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running easymd");
}