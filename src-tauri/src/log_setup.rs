use log::LevelFilter;
use std::fs;
use std::path::PathBuf;

pub fn init() {
    let dir = data_dir().join("logs");
    let _ = fs::create_dir_all(&dir);
    // tauri-plugin-log 已接管文件输出；这里只设置全局 level。
    let _ = log::set_logger(&LOGGER);
    log::set_max_level(LevelFilter::Info);
}

fn data_dir() -> PathBuf {
    dirs::data_local_dir().unwrap_or_else(|| PathBuf::from(".")).join("sharkmd")
}

static LOGGER: SimpleLogger = SimpleLogger;

struct SimpleLogger;

impl log::Log for SimpleLogger {
    fn enabled(&self, m: &log::Metadata) -> bool { m.level() <= log::Level::Info }
    fn log(&self, record: &log::Record) {
        if self.enabled(record.metadata()) {
            eprintln!("[{}] [{}] {}",
                chrono::Local::now().format("%Y-%m-%d %H:%M:%S"),
                record.target(),
                record.args());
        }
    }
    fn flush(&self) {}
}
