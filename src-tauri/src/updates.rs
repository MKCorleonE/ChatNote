//! Signed, resumable-across-launches desktop updates. No account/model data is sent.
use serde::{Deserialize, Serialize};
use std::{
    path::{Path, PathBuf},
    sync::Mutex,
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_updater::{Update, UpdaterExt};

const PACKAGE: &str = "package.bin";
const MANIFEST: &str = "pending.json";
const ATTEMPT: &str = "install-attempted";

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub phase: String,
    pub version: Option<String>,
    pub notes: Option<String>,
    pub downloaded: u64,
    pub total: Option<u64>,
    pub error: Option<String>,
}
impl Status {
    fn new(phase: &str) -> Self {
        Self {
            phase: phase.into(),
            version: None,
            notes: None,
            downloaded: 0,
            total: None,
            error: None,
        }
    }
    fn release(phase: &str, update: &Update) -> Self {
        Self {
            version: Some(update.version.clone()),
            notes: update.body.clone(),
            ..Self::new(phase)
        }
    }
}
pub struct Updates {
    directory: PathBuf,
    status: Mutex<Status>,
    available: Mutex<Option<Update>>,
    operation: tokio::sync::Mutex<()>,
}
impl Updates {
    pub fn new(directory: PathBuf) -> Self {
        Self {
            directory,
            status: Mutex::new(Status::new("starting")),
            available: Mutex::new(None),
            operation: tokio::sync::Mutex::new(()),
        }
    }
    fn set(&self, app: &AppHandle, status: Status) {
        *self.status.lock().unwrap_or_else(|e| e.into_inner()) = status.clone();
        let _ = app.emit("chatnote-update", status);
    }
    fn get(&self) -> Status {
        self.status
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone()
    }
}
fn updater<R: tauri::Runtime>(app: &AppHandle<R>) -> Result<tauri_plugin_updater::Updater, String> {
    app.updater_builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|_| "update.checkFailed".into())
}
fn load_pending<R: tauri::Runtime>(
    app: &AppHandle<R>,
    directory: &Path,
) -> Result<Option<(Update, Vec<u8>)>, String> {
    let manifest = directory.join(MANIFEST);
    if !manifest.exists() {
        return Ok(None);
    }
    let raw = std::fs::read(&manifest).map_err(|_| "update.cacheFailed")?;
    if raw.len() > 256_000 {
        return Err("update.invalidPackage".into());
    }
    let json = serde_json::from_slice(&raw).map_err(|_| "update.invalidPackage")?;
    let Some(update) = updater(app)?
        .restore_update(json)
        .map_err(|_| "update.invalidPackage")?
    else {
        clear_pending(directory);
        return Ok(None);
    };
    let bytes = std::fs::read(directory.join(PACKAGE)).map_err(|_| "update.invalidPackage")?;
    update.verify(&bytes).map_err(|_| "update.invalidPackage")?;
    Ok(Some((update, bytes)))
}
fn clear_pending(directory: &Path) {
    // Fixed filenames only; never remove workspace data or credentials.
    for name in [MANIFEST, PACKAGE, ATTEMPT, "package.part", "pending.part"] {
        let _ = std::fs::remove_file(directory.join(name));
    }
}
fn stage(directory: &Path, raw: &serde_json::Value, bytes: &[u8]) -> Result<(), String> {
    std::fs::create_dir_all(directory).map_err(|_| "update.cacheFailed")?;
    clear_pending(directory);
    use std::io::Write;
    for (temporary, final_name, data) in [
        ("package.part", PACKAGE, bytes.to_vec()),
        (
            "pending.part",
            MANIFEST,
            serde_json::to_vec(raw).map_err(|_| "update.cacheFailed")?,
        ),
    ] {
        let mut file =
            std::fs::File::create(directory.join(temporary)).map_err(|_| "update.cacheFailed")?;
        file.write_all(&data)
            .and_then(|_| file.sync_all())
            .map_err(|_| "update.cacheFailed")?;
        std::fs::rename(directory.join(temporary), directory.join(final_name))
            .map_err(|_| "update.cacheFailed")?;
    }
    Ok(())
}
fn install(app: &AppHandle, state: &Updates, update: Update, bytes: Vec<u8>) -> Result<(), String> {
    update.verify(&bytes).map_err(|_| "update.invalidPackage")?;
    // Keep the package for a manual retry, but never loop automatic installation after failure.
    std::fs::write(state.directory.join(ATTEMPT), update.version.as_bytes())
        .map_err(|_| "update.cacheFailed")?;
    state.set(app, Status::release("installing", &update));
    update
        .restart_after_install(true)
        .install(bytes)
        .map_err(|_| "update.installFailed")?;
    #[cfg(not(windows))]
    app.restart();
    Ok(())
}
pub fn startup(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let state = app.state::<Updates>();
        let _guard = state.operation.lock().await;
        if cfg!(debug_assertions) {
            state.set(&app, Status::new("development"));
        } else {
            match load_pending(&app, &state.directory) {
                Ok(Some((update, bytes))) => {
                    let mut ready = Status::release("ready", &update);
                    ready.downloaded = bytes.len() as u64;
                    ready.total = Some(bytes.len() as u64);
                    if state.directory.join(ATTEMPT).exists() {
                        ready.error = Some("update.previousAttempt".into());
                        state.set(&app, ready);
                    } else if let Err(error) = install(&app, &state, update, bytes) {
                        ready.error = Some(error);
                        state.set(&app, ready);
                    }
                }
                Ok(None) => state.set(&app, Status::new("idle")),
                Err(error) => {
                    clear_pending(&state.directory);
                    let mut status = Status::new("error");
                    status.error = Some(error);
                    state.set(&app, status);
                }
            }
        }
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
        }
    });
}
#[tauri::command]
pub fn update_status(state: State<Updates>) -> Status {
    state.get()
}

