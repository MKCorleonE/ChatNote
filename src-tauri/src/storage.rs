use crate::Runtime;
use rusqlite::{Connection, OptionalExtension};
use std::path::Path;

pub fn open_database(path: &Path) -> Result<Connection, Box<dyn std::error::Error>> {
    let db = Connection::open(path)?;
    db.busy_timeout(std::time::Duration::from_secs(5))?;
    let version: i64 = db.pragma_query_value(None, "user_version", |row| row.get(0))?;
    if version > 1 {
        return Err("This database needs a newer ChatNote version.".into());
    }
    db.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL, updated_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS recovery (id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS runtime_settings (name TEXT PRIMARY KEY, value TEXT NOT NULL); PRAGMA user_version=1;")?;
    Ok(db)
}
pub fn write_workspace(db: &mut Connection, payload: &str) -> Result<(), String> {
    if payload.len() > 20_000_000 {
        return Err(
            "Workspace exceeds 20 MB. Export old conversations to keep this build responsive."
                .into(),
        );
    }
    let data: serde_json::Value =
        serde_json::from_str(payload).map_err(|_| "Invalid workspace JSON")?;
    if data["version"] != 1 || !data["sessions"].is_array() {
        return Err("Unsupported workspace format".into());
    }
    let tx = db.transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT INTO recovery(payload) SELECT payload FROM workspace WHERE id=1",
        [],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "DELETE FROM recovery WHERE id NOT IN (SELECT id FROM recovery ORDER BY id DESC LIMIT 3)",
        [],
    )
    .map_err(|e| e.to_string())?;
    tx.execute("INSERT INTO workspace(id,payload,updated_at) VALUES(1,?1,datetime('now')) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at",[payload]).map_err(|e|e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}
#[tauri::command]
pub fn load_workspace(state: tauri::State<Runtime>) -> Result<Option<String>, String> {
    state
        .db
        .lock()
        .map_err(|_| "Database lock failed")?
        .query_row("SELECT payload FROM workspace WHERE id=1", [], |r| r.get(0))
        .optional()
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn save_workspace(state: tauri::State<Runtime>, payload: String) -> Result<(), String> {
    let mut db = state.db.lock().map_err(|_| "Database lock failed")?;
    write_workspace(&mut db, &payload)
}
pub fn host_id(state: &Runtime) -> Result<String, String> {
    let db = state.db.lock().map_err(|_| "Database lock failed")?;
    if let Some(id) = db
        .query_row(
            "SELECT value FROM runtime_settings WHERE name='host_id'",
            [],
            |r| r.get::<_, String>(0),
        )
        .optional()
        .map_err(|e| e.to_string())?
    {
        return Ok(id);
    }
    let id = format!("urn:uuid:{}", uuid::Uuid::new_v4());
    db.execute(
        "INSERT INTO runtime_settings(name,value) VALUES('host_id',?1)",
        [&id],
    )
    .map_err(|e| e.to_string())?;
    Ok(id)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn durable_round_trip_and_recovery() {
        let path =
            std::env::temp_dir().join(format!("chatnote-test-{}.sqlite", uuid::Uuid::new_v4()));
        {
            let mut db = open_database(&path).unwrap();
            write_workspace(&mut db, r#"{"version":1,"sessions":[{"id":"one"}]}"#).unwrap();
            write_workspace(&mut db, r#"{"version":1,"sessions":[{"id":"two"}]}"#).unwrap();
            assert_eq!(
                db.query_row("SELECT count(*) FROM recovery", [], |r| r.get::<_, i64>(0))
                    .unwrap(),
                1
            );
            assert!(write_workspace(&mut db, "broken").is_err());
        }
        {
            let db = open_database(&path).unwrap();
            let saved: String = db
                .query_row("SELECT payload FROM workspace", [], |r| r.get(0))
                .unwrap();
            assert!(saved.contains("two"));
        }
        std::fs::remove_file(path).unwrap();
    }
    #[test]
    fn newer_database_is_not_downgraded() {
        let path =
            std::env::temp_dir().join(format!("chatnote-newer-{}.sqlite", uuid::Uuid::new_v4()));
        {
            let db = Connection::open(&path).unwrap();
            db.pragma_update(None, "user_version", 2).unwrap();
        }
        assert!(open_database(&path).is_err());
        std::fs::remove_file(path).unwrap();
    }
}
