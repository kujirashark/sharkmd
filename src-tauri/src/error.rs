use serde::{Serialize, Serializer};

/// Application-wide error type. Carries a stable error code (for frontend
/// dispatch), a user-facing message, and an optional debug detail.
#[derive(Debug, Clone)]
pub struct AppError {
    pub code: String,
    pub message: String,
    pub detail: Option<String>,
}

impl AppError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            detail: None,
        }
    }

    pub fn with_detail(mut self, detail: impl Into<String>) -> Self {
        self.detail = Some(detail.into());
        self
    }

    /// Returns the error code as a string slice.
    pub fn code_str(&self) -> &str {
        &self.code
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.message)
    }
}

impl std::error::Error for AppError {}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeStruct;
        let mut st = serializer.serialize_struct("AppError", 3)?;
        st.serialize_field("code", &self.code)?;
        st.serialize_field("message", &self.message)?;
        st.serialize_field("detail", &self.detail)?;
        st.end()
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        Self {
            code: "io_error".to_string(),
            message: format!("IO 错误：{}", e),
            detail: None,
        }
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        Self {
            code: "json_error".to_string(),
            message: format!("序列化错误：{}", e),
            detail: None,
        }
    }
}

impl From<notify::Error> for AppError {
    fn from(e: notify::Error) -> Self {
        Self {
            code: "notify_error".to_string(),
            message: format!("文件监听错误：{}", e),
            detail: None,
        }
    }
}

/// Convenient Result alias.
pub type AppResult<T> = Result<T, AppError>;