#[tauri::command]
pub async fn check_update(app: AppHandle, state: State<'_, Updates>) -> Result<Status, String> {
    let _guard = state.operation.try_lock().map_err(|_| "update.busy")?;
    if cfg!(debug_assertions) {
        return Ok(state.get());
    }
    if state.get().phase == "ready" {
        return Ok(state.get());
    }
    state.set(&app, Status::new("checking"));
    match updater(&app)?.check().await {
        Ok(Some(mut update)) => {
            // Enforce encrypted downloads too, not just encrypted version metadata.
            if update.download_url.scheme() != "https" {
                let mut status = Status::new("error");
                status.error = Some("update.checkFailed".into());
                state.set(&app, status.clone());
                return Ok(status);
            }
            update.timeout = Some(Duration::from_secs(600));
            let status = Status::release("available", &update);
            *state.available.lock().unwrap_or_else(|e| e.into_inner()) = Some(update);
            state.set(&app, status.clone());
            Ok(status)
        }
        Ok(None) => {
            let status = Status::new("current");
            state.set(&app, status.clone());
            Ok(status)
        }
        Err(_) => {
            let mut status = Status::new("error");
            status.error = Some("update.checkFailed".into());
            state.set(&app, status.clone());
            Ok(status)
        }
    }
}
#[tauri::command]
pub async fn download_update(app: AppHandle, state: State<'_, Updates>) -> Result<Status, String> {
    let _guard = state.operation.try_lock().map_err(|_| "update.busy")?;
    if cfg!(debug_assertions) {
        return Err("update.development".into());
    }
    if state.get().phase == "ready" {
        return Ok(state.get());
    }
    let update = state
        .available
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .clone()
        .ok_or("update.checkFirst")?;
    state.set(&app, Status::release("downloading", &update));
    let result = update
        .download(
            |count, total| {
                let mut status = state.get();
                status.downloaded += count as u64;
                status.total = total;
                state.set(&app, status);
            },
            || {},
        )
        .await;
    // The plugin verifies signature + signed version before this durable marker is written.
    let result = result
        .map_err(|_| "update.downloadFailed".to_string())
        .and_then(|bytes| {
            stage(&state.directory, &update.raw_json, &bytes)?;
            Ok(bytes.len())
        });
    match result {
        Ok(size) => {
            let mut status = Status::release("ready", &update);
            status.downloaded = size as u64;
            status.total = Some(size as u64);
            state.set(&app, status.clone());
            Ok(status)
        }
        Err(error) => {
            let mut status = Status::release("available", &update);
            status.error = Some(error);
            state.set(&app, status.clone());
            Ok(status)
        }
    }
}
#[tauri::command]
pub async fn install_update(app: AppHandle, state: State<'_, Updates>) -> Result<(), String> {
    let _guard = state.operation.try_lock().map_err(|_| "update.busy")?;
    if cfg!(debug_assertions) {
        return Err("update.development".into());
    }
    if !app
        .state::<crate::Runtime>()
        .jobs
        .lock()
        .map_err(|_| "update.wait")?
        .is_empty()
    {
        return Err("update.wait".into());
    }
    let (update, bytes) = load_pending(&app, &state.directory)?.ok_or("update.checkFirst")?;
    let mut ready = Status::release("ready", &update);
    if let Err(error) = install(&app, &state, update, bytes) {
        ready.error = Some(error.clone());
        state.set(&app, ready);
        return Err(error);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cached_updates_verify_signature_and_signed_version_without_network() {
        let config: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        let mut context = tauri::test::mock_context(tauri::test::noop_assets());
        context
            .config_mut()
            .plugins
            .0
            .insert("updater".into(), config["plugins"]["updater"].clone());
        let app = tauri::test::mock_builder()
            .plugin(tauri_plugin_updater::Builder::new().build())
            .build(context)
            .unwrap();
        let updater = app.updater().unwrap();
        let manifest = serde_json::json!({"version":"0.13.1","platforms":{"windows-x86_64":{"url":"https://example.invalid/never-downloaded.exe","signature":include_str!("../testdata/update-fixture.txt.sig").trim()}}});
        let update = updater.restore_update(manifest.clone()).unwrap().unwrap();
        let bytes = include_bytes!("../testdata/update-fixture.txt");
        update.verify(bytes).unwrap();
        assert!(update.verify(b"tampered package").is_err());
        let mut changed = manifest.clone();
        changed["version"] = serde_json::json!("99.0.0");
        assert!(updater
            .restore_update(changed)
            .unwrap()
            .unwrap()
            .verify(bytes)
            .is_err());
        let mut old = manifest;
        old["version"] = serde_json::json!("0.0.1");
        assert!(updater.restore_update(old).unwrap().is_none());
    }
    #[test]
    fn staging_commits_manifest_last_and_preserves_other_files() {
        let root = std::env::temp_dir().join(format!("chatnote-update-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(root.join("workspace.sqlite"), b"unchanged").unwrap();
        stage(
            &root,
            &serde_json::json!({"version":"0.13.1"}),
            b"verified bytes",
        )
        .unwrap();
        assert_eq!(
            std::fs::read(root.join(PACKAGE)).unwrap(),
            b"verified bytes"
        );
        assert!(root.join(MANIFEST).exists());
        assert!(!root.join(ATTEMPT).exists());
        std::fs::write(root.join(ATTEMPT), b"0.13.1").unwrap();
        clear_pending(&root);
        assert!(!root.join(MANIFEST).exists());
        assert!(!root.join(PACKAGE).exists());
        assert_eq!(
            std::fs::read(root.join("workspace.sqlite")).unwrap(),
            b"unchanged"
        );
        std::fs::remove_dir_all(root).unwrap();
    }
}
