mod auth;
mod network;
#[cfg(test)]
mod profile_tests;
mod storage;
mod usage;
mod vault;
use std::{collections::HashMap, sync::Mutex};
use tauri::Manager;
use tokio::sync::watch;

pub struct Runtime {
    db: Mutex<rusqlite::Connection>,
    jobs: Mutex<HashMap<String, watch::Sender<bool>>>,
    login: tokio::sync::Mutex<()>,
    login_cancel: Mutex<Option<watch::Sender<bool>>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _, _| {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
    }));
    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let directory = std::env::var_os("CHATNOTE_DATA_DIR")
                .map(std::path::PathBuf::from)
                .unwrap_or(app.path().app_data_dir()?);
            std::fs::create_dir_all(&directory)?;
            let db = storage::open_database(&directory.join("chatnote.sqlite"))?;
            app.manage(Runtime {
                db: Mutex::new(db),
                jobs: Mutex::new(HashMap::new()),
                login: tokio::sync::Mutex::new(()),
                login_cancel: Mutex::new(None),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            storage::load_workspace,
            storage::save_workspace,
            auth::connection_status,
            auth::set_api_key,
            auth::profile_status,
            auth::sign_in_chatgpt,
            auth::cancel_sign_in,
            auth::check_sign_in_service,
            auth::sign_out_chatgpt,
            network::list_models,
            network::generate,
            network::cancel_generation,
            usage::connection_usage
        ])
        .run(tauri::generate_context!())
        .expect("Could not start ChatNote. Your saved database has not been replaced.");
}
