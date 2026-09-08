//! Native PDF export via WebView2 `PrintToPdf` (Windows only).
//!
//! Workflow:
//!  1. Frontend injects a fullscreen iframe containing the rendered HTML.
//!  2. Frontend awaits `iframe.onload` (HTML is fully parsed).
//!  3. Frontend calls this `print_to_pdf(path)` command.
//!  4. Backend captures the current webview content (including iframe) as PDF.
//!  5. Frontend removes the iframe.

#[cfg(windows)]
use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2_7;
#[cfg(windows)]
use windows_core::Interface;

/// Render the current WebView2 contents to a PDF file.
///
/// `path` must be an absolute Windows path. Returns the path on success.
#[tauri::command(rename_all = "camelCase")]
pub async fn print_to_pdf(window: tauri::WebviewWindow, path: String) -> Result<String, String> {
    #[cfg(windows)]
    {
        let window_clone = window.clone();
        tokio::task::spawn_blocking(move || run_print(&window_clone, &path))
            .await
            .map_err(|e| format!("spawn_blocking failed: {e}"))?
    }
    #[cfg(not(windows))]
    {
        let _ = (window, path);
        Err("PDF export is only implemented on Windows for now".to_string())
    }
}

#[cfg(windows)]
fn run_print(window: &tauri::WebviewWindow, path: &str) -> Result<String, String> {
    use std::ffi::OsStr;
    use std::iter::once;
    use std::os::windows::ffi::OsStrExt;
    use std::sync::mpsc;

    let wide_path: Vec<u16> = OsStr::new(path)
        .encode_wide()
        .chain(once(0))
        .collect();

    let (tx, rx) = mpsc::channel::<Result<(), String>>();

    window
        .with_webview(move |platform_webview| {
            let controller = platform_webview.controller();
            let result: Result<(), String> = (|| unsafe {
                let core = controller
                    .CoreWebView2()
                    .map_err(|e| format!("CoreWebView2: {e}"))?;
                let core_7: ICoreWebView2_7 = core
                    .cast()
                    .map_err(|e| format!("cast ICoreWebView2_7: {e}"))?;
                let pwstr_path = windows_core::PCWSTR(wide_path.as_ptr());

                webview2_com::PrintToPdfCompletedHandler::wait_for_async_operation(
                    Box::new(move |handler| {
                        core_7
                            .PrintToPdf(pwstr_path, None, &handler)
                            .map_err(webview2_com::Error::from)
                    }),
                    Box::new(move |hresult, success| {
                        hresult?; // windows_core::Result<()>
                        if !success {
                            return Err(windows_core::Error::from_win32());
                        }
                        Ok(())
                    }),
                )
                .map_err(|e| format!("PrintToPdf wait: {e}"))
            })();

            let _ = tx.send(result);
        })
        .map_err(|e| format!("with_webview: {e}"))?;

    rx.recv()
        .map_err(|e| format!("recv from with_webview: {e}"))?
        .map(|_| path.to_string())
}
