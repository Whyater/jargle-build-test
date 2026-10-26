use tauri::webview::NewWindowResponse;
use tauri::WebviewWindowBuilder;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // Updates come from the GitHub release (see plugins.updater in tauri.conf.json).
        .plugin(tauri_plugin_updater::Builder::new().build())
        // Lets the app relaunch itself after an update installs.
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let window_config = &app.config().app.windows[0];
            WebviewWindowBuilder::from_config(app.handle(), window_config)?
                .on_navigation(|url| {
                    let stays_in_app = url.scheme() == "tauri"
                        || url.host_str() == Some("tauri.localhost")
                        || (cfg!(debug_assertions) && url.host_str() == Some("localhost"));

                    if stays_in_app {
                        return true;
                    }

                    if matches!(url.scheme(), "http" | "https") {
                        let _ = tauri_plugin_opener::open_url(url.as_str(), None::<&str>);
                    }
                    false
                })
                .on_new_window(|url, _features| {
                    if matches!(url.scheme(), "http" | "https") {
                        let _ = tauri_plugin_opener::open_url(url.as_str(), None::<&str>);
                    }
                    NewWindowResponse::Deny
                })
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Jargle");
}
